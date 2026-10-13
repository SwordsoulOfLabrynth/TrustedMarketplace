namespace TrustedMarketplace.Application.Subscriptions.Dtos;

public record SubscriptionPlanDto(
    Guid Id,
    string Name,
    int MaxActiveListings,
    decimal PriceAmount,
    string CurrencyCode,
    string BillingPeriod,
    bool IsActive
);

public record SellerSubscriptionDto(
    Guid Id,
    Guid SellerUserId,
    string PlanName,
    int MaxActiveListings,
    string Status,
    DateTime StartsAtUtc,
    DateTime ExpiresAtUtc
);

public record AssignSubscriptionRequest(
    Guid SubscriptionPlanId,
    int DurationMonths = 1
);

public record SellerQuotaDto(
    string PlanName,
    int MaxActiveListings,
    int CurrentActiveListings,
    bool CanPublishMore
);
