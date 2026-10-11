using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Domain.Common.Exceptions;

namespace TrustedMarketplace.Api.Middleware;

public class GlobalExceptionHandler : IExceptionHandler
{
    private const string ProblemJsonContentType = "application/problem+json";
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var correlationId = httpContext.Items[CorrelationIdMiddleware.CorrelationIdItemKey]?.ToString()
            ?? httpContext.TraceIdentifier;

        var (statusCode, title, code, detail, errors) = MapException(exception);

        if (statusCode == StatusCodes.Status500InternalServerError)
        {
            _logger.LogError(
                exception,
                "Unhandled server error occurred while processing {Method} {Path}. CorrelationId: {CorrelationId}",
                httpContext.Request.Method,
                httpContext.Request.Path,
                correlationId);
        }
        else
        {
            _logger.LogWarning(
                "Handled client error {StatusCode} ({Code}) for {Method} {Path}: {Detail}. CorrelationId: {CorrelationId}",
                statusCode,
                code,
                httpContext.Request.Method,
                httpContext.Request.Path,
                detail,
                correlationId);
        }

        var problemDetails = new ProblemDetails
        {
            Type = "about:blank",
            Status = statusCode,
            Title = title,
            Detail = detail,
            Instance = httpContext.Request.Path
        };

        problemDetails.Extensions["code"] = code;
        problemDetails.Extensions["traceId"] = correlationId;
        problemDetails.Extensions["timestampUtc"] = DateTime.UtcNow;

        if (errors != null && errors.Count > 0)
        {
            problemDetails.Extensions["errors"] = errors;
        }

        httpContext.Response.StatusCode = statusCode;

        await httpContext.Response.WriteAsJsonAsync(
            problemDetails,
            options: null,
            contentType: ProblemJsonContentType,
            cancellationToken: cancellationToken);

        return true;
    }

    private static (int StatusCode, string Title, string Code, string Detail, IDictionary<string, string[]>? Errors) MapException(Exception exception)
    {
        return exception switch
        {
            ValidationException validationEx => (
                StatusCodes.Status400BadRequest,
                "Validation Failed",
                "VALIDATION_ERROR",
                validationEx.Message,
                validationEx.Errors
            ),
            DomainException domainEx => (
                StatusCodes.Status400BadRequest,
                "Business Rule Violation",
                "DOMAIN_RULE_VIOLATION",
                domainEx.Message,
                null
            ),
            NotFoundException notFoundEx => (
                StatusCodes.Status404NotFound,
                "Resource Not Found",
                "NOT_FOUND",
                notFoundEx.Message,
                null
            ),
            ConflictException conflictEx => (
                StatusCodes.Status409Conflict,
                "State Conflict",
                "STATE_CONFLICT",
                conflictEx.Message,
                null
            ),
            ForbiddenException forbiddenEx => (
                StatusCodes.Status403Forbidden,
                "Forbidden",
                forbiddenEx.Code,
                forbiddenEx.Message,
                null
            ),
            UnauthorizedException unauthorizedEx => (
                StatusCodes.Status401Unauthorized,
                "Unauthorized",
                unauthorizedEx.Code,
                unauthorizedEx.Message,
                null
            ),
            _ => (
                StatusCodes.Status500InternalServerError,
                "Internal Server Error",
                "INTERNAL_SERVER_ERROR",
                "An unexpected error occurred while processing your request. Please contact support referencing the trace ID.",
                null
            )
        };
    }
}
