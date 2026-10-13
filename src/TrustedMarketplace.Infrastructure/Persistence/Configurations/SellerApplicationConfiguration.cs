using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrustedMarketplace.Domain.Verification;

namespace TrustedMarketplace.Infrastructure.Persistence.Configurations;

public class SellerApplicationConfiguration : IEntityTypeConfiguration<SellerApplication>
{
    public void Configure(EntityTypeBuilder<SellerApplication> builder)
    {
        builder.ToTable("seller_applications");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.UserId)
            .IsRequired();

        builder.Property(a => a.ProposedStoreName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(a => a.BusinessType)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(a => a.ContactPhone)
            .IsRequired()
            .HasMaxLength(30);

        builder.Property(a => a.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(a => a.SubmittedAtUtc)
            .IsRequired();

        builder.Property(a => a.ReviewedAtUtc)
            .IsRequired(false);

        builder.Property(a => a.ReviewedByUserId)
            .IsRequired(false);

        builder.Property(a => a.DecisionReason)
            .HasMaxLength(500)
            .IsRequired(false);

        builder.Property(a => a.CreatedAtUtc)
            .IsRequired();

        builder.Property(a => a.UpdatedAtUtc)
            .IsRequired();

        builder.HasMany(a => a.Evidence)
            .WithOne(e => e.SellerApplication)
            .HasForeignKey(e => e.SellerApplicationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(a => a.Evidence)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        // Partial unique index: at most one pending application per user
        builder.HasIndex(a => a.UserId)
            .HasFilter("\"Status\" = 'Pending'")
            .IsUnique();

        builder.HasIndex(a => a.Status);
    }
}
