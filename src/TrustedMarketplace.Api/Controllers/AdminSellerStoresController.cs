using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Api.Authorization;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Stores;
using TrustedMarketplace.Application.Stores.Dtos;
using TrustedMarketplace.Domain.Stores;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
[Route("api/v1/admin/seller-stores")]
[Authorize(Policy = AuthorizationPolicies.RequireAdmin)]
public class AdminSellerStoresController : ControllerBase
{
    private readonly ISellerStoreService _storeService;

    public AdminSellerStoresController(ISellerStoreService storeService)
    {
        _storeService = storeService;
    }

    /// <summary>
    /// Lists all seller store profiles, with optional filter by VerificationStatus (Admin only).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<StoreProfileDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStores(
        [FromQuery] SellerVerificationStatus? status,
        CancellationToken ct = default)
    {
        var stores = await _storeService.GetStoresForAdminAsync(status, ct);
        return Ok(stores);
    }

    /// <summary>
    /// Retrieves a specific store profile by store ID or seller user ID (Admin only).
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(StoreProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetStoreById(Guid id, CancellationToken ct = default)
    {
        var store = await _storeService.GetStoreBySellerIdAsync(id, ct);
        if (store == null)
        {
            return NotFound(new ProblemDetails
            {
                Title = "Not Found",
                Detail = $"Store with ID or Seller User ID '{id}' was not found."
            });
        }
        return Ok(store);
    }

    /// <summary>
    /// Processes an administrative re-verification decision (Approved, Rejected) for a store in PendingReverification (Admin only).
    /// </summary>
    [HttpPost("{id:guid}/decision")]
    [ProducesResponseType(typeof(StoreProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ProcessReverificationDecision(
        Guid id,
        [FromBody] AdminStoreReverificationRequest request,
        CancellationToken ct = default)
    {
        var adminId = GetCurrentAdminId();
        var correlationId = HttpContext.TraceIdentifier ?? Guid.NewGuid().ToString("N");

        var updatedStore = await _storeService.ProcessStoreReverificationDecisionAsync(
            id,
            adminId,
            request,
            correlationId,
            ct);

        return Ok(updatedStore);
    }

    /// <summary>
    /// Direct alias route to re-verify or reject a seller store by seller user ID (Admin only).
    /// </summary>
    [HttpPost("/api/v1/admin/sellers/{sellerId:guid}/re-verify")]
    [ProducesResponseType(typeof(StoreProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ReverifiySellerStore(
        Guid sellerId,
        [FromBody] AdminStoreReverificationRequest request,
        CancellationToken ct = default)
    {
        var adminId = GetCurrentAdminId();
        var correlationId = HttpContext.TraceIdentifier ?? Guid.NewGuid().ToString("N");

        var updatedStore = await _storeService.ProcessStoreReverificationDecisionAsync(
            sellerId,
            adminId,
            request,
            correlationId,
            ct);

        return Ok(updatedStore);
    }

    private Guid GetCurrentAdminId()
    {
        var rawId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(rawId) || !Guid.TryParse(rawId, out var adminId))
        {
            throw new UnauthorizedException("Authenticated admin identity could not be resolved.");
        }
        return adminId;
    }
}
