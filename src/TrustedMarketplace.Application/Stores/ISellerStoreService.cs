using TrustedMarketplace.Application.Stores.Dtos;
using TrustedMarketplace.Domain.Stores;

namespace TrustedMarketplace.Application.Stores;

public interface ISellerStoreService
{
    Task<StoreProfileDto?> GetStoreBySellerIdAsync(Guid sellerUserId, CancellationToken ct = default);
    Task<StoreProfileDto> GetMyStoreAsync(Guid sellerUserId, CancellationToken ct = default);
    Task<StoreProfileDto> UpdateMyStoreAsync(Guid sellerUserId, UpdateStoreProfileRequest request, string correlationId, CancellationToken ct = default);
    Task<IReadOnlyList<StoreProfileDto>> GetStoresForAdminAsync(SellerVerificationStatus? status = null, CancellationToken ct = default);
    Task<StoreProfileDto> ProcessStoreReverificationDecisionAsync(Guid id, Guid adminUserId, AdminStoreReverificationRequest request, string correlationId, CancellationToken ct = default);
}
