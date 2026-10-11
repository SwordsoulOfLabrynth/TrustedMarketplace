using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using TrustedMarketplace.Domain.Identity;
using TrustedMarketplace.Infrastructure.Identity;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.IntegrationTests;

public class IdentityPersistenceTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public IdentityPersistenceTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task IdentityTables_HaveBeenMigrated_AndCanBeQueried()
    {
        // Arrange
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Act & Assert - Ensure tables exist in PostgreSQL
        var userCount = await dbContext.Users.CountAsync();
        var roleCount = await dbContext.Roles.CountAsync();

        Assert.True(userCount >= 0);
        Assert.True(roleCount >= 0);
    }

    [Fact]
    public async Task UserManager_CanCreateAndRetrieve_ApplicationUser_WithCustomProperties()
    {
        // Arrange
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var uniqueEmail = $"buyer_{Guid.NewGuid():N}@example.com";
        const string displayName = "Myanmar Pilot Buyer";

        var user = new ApplicationUser(uniqueEmail, displayName);

        // Act - Create user with password meeting policy requirements
        var createResult = await userManager.CreateAsync(user, "P@ssword123!");

        // Assert
        Assert.True(createResult.Succeeded, string.Join(", ", createResult.Errors.Select(e => e.Description)));

        var retrieved = await userManager.FindByEmailAsync(uniqueEmail);
        Assert.NotNull(retrieved);
        Assert.Equal(displayName, retrieved.DisplayName);
        Assert.Equal(AccountStatus.Active, retrieved.AccountStatus);
        Assert.Equal(uniqueEmail, retrieved.Email);
        Assert.True(retrieved.CreatedAtUtc <= DateTime.UtcNow);
        Assert.True(retrieved.UpdatedAtUtc <= DateTime.UtcNow);
    }

    [Fact]
    public async Task RoleManager_CanCreateRoles_AndUserManager_CanAssignRole()
    {
        // Arrange
        using var scope = _factory.Services.CreateScope();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        // Ensure Buyer role exists
        if (!await roleManager.RoleExistsAsync(ApplicationRole.Buyer))
        {
            var roleResult = await roleManager.CreateAsync(new ApplicationRole(ApplicationRole.Buyer));
            Assert.True(roleResult.Succeeded);
        }

        var uniqueEmail = $"buyer_role_{Guid.NewGuid():N}@example.com";
        var user = new ApplicationUser(uniqueEmail, "Role Test User");
        var userResult = await userManager.CreateAsync(user, "P@ssword123!");
        Assert.True(userResult.Succeeded);

        // Act
        var addRoleResult = await userManager.AddToRoleAsync(user, ApplicationRole.Buyer);

        // Assert
        Assert.True(addRoleResult.Succeeded);
        var isInRole = await userManager.IsInRoleAsync(user, ApplicationRole.Buyer);
        Assert.True(isInRole);
    }

    [Fact]
    public async Task AccountStatus_SuspensionAndReactivation_PersistsInDatabase()
    {
        // Arrange
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var uniqueEmail = $"status_test_{Guid.NewGuid():N}@example.com";

        var user = new ApplicationUser(uniqueEmail, "Suspension Test");
        var createResult = await userManager.CreateAsync(user, "P@ssword123!");
        Assert.True(createResult.Succeeded);

        // Act - Suspend
        user.Suspend();
        var updateResult1 = await userManager.UpdateAsync(user);
        Assert.True(updateResult1.Succeeded);

        // Assert Suspended
        var suspendedUser = await userManager.FindByEmailAsync(uniqueEmail);
        Assert.NotNull(suspendedUser);
        Assert.Equal(AccountStatus.Suspended, suspendedUser.AccountStatus);

        // Act - Reactivate
        suspendedUser.Reactivate();
        var updateResult2 = await userManager.UpdateAsync(suspendedUser);
        Assert.True(updateResult2.Succeeded);

        // Assert Active
        var reactivatedUser = await userManager.FindByEmailAsync(uniqueEmail);
        Assert.NotNull(reactivatedUser);
        Assert.Equal(AccountStatus.Active, reactivatedUser.AccountStatus);
    }

    [Fact]
    public async Task PasswordPolicy_EnforcesMinimumComplexity()
    {
        // Arrange
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = new ApplicationUser($"weak_{Guid.NewGuid():N}@example.com", "Weak User");

        // Act - Try password under 8 characters
        var result = await userManager.CreateAsync(user, "weak");

        // Assert
        Assert.False(result.Succeeded);
        Assert.Contains(result.Errors, e => e.Code == "PasswordTooShort");
    }

    [Fact]
    public void EmailConfirmation_InDevelopmentEnvironment_IsConfiguredAsFalse_ForStudentDemo()
    {
        // Arrange & Act
        using var scope = _factory.Services.CreateScope();
        var identityOptions = scope.ServiceProvider.GetRequiredService<IOptions<IdentityOptions>>();

        // Assert - in default development test environment, RequireConfirmedEmail is false for demo
        Assert.False(identityOptions.Value.SignIn.RequireConfirmedEmail);
    }

    [Fact]
    public void EmailConfirmation_InProductionEnvironment_DefaultsToTrue()
    {
        // Arrange & Act
        var prodFactory = _factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.UseSetting("Jwt:Key", "A_VALID_TEST_PRODUCTION_KEY_OF_AT_LEAST_32_CHARS!");
        });

        using var scope = prodFactory.Services.CreateScope();
        var identityOptions = scope.ServiceProvider.GetRequiredService<IOptions<IdentityOptions>>();

        // Assert - in Production environment, RequireConfirmedEmail is strictly true
        Assert.True(identityOptions.Value.SignIn.RequireConfirmedEmail);
    }

    [Fact]
    public void InProductionEnvironment_WithDefaultPlaceholderJwtKey_ThrowsOnStartup()
    {
        // Arrange
        var prodFactory = _factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            // Do not override Jwt:Key, so it uses appsettings.json placeholder
        });

        // Act & Assert
        Assert.Throws<InvalidOperationException>(() =>
        {
            _ = prodFactory.Services;
        });
    }
}
