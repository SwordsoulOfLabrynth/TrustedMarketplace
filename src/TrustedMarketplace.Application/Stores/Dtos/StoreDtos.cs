namespace TrustedMarketplace.Application.Stores.Dtos;

public record StoreProfileDto(
    Guid SellerUserId,
    string StoreName,
    string Slug,
    string? Bio,
    string ContactPhone,
    string? CityOrTownship,
    string? LogoStorageKey,
    string VerificationStatus,
    DateTime CreatedAtUtc
);

public record UpdateStoreProfileRequest(
    string StoreName,
    string? Bio,
    string ContactPhone,
    string? CityOrTownship
);
