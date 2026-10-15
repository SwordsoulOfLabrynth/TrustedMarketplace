namespace TrustedMarketplace.Domain.Catalog;

public class ProductEmbedding
{
    public Guid ProductId { get; private set; }
    public float[] Vector { get; private set; } = Array.Empty<float>();
    public string ContentHash { get; private set; } = string.Empty;
    public DateTime IndexedAtUtc { get; private set; }

    // Navigation property
    public Product? Product { get; private set; }

    private ProductEmbedding() { }

    public ProductEmbedding(Guid productId, float[] vector, string contentHash)
    {
        if (productId == Guid.Empty)
            throw new ArgumentException("Product ID cannot be empty.", nameof(productId));
        if (vector == null || vector.Length == 0)
            throw new ArgumentException("Embedding vector cannot be empty.", nameof(vector));

        ProductId = productId;
        Vector = vector;
        ContentHash = contentHash ?? string.Empty;
        IndexedAtUtc = DateTime.UtcNow;
    }

    public void Update(float[] vector, string contentHash)
    {
        if (vector == null || vector.Length == 0)
            throw new ArgumentException("Embedding vector cannot be empty.", nameof(vector));

        Vector = vector;
        ContentHash = contentHash ?? string.Empty;
        IndexedAtUtc = DateTime.UtcNow;
    }
}
