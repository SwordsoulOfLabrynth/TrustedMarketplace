using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrustedMarketplace.Domain.Reviews;

namespace TrustedMarketplace.Infrastructure.Persistence.Configurations;

public class ReviewConfiguration : IEntityTypeConfiguration<Review>
{
    public void Configure(EntityTypeBuilder<Review> builder)
    {
        builder.ToTable("reviews");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.OrderId)
            .IsRequired();

        builder.Property(r => r.ReviewerUserId)
            .IsRequired();

        builder.Property(r => r.SellerUserId)
            .IsRequired();

        builder.Property(r => r.Rating)
            .IsRequired();

        builder.Property(r => r.Comment)
            .IsRequired();

        builder.Property(r => r.ModerationStatus)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(r => r.CreatedAtUtc)
            .IsRequired();

        builder.Property(r => r.UpdatedAtUtc)
            .IsRequired();

        builder.HasOne(r => r.Order)
            .WithMany()
            .HasForeignKey(r => r.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(r => r.OrderId).IsUnique();
        builder.HasIndex(r => new { r.OrderId, r.ReviewerUserId }).IsUnique();
        builder.HasIndex(r => r.SellerUserId);
        builder.HasIndex(r => r.ModerationStatus);
        builder.HasIndex(r => r.CreatedAtUtc);
    }
}
