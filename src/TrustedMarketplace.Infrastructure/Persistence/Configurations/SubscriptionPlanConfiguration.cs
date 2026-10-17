using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrustedMarketplace.Domain.Subscriptions;

namespace TrustedMarketplace.Infrastructure.Persistence.Configurations;

public class SubscriptionPlanConfiguration : IEntityTypeConfiguration<SubscriptionPlan>
{
    public static readonly Guid FreePlanId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid StandardPlanId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    public static readonly Guid PremiumPlanId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    public void Configure(EntityTypeBuilder<SubscriptionPlan> builder)
    {
        builder.ToTable("subscription_plans");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(p => p.MaxActiveListings)
            .IsRequired();

        builder.Property(p => p.PriceAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(p => p.CurrencyCode)
            .IsRequired()
            .HasMaxLength(3);

        builder.Property(p => p.BillingPeriod)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(p => p.IsActive)
            .IsRequired();

        builder.Property(p => p.CreatedAtUtc)
            .IsRequired();

        builder.Property(p => p.UpdatedAtUtc)
            .IsRequired();

        // Seed default plans per specs: Free (10), Standard (30), Premium (100)
        var now = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        builder.HasData(
            new SubscriptionPlan(FreePlanId, "Free", 10, 0m, "MMK", "Monthly", true) { CreatedAtUtc = now, UpdatedAtUtc = now },
            new SubscriptionPlan(StandardPlanId, "Standard", 30, 15000m, "MMK", "Monthly", true) { CreatedAtUtc = now, UpdatedAtUtc = now },
            new SubscriptionPlan(PremiumPlanId, "Premium", 100, 30000m, "MMK", "Monthly", true) { CreatedAtUtc = now, UpdatedAtUtc = now }
        );
    }
}
