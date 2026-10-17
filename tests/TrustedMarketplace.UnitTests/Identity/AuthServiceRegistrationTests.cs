using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Identity;
using TrustedMarketplace.Application.Identity.Dtos;
using TrustedMarketplace.Domain.Identity;
using TrustedMarketplace.Infrastructure.Identity;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.UnitTests.Identity;

public class AuthServiceRegistrationTests : IDisposable
{
    private readonly ServiceProvider _serviceProvider;
    private readonly AppDbContext _dbContext;
    private readonly IAuthService _authService;
    private readonly UserManager<ApplicationUser> _userManager;

    public AuthServiceRegistrationTests()
    {
        var services = new ServiceCollection();
        var dbName = "Test_Auth_" + Guid.NewGuid().ToString("N");

        services.AddDbContext<AppDbContext>(options =>
            options.UseInMemoryDatabase(dbName));

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ASPNETCORE_ENVIRONMENT"] = "Production",
                ["Identity:RequireConfirmedEmail"] = "true",
                ["Jwt:Key"] = "A_VERY_SECRET_KEY_FOR_TESTING_PURPOSES_AT_LEAST_32_CHARS_LONG!",
                ["Jwt:Issuer"] = "TrustedMarketplace",
                ["Jwt:Audience"] = "TrustedMarketplaceClient",
                ["Jwt:AccessTokenExpirationMinutes"] = "15",
                ["Jwt:RefreshTokenExpirationDays"] = "7"
            })
            .Build();

        services.AddSingleton<IConfiguration>(configuration);
        services.AddLogging();

        services.AddIdentityCore<ApplicationUser>(options =>
        {
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireUppercase = true;
            options.Password.RequireNonAlphanumeric = false;
            options.Password.RequiredLength = 8;
            options.User.RequireUniqueEmail = true;
            options.SignIn.RequireConfirmedEmail = true; // Strict Production policy
        })
        .AddRoles<ApplicationRole>()
        .AddEntityFrameworkStores<AppDbContext>();

        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IAuthService, AuthService>();

        _serviceProvider = services.BuildServiceProvider();
        _dbContext = _serviceProvider.GetRequiredService<AppDbContext>();
        _authService = _serviceProvider.GetRequiredService<IAuthService>();
        _userManager = _serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        _serviceProvider.Dispose();
    }

    [Fact]
    public async Task RegisterAsync_CreatesUserWithConfirmedEmail_AndEnablesImmediateLoginUnderRequireConfirmedEmailPolicy()
    {
        // Arrange
        var email = $"newbuyer_{Guid.NewGuid():N}@example.com";
        const string password = "StrongPassword123!";
        var request = new RegisterRequest("New Buyer", email, password);

        // Act - Register
        var registerResult = await _authService.RegisterAsync(request);

        // Assert - Registration returns valid response
        Assert.NotNull(registerResult);
        Assert.Equal(email.ToLowerInvariant(), registerResult.Email);
        Assert.Equal(RoleConstants.Buyer, registerResult.Role);

        // Verify entity in database has EmailConfirmed == true
        var userInDb = await _userManager.FindByEmailAsync(email);
        Assert.NotNull(userInDb);
        Assert.True(userInDb.EmailConfirmed, "Newly registered users must have EmailConfirmed == true in Phase 1 MVP.");

        // Act & Assert - Immediate login must succeed even with RequireConfirmedEmail = true
        var (authResponse, refreshToken, _) = await _authService.LoginAsync(new LoginRequest(email, password));
        Assert.NotNull(authResponse);
        Assert.False(string.IsNullOrWhiteSpace(authResponse.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(refreshToken));
        Assert.Equal(email.ToLowerInvariant(), authResponse.User.Email);
    }

    [Fact]
    public async Task RegisterAsync_DuplicateEmail_ThrowsConflictException()
    {
        // Arrange
        var email = $"duplicate_{Guid.NewGuid():N}@example.com";
        const string password = "StrongPassword123!";
        var request1 = new RegisterRequest("Buyer One", email, password);
        var request2 = new RegisterRequest("Buyer Two", email.ToUpperInvariant(), password);

        // Act 1 - First registration succeeds
        await _authService.RegisterAsync(request1);

        // Act 2 - Duplicate registration must throw ConflictException
        var ex = await Assert.ThrowsAsync<ConflictException>(() => _authService.RegisterAsync(request2));
        Assert.Equal("Email is already registered.", ex.Message);
    }

    [Fact]
    public async Task LoginAsync_ExistingUnconfirmedUser_SelfHealsEmailConfirmedOnValidCredentials()
    {
        // Arrange - Simulate an existing account created during the bug with EmailConfirmed = false
        var email = $"unconfirmed_{Guid.NewGuid():N}@example.com";
        const string password = "StrongPassword123!";

        var unconfirmedUser = new ApplicationUser(email, "Unconfirmed User")
        {
            EmailConfirmed = false,
            AccountStatus = AccountStatus.Active
        };
        var createResult = await _userManager.CreateAsync(unconfirmedUser, password);
        Assert.True(createResult.Succeeded);
        Assert.False(unconfirmedUser.EmailConfirmed);

        // Act - Login with valid credentials
        var (auth, token, _) = await _authService.LoginAsync(new LoginRequest(email, password));

        // Assert - Login succeeds and EmailConfirmed is self-healed
        Assert.NotNull(auth);
        Assert.False(string.IsNullOrWhiteSpace(auth.AccessToken));

        var updatedUser = await _userManager.FindByEmailAsync(email);
        Assert.NotNull(updatedUser);
        Assert.True(updatedUser.EmailConfirmed, "Existing users who authenticate with correct password should have email confirmed.");
    }

    [Fact]
    public async Task LoginAsync_InvalidPassword_DoesNotSelfHealOrConfirmEmail()
    {
        // Arrange
        var email = $"unconfirmed_wrong_{Guid.NewGuid():N}@example.com";
        const string password = "StrongPassword123!";

        var unconfirmedUser = new ApplicationUser(email, "Unconfirmed User")
        {
            EmailConfirmed = false,
            AccountStatus = AccountStatus.Active
        };
        await _userManager.CreateAsync(unconfirmedUser, password);

        // Act & Assert
        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            _authService.LoginAsync(new LoginRequest(email, "WrongPassword123!")));

        var userInDb = await _userManager.FindByEmailAsync(email);
        Assert.NotNull(userInDb);
        Assert.False(userInDb.EmailConfirmed, "Failed login must not confirm email.");
    }
}
