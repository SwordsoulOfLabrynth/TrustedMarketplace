using TrustedMarketplace.Infrastructure.Identity;

namespace TrustedMarketplace.Infrastructure.Identity;

public interface ITokenService
{
    Task<string> GenerateAccessTokenAsync(ApplicationUser user, IList<string> roles);
    Task<(string RawRefreshToken, DateTime ExpiresAtUtc)> CreateRefreshTokenAsync(Guid userId, Guid? tokenFamily = null, CancellationToken ct = default);
    Task<(string NewRawRefreshToken, DateTime ExpiresAtUtc, Guid UserId)?> RotateRefreshTokenAsync(string rawRefreshToken, CancellationToken ct = default);
    Task RevokeRefreshTokenAsync(string rawRefreshToken, string reason, CancellationToken ct = default);
}
