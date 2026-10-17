using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using TrustedMarketplace.Infrastructure.Storage;

namespace TrustedMarketplace.UnitTests.Catalog;

public class ProductImageStorageFallbackTests : IDisposable
{
    private readonly string _tempStorageRoot;

    public ProductImageStorageFallbackTests()
    {
        _tempStorageRoot = Path.Combine(Path.GetTempPath(), "tm_test_storage_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_tempStorageRoot);
    }

    public void Dispose()
    {
        try
        {
            if (Directory.Exists(_tempStorageRoot))
            {
                Directory.Delete(_tempStorageRoot, recursive: true);
            }
        }
        catch
        {
            // Best effort cleanup
        }
    }

    [Fact]
    public async Task GetProductImageAsync_WhenFileMissingOnRuntimeDisk_FallsBackToBundledSeedAsset()
    {
        // Arrange
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Storage:LocalProductImageRoot"] = _tempStorageRoot
            })
            .Build();

        var service = new LocalFileStorageService(config, NullLogger<LocalFileStorageService>.Instance);

        // Delete any pre-copied files to simulate ephemeral container disk wipe on reboot
        var prodDir = Path.Combine(_tempStorageRoot, "products");
        if (Directory.Exists(prodDir))
        {
            Directory.Delete(prodDir, recursive: true);
        }

        // Act - Request seed image storage keys
        var stream = await service.GetProductImageAsync("products/seed/mandalay-teak-marionette.jpg");

        // Assert
        Assert.NotNull(stream);
        Assert.True(stream.Length > 0);
        stream.Dispose();

        // Verify it self-healed and restored the file to the runtime storage directory
        var restoredPath = Path.Combine(_tempStorageRoot, "products", "seed", "mandalay-teak-marionette.jpg");
        Assert.True(File.Exists(restoredPath));
    }

    [Fact]
    public async Task GetProductImageAsync_WhenLegacyProductionKeyRequested_ResolvesToBundledAsset()
    {
        // Arrange
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Storage:LocalProductImageRoot"] = _tempStorageRoot
            })
            .Build();

        var service = new LocalFileStorageService(config, NullLogger<LocalFileStorageService>.Instance);

        // Delete any pre-copied files
        var prodDir = Path.Combine(_tempStorageRoot, "products");
        if (Directory.Exists(prodDir))
        {
            Directory.Delete(prodDir, recursive: true);
        }

        // Act - Request legacy production storage key
        var stream = await service.GetProductImageAsync("products/2026/10/98a37d9b0f4049e4be163005afaa697c.jpg");

        // Assert
        Assert.NotNull(stream);
        Assert.True(stream.Length > 0);
        stream.Dispose();

        var restoredPath = Path.Combine(_tempStorageRoot, "products", "2026", "10", "98a37d9b0f4049e4be163005afaa697c.jpg");
        Assert.True(File.Exists(restoredPath));
    }

    [Fact]
    public void Constructor_AutomaticallySeedsPublicMediaDirectory()
    {
        // Arrange
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Storage:LocalProductImageRoot"] = _tempStorageRoot
            })
            .Build();

        // Act
        _ = new LocalFileStorageService(config, NullLogger<LocalFileStorageService>.Instance);

        // Assert - Seed assets were copied into products/seed/
        var seedMarionette = Path.Combine(_tempStorageRoot, "products", "seed", "mandalay-teak-marionette.jpg");
        var seedBowl = Path.Combine(_tempStorageRoot, "products", "seed", "bagan-lacquerware-bowl.jpg");
        var seedScarf = Path.Combine(_tempStorageRoot, "products", "seed", "inle-lotus-silk-scarf.jpg");

        Assert.True(File.Exists(seedMarionette));
        Assert.True(File.Exists(seedBowl));
        Assert.True(File.Exists(seedScarf));
    }
}
