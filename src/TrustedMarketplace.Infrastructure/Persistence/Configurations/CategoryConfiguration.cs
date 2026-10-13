using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TrustedMarketplace.Domain.Catalog;

namespace TrustedMarketplace.Infrastructure.Persistence.Configurations;

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public static readonly Guid HandicraftsId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    public static readonly Guid FashionId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    public static readonly Guid FoodId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    public static readonly Guid ElectronicsId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");

    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("categories");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(c => c.Slug)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(c => c.ParentCategoryId)
            .IsRequired(false);

        builder.Property(c => c.IsActive)
            .IsRequired();

        builder.Property(c => c.CreatedAtUtc)
            .IsRequired();

        builder.Property(c => c.UpdatedAtUtc)
            .IsRequired();

        builder.HasOne(c => c.ParentCategory)
            .WithMany(c => c.SubCategories)
            .HasForeignKey(c => c.ParentCategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(c => c.Slug).IsUnique();
        builder.HasIndex(c => c.IsActive);

        var now = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        builder.HasData(
            new Category(HandicraftsId, "Handicrafts & Art", null, true) { CreatedAtUtc = now, UpdatedAtUtc = now },
            new Category(FashionId, "Traditional Fashion & Textiles", null, true) { CreatedAtUtc = now, UpdatedAtUtc = now },
            new Category(FoodId, "Local Food & Tea", null, true) { CreatedAtUtc = now, UpdatedAtUtc = now },
            new Category(ElectronicsId, "Electronics & Gadgets", null, true) { CreatedAtUtc = now, UpdatedAtUtc = now }
        );
    }
}
