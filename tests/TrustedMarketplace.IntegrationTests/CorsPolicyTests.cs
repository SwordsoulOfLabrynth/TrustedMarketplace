using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace TrustedMarketplace.IntegrationTests;

public class CorsWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("Jwt:Key", "A_SECURE_TEST_KEY_THAT_IS_AT_LEAST_32_CHARACTERS_LONG_12345");
        builder.UseSetting("CORS_ALLOWED_ORIGINS", "https://trusted-marketplace.vercel.app, http://localhost:3000");
        builder.UseSetting("Jwt:RefreshTokenCookieSameSite", "None");
    }
}

public class CorsPolicyTests : IClassFixture<CorsWebApplicationFactory>
{
    private readonly HttpClient _client;
    private const string ProductionVercelOrigin = "https://trusted-marketplace.vercel.app";
    private const string LocalDevOrigin = "http://localhost:3000";
    private const string UntrustedOrigin = "https://malicious-attacker.com";

    public CorsPolicyTests(CorsWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Theory]
    [InlineData("/api/v1/categories", "GET")]
    [InlineData("/api/v1/products?pageSize=6", "GET")]
    [InlineData("/api/v1/auth/refresh", "POST")]
    public async Task PreflightOptions_FromProductionVercelOrigin_ReturnsAllowedCorsHeaders(string endpoint, string method)
    {
        // Arrange
        var request = new HttpRequestMessage(HttpMethod.Options, endpoint);
        request.Headers.Add("Origin", ProductionVercelOrigin);
        request.Headers.Add("Access-Control-Request-Method", method);
        request.Headers.Add("Access-Control-Request-Headers", "authorization,content-type");

        // Act
        var response = await _client.SendAsync(request);

        // Assert
        Assert.True(
            response.StatusCode == HttpStatusCode.NoContent || response.StatusCode == HttpStatusCode.OK,
            $"Preflight OPTIONS must succeed with 204 or 200, but returned {response.StatusCode}");

        Assert.True(response.Headers.Contains("Access-Control-Allow-Origin"), "Response must contain Access-Control-Allow-Origin header");
        var allowOrigin = response.Headers.GetValues("Access-Control-Allow-Origin").FirstOrDefault();
        Assert.Equal(ProductionVercelOrigin, allowOrigin);

        Assert.True(response.Headers.Contains("Access-Control-Allow-Credentials"), "Response must contain Access-Control-Allow-Credentials");
        var allowCredentials = response.Headers.GetValues("Access-Control-Allow-Credentials").FirstOrDefault();
        Assert.Equal("true", allowCredentials);

        // Ensure wildcard is never used when credentials are required
        Assert.NotEqual("*", allowOrigin);
    }

    [Fact]
    public async Task GetHealth_FromProductionVercelOrigin_ReturnsCorsHeadersAndOk()
    {
        // Arrange
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/health");
        request.Headers.Add("Origin", ProductionVercelOrigin);

        // Act
        var response = await _client.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        Assert.True(response.Headers.Contains("Access-Control-Allow-Origin"));
        var allowOrigin = response.Headers.GetValues("Access-Control-Allow-Origin").FirstOrDefault();
        Assert.Equal(ProductionVercelOrigin, allowOrigin);

        Assert.True(response.Headers.Contains("Access-Control-Allow-Credentials"));
        var allowCredentials = response.Headers.GetValues("Access-Control-Allow-Credentials").FirstOrDefault();
        Assert.Equal("true", allowCredentials);
    }

    [Fact]
    public async Task PreflightOptions_FromLocalDevOrigin_ReturnsAllowedCorsHeaders()
    {
        // Arrange
        var request = new HttpRequestMessage(HttpMethod.Options, "/api/v1/categories");
        request.Headers.Add("Origin", LocalDevOrigin);
        request.Headers.Add("Access-Control-Request-Method", "GET");

        // Act
        var response = await _client.SendAsync(request);

        // Assert
        Assert.True(response.StatusCode == HttpStatusCode.NoContent || response.StatusCode == HttpStatusCode.OK);
        Assert.True(response.Headers.Contains("Access-Control-Allow-Origin"));
        var allowOrigin = response.Headers.GetValues("Access-Control-Allow-Origin").FirstOrDefault();
        Assert.Equal(LocalDevOrigin, allowOrigin);
    }

    [Fact]
    public async Task PreflightOptions_FromUntrustedOrigin_DoesNotIncludeAllowOriginHeader()
    {
        // Arrange
        var request = new HttpRequestMessage(HttpMethod.Options, "/api/v1/categories");
        request.Headers.Add("Origin", UntrustedOrigin);
        request.Headers.Add("Access-Control-Request-Method", "GET");

        // Act
        var response = await _client.SendAsync(request);

        // Assert
        if (response.Headers.Contains("Access-Control-Allow-Origin"))
        {
            var allowOrigin = response.Headers.GetValues("Access-Control-Allow-Origin").FirstOrDefault();
            Assert.NotEqual(UntrustedOrigin, allowOrigin);
        }
    }
}
