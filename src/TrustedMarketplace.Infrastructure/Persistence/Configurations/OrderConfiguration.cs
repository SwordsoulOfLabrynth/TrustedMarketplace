using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrustedMarketplace.Domain.Orders;

namespace TrustedMarketplace.Infrastructure.Persistence.Configurations;

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("orders");

        builder.HasKey(o => o.Id);

        builder.Property(o => o.BuyerUserId)
            .IsRequired();

        builder.Property(o => o.SellerUserId)
            .IsRequired();

        builder.Property(o => o.SellerProfileId)
            .IsRequired();

        builder.Property(o => o.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(o => o.CurrencyCode)
            .IsRequired()
            .HasMaxLength(3);

        builder.Property(o => o.SubtotalAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(o => o.BuyerContactPhone)
            .IsRequired()
            .HasMaxLength(30);

        builder.Property(o => o.DeliveryAddressSnapshot)
            .IsRequired();

        builder.Property(o => o.DeliveryCityOrTownshipSnapshot)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(o => o.DeliveryNotes)
            .IsRequired(false);

        builder.Property(o => o.CourierTrackingReference)
            .HasMaxLength(100)
            .IsRequired(false);

        builder.Property(o => o.ShippedAtUtc)
            .IsRequired(false);

        builder.Property(o => o.CompletedAtUtc)
            .IsRequired(false);

        builder.Property(o => o.CompletedByUserId)
            .IsRequired(false);

        builder.Property(o => o.CreatedAtUtc)
            .IsRequired();

        builder.Property(o => o.UpdatedAtUtc)
            .IsRequired();

        builder.HasOne(o => o.SellerProfile)
            .WithMany()
            .HasForeignKey(o => o.SellerProfileId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(o => o.Items)
            .WithOne(i => i.Order)
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(o => o.Items)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasMany(o => o.History)
            .WithOne(h => h.Order)
            .HasForeignKey(h => h.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(o => o.History)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(o => o.BuyerUserId);
        builder.HasIndex(o => o.SellerUserId);
        builder.HasIndex(o => o.Status);
        builder.HasIndex(o => o.CreatedAtUtc);
    }
}
