using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using TrustedMarketplace.Api.Authorization.Handlers;
using TrustedMarketplace.Api.Authorization.Requirements;
using TrustedMarketplace.Domain.Identity;

namespace TrustedMarketplace.UnitTests.Authorization;

public class ResourceOwnerAuthorizationHandlerTests
{
    private class TestResource : IResourceOwner
    {
        public Guid OwnerUserId { get; }

        public TestResource(Guid ownerUserId)
        {
            OwnerUserId = ownerUserId;
        }
    }

    [Fact]
    public async Task ResourceOwner_WithMatchingUserId_Succeeds()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString())
        }, "TestAuth"));

        var requirement = new ResourceOwnerRequirement();
        var resource = new TestResource(userId);
        var context = new AuthorizationHandlerContext(new[] { requirement }, user, resource);

        var handler = new ResourceOwnerAuthorizationHandler();

        // Act
        await handler.HandleAsync(context);

        // Assert
        Assert.True(context.HasSucceeded);
    }

    [Fact]
    public async Task ResourceOwner_WithDifferentUserId_DoesNotSucceed()
    {
        // Arrange
        var callerUserId = Guid.NewGuid();
        var resourceOwnerId = Guid.NewGuid();

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, callerUserId.ToString())
        }, "TestAuth"));

        var requirement = new ResourceOwnerRequirement();
        var resource = new TestResource(resourceOwnerId);
        var context = new AuthorizationHandlerContext(new[] { requirement }, user, resource);

        var handler = new ResourceOwnerAuthorizationHandler();

        // Act
        await handler.HandleAsync(context);

        // Assert
        Assert.False(context.HasSucceeded);
    }

    [Fact]
    public async Task ResourceOwner_WithAdminRole_Succeeds_EvenIfDifferentUser()
    {
        // Arrange
        var adminUserId = Guid.NewGuid();
        var resourceOwnerId = Guid.NewGuid();

        var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, adminUserId.ToString()),
            new Claim(ClaimTypes.Role, RoleConstants.Admin)
        }, "TestAuth"));

        var requirement = new ResourceOwnerRequirement();
        var resource = new TestResource(resourceOwnerId);
        var context = new AuthorizationHandlerContext(new[] { requirement }, user, resource);

        var handler = new ResourceOwnerAuthorizationHandler();

        // Act
        await handler.HandleAsync(context);

        // Assert
        Assert.True(context.HasSucceeded);
    }

    [Fact]
    public async Task ResourceOwner_Unauthenticated_DoesNotSucceed()
    {
        // Arrange
        var user = new ClaimsPrincipal(new ClaimsIdentity()); // not authenticated
        var requirement = new ResourceOwnerRequirement();
        var resource = new TestResource(Guid.NewGuid());
        var context = new AuthorizationHandlerContext(new[] { requirement }, user, resource);

        var handler = new ResourceOwnerAuthorizationHandler();

        // Act
        await handler.HandleAsync(context);

        // Assert
        Assert.False(context.HasSucceeded);
    }
}
