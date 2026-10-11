using System.Security.Cryptography;
using System.Text;
using TrustedMarketplace.Domain.Common;

namespace TrustedMarketplace.Infrastructure.Identity;

/// <summary>
/// Server-side tracked refresh token stored exclusively in hashed format (SHA-256).
/// Supports token rotation, explicit revocation, and token reuse detection.
/// </summary>
public class RefreshToken : BaseEntity
{
    public Guid UserId { get; private set; }
    public string TokenHash { get; private set; } = string.Empty;
    public Guid TokenFamily { get; private set; }
    public DateTime ExpiresAtUtc { get; private set; }
    public DateTime? RevokedAtUtc { get; private set; }
    public string? ReplacedByTokenHash { get; private set; }
    public string? ReasonRevoked { get; private set; }

    public bool IsExpired => DateTime.UtcNow >= ExpiresAtUtc;
    public bool IsRevoked => RevokedAtUtc != null;
    public bool IsActive => !IsRevoked && !IsExpired;

    private RefreshToken() { } // EF Core

    public RefreshToken(Guid userId, string rawToken, DateTime expiresAtUtc, Guid? tokenFamily = null)
    {
        UserId = userId;
        TokenHash = HashToken(rawToken);
        TokenFamily = tokenFamily ?? Guid.NewGuid();
        ExpiresAtUtc = expiresAtUtc;
    }

    public void Revoke(string reason, string? replacedByRawToken = null)
    {
        RevokedAtUtc = DateTime.UtcNow;
        ReasonRevoked = reason;
        if (!string.IsNullOrWhiteSpace(replacedByRawToken))
        {
            ReplacedByTokenHash = HashToken(replacedByRawToken);
        }
    }

    public static string HashToken(string rawToken)
    {
        var bytes = Encoding.UTF8.GetBytes(rawToken);
        var hashBytes = SHA256.HashData(bytes);
        return Convert.ToHexStringLower(hashBytes);
    }

    public static string GenerateSecureTokenString()
    {
        var randomBytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }
}
