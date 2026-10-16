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
// Cloud-friendly: reads CORS_ALLOWED_ORIGINS env var (comma-separated) first,
// then falls back to Cors:AllowedOrigins config array, then localhost defaults.
builder.Services.AddCors(options =>
{
    var corsEnv = builder.Configuration["CORS_ALLOWED_ORIGINS"];
    var allowedOrigins = !string.IsNullOrWhiteSpace(corsEnv)
        ? corsEnv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        : builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
          ?? new[] { "http://localhost:3000", "http://localhost:5173" };

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
        options.SwaggerEndpoint("/openapi/v1.json", "TrustedMarketplace API v1");
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

// CORS must come before HTTPS redirect so preflight OPTIONS responses are never redirected
app.UseCors();

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Expose Program class for WebApplicationFactory in integration tests
public partial class Program { }
