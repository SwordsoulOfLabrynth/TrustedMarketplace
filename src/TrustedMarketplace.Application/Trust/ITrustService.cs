using TrustedMarketplace.Application.Trust.Dtos;

namespace TrustedMarketplace.Application.Trust;

public interface ITrustService
{
    Task<SellerTrustProfileDto> GetSellerTrustProfileAsync(Guid sellerId, CancellationToken ct = default);
}
