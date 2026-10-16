using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using TrustedMarketplace.Application.Common.Interfaces;
using TrustedMarketplace.Application.Identity;
using TrustedMarketplace.Application.Verification;
using TrustedMarketplace.Infrastructure.Identity;
using TrustedMarketplace.Infrastructure.Persistence;
using TrustedMarketplace.Infrastructure.Persistence.Interceptors;
using TrustedMarketplace.Infrastructure.Storage;
using TrustedMarketplace.Infrastructure.Verification;

namespace TrustedMarketplace.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructurePersistence(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddScoped<AuditableEntitySaveChangesInterceptor>();

        var rawConnectionString = configuration.GetConnectionString("DefaultConnection");
        var connectionString = NormalizePostgresConnectionString(rawConnectionString ?? string.Empty);

        services.AddDbContext<AppDbContext>((sp, options) =>
        {
            var interceptor = sp.GetRequiredService<AuditableEntitySaveChangesInterceptor>();
            options.UseNpgsql(connectionString)
                   .AddInterceptors(interceptor);
        });

        return services;
    }

    public static string NormalizePostgresConnectionString(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return connectionString;
        }

        if (connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase) ||
            connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase))
        {
            var uri = new Uri(connectionString);
            var userInfo = uri.UserInfo.Split(':', 2);
            var username = Uri.UnescapeDataString(userInfo[0]);
            var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty;
            var host = uri.Host;
            var port = uri.Port > 0 ? uri.Port : 5432;
            var database = uri.AbsolutePath.TrimStart('/');

            var builder = new Npgsql.NpgsqlConnectionStringBuilder
            {
                Host = host,
                Port = port,
                Database = database,
                Username = username,
                Password = password,
                SslMode = Npgsql.SslMode.Require
            };

            return builder.ConnectionString;
        }

        return connectionString;
    }

    public static IServiceCollection AddInfrastructureIdentity(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var requireConfirmedEmail = configuration.GetValue<bool>("Identity:RequireConfirmedEmail", true);

        services.AddIdentityCore<ApplicationUser>(options =>
        {
            // Password requirements per DECISIONS.md / SEC specs
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireUppercase = true;
            options.Password.RequireNonAlphanumeric = false;
            options.Password.RequiredLength = 8;

            // User configuration
            options.User.RequireUniqueEmail = true;

            // Sign-in configuration: environment-driven (false in Development demo, true by default in Production)
            options.SignIn.RequireConfirmedEmail = requireConfirmedEmail;

            // Lockout settings
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            options.Lockout.MaxFailedAccessAttempts = 5;
            options.Lockout.AllowedForNewUsers = true;
        })
        .AddRoles<ApplicationRole>()
        .AddEntityFrameworkStores<AppDbContext>();

        // Register application auth & token services
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IAuthService, AuthService>();

        return services;
    }

    public const string DevelopmentFallbackSecret = "PLACEHOLDER_DEV_SECRET_KEY_MIN_32_CHARS_DO_NOT_USE_IN_PROD";

    public static IServiceCollection AddInfrastructureJwtAuthentication(
        this IServiceCollection services,
        IConfiguration configuration,
        Microsoft.Extensions.Hosting.IHostEnvironment? environment = null)
    {
        var isDevelopment = environment != null
            ? string.Equals(environment.EnvironmentName, "Development", StringComparison.OrdinalIgnoreCase)
            : string.Equals(configuration["ASPNETCORE_ENVIRONMENT"] ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase);

        var jwtKey = configuration["Jwt:Key"];

        if (string.IsNullOrWhiteSpace(jwtKey))
        {
            if (isDevelopment)
            {
                jwtKey = DevelopmentFallbackSecret;
            }
            else
            {
                throw new InvalidOperationException(
                    "JWT signing key ('Jwt:Key') is missing or empty. A cryptographically secure key of at least 32 characters must be configured in non-development environments.");
            }
        }
        else if (jwtKey.Length < 32)
        {
            throw new InvalidOperationException(
                "JWT signing key ('Jwt:Key') must be at least 32 characters (256 bits).");
        }
        else if (!isDevelopment && string.Equals(jwtKey, DevelopmentFallbackSecret, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "JWT signing key ('Jwt:Key') is configured with the known development placeholder. A unique production secret must be provided.");
        }

        var issuer = configuration["Jwt:Issuer"] ?? "TrustedMarketplace";
        var audience = configuration["Jwt:Audience"] ?? "TrustedMarketplaceClient";

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            // RequireHttpsMetadata controls whether the JWT Bearer middleware mandates HTTPS when fetching
            // metadata/keys from an external OpenID Connect authority (options.Authority).
            // Our architecture currently uses self-issued symmetric tokens without an external authority.
            // Configuring options.RequireHttpsMetadata = !isDevelopment ensures that if an external authority
            // is ever configured in staging/production, HTTPS metadata retrieval is strictly required.
            options.RequireHttpsMetadata = !isDevelopment;
            options.SaveToken = true;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                ValidateIssuer = true,
                ValidIssuer = issuer,
                ValidateAudience = true,
                ValidAudience = audience,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(30)
            };
        });

        return services;
    }

    public static IServiceCollection AddInfrastructureVerification(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddSingleton<IFileStorageService, LocalFileStorageService>();
        services.AddScoped<IVerificationService, VerificationService>();
        services.AddScoped<TrustedMarketplace.Application.Stores.ISellerStoreService, TrustedMarketplace.Infrastructure.Stores.SellerStoreService>();
        services.AddScoped<TrustedMarketplace.Application.Subscriptions.ISubscriptionService, TrustedMarketplace.Infrastructure.Subscriptions.SubscriptionService>();
        services.AddHttpClient<TrustedMarketplace.Infrastructure.Search.NvidiaEmbeddingProvider>();
        services.AddSingleton<TrustedMarketplace.Infrastructure.Search.LocalConceptHashEmbeddingProvider>();
        services.AddSingleton<TrustedMarketplace.Application.Search.IEmbeddingProvider>(sp => sp.GetRequiredService<TrustedMarketplace.Infrastructure.Search.NvidiaEmbeddingProvider>());
        services.AddSingleton<TrustedMarketplace.Application.Search.ISemanticSearchService, TrustedMarketplace.Infrastructure.Search.MultilingualSemanticSearchService>();
        services.AddScoped<TrustedMarketplace.Application.Catalog.ICatalogService, TrustedMarketplace.Infrastructure.Catalog.CatalogService>();
        services.AddScoped<TrustedMarketplace.Application.Orders.IOrderService, TrustedMarketplace.Infrastructure.Orders.OrderService>();
        services.AddScoped<TrustedMarketplace.Application.Reviews.IReviewService, TrustedMarketplace.Infrastructure.Reviews.ReviewService>();
        services.AddScoped<TrustedMarketplace.Application.Complaints.IComplaintService, TrustedMarketplace.Infrastructure.Complaints.ComplaintService>();
        services.AddScoped<TrustedMarketplace.Application.Trust.ITrustService, TrustedMarketplace.Infrastructure.Trust.TrustService>();
        return services;
    }
}
