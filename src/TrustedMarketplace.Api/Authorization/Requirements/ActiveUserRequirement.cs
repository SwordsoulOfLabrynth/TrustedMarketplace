using Microsoft.AspNetCore.Authorization;

namespace TrustedMarketplace.Api.Authorization.Requirements;

/// <summary>
/// Requirement that checks live user status in the database to ensure
/// suspended or closed accounts cannot execute actions, even with a valid JWT.
/// </summary>
public class ActiveUserRequirement : IAuthorizationRequirement
{
}
