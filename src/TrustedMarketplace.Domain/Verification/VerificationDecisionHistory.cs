using TrustedMarketplace.Domain.Common;

namespace TrustedMarketplace.Domain.Verification;

public class VerificationDecisionHistory : BaseEntity
{
    public Guid SellerApplicationId { get; private set; }
    public Guid ActorUserId { get; private set; }
    public string PreviousStatus { get; private set; } = string.Empty;
    public string NewStatus { get; private set; } = string.Empty;
    public string? Reason { get; private set; }

    // Navigation property
    public SellerApplication? SellerApplication { get; private set; }

    private VerificationDecisionHistory() : base() { }

    public VerificationDecisionHistory(
        Guid sellerApplicationId,
        Guid actorUserId,
        string previousStatus,
        string newStatus,
        string? reason) : base()
    {
        if (sellerApplicationId == Guid.Empty)
            throw new ArgumentException("Seller application ID cannot be empty.", nameof(sellerApplicationId));

        if (actorUserId == Guid.Empty)
            throw new ArgumentException("Actor user ID cannot be empty.", nameof(actorUserId));

        if (string.IsNullOrWhiteSpace(previousStatus))
            throw new ArgumentException("Previous status cannot be empty.", nameof(previousStatus));

        if (string.IsNullOrWhiteSpace(newStatus))
            throw new ArgumentException("New status cannot be empty.", nameof(newStatus));

        SellerApplicationId = sellerApplicationId;
        ActorUserId = actorUserId;
        PreviousStatus = previousStatus;
        NewStatus = newStatus;
        Reason = reason;
    }
}
