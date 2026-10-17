using TrustedMarketplace.Infrastructure;

namespace TrustedMarketplace.UnitTests.Persistence;

public class ConnectionStringNormalizationTests
{
    [Fact]
    public void StandardKeyValueConnectionString_IsPreserved()
    {
        // Arrange
        var standardConn = "Host=127.0.0.1;Port=5432;Database=testdb;Username=postgres;Password=pass";

        // Act
        var result = DependencyInjection.NormalizePostgresConnectionString(standardConn);

        // Assert
        Assert.Equal(standardConn, result);
    }

    [Fact]
    public void PostgresUriFormat_IsConvertedToValidNpgsqlFormat()
    {
        // Arrange
        var uriConn = "postgresql://myuser:mypassword@ep-test-host.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

        // Act
        var result = DependencyInjection.NormalizePostgresConnectionString(uriConn);

        // Assert
        Assert.Contains("Host=ep-test-host.us-east-2.aws.neon.tech", result);
        Assert.Contains("Database=neondb", result);
        Assert.Contains("Username=myuser", result);
        Assert.Contains("Password=mypassword", result);
        Assert.Contains("Port=5432", result);
        Assert.Contains("SSL Mode=Require", result);
        Assert.Contains("Timeout=90", result);
        Assert.Contains("Command Timeout=90", result);
        Assert.Contains("Keepalive=30", result);
        Assert.DoesNotContain("postgresql://", result);
    }

    [Fact]
    public void NullOrEmptyConnectionString_ReturnsInput()
    {
        Assert.Equal("", DependencyInjection.NormalizePostgresConnectionString(""));
        Assert.Null(DependencyInjection.NormalizePostgresConnectionString(null!));
    }
}
