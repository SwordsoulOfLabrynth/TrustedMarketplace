using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Api.Authorization;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Subscriptions;
using TrustedMarketplace.Application.Subscriptions.Dtos;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
[Route("api/v1/admin/sellers/{sellerId:guid}/subscription")]
[Authorize(Policy = AuthorizationPolicies.RequireAdmin)]
public class AdminSubscriptionController : ControllerBase
{
    private readonly ISubscriptionService _subscriptionService;

    public AdminSubscriptionController(ISubscriptionService subscriptionService)
    {
        _subscriptionService = subscriptionService;
    }

    /// <summary>
    /// Assigns a subscription tier to a seller (Admin only per T-17).
    /// </summary>
    [HttpPost]
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
