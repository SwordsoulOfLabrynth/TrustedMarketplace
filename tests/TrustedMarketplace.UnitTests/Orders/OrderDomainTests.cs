using TrustedMarketplace.Domain.Common.Exceptions;
using TrustedMarketplace.Domain.Orders;
using Xunit;

namespace TrustedMarketplace.UnitTests.Orders;

public class OrderDomainTests
{
    private readonly Guid _buyerUserId = Guid.NewGuid();
    private readonly Guid _sellerUserId = Guid.NewGuid();
    private readonly Guid _sellerProfileId = Guid.NewGuid();

    [Fact]
    public void Constructor_InitializesOrderWithPlacedStatus()
    {
        var order = new Order(
            _buyerUserId,
            _sellerUserId,
            _sellerProfileId,
            subtotalAmount: 15000m,
            buyerContactPhone: "0912345678",
            deliveryAddressSnapshot: "No 1, Main Road",
            deliveryCityOrTownshipSnapshot: "Mandalay",
            deliveryNotes: "Leave at door");

        Assert.Equal(OrderStatus.Placed, order.Status);
        Assert.Equal(_buyerUserId, order.BuyerUserId);
        Assert.Equal(_sellerUserId, order.SellerUserId);
        Assert.Equal(15000m, order.SubtotalAmount);
        Assert.Single(order.History);
        Assert.Equal("Placed", order.History.First().NewStatus);
    }

    [Fact]
    public void AddItem_CalculatesSubtotalCorrectly()
    {
        var order = new Order(
            _buyerUserId,
            _sellerUserId,
            _sellerProfileId,
            subtotalAmount: 0m,
            buyerContactPhone: "0912345678",
            deliveryAddressSnapshot: "No 1, Main Road",
            deliveryCityOrTownshipSnapshot: "Mandalay");

        order.AddItem(Guid.NewGuid(), "Handmade Teak Box", 25000m, 2, "New");

        Assert.Single(order.Items);
        Assert.Equal(50000m, order.SubtotalAmount);
    }

    [Fact]
    public void Accept_TransitionsPlacedToAccepted()
    {
        var order = new Order(
            _buyerUserId,
            _sellerUserId,
            _sellerProfileId,
            subtotalAmount: 1000m,
            buyerContactPhone: "0912345678",
            deliveryAddressSnapshot: "No 1, Main Road",
            deliveryCityOrTownshipSnapshot: "Mandalay");

        order.Accept(_sellerUserId);

        Assert.Equal(OrderStatus.Accepted, order.Status);
        Assert.Equal(2, order.History.Count);
    }

    [Fact]
    public void Ship_TransitionsAcceptedToShipped_WithTracking()
    {
        var order = new Order(
            _buyerUserId,
            _sellerUserId,
            _sellerProfileId,
            subtotalAmount: 1000m,
            buyerContactPhone: "0912345678",
            deliveryAddressSnapshot: "No 1, Main Road",
            deliveryCityOrTownshipSnapshot: "Mandalay");

        order.Accept(_sellerUserId);
        order.Ship(_sellerUserId, "ROYAL-EXPRESS-12345");

        Assert.Equal(OrderStatus.Shipped, order.Status);
        Assert.Equal("ROYAL-EXPRESS-12345", order.CourierTrackingReference);
        Assert.NotNull(order.ShippedAtUtc);
    }

    [Fact]
    public void Ship_Throws_WhenNotInAcceptedStatus()
    {
        var order = new Order(
            _buyerUserId,
            _sellerUserId,
            _sellerProfileId,
            subtotalAmount: 1000m,
            buyerContactPhone: "0912345678",
            deliveryAddressSnapshot: "No 1, Main Road",
            deliveryCityOrTownshipSnapshot: "Mandalay");

        // Attempt to ship directly from Placed
        Assert.Throws<DomainException>(() => order.Ship(_sellerUserId, "TRACK-1"));
    }

    [Fact]
    public void ConfirmDelivery_TransitionsShippedToCompleted_SEC_07_SEC_08()
    {
        var order = new Order(
            _buyerUserId,
            _sellerUserId,
            _sellerProfileId,
            subtotalAmount: 1000m,
            buyerContactPhone: "0912345678",
            deliveryAddressSnapshot: "No 1, Main Road",
            deliveryCityOrTownshipSnapshot: "Mandalay");

        order.Accept(_sellerUserId);
        order.Ship(_sellerUserId, "TRACK-123");
        order.ConfirmDelivery(_buyerUserId);

        Assert.Equal(OrderStatus.Completed, order.Status);
        Assert.NotNull(order.CompletedAtUtc);
    }

    [Fact]
    public void ConfirmDelivery_Throws_WhenNotInShippedStatus()
    {
        var order = new Order(
            _buyerUserId,
            _sellerUserId,
            _sellerProfileId,
            subtotalAmount: 1000m,
            buyerContactPhone: "0912345678",
            deliveryAddressSnapshot: "No 1, Main Road",
            deliveryCityOrTownshipSnapshot: "Mandalay");

        // Attempt to confirm delivery while only Placed
        Assert.Throws<DomainException>(() => order.ConfirmDelivery(_buyerUserId));
    }

    [Fact]
    public void Cancel_AllowsCancellationFromPlaced()
    {
        var order = new Order(
            _buyerUserId,
            _sellerUserId,
            _sellerProfileId,
            subtotalAmount: 1000m,
            buyerContactPhone: "0912345678",
            deliveryAddressSnapshot: "No 1, Main Road",
            deliveryCityOrTownshipSnapshot: "Mandalay");

        order.Cancel(_buyerUserId, "Changed mind");

        Assert.Equal(OrderStatus.Cancelled, order.Status);
    }

    [Fact]
    public void Cancel_Throws_WhenOrderAlreadyShipped()
    {
        var order = new Order(
            _buyerUserId,
            _sellerUserId,
            _sellerProfileId,
            subtotalAmount: 1000m,
            buyerContactPhone: "0912345678",
            deliveryAddressSnapshot: "No 1, Main Road",
            deliveryCityOrTownshipSnapshot: "Mandalay");

        order.Accept(_sellerUserId);
        order.Ship(_sellerUserId, "TRACK-1");

        Assert.Throws<DomainException>(() => order.Cancel(_buyerUserId, "Too late"));
    }

    [Fact]
    public void MarkDisputed_AndAdminResolveDispute_TransitionsProperly()
    {
        var order = new Order(
            _buyerUserId,
            _sellerUserId,
            _sellerProfileId,
            subtotalAmount: 1000m,
            buyerContactPhone: "0912345678",
            deliveryAddressSnapshot: "No 1, Main Road",
            deliveryCityOrTownshipSnapshot: "Mandalay");

        order.Accept(_sellerUserId);
        order.Ship(_sellerUserId, "TRACK-1");
        order.MarkDisputed(_buyerUserId, "Damaged in transit");

        Assert.Equal(OrderStatus.Disputed, order.Status);

        var adminId = Guid.NewGuid();
        order.AdminResolveDispute(adminId, OrderStatus.Cancelled, "Refund agreed between parties");

        Assert.Equal(OrderStatus.Cancelled, order.Status);
    }
}
