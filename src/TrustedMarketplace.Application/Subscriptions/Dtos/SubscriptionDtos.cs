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
    DateTime ExpiresAtUtc,
    string? PaymentMethod = null,
    string? TransactionReference = null,
    decimal? PaymentAmount = null,
    string? PaymentCurrency = null,
    DateTime? PaymentSubmittedAtUtc = null,
    string? RejectionReason = null,
    string? StoreName = null,
    int? DurationMonths = null
);

public record AssignSubscriptionRequest(
    Guid SubscriptionPlanId,
    int DurationMonths = 1
);

public record SubmitSubscriptionPaymentRequest(
    Guid SubscriptionPlanId,
    string PaymentMethod,
    string TransactionReference,
    int DurationMonths = 1
);

public record VerifySubscriptionPaymentRequest(
    string Decision,
    string? Reason = null,
    int DurationMonths = 1
);

public record PlatformPaymentMethodDto(
    string Provider,
    string AccountName,
    string AccountPhone,
    string Instructions,
    string? QrCodeUrl = null
);

public record SellerQuotaDto(
    string PlanName,
    int MaxActiveListings,
    int CurrentActiveListings,
    bool CanPublishMore
);
