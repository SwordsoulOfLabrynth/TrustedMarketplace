using TrustedMarketplace.Application.Identity.Dtos;

namespace TrustedMarketplace.Application.Identity;

public interface IAuthService
{
    Task<RegisterResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default);
    Task<(AuthResponse Auth, string RefreshToken, DateTime RefreshTokenExpiresAtUtc)> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task<(AuthResponse Auth, string RefreshToken, DateTime RefreshTokenExpiresAtUtc)> RefreshAsync(string rawRefreshToken, CancellationToken ct = default);
    Task LogoutAsync(string? rawRefreshToken, CancellationToken ct = default);
    Task<UserDto> GetCurrentUserAsync(Guid userId, CancellationToken ct = default);
}
