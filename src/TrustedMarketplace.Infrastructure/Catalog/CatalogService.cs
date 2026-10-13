using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrustedMarketplace.Application.Catalog;
using TrustedMarketplace.Application.Catalog.Dtos;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Subscriptions;
using TrustedMarketplace.Domain.Catalog;
using TrustedMarketplace.Domain.Stores;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.Infrastructure.Catalog;

public class CatalogService : ICatalogService
{
    private readonly AppDbContext _dbContext;
    private readonly ISubscriptionService _subscriptionService;
    private readonly ILogger<CatalogService> _logger;

    public CatalogService(
        AppDbContext dbContext,
        ISubscriptionService subscriptionService,
        ILogger<CatalogService> logger)
    {
        _dbContext = dbContext;
        _subscriptionService = subscriptionService;
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
            p.Images.OrderBy(i => i.SortOrder).Select(i => new ProductImageDto(i.Id, i.StorageKey, i.SortOrder)).ToList());
}
