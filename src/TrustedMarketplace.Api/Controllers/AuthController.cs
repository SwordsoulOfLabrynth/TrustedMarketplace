using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Api.Authorization;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Identity;
using TrustedMarketplace.Application.Identity.Dtos;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    public const string RefreshTokenCookieName = "refreshToken";

    private readonly IAuthService _authService;
    private readonly IConfiguration _configuration;

    public AuthController(
        IAuthService _authService,
        IConfiguration configuration)
    {
        this._authService = _authService;
        _configuration = configuration;
    }

    /// <summary>
    /// Registers a new buyer account with email and password (SEC-01: Buyer role only).
    /// </summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(RegisterResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken ct)
    {
        var result = await _authService.RegisterAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>
    /// Authenticates with email and password, returning a short-lived JWT and setting an HttpOnly refresh cookie.
    /// Uniform error on failure to prevent credential enumeration (SEC-13).
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var (authResponse, refreshToken, refreshExpiry) = await _authService.LoginAsync(request, ct);
        SetRefreshTokenCookie(refreshToken, refreshExpiry);
        return Ok(authResponse);
    }

    /// <summary>
    /// Rotates the refresh token delivered via HttpOnly cookie and issues a fresh JWT access token.
    /// </summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh(CancellationToken ct)
    {
        var rawRefreshToken = Request.Cookies[RefreshTokenCookieName];
        if (string.IsNullOrWhiteSpace(rawRefreshToken))
        {
            throw new UnauthorizedException("Refresh token cookie is missing or expired.");
        }

        var (authResponse, newRefreshToken, newExpiry) = await _authService.RefreshAsync(rawRefreshToken, ct);
        SetRefreshTokenCookie(newRefreshToken, newExpiry);
        return Ok(authResponse);
    }

    /// <summary>
    /// Revokes the active refresh token session and clears the HttpOnly cookie.
    /// </summary>
    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var rawRefreshToken = Request.Cookies[RefreshTokenCookieName];
        await _authService.LogoutAsync(rawRefreshToken, ct);
        DeleteRefreshTokenCookie();
        return NoContent();
    }

    /// <summary>
    /// Retrieves the authenticated profile for the current user (requires Active account standing).
    /// </summary>
    [HttpGet("me")]
    [Authorize(Policy = AuthorizationPolicies.RequireActiveUser)]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCurrentUser(CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        if (string.IsNullOrWhiteSpace(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            throw new UnauthorizedException("Invalid user claims in token.");
        }

        var profile = await _authService.GetCurrentUserAsync(userId, ct);
        return Ok(profile);
    }

    private SameSiteMode ResolveRefreshTokenSameSiteMode()
    {
        var sameSiteStr = _configuration["Jwt:RefreshTokenCookieSameSite"];
        return sameSiteStr?.ToLowerInvariant() switch
        {
            "strict" => SameSiteMode.Strict,
            "lax" => SameSiteMode.Lax,
            "none" => SameSiteMode.None,
            _ => !HttpContext.Request.Host.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
                ? SameSiteMode.None
                : SameSiteMode.Lax
        };
    }

    private void SetRefreshTokenCookie(string refreshToken, DateTime expiresAtUtc)
    {
        var sameSiteMode = ResolveRefreshTokenSameSiteMode();
        var isSecure = sameSiteMode == SameSiteMode.None
            || Request.IsHttps
            || !HttpContext.Request.Host.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase);

        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = isSecure,
            SameSite = sameSiteMode,
            Expires = expiresAtUtc,
            Path = "/api/v1/auth"
        };

        Response.Cookies.Append(RefreshTokenCookieName, refreshToken, cookieOptions);
    }

    private void DeleteRefreshTokenCookie()
    {
        var sameSiteMode = ResolveRefreshTokenSameSiteMode();
        var isSecure = sameSiteMode == SameSiteMode.None
            || Request.IsHttps
            || !HttpContext.Request.Host.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase);

        Response.Cookies.Delete(RefreshTokenCookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = isSecure,
            SameSite = sameSiteMode,
            Path = "/api/v1/auth"
        });
    }
}
