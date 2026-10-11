using Microsoft.AspNetCore.Identity;
using TrustedMarketplace.Domain.Identity;

namespace TrustedMarketplace.Infrastructure.Identity;

/// <summary>
/// Infrastructure Identity role entity, extending ASP.NET Core Identity.
/// </summary>
public class ApplicationRole : IdentityRole<Guid>
{
    public const string Buyer = RoleConstants.Buyer;
    public const string Admin = RoleConstants.Admin;

    public ApplicationRole()
    {
        Id = Guid.NewGuid();
        ConcurrencyStamp = Guid.NewGuid().ToString();
    }

    public ApplicationRole(string roleName) : base(roleName)
    {
        Id = Guid.NewGuid();
        ConcurrencyStamp = Guid.NewGuid().ToString();
    }
}
