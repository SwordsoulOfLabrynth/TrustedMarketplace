using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using TrustedMarketplace.Infrastructure;

namespace TrustedMarketplace.UnitTests.Security;

public class JwtConfigurationTests
{
    private class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Production";
        public string ApplicationName { get; set; } = "TrustedMarketplace";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = null!;
    }

    [Fact]
    public void InProduction_WhenKeyIsMissing_ThrowsInvalidOperationException()
    {
        // Arrange
        var services = new ServiceCollection();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            { "Jwt:Issuer", "TrustedMarketplace" }
        }).Build();
        var env = new TestHostEnvironment { EnvironmentName = "Production" };

        // Act & Assert
        var ex = Assert.Throws<InvalidOperationException>(() =>
            services.AddInfrastructureJwtAuthentication(config, env));

        Assert.Contains("missing or empty", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void InProduction_WhenKeyIsKnownPlaceholder_ThrowsInvalidOperationException()
    {
        // Arrange
        var services = new ServiceCollection();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            { "Jwt:Key", DependencyInjection.DevelopmentFallbackSecret }
        }).Build();
        var env = new TestHostEnvironment { EnvironmentName = "Production" };

        // Act & Assert
        var ex = Assert.Throws<InvalidOperationException>(() =>
            services.AddInfrastructureJwtAuthentication(config, env));

        Assert.Contains("placeholder", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void InProduction_WhenKeyIsShorterThan32Characters_ThrowsInvalidOperationException()
    {
        // Arrange
        var services = new ServiceCollection();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            { "Jwt:Key", "too_short_key_12345" }
        }).Build();
        var env = new TestHostEnvironment { EnvironmentName = "Production" };

        // Act & Assert
        var ex = Assert.Throws<InvalidOperationException>(() =>
            services.AddInfrastructureJwtAuthentication(config, env));

        Assert.Contains("at least 32 characters", ex.Message, StringComparison.OrdinalIgnoreCase);
        // Confirm secret is not printed in exception
        Assert.DoesNotContain("too_short_key_12345", ex.Message);
    }

    [Fact]
    public void InProduction_WhenKeyIsValid_RegistersServicesSuccessfully()
    {
        // Arrange
        var services = new ServiceCollection();
        var validKey = "A_VERY_SECURE_PRODUCTION_SECRET_KEY_MIN_32_CHARS!";
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            { "Jwt:Key", validKey },
            { "Jwt:Issuer", "TrustedMarketplace" },
            { "Jwt:Audience", "TrustedMarketplaceClient" }
        }).Build();
        var env = new TestHostEnvironment { EnvironmentName = "Production" };

        // Act
        services.AddInfrastructureJwtAuthentication(config, env);

        // Assert
        Assert.NotEmpty(services);
    }

    [Fact]
    public void InDevelopment_WhenKeyIsMissing_UsesFallbackWithoutThrowing()
    {
        // Arrange
        var services = new ServiceCollection();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            { "Jwt:Issuer", "TrustedMarketplace" }
        }).Build();
        var env = new TestHostEnvironment { EnvironmentName = "Development" };

        // Act
        services.AddInfrastructureJwtAuthentication(config, env);

        // Assert
        Assert.NotEmpty(services);
    }

    [Fact]
    public void InDevelopment_WhenKeyIsPlaceholder_SucceedsWithoutThrowing()
    {
        // Arrange
        var services = new ServiceCollection();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            { "Jwt:Key", DependencyInjection.DevelopmentFallbackSecret }
        }).Build();
        var env = new TestHostEnvironment { EnvironmentName = "Development" };

        // Act
        services.AddInfrastructureJwtAuthentication(config, env);

        // Assert
        Assert.NotEmpty(services);
    }
}
