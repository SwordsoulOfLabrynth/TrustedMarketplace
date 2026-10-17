using TrustedMarketplace.Domain.Common;

namespace TrustedMarketplace.Domain.Subscriptions;

public class SubscriptionPlan : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public int MaxActiveListings { get; private set; }
    public decimal PriceAmount { get; private set; }
    public string CurrencyCode { get; private set; } = "MMK";
    public string BillingPeriod { get; private set; } = "Monthly";
    public bool IsActive { get; private set; } = true;

    private SubscriptionPlan() : base() { }

    public SubscriptionPlan(
        Guid id,
        string name,
        int maxActiveListings,
        decimal priceAmount,
        string currencyCode = "MMK",
        string billingPeriod = "Monthly",
        bool isActive = true) : base()
    {
        Id = id == Guid.Empty ? Guid.NewGuid() : id;
        Name = name.Trim();
        MaxActiveListings = maxActiveListings;
        PriceAmount = priceAmount;
        CurrencyCode = currencyCode.Trim().ToUpperInvariant();
        BillingPeriod = billingPeriod.Trim();
        IsActive = isActive;
    }

    public void UpdatePrice(decimal newPrice)
    {
        if (newPrice < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(newPrice), "Subscription plan price cannot be negative.");
        }

        PriceAmount = newPrice;
    }
}
