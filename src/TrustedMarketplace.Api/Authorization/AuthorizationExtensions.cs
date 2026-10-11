using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Api.Authorization.Handlers;
using TrustedMarketplace.Api.Authorization.Requirements;
using TrustedMarketplace.Api.Middleware;
using TrustedMarketplace.Domain.Identity;

namespace TrustedMarketplace.Api.Authorization;

public static class AuthorizationExtensions
{
    public static IServiceCollection AddMarketplaceAuthorization(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<IAuthorizationHandler, ActiveUserAuthorizationHandler>();
        services.AddScoped<IAuthorizationHandler, ResourceOwnerAuthorizationHandler>();

        services.AddAuthorization(options =>
        {
            options.AddPolicy(AuthorizationPolicies.RequireActiveUser, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.Requirements.Add(new ActiveUserRequirement());
            });

            options.AddPolicy(AuthorizationPolicies.RequireAdmin, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.RequireRole(RoleConstants.Admin);
                policy.Requirements.Add(new ActiveUserRequirement());
            });
        });

        // Format all 401 and 403 responses consistently into RFC 7807 ProblemDetails
        services.Configure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
        {
            options.Events = new JwtBearerEvents
            {
                OnChallenge = async context =>
                {
                    context.HandleResponse();
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    context.Response.ContentType = "application/problem+json";

                    var traceId = context.HttpContext.Items[CorrelationIdMiddleware.CorrelationIdItemKey]?.ToString()
                        ?? context.HttpContext.TraceIdentifier;

                    var problem = new ProblemDetails
                    {
                        Type = "about:blank",
                        Status = StatusCodes.Status401Unauthorized,
                        Title = "Unauthorized",
                        Detail = "Authentication credentials are required to access this resource.",
                        Instance = context.HttpContext.Request.Path
                    };
                    problem.Extensions["code"] = "UNAUTHORIZED";
                    problem.Extensions["traceId"] = traceId;
                    problem.Extensions["timestampUtc"] = DateTime.UtcNow;

                    await context.Response.WriteAsJsonAsync(
                        problem,
                        options: null,
                        contentType: "application/problem+json",
                        cancellationToken: context.HttpContext.RequestAborted);
                },
                OnForbidden = async context =>
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    context.Response.ContentType = "application/problem+json";

                    var traceId = context.HttpContext.Items[CorrelationIdMiddleware.CorrelationIdItemKey]?.ToString()
                        ?? context.HttpContext.TraceIdentifier;

                    var failureReason = context.HttpContext.Items["AuthForbiddenReason"]?.ToString();
                    var code = failureReason == "ACCOUNT_SUSPENDED" ? "ACCOUNT_SUSPENDED"
                        : failureReason == "ACCOUNT_CLOSED" ? "ACCOUNT_CLOSED"
                        : "FORBIDDEN";

                    var title = failureReason == "ACCOUNT_SUSPENDED" ? "Account Suspended"
                        : failureReason == "ACCOUNT_CLOSED" ? "Account Closed"
                        : "Forbidden";

                    var detail = failureReason == "ACCOUNT_SUSPENDED"
                        ? "Your account is currently suspended. Access to this resource is denied."
                        : failureReason == "ACCOUNT_CLOSED"
                        ? "This account has been closed. Access is denied."
                        : "You do not have permission to access this resource.";

                    var problem = new ProblemDetails
                    {
                        Type = "about:blank",
                        Status = StatusCodes.Status403Forbidden,
                        Title = title,
                        Detail = detail,
                        Instance = context.HttpContext.Request.Path
                    };
                    problem.Extensions["code"] = code;
                    problem.Extensions["traceId"] = traceId;
                    problem.Extensions["timestampUtc"] = DateTime.UtcNow;

                    await context.Response.WriteAsJsonAsync(
                        problem,
                        options: null,
                        contentType: "application/problem+json",
                        cancellationToken: context.HttpContext.RequestAborted);
                }
            };
        });

        return services;
    }
}
