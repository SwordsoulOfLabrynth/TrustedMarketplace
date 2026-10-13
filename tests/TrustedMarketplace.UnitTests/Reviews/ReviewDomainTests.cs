using TrustedMarketplace.Domain.Reviews;
using Xunit;

namespace TrustedMarketplace.UnitTests.Reviews;

public class ReviewDomainTests
{
    private readonly Guid _orderId = Guid.NewGuid();
    private readonly Guid _buyerUserId = Guid.NewGuid();
    private readonly Guid _sellerUserId = Guid.NewGuid();

    [Theory]
    [InlineData(1)]
    [InlineData(3)]
    [InlineData(5)]
    public void Constructor_ValidRating_InitializesReview(int rating)
    {
        var review = new Review(_orderId, _buyerUserId, _sellerUserId, rating, "Great seller, on-time delivery!");

        Assert.Equal(_orderId, review.OrderId);
        Assert.Equal(_buyerUserId, review.ReviewerUserId);
        Assert.Equal(_sellerUserId, review.SellerUserId);
        Assert.Equal(rating, review.Rating);
        Assert.Equal("Great seller, on-time delivery!", review.Comment);
        Assert.Equal(ModerationStatus.Published, review.ModerationStatus);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    [InlineData(-1)]
    public void Constructor_InvalidRating_ThrowsDomainException(int invalidRating)
    {
        Assert.Throws<TrustedMarketplace.Domain.Common.Exceptions.DomainException>(() =>
            new Review(_orderId, _buyerUserId, _sellerUserId, invalidRating, "Comment"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Constructor_InvalidComment_ThrowsDomainException(string? invalidComment)
    {
        Assert.Throws<TrustedMarketplace.Domain.Common.Exceptions.DomainException>(() =>
            new Review(_orderId, _buyerUserId, _sellerUserId, 5, invalidComment!));
    }
}
