using Microsoft.AspNetCore.Identity;
using TrustedMarketplace.Domain.Common;
using TrustedMarketplace.Domain.Identity;

namespace TrustedMarketplace.Infrastructure.Identity;

/// <summary>
/// Infrastructure Identity user entity, extending ASP.NET Core Identity.
/// Strictly decouples account credentials and status from seller applications and store profiles.
/// </summary>
public class ApplicationUser : IdentityUser<Guid>, IAuditableEntity
{
    public string DisplayName { get; set; } = string.Empty;
    public AccountStatus AccountStatus { get; set; } = AccountStatus.Active;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAtUtc { get; set; }

    public ApplicationUser()
    {
        Id = Guid.NewGuid();
        SecurityStamp = Guid.NewGuid().ToString();
    }

    public ApplicationUser(string email, string displayName) : this()
    {
        Email = email;
        UserName = email;
        DisplayName = displayName;
    }

    public void UpdateDisplayName(string displayName)
    {
        if (string.IsNullOrWhiteSpace(displayName))
        {
            throw new ArgumentException("Display name cannot be empty.", nameof(displayName));
        }

        var trimmed = displayName.Trim();
        if (trimmed.Length > 100)
        {
            throw new ArgumentException("Display name cannot exceed 100 characters.", nameof(displayName));
        }

        DisplayName = trimmed;
    }

    public void Suspend()
    {
        AccountStatus = AccountStatus.Suspended;
    }

    public void Reactivate()
    {
        AccountStatus = AccountStatus.Active;
    }

    public void Close()
    {
        AccountStatus = AccountStatus.Closed;
    }

    public void RecordLogin(DateTime loginTimeUtc)
    {
        LastLoginAtUtc = loginTimeUtc;
    }
}
