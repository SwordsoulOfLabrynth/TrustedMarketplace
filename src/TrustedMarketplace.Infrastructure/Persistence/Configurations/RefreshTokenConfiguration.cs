using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrustedMarketplace.Infrastructure.Identity;

namespace TrustedMarketplace.Infrastructure.Persistence.Configurations;

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("refresh_tokens");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.UserId)
            .IsRequired();

        builder.Property(r => r.TokenHash)
            .IsRequired()
            .HasMaxLength(128);

        builder.Property(r => r.TokenFamily)
            .IsRequired();

        builder.Property(r => r.ExpiresAtUtc)
            .IsRequired();

        builder.Property(r => r.RevokedAtUtc)
            .IsRequired(false);

        builder.Property(r => r.ReplacedByTokenHash)
            .HasMaxLength(128)
            .IsRequired(false);

        builder.Property(r => r.ReasonRevoked)
            .HasMaxLength(250)
            .IsRequired(false);

        builder.Property(r => r.CreatedAtUtc)
            .IsRequired();

        builder.Property(r => r.UpdatedAtUtc)
            .IsRequired();

        // Indices for fast lookup and integrity
        builder.HasIndex(r => r.TokenHash).IsUnique();
        builder.HasIndex(r => r.UserId);
        builder.HasIndex(r => r.TokenFamily);
    }
}
