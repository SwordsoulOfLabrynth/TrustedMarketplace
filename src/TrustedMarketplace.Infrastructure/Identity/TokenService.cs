using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.Infrastructure.Identity;

public class TokenService : ITokenService
{
    private readonly AppDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TokenService> _logger;
    private readonly Microsoft.Extensions.Hosting.IHostEnvironment? _environment;

    public TokenService(
        AppDbContext dbContext,
        IConfiguration configuration,
        ILogger<TokenService> logger,
        Microsoft.Extensions.Hosting.IHostEnvironment? environment = null)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _logger = logger;
        _environment = environment;
    }

    public Task<string> GenerateAccessTokenAsync(ApplicationUser user, IList<string> roles)
    {
        var isDevelopment = _environment != null
            ? string.Equals(_environment.EnvironmentName, "Development", StringComparison.OrdinalIgnoreCase)
            : string.Equals(_configuration["ASPNETCORE_ENVIRONMENT"] ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase);

        var jwtKey = _configuration["Jwt:Key"];

        if (string.IsNullOrWhiteSpace(jwtKey))
        {
            if (isDevelopment)
            {
                jwtKey = DependencyInjection.DevelopmentFallbackSecret;
            }
            else
            {
                throw new InvalidOperationException(
                    "JWT signing key ('Jwt:Key') is missing or empty. A cryptographically secure key of at least 32 characters must be configured in non-development environments.");
            }
        }
        else if (jwtKey.Length < 32)
        {
            throw new InvalidOperationException(
                "JWT signing key ('Jwt:Key') must be at least 32 characters (256 bits).");
        }
        else if (!isDevelopment && string.Equals(jwtKey, DependencyInjection.DevelopmentFallbackSecret, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "JWT signing key ('Jwt:Key') is configured with the known development placeholder. A unique production secret must be provided.");
        }

        var issuer = _configuration["Jwt:Issuer"] ?? "TrustedMarketplace";
        var audience = _configuration["Jwt:Audience"] ?? "TrustedMarketplaceClient";
        var expirationMinutes = _configuration.GetValue<int>("Jwt:AccessTokenExpirationMinutes", 15);

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(ClaimTypes.Email, user.Email ?? string.Empty),
            new(ClaimTypes.Name, user.DisplayName),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        foreach (var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddMinutes(expirationMinutes),
            Issuer = issuer,
            Audience = audience,
            SigningCredentials = creds
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return Task.FromResult(tokenHandler.WriteToken(token));
    }

    public async Task<(string RawRefreshToken, DateTime ExpiresAtUtc)> CreateRefreshTokenAsync(
        Guid userId,
        Guid? tokenFamily = null,
        CancellationToken ct = default)
    {
        var expirationDays = _configuration.GetValue<int>("Jwt:RefreshTokenExpirationDays", 7);
        var expiresAtUtc = DateTime.UtcNow.AddDays(expirationDays);
        var rawToken = RefreshToken.GenerateSecureTokenString();

        var token = new RefreshToken(userId, rawToken, expiresAtUtc, tokenFamily);
        _dbContext.RefreshTokens.Add(token);
        await _dbContext.SaveChangesAsync(ct);

        return (rawToken, expiresAtUtc);
    }

    public async Task<(string NewRawRefreshToken, DateTime ExpiresAtUtc, Guid UserId)?> RotateRefreshTokenAsync(
        string rawRefreshToken,
        CancellationToken ct = default)
    {
        var tokenHash = RefreshToken.HashToken(rawRefreshToken);
        var token = await _dbContext.RefreshTokens
            .FirstOrDefaultAsync(r => r.TokenHash == tokenHash, ct);

        if (token == null)
        {
            _logger.LogWarning("Refresh token rotation failed: Token hash not found.");
            return null;
        }

        // Token Reuse Detection: If token is already revoked, an adversary may have captured the old token.
        // Invalidate the entire token family to neutralize potential session hijacking.
        if (token.IsRevoked)
        {
            _logger.LogWarning(
                "SECURITY ALERT: Revoked refresh token reuse detected for User {UserId}, Family {Family}. Revoking entire token family.",
                token.UserId,
                token.TokenFamily);

            var familyTokens = await _dbContext.RefreshTokens
                .Where(r => r.TokenFamily == token.TokenFamily && r.RevokedAtUtc == null)
                .ToListAsync(ct);

            foreach (var familyToken in familyTokens)
            {
                familyToken.Revoke("Compromised: Detected token reuse");
            }

            await _dbContext.SaveChangesAsync(ct);
            throw new UnauthorizedException("Invalid refresh token. Session revoked for security reasons.", "TOKEN_REUSE_DETECTED");
        }

        if (token.IsExpired)
        {
            _logger.LogInformation("Refresh token rotation rejected: Token is expired.");
            token.Revoke("Expired");
            await _dbContext.SaveChangesAsync(ct);
            return null;
        }

        // Active token: rotate cleanly
        var expirationDays = _configuration.GetValue<int>("Jwt:RefreshTokenExpirationDays", 7);
        var newExpiresAtUtc = DateTime.UtcNow.AddDays(expirationDays);
        var newRawToken = RefreshToken.GenerateSecureTokenString();

        token.Revoke("Rotated", newRawToken);

        var newToken = new RefreshToken(token.UserId, newRawToken, newExpiresAtUtc, token.TokenFamily);
        _dbContext.RefreshTokens.Add(newToken);
        await _dbContext.SaveChangesAsync(ct);

        return (newRawToken, newExpiresAtUtc, token.UserId);
    }

    public async Task RevokeRefreshTokenAsync(
        string rawRefreshToken,
        string reason,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(rawRefreshToken))
            return;

        var tokenHash = RefreshToken.HashToken(rawRefreshToken);
        var token = await _dbContext.RefreshTokens
            .FirstOrDefaultAsync(r => r.TokenHash == tokenHash && r.RevokedAtUtc == null, ct);

        if (token != null)
        {
            token.Revoke(reason);
            await _dbContext.SaveChangesAsync(ct);
        }
    }
}
