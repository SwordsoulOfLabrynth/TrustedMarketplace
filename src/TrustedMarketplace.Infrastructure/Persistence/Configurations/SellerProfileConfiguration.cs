using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrustedMarketplace.Domain.Stores;

namespace TrustedMarketplace.Infrastructure.Persistence.Configurations;

public class SellerProfileConfiguration : IEntityTypeConfiguration<SellerProfile>
{
    public void Configure(EntityTypeBuilder<SellerProfile> builder)
    {
        builder.ToTable("seller_profiles");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.SellerUserId)
            .IsRequired();

        builder.Property(s => s.StoreName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(s => s.Slug)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(s => s.Bio)
            .HasMaxLength(500)
            .IsRequired(false);

        builder.Property(s => s.ContactPhone)
            .IsRequired()
            .HasMaxLength(30);

        builder.Property(s => s.CityOrTownship)
            .HasMaxLength(100)
            .IsRequired(false);

        builder.Property(s => s.LogoStorageKey)
            .HasMaxLength(500)
            .IsRequired(false);

        builder.Property(s => s.VerificationStatus)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(s => s.CreatedAtUtc)
            .IsRequired();

        builder.Property(s => s.UpdatedAtUtc)
            .IsRequired();

        // Unique indices
        builder.HasIndex(s => s.SellerUserId).IsUnique();
        builder.HasIndex(s => s.StoreName).IsUnique();
        builder.HasIndex(s => s.Slug).IsUnique();
        builder.HasIndex(s => s.VerificationStatus);
    }
}
