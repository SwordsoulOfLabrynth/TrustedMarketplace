using System.Text.RegularExpressions;
using TrustedMarketplace.Domain.Common;

namespace TrustedMarketplace.Domain.Catalog;

public class Category : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public Guid? ParentCategoryId { get; private set; }
    public bool IsActive { get; private set; } = true;

    // Navigation properties
    public Category? ParentCategory { get; private set; }
    public ICollection<Category> SubCategories { get; private set; } = new List<Category>();

    private Category() : base() { }

    public Category(
        Guid id,
        string name,
        Guid? parentCategoryId = null,
        bool isActive = true) : base()
    {
        Id = id == Guid.Empty ? Guid.NewGuid() : id;
        Name = name.Trim();
        Slug = GenerateSlug(Name);
        ParentCategoryId = parentCategoryId;
        IsActive = isActive;
    }

    public static string GenerateSlug(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return Guid.NewGuid().ToString("N")[..8];
        var str = text.ToLowerInvariant();
        str = Regex.Replace(str, @"[^a-z0-9\s-]", "");
        str = Regex.Replace(str, @"\s+", " ").Trim();
        str = Regex.Replace(str, @"\s", "-");
        return str;
    }
}
