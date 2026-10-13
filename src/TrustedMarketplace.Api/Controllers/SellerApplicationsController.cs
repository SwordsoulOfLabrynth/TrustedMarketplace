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
[Route("api/v1/seller-applications")]
[Authorize(Policy = AuthorizationPolicies.RequireActiveUser)]
public class SellerApplicationsController : ControllerBase
{
    private readonly IVerificationService _verificationService;

    public SellerApplicationsController(IVerificationService verificationService)
    {
        _verificationService = verificationService;
    }

    /// <summary>
    /// Submits a new seller verification application.
    /// Rejects if user already has an active application or is already approved.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(SellerApplicationDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SubmitApplication(
        [FromBody] CreateSellerApplicationRequest request,
        CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        var result = await _verificationService.SubmitApplicationAsync(userId, request, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>
    /// Retrieves the current user's seller verification application status and attached evidence metadata.
    /// </summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(SellerApplicationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMyApplication(CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        var application = await _verificationService.GetMyApplicationAsync(userId, ct);

        if (application == null)
        {
            throw new NotFoundException("No seller application found for this account.");
        }

        return Ok(application);
    }

    /// <summary>
    /// Uploads verification evidence (NRC front/back, business license, utility bill).
    /// Enforces magic byte validation and stores file in private directory outside web root (SEC-12).
    /// </summary>
    [HttpPost("me/evidence")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(VerificationEvidenceDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UploadEvidence(
        [FromForm] EvidenceType evidenceType,
        IFormFile? file,
        CancellationToken ct)
    {
        if (file == null || file.Length == 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["file"] = new[] { "An evidence file must be uploaded." }
            });
        }

        var userId = GetCurrentUserId();
        await using var stream = file.OpenReadStream();

        var result = await _verificationService.UploadEvidenceAsync(
            userId,
            evidenceType,
            stream,
            file.FileName,
            file.ContentType,
            file.Length,
            ct);

        return StatusCode(StatusCodes.Status201Created, result);
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
