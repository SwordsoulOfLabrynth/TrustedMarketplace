using TrustedMarketplace.Domain.Subscriptions;
using TrustedMarketplace.Infrastructure.Persistence.Configurations;

namespace TrustedMarketplace.UnitTests.Subscriptions;

public class SubscriptionPlanPricingTests
{
    [Fact]
    public void CanonicalPlans_HaveExpectedPricingAndListingQuotas()
    {
        // Free plan
        var freePlan = new SubscriptionPlan(
            SubscriptionPlanConfiguration.FreePlanId,
            "Free",
            10,
            0m,
            "MMK",
            "Monthly",
            true);

        Assert.Equal(SubscriptionPlanConfiguration.FreePlanId, freePlan.Id);
        Assert.Equal("Free", freePlan.Name);
        Assert.Equal(10, freePlan.MaxActiveListings);
        Assert.Equal(0m, freePlan.PriceAmount);
        Assert.Equal("MMK", freePlan.CurrencyCode);
        Assert.Equal("Monthly", freePlan.BillingPeriod);
        Assert.True(freePlan.IsActive);

        // Standard plan
        var standardPlan = new SubscriptionPlan(
            SubscriptionPlanConfiguration.StandardPlanId,
            "Standard",
            30,
            15000m,
            "MMK",
            "Monthly",
            true);

        Assert.Equal(SubscriptionPlanConfiguration.StandardPlanId, standardPlan.Id);
        Assert.Equal("Standard", standardPlan.Name);
        Assert.Equal(30, standardPlan.MaxActiveListings);
        Assert.Equal(15000m, standardPlan.PriceAmount);
        Assert.Equal("MMK", standardPlan.CurrencyCode);
        Assert.Equal("Monthly", standardPlan.BillingPeriod);
        Assert.True(standardPlan.IsActive);

        // Premium plan (Updated to 30,000 MMK/month)
        var premiumPlan = new SubscriptionPlan(
            SubscriptionPlanConfiguration.PremiumPlanId,
            "Premium",
            100,
            30000m,
            "MMK",
            "Monthly",
            true);

        Assert.Equal(SubscriptionPlanConfiguration.PremiumPlanId, premiumPlan.Id);
        Assert.Equal("Premium", premiumPlan.Name);
        Assert.Equal(100, premiumPlan.MaxActiveListings);
        Assert.Equal(30000m, premiumPlan.PriceAmount);
        Assert.Equal("MMK", premiumPlan.CurrencyCode);
        Assert.Equal("Monthly", premiumPlan.BillingPeriod);
        Assert.True(premiumPlan.IsActive);
    }

    [Theory]
    [InlineData(1, 30000)]
    [InlineData(3, 90000)]
    [InlineData(6, 180000)]
    [InlineData(12, 360000)]
    public void PremiumPlan_MultiMonthPaymentCalculation_MatchesExpectedTotal(int durationMonths, decimal expectedTotal)
    {
        var premiumPlan = new SubscriptionPlan(
            SubscriptionPlanConfiguration.PremiumPlanId,
            "Premium",
            100,
            30000m,
            "MMK",
            "Monthly",
            true);

        var totalAmount = premiumPlan.PriceAmount * durationMonths;

        Assert.Equal(expectedTotal, totalAmount);
    }

    [Fact]
    public void SubscriptionPlan_UpdatePrice_ModifiesPriceCorrectly()
    {
        var plan = new SubscriptionPlan(
            SubscriptionPlanConfiguration.PremiumPlanId,
            "Premium",
            100,
            45000m,
            "MMK",
            "Monthly",
            true);

        plan.UpdatePrice(30000m);

        Assert.Equal(30000m, plan.PriceAmount);
    }

    [Fact]
    public void SubscriptionPlan_UpdatePrice_NegativePrice_ThrowsArgumentOutOfRangeException()
    {
        var plan = new SubscriptionPlan(
            SubscriptionPlanConfiguration.PremiumPlanId,
            "Premium",
            100,
            30000m,
            "MMK",
            "Monthly",
            true);

        Assert.Throws<ArgumentOutOfRangeException>(() => plan.UpdatePrice(-1000m));
    }
}
