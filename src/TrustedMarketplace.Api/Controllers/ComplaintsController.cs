using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Api.Authorization;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Complaints;
using TrustedMarketplace.Application.Complaints.Dtos;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
public class ComplaintsController : ControllerBase
{
    private readonly IComplaintService _complaintService;

    public ComplaintsController(IComplaintService complaintService)
    {
        _complaintService = complaintService;
    }

    /// <summary>
    /// Files a dispute complaint against an order, automatically transitioning order status to Disputed (T-15).
    /// </summary>
    [HttpPost("api/v1/orders/{orderId:guid}/complaints")]
    [Authorize(Policy = AuthorizationPolicies.RequireActiveUser)]
    [ProducesResponseType(typeof(ComplaintDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> FileComplaint(Guid orderId, [FromBody] FileComplaintRequest request, CancellationToken ct)
    {
        var actorUserId = GetCurrentUserId();
        var complaint = await _complaintService.FileOrderComplaintAsync(orderId, actorUserId, request, ct);
        return StatusCode(StatusCodes.Status201Created, complaint);
    }

    /// <summary>
    /// Retrieves complaint details by ID. Accessible by reporter, subject seller, or admin.
    /// </summary>
    [HttpGet("api/v1/complaints/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.RequireActiveUser)]
    [ProducesResponseType(typeof(ComplaintDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetComplaintById(Guid id, CancellationToken ct)
    {
        var callerUserId = GetCurrentUserId();
        var isAdmin = User.IsInRole("Admin");
        var complaint = await _complaintService.GetComplaintByIdAsync(id, callerUserId, isAdmin, ct);

        if (complaint == null)
            return NotFound(new ProblemDetails { Title = "Not Found", Detail = $"Complaint with ID '{id}' was not found." });

        return Ok(complaint);
    }

    /// <summary>
    /// Lists all complaints for admin review (T-15).
    /// </summary>
    [HttpGet("api/v1/admin/complaints")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(IReadOnlyList<ComplaintDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAdminComplaints(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var complaints = await _complaintService.GetComplaintsForAdminAsync(page, pageSize, ct);
        return Ok(complaints);
    }

    /// <summary>
    /// Records admin resolution decision on a complaint (T-15).
    /// </summary>
    [HttpPost("api/v1/admin/complaints/{id:guid}/decision")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ComplaintDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ProcessComplaintDecision(Guid id, [FromBody] AdminComplaintDecisionRequest request, CancellationToken ct)
    {
        var adminUserId = GetCurrentUserId();
        var correlationId = HttpContext.TraceIdentifier;
        var complaint = await _complaintService.ProcessComplaintDecisionAsync(id, adminUserId, request, correlationId, ct);
        return Ok(complaint);
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
