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
    /// Lists all available subscription plans, fees, and listing quotas (Free, Standard, Premium).
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
    /// Retrieves current seller's active subscription tier and listing capacity quota.
    /// </summary>
    [HttpGet("api/v1/seller/subscription")]
    [Authorize(Policy = AuthorizationPolicies.RequireActiveUser)]
    [ProducesResponseType(typeof(SellerQuotaDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMySubscriptionQuota(CancellationToken ct)
    {
        var sellerUserId = GetCurrentUserId();
        var quota = await _subscriptionService.GetSellerQuotaAsync(sellerUserId, ct);
        return Ok(quota);
    }

    /// <summary>
    /// Retrieves current seller's latest subscription record (active plan or pending verification submission).
    /// </summary>
    [HttpGet("api/v1/seller/subscription/status")]
    [Authorize(Policy = AuthorizationPolicies.RequireActiveUser)]
    [ProducesResponseType(typeof(SellerSubscriptionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> GetMySubscriptionStatus(CancellationToken ct)
    {
        var sellerUserId = GetCurrentUserId();
        var sub = await _subscriptionService.GetSellerSubscriptionAsync(sellerUserId, ct);
        if (sub == null)
            return NoContent();

        return Ok(sub);
    }

    /// <summary>
    /// Submits a subscription plan selection and payment transfer reference (KBZPay / WavePay).
    /// Creates a record in 'PendingVerification' status requiring administrator verification.
    /// </summary>
    [HttpPost("api/v1/seller/subscription/subscribe")]
    [Authorize(Policy = AuthorizationPolicies.RequireActiveUser)]
    [ProducesResponseType(typeof(SellerSubscriptionDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SubscribeToPlan(
        [FromBody] SubmitSubscriptionPaymentRequest request,
        CancellationToken ct)
    {
        var sellerUserId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString("N");

        var result = await _subscriptionService.SubmitSubscriptionPaymentAsync(
            sellerUserId,
            request,
            correlationId,
            ct);

        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>
    /// Retrieves configured platform payment channels (KBZPay, WavePay) including payment QR and accounts.
    /// </summary>
    [HttpGet("api/v1/platform/payment-methods")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<PlatformPaymentMethodDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPlatformPaymentMethods(CancellationToken ct)
    {
        var methods = await _subscriptionService.GetPlatformPaymentMethodsAsync(ct);
        return Ok(methods);
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
