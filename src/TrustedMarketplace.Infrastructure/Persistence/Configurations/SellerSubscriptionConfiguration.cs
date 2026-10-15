using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrustedMarketplace.Domain.Subscriptions;

namespace TrustedMarketplace.Infrastructure.Persistence.Configurations;

public class SellerSubscriptionConfiguration : IEntityTypeConfiguration<SellerSubscription>
{
    public void Configure(EntityTypeBuilder<SellerSubscription> builder)
    {
        builder.ToTable("seller_subscriptions");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.SellerUserId)
            .IsRequired();

        builder.Property(s => s.SubscriptionPlanId)
            .IsRequired();

        builder.Property(s => s.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(s => s.StartsAtUtc)
            .IsRequired();

        builder.Property(s => s.ExpiresAtUtc)
            .IsRequired();

        builder.Property(s => s.AssignedByUserId)
            .IsRequired(false);

        // Payment lifecycle mappings
        builder.Property(s => s.PaymentMethod)
            .HasMaxLength(50)
            .IsRequired(false);

        builder.Property(s => s.TransactionReference)
            .HasMaxLength(100)
            .IsRequired(false);

        builder.Property(s => s.PaymentAmount)
            .HasPrecision(18, 2)
            .IsRequired(false);

        builder.Property(s => s.PaymentCurrency)
            .HasMaxLength(3)
            .HasDefaultValue("MMK")
            .IsRequired();

        builder.Property(s => s.PaymentSubmittedAtUtc)
            .IsRequired(false);

        builder.Property(s => s.PaymentProofStorageKey)
            .HasMaxLength(500)
            .IsRequired(false);

        builder.Property(s => s.ReviewedByUserId)
            .IsRequired(false);

        builder.Property(s => s.ReviewedAtUtc)
            .IsRequired(false);

        builder.Property(s => s.RejectionReason)
            .HasMaxLength(500)
            .IsRequired(false);

        builder.Property(s => s.CreatedAtUtc)
            .IsRequired();

        builder.Property(s => s.UpdatedAtUtc)
            .IsRequired();

        builder.HasOne(s => s.SubscriptionPlan)
            .WithMany()
            .HasForeignKey(s => s.SubscriptionPlanId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(s => s.SellerUserId);
        builder.HasIndex(s => s.Status);

        // Duplicate-reference protection across active and pending verification records
        builder.HasIndex(s => s.TransactionReference)
            .IsUnique()
            .HasFilter("\"TransactionReference\" IS NOT NULL AND \"Status\" != 'Rejected'");
    }
}
