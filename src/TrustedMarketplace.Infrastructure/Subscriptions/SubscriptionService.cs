using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Subscriptions;
using TrustedMarketplace.Application.Subscriptions.Dtos;
using TrustedMarketplace.Domain.Auditing;
using TrustedMarketplace.Domain.Catalog;
using TrustedMarketplace.Domain.Subscriptions;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.Infrastructure.Subscriptions;

public class SubscriptionService : ISubscriptionService
{
    private readonly AppDbContext _dbContext;
    private readonly ILogger<SubscriptionService> _logger;

    public SubscriptionService(AppDbContext dbContext, ILogger<SubscriptionService> logger)
    {
        _dbContext = dbContext;
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
        var sub = await _dbContext.SellerSubscriptions
            .Include(s => s.SubscriptionPlan)
            .AsNoTracking()
            .Where(s => s.SellerUserId == sellerUserId && s.Status == SubscriptionStatus.Active && s.ExpiresAtUtc > now)
            .OrderByDescending(s => s.ExpiresAtUtc)
            .FirstOrDefaultAsync(ct);

        if (sub == null || sub.SubscriptionPlan == null)
            return null;

        return new SellerSubscriptionDto(
            sub.Id,
            sub.SellerUserId,
            sub.SubscriptionPlan.Name,
            sub.SubscriptionPlan.MaxActiveListings,
            sub.Status.ToString(),
            sub.StartsAtUtc,
            sub.ExpiresAtUtc);
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

        return new SellerSubscriptionDto(
            subscription.Id,
            sellerUserId,
            plan.Name,
            plan.MaxActiveListings,
            subscription.Status.ToString(),
            subscription.StartsAtUtc,
            subscription.ExpiresAtUtc);
    }
}
