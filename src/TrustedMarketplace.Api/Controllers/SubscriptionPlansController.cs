using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Api.Authorization;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Subscriptions;
using TrustedMarketplace.Application.Subscriptions.Dtos;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
public class SubscriptionPlansController : ControllerBase
{
    private readonly ISubscriptionService _subscriptionService;

    public SubscriptionPlansController(ISubscriptionService subscriptionService)
    {
        _subscriptionService = subscriptionService;
    }

    /// <summary>
    /// Lists all available mock subscription tiers and listing limits.
    /// Publicly accessible.
    /// </summary>
    [HttpGet("api/v1/subscription-plans")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<SubscriptionPlanDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPlans(CancellationToken ct)
    {
        var plans = await _subscriptionService.GetActivePlansAsync(ct);
        return Ok(plans);
    }

    /// <summary>
    /// Retrieves current seller's active subscription tier and listing capacity.
    /// </summary>
    [HttpGet("api/v1/seller/subscription")]
    [Authorize(Policy = AuthorizationPolicies.RequireActiveUser)]
    [ProducesResponseType(typeof(SellerQuotaDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMySubscription(CancellationToken ct)
    {
        var sellerUserId = GetCurrentUserId();
        var quota = await _subscriptionService.GetSellerQuotaAsync(sellerUserId, ct);
        return Ok(quota);
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
