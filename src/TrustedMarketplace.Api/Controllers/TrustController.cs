using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Trust;
using TrustedMarketplace.Application.Trust.Dtos;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
public class TrustController : ControllerBase
{
    private readonly ITrustService _trustService;

    public TrustController(ITrustService trustService)
    {
        _trustService = trustService;
    }

    /// <summary>
    /// Retrieves the explainable trust profile and verification metrics for a seller (T-16).
    /// Publicly accessible.
    /// </summary>
    [HttpGet("api/v1/sellers/{sellerId:guid}/trust-profile")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(SellerTrustProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSellerTrustProfile(Guid sellerId, CancellationToken ct)
    {
        var trustProfile = await _trustService.GetSellerTrustProfileAsync(sellerId, ct);
        return Ok(trustProfile);
    }
}
