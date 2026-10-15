using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrustedMarketplace.Domain.Catalog;

namespace TrustedMarketplace.Infrastructure.Persistence.Configurations;

public class ProductEmbeddingConfiguration : IEntityTypeConfiguration<ProductEmbedding>
{
    public void Configure(EntityTypeBuilder<ProductEmbedding> builder)
    {
        builder.ToTable("product_embeddings");

        builder.HasKey(e => e.ProductId);

        builder.Property(e => e.ContentHash)
            .IsRequired()
            .HasMaxLength(128);

        builder.Property(e => e.IndexedAtUtc)
            .IsRequired();

        var vectorProperty = builder.Property(e => e.Vector)
            .HasConversion(
                v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => JsonSerializer.Deserialize<float[]>(v, (JsonSerializerOptions?)null) ?? Array.Empty<float>())
            .HasColumnType("text")
            .IsRequired();

        vectorProperty.Metadata.SetValueComparer(new Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<float[]>(
            (c1, c2) => c1 != null && c2 != null ? c1.SequenceEqual(c2) : c1 == c2,
            c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
            c => c.ToArray()));

        builder.HasOne(e => e.Product)
            .WithOne(p => p.Embedding)
            .HasForeignKey<ProductEmbedding>(e => e.ProductId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
