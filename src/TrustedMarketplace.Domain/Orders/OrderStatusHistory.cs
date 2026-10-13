using TrustedMarketplace.Domain.Common;

namespace TrustedMarketplace.Domain.Orders;

public class OrderStatusHistory : BaseEntity
{
    public Guid OrderId { get; private set; }
    public Guid ActorUserId { get; private set; }
    public string PreviousStatus { get; private set; } = string.Empty;
    public string NewStatus { get; private set; } = string.Empty;
    public string? Reason { get; private set; }

    // Navigation property
    public Order? Order { get; private set; }

    private OrderStatusHistory() : base() { }

    public OrderStatusHistory(
        Guid orderId,
        Guid actorUserId,
        string previousStatus,
        string newStatus,
        string? reason = null) : base()
    {
        OrderId = orderId;
        ActorUserId = actorUserId;
        PreviousStatus = previousStatus.Trim();
        NewStatus = newStatus.Trim();
        Reason = reason?.Trim();
    }
}
