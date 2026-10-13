namespace TrustedMarketplace.Domain.Orders;

public enum OrderStatus
{
    Placed = 0,
    Accepted = 1,
    Shipped = 2,
    Completed = 3,
    Cancelled = 4,
    Disputed = 5
}
