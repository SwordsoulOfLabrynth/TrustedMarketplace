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
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var query = new ProductSearchQuery(keyword, categoryId, minPrice, maxPrice, page, pageSize);
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
}
