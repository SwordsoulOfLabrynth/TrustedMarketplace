using TrustedMarketplace.Domain.Common;

namespace TrustedMarketplace.Domain.Catalog;

public class ProductImage : BaseEntity
{
    public Guid ProductId { get; private set; }
    public string StorageKey { get; private set; } = string.Empty;
    public int SortOrder { get; private set; }

    // Navigation property
    public Product? Product { get; private set; }

    private ProductImage() : base() { }

    public ProductImage(
        Guid productId,
        string storageKey,
        int sortOrder = 0) : base()
    {
        if (productId == Guid.Empty)
            throw new ArgumentException("Product ID cannot be empty.", nameof(productId));

        if (string.IsNullOrWhiteSpace(storageKey))
            throw new ArgumentException("Storage key cannot be empty.", nameof(storageKey));

        ProductId = productId;
        StorageKey = storageKey.Trim();
        SortOrder = sortOrder;
    }
}
