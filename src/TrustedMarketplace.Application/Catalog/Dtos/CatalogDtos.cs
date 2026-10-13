namespace TrustedMarketplace.Application.Catalog.Dtos;

public record CategoryDto(
    Guid Id,
    string Name,
    string Slug,
    Guid? ParentCategoryId
);

public record ProductImageDto(
    Guid Id,
    string StorageKey,
    int SortOrder
);

public record ProductDto(
    Guid Id,
    Guid SellerUserId,
    Guid SellerProfileId,
    string StoreName,
    Guid CategoryId,
    string CategoryName,
    string Title,
    string Description,
    decimal PriceAmount,
    string CurrencyCode,
    string Condition,
    string Status,
    DateTime CreatedAtUtc,
    List<ProductImageDto> Images
);

public record CreateProductRequest(
    Guid CategoryId,
    string Title,
    string Description,
    decimal PriceAmount,
    string Condition,
    string CurrencyCode = "MMK"
);

public record UpdateProductRequest(
    Guid CategoryId,
    string Title,
    string Description,
    decimal PriceAmount,
    string Condition
);

public record ProductSearchQuery(
    string? Keyword = null,
    Guid? CategoryId = null,
    decimal? MinPrice = null,
    decimal? MaxPrice = null,
    int Page = 1,
    int PageSize = 20
);

public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount
);
