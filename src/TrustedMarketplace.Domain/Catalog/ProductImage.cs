using TrustedMarketplace.Domain.Common;

namespace TrustedMarketplace.Domain.Catalog;

public class ProductImage : BaseEntity
{
    public Guid ProductId { get; private set; }
    public string StorageKey { get; private set; } = string.Empty;
    public int SortOrder { get; private set; }
    public string OriginalFileName { get; private set; } = string.Empty;
    public string MimeType { get; private set; } = string.Empty;
    public long FileSizeBytes { get; private set; }

    public bool IsPrimary => SortOrder == 0;

    // Navigation property
    public Product? Product { get; private set; }

    private ProductImage() : base() { }

    public ProductImage(
        Guid productId,
        string storageKey,
        int sortOrder = 0,
        string originalFileName = "",
        string mimeType = "image/jpeg",
        long fileSizeBytes = 0) : base()
    {
        if (productId == Guid.Empty)
            throw new ArgumentException("Product ID cannot be empty.", nameof(productId));

        if (string.IsNullOrWhiteSpace(storageKey))
            throw new ArgumentException("Storage key cannot be empty.", nameof(storageKey));

        ProductId = productId;
        StorageKey = storageKey.Trim();
        SortOrder = sortOrder;
        OriginalFileName = string.IsNullOrWhiteSpace(originalFileName) ? string.Empty : originalFileName.Trim();
        MimeType = string.IsNullOrWhiteSpace(mimeType) ? "image/jpeg" : mimeType.Trim();
        FileSizeBytes = Math.Max(0, fileSizeBytes);
    }

    public void SetSortOrder(int sortOrder)
    {
        SortOrder = sortOrder;
    }
}
