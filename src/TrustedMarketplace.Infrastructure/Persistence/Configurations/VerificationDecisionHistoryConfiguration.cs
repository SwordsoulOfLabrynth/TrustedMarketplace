using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrustedMarketplace.Domain.Verification;

namespace TrustedMarketplace.Infrastructure.Persistence.Configurations;

public class VerificationDecisionHistoryConfiguration : IEntityTypeConfiguration<VerificationDecisionHistory>
{
    public void Configure(EntityTypeBuilder<VerificationDecisionHistory> builder)
    {
        builder.ToTable("verification_decision_history");

        builder.HasKey(h => h.Id);

        builder.Property(h => h.SellerApplicationId)
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
            .HasMaxLength(1000)
            .IsRequired(false);

        builder.Property(h => h.CreatedAtUtc)
            .IsRequired();

        builder.Property(h => h.UpdatedAtUtc)
            .IsRequired();

        builder.HasOne(h => h.SellerApplication)
            .WithMany()
            .HasForeignKey(h => h.SellerApplicationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(h => h.SellerApplicationId);
        builder.HasIndex(h => h.ActorUserId);
    }
}
