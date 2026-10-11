using TrustedMarketplace.Domain.Common;

namespace TrustedMarketplace.UnitTests;

public class ArchitectureTests
{
    [Fact]
    public void Domain_Assembly_ShouldNotReference_OtherApplicationLayers()
    {
        // Arrange
        var domainAssembly = typeof(BaseEntity).Assembly;
        var referencedAssemblies = domainAssembly.GetReferencedAssemblies();

        // Act & Assert
        var forbiddenPrefixes = new[]
        {
            "TrustedMarketplace.Application",
            "TrustedMarketplace.Infrastructure",
            "TrustedMarketplace.Api"
        };

        foreach (var referenced in referencedAssemblies)
        {
            foreach (var forbidden in forbiddenPrefixes)
            {
                Assert.False(
                    referenced.Name?.StartsWith(forbidden, StringComparison.OrdinalIgnoreCase) ?? false,
                    $"Domain layer must have zero dependencies, but references '{referenced.Name}'."
                );
            }
        }
    }

    [Fact]
    public void BaseEntity_ShouldInitialize_UniqueIdAndTimestamps()
    {
        // Arrange & Act
        var entity = new TestEntity();

        // Assert
        Assert.NotEqual(Guid.Empty, entity.Id);
        Assert.True(entity.CreatedAtUtc <= DateTime.UtcNow);
        Assert.True(entity.UpdatedAtUtc <= DateTime.UtcNow);
    }

    private class TestEntity : BaseEntity
    {
    }
}
