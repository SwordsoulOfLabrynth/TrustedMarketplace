using TrustedMarketplace.Domain.Common;
using TrustedMarketplace.Domain.Common.Exceptions;
using TrustedMarketplace.Domain.Orders;

namespace TrustedMarketplace.Domain.Reviews;

public class Review : BaseEntity
{
    public Guid OrderId { get; private set; }
    public Guid ReviewerUserId { get; private set; }
    public Guid SellerUserId { get; private set; }
    public int Rating { get; private set; }
    public string Comment { get; private set; } = string.Empty;
    public ModerationStatus ModerationStatus { get; private set; } = ModerationStatus.Published;

    // Navigation property
    public Order? Order { get; private set; }

    private Review() : base() { }

    public Review(
        Guid orderId,
        Guid reviewerUserId,
        Guid sellerUserId,
        int rating,
        string comment) : base()
    {
        if (orderId == Guid.Empty)
            throw new ArgumentException("Order ID cannot be empty.", nameof(orderId));

        if (reviewerUserId == Guid.Empty)
            throw new ArgumentException("Reviewer user ID cannot be empty.", nameof(reviewerUserId));

        if (sellerUserId == Guid.Empty)
            throw new ArgumentException("Seller user ID cannot be empty.", nameof(sellerUserId));

        if (reviewerUserId == sellerUserId)
            throw new DomainException("Sellers cannot review their own transactions.");

        if (rating < 1 || rating > 5)
            throw new DomainException("Review rating must be between 1 and 5 stars.");

        if (string.IsNullOrWhiteSpace(comment))
            throw new DomainException("Review comment cannot be empty.");

        OrderId = orderId;
        ReviewerUserId = reviewerUserId;
        SellerUserId = sellerUserId;
        Rating = rating;
        Comment = comment.Trim();
        ModerationStatus = ModerationStatus.Published;
    }

    public void Moderate(ModerationStatus status)
    {
        ModerationStatus = status;
    }
}
