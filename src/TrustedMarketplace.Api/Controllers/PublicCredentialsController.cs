using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Application.Credentials;
using TrustedMarketplace.Application.Credentials.Dtos;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
[Route("api/v1/public/credentials")]
[AllowAnonymous]
public class PublicCredentialsController : ControllerBase
{
    private readonly ICredentialService _credentialService;

    public PublicCredentialsController(ICredentialService credentialService)
    {
        _credentialService = credentialService;
    }

    /// <summary>
    /// Public verification endpoint for validating seller credentials via public ID or QR scan.
    /// Exposes only minimal safe validation data without private identity documents or review notes.
    /// </summary>
    [HttpGet("{credentialId}")]
    [ProducesResponseType(typeof(PublicCredentialVerificationDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> VerifyCredential(string credentialId, CancellationToken ct)
    {
        var result = await _credentialService.VerifyPublicCredentialAsync(credentialId, ct);
        return Ok(result);
    }

    /// <summary>
    /// Serves a dynamic portable SVG badge reflecting live credential status.
    /// Safe for embedding in websites and portfolios.
    /// </summary>
    [HttpGet("{credentialId}/badge.svg")]
    [Produces("image/svg+xml")]
    [ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> GetBadgeSvg(string credentialId, CancellationToken ct)
    {
        var svg = await _credentialService.GenerateBadgeSvgAsync(credentialId, ct);
        return Content(svg, "image/svg+xml", Encoding.UTF8);
    }

    /// <summary>
    /// Serves a dynamic portable PNG badge reflecting live credential status.
    /// Suitable for external social profiles, marketplaces, and stores.
    /// </summary>
    [HttpGet("{credentialId}/badge.png")]
    [Produces("image/png")]
    [ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> GetBadgePng(string credentialId, CancellationToken ct)
    {
        var pngBytes = await _credentialService.GenerateBadgePngAsync(credentialId, ct);
        return File(pngBytes, "image/png");
    }
}
