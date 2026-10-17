using Microsoft.AspNetCore.HttpOverrides;
using Scalar.AspNetCore;
using Serilog;
using TrustedMarketplace.Api.Authorization;
using TrustedMarketplace.Api.Middleware;
using TrustedMarketplace.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog structured logging
builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext());

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Register ProblemDetails and centralized GlobalExceptionHandler
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

// Configure Cross-Origin Resource Sharing (CORS) with credentials support
// Resolves origins in priority:
// 1. CORS_ALLOWED_ORIGINS env var (comma-separated list)
// 2. Cors:AllowedOrigins configuration array
// 3. Fallback defaults (production Vercel origin + local dev origins)
builder.Services.AddCors(options =>
{
    var rawOrigins = new List<string>();

    var corsEnv = builder.Configuration["CORS_ALLOWED_ORIGINS"];
    if (!string.IsNullOrWhiteSpace(corsEnv))
    {
        rawOrigins.AddRange(corsEnv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
    }

    var configOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
    if (configOrigins != null && configOrigins.Length > 0)
    {
        rawOrigins.AddRange(configOrigins);
    }

    if (rawOrigins.Count == 0)
    {
        rawOrigins.AddRange([
            "https://trusted-marketplace.vercel.app",
            "http://localhost:3000",
            "http://localhost:5173",
            "https://localhost:3000",
            "https://localhost:5173"
        ]);
    }
    else
    {
        // Guarantee the canonical production origin is always permitted
        rawOrigins.Add("https://trusted-marketplace.vercel.app");
    }

    // Sanitize: trim whitespace, strip trailing slashes, remove blanks, deduplicate case-insensitively
    var allowedOrigins = rawOrigins
        .Where(o => !string.IsNullOrWhiteSpace(o))
        .Select(o => o.Trim().TrimEnd('/'))
        .Where(o => !string.IsNullOrWhiteSpace(o))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials()
              .WithExposedHeaders("X-Correlation-ID");
    });
});

// Register Infrastructure persistence (EF Core PostgreSQL DbContext & Interceptors)
builder.Services.AddInfrastructurePersistence(builder.Configuration);

// Register Evidence Storage & Verification services
builder.Services.AddInfrastructureVerification(builder.Configuration);

// Register ASP.NET Core Identity core services & EF Core stores
builder.Services.AddInfrastructureIdentity(builder.Configuration);

// Register JWT Bearer authentication handler
builder.Services.AddInfrastructureJwtAuthentication(builder.Configuration, builder.Environment);

// Register Authorization policies and handlers (RequireActiveUser, RequireAdmin)
builder.Services.AddMarketplaceAuthorization();

var app = builder.Build();

// Forwarded headers MUST be evaluated first so scheme, remote IP, and host are accurate
// behind reverse proxies (Render / Cloudflare / Nginx).
var forwardedHeadersOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
};
forwardedHeadersOptions.KnownIPNetworks.Clear();
forwardedHeadersOptions.KnownProxies.Clear();
app.UseForwardedHeaders(forwardedHeadersOptions);

// Correlation ID middleware early in the pipeline to enrich logging context
app.UseMiddleware<CorrelationIdMiddleware>();

// Centralized exception handler
app.UseExceptionHandler();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "MatchGuard API v1");
        options.RoutePrefix = "swagger";
    });
    app.MapScalarApiReference();

    var logger = app.Services.GetRequiredService<ILogger<Program>>();
    await TrustedMarketplace.Infrastructure.Persistence.DemoDataSeeder.SeedDemoDataAsync(
        app.Services,
        app.Configuration,
        logger,
        app.Environment.IsDevelopment());

    using (var scope = app.Services.CreateScope())
    {
        var catalogService = scope.ServiceProvider.GetRequiredService<TrustedMarketplace.Application.Catalog.ICatalogService>();
        await catalogService.EnsureProductEmbeddingsAsync();
    }
}

// CORS must come before HTTPS redirect and authentication so preflight OPTIONS responses are handled immediately
app.UseCors();

// In Production behind a reverse proxy (Render / Cloudflare), TLS termination and HTTPS redirection
// are handled by the edge. Disabling container-level HTTPS redirection in Production prevents
// internal HTTP health check probes (Render / Docker HEALTHCHECK) from receiving 307 redirects.
if (!app.Environment.IsProduction())
{
    app.UseHttpsRedirection();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Expose Program class for WebApplicationFactory in integration tests
public partial class Program { }
