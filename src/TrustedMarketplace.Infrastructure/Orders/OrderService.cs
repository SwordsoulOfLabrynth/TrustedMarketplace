using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Orders;
using TrustedMarketplace.Application.Orders.Dtos;
using TrustedMarketplace.Domain.Auditing;
using TrustedMarketplace.Domain.Catalog;
using TrustedMarketplace.Domain.Orders;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.Infrastructure.Orders;

public class OrderService : IOrderService
{
    private readonly AppDbContext _dbContext;
    private readonly ILogger<OrderService> _logger;

    public OrderService(AppDbContext dbContext, ILogger<OrderService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<OrderDto> CreateOrderAsync(Guid buyerUserId, CreateOrderRequest request, CancellationToken ct = default)
    {
        if (request.Quantity <= 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Quantity"] = new[] { "Order quantity must be at least 1." }
            });
        }

        var product = await _dbContext.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.ProductId && p.Status == ProductStatus.Published, ct);

        if (product == null)
        {
            throw new NotFoundException($"Published product with ID '{request.ProductId}' was not found.");
        }

        if (product.SellerUserId == buyerUserId)
        {
            throw new ConflictException("You cannot place an order on your own product listing.");
        }

        var subtotal = product.PriceAmount * request.Quantity;

        var order = new Order(
            buyerUserId,
            product.SellerUserId,
            product.SellerProfileId,
            subtotal,
            request.BuyerContactPhone,
            request.DeliveryAddress,
            request.DeliveryCityOrTownship,
            request.DeliveryNotes,
            product.CurrencyCode);

        order.AddItem(
            product.Id,
            product.Title,
            product.PriceAmount,
            request.Quantity,
            product.Condition.ToString());

        _dbContext.Orders.Add(order);
        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation("Order {OrderId} placed by buyer {BuyerId} for seller {SellerId}", order.Id, buyerUserId, product.SellerUserId);

        return ToDto(order);
    }

    public async Task<OrderDto?> GetOrderByIdAsync(Guid orderId, Guid callerUserId, bool isAdmin, CancellationToken ct = default)
    {
        var order = await _dbContext.Orders
            .Include(o => o.Items)
            .Include(o => o.History)
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);

        if (order == null)
            return null;

        // IDOR protection (SEC-06)
        if (!isAdmin && order.BuyerUserId != callerUserId && order.SellerUserId != callerUserId)
        {
            throw new ForbiddenException("FORBIDDEN", "You do not have access to view this order (SEC-06).");
        }

        return ToDto(order);
    }

    public async Task<IReadOnlyList<OrderDto>> GetBuyerOrdersAsync(Guid buyerUserId, CancellationToken ct = default)
    {
        var orders = await _dbContext.Orders
            .Include(o => o.Items)
            .Include(o => o.History)
            .AsNoTracking()
            .Where(o => o.BuyerUserId == buyerUserId)
            .OrderByDescending(o => o.CreatedAtUtc)
            .ToListAsync(ct);

        return orders.Select(ToDto).ToList();
    }

    public async Task<IReadOnlyList<OrderDto>> GetSellerOrdersAsync(Guid sellerUserId, CancellationToken ct = default)
    {
        var orders = await _dbContext.Orders
            .Include(o => o.Items)
            .Include(o => o.History)
            .AsNoTracking()
            .Where(o => o.SellerUserId == sellerUserId)
            .OrderByDescending(o => o.CreatedAtUtc)
            .ToListAsync(ct);

        return orders.Select(ToDto).ToList();
    }

    public async Task<OrderDto> AcceptOrderAsync(Guid orderId, Guid sellerUserId, CancellationToken ct = default)
    {
        var order = await _dbContext.Orders
            .Include(o => o.Items)
            .Include(o => o.History)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);

        if (order == null)
        {
            throw new NotFoundException($"Order with ID '{orderId}' was not found.");
        }

        if (order.SellerUserId != sellerUserId)
        {
            throw new ForbiddenException("FORBIDDEN", "Only the seller of this order can accept it.");
        }

        var history = order.Accept(sellerUserId);
        _dbContext.OrderStatusHistories.Add(history);
        await _dbContext.SaveChangesAsync(ct);

        return ToDto(order);
    }

    public async Task<OrderDto> ShipOrderAsync(Guid orderId, Guid sellerUserId, ShipOrderRequest request, CancellationToken ct = default)
    {
        var order = await _dbContext.Orders
            .Include(o => o.Items)
            .Include(o => o.History)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);

        if (order == null)
        {
            throw new NotFoundException($"Order with ID '{orderId}' was not found.");
        }

        if (order.SellerUserId != sellerUserId)
        {
            throw new ForbiddenException("FORBIDDEN", "Only the seller of this order can mark it shipped.");
        }

        var history = order.Ship(sellerUserId, request.CourierTrackingReference);
        _dbContext.OrderStatusHistories.Add(history);
        await _dbContext.SaveChangesAsync(ct);

        return ToDto(order);
    }

    public async Task<OrderDto> ConfirmDeliveryAsync(Guid orderId, Guid buyerUserId, CancellationToken ct = default)
    {
        var order = await _dbContext.Orders
            .Include(o => o.Items)
            .Include(o => o.History)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);

        if (order == null)
        {
            throw new NotFoundException($"Order with ID '{orderId}' was not found.");
        }

        // SEC-07, SEC-08: Only the buyer can confirm delivery
        if (order.BuyerUserId != buyerUserId)
        {
            throw new ForbiddenException("FORBIDDEN", "Only the buyer who placed the order can confirm delivery (SEC-07).");
        }

        var history = order.ConfirmDelivery(buyerUserId);
        _dbContext.OrderStatusHistories.Add(history);
        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation("Order {OrderId} confirmed delivered by buyer {BuyerId}", orderId, buyerUserId);

        return ToDto(order);
    }

    public async Task<OrderDto> CancelOrderAsync(Guid orderId, Guid actorUserId, CancelOrderRequest request, CancellationToken ct = default)
    {
        var order = await _dbContext.Orders
            .Include(o => o.Items)
            .Include(o => o.History)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);

        if (order == null)
        {
            throw new NotFoundException($"Order with ID '{orderId}' was not found.");
        }

        if (order.BuyerUserId != actorUserId && order.SellerUserId != actorUserId)
        {
            throw new ForbiddenException("FORBIDDEN", "You do not have permission to cancel this order.");
        }

        var history = order.Cancel(actorUserId, request.Reason);
        _dbContext.OrderStatusHistories.Add(history);
        await _dbContext.SaveChangesAsync(ct);

        return ToDto(order);
    }

    public async Task<OrderDto> ResolveDisputeAsync(
        Guid orderId,
        Guid adminUserId,
        ResolveDisputeRequest request,
        string correlationId,
        CancellationToken ct = default)
    {
        var order = await _dbContext.Orders
            .Include(o => o.Items)
            .Include(o => o.History)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);

        if (order == null)
        {
            throw new NotFoundException($"Order with ID '{orderId}' was not found.");
        }

        if (!Enum.TryParse<OrderStatus>(request.ResolvedStatus, true, out var resolvedStatus) ||
            (resolvedStatus != OrderStatus.Completed && resolvedStatus != OrderStatus.Cancelled))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["ResolvedStatus"] = new[] { "ResolvedStatus must be 'Completed' or 'Cancelled'." }
            });
        }

        var history = order.AdminResolveDispute(adminUserId, resolvedStatus, request.Reason);
        _dbContext.OrderStatusHistories.Add(history);

        var audit = AuditEvent.Create(
            action: "OrderDisputeResolved",
            targetType: "Order",
            targetId: order.Id.ToString(),
            correlationId: correlationId,
            actorUserId: adminUserId,
            reason: $"Admin resolved dispute to {resolvedStatus}: {request.Reason}");

        _dbContext.AuditEvents.Add(audit);
        await _dbContext.SaveChangesAsync(ct);

        return ToDto(order);
    }

    private static OrderDto ToDto(Order o) =>
        new(
            o.Id,
            o.BuyerUserId,
            o.SellerUserId,
            o.SellerProfileId,
            o.Status.ToString(),
            o.SubtotalAmount,
            o.CurrencyCode,
            o.BuyerContactPhone,
            o.DeliveryAddressSnapshot,
            o.DeliveryCityOrTownshipSnapshot,
            o.DeliveryNotes,
            o.CourierTrackingReference,
            o.ShippedAtUtc,
            o.CompletedAtUtc,
            o.CreatedAtUtc,
            o.Items.Select(i => new OrderItemDto(
                i.Id,
                i.ProductId,
                i.ProductTitleSnapshot,
                i.UnitPriceSnapshot,
                i.Quantity,
                i.ConditionSnapshot)).ToList(),
            o.History.OrderBy(h => h.CreatedAtUtc).Select(h => new OrderStatusHistoryDto(
                h.Id,
                h.ActorUserId,
                h.PreviousStatus,
                h.NewStatus,
                h.Reason,
                h.CreatedAtUtc)).ToList());
}
