namespace TrustedMarketplace.Domain.Subscriptions;

public enum SubscriptionStatus
{
    Active = 0,
    Expired = 1,
    Cancelled = 2,
    PendingVerification = 3,
    Rejected = 4
}
