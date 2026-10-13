using TrustedMarketplace.Domain.Common;
using TrustedMarketplace.Domain.Common.Exceptions;
using TrustedMarketplace.Domain.Stores;

namespace TrustedMarketplace.Domain.Catalog;

public class Product : BaseEntity
{
    private readonly List<ProductImage> _images = new();

    public Guid SellerUserId { get; private set; }
    public Guid SellerProfileId { get; private set; }
    public Guid CategoryId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public decimal PriceAmount { get; private set; }
    public string CurrencyCode { get; private set; } = "MMK";
    public ProductCondition Condition { get; private set; } = ProductCondition.New;
    public ProductStatus Status { get; private set; } = ProductStatus.Draft;

    // Navigation properties
    public SellerProfile? SellerProfile { get; private set; }
    public Category? Category { get; private set; }
    public IReadOnlyCollection<ProductImage> Images => _images.AsReadOnly();

    private Product() : base() { }

    public Product(
        Guid sellerUserId,
        Guid sellerProfileId,
        Guid categoryId,
        string title,
        string description,
        decimal priceAmount,
        ProductCondition condition,
        string currencyCode = "MMK") : base()
    {
        if (sellerUserId == Guid.Empty)
            throw new ArgumentException("Seller user ID cannot be empty.", nameof(sellerUserId));

        if (sellerProfileId == Guid.Empty)
            throw new ArgumentException("Seller profile ID cannot be empty.", nameof(sellerProfileId));

        if (categoryId == Guid.Empty)
            throw new ArgumentException("Category ID cannot be empty.", nameof(categoryId));

        ValidateInputs(title, description, priceAmount);

        SellerUserId = sellerUserId;
        SellerProfileId = sellerProfileId;
        CategoryId = categoryId;
        Title = title.Trim();
        Description = description.Trim();
        PriceAmount = priceAmount;
        Condition = condition;
        CurrencyCode = string.IsNullOrWhiteSpace(currencyCode) ? "MMK" : currencyCode.Trim().ToUpperInvariant();
        Status = ProductStatus.Draft;
    }

    public void Update(
        string title,
        string description,
        decimal priceAmount,
        ProductCondition condition,
        Guid categoryId)
    {
        if (Status == ProductStatus.Archived)
            throw new DomainException("Cannot edit an archived product.");

        if (categoryId == Guid.Empty)
            throw new ArgumentException("Category ID cannot be empty.", nameof(categoryId));

        ValidateInputs(title, description, priceAmount);

        Title = title.Trim();
        Description = description.Trim();
        PriceAmount = priceAmount;
        Condition = condition;
        CategoryId = categoryId;
    }

    public void Publish()
    {
        if (Status == ProductStatus.Archived)
            throw new DomainException("Cannot publish an archived product.");

        Status = ProductStatus.Published;
    }

    public void Archive()
    {
        Status = ProductStatus.Archived;
    }

    public ProductImage AddImage(string storageKey, int sortOrder = 0)
    {
        var image = new ProductImage(Id, storageKey, sortOrder);
        _images.Add(image);
        return image;
    }

    private static void ValidateInputs(string title, string description, decimal priceAmount)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new DomainException("Product title cannot be empty.");

        if (title.Length > 200)
            throw new DomainException("Product title cannot exceed 200 characters.");

        if (string.IsNullOrWhiteSpace(description))
            throw new DomainException("Product description cannot be empty.");

        if (priceAmount < 0)
            throw new DomainException("Price amount cannot be negative.");
    }
}
