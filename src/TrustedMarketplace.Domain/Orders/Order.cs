using TrustedMarketplace.Domain.Common;
using TrustedMarketplace.Domain.Common.Exceptions;
using TrustedMarketplace.Domain.Stores;

namespace TrustedMarketplace.Domain.Orders;

public class Order : BaseEntity
{
    private readonly List<OrderItem> _items = new();
    private readonly List<OrderStatusHistory> _history = new();

    public Guid BuyerUserId { get; private set; }
    public Guid SellerUserId { get; private set; }
    public Guid SellerProfileId { get; private set; }
    public OrderStatus Status { get; private set; } = OrderStatus.Placed;
    public string CurrencyCode { get; private set; } = "MMK";
    public decimal SubtotalAmount { get; private set; }
    public string BuyerContactPhone { get; private set; } = string.Empty;
    public string DeliveryAddressSnapshot { get; private set; } = string.Empty;
    public string DeliveryCityOrTownshipSnapshot { get; private set; } = string.Empty;
    public string? DeliveryNotes { get; private set; }
    public string? CourierTrackingReference { get; private set; }
    public DateTime? ShippedAtUtc { get; private set; }
    public DateTime? CompletedAtUtc { get; private set; }
    public Guid? CompletedByUserId { get; private set; }

    // Navigation properties
    public SellerProfile? SellerProfile { get; private set; }
    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();
    public IReadOnlyCollection<OrderStatusHistory> History => _history.AsReadOnly();

    private Order() : base() { }

    public Order(
        Guid buyerUserId,
        Guid sellerUserId,
        Guid sellerProfileId,
        decimal subtotalAmount,
        string buyerContactPhone,
        string deliveryAddressSnapshot,
        string deliveryCityOrTownshipSnapshot,
        string? deliveryNotes = null,
        string currencyCode = "MMK") : base()
    {
        if (buyerUserId == Guid.Empty)
            throw new ArgumentException("Buyer user ID cannot be empty.", nameof(buyerUserId));

        if (sellerUserId == Guid.Empty)
            throw new ArgumentException("Seller user ID cannot be empty.", nameof(sellerUserId));

        if (buyerUserId == sellerUserId)
            throw new DomainException("Buyer and seller cannot be the same account.");

        if (sellerProfileId == Guid.Empty)
            throw new ArgumentException("Seller profile ID cannot be empty.", nameof(sellerProfileId));

        if (string.IsNullOrWhiteSpace(buyerContactPhone))
            throw new DomainException("Buyer contact phone cannot be empty.");

        if (string.IsNullOrWhiteSpace(deliveryAddressSnapshot))
            throw new DomainException("Delivery address cannot be empty.");

        if (string.IsNullOrWhiteSpace(deliveryCityOrTownshipSnapshot))
            throw new DomainException("Delivery city/township cannot be empty.");

        BuyerUserId = buyerUserId;
        SellerUserId = sellerUserId;
        SellerProfileId = sellerProfileId;
        SubtotalAmount = subtotalAmount;
        BuyerContactPhone = buyerContactPhone.Trim();
        DeliveryAddressSnapshot = deliveryAddressSnapshot.Trim();
        DeliveryCityOrTownshipSnapshot = deliveryCityOrTownshipSnapshot.Trim();
        DeliveryNotes = deliveryNotes?.Trim();
        CurrencyCode = string.IsNullOrWhiteSpace(currencyCode) ? "MMK" : currencyCode.Trim().ToUpperInvariant();
        Status = OrderStatus.Placed;

        _history.Add(new OrderStatusHistory(Id, buyerUserId, "None", OrderStatus.Placed.ToString(), "Order placed by buyer"));
    }

    public OrderItem AddItem(
        Guid? productId,
        string productTitle,
        decimal unitPrice,
        int quantity,
        string condition)
    {
        var item = new OrderItem(Id, productId, productTitle, unitPrice, quantity, condition);
        _items.Add(item);
        SubtotalAmount = _items.Sum(i => i.UnitPriceSnapshot * i.Quantity);
        return item;
    }

    public OrderStatusHistory Accept(Guid sellerUserId)
    {
        if (sellerUserId != SellerUserId)
            throw new DomainException("Only the seller of this order can accept it.");

        if (Status != OrderStatus.Placed)
            throw new DomainException($"Cannot accept order in '{Status}' status. Order must be Placed.");

        var prev = Status.ToString();
        Status = OrderStatus.Accepted;
        var entry = new OrderStatusHistory(Id, sellerUserId, prev, Status.ToString(), "Order accepted by seller");
        _history.Add(entry);
        return entry;
    }

    public OrderStatusHistory Ship(Guid sellerUserId, string? courierTrackingRef = null)
    {
        if (sellerUserId != SellerUserId)
            throw new DomainException("Only the seller of this order can mark it shipped.");

        if (Status != OrderStatus.Accepted)
            throw new DomainException($"Cannot ship order in '{Status}' status. Order must be Accepted first.");

        var prev = Status.ToString();
        Status = OrderStatus.Shipped;
        ShippedAtUtc = DateTime.UtcNow;
        CourierTrackingReference = courierTrackingRef?.Trim();
        var entry = new OrderStatusHistory(Id, sellerUserId, prev, Status.ToString(), "Order dispatched by seller");
        _history.Add(entry);
        return entry;
    }

    /// <summary>
    /// Buyer confirmation of delivery (SEC-07, SEC-08). Only the buyer can complete the order.
    /// </summary>
    public OrderStatusHistory ConfirmDelivery(Guid buyerUserId)
    {
        if (buyerUserId != BuyerUserId)
            throw new DomainException("Only the buyer who placed the order can confirm delivery (SEC-07).");

        if (Status != OrderStatus.Shipped)
            throw new DomainException($"Cannot confirm delivery for order in '{Status}' status. Order must be Shipped.");

        var prev = Status.ToString();
        Status = OrderStatus.Completed;
        CompletedAtUtc = DateTime.UtcNow;
        CompletedByUserId = buyerUserId;
        var entry = new OrderStatusHistory(Id, buyerUserId, prev, Status.ToString(), "Buyer confirmed delivery received");
        _history.Add(entry);
        return entry;
    }

    public OrderStatusHistory Cancel(Guid actorUserId, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new DomainException("A cancellation reason is required.");

        if (actorUserId == BuyerUserId)
        {
            if (Status != OrderStatus.Placed)
                throw new DomainException("Buyer can only cancel an order while it is still in Placed status.");
        }
        else if (actorUserId == SellerUserId)
        {
            if (Status != OrderStatus.Placed && Status != OrderStatus.Accepted)
                throw new DomainException("Seller cannot cancel an order that has already been shipped.");
        }

        var prev = Status.ToString();
        Status = OrderStatus.Cancelled;
        var entry = new OrderStatusHistory(Id, actorUserId, prev, Status.ToString(), reason.Trim());
        _history.Add(entry);
        return entry;
    }

    public OrderStatusHistory MarkDisputed(Guid actorUserId, string reason)
    {
        if (actorUserId != BuyerUserId && actorUserId != SellerUserId)
            throw new DomainException("Only order participants can initiate a dispute.");

        if (Status == OrderStatus.Completed || Status == OrderStatus.Cancelled)
            throw new DomainException($"Cannot dispute a {Status} order.");

        var prev = Status.ToString();
        Status = OrderStatus.Disputed;
        var entry = new OrderStatusHistory(Id, actorUserId, prev, Status.ToString(), reason.Trim());
        _history.Add(entry);
        return entry;
    }

    public OrderStatusHistory AdminResolveDispute(Guid adminUserId, OrderStatus resolvedStatus, string reason)
    {
        if (resolvedStatus != OrderStatus.Completed && resolvedStatus != OrderStatus.Cancelled)
            throw new DomainException("Dispute can only be resolved to Completed or Cancelled.");

        if (Status != OrderStatus.Disputed)
            throw new DomainException("Order is not currently in Disputed status.");

        var prev = Status.ToString();
        Status = resolvedStatus;

        if (resolvedStatus == OrderStatus.Completed)
        {
            CompletedAtUtc = DateTime.UtcNow;
            CompletedByUserId = adminUserId;
        }

        var entry = new OrderStatusHistory(Id, adminUserId, prev, Status.ToString(), $"Admin resolution: {reason.Trim()}");
        _history.Add(entry);
        return entry;
    }
}
