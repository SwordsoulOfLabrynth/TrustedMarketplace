using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrustedMarketplace.Domain.Catalog;

namespace TrustedMarketplace.Infrastructure.Persistence.Configurations;

public class ProductImageConfiguration : IEntityTypeConfiguration<ProductImage>
{
    public void Configure(EntityTypeBuilder<ProductImage> builder)
    {
        builder.ToTable("product_images");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.ProductId)
            .IsRequired();

        builder.Property(i => i.StorageKey)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(i => i.SortOrder)
            .IsRequired();

        builder.Property(i => i.CreatedAtUtc)
            .IsRequired();

        builder.Property(i => i.UpdatedAtUtc)
            .IsRequired();

        builder.HasIndex(i => i.ProductId);
    }
}
