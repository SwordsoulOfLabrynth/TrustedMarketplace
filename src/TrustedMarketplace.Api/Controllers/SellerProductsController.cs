using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Api.Authorization;
using TrustedMarketplace.Application.Catalog;
using TrustedMarketplace.Application.Catalog.Dtos;
using TrustedMarketplace.Application.Common.Exceptions;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
[Route("api/v1/seller/products")]
[Authorize(Policy = AuthorizationPolicies.RequireActiveUser)]
public class SellerProductsController : ControllerBase
{
    private readonly ICatalogService _catalogService;

    public SellerProductsController(ICatalogService catalogService)
    {
        _catalogService = catalogService;
    }

    /// <summary>
    /// Creates a new product listing in Draft status.
    /// Only approved sellers can create products.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ProductDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateProduct([FromBody] CreateProductRequest request, CancellationToken ct)
    {
        var sellerUserId = GetCurrentUserId();
        var product = await _catalogService.CreateProductAsync(sellerUserId, request, ct);
        return StatusCode(StatusCodes.Status201Created, product);
    }

    /// <summary>
    /// Updates product details (title, description, price, condition, category).
    /// Enforces resource ownership (SEC-05: 403 Forbidden if not the product owner).
    /// </summary>
    [HttpPatch("{id:guid}")]
    [ProducesResponseType(typeof(ProductDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateProduct(Guid id, [FromBody] UpdateProductRequest request, CancellationToken ct)
    {
        var sellerUserId = GetCurrentUserId();
        var updated = await _catalogService.UpdateProductAsync(sellerUserId, id, request, ct);
        return Ok(updated);
    }

    /// <summary>
    /// Publishes a draft product.
    /// Enforces SEC-04 (Seller must be Verified) and subscription listing quota (T-11, T-17).
    /// </summary>
    [HttpPost("{id:guid}/publish")]
    [ProducesResponseType(typeof(ProductDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> PublishProduct(Guid id, CancellationToken ct)
    {
        var sellerUserId = GetCurrentUserId();
        var published = await _catalogService.PublishProductAsync(sellerUserId, id, ct);
        return Ok(published);
    }

    /// <summary>
    /// Archives a product listing.
    /// Archived products are removed from public discovery.
    /// </summary>
    [HttpPost("{id:guid}/archive")]
    [ProducesResponseType(typeof(ProductDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ArchiveProduct(Guid id, CancellationToken ct)
    {
        var sellerUserId = GetCurrentUserId();
        var archived = await _catalogService.ArchiveProductAsync(sellerUserId, id, ct);
        return Ok(archived);
    }

    /// <summary>
    /// Lists all products belonging to the current seller (Drafts, Published, Archived).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ProductDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyProducts(CancellationToken ct)
    {
        var sellerUserId = GetCurrentUserId();
        var products = await _catalogService.GetSellerProductsAsync(sellerUserId, ct);
        return Ok(products);
    }

    /// <summary>
    /// Uploads an image for an existing product listing.
    /// Enforces resource ownership (SEC-05), format allowlisting (JPEG, PNG, WebP), magic-byte validation, and max file limits.
    /// </summary>
    [HttpPost("{id:guid}/images")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ProductImageDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UploadProductImage(Guid id, IFormFile? file, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["file"] = new[] { "An image file must be provided." }
            });
        }

        var sellerUserId = GetCurrentUserId();
        await using var stream = file.OpenReadStream();

        var imageDto = await _catalogService.UploadProductImageAsync(
            sellerUserId,
            id,
            stream,
            file.FileName,
            file.ContentType,
            file.Length,
            ct);

        return StatusCode(StatusCodes.Status201Created, imageDto);
    }

    /// <summary>
    /// Removes a product image and its physical file.
    /// Enforces resource ownership (SEC-05).
    /// </summary>
    [HttpDelete("{id:guid}/images/{imageId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteProductImage(Guid id, Guid imageId, CancellationToken ct)
    {
        var sellerUserId = GetCurrentUserId();
        await _catalogService.DeleteProductImageAsync(sellerUserId, id, imageId, ct);
        return NoContent();
    }

    /// <summary>
    /// Sets an image as the primary cover image (SortOrder = 0) for the product.
    /// Enforces resource ownership (SEC-05).
    /// </summary>
    [HttpPut("{id:guid}/images/{imageId:guid}/primary")]
    [HttpPost("{id:guid}/images/{imageId:guid}/primary")]
    [ProducesResponseType(typeof(ProductImageDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetPrimaryProductImage(Guid id, Guid imageId, CancellationToken ct)
    {
        var sellerUserId = GetCurrentUserId();
        var primary = await _catalogService.SetPrimaryProductImageAsync(sellerUserId, id, imageId, ct);
        return Ok(primary);
    }

    /// <summary>
    /// Reorders product images.
    /// Enforces resource ownership (SEC-05).
    /// </summary>
    [HttpPut("{id:guid}/images/reorder")]
    [ProducesResponseType(typeof(IReadOnlyList<ProductImageDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReorderProductImages(Guid id, [FromBody] ReorderProductImagesRequest request, CancellationToken ct)
    {
        if (request == null || request.ImageIds == null || request.ImageIds.Count == 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["imageIds"] = new[] { "A list of image IDs is required for reordering." }
            });
        }

        var sellerUserId = GetCurrentUserId();
        var reordered = await _catalogService.ReorderProductImagesAsync(sellerUserId, id, request.ImageIds, ct);
        return Ok(reordered);
    }

    private Guid GetCurrentUserId()
    {
        var rawId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(rawId) || !Guid.TryParse(rawId, out var userId))
        {
            throw new UnauthorizedException("Authenticated caller identity could not be resolved.");
        }
        return userId;
    }
}
