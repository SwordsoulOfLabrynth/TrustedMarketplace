using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrustedMarketplace.Application.Catalog;
using TrustedMarketplace.Application.Catalog.Dtos;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Common.Interfaces;
using TrustedMarketplace.Application.Common.Security;
using TrustedMarketplace.Application.Subscriptions;
using TrustedMarketplace.Domain.Catalog;
using TrustedMarketplace.Domain.Common.Exceptions;
using TrustedMarketplace.Domain.Stores;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.Infrastructure.Catalog;

public class CatalogService : ICatalogService
{
    private readonly AppDbContext _dbContext;
    private readonly ISubscriptionService _subscriptionService;
    private readonly IFileStorageService _fileStorageService;
    private readonly ILogger<CatalogService> _logger;

    public CatalogService(
        AppDbContext dbContext,
        ISubscriptionService subscriptionService,
        IFileStorageService fileStorageService,
        ILogger<CatalogService> logger)
    {
        _dbContext = dbContext;
        _subscriptionService = subscriptionService;
        _fileStorageService = fileStorageService;
        _logger = logger;
    }

    public async Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(CancellationToken ct = default)
    {
        var categories = await _dbContext.Categories
            .AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .ToListAsync(ct);

        return categories.Select(c => new CategoryDto(c.Id, c.Name, c.Slug, c.ParentCategoryId)).ToList();
    }

    public async Task<PagedResult<ProductDto>> SearchProductsAsync(ProductSearchQuery query, CancellationToken ct = default)
    {
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var dbQuery = _dbContext.Products
            .Include(p => p.SellerProfile)
            .Include(p => p.Category)
            .Include(p => p.Images)
            .AsNoTracking()
            .Where(p => p.Status == ProductStatus.Published);

        if (query.CategoryId.HasValue)
        {
            dbQuery = dbQuery.Where(p => p.CategoryId == query.CategoryId.Value);
        }

        if (query.MinPrice.HasValue)
        {
            dbQuery = dbQuery.Where(p => p.PriceAmount >= query.MinPrice.Value);
        }

        if (query.MaxPrice.HasValue)
        {
            dbQuery = dbQuery.Where(p => p.PriceAmount <= query.MaxPrice.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var kw = query.Keyword.Trim().ToLower();
            dbQuery = dbQuery.Where(p => p.Title.ToLower().Contains(kw) || p.Description.ToLower().Contains(kw));
        }

        var totalCount = await dbQuery.CountAsync(ct);

        var items = await dbQuery
            .OrderByDescending(p => p.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<ProductDto>(
            items.Select(ToDto).ToList(),
            page,
            pageSize,
            totalCount);
    }

    public async Task<ProductDto?> GetProductByIdAsync(Guid productId, Guid? callerUserId = null, CancellationToken ct = default)
    {
        var product = await _dbContext.Products
            .Include(p => p.SellerProfile)
            .Include(p => p.Category)
            .Include(p => p.Images)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == productId, ct);

        if (product == null)
            return null;

        // Draft and archived products are hidden from public, accessible only by the owner seller
        if (product.Status != ProductStatus.Published)
        {
            if (!callerUserId.HasValue || product.SellerUserId != callerUserId.Value)
            {
                return null;
            }
        }

        return ToDto(product);
    }

    public async Task<ProductDto> CreateProductAsync(Guid sellerUserId, CreateProductRequest request, CancellationToken ct = default)
    {
        var store = await _dbContext.SellerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.SellerUserId == sellerUserId, ct);

        if (store == null)
        {
            throw new ForbiddenException("STORE_NOT_FOUND", "Only sellers with an approved store profile can create products.");
        }

        var category = await _dbContext.Categories
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == request.CategoryId && c.IsActive, ct);

        if (category == null)
        {
            throw new NotFoundException($"Category '{request.CategoryId}' was not found or is inactive.");
        }

        if (!Enum.TryParse<ProductCondition>(request.Condition, true, out var condition))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Condition"] = new[] { "Condition must be 'New', 'LikeNew', or 'Used'." }
            });
        }

        var product = new Product(
            sellerUserId,
            store.Id,
            category.Id,
            request.Title,
            request.Description,
            request.PriceAmount,
            condition,
            request.CurrencyCode);

        _dbContext.Products.Add(product);
        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation("Created draft product {ProductId} by seller {SellerId}", product.Id, sellerUserId);

        return new ProductDto(
            product.Id,
            product.SellerUserId,
            product.SellerProfileId,
            store.StoreName,
            category.Id,
            category.Name,
            product.Title,
            product.Description,
            product.PriceAmount,
            product.CurrencyCode,
            product.Condition.ToString(),
            product.Status.ToString(),
            product.CreatedAtUtc,
            new List<ProductImageDto>());
    }

    public async Task<ProductDto> UpdateProductAsync(Guid sellerUserId, Guid productId, UpdateProductRequest request, CancellationToken ct = default)
    {
        var product = await _dbContext.Products
            .Include(p => p.SellerProfile)
            .Include(p => p.Category)
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == productId, ct);

        if (product == null)
        {
            throw new NotFoundException($"Product with ID '{productId}' was not found.");
        }

        if (product.SellerUserId != sellerUserId)
        {
            throw new ForbiddenException("FORBIDDEN", "You do not have permission to edit this product (SEC-05).");
        }

        var category = await _dbContext.Categories
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == request.CategoryId && c.IsActive, ct);

        if (category == null)
        {
            throw new NotFoundException($"Category '{request.CategoryId}' was not found or is inactive.");
        }

        if (!Enum.TryParse<ProductCondition>(request.Condition, true, out var condition))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Condition"] = new[] { "Condition must be 'New', 'LikeNew', or 'Used'." }
            });
        }

        product.Update(request.Title, request.Description, request.PriceAmount, condition, category.Id);
        await _dbContext.SaveChangesAsync(ct);

        return ToDto(product);
    }

    public async Task<ProductDto> PublishProductAsync(Guid sellerUserId, Guid productId, CancellationToken ct = default)
    {
        var product = await _dbContext.Products
            .Include(p => p.SellerProfile)
            .Include(p => p.Category)
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == productId, ct);

        if (product == null)
        {
            throw new NotFoundException($"Product with ID '{productId}' was not found.");
        }

        if (product.SellerUserId != sellerUserId)
        {
            throw new ForbiddenException("FORBIDDEN", "You do not have permission to publish this product (SEC-05).");
        }

        // SEC-04: Only Verified sellers can publish listings
        if (product.SellerProfile == null || product.SellerProfile.VerificationStatus != SellerVerificationStatus.Verified)
        {
            throw new ForbiddenException(
                "SELLER_NOT_VERIFIED",
                "Unapproved or pending re-verification sellers cannot publish products (SEC-04).");
        }

        // Subscription listing quota enforcement (T-11, T-17)
        var quota = await _subscriptionService.GetSellerQuotaAsync(sellerUserId, ct);
        if (!quota.CanPublishMore)
        {
            throw new ConflictException(
                $"Active listing quota reached for plan '{quota.PlanName}' ({quota.CurrentActiveListings}/{quota.MaxActiveListings}). Upgrade subscription to publish more listings.");
        }

        product.Publish();
        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation("Product {ProductId} published by seller {SellerId}", productId, sellerUserId);

        return ToDto(product);
    }

    public async Task<ProductDto> ArchiveProductAsync(Guid sellerUserId, Guid productId, CancellationToken ct = default)
    {
        var product = await _dbContext.Products
            .Include(p => p.SellerProfile)
            .Include(p => p.Category)
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == productId, ct);

        if (product == null)
        {
            throw new NotFoundException($"Product with ID '{productId}' was not found.");
        }

        if (product.SellerUserId != sellerUserId)
        {
            throw new ForbiddenException("FORBIDDEN", "You do not have permission to archive this product (SEC-05).");
        }

        product.Archive();
        await _dbContext.SaveChangesAsync(ct);

        return ToDto(product);
    }

    public async Task<IReadOnlyList<ProductDto>> GetSellerProductsAsync(Guid sellerUserId, CancellationToken ct = default)
    {
        var products = await _dbContext.Products
            .Include(p => p.SellerProfile)
            .Include(p => p.Category)
            .Include(p => p.Images)
            .AsNoTracking()
            .Where(p => p.SellerUserId == sellerUserId)
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync(ct);

        return products.Select(ToDto).ToList();
    }

    public async Task<ProductImageDto> UploadProductImageAsync(
        Guid sellerUserId,
        Guid productId,
        Stream fileStream,
        string fileName,
        string contentType,
        long fileLength,
        CancellationToken ct = default)
    {
        var product = await _dbContext.Products
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == productId, ct);

        if (product == null)
        {
            throw new NotFoundException($"Product with ID '{productId}' was not found.");
        }

        if (product.SellerUserId != sellerUserId)
        {
            throw new ForbiddenException("FORBIDDEN", "You do not have permission to manage images for this product (SEC-05).");
        }

        if (product.Status == ProductStatus.Archived)
        {
            throw new DomainException("Cannot upload images to an archived product.");
        }

        if (product.Images.Count >= Product.MaxImagesPerProduct)
        {
            throw new DomainException($"Cannot upload more than {Product.MaxImagesPerProduct} images per product.");
        }

        var (isValid, detectedMimeType, errorMessage) = FileValidationService.ValidateProductImage(
            fileStream,
            fileName,
            contentType,
            fileLength);

        if (!isValid)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["File"] = new[] { errorMessage ?? "Invalid image format or size." }
            });
        }

        // Save safely to dedicated product image directory
        var storageKey = await _fileStorageService.SaveProductImageAsync(
            fileStream,
            fileName,
            detectedMimeType,
            ct);

        var image = product.AddImage(
            storageKey,
            sortOrder: -1,
            originalFileName: fileName,
            mimeType: detectedMimeType,
            fileSizeBytes: fileLength);

        _dbContext.ProductImages.Add(image);
        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Uploaded product image {ImageId} for product {ProductId} by seller {SellerId}",
            image.Id,
            productId,
            sellerUserId);

        return ToImageDto(product.Id, image);
    }

    public async Task DeleteProductImageAsync(
        Guid sellerUserId,
        Guid productId,
        Guid imageId,
        CancellationToken ct = default)
    {
        var product = await _dbContext.Products
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == productId, ct);

        if (product == null)
        {
            throw new NotFoundException($"Product with ID '{productId}' was not found.");
        }

        if (product.SellerUserId != sellerUserId)
        {
            throw new ForbiddenException("FORBIDDEN", "You do not have permission to delete images from this product (SEC-05).");
        }

        if (product.Status == ProductStatus.Archived)
        {
            throw new DomainException("Cannot modify an archived product.");
        }

        var removedImage = product.RemoveImage(imageId);
        _dbContext.ProductImages.Remove(removedImage);

        await _dbContext.SaveChangesAsync(ct);

        // Delete physical file safely
        await _fileStorageService.DeleteProductImageAsync(removedImage.StorageKey, ct);

        _logger.LogInformation(
            "Deleted product image {ImageId} from product {ProductId} by seller {SellerId}",
            imageId,
            productId,
            sellerUserId);
    }

    public async Task<ProductImageDto> SetPrimaryProductImageAsync(
        Guid sellerUserId,
        Guid productId,
        Guid imageId,
        CancellationToken ct = default)
    {
        var product = await _dbContext.Products
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == productId, ct);

        if (product == null)
        {
            throw new NotFoundException($"Product with ID '{productId}' was not found.");
        }

        if (product.SellerUserId != sellerUserId)
        {
            throw new ForbiddenException("FORBIDDEN", "You do not have permission to manage images for this product (SEC-05).");
        }

        if (product.Status == ProductStatus.Archived)
        {
            throw new DomainException("Cannot modify an archived product.");
        }

        var primaryImage = product.SetPrimaryImage(imageId);
        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Set product image {ImageId} as primary for product {ProductId}",
            imageId,
            productId);

        return ToImageDto(product.Id, primaryImage);
    }

    public async Task<IReadOnlyList<ProductImageDto>> ReorderProductImagesAsync(
        Guid sellerUserId,
        Guid productId,
        IReadOnlyList<Guid> imageIds,
        CancellationToken ct = default)
    {
        var product = await _dbContext.Products
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == productId, ct);

        if (product == null)
        {
            throw new NotFoundException($"Product with ID '{productId}' was not found.");
        }

        if (product.SellerUserId != sellerUserId)
        {
            throw new ForbiddenException("FORBIDDEN", "You do not have permission to reorder images for this product (SEC-05).");
        }

        if (product.Status == ProductStatus.Archived)
        {
            throw new DomainException("Cannot modify an archived product.");
        }

        product.ReorderImages(imageIds);
        await _dbContext.SaveChangesAsync(ct);

        return product.Images
            .OrderBy(i => i.SortOrder)
            .Select(i => ToImageDto(product.Id, i))
            .ToList();
    }

    public async Task<IReadOnlyList<ProductImageDto>> GetProductImagesAsync(
        Guid productId,
        Guid? callerUserId = null,
        CancellationToken ct = default)
    {
        var product = await _dbContext.Products
            .Include(p => p.Images)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == productId, ct);

        if (product == null)
        {
            throw new NotFoundException($"Product with ID '{productId}' was not found.");
        }

        if (product.Status != ProductStatus.Published)
        {
            if (!callerUserId.HasValue || product.SellerUserId != callerUserId.Value)
            {
                throw new NotFoundException($"Product with ID '{productId}' was not found.");
            }
        }

        return product.Images
            .OrderBy(i => i.SortOrder)
            .Select(i => ToImageDto(product.Id, i))
            .ToList();
    }

    public async Task<(Stream Stream, string ContentType, string FileName, bool IsPublished)> GetProductImageContentAsync(
        Guid productId,
        Guid imageId,
        Guid? callerUserId = null,
        CancellationToken ct = default)
    {
        var product = await _dbContext.Products
            .Include(p => p.Images)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == productId, ct);

        if (product == null)
        {
            throw new NotFoundException($"Product with ID '{productId}' was not found.");
        }

        if (product.Status != ProductStatus.Published)
        {
            if (!callerUserId.HasValue || product.SellerUserId != callerUserId.Value)
            {
                throw new NotFoundException($"Product with ID '{productId}' was not found.");
            }
        }

        var image = product.Images.FirstOrDefault(i => i.Id == imageId);
        if (image == null)
        {
            throw new NotFoundException($"Image with ID '{imageId}' was not found on product '{productId}'.");
        }

        var stream = await _fileStorageService.GetProductImageAsync(image.StorageKey, ct);
        if (stream == null)
        {
            _logger.LogWarning("Product image file not found on disk for storage key {Key}", image.StorageKey);
            throw new NotFoundException("Image content file was not found on storage.");
        }

        var fileName = !string.IsNullOrWhiteSpace(image.OriginalFileName)
            ? image.OriginalFileName
            : Path.GetFileName(image.StorageKey);

        var isPublished = product.Status == ProductStatus.Published;
        return (stream, image.MimeType, fileName, isPublished);
    }

    private static ProductDto ToDto(Product p) =>
        new(
            p.Id,
            p.SellerUserId,
            p.SellerProfileId,
            p.SellerProfile?.StoreName ?? string.Empty,
            p.CategoryId,
            p.Category?.Name ?? string.Empty,
            p.Title,
            p.Description,
            p.PriceAmount,
            p.CurrencyCode,
            p.Condition.ToString(),
            p.Status.ToString(),
            p.CreatedAtUtc,
            p.Images
                .OrderBy(i => i.SortOrder)
                .Select(i => ToImageDto(p.Id, i))
                .ToList());

    private static ProductImageDto ToImageDto(Guid productId, ProductImage i) =>
        new(
            i.Id,
            i.StorageKey,
            i.SortOrder,
            i.IsPrimary,
            $"/api/v1/products/{productId}/images/{i.Id}/content",
            i.OriginalFileName,
            i.MimeType,
            i.FileSizeBytes);
}
