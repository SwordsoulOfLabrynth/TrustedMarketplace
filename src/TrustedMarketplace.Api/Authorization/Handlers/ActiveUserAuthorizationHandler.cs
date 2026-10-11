using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using TrustedMarketplace.Api.Authorization.Requirements;
using TrustedMarketplace.Domain.Identity;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.Api.Authorization.Handlers;

/// <summary>
/// Verifies live database account standing on every authorized request.
/// Blocks users with Suspended or Closed accounts from accessing protected endpoints even with a valid JWT (SEC-03).
/// </summary>
public class ActiveUserAuthorizationHandler : AuthorizationHandler<ActiveUserRequirement>
{
    private readonly AppDbContext _dbContext;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<ActiveUserAuthorizationHandler> _logger;

    public ActiveUserAuthorizationHandler(
        AppDbContext dbContext,
        IHttpContextAccessor httpContextAccessor,
        ILogger<ActiveUserAuthorizationHandler> logger)
    {
        _dbContext = dbContext;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ActiveUserRequirement requirement)
    {
        if (context.User?.Identity?.IsAuthenticated != true)
        {
            return;
        }

        var userIdStr = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? context.User.FindFirstValue("sub");

        if (string.IsNullOrWhiteSpace(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return;
        }

        // Live verification against database
        var user = await _dbContext.Users
            .AsNoTracking()
            .Select(u => new { u.Id, u.AccountStatus })
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            _logger.LogWarning("ActiveUser check failed: User {UserId} not found in database.", userId);
            return;
        }

        if (user.AccountStatus == AccountStatus.Suspended)
        {
            _logger.LogWarning("Access blocked: User {UserId} is Suspended (SEC-03).", userId);
            if (_httpContextAccessor.HttpContext != null)
            {
                _httpContextAccessor.HttpContext.Items["AuthForbiddenReason"] = "ACCOUNT_SUSPENDED";
            }
            context.Fail(new AuthorizationFailureReason(this, "User account is suspended."));
            return;
        }

        if (user.AccountStatus == AccountStatus.Closed)
        {
            _logger.LogWarning("Access blocked: User {UserId} is Closed.", userId);
            if (_httpContextAccessor.HttpContext != null)
            {
                _httpContextAccessor.HttpContext.Items["AuthForbiddenReason"] = "ACCOUNT_CLOSED";
            }
            context.Fail(new AuthorizationFailureReason(this, "User account is closed."));
            return;
        }

        context.Succeed(requirement);
    }
}
