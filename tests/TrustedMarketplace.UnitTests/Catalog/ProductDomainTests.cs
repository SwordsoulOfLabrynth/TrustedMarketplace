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

    [Fact]
    public void AddImage_AssignsSortOrderAndPrimaryCorrectly()
    {
        var product = new Product(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            "Title", "Desc", 1000, ProductCondition.New);

        var img1 = product.AddImage("products/1.jpg", originalFileName: "1.jpg", mimeType: "image/jpeg", fileSizeBytes: 1024);
        var img2 = product.AddImage("products/2.png", originalFileName: "2.png", mimeType: "image/png", fileSizeBytes: 2048);

        Assert.Equal(2, product.Images.Count);
        Assert.Equal(0, img1.SortOrder);
        Assert.True(img1.IsPrimary);
        Assert.Equal(1, img2.SortOrder);
        Assert.False(img2.IsPrimary);
        Assert.Equal("1.jpg", img1.OriginalFileName);
        Assert.Equal("image/jpeg", img1.MimeType);
        Assert.Equal(1024, img1.FileSizeBytes);
    }

    [Fact]
    public void AddImage_ExceedingMaxLimit_ThrowsDomainException()
    {
        var product = new Product(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            "Title", "Desc", 1000, ProductCondition.New);

        for (var i = 0; i < Product.MaxImagesPerProduct; i++)
        {
            product.AddImage($"products/{i}.jpg");
        }

        Assert.Equal(Product.MaxImagesPerProduct, product.Images.Count);
        var ex = Assert.Throws<DomainException>(() => product.AddImage("products/overflow.jpg"));
        Assert.Contains("cannot have more than", ex.Message);
    }

    [Fact]
    public void RemoveImage_PromotesNextImageToPrimary()
    {
        var product = new Product(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            "Title", "Desc", 1000, ProductCondition.New);

        var img1 = product.AddImage("products/1.jpg");
        var img2 = product.AddImage("products/2.jpg");
        var img3 = product.AddImage("products/3.jpg");

        product.RemoveImage(img1.Id);

        Assert.Equal(2, product.Images.Count);
        Assert.Equal(0, img2.SortOrder);
        Assert.True(img2.IsPrimary);
        Assert.Equal(1, img3.SortOrder);
        Assert.False(img3.IsPrimary);
    }

    [Fact]
    public void SetPrimaryImage_UpdatesSortOrderSequencing()
    {
        var product = new Product(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            "Title", "Desc", 1000, ProductCondition.New);

        var img1 = product.AddImage("products/1.jpg");
        var img2 = product.AddImage("products/2.jpg");
        var img3 = product.AddImage("products/3.jpg");

        product.SetPrimaryImage(img3.Id);

        Assert.Equal(0, img3.SortOrder);
        Assert.True(img3.IsPrimary);
        Assert.Equal(1, img1.SortOrder);
        Assert.Equal(2, img2.SortOrder);
    }

    [Fact]
    public void ReorderImages_ValidList_ReordersSuccessfully()
    {
        var product = new Product(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            "Title", "Desc", 1000, ProductCondition.New);

        var img1 = product.AddImage("products/1.jpg");
        var img2 = product.AddImage("products/2.jpg");

        product.ReorderImages(new[] { img2.Id, img1.Id });

        Assert.Equal(0, img2.SortOrder);
        Assert.Equal(1, img1.SortOrder);
    }

    [Fact]
    public void ReorderImages_MismatchedList_ThrowsDomainException()
    {
        var product = new Product(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            "Title", "Desc", 1000, ProductCondition.New);

        var img1 = product.AddImage("products/1.jpg");

        Assert.Throws<DomainException>(() => product.ReorderImages(new[] { Guid.NewGuid() }));
    }
}
