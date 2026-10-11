using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace TrustedMarketplace.IntegrationTests;

public class HealthEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public HealthEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Get_HealthEndpoint_ReturnsOkAndHealthyStatus()
    {
        // Act
        var response = await _client.GetAsync("/api/v1/health");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"status\":\"Healthy\"", content);
        Assert.Contains("\"version\":\"0.1.0\"", content);
    }
}
