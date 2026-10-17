using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrustedMarketplace.Domain.Credentials;

namespace TrustedMarketplace.Infrastructure.Persistence.Configurations;

public class SellerCredentialConfiguration : IEntityTypeConfiguration<SellerCredential>
{
    public void Configure(EntityTypeBuilder<SellerCredential> builder)
    {
        builder.ToTable("seller_credentials");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.SellerUserId)
            .IsRequired();

        builder.Property(c => c.SellerApplicationId)
            .IsRequired();

        builder.Property(c => c.PublicCredentialId)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(c => c.CredentialType)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(c => c.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(c => c.IssuedAtUtc)
            .IsRequired();

        builder.Property(c => c.IssuedByAdminUserId)
            .IsRequired();

        builder.Property(c => c.RevokedAtUtc)
            .IsRequired(false);

        builder.Property(c => c.RevokedByAdminUserId)
            .IsRequired(false);

        builder.Property(c => c.RevocationReason)
            .HasMaxLength(500)
            .IsRequired(false);

        builder.Property(c => c.CreatedAtUtc)
            .IsRequired();

        builder.Property(c => c.UpdatedAtUtc)
            .IsRequired();

        builder.HasIndex(c => c.PublicCredentialId)
            .IsUnique();

        builder.HasIndex(c => c.SellerApplicationId);

        builder.HasIndex(c => new { c.SellerUserId, c.CredentialType })
            .HasDatabaseName("IX_seller_credentials_SellerUserId_CredentialType_Active")
            .HasFilter("\"Status\" = 'Active'")
            .IsUnique();
    }
}
