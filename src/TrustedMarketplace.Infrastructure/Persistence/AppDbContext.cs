using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TrustedMarketplace.Domain.Auditing;
using TrustedMarketplace.Infrastructure.Identity;

namespace TrustedMarketplace.Infrastructure.Persistence;

public class AppDbContext : IdentityDbContext<ApplicationUser, ApplicationRole, Guid>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<TrustedMarketplace.Domain.Verification.SellerApplication> SellerApplications => Set<TrustedMarketplace.Domain.Verification.SellerApplication>();
    public DbSet<TrustedMarketplace.Domain.Verification.VerificationEvidence> VerificationEvidences => Set<TrustedMarketplace.Domain.Verification.VerificationEvidence>();
    public DbSet<TrustedMarketplace.Domain.Verification.VerificationDecisionHistory> VerificationDecisionHistories => Set<TrustedMarketplace.Domain.Verification.VerificationDecisionHistory>();
    public DbSet<TrustedMarketplace.Domain.Stores.SellerProfile> SellerProfiles => Set<TrustedMarketplace.Domain.Stores.SellerProfile>();
    public DbSet<TrustedMarketplace.Domain.Subscriptions.SubscriptionPlan> SubscriptionPlans => Set<TrustedMarketplace.Domain.Subscriptions.SubscriptionPlan>();
    public DbSet<TrustedMarketplace.Domain.Subscriptions.SellerSubscription> SellerSubscriptions => Set<TrustedMarketplace.Domain.Subscriptions.SellerSubscription>();
    public DbSet<TrustedMarketplace.Domain.Catalog.Category> Categories => Set<TrustedMarketplace.Domain.Catalog.Category>();
    public DbSet<TrustedMarketplace.Domain.Catalog.Product> Products => Set<TrustedMarketplace.Domain.Catalog.Product>();
    public DbSet<TrustedMarketplace.Domain.Catalog.ProductImage> ProductImages => Set<TrustedMarketplace.Domain.Catalog.ProductImage>();
    public DbSet<TrustedMarketplace.Domain.Catalog.ProductEmbedding> ProductEmbeddings => Set<TrustedMarketplace.Domain.Catalog.ProductEmbedding>();
    public DbSet<TrustedMarketplace.Domain.Orders.Order> Orders => Set<TrustedMarketplace.Domain.Orders.Order>();
    public DbSet<TrustedMarketplace.Domain.Orders.OrderItem> OrderItems => Set<TrustedMarketplace.Domain.Orders.OrderItem>();
    public DbSet<TrustedMarketplace.Domain.Orders.OrderStatusHistory> OrderStatusHistories => Set<TrustedMarketplace.Domain.Orders.OrderStatusHistory>();
    public DbSet<TrustedMarketplace.Domain.Reviews.Review> Reviews => Set<TrustedMarketplace.Domain.Reviews.Review>();
    public DbSet<TrustedMarketplace.Domain.Complaints.Complaint> Complaints => Set<TrustedMarketplace.Domain.Complaints.Complaint>();
    public DbSet<TrustedMarketplace.Domain.Credentials.SellerCredential> SellerCredentials => Set<TrustedMarketplace.Domain.Credentials.SellerCredential>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
