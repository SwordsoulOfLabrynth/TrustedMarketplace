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
            .HasMaxLength(20);

        builder.Property(s => s.StartsAtUtc)
            .IsRequired();

        builder.Property(s => s.ExpiresAtUtc)
            .IsRequired();

        builder.Property(s => s.AssignedByUserId)
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
    }
}
