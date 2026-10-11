using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using TrustedMarketplace.Api.Middleware;

namespace TrustedMarketplace.IntegrationTests;

public class GlobalExceptionHandlerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public GlobalExceptionHandlerTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task ValidationException_Returns400_WithRfc7807ProblemDetails()
    {
        // Act
        var response = await _client.GetAsync("/api/v1/test-errors/validation");

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal(400, root.GetProperty("status").GetInt32());
        Assert.Equal("Validation Failed", root.GetProperty("title").GetString());
        Assert.Equal("VALIDATION_ERROR", root.GetProperty("code").GetString());
        Assert.True(root.TryGetProperty("traceId", out var traceIdProp) && !string.IsNullOrWhiteSpace(traceIdProp.GetString()));
        Assert.True(root.TryGetProperty("errors", out var errorsProp));
        Assert.True(errorsProp.TryGetProperty("Email", out _));
        Assert.True(errorsProp.TryGetProperty("Password", out _));

        Assert.True(response.Headers.Contains(CorrelationIdMiddleware.CorrelationIdHeader));
    }

    [Fact]
    public async Task DomainException_Returns400_WithRfc7807ProblemDetails()
    {
        // Act
        var response = await _client.GetAsync("/api/v1/test-errors/domain-violation");

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal(400, root.GetProperty("status").GetInt32());
        Assert.Equal("Business Rule Violation", root.GetProperty("title").GetString());
        Assert.Equal("DOMAIN_RULE_VIOLATION", root.GetProperty("code").GetString());
        Assert.Contains("negative price", root.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task NotFoundException_Returns404_WithRfc7807ProblemDetails()
    {
        // Act
        var response = await _client.GetAsync("/api/v1/test-errors/not-found");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal(404, root.GetProperty("status").GetInt32());
        Assert.Equal("Resource Not Found", root.GetProperty("title").GetString());
        Assert.Equal("NOT_FOUND", root.GetProperty("code").GetString());
        Assert.Contains("prod-123", root.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task ConflictException_Returns409_WithRfc7807ProblemDetails()
    {
        // Act
        var response = await _client.GetAsync("/api/v1/test-errors/conflict");

        // Assert
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal(409, root.GetProperty("status").GetInt32());
        Assert.Equal("State Conflict", root.GetProperty("title").GetString());
        Assert.Equal("STATE_CONFLICT", root.GetProperty("code").GetString());
    }

    [Fact]
    public async Task ForbiddenException_Returns403_WithRfc7807ProblemDetails()
    {
        // Act
        var response = await _client.GetAsync("/api/v1/test-errors/forbidden");

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal(403, root.GetProperty("status").GetInt32());
        Assert.Equal("Forbidden", root.GetProperty("title").GetString());
        Assert.Equal("FORBIDDEN", root.GetProperty("code").GetString());
    }

    [Fact]
    public async Task UnhandledException_Returns500_WithoutLeakingSecretsOrStackTraces()
    {
        // Act
        var response = await _client.GetAsync("/api/v1/test-errors/server-error");

        // Assert
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        Assert.Equal(500, root.GetProperty("status").GetInt32());
        Assert.Equal("Internal Server Error", root.GetProperty("title").GetString());
        Assert.Equal("INTERNAL_SERVER_ERROR", root.GetProperty("code").GetString());

        var detail = root.GetProperty("detail").GetString();
        Assert.Equal("An unexpected error occurred while processing your request. Please contact support referencing the trace ID.", detail);

        // Security assertion: Never leak internal exception message, stack trace, or secrets
        Assert.DoesNotContain("secret_db_pw", json);
        Assert.DoesNotContain("leak attempt", json);
        Assert.DoesNotContain("StackTrace", json);
        Assert.DoesNotContain("at System.", json);
    }

    [Fact]
    public async Task RequestWithCustomCorrelationId_PropagatesToResponseHeaderAndProblemDetails()
    {
        // Arrange
        const string customCorrelationId = "custom-test-trace-id-98765";
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/test-errors/conflict");
        request.Headers.Add(CorrelationIdMiddleware.CorrelationIdHeader, customCorrelationId);

        // Act
        var response = await _client.SendAsync(request);

        // Assert
        Assert.True(response.Headers.Contains(CorrelationIdMiddleware.CorrelationIdHeader));
        var headerValue = response.Headers.GetValues(CorrelationIdMiddleware.CorrelationIdHeader).FirstOrDefault();
        Assert.Equal(customCorrelationId, headerValue);

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var traceId = doc.RootElement.GetProperty("traceId").GetString();
        Assert.Equal(customCorrelationId, traceId);
    }

    [Theory]
    [InlineData("invalid\r\nCRLF-injection")]
    [InlineData("spaces not allowed here")]
    [InlineData("<script>alert(1)</script>")]
    [InlineData("this-correlation-id-is-way-too-long-and-exceeds-one-hundred-characters-which-could-overflow-the-database-column-storage-bounds-1234567890")]
    public async Task RequestWithInvalidCorrelationId_RejectsAndGeneratesSafeGuid(string invalidCorrelationId)
    {
        // Arrange
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/health");
        request.Headers.TryAddWithoutValidation(CorrelationIdMiddleware.CorrelationIdHeader, invalidCorrelationId);

        // Act
        var response = await _client.SendAsync(request);

        // Assert
        Assert.True(response.Headers.Contains(CorrelationIdMiddleware.CorrelationIdHeader));
        var returnedId = response.Headers.GetValues(CorrelationIdMiddleware.CorrelationIdHeader).FirstOrDefault();

        Assert.NotNull(returnedId);
        Assert.NotEqual(invalidCorrelationId, returnedId);
        Assert.True(Guid.TryParse(returnedId, out _), "Invalid correlation ID should be replaced with a valid generated GUID.");
    }

    [Fact]
    public async Task TestErrorsController_InProductionEnvironment_Returns404NotFound()
    {
        // Arrange
        var prodFactory = _factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.UseSetting("Jwt:Key", "A_VALID_TEST_PRODUCTION_KEY_OF_AT_LEAST_32_CHARS!");
        });
        var prodClient = prodFactory.CreateClient();

        // Act
        var response = await prodClient.GetAsync("/api/v1/test-errors/validation");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}


