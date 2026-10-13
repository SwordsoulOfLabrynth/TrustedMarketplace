namespace TrustedMarketplace.Application.Common.Interfaces;

public interface IFileStorageService
{
    Task<string> SavePrivateFileAsync(Stream stream, string fileName, string contentType, CancellationToken ct = default);
    Task<Stream?> GetPrivateFileAsync(string storageKey, CancellationToken ct = default);
    Task DeletePrivateFileAsync(string storageKey, CancellationToken ct = default);
}
