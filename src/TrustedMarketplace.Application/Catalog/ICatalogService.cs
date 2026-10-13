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
}
