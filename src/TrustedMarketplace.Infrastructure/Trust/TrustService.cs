using Microsoft.EntityFrameworkCore;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Trust;
using TrustedMarketplace.Application.Trust.Dtos;
using TrustedMarketplace.Domain.Complaints;
using TrustedMarketplace.Domain.Orders;
using TrustedMarketplace.Domain.Reviews;
using TrustedMarketplace.Domain.Verification;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.Infrastructure.Trust;

public class TrustService : ITrustService
{
    private const string StandardDisclaimer =
        "Verification confirms identity documentation at approval; it is not a guarantee of transaction safety or product quality.";

    private readonly AppDbContext _dbContext;

    public TrustService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<SellerTrustProfileDto> GetSellerTrustProfileAsync(Guid sellerId, CancellationToken ct = default)
    {
        // Allow sellerId to be either SellerUserId or SellerProfile.Id
        var profile = await _dbContext.SellerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.SellerUserId == sellerId || p.Id == sellerId, ct);

        if (profile == null)
        {
            throw new NotFoundException($"Seller profile with ID or User ID '{sellerId}' was not found.");
        }

        var sellerUserId = profile.SellerUserId;

        // Fetch verified date from latest approved application
        var latestApprovedApp = await _dbContext.SellerApplications
            .AsNoTracking()
            .Where(a => a.UserId == sellerUserId && a.Status == ApplicationStatus.Approved)
            .OrderByDescending(a => a.ReviewedAtUtc)
            .FirstOrDefaultAsync(ct);

        var verifiedSinceUtc = latestApprovedApp?.ReviewedAtUtc ?? profile.CreatedAtUtc;

        var completedOrdersCount = await _dbContext.Orders
            .CountAsync(o => o.SellerUserId == sellerUserId && o.Status == OrderStatus.Completed, ct);

        var reviewQuery = _dbContext.Reviews
            .AsNoTracking()
            .Where(r => r.SellerUserId == sellerUserId && r.ModerationStatus == ModerationStatus.Published);

        var reviewCount = await reviewQuery.CountAsync(ct);

        var averageRating = reviewCount > 0
            ? Math.Round(await reviewQuery.AverageAsync(r => (double)r.Rating, ct), 1)
            : 0.0;

        var resolvedComplaintsCount = await _dbContext.Complaints
            .CountAsync(c => c.SellerUserId == sellerUserId && c.Status == ComplaintStatus.Resolved, ct);

        return new SellerTrustProfileDto(
            sellerUserId,
            profile.VerificationStatus.ToString(),
            verifiedSinceUtc,
            completedOrdersCount,
            reviewCount,
            averageRating,
            resolvedComplaintsCount,
            StandardDisclaimer
        );
    }
}
