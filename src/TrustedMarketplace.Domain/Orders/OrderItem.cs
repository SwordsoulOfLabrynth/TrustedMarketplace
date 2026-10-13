using TrustedMarketplace.Domain.Catalog;
using TrustedMarketplace.Domain.Common;

namespace TrustedMarketplace.Domain.Orders;

public class OrderItem : BaseEntity
{
    public Guid OrderId { get; private set; }
    public Guid? ProductId { get; private set; }
    public string ProductTitleSnapshot { get; private set; } = string.Empty;
    public decimal UnitPriceSnapshot { get; private set; }
    public int Quantity { get; private set; } = 1;
    public string ConditionSnapshot { get; private set; } = string.Empty;

    // Navigation properties
    public Order? Order { get; private set; }
    public Product? Product { get; private set; }

    private OrderItem() : base() { }

    public OrderItem(
        Guid orderId,
        Guid? productId,
        string productTitleSnapshot,
        decimal unitPriceSnapshot,
        int quantity,
        string conditionSnapshot) : base()
    {
        OrderId = orderId;
        ProductId = productId;
        ProductTitleSnapshot = productTitleSnapshot.Trim();
        UnitPriceSnapshot = unitPriceSnapshot;
        Quantity = Math.Max(1, quantity);
        ConditionSnapshot = conditionSnapshot.Trim();
    }
}
