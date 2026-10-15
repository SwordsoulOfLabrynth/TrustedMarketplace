using TrustedMarketplace.Application.Catalog.Dtos;

namespace TrustedMarketplace.Application.Catalog;

public interface ICatalogService
{
    Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(CancellationToken ct = default);
    Task<PagedResult<ProductDto>> SearchProductsAsync(ProductSearchQuery query, CancellationToken ct = default);
    Task<ProductDto?> GetProductByIdAsync(Guid productId, Guid? callerUserId = null, CancellationToken ct = default);
    Task<ProductDto> CreateProductAsync(Guid sellerUserId, CreateProductRequest request, CancellationToken ct = default);
    Task<ProductDto> UpdateProductAsync(Guid sellerUserId, Guid productId, UpdateProductRequest request, CancellationToken ct = default);
    Task<ProductDto> PublishProductAsync(Guid sellerUserId, Guid productId, CancellationToken ct = default);
    Task<ProductDto> ArchiveProductAsync(Guid sellerUserId, Guid productId, CancellationToken ct = default);
    Task<IReadOnlyList<ProductDto>> GetSellerProductsAsync(Guid sellerUserId, CancellationToken ct = default);
    Task EnsureProductEmbeddingsAsync(CancellationToken ct = default);
    Task<int> ReindexProductEmbeddingsAsync(bool force = false, CancellationToken ct = default);

    Task<ProductImageDto> UploadProductImageAsync(
        Guid sellerUserId,
        Guid productId,
        Stream fileStream,
        string fileName,
        string contentType,
        long fileLength,
        CancellationToken ct = default);

    Task DeleteProductImageAsync(
        Guid sellerUserId,
        Guid productId,
        Guid imageId,
        CancellationToken ct = default);

    Task<ProductImageDto> SetPrimaryProductImageAsync(
        Guid sellerUserId,
        Guid productId,
        Guid imageId,
        CancellationToken ct = default);

    Task<IReadOnlyList<ProductImageDto>> ReorderProductImagesAsync(
        Guid sellerUserId,
        Guid productId,
        IReadOnlyList<Guid> imageIds,
        CancellationToken ct = default);

    Task<IReadOnlyList<ProductImageDto>> GetProductImagesAsync(
        Guid productId,
        Guid? callerUserId = null,
        CancellationToken ct = default);

    Task<(Stream Stream, string ContentType, string FileName, bool IsPublished)> GetProductImageContentAsync(
        Guid productId,
        Guid imageId,
        Guid? callerUserId = null,
        CancellationToken ct = default);
}
