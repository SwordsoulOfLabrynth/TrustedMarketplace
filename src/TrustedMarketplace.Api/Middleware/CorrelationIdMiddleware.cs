using System.Text.RegularExpressions;
using Serilog.Context;

namespace TrustedMarketplace.Api.Middleware;

public partial class CorrelationIdMiddleware
{
    public const string CorrelationIdHeader = "X-Correlation-ID";
    public const string CorrelationIdItemKey = "CorrelationId";
    private const int MaxCorrelationIdLength = 100;

    private readonly RequestDelegate _next;

    public CorrelationIdMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = GetOrCreateCorrelationId(context);

        context.Items[CorrelationIdItemKey] = correlationId;

        context.Response.OnStarting(() =>
        {
            if (!context.Response.Headers.ContainsKey(CorrelationIdHeader))
            {
                context.Response.Headers[CorrelationIdHeader] = correlationId;
            }
            return Task.CompletedTask;
        });

        using (LogContext.PushProperty(CorrelationIdItemKey, correlationId))
        {
            await _next(context);
        }
    }

    private static string GetOrCreateCorrelationId(HttpContext context)
    {
        if (context.Request.Headers.TryGetValue(CorrelationIdHeader, out var headerValue))
        {
            var rawValue = headerValue.ToString().Trim();

            if (IsValidCorrelationId(rawValue))
            {
                return rawValue;
            }
        }

        return Guid.NewGuid().ToString("D");
    }

    private static bool IsValidCorrelationId(string value)
    {
        if (string.IsNullOrEmpty(value) || value.Length > MaxCorrelationIdLength)
        {
            return false;
        }

        // Only allow safe alphanumeric, hyphens, underscores, and periods.
        // Prevents log injection (CRLF), control character injection, and header corruption.
        foreach (var c in value)
        {
            if (!char.IsAsciiLetterOrDigit(c) && c != '-' && c != '_' && c != '.')
            {
                return false;
            }
        }

        return true;
    }
}
