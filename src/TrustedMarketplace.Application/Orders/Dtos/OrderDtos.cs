namespace TrustedMarketplace.Application.Orders.Dtos;

public record CreateOrderRequest(
    Guid ProductId,
    int Quantity,
    string BuyerContactPhone,
    string DeliveryAddress,
    string DeliveryCityOrTownship,
    string? DeliveryNotes = null
);

public record OrderItemDto(
    Guid Id,
    Guid? ProductId,
    string ProductTitle,
    decimal UnitPrice,
    int Quantity,
    string Condition,
    string? PrimaryImageUrl = null
);

public record OrderStatusHistoryDto(
    Guid Id,
    Guid ActorUserId,
    string PreviousStatus,
    string NewStatus,
    string? Reason,
    DateTime CreatedAtUtc
);

public record OrderDto(
    Guid Id,
    Guid BuyerUserId,
    Guid SellerUserId,
    Guid SellerProfileId,
    string Status,
    decimal SubtotalAmount,
    string CurrencyCode,
    string BuyerContactPhone,
    string DeliveryAddress,
    string DeliveryCityOrTownship,
    string? DeliveryNotes,
    string? CourierTrackingReference,
    DateTime? ShippedAtUtc,
    DateTime? CompletedAtUtc,
    DateTime CreatedAtUtc,
    List<OrderItemDto> Items,
    List<OrderStatusHistoryDto> History
);

public record ShipOrderRequest(
    string? CourierTrackingReference = null
);

public record CancelOrderRequest(
    string Reason
);

public record ResolveDisputeRequest(
    string ResolvedStatus, // "Completed" or "Cancelled"
    string Reason
);
