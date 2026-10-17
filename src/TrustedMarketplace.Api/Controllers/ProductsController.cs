using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Application.Catalog;
using TrustedMarketplace.Application.Catalog.Dtos;
using TrustedMarketplace.Application.Common.Exceptions;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
[Route("api/v1/products")]
public class ProductsController : ControllerBase
{
    private readonly ICatalogService _catalogService;

    public ProductsController(ICatalogService catalogService)
    {
        _catalogService = catalogService;
    }

    /// <summary>
    /// Searches published product listings with filtering by keyword, category, price bounds, and pagination.
    /// Draft and archived listings are hidden (T-12).
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PagedResult<ProductDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SearchProducts(
        [FromQuery] string? keyword,
        [FromQuery] Guid? categoryId,
        [FromQuery] decimal? minPrice,
        [FromQuery] decimal? maxPrice,
        [FromQuery] string? sortBy,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var query = new ProductSearchQuery(keyword, categoryId, minPrice, maxPrice, page, pageSize, sortBy);
        var result = await _catalogService.SearchProductsAsync(query, ct);
        return Ok(result);
    }

    /// <summary>
    /// Retrieves a product by ID.
    /// Accessible anonymously if published; draft/archived accessible only by the owner seller.
    /// </summary>
    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ProductDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProductById(Guid id, CancellationToken ct)
    {
        Guid? callerUserId = null;
        var rawId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (Guid.TryParse(rawId, out var parsedId))
        {
            callerUserId = parsedId;
        }

        var product = await _catalogService.GetProductByIdAsync(id, callerUserId, ct);
        if (product == null)
        {
            throw new NotFoundException($"Product with ID '{id}' was not found.");
        }

        return Ok(product);
    }

    /// <summary>
    /// Retrieves all image metadata for a product.
    /// Published listings accessible anonymously; draft/archived accessible only by the owner seller.
    /// </summary>
    [HttpGet("{id:guid}/images")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<ProductImageDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProductImages(Guid id, CancellationToken ct)
    {
        var callerUserId = GetCallerUserId();
        var images = await _catalogService.GetProductImagesAsync(id, callerUserId, ct);
        return Ok(images);
    }

    /// <summary>
    /// Retrieves a single image metadata for a product.
    /// </summary>
    [HttpGet("{id:guid}/images/{imageId:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ProductImageDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProductImage(Guid id, Guid imageId, CancellationToken ct)
    {
        var callerUserId = GetCallerUserId();
        var images = await _catalogService.GetProductImagesAsync(id, callerUserId, ct);
        var image = images.FirstOrDefault(i => i.Id == imageId);
        if (image == null)
        {
            throw new NotFoundException($"Image with ID '{imageId}' was not found on product '{id}'.");
        }

        return Ok(image);
    }

    /// <summary>
    /// Safely serves the approved binary product image content with caching headers and strict Content-Type enforcement.
    /// Never exposes filesystem paths and prevents path traversal through GUID route constraints.
    /// </summary>
    [HttpGet("{id:guid}/images/{imageId:guid}/content")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProductImageContent(Guid id, Guid imageId, CancellationToken ct)
    {
        var callerUserId = GetCallerUserId();
        var (stream, contentType, fileName, isPublished) = await _catalogService.GetProductImageContentAsync(id, imageId, callerUserId, ct);
 
         if (isPublished)
         {
             Response.Headers.CacheControl = "public, max-age=604800, immutable";
         }
         else
         {
             Response.Headers.CacheControl = "private, no-cache, no-store, must-revalidate";
             Response.Headers.Pragma = "no-cache";
         }
 
         Response.Headers["X-Content-Type-Options"] = "nosniff";
 
         return File(stream, contentType);
     }

    private Guid? GetCallerUserId()
    {
        var rawId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(rawId, out var parsedId) ? parsedId : null;
    }
}
