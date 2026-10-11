namespace TrustedMarketplace.Domain.Identity;

/// <summary>
/// Canonical role names in the trusted marketplace.
/// Every registered user starts as a Buyer. Administrative users are assigned Admin.
/// </summary>
public static class RoleConstants
{
    public const string Buyer = "Buyer";
    public const string Admin = "Admin";
}
