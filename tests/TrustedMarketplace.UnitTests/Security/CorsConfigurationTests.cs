using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace TrustedMarketplace.UnitTests.Security;

public class CorsConfigurationTests
{
    private static ICorsPolicyProvider BuildCorsPolicyProvider(Dictionary<string, string?> inMemorySettings)
    {
        var services = new ServiceCollection();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        services.AddCors(options =>
        {
            var rawOrigins = new List<string>();

            var corsEnv = configuration["CORS_ALLOWED_ORIGINS"];
            if (!string.IsNullOrWhiteSpace(corsEnv))
            {
                rawOrigins.AddRange(corsEnv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
            }

            var configOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
            if (configOrigins != null && configOrigins.Length > 0)
            {
                rawOrigins.AddRange(configOrigins);
            }

            if (rawOrigins.Count == 0)
            {
                rawOrigins.AddRange([
                    "https://trusted-marketplace.vercel.app",
                    "http://localhost:3000",
                    "http://localhost:5173",
                    "https://localhost:3000",
                    "https://localhost:5173"
                ]);
            }
            else
            {
                rawOrigins.Add("https://trusted-marketplace.vercel.app");
            }

            var allowedOrigins = rawOrigins
                .Where(o => !string.IsNullOrWhiteSpace(o))
                .Select(o => o.Trim().TrimEnd('/'))
                .Where(o => !string.IsNullOrWhiteSpace(o))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            options.AddDefaultPolicy(policy =>
            {
                policy.WithOrigins(allowedOrigins)
                      .AllowAnyMethod()
                      .AllowAnyHeader()
                      .AllowCredentials()
                      .WithExposedHeaders("X-Correlation-ID");
            });
        });

        var sp = services.BuildServiceProvider();
        var corsOptions = sp.GetRequiredService<IOptions<CorsOptions>>().Value;
        return sp.GetRequiredService<ICorsPolicyProvider>();
    }

    [Fact]
    public async Task DefaultConfiguration_AlwaysAllowsProductionVercelOrigin()
    {
        // Arrange
        var provider = BuildCorsPolicyProvider(new Dictionary<string, string?>());

        // Act
        var policy = await provider.GetPolicyAsync(new Microsoft.AspNetCore.Http.DefaultHttpContext(), null);

        // Assert
        Assert.NotNull(policy);
        Assert.True(policy.SupportsCredentials);
        Assert.Contains("https://trusted-marketplace.vercel.app", policy.Origins);
        Assert.DoesNotContain("*", policy.Origins);
    }

    [Fact]
    public async Task TrailingSlashInEnvVar_IsSanitizedAndMatchesCanonicalOrigin()
    {
        // Arrange: User accidentally configured a trailing slash in CORS_ALLOWED_ORIGINS
        var provider = BuildCorsPolicyProvider(new Dictionary<string, string?>
        {
            ["CORS_ALLOWED_ORIGINS"] = "https://trusted-marketplace.vercel.app/ , http://localhost:3000/ "
        });

        // Act
        var policy = await provider.GetPolicyAsync(new Microsoft.AspNetCore.Http.DefaultHttpContext(), null);

        // Assert
        Assert.NotNull(policy);
        // Trailing slashes must be stripped so exact match against browser Origin succeeds
        Assert.Contains("https://trusted-marketplace.vercel.app", policy.Origins);
        Assert.Contains("http://localhost:3000", policy.Origins);
        Assert.DoesNotContain("https://trusted-marketplace.vercel.app/", policy.Origins);
        Assert.DoesNotContain("http://localhost:3000/", policy.Origins);
    }

    [Fact]
    public async Task CustomOriginsInConfig_AlwaysPreservesProductionVercelOrigin()
    {
        // Arrange
        var provider = BuildCorsPolicyProvider(new Dictionary<string, string?>
        {
            ["Cors:AllowedOrigins:0"] = "https://custom-preview.vercel.app"
        });

        // Act
        var policy = await provider.GetPolicyAsync(new Microsoft.AspNetCore.Http.DefaultHttpContext(), null);

        // Assert
        Assert.NotNull(policy);
        Assert.Contains("https://custom-preview.vercel.app", policy.Origins);
        Assert.Contains("https://trusted-marketplace.vercel.app", policy.Origins);
    }
}
