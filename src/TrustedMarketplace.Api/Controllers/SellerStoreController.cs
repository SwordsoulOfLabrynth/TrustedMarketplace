using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Api.Authorization;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Stores;
using TrustedMarketplace.Application.Stores.Dtos;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
[Route("api/v1/seller/store")]
[Authorize(Policy = AuthorizationPolicies.RequireActiveUser)]
public class SellerStoreController : ControllerBase
{
    private readonly ISellerStoreService _storeService;

    public SellerStoreController(ISellerStoreService storeService)
    {
        _storeService = storeService;
    }

    /// <summary>
    /// Retrieves current authenticated seller's own store profile.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(StoreProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMyStore(CancellationToken ct)
    {
        var sellerId = GetCurrentUserId();
        var store = await _storeService.GetMyStoreAsync(sellerId, ct);
        return Ok(store);
    }

    /// <summary>
    /// Updates current authenticated seller's store profile.
    /// If StoreName is changed, VerificationStatus automatically shifts to PendingReverification (SEC-04).
    /// </summary>
    [HttpPut]
    [ProducesResponseType(typeof(StoreProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateMyStore(
        [FromBody] UpdateStoreProfileRequest request,
        CancellationToken ct)
    {
        var sellerId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString("N");

        var updatedStore = await _storeService.UpdateMyStoreAsync(sellerId, request, correlationId, ct);
        return Ok(updatedStore);
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
