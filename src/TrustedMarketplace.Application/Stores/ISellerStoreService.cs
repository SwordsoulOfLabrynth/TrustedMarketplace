using TrustedMarketplace.Application.Stores.Dtos;

namespace TrustedMarketplace.Application.Stores;

public interface ISellerStoreService
{
    Task<StoreProfileDto?> GetStoreBySellerIdAsync(Guid sellerUserId, CancellationToken ct = default);
    Task<StoreProfileDto> GetMyStoreAsync(Guid sellerUserId, CancellationToken ct = default);
    Task<StoreProfileDto> UpdateMyStoreAsync(Guid sellerUserId, UpdateStoreProfileRequest request, string correlationId, CancellationToken ct = default);
}
