using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrustedMarketplace.Domain.Auditing;

namespace TrustedMarketplace.Infrastructure.Persistence.Configurations;

public class AuditEventConfiguration : IEntityTypeConfiguration<AuditEvent>
{
    public void Configure(EntityTypeBuilder<AuditEvent> builder)
    {
        builder.ToTable("audit_events");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Action)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(a => a.TargetType)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(a => a.TargetId)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(a => a.CorrelationId)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(a => a.Reason)
            .HasMaxLength(2000)
            .IsRequired(false);

        builder.Property(a => a.MetadataJson)
            .HasColumnType("jsonb")
            .IsRequired(false);

        builder.Property(a => a.CreatedAtUtc)
            .IsRequired();

        builder.HasIndex(a => new { a.TargetType, a.TargetId });
        builder.HasIndex(a => a.CreatedAtUtc);
    }
}
