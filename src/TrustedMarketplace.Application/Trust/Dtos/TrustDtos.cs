namespace TrustedMarketplace.Application.Trust.Dtos;

public record SellerTrustProfileDto(
    Guid SellerUserId,
    string VerificationStatus,
    DateTime? VerifiedSinceUtc,
    int CompletedOrdersCount,
    int ReviewCount,
    double AverageRating,
    int ResolvedComplaintsCount,
    string Disclaimer
);
