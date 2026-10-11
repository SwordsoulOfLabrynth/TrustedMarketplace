namespace TrustedMarketplace.Api.Authorization;

/// <summary>
/// Constants for authorization policy names.
/// </summary>
public static class AuthorizationPolicies
{
    /// <summary>
    /// Requires that the authenticated user's account is in 'Active' standing (rejects Suspended or Closed accounts).
    /// </summary>
    public const string RequireActiveUser = "RequireActiveUser";

    /// <summary>
    /// Requires that the caller has the Admin role and is in 'Active' standing.
    /// </summary>
    public const string RequireAdmin = "RequireAdmin";
}
