using TrustedMarketplace.Domain.Common;

namespace TrustedMarketplace.Domain.Subscriptions;

public class SellerSubscription : BaseEntity
{
    public Guid SellerUserId { get; private set; }
    public Guid SubscriptionPlanId { get; private set; }
    public SubscriptionStatus Status { get; private set; } = SubscriptionStatus.Active;
    public DateTime StartsAtUtc { get; private set; }
    public DateTime ExpiresAtUtc { get; private set; }
    public Guid? AssignedByUserId { get; private set; }

    // Navigation property
    public SubscriptionPlan? SubscriptionPlan { get; private set; }

    private SellerSubscription() : base() { }

    public SellerSubscription(
        Guid sellerUserId,
        Guid subscriptionPlanId,
        DateTime startsAtUtc,
        DateTime expiresAtUtc,
        Guid? assignedByUserId = null) : base()
    {
        SellerUserId = sellerUserId;
        SubscriptionPlanId = subscriptionPlanId;
        StartsAtUtc = startsAtUtc;
        ExpiresAtUtc = expiresAtUtc;
        AssignedByUserId = assignedByUserId;
        Status = SubscriptionStatus.Active;
    }

    public void Cancel()
    {
        Status = SubscriptionStatus.Cancelled;
    }

    public void CheckExpiration(DateTime utcNow)
    {
        if (Status == SubscriptionStatus.Active && utcNow > ExpiresAtUtc)
        {
            Status = SubscriptionStatus.Expired;
        }
    }
}
