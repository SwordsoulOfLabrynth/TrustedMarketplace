using TrustedMarketplace.Domain.Catalog;
using TrustedMarketplace.Domain.Common.Exceptions;

namespace TrustedMarketplace.UnitTests.Catalog;

public class ProductDomainTests
{
    [Fact]
    public void NewProduct_ValidData_InitializesInDraftStatus()
    {
        var sellerUserId = Guid.NewGuid();
        var sellerProfileId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();

        var product = new Product(
            sellerUserId,
            sellerProfileId,
            categoryId,
            "Teakwood Carving",
            "Handmade teak carving from Mandalay",
            75000m,
            ProductCondition.New);

        Assert.Equal(sellerUserId, product.SellerUserId);
        Assert.Equal(sellerProfileId, product.SellerProfileId);
        Assert.Equal(categoryId, product.CategoryId);
        Assert.Equal("Teakwood Carving", product.Title);
        Assert.Equal(75000m, product.PriceAmount);
        Assert.Equal("MMK", product.CurrencyCode);
        Assert.Equal(ProductCondition.New, product.Condition);
        Assert.Equal(ProductStatus.Draft, product.Status);
    }

    [Theory]
    [InlineData("", "Valid description", 1000)]
    [InlineData("Valid Title", "", 1000)]
    [InlineData("Valid Title", "Valid description", -10)]
    public void NewProduct_InvalidData_ThrowsDomainException(string title, string description, decimal price)
    {
        Assert.Throws<DomainException>(() =>
            new Product(
                Guid.NewGuid(),
                Guid.NewGuid(),
                Guid.NewGuid(),
                title,
                description,
                price,
                ProductCondition.New));
    }

    [Fact]
    public void PublishAndArchive_ValidTransitions_UpdatesStatus()
    {
        var product = new Product(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            "Title", "Desc", 1000, ProductCondition.New);

        product.Publish();
        Assert.Equal(ProductStatus.Published, product.Status);

        product.Archive();
        Assert.Equal(ProductStatus.Archived, product.Status);
    }

    [Fact]
    public void EditOrPublish_WhenArchived_ThrowsDomainException()
    {
        var product = new Product(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            "Title", "Desc", 1000, ProductCondition.New);

        product.Archive();

        Assert.Throws<DomainException>(() => product.Publish());
        Assert.Throws<DomainException>(() =>
            product.Update("New Title", "New Desc", 2000, ProductCondition.Used, Guid.NewGuid()));
    }
}
