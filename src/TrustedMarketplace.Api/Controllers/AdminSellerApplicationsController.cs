using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Api.Authorization;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Verification;
using TrustedMarketplace.Application.Verification.Dtos;
using TrustedMarketplace.Domain.Verification;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
[Route("api/v1/admin/seller-applications")]
[Authorize(Policy = AuthorizationPolicies.RequireAdmin)]
public class AdminSellerApplicationsController : ControllerBase
{
    private readonly IVerificationService _verificationService;

    public AdminSellerApplicationsController(IVerificationService verificationService)
    {
        _verificationService = verificationService;
    }

    /// <summary>
    /// Lists all seller applications with optional status filter and pagination (Admin only).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SellerApplicationDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetApplications(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] ApplicationStatus? status = null,
        CancellationToken ct = default)
    {
        var results = await _verificationService.GetApplicationsForAdminAsync(page, pageSize, status, ct);
        return Ok(results);
    }

    /// <summary>
    /// Retrieves a seller application and its associated evidence metadata by ID (Admin only).
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(SellerApplicationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetApplicationById(Guid id, CancellationToken ct)
    {
        var application = await _verificationService.GetApplicationByIdForAdminAsync(id, ct);
        if (application == null)
        {
            throw new NotFoundException($"Seller application with ID '{id}' was not found.");
        }
        return Ok(application);
    }

    /// <summary>
    /// Streams private verification evidence file binary and writes an immutable AuditEvent (SEC-12, Admin only).
    /// </summary>
    [HttpGet("{id:guid}/evidence/{evidenceId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DownloadEvidence(
        Guid id,
        Guid evidenceId,
        CancellationToken ct)
    {
        var adminId = GetCurrentAdminId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString("N");

        var fileResult = await _verificationService.GetEvidenceFileForAdminAsync(id, evidenceId, adminId, correlationId, ct);
        if (fileResult == null)
        {
            throw new NotFoundException($"Evidence file with ID '{evidenceId}' was not found for application '{id}'.");
        }

        var (stream, contentType, fileName) = fileResult.Value;
        return File(stream, contentType, fileName);
    }

    /// <summary>
    /// Processes an administrative decision (Approved, Rejected, MoreInformationRequired) on an application (Admin only).
    /// </summary>
    [HttpPost("{id:guid}/decision")]
    [ProducesResponseType(typeof(SellerApplicationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ProcessDecision(
        Guid id,
        [FromBody] AdminDecisionRequest request,
        CancellationToken ct)
    {
        var adminId = GetCurrentAdminId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString("N");

        var result = await _verificationService.ProcessAdminDecisionAsync(id, adminId, request, correlationId, ct);
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
