using TrustedMarketplace.Domain.Common;
using TrustedMarketplace.Domain.Common.Exceptions;

namespace TrustedMarketplace.Domain.Subscriptions;

public class SellerSubscription : BaseEntity
{
    public Guid SellerUserId { get; private set; }
    public Guid SubscriptionPlanId { get; private set; }
    public SubscriptionStatus Status { get; private set; } = SubscriptionStatus.Active;
    public DateTime StartsAtUtc { get; private set; }
    public DateTime ExpiresAtUtc { get; private set; }
    public Guid? AssignedByUserId { get; private set; }

    // Payment lifecycle properties
    public string? PaymentMethod { get; private set; }
    public string? TransactionReference { get; private set; }
    public decimal? PaymentAmount { get; private set; }
    public string PaymentCurrency { get; private set; } = "MMK";
    public DateTime? PaymentSubmittedAtUtc { get; private set; }
    public string? PaymentProofStorageKey { get; private set; }
    public Guid? ReviewedByUserId { get; private set; }
    public DateTime? ReviewedAtUtc { get; private set; }
    public string? RejectionReason { get; private set; }

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
        PaymentMethod = "AdminAssigned";
    }

    /// <summary>
    /// Factory for creating a seller subscription with pending payment review.
    /// Never marked as verified or active until explicit administrative verification.
    /// </summary>
    public static SellerSubscription CreatePendingPayment(
        Guid sellerUserId,
        Guid subscriptionPlanId,
        string paymentMethod,
        string transactionReference,
        decimal paymentAmount,
        DateTime submittedAtUtc,
        string? paymentProofStorageKey = null,
        string currencyCode = "MMK")
    {
        if (sellerUserId == Guid.Empty)
            throw new ArgumentException("Seller user ID cannot be empty.", nameof(sellerUserId));

        if (subscriptionPlanId == Guid.Empty)
            throw new ArgumentException("Subscription plan ID cannot be empty.", nameof(subscriptionPlanId));

        if (string.IsNullOrWhiteSpace(paymentMethod))
            throw new DomainException("Payment method is required.");

        if (string.IsNullOrWhiteSpace(transactionReference))
            throw new DomainException("Transaction reference number is required.");

        return new SellerSubscription
        {
            SellerUserId = sellerUserId,
            SubscriptionPlanId = subscriptionPlanId,
            Status = SubscriptionStatus.PendingVerification,
            PaymentMethod = paymentMethod.Trim(),
            TransactionReference = transactionReference.Trim(),
            PaymentAmount = paymentAmount,
            PaymentCurrency = string.IsNullOrWhiteSpace(currencyCode) ? "MMK" : currencyCode.Trim().ToUpperInvariant(),
            PaymentSubmittedAtUtc = submittedAtUtc,
            PaymentProofStorageKey = paymentProofStorageKey?.Trim(),
            StartsAtUtc = submittedAtUtc,
            ExpiresAtUtc = submittedAtUtc
        };
    }

    /// <summary>
    /// Factory for activating the zero-cost Free plan immediately.
    /// </summary>
    public static SellerSubscription CreateFree(Guid sellerUserId, Guid freePlanId, DateTime nowUtc)
    {
        return new SellerSubscription
        {
            SellerUserId = sellerUserId,
            SubscriptionPlanId = freePlanId,
            Status = SubscriptionStatus.Active,
            PaymentMethod = "FreePlan",
            StartsAtUtc = nowUtc,
            ExpiresAtUtc = nowUtc.AddYears(10),
            PaymentAmount = 0m,
            PaymentCurrency = "MMK"
        };
    }

    /// <summary>
    /// Approves a pending subscription payment, activates the plan, and sets expiry.
    /// </summary>
    public void ApprovePayment(Guid adminUserId, int durationMonths, DateTime nowUtc)
    {
        if (Status != SubscriptionStatus.PendingVerification)
            throw new DomainException($"Cannot approve subscription in '{Status}' status. Must be PendingVerification.");

        if (durationMonths <= 0)
            throw new DomainException("Subscription duration must be at least 1 month.");

        Status = SubscriptionStatus.Active;
        ReviewedByUserId = adminUserId;
        ReviewedAtUtc = nowUtc;
        StartsAtUtc = nowUtc;
        ExpiresAtUtc = nowUtc.AddMonths(durationMonths);
        RejectionReason = null;
    }

    /// <summary>
    /// Rejects a pending subscription payment with a required audit reason.
    /// </summary>
    public void RejectPayment(Guid adminUserId, string reason, DateTime nowUtc)
    {
        if (Status != SubscriptionStatus.PendingVerification)
            throw new DomainException($"Cannot reject subscription in '{Status}' status. Must be PendingVerification.");

        if (string.IsNullOrWhiteSpace(reason))
            throw new DomainException("Rejection reason is required.");

        Status = SubscriptionStatus.Rejected;
        ReviewedByUserId = adminUserId;
        ReviewedAtUtc = nowUtc;
        RejectionReason = reason.Trim();
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
