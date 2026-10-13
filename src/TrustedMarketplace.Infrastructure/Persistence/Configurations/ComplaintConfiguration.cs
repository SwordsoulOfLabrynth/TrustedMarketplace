using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrustedMarketplace.Domain.Complaints;

namespace TrustedMarketplace.Infrastructure.Persistence.Configurations;

public class ComplaintConfiguration : IEntityTypeConfiguration<Complaint>
{
    public void Configure(EntityTypeBuilder<Complaint> builder)
    {
        builder.ToTable("complaints");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.ReporterUserId)
            .IsRequired();

        builder.Property(c => c.OrderId)
            .IsRequired(false);

        builder.Property(c => c.SellerUserId)
            .IsRequired(false);

        builder.Property(c => c.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(c => c.Description)
            .IsRequired();

        builder.Property(c => c.AssignedToUserId)
            .IsRequired(false);

        builder.Property(c => c.ResolutionCode)
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired(false);

        builder.Property(c => c.ResolutionSummary)
            .IsRequired(false);

        builder.Property(c => c.ResolvedAtUtc)
            .IsRequired(false);

        builder.Property(c => c.CreatedAtUtc)
            .IsRequired();

        builder.Property(c => c.UpdatedAtUtc)
            .IsRequired();

        builder.HasOne(c => c.Order)
            .WithMany()
            .HasForeignKey(c => c.OrderId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(c => c.ReporterUserId);
        builder.HasIndex(c => c.OrderId);
        builder.HasIndex(c => c.SellerUserId);
        builder.HasIndex(c => c.Status);
    }
}
