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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
