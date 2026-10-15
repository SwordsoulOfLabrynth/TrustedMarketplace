using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Subscriptions;
using TrustedMarketplace.Application.Subscriptions.Dtos;
using TrustedMarketplace.Domain.Auditing;
using TrustedMarketplace.Domain.Catalog;
using TrustedMarketplace.Domain.Common.Exceptions;
using TrustedMarketplace.Domain.Subscriptions;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.Infrastructure.Subscriptions;

public class SubscriptionService : ISubscriptionService
{
    private readonly AppDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SubscriptionService> _logger;

    public SubscriptionService(
        AppDbContext dbContext,
        IConfiguration configuration,
        ILogger<SubscriptionService> logger)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<IReadOnlyList<SubscriptionPlanDto>> GetActivePlansAsync(CancellationToken ct = default)
    {
        var plans = await _dbContext.SubscriptionPlans
            .AsNoTracking()
            .Where(p => p.IsActive)
            .OrderBy(p => p.PriceAmount)
            .ToListAsync(ct);

        return plans.Select(p => new SubscriptionPlanDto(
            p.Id,
            p.Name,
            p.MaxActiveListings,
            p.PriceAmount,
            p.CurrencyCode,
            p.BillingPeriod,
            p.IsActive)).ToList();
    }

    public async Task<SellerSubscriptionDto?> GetSellerSubscriptionAsync(Guid sellerUserId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        // Return latest pending verification, rejected, or active subscription
        var sub = await _dbContext.SellerSubscriptions
            .Include(s => s.SubscriptionPlan)
            .AsNoTracking()
            .Where(s => s.SellerUserId == sellerUserId &&
                        (s.Status == SubscriptionStatus.PendingVerification ||
                         s.Status == SubscriptionStatus.Rejected ||
                         (s.Status == SubscriptionStatus.Active && s.ExpiresAtUtc > now)))
            .OrderBy(s => s.Status == SubscriptionStatus.PendingVerification ? 0 :
                          s.Status == SubscriptionStatus.Rejected ? 1 : 2)
            .ThenByDescending(s => s.PaymentSubmittedAtUtc ?? s.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (sub == null || sub.SubscriptionPlan == null)
            return null;

        var store = await _dbContext.SellerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.SellerUserId == sellerUserId, ct);

        return ToDto(sub, store?.StoreName);
    }

    public async Task<SellerQuotaDto> GetSellerQuotaAsync(Guid sellerUserId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var sub = await _dbContext.SellerSubscriptions
            .Include(s => s.SubscriptionPlan)
            .AsNoTracking()
            .Where(s => s.SellerUserId == sellerUserId && s.Status == SubscriptionStatus.Active && s.ExpiresAtUtc > now)
            .OrderByDescending(s => s.ExpiresAtUtc)
            .FirstOrDefaultAsync(ct);

        int maxListings;
        string planName;

        if (sub?.SubscriptionPlan != null)
        {
            maxListings = sub.SubscriptionPlan.MaxActiveListings;
            planName = sub.SubscriptionPlan.Name;
        }
        else
        {
            var freePlan = await _dbContext.SubscriptionPlans
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Name == "Free", ct);

            maxListings = freePlan?.MaxActiveListings ?? 10;
            planName = "Free";
        }

        var currentActiveCount = await _dbContext.Products
            .CountAsync(p => p.SellerUserId == sellerUserId && p.Status == ProductStatus.Published, ct);

        return new SellerQuotaDto(
            planName,
            maxListings,
            currentActiveCount,
            currentActiveCount < maxListings);
    }

    public async Task<SellerSubscriptionDto> AssignSubscriptionAsync(
        Guid sellerUserId,
        Guid adminUserId,
        AssignSubscriptionRequest request,
        string correlationId,
        CancellationToken ct = default)
    {
        if (request.DurationMonths <= 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["DurationMonths"] = new[] { "Duration must be at least 1 month." }
            });
        }

        var plan = await _dbContext.SubscriptionPlans
            .FirstOrDefaultAsync(p => p.Id == request.SubscriptionPlanId && p.IsActive, ct);

        if (plan == null)
        {
            throw new NotFoundException($"Subscription plan with ID '{request.SubscriptionPlanId}' was not found or is inactive.");
        }

        var store = await _dbContext.SellerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.SellerUserId == sellerUserId, ct);

        var now = DateTime.UtcNow;
        var expiresAt = now.AddMonths(request.DurationMonths);

        var subscription = new SellerSubscription(
            sellerUserId,
            plan.Id,
            now,
            expiresAt,
            adminUserId);

        _dbContext.SellerSubscriptions.Add(subscription);

        var audit = AuditEvent.Create(
            action: "SellerSubscriptionAssigned",
            targetType: "SellerSubscription",
            targetId: subscription.Id.ToString(),
            correlationId: correlationId,
            actorUserId: adminUserId,
            reason: $"Admin assigned plan '{plan.Name}' for {request.DurationMonths} month(s) to seller {sellerUserId}");

        _dbContext.AuditEvents.Add(audit);
        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation("Assigned {Plan} subscription to seller {SellerId} until {ExpiresAt}", plan.Name, sellerUserId, expiresAt);

        return ToDto(subscription, store?.StoreName);
    }

    public async Task<SellerSubscriptionDto> SubmitSubscriptionPaymentAsync(
        Guid sellerUserId,
        SubmitSubscriptionPaymentRequest request,
        string correlationId,
        CancellationToken ct = default)
    {
        var store = await _dbContext.SellerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.SellerUserId == sellerUserId, ct);

        if (store == null)
        {
            throw new ForbiddenException("STORE_NOT_FOUND", "Only approved sellers with a store profile can subscribe to plans.");
        }

        var plan = await _dbContext.SubscriptionPlans
            .FirstOrDefaultAsync(p => p.Id == request.SubscriptionPlanId && p.IsActive, ct);

        if (plan == null)
        {
            throw new NotFoundException($"Subscription plan with ID '{request.SubscriptionPlanId}' was not found or is inactive.");
        }

        var now = DateTime.UtcNow;

        // If selecting the Free tier, activate immediately
        if (plan.PriceAmount == 0)
        {
            var freeSub = SellerSubscription.CreateFree(sellerUserId, plan.Id, now);
            _dbContext.SellerSubscriptions.Add(freeSub);

            var freeAudit = AuditEvent.Create(
                action: "SellerSubscriptionFreeSelected",
                targetType: "SellerSubscription",
                targetId: freeSub.Id.ToString(),
                correlationId: correlationId,
                actorUserId: sellerUserId,
                reason: $"Seller selected Free tier ({plan.MaxActiveListings} listings)");

            _dbContext.AuditEvents.Add(freeAudit);
            await _dbContext.SaveChangesAsync(ct);

            _logger.LogInformation("Seller {SellerId} activated Free subscription tier", sellerUserId);
            return ToDto(freeSub, store.StoreName);
        }

        // Paid Plan Validation (Standard / Premium)
        if (request.DurationMonths <= 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["DurationMonths"] = new[] { "Duration must be at least 1 month." }
            });
        }

        var method = request.PaymentMethod?.Trim();
        if (method != "KBZPay" && method != "WavePay")
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["PaymentMethod"] = new[] { "Payment method must be either 'KBZPay' or 'WavePay'." }
            });
        }

        var reference = request.TransactionReference?.Trim();
        if (string.IsNullOrWhiteSpace(reference) || reference.Length < 6 || reference.Length > 100)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["TransactionReference"] = new[] { "A valid transaction reference number (6-100 characters) is required." }
            });
        }

        // Duplicate-reference protection across active and pending verification records
        var duplicateExists = await _dbContext.SellerSubscriptions
            .AnyAsync(s => s.TransactionReference == reference && s.Status != SubscriptionStatus.Rejected, ct);

        if (duplicateExists)
        {
            throw new ConflictException($"The transaction reference '{reference}' has already been submitted for another subscription.");
        }

        // Concurrency guard: Only one pending payment review per seller at a time
        var hasPending = await _dbContext.SellerSubscriptions
            .AnyAsync(s => s.SellerUserId == sellerUserId && s.Status == SubscriptionStatus.PendingVerification, ct);

        if (hasPending)
        {
            throw new ConflictException("You already have a subscription payment pending verification. Please wait for the current review to complete.");
        }

        var totalAmount = plan.PriceAmount * request.DurationMonths;

        var pendingSub = SellerSubscription.CreatePendingPayment(
            sellerUserId,
            plan.Id,
            method,
            reference,
            totalAmount,
            now,
            currencyCode: plan.CurrencyCode);

        _dbContext.SellerSubscriptions.Add(pendingSub);

        var audit = AuditEvent.Create(
            action: "SellerSubscriptionPaymentSubmitted",
            targetType: "SellerSubscription",
            targetId: pendingSub.Id.ToString(),
            correlationId: correlationId,
            actorUserId: sellerUserId,
            reason: $"Submitted {method} payment for plan '{plan.Name}' ({request.DurationMonths} month(s), {totalAmount} {plan.CurrencyCode}) with reference '{reference}'");

        _dbContext.AuditEvents.Add(audit);
        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation("Seller {SellerId} submitted {Method} payment for plan {Plan} with ref {Ref}", sellerUserId, method, plan.Name, reference);

        return ToDto(pendingSub, store.StoreName);
    }

    public async Task<IReadOnlyList<SellerSubscriptionDto>> GetSubscriptionsForAdminAsync(
        string? statusFilter = null,
        CancellationToken ct = default)
    {
        var query = _dbContext.SellerSubscriptions
            .Include(s => s.SubscriptionPlan)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(statusFilter) && Enum.TryParse<SubscriptionStatus>(statusFilter, true, out var status))
        {
            query = query.Where(s => s.Status == status);
        }

        var list = await query
            .OrderBy(s => s.Status == SubscriptionStatus.PendingVerification ? 0 : 1)
            .ThenByDescending(s => s.PaymentSubmittedAtUtc ?? s.CreatedAtUtc)
            .ToListAsync(ct);

        var sellerUserIds = list.Select(s => s.SellerUserId).Distinct().ToList();
        var storeNames = await _dbContext.SellerProfiles
            .Where(p => sellerUserIds.Contains(p.SellerUserId))
            .ToDictionaryAsync(p => p.SellerUserId, p => p.StoreName, ct);

        return list.Select(s =>
        {
            storeNames.TryGetValue(s.SellerUserId, out var storeName);
            return ToDto(s, storeName);
        }).ToList();
    }

    public async Task<SellerSubscriptionDto> VerifySubscriptionPaymentAsync(
        Guid subscriptionId,
        Guid adminUserId,
        VerifySubscriptionPaymentRequest request,
        string correlationId,
        CancellationToken ct = default)
    {
        var sub = await _dbContext.SellerSubscriptions
            .Include(s => s.SubscriptionPlan)
            .FirstOrDefaultAsync(s => s.Id == subscriptionId, ct);

        if (sub == null)
        {
            throw new NotFoundException($"Subscription with ID '{subscriptionId}' was not found.");
        }

        var store = await _dbContext.SellerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.SellerUserId == sub.SellerUserId, ct);

        var now = DateTime.UtcNow;

        if (string.Equals(request.Decision, "Approved", StringComparison.OrdinalIgnoreCase))
        {
            var durationMonths = request.DurationMonths > 0 ? request.DurationMonths : 1;
            sub.ApprovePayment(adminUserId, durationMonths, now);

            var audit = AuditEvent.Create(
                action: "SellerSubscriptionPaymentApproved",
                targetType: "SellerSubscription",
                targetId: sub.Id.ToString(),
                correlationId: correlationId,
                actorUserId: adminUserId,
                reason: $"Admin approved payment for plan '{sub.SubscriptionPlan?.Name}' (Ref: {sub.TransactionReference}, Duration: {durationMonths} month(s))");

            _dbContext.AuditEvents.Add(audit);
            _logger.LogInformation("Admin {AdminId} approved subscription {SubId} for seller {SellerId}", adminUserId, sub.Id, sub.SellerUserId);
        }
        else if (string.Equals(request.Decision, "Rejected", StringComparison.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(request.Reason))
            {
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    ["Reason"] = new[] { "A reason is required when rejecting a subscription payment." }
                });
            }

            sub.RejectPayment(adminUserId, request.Reason, now);

            var audit = AuditEvent.Create(
                action: "SellerSubscriptionPaymentRejected",
                targetType: "SellerSubscription",
                targetId: sub.Id.ToString(),
                correlationId: correlationId,
                actorUserId: adminUserId,
                reason: $"Admin rejected payment (Ref: {sub.TransactionReference}). Reason: {request.Reason}");

            _dbContext.AuditEvents.Add(audit);
            _logger.LogInformation("Admin {AdminId} rejected subscription {SubId} for seller {SellerId}", adminUserId, sub.Id, sub.SellerUserId);
        }
        else
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Decision"] = new[] { "Decision must be either 'Approved' or 'Rejected'." }
            });
        }

        await _dbContext.SaveChangesAsync(ct);
        return ToDto(sub, store?.StoreName);
    }

    public Task<IReadOnlyList<PlatformPaymentMethodDto>> GetPlatformPaymentMethodsAsync(CancellationToken ct = default)
    {
        var kbzAccount = _configuration["PlatformPayments:KBZPay:AccountName"] ?? "TrustedMarketplace Operations";
        var kbzPhone = _configuration["PlatformPayments:KBZPay:AccountPhone"] ?? "09798881234";
        var kbzQr = _configuration["PlatformPayments:KBZPay:QrCodeUrl"] ?? "/images/payments/kbzpay-platform-qr.svg";

        var waveAccount = _configuration["PlatformPayments:WavePay:AccountName"] ?? "TrustedMarketplace Operations";
        var wavePhone = _configuration["PlatformPayments:WavePay:AccountPhone"] ?? "09977889900";
        var waveQr = _configuration["PlatformPayments:WavePay:QrCodeUrl"] ?? "/images/payments/wavepay-platform-qr.svg";

        var methods = new List<PlatformPaymentMethodDto>
        {
            new(
                "KBZPay",
                kbzAccount,
                kbzPhone,
                "Scan the platform KBZPay QR code in your KBZPay app, transfer the exact subscription amount, and copy the transaction reference number.",
                kbzQr),
            new(
                "WavePay",
                waveAccount,
                wavePhone,
                "Transfer to the platform WavePay account number or scan the QR code, then submit your transaction reference number.",
                waveQr)
        };

        return Task.FromResult<IReadOnlyList<PlatformPaymentMethodDto>>(methods);
    }

    private static SellerSubscriptionDto ToDto(SellerSubscription s, string? storeName = null) =>
        new(
            s.Id,
            s.SellerUserId,
            s.SubscriptionPlan?.Name ?? "Unknown",
            s.SubscriptionPlan?.MaxActiveListings ?? 0,
            s.Status.ToString(),
            s.StartsAtUtc,
            s.ExpiresAtUtc,
            s.PaymentMethod,
            s.TransactionReference,
            s.PaymentAmount,
            s.PaymentCurrency,
            s.PaymentSubmittedAtUtc,
            s.RejectionReason,
            storeName);
}
