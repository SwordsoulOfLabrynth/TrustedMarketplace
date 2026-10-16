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

        if (!File.Exists(fullPath))
        {
            return Task.FromResult<Stream?>(null);
        }

        Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult<Stream?>(stream);
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
