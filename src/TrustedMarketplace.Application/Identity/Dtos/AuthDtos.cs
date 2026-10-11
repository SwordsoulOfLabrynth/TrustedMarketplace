namespace TrustedMarketplace.Application.Identity.Dtos;

public record RegisterRequest(string DisplayName, string Email, string Password);

public record RegisterResponse(Guid Id, string DisplayName, string Email, string Role, string AccountStatus);

public record LoginRequest(string Email, string Password);

public record UserDto(Guid Id, string DisplayName, string Email, string Role, string AccountStatus);

public record AuthResponse(string AccessToken, int ExpiresInSeconds, UserDto User);

public record TokenResult(string AccessToken, int ExpiresInSeconds, string RefreshToken, DateTime RefreshTokenExpiresAtUtc);
