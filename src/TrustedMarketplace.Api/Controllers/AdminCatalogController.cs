using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrustedMarketplace.Api.Authorization;
using TrustedMarketplace.Application.Catalog;
using TrustedMarketplace.Application.Search;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
[Route("api/v1/admin/catalog")]
[Authorize(Policy = AuthorizationPolicies.RequireAdmin)]
public class AdminCatalogController : ControllerBase
{
    private readonly ICatalogService _catalogService;
    private readonly ISemanticSearchService _semanticSearchService;
    private readonly AppDbContext _dbContext;
    private readonly ILogger<AdminCatalogController> _logger;

    public AdminCatalogController(
        ICatalogService catalogService,
        ISemanticSearchService semanticSearchService,
        AppDbContext dbContext,
        ILogger<AdminCatalogController> logger)
    {
        _catalogService = catalogService;
        _semanticSearchService = semanticSearchService;
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <summary>
    /// Returns the current semantic search configuration and indexing status (Admin only).
    /// </summary>
    [HttpGet("search-status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSearchStatus(CancellationToken ct = default)
    {
        var totalProducts = await _dbContext.Products.CountAsync(ct);
        var totalEmbeddings = await _dbContext.ProductEmbeddings.CountAsync(ct);

        return Ok(new
        {
            activeProvider = _semanticSearchService.ActiveProviderName,
            totalProducts,
            productsWithEmbeddings = totalEmbeddings,
            coveragePercentage = totalProducts > 0 ? (float)totalEmbeddings / totalProducts * 100f : 100f
        });
    }

    /// <summary>
    /// Executes a controlled backfill or forced re-indexing of product semantic embeddings (Admin only).
    /// </summary>
    [HttpPost("reindex-embeddings")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ReindexEmbeddings(
        [FromQuery] bool force = false,
        CancellationToken ct = default)
    {
        _logger.LogInformation("Admin initiated product embeddings reindex (force={Force})", force);
        var indexedCount = await _catalogService.ReindexProductEmbeddingsAsync(force, ct);

        return Ok(new
        {
            indexedCount,
            force,
            activeProvider = _semanticSearchService.ActiveProviderName,
            message = $"Successfully processed {indexedCount} product embeddings."
        });
    }

    /// <summary>
    /// Safely and idempotently seeds the sample catalog products and distinct demo sellers (Admin only).
    /// Strictly idempotent: never overwrites or wipes existing products or sellers.
    /// </summary>
    [HttpPost("seed-demo-data")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> SeedDemoData(CancellationToken ct = default)
    {
        _logger.LogInformation("Admin requested idempotent demo catalog seeding.");
        await DemoDataSeeder.SeedDemoDataAsync(
            HttpContext.RequestServices,
            HttpContext.RequestServices.GetRequiredService<IConfiguration>(),
            _logger,
            isDevelopment: true,
            force: true);

        await _catalogService.EnsureProductEmbeddingsAsync(ct);

        var totalProducts = await _dbContext.Products.CountAsync(ct);
        return Ok(new
        {
            message = "Idempotent demo catalog seed executed successfully.",
            totalProducts
        });
    }
}
