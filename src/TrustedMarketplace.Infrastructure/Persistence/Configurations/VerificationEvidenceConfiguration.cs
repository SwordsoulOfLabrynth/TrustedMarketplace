using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrustedMarketplace.Domain.Verification;

namespace TrustedMarketplace.Infrastructure.Persistence.Configurations;

public class VerificationEvidenceConfiguration : IEntityTypeConfiguration<VerificationEvidence>
{
    public void Configure(EntityTypeBuilder<VerificationEvidence> builder)
    {
        builder.ToTable("verification_evidence");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.SellerApplicationId)
            .IsRequired();

        builder.Property(e => e.EvidenceType)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(e => e.PrivateStorageKey)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(e => e.OriginalFileName)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(e => e.FileSizeBytes)
            .IsRequired();

        builder.Property(e => e.MimeType)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(e => e.Sha256Checksum)
            .IsRequired()
            .HasMaxLength(64);

        builder.Property(e => e.UploadedAtUtc)
            .IsRequired();

        builder.Property(e => e.ReviewStatus)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(e => e.RetentionUntilUtc)
            .IsRequired(false);

        builder.Property(e => e.CreatedAtUtc)
            .IsRequired();

        builder.Property(e => e.UpdatedAtUtc)
            .IsRequired();

        builder.HasIndex(e => e.SellerApplicationId);
    }
}
