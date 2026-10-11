using TrustedMarketplace.Domain.Identity;
using TrustedMarketplace.Infrastructure.Identity;

namespace TrustedMarketplace.UnitTests.Identity;

public class IdentityTests
{
    [Fact]
    public void RoleConstants_DefineCanonicalMarketplaceRoles()
    {
        // Assert pure domain role constants
        Assert.Equal("Buyer", RoleConstants.Buyer);
        Assert.Equal("Admin", RoleConstants.Admin);
    }

    [Fact]
    public void ApplicationUser_DefaultConstructor_InitializesCorrectDefaults()
    {
        // Act
        var user = new ApplicationUser();

        // Assert
        Assert.NotEqual(Guid.Empty, user.Id);
        Assert.False(string.IsNullOrWhiteSpace(user.SecurityStamp));
        Assert.Equal(AccountStatus.Active, user.AccountStatus);
        Assert.Null(user.LastLoginAtUtc);
        Assert.True(user.CreatedAtUtc <= DateTime.UtcNow);
        Assert.True(user.UpdatedAtUtc <= DateTime.UtcNow);
    }

    [Fact]
    public void ApplicationUser_ParameterizedConstructor_SetsPropertiesCorrectly()
    {
        // Arrange & Act
        var user = new ApplicationUser("buyer@example.com", "Mg Mg");

        // Assert
        Assert.Equal("buyer@example.com", user.Email);
        Assert.Equal("buyer@example.com", user.UserName);
        Assert.Equal("Mg Mg", user.DisplayName);
        Assert.Equal(AccountStatus.Active, user.AccountStatus);
    }

    [Fact]
    public void ApplicationUser_UpdateDisplayName_ValidInput_UpdatesSuccessfully()
    {
        // Arrange
        var user = new ApplicationUser("user@example.com", "Initial Name");

        // Act
        user.UpdateDisplayName("Updated Name");

        // Assert
        Assert.Equal("Updated Name", user.DisplayName);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ApplicationUser_UpdateDisplayName_NullOrWhitespace_ThrowsArgumentException(string? invalidName)
    {
        // Arrange
        var user = new ApplicationUser("user@example.com", "Initial Name");

        // Act & Assert
        Assert.Throws<ArgumentException>(() => user.UpdateDisplayName(invalidName!));
    }

    [Fact]
    public void ApplicationUser_UpdateDisplayName_Exceeds100Characters_ThrowsArgumentException()
    {
        // Arrange
        var user = new ApplicationUser("user@example.com", "Initial Name");
        var longName = new string('A', 101);

        // Act & Assert
        var ex = Assert.Throws<ArgumentException>(() => user.UpdateDisplayName(longName));
        Assert.Contains("cannot exceed 100 characters", ex.Message);
    }

    [Fact]
    public void ApplicationUser_StatusTransitions_WorkAsExpected()
    {
        // Arrange
        var user = new ApplicationUser("user@example.com", "Status Test");

        // Act & Assert - Suspend
        user.Suspend();
        Assert.Equal(AccountStatus.Suspended, user.AccountStatus);

        // Act & Assert - Reactivate
        user.Reactivate();
        Assert.Equal(AccountStatus.Active, user.AccountStatus);

        // Act & Assert - Close
        user.Close();
        Assert.Equal(AccountStatus.Closed, user.AccountStatus);
    }

    [Fact]
    public void ApplicationUser_RecordLogin_SetsLastLoginAtUtc()
    {
        // Arrange
        var user = new ApplicationUser("user@example.com", "Login Test");
        var loginTime = DateTime.UtcNow;

        // Act
        user.RecordLogin(loginTime);

        // Assert
        Assert.NotNull(user.LastLoginAtUtc);
        Assert.Equal(loginTime, user.LastLoginAtUtc);
    }

    [Fact]
    public void ApplicationRole_ConstantsAndConstructors_AreCorrect()
    {
        // Assert Role Constants match Domain.Identity.RoleConstants
        Assert.Equal(RoleConstants.Buyer, ApplicationRole.Buyer);
        Assert.Equal(RoleConstants.Admin, ApplicationRole.Admin);

        // Assert default constructor
        var role1 = new ApplicationRole();
        Assert.NotEqual(Guid.Empty, role1.Id);
        Assert.False(string.IsNullOrWhiteSpace(role1.ConcurrencyStamp));

        // Assert named constructor
        var role2 = new ApplicationRole(ApplicationRole.Buyer);
        Assert.NotEqual(Guid.Empty, role2.Id);
        Assert.Equal(ApplicationRole.Buyer, role2.Name);
    }
}
