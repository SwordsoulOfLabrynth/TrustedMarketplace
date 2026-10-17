using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using TrustedMarketplace.Application.Common.Interfaces;

namespace TrustedMarketplace.Infrastructure.Storage;

public class LocalFileStorageService : IFileStorageService
{
    private readonly string _privateStorageRoot;
    private readonly string _productImageStorageRoot;
    private readonly ILogger<LocalFileStorageService> _logger;

    public LocalFileStorageService(
        IConfiguration configuration,
        ILogger<LocalFileStorageService> logger)
    {
        _logger = logger;
        _privateStorageRoot = configuration["Storage:LocalPrivateRoot"] ?? "./storage/private_evidence";
        _productImageStorageRoot = configuration["Storage:LocalProductImageRoot"]
            ?? configuration["Storage:LocalPublicRoot"]
            ?? "./storage/public_media";

        if (!Directory.Exists(_privateStorageRoot))
        {
            Directory.CreateDirectory(_privateStorageRoot);
        }

        if (!Directory.Exists(_productImageStorageRoot))
        {
            Directory.CreateDirectory(_productImageStorageRoot);
        }

        EnsureSeedAssetsCopied();
    }

    public async Task<string> SavePrivateFileAsync(
        Stream stream,
        string fileName,
        string contentType,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var subDirectory = Path.Combine(_privateStorageRoot, now.Year.ToString(), now.Month.ToString("D2"));

        if (!Directory.Exists(subDirectory))
        {
            Directory.CreateDirectory(subDirectory);
        }

        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        var uniqueFileName = $"{Guid.NewGuid():N}{extension}";
        var fullPath = Path.Combine(subDirectory, uniqueFileName);

        // Relative storage key (e.g., 2026/10/3fa85f64...png)
        var storageKey = $"{now.Year}/{now.Month:D2}/{uniqueFileName}".Replace('\\', '/');

        // Reset position to begin writing
        if (stream.CanSeek)
        {
            stream.Position = 0;
        }

        await using var fileStream = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None, 4096, true);
        await stream.CopyToAsync(fileStream, ct);

        _logger.LogInformation("Private evidence file saved successfully with storage key: {StorageKey}", storageKey);
        return storageKey;
    }

    private static bool IsInvalidStorageKey(string storageKey)
    {
        if (string.IsNullOrWhiteSpace(storageKey)) return true;
        if (storageKey.Contains("..")) return true;
        if (Path.IsPathRooted(storageKey)) return true;
        if (storageKey.StartsWith('/') || storageKey.StartsWith('\\')) return true;
        return false;
    }

    public Task<Stream?> GetPrivateFileAsync(string storageKey, CancellationToken ct = default)
    {
        // Prevent path traversal and rooted paths
        if (IsInvalidStorageKey(storageKey))
        {
            _logger.LogWarning("Potential path traversal or invalid storageKey detected in private storageKey: {StorageKey}", storageKey);
            return Task.FromResult<Stream?>(null);
        }

        var normalizedKey = storageKey.TrimStart('/', '\\').Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.GetFullPath(Path.Combine(_privateStorageRoot, normalizedKey));

        // Ensure full path stays within private root
        var normalizedRoot = Path.GetFullPath(_privateStorageRoot);
        if (!fullPath.StartsWith(normalizedRoot, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Resolved path '{FullPath}' is outside private storage root '{Root}'", fullPath, normalizedRoot);
            return Task.FromResult<Stream?>(null);
        }

        if (!File.Exists(fullPath))
        {
            return Task.FromResult<Stream?>(null);
        }

        Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult<Stream?>(stream);
    }

    public Task DeletePrivateFileAsync(string storageKey, CancellationToken ct = default)
    {
        if (IsInvalidStorageKey(storageKey))
        {
            return Task.CompletedTask;
        }

        var normalizedKey = storageKey.TrimStart('/', '\\').Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.GetFullPath(Path.Combine(_privateStorageRoot, normalizedKey));
        var normalizedRoot = Path.GetFullPath(_privateStorageRoot);

        if (fullPath.StartsWith(normalizedRoot, StringComparison.OrdinalIgnoreCase) && File.Exists(fullPath))
        {
            File.Delete(fullPath);
            _logger.LogInformation("Deleted private evidence file: {StorageKey}", storageKey);
        }

        return Task.CompletedTask;
    }

    public async Task<string> SaveProductImageAsync(
        Stream stream,
        string fileName,
        string contentType,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var subDirectory = Path.Combine(_productImageStorageRoot, "products", now.Year.ToString(), now.Month.ToString("D2"));

        if (!Directory.Exists(subDirectory))
        {
            Directory.CreateDirectory(subDirectory);
        }

        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        var uniqueFileName = $"{Guid.NewGuid():N}{extension}";
        var fullPath = Path.Combine(subDirectory, uniqueFileName);

        // Relative storage key (e.g., products/2026/10/3fa85f64...webp)
        var storageKey = $"products/{now.Year}/{now.Month:D2}/{uniqueFileName}".Replace('\\', '/');

        // Prevent path traversal
        var normalizedRoot = Path.GetFullPath(_productImageStorageRoot);
        var fullNormalizedPath = Path.GetFullPath(fullPath);
        if (!fullNormalizedPath.StartsWith(normalizedRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Product image path is outside the allowed storage root.");
        }

        if (stream.CanSeek)
        {
            stream.Position = 0;
        }

        await using var fileStream = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None, 4096, true);
        await stream.CopyToAsync(fileStream, ct);

        _logger.LogInformation("Product image file saved successfully with storage key: {StorageKey}", storageKey);
        return storageKey;
    }

    public Task<Stream?> GetProductImageAsync(string storageKey, CancellationToken ct = default)
    {
        if (IsInvalidStorageKey(storageKey))
        {
            _logger.LogWarning("Potential path traversal or invalid storageKey detected in product image storageKey: {StorageKey}", storageKey);
            return Task.FromResult<Stream?>(null);
        }

        var normalizedKey = storageKey.TrimStart('/', '\\').Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.GetFullPath(Path.Combine(_productImageStorageRoot, normalizedKey));

        var normalizedRoot = Path.GetFullPath(_productImageStorageRoot);
        if (!fullPath.StartsWith(normalizedRoot, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Resolved path '{FullPath}' is outside product image storage root '{Root}'", fullPath, normalizedRoot);
            return Task.FromResult<Stream?>(null);
        }

        if (File.Exists(fullPath))
        {
            Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
            return Task.FromResult<Stream?>(stream);
        }

        // Fallback: check if the file exists in bundled seed assets (e.g. after container restart)
        var fileName = Path.GetFileName(normalizedKey);
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "Assets", "SeedImages", fileName),
            Path.Combine(Directory.GetCurrentDirectory(), "Assets", "SeedImages", fileName),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "TrustedMarketplace.Infrastructure", "Assets", "SeedImages", fileName)
        };

        foreach (var candidate in candidates)
        {
            if (File.Exists(candidate))
            {
                try
                {
                    var targetDir = Path.GetDirectoryName(fullPath);
                    if (!string.IsNullOrEmpty(targetDir) && !Directory.Exists(targetDir))
                    {
                        Directory.CreateDirectory(targetDir);
                    }
                    File.Copy(candidate, fullPath, overwrite: true);
                    _logger.LogInformation("Restored missing product image {StorageKey} from bundled seed assets.", storageKey);
                    Stream restoredStream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
                    return Task.FromResult<Stream?>(restoredStream);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to cache seed asset to disk; serving directly from bundled path: {Path}", candidate);
                    Stream directStream = new FileStream(candidate, FileMode.Open, FileAccess.Read, FileShare.Read);
                    return Task.FromResult<Stream?>(directStream);
                }
            }
        }

        return Task.FromResult<Stream?>(null);
    }

    private void EnsureSeedAssetsCopied()
    {
        try
        {
            var candidates = new[]
            {
                Path.Combine(AppContext.BaseDirectory, "Assets", "SeedImages"),
                Path.Combine(Directory.GetCurrentDirectory(), "Assets", "SeedImages"),
                Path.Combine(Directory.GetCurrentDirectory(), "..", "TrustedMarketplace.Infrastructure", "Assets", "SeedImages"),
                Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "src", "TrustedMarketplace.Infrastructure", "Assets", "SeedImages")
            };

            string? seedDir = null;
            foreach (var candidate in candidates)
            {
                if (Directory.Exists(candidate))
                {
                    seedDir = Path.GetFullPath(candidate);
                    break;
                }
            }

            if (seedDir == null)
            {
                return;
            }

            var files = Directory.GetFiles(seedDir);
            var seedDestDir = Path.Combine(_productImageStorageRoot, "products", "seed");
            if (!Directory.Exists(seedDestDir))
            {
                Directory.CreateDirectory(seedDestDir);
            }

            foreach (var file in files)
            {
                var fileName = Path.GetFileName(file);
                var seedDest = Path.Combine(seedDestDir, fileName);
                if (!File.Exists(seedDest))
                {
                    File.Copy(file, seedDest, overwrite: false);
                }

                // If this is a guid-keyed image (e.g. production keys), also ensure it exists in products/2026/10
                var nameWithoutExt = Path.GetFileNameWithoutExtension(fileName);
                if (nameWithoutExt.Length == 32 || string.Equals(fileName, "98a37d9b0f4049e4be163005afaa697c.jpg", StringComparison.OrdinalIgnoreCase))
                {
                    var prod2026Dir = Path.Combine(_productImageStorageRoot, "products", "2026", "10");
                    if (!Directory.Exists(prod2026Dir))
                    {
                        Directory.CreateDirectory(prod2026Dir);
                    }
                    var prod2026Dest = Path.Combine(prod2026Dir, fileName);
                    if (!File.Exists(prod2026Dest))
                    {
                        File.Copy(file, prod2026Dest, overwrite: false);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to copy seed assets into product image storage root.");
        }
    }

    public Task DeleteProductImageAsync(string storageKey, CancellationToken ct = default)
    {
        if (IsInvalidStorageKey(storageKey))
        {
            return Task.CompletedTask;
        }

        var normalizedKey = storageKey.TrimStart('/', '\\').Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.GetFullPath(Path.Combine(_productImageStorageRoot, normalizedKey));
        var normalizedRoot = Path.GetFullPath(_productImageStorageRoot);

        if (fullPath.StartsWith(normalizedRoot, StringComparison.OrdinalIgnoreCase) && File.Exists(fullPath))
        {
            File.Delete(fullPath);
            _logger.LogInformation("Deleted product image file: {StorageKey}", storageKey);
        }

        return Task.CompletedTask;
    }
}
