using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Api.Authorization;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Subscriptions;
using TrustedMarketplace.Application.Subscriptions.Dtos;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.RequireAdmin)]
public class AdminSubscriptionController : ControllerBase
{
    private readonly ISubscriptionService _subscriptionService;

    public AdminSubscriptionController(ISubscriptionService subscriptionService)
    {
        _subscriptionService = subscriptionService;
    }

    /// <summary>
    /// Lists all seller subscriptions with optional status filter (Admin only).
    /// Defaults to showing pending payment verification records first.
    /// </summary>
    [HttpGet("api/v1/admin/subscriptions")]
    [ProducesResponseType(typeof(IReadOnlyList<SellerSubscriptionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSubscriptions(
        [FromQuery] string? status,
        CancellationToken ct)
    {
        var subscriptions = await _subscriptionService.GetSubscriptionsForAdminAsync(status, ct);
        return Ok(subscriptions);
    }

    /// <summary>
    /// Verifies or rejects a pending subscription payment submission (Admin only).
    /// Approving activates the plan and updates listing capacity; rejecting logs an audit reason.
    /// </summary>
    [HttpPost("api/v1/admin/subscriptions/{id:guid}/verify")]
    [ProducesResponseType(typeof(SellerSubscriptionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> VerifySubscriptionPayment(
        Guid id,
        [FromBody] VerifySubscriptionPaymentRequest request,
        CancellationToken ct)
    {
        var adminId = GetCurrentAdminId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString("N");

        var result = await _subscriptionService.VerifySubscriptionPaymentAsync(
            id,
            adminId,
            request,
            correlationId,
            ct);

        return Ok(result);
    }

    /// <summary>
    /// Directly assigns a subscription tier to a seller without requiring payment submission (Admin only per T-17).
    /// </summary>
    [HttpPost("api/v1/admin/sellers/{sellerId:guid}/subscription")]
    [ProducesResponseType(typeof(SellerSubscriptionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AssignSubscription(
        Guid sellerId,
        [FromBody] AssignSubscriptionRequest request,
        CancellationToken ct)
    {
        var adminId = GetCurrentAdminId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString("N");

        var result = await _subscriptionService.AssignSubscriptionAsync(sellerId, adminId, request, correlationId, ct);
        return Ok(result);
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
