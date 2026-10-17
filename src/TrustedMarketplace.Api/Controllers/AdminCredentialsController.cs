using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Api.Authorization;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Credentials;
using TrustedMarketplace.Application.Credentials.Dtos;
using TrustedMarketplace.Domain.Credentials;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
[Route("api/v1/admin/credentials")]
[Authorize(Policy = AuthorizationPolicies.RequireAdmin)]
public class AdminCredentialsController : ControllerBase
{
    private readonly ICredentialService _credentialService;

    public AdminCredentialsController(ICredentialService credentialService)
    {
        _credentialService = credentialService;
    }

    /// <summary>
    /// Lists issued credentials with pagination and optional status filter.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SellerCredentialDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCredentials(
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        CredentialStatus? statusFilter = null;
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<CredentialStatus>(status, true, out var parsedStatus))
        {
            statusFilter = parsedStatus;
        }

        var result = await _credentialService.GetCredentialsForAdminAsync(statusFilter, page, pageSize, ct);
        return Ok(result);
    }

    /// <summary>
    /// Issues an official credential for an approved seller.
    /// Strictly verifies seller account standing and approved verification application.
    /// </summary>
    [HttpPost("issue")]
    [ProducesResponseType(typeof(SellerCredentialDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> IssueCredential(
        [FromBody] IssueCredentialRequest request,
        CancellationToken ct)
    {
        var adminUserId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString("N");

        var result = await _credentialService.IssueCredentialAsync(
            request.SellerUserId,
            adminUserId,
            request.Reason,
            correlationId,
            ct);

        return Ok(result);
    }

    /// <summary>
    /// Revokes an issued credential with a mandatory audit reason.
    /// </summary>
    [HttpPost("{id:guid}/revoke")]
    [ProducesResponseType(typeof(SellerCredentialDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RevokeCredential(
        Guid id,
        [FromBody] RevokeCredentialRequest request,
        CancellationToken ct)
    {
        var adminUserId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString("N");

        var result = await _credentialService.RevokeCredentialAsync(
            id,
            adminUserId,
            request.Reason,
            correlationId,
            ct);

        return Ok(result);
    }

    /// <summary>
    /// Allows administrators to inspect and download an official certificate PDF for audit.
    /// </summary>
    [HttpGet("{id:guid}/certificate")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(FileContentResult))]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DownloadCertificate(Guid id, CancellationToken ct)
    {
        var adminUserId = GetCurrentUserId();
        var pdfBytes = await _credentialService.GenerateCertificatePdfAsync(id, adminUserId, isAdmin: true, ct);

        return File(pdfBytes, "application/pdf", $"MatchGuard-Certificate-{id}.pdf");
    }

    private Guid GetCurrentUserId()
    {
        var rawId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(rawId) || !Guid.TryParse(rawId, out var userId))
        {
            throw new UnauthorizedException("Invalid user context.");
        }
        return userId;
    }
}
