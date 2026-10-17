using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Api.Authorization;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Credentials;
using TrustedMarketplace.Application.Credentials.Dtos;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
[Route("api/v1/seller/credentials")]
[Authorize(Policy = AuthorizationPolicies.RequireActiveUser)]
public class SellerCredentialsController : ControllerBase
{
    private readonly ICredentialService _credentialService;

    public SellerCredentialsController(ICredentialService credentialService)
    {
        _credentialService = credentialService;
    }

    /// <summary>
    /// Retrieves current authenticated seller's credential status, active credential, and issuance history.
    /// </summary>
    [HttpGet("my")]
    [ProducesResponseType(typeof(SellerCredentialStatusDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyCredentialStatus(CancellationToken ct)
    {
        var sellerUserId = GetCurrentUserId();
        var status = await _credentialService.GetMyCredentialStatusAsync(sellerUserId, ct);
        return Ok(status);
    }

    /// <summary>
    /// Downloads the official PDF certificate for the specified credential ID.
    /// Strictly verifies resource ownership (SEC-05: 403 Forbidden if not the credential owner).
    /// </summary>
    [HttpGet("{id:guid}/certificate")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(FileContentResult))]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DownloadCertificate(Guid id, CancellationToken ct)
    {
        var sellerUserId = GetCurrentUserId();
        var pdfBytes = await _credentialService.GenerateCertificatePdfAsync(id, sellerUserId, isAdmin: false, ct);

        return File(pdfBytes, "application/pdf", $"MatchGuard-Certificate-{id}.pdf");
    }

    /// <summary>
    /// Downloads the official PDF certificate for current authenticated seller's active credential.
    /// </summary>
    [HttpGet("my/certificate")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(FileContentResult))]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DownloadMyActiveCertificate(CancellationToken ct)
    {
        var sellerUserId = GetCurrentUserId();
        var status = await _credentialService.GetMyCredentialStatusAsync(sellerUserId, ct);

        if (status.ActiveCredential == null)
        {
            throw new NotFoundException("No active credential found for this seller account.");
        }

        var pdfBytes = await _credentialService.GenerateCertificatePdfAsync(
            status.ActiveCredential.Id,
            sellerUserId,
            isAdmin: false,
            ct);

        return File(pdfBytes, "application/pdf", $"MatchGuard-Certificate-{status.ActiveCredential.PublicCredentialId}.pdf");
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
