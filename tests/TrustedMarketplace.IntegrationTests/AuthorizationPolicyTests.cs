using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using TrustedMarketplace.Application.Identity.Dtos;
using TrustedMarketplace.Domain.Identity;
using TrustedMarketplace.Infrastructure.Identity;

namespace TrustedMarketplace.IntegrationTests;

public class AuthorizationPolicyTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public AuthorizationPolicyTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
    }

    [Fact]
    public async Task RequireAdmin_RejectsBuyer_With403Forbidden_SEC_02()
    {
        // Arrange - Register regular Buyer and obtain JWT
        var email = $"buyer_admin_test_{Guid.NewGuid():N}@example.com";
        const string password = "SecurePassword123!";
        await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest("Regular Buyer", email, password));

        var loginResp = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        var auth = await loginResp.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        // Act - Buyer attempts to access Admin-only endpoint
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/admin/seller-applications");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var response = await _client.SendAsync(request);

        // Assert - 403 Forbidden with RFC 7807 ProblemDetails
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        Assert.Equal(403, doc.RootElement.GetProperty("status").GetInt32());
        Assert.Equal("FORBIDDEN", doc.RootElement.GetProperty("code").GetString());
        Assert.Equal("Forbidden", doc.RootElement.GetProperty("title").GetString());
    }

    [Fact]
    public async Task RequireAdmin_AllowsAdmin_With200OK()
    {
        // Arrange - Create Admin user in DB
        var adminEmail = $"admin_{Guid.NewGuid():N}@example.com";
        const string password = "AdminPassword123!";

        using (var scope = _factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();

            if (!await roleManager.RoleExistsAsync(RoleConstants.Admin))
            {
                await roleManager.CreateAsync(new ApplicationRole(RoleConstants.Admin));
            }

            var adminUser = new ApplicationUser(adminEmail, "Platform Administrator")
            {
                AccountStatus = AccountStatus.Active
            };
            var createResult = await userManager.CreateAsync(adminUser, password);
            Assert.True(createResult.Succeeded);
            await userManager.AddToRoleAsync(adminUser, RoleConstants.Admin);
        }

        // Login as Admin
        var loginResp = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(adminEmail, password));
        var auth = await loginResp.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        // Act - Admin requests Admin endpoint
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/admin/seller-applications");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var response = await _client.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task RequireActiveUser_RejectsSuspendedAccount_EvenWithValidJwt_SEC_03()
    {
        // Arrange - Register and login to obtain a valid JWT
        var email = $"suspended_jwt_{Guid.NewGuid():N}@example.com";
        const string password = "SecurePassword123!";
        await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest("Suspended Target", email, password));

        var loginResp = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        var auth = await loginResp.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        // While JWT is still valid, user account is suspended in the database
        using (var scope = _factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = await userManager.FindByEmailAsync(email);
            Assert.NotNull(user);
            user.Suspend();
            var updateResult = await userManager.UpdateAsync(user);
            Assert.True(updateResult.Succeeded);
        }

        // Act - User sends request with previously issued, valid JWT to /me
        using var meRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me");
        meRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var response = await _client.SendAsync(meRequest);

        // Assert - Live check intercepts and rejects with 403 ACCOUNT_SUSPENDED
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        Assert.Equal(403, doc.RootElement.GetProperty("status").GetInt32());
        Assert.Equal("ACCOUNT_SUSPENDED", doc.RootElement.GetProperty("code").GetString());
        Assert.Contains("suspended", doc.RootElement.GetProperty("detail").GetString(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RequireActiveUser_RejectsClosedAccount_EvenWithValidJwt()
    {
        // Arrange - Register and login to obtain a valid JWT
        var email = $"closed_jwt_{Guid.NewGuid():N}@example.com";
        const string password = "SecurePassword123!";
        await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest("Closed Target", email, password));

        var loginResp = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        var auth = await loginResp.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        // User account is closed in the database
        using (var scope = _factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = await userManager.FindByEmailAsync(email);
            Assert.NotNull(user);
            user.Close();
            var updateResult = await userManager.UpdateAsync(user);
            Assert.True(updateResult.Succeeded);
        }

        // Act - User sends request with valid JWT
        using var meRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me");
        meRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var response = await _client.SendAsync(meRequest);

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        Assert.Equal(403, doc.RootElement.GetProperty("status").GetInt32());
        Assert.Equal("ACCOUNT_CLOSED", doc.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task UnauthenticatedRequest_Returns401Unauthorized_WithRfc7807()
    {
        // Act - Call protected Admin endpoint without credentials
        var response = await _client.GetAsync("/api/v1/admin/seller-applications");

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        Assert.Equal(401, doc.RootElement.GetProperty("status").GetInt32());
        Assert.Equal("UNAUTHORIZED", doc.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Cors_PreflightRequest_ReturnsAllowedOriginAndCredentials()
    {
        // Arrange
        using var preflightRequest = new HttpRequestMessage(HttpMethod.Options, "/api/v1/auth/login");
        preflightRequest.Headers.Add("Origin", "http://localhost:3000");
        preflightRequest.Headers.Add("Access-Control-Request-Method", "POST");
        preflightRequest.Headers.Add("Access-Control-Request-Headers", "content-type");

        // Act
        var response = await _client.SendAsync(preflightRequest);

        // Assert
        Assert.True(response.IsSuccessStatusCode);
        Assert.True(response.Headers.Contains("Access-Control-Allow-Origin"));
        Assert.Equal("http://localhost:3000", response.Headers.GetValues("Access-Control-Allow-Origin").FirstOrDefault());
        Assert.True(response.Headers.Contains("Access-Control-Allow-Credentials"));
        Assert.Equal("true", response.Headers.GetValues("Access-Control-Allow-Credentials").FirstOrDefault());
    }
}
