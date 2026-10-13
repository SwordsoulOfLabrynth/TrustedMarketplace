using TrustedMarketplace.Application.Orders.Dtos;

namespace TrustedMarketplace.Application.Orders;

public interface IOrderService
{
    Task<OrderDto> CreateOrderAsync(Guid buyerUserId, CreateOrderRequest request, CancellationToken ct = default);
    Task<OrderDto?> GetOrderByIdAsync(Guid orderId, Guid callerUserId, bool isAdmin, CancellationToken ct = default);
    Task<IReadOnlyList<OrderDto>> GetBuyerOrdersAsync(Guid buyerUserId, CancellationToken ct = default);
    Task<IReadOnlyList<OrderDto>> GetSellerOrdersAsync(Guid sellerUserId, CancellationToken ct = default);
    Task<OrderDto> AcceptOrderAsync(Guid orderId, Guid sellerUserId, CancellationToken ct = default);
    Task<OrderDto> ShipOrderAsync(Guid orderId, Guid sellerUserId, ShipOrderRequest request, CancellationToken ct = default);
    Task<OrderDto> ConfirmDeliveryAsync(Guid orderId, Guid buyerUserId, CancellationToken ct = default);
    Task<OrderDto> CancelOrderAsync(Guid orderId, Guid actorUserId, CancelOrderRequest request, CancellationToken ct = default);
    Task<OrderDto> ResolveDisputeAsync(Guid orderId, Guid adminUserId, ResolveDisputeRequest request, string correlationId, CancellationToken ct = default);
}
