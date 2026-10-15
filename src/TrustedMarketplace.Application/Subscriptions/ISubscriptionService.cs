using TrustedMarketplace.Application.Subscriptions.Dtos;

namespace TrustedMarketplace.Application.Subscriptions;

public interface ISubscriptionService
{
    Task<IReadOnlyList<SubscriptionPlanDto>> GetActivePlansAsync(CancellationToken ct = default);
    Task<SellerSubscriptionDto?> GetSellerSubscriptionAsync(Guid sellerUserId, CancellationToken ct = default);
    Task<SellerQuotaDto> GetSellerQuotaAsync(Guid sellerUserId, CancellationToken ct = default);
    Task<SellerSubscriptionDto> AssignSubscriptionAsync(Guid sellerUserId, Guid adminUserId, AssignSubscriptionRequest request, string correlationId, CancellationToken ct = default);
    Task<SellerSubscriptionDto> SubmitSubscriptionPaymentAsync(Guid sellerUserId, SubmitSubscriptionPaymentRequest request, string correlationId, CancellationToken ct = default);
    Task<IReadOnlyList<SellerSubscriptionDto>> GetSubscriptionsForAdminAsync(string? statusFilter = null, CancellationToken ct = default);
    Task<SellerSubscriptionDto> VerifySubscriptionPaymentAsync(Guid subscriptionId, Guid adminUserId, VerifySubscriptionPaymentRequest request, string correlationId, CancellationToken ct = default);
    Task<IReadOnlyList<PlatformPaymentMethodDto>> GetPlatformPaymentMethodsAsync(CancellationToken ct = default);
}
