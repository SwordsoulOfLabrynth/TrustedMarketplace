using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Stores;
using TrustedMarketplace.Application.Stores.Dtos;
using TrustedMarketplace.Domain.Auditing;
using TrustedMarketplace.Domain.Stores;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.Infrastructure.Stores;

public class SellerStoreService : ISellerStoreService
{
    private readonly AppDbContext _dbContext;
    private readonly ILogger<SellerStoreService> _logger;

    public SellerStoreService(
        AppDbContext dbContext,
        ILogger<SellerStoreService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<StoreProfileDto?> GetStoreBySellerIdAsync(Guid sellerUserId, CancellationToken ct = default)
    {
        var store = await _dbContext.SellerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.SellerUserId == sellerUserId, ct);

        return store == null ? null : ToDto(store);
    }

    public async Task<StoreProfileDto> GetMyStoreAsync(Guid sellerUserId, CancellationToken ct = default)
    {
        var store = await _dbContext.SellerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.SellerUserId == sellerUserId, ct);

        if (store == null)
        {
            throw new NotFoundException("No store profile found for this seller account. An approved seller application is required.");
        }

        return ToDto(store);
    }

    public async Task<StoreProfileDto> UpdateMyStoreAsync(
        Guid sellerUserId,
        UpdateStoreProfileRequest request,
        string correlationId,
        CancellationToken ct = default)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.StoreName) || request.StoreName.Trim().Length > 100)
        {
            errors["StoreName"] = new[] { "Store name must be between 1 and 100 characters." };
        }

        if (string.IsNullOrWhiteSpace(request.ContactPhone) || request.ContactPhone.Trim().Length > 30)
        {
            errors["ContactPhone"] = new[] { "Contact phone must be between 1 and 30 characters." };
        }

        if (request.Bio != null && request.Bio.Length > 500)
        {
            errors["Bio"] = new[] { "Bio cannot exceed 500 characters." };
        }

        if (request.CityOrTownship != null && request.CityOrTownship.Length > 100)
        {
            errors["CityOrTownship"] = new[] { "City or township cannot exceed 100 characters." };
        }

        if (errors.Count > 0)
        {
            throw new ValidationException(errors);
        }

        var store = await _dbContext.SellerProfiles
            .FirstOrDefaultAsync(s => s.SellerUserId == sellerUserId, ct);

        if (store == null)
        {
            throw new NotFoundException("No store profile found for this seller account.");
        }

        var trimmedName = request.StoreName.Trim();
        if (!string.Equals(store.StoreName, trimmedName, StringComparison.OrdinalIgnoreCase))
        {
            var conflict = await _dbContext.SellerProfiles
                .AnyAsync(s => s.StoreName.ToLower() == trimmedName.ToLower() && s.Id != store.Id, ct);

            if (conflict)
            {
                throw new ConflictException($"A store with the name '{trimmedName}' already exists.");
            }
        }

        var storeNameChanged = store.UpdateProfile(
            request.StoreName,
            request.Bio,
            request.ContactPhone,
            request.CityOrTownship);

        if (storeNameChanged)
        {
            var audit = AuditEvent.Create(
                action: "SellerStoreNameChanged_PendingReverification",
                targetType: "SellerProfile",
                targetId: store.Id.ToString(),
                correlationId: correlationId,
                actorUserId: sellerUserId,
                reason: $"Store name changed to '{trimmedName}'. Automatic reverification triggered.");

            _dbContext.AuditEvents.Add(audit);
            _logger.LogInformation("Store name changed for seller {SellerId}. VerificationStatus set to PendingReverification", sellerUserId);
        }

        await _dbContext.SaveChangesAsync(ct);

        return ToDto(store);
    }

    private static StoreProfileDto ToDto(SellerProfile s) =>
        new(
            s.SellerUserId,
            s.StoreName,
            s.Slug,
            s.Bio,
            s.ContactPhone,
            s.CityOrTownship,
            s.LogoStorageKey,
            s.VerificationStatus.ToString(),
            s.CreatedAtUtc);
}
