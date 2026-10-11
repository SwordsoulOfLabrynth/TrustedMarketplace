using Microsoft.AspNetCore.Authorization;

namespace TrustedMarketplace.Api.Authorization.Requirements;

/// <summary>
/// Defines an entity or resource that has an identifiable user owner.
/// </summary>
public interface IResourceOwner
{
    Guid OwnerUserId { get; }
}

/// <summary>
/// Authorization requirement enforcing that the calling user owns the specified resource.
/// </summary>
public class ResourceOwnerRequirement : IAuthorizationRequirement
{
}
