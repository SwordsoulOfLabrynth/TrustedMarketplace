using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrustedMarketplace.Domain.Orders;

namespace TrustedMarketplace.Infrastructure.Persistence.Configurations;

public class OrderStatusHistoryConfiguration : IEntityTypeConfiguration<OrderStatusHistory>
{
    public void Configure(EntityTypeBuilder<OrderStatusHistory> builder)
    {
        builder.ToTable("order_status_history");

        builder.HasKey(h => h.Id);

        builder.Property(h => h.OrderId)
            .IsRequired();

        builder.Property(h => h.ActorUserId)
            .IsRequired();

        builder.Property(h => h.PreviousStatus)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(h => h.NewStatus)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(h => h.Reason)
            .IsRequired(false);

        builder.Property(h => h.CreatedAtUtc)
            .IsRequired();

        builder.Property(h => h.UpdatedAtUtc)
            .IsRequired();

        builder.HasIndex(h => h.OrderId);
        builder.HasIndex(h => h.ActorUserId);
    }
}
