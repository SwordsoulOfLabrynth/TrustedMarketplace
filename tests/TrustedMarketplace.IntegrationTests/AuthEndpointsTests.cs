using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using TrustedMarketplace.Api.Controllers;
using TrustedMarketplace.Application.Identity.Dtos;
using TrustedMarketplace.Domain.Identity;
using TrustedMarketplace.Infrastructure.Identity;

namespace TrustedMarketplace.IntegrationTests;

public class AuthEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public AuthEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
    }

    [Fact]
    public async Task Register_ValidPayload_Returns201Created_WithBuyerRole()
    {
        // Arrange
        var request = new RegisterRequest(
            DisplayName: "Ko Aung",
            Email: $"aung_{Guid.NewGuid():N}@example.com",
            Password: "SecurePassword123!"
        );

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", request);

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<RegisterResponse>();
        Assert.NotNull(result);
        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal(request.DisplayName, result.DisplayName);
        Assert.Equal(request.Email.ToLowerInvariant(), result.Email);
        Assert.Equal(RoleConstants.Buyer, result.Role);
        Assert.Equal(AccountStatus.Active.ToString(), result.AccountStatus);
    }

    [Fact]
    public async Task Register_PrivilegeEscalationAttempt_AssignsBuyerRoleOnly_SEC_01()
    {
        // Arrange - payload attempts to sneak in Admin role
        var payloadWithAdmin = new
        {
            displayName = "Escalation Attacker",
            email = $"attacker_{Guid.NewGuid():N}@example.com",
            password = "SecurePassword123!",
            role = "Admin"
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", payloadWithAdmin);

        // Assert - Endpoint creates user with Buyer role only
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<RegisterResponse>();
        Assert.NotNull(result);
        Assert.Equal(RoleConstants.Buyer, result.Role);

        // Verify in database that user was never granted Admin
        using var scope = _factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await userManager.FindByEmailAsync(payloadWithAdmin.email);
        Assert.NotNull(user);
        var roles = await userManager.GetRolesAsync(user);
        Assert.Single(roles);
        Assert.Contains(RoleConstants.Buyer, roles);
        Assert.DoesNotContain(RoleConstants.Admin, roles);
    }

    [Fact]
    public async Task Register_DuplicateEmail_Returns409Conflict()
    {
        // Arrange
        var email = $"duplicate_{Guid.NewGuid():N}@example.com";
        var request1 = new RegisterRequest("User One", email, "SecurePassword123!");
        var request2 = new RegisterRequest("User Two", email, "SecurePassword123!");

        // Act
        var response1 = await _client.PostAsJsonAsync("/api/v1/auth/register", request1);
        var response2 = await _client.PostAsJsonAsync("/api/v1/auth/register", request2);

        // Assert
        Assert.Equal(HttpStatusCode.Created, response1.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, response2.StatusCode);
        Assert.Equal("application/problem+json", response2.Content.Headers.ContentType?.MediaType);

        var json = await response2.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        Assert.Equal(409, doc.RootElement.GetProperty("status").GetInt32());
        Assert.Equal("STATE_CONFLICT", doc.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Register_InvalidPayload_Returns400BadRequest_WithValidationErrors()
    {
        // Arrange - Invalid email, short password, empty display name
        var invalidRequest = new RegisterRequest("", "not-an-email", "short");

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", invalidRequest);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        Assert.Equal(400, doc.RootElement.GetProperty("status").GetInt32());
        Assert.Equal("VALIDATION_ERROR", doc.RootElement.GetProperty("code").GetString());
        Assert.True(doc.RootElement.TryGetProperty("errors", out var errors));
        Assert.True(errors.TryGetProperty("DisplayName", out _));
        Assert.True(errors.TryGetProperty("Email", out _));
        Assert.True(errors.TryGetProperty("Password", out _));
    }

    [Fact]
    public async Task Login_ValidCredentials_Returns200OK_WithAccessToken_AndSetsHttpOnlyRefreshCookie()
    {
        // Arrange
        var email = $"login_{Guid.NewGuid():N}@example.com";
        const string password = "SecurePassword123!";
        await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest("Login User", email, password));

        var loginRequest = new LoginRequest(email, password);

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var authResponse = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(authResponse);
        Assert.False(string.IsNullOrWhiteSpace(authResponse.AccessToken));
        Assert.Equal(900, authResponse.ExpiresInSeconds);
        Assert.Equal("Login User", authResponse.User.DisplayName);
        Assert.Equal(RoleConstants.Buyer, authResponse.User.Role);
        Assert.Equal(AccountStatus.Active.ToString(), authResponse.User.AccountStatus);

        // Verify HttpOnly cookie
        Assert.True(response.Headers.Contains("Set-Cookie"));
        var setCookieHeader = response.Headers.GetValues("Set-Cookie").FirstOrDefault(c => c.Contains(AuthController.RefreshTokenCookieName));
        Assert.NotNull(setCookieHeader);
        Assert.Contains("httponly", setCookieHeader, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/api/v1/auth", setCookieHeader, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("wrongpassword@example.com", "WrongPassword123!")] // Existing user, wrong password
    [InlineData("nonexistent@example.com", "SomePassword123!")]   // Non-existent user
    public async Task Login_InvalidCredentials_Returns401Unauthorized_WithUniformError_SEC_13(string email, string password)
    {
        // Arrange - register the wrongpassword user first
        if (email.StartsWith("wrongpassword"))
        {
            await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest("Existing", email, "CorrectPassword123!"));
        }

        var loginRequest = new LoginRequest(email, password);

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        Assert.Equal(401, doc.RootElement.GetProperty("status").GetInt32());
        Assert.Equal("UNAUTHORIZED", doc.RootElement.GetProperty("code").GetString());
        Assert.Equal("Invalid email or password.", doc.RootElement.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Login_SuspendedAccount_Returns403Forbidden_SEC_03()
    {
        // Arrange
        var email = $"suspended_{Guid.NewGuid():N}@example.com";
        const string password = "SecurePassword123!";
        await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest("Suspended User", email, password));

        // Suspend user in DB
        using (var scope = _factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = await userManager.FindByEmailAsync(email);
            Assert.NotNull(user);
            user.Suspend();
            await userManager.UpdateAsync(user);
        }

        var loginRequest = new LoginRequest(email, password);

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        Assert.Equal(403, doc.RootElement.GetProperty("status").GetInt32());
        Assert.Equal("ACCOUNT_SUSPENDED", doc.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Refresh_ValidCookie_ReturnsNewAccessToken_AndRotatesRefreshCookie()
    {
        // Arrange
        var email = $"refresh_{Guid.NewGuid():N}@example.com";
        const string password = "SecurePassword123!";
        await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest("Refresh User", email, password));

        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        var initialCookieHeader = ExtractCookieHeader(loginResponse, AuthController.RefreshTokenCookieName);
        Assert.NotNull(initialCookieHeader);

        // Act - Call refresh with cookie
        using var refreshRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        refreshRequest.Headers.Add("Cookie", initialCookieHeader);
        var refreshResponse = await _client.SendAsync(refreshRequest);

        // Assert
        Assert.Equal(HttpStatusCode.OK, refreshResponse.StatusCode);
        var authResult = await refreshResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(authResult);
        Assert.False(string.IsNullOrWhiteSpace(authResult.AccessToken));

        // Verify rotated cookie is present
        var rotatedCookieHeader = ExtractCookieHeader(refreshResponse, AuthController.RefreshTokenCookieName);
        Assert.NotNull(rotatedCookieHeader);
        Assert.NotEqual(initialCookieHeader, rotatedCookieHeader);
    }

    [Fact]
    public async Task Refresh_ReuseOfRotatedToken_TriggersFamilyRevocation()
    {
        // Arrange
        var email = $"reuse_{Guid.NewGuid():N}@example.com";
        const string password = "SecurePassword123!";
        await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest("Reuse User", email, password));

        // Login -> Gets Token T1
        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        var cookieT1 = ExtractCookieHeader(loginResponse, AuthController.RefreshTokenCookieName);

        // First Refresh with T1 -> Gets Token T2 (T1 is now rotated/revoked)
        using var refreshReq1 = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        refreshReq1.Headers.Add("Cookie", cookieT1);
        var refreshResp1 = await _client.SendAsync(refreshReq1);
        Assert.Equal(HttpStatusCode.OK, refreshResp1.StatusCode);
        var cookieT2 = ExtractCookieHeader(refreshResp1, AuthController.RefreshTokenCookieName);

        // Act - Attacker replays OLD Token T1
        using var replayReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        replayReq.Headers.Add("Cookie", cookieT1);
        var replayResp = await _client.SendAsync(replayReq);

        // Assert - Reuse detected, returns 401
        Assert.Equal(HttpStatusCode.Unauthorized, replayResp.StatusCode);
        var json = await replayResp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        Assert.Equal("TOKEN_REUSE_DETECTED", doc.RootElement.GetProperty("code").GetString());

        // Subsequent attempt with Token T2 must now also fail because family was invalidated
        using var refreshReq2 = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        refreshReq2.Headers.Add("Cookie", cookieT2);
        var refreshResp2 = await _client.SendAsync(refreshReq2);
        Assert.Equal(HttpStatusCode.Unauthorized, refreshResp2.StatusCode);
    }

    [Fact]
    public async Task Logout_RevokesRefreshToken_AndClearsCookie()
    {
        // Arrange
        var email = $"logout_{Guid.NewGuid():N}@example.com";
        const string password = "SecurePassword123!";
        await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest("Logout User", email, password));

        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        var cookie = ExtractCookieHeader(loginResponse, AuthController.RefreshTokenCookieName);

        // Act - Logout
        using var logoutRequest = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/logout");
        logoutRequest.Headers.Add("Cookie", cookie);
        var logoutResponse = await _client.SendAsync(logoutRequest);

        // Assert - 204 No Content
        Assert.Equal(HttpStatusCode.NoContent, logoutResponse.StatusCode);

        // Verify cookie is expired/cleared
        Assert.True(logoutResponse.Headers.Contains("Set-Cookie"));
        var setCookie = logoutResponse.Headers.GetValues("Set-Cookie").FirstOrDefault(c => c.Contains(AuthController.RefreshTokenCookieName));
        Assert.NotNull(setCookie);
        Assert.Contains("expires=Thu, 01 Jan 1970", setCookie, StringComparison.OrdinalIgnoreCase);

        // Verify refresh token is no longer usable
        using var refreshAfterLogout = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        refreshAfterLogout.Headers.Add("Cookie", cookie);
        var refreshResp = await _client.SendAsync(refreshAfterLogout);
        Assert.Equal(HttpStatusCode.Unauthorized, refreshResp.StatusCode);
    }

    [Fact]
    public async Task GetCurrentUser_Authenticated_Returns200OK_WithProfile()
    {
        // Arrange
        var email = $"me_{Guid.NewGuid():N}@example.com";
        const string password = "SecurePassword123!";
        await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest("Current User", email, password));

        var loginResponse = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        // Act - Call /me with Bearer token
        using var meRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me");
        meRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        var meResponse = await _client.SendAsync(meRequest);

        // Assert
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
        var profile = await meResponse.Content.ReadFromJsonAsync<UserDto>();
        Assert.NotNull(profile);
        Assert.Equal(auth.User.Id, profile.Id);
        Assert.Equal("Current User", profile.DisplayName);
        Assert.Equal(email.ToLowerInvariant(), profile.Email);
        Assert.Equal(RoleConstants.Buyer, profile.Role);
        Assert.Equal(AccountStatus.Active.ToString(), profile.AccountStatus);
    }

    [Fact]
    public async Task GetCurrentUser_Unauthenticated_Returns401Unauthorized()
    {
        // Act - Call without Bearer header
        var response = await _client.GetAsync("/api/v1/auth/me");

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private static string? ExtractCookieHeader(HttpResponseMessage response, string cookieName)
    {
        if (!response.Headers.Contains("Set-Cookie"))
            return null;

        foreach (var cookie in response.Headers.GetValues("Set-Cookie"))
        {
            if (cookie.StartsWith($"{cookieName}="))
            {
                var cookiePart = cookie.Split(';').FirstOrDefault();
                return cookiePart;
            }
        }

        return null;
    }
}
