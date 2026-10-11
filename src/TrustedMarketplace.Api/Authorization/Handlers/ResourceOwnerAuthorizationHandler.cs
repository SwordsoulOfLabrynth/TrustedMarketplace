using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using TrustedMarketplace.Api.Authorization.Requirements;
using TrustedMarketplace.Domain.Identity;

namespace TrustedMarketplace.Api.Authorization.Handlers;

/// <summary>
/// Enforces resource ownership rules (AR-04): callers may only access or mutate resources they own.
/// </summary>
public class ResourceOwnerAuthorizationHandler : AuthorizationHandler<ResourceOwnerRequirement, IResourceOwner>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ResourceOwnerRequirement requirement,
        IResourceOwner resource)
    {
        if (context.User?.Identity?.IsAuthenticated != true)
        {
            return Task.CompletedTask;
        }

        // Platform Administrators have cross-tenant oversight for disputes and audits
        if (context.User.IsInRole(RoleConstants.Admin))
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        var userIdStr = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? context.User.FindFirstValue("sub");

        if (Guid.TryParse(userIdStr, out var userId) && userId == resource.OwnerUserId)
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
