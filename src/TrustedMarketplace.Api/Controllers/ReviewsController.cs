using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Api.Authorization;
using TrustedMarketplace.Application.Catalog.Dtos;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Reviews;
using TrustedMarketplace.Application.Reviews.Dtos;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
public class ReviewsController : ControllerBase
{
    private readonly IReviewService _reviewService;

    public ReviewsController(IReviewService reviewService)
    {
        _reviewService = reviewService;
    }

    /// <summary>
    /// Submits a transaction-linked review for a completed order (T-14).
    /// Strictly only the buyer of a Completed order can review (SEC-09, SEC-11).
    /// Unique constraint enforces maximum 1 review per transaction (SEC-10).
    /// </summary>
    [HttpPost("api/v1/orders/{orderId:guid}/reviews")]
    [Authorize(Policy = AuthorizationPolicies.RequireActiveUser)]
    [ProducesResponseType(typeof(ReviewDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SubmitReview(Guid orderId, [FromBody] CreateReviewRequest request, CancellationToken ct)
    {
        var buyerUserId = GetCurrentUserId();
        var review = await _reviewService.SubmitReviewAsync(orderId, buyerUserId, request, ct);
        return StatusCode(StatusCodes.Status201Created, review);
    }

    /// <summary>
    /// Retrieves public paginated reviews for a seller (T-14).
    /// </summary>
    [HttpGet("api/v1/sellers/{sellerId:guid}/reviews")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PagedResult<ReviewDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSellerReviews(
        Guid sellerId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _reviewService.GetSellerReviewsAsync(sellerId, page, pageSize, ct);
        return Ok(result);
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
