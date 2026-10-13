using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Api.Authorization;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Orders;
using TrustedMarketplace.Application.Orders.Dtos;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
[Route("api/v1/orders")]
[Authorize(Policy = AuthorizationPolicies.RequireActiveUser)]
public class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;

    public OrdersController(IOrderService orderService)
    {
        _orderService = orderService;
    }

    /// <summary>
    /// Places a new non-custodial order on a published product listing (T-13).
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequest request, CancellationToken ct)
    {
        var buyerUserId = GetCurrentUserId();
        var order = await _orderService.CreateOrderAsync(buyerUserId, request, ct);
        return StatusCode(StatusCodes.Status201Created, order);
    }

    /// <summary>
    /// Retrieves order details by ID. IDOR protection ensures only buyer, seller, or admin can access (SEC-06).
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetOrderById(Guid id, CancellationToken ct)
    {
        var callerUserId = GetCurrentUserId();
        var isAdmin = User.IsInRole("Admin");
        var order = await _orderService.GetOrderByIdAsync(id, callerUserId, isAdmin, ct);

        if (order == null)
            return NotFound(new ProblemDetails { Title = "Not Found", Detail = $"Order with ID '{id}' was not found." });

        return Ok(order);
    }

    /// <summary>
    /// Retrieves all orders placed by the current authenticated buyer.
    /// </summary>
    [HttpGet("/api/v1/buyer/orders")]
    [ProducesResponseType(typeof(IReadOnlyList<OrderDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBuyerOrders(CancellationToken ct)
    {
        var buyerUserId = GetCurrentUserId();
        var orders = await _orderService.GetBuyerOrdersAsync(buyerUserId, ct);
        return Ok(orders);
    }

    /// <summary>
    /// Retrieves all incoming orders placed for the current authenticated seller.
    /// </summary>
    [HttpGet("/api/v1/seller/orders")]
    [ProducesResponseType(typeof(IReadOnlyList<OrderDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSellerOrders(CancellationToken ct)
    {
        var sellerUserId = GetCurrentUserId();
        var orders = await _orderService.GetSellerOrdersAsync(sellerUserId, ct);
        return Ok(orders);
    }

    /// <summary>
    /// Accepts a Placed order. Only the seller of the order can accept.
    /// </summary>
    [HttpPost("{id:guid}/accept")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AcceptOrder(Guid id, CancellationToken ct)
    {
        var sellerUserId = GetCurrentUserId();
        var order = await _orderService.AcceptOrderAsync(id, sellerUserId, ct);
        return Ok(order);
    }

    /// <summary>
    /// Dispatches an Accepted order with optional courier waybill tracking.
    /// </summary>
    [HttpPost("{id:guid}/ship")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ShipOrder(Guid id, [FromBody] ShipOrderRequest request, CancellationToken ct)
    {
        var sellerUserId = GetCurrentUserId();
        var order = await _orderService.ShipOrderAsync(id, sellerUserId, request, ct);
        return Ok(order);
    }

    /// <summary>
    /// Confirms delivery of a Shipped order, completing the transaction.
    /// Strictly only the buyer who placed the order can confirm delivery (SEC-07, SEC-08).
    /// </summary>
    [HttpPost("{id:guid}/confirm-delivery")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ConfirmDelivery(Guid id, CancellationToken ct)
    {
        var buyerUserId = GetCurrentUserId();
        var order = await _orderService.ConfirmDeliveryAsync(id, buyerUserId, ct);
        return Ok(order);
    }

    /// <summary>
    /// Cancels an order with a reason.
    /// Buyer can cancel while Placed; seller can cancel before Shipped.
    /// </summary>
    [HttpPost("{id:guid}/cancel")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CancelOrder(Guid id, [FromBody] CancelOrderRequest request, CancellationToken ct)
    {
        var actorUserId = GetCurrentUserId();
        var order = await _orderService.CancelOrderAsync(id, actorUserId, request, ct);
        return Ok(order);
    }

    /// <summary>
    /// Admin resolves a disputed order, marking it either Completed or Cancelled with audit trail.
    /// </summary>
    [HttpPost("/api/v1/admin/orders/{id:guid}/resolve-dispute")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(OrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ResolveDispute(Guid id, [FromBody] ResolveDisputeRequest request, CancellationToken ct)
    {
        var adminUserId = GetCurrentUserId();
        var correlationId = HttpContext.TraceIdentifier;
        var order = await _orderService.ResolveDisputeAsync(id, adminUserId, request, correlationId, ct);
        return Ok(order);
    }

    private Guid GetCurrentUserId()
    {
        var rawId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(rawId) || !Guid.TryParse(rawId, out var userId))
        {
            throw new UnauthorizedException("Authenticated caller identity could not be resolved.");
        }
        return userId;
    }
}
