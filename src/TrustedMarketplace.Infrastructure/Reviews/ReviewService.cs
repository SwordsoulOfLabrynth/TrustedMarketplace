using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrustedMarketplace.Application.Catalog.Dtos;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Reviews;
using TrustedMarketplace.Application.Reviews.Dtos;
using TrustedMarketplace.Domain.Orders;
using TrustedMarketplace.Domain.Reviews;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.Infrastructure.Reviews;

public class ReviewService : IReviewService
{
    private readonly AppDbContext _dbContext;
    private readonly ILogger<ReviewService> _logger;

    public ReviewService(AppDbContext dbContext, ILogger<ReviewService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<ReviewDto> SubmitReviewAsync(
        Guid orderId,
        Guid buyerUserId,
        CreateReviewRequest request,
        CancellationToken ct = default)
    {
        if (request.Rating < 1 || request.Rating > 5)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Rating"] = new[] { "Rating must be an integer between 1 and 5." }
            });
        }

        if (string.IsNullOrWhiteSpace(request.Comment))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Comment"] = new[] { "Review comment cannot be empty." }
            });
        }

        var order = await _dbContext.Orders
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);

        if (order == null)
        {
            throw new NotFoundException($"Order with ID '{orderId}' was not found.");
        }

        // SEC-09: Only the buyer who placed the order can submit a review
        if (order.BuyerUserId != buyerUserId)
        {
            throw new ForbiddenException("FORBIDDEN", "Only the buyer who completed this transaction can review it (SEC-09).");
        }

        // SEC-11: Only Completed orders can be reviewed
        if (order.Status != OrderStatus.Completed)
        {
            throw new ConflictException($"Only Completed transactions can receive reviews. Current order status: {order.Status} (SEC-11).");
        }

        // SEC-10: Max 1 review per order
        var existingReview = await _dbContext.Reviews
            .AnyAsync(r => r.OrderId == orderId, ct);

        if (existingReview)
        {
            throw new ConflictException("A review has already been submitted for this order (SEC-10).");
        }

        var review = new Review(
            orderId,
            buyerUserId,
            order.SellerUserId,
            request.Rating,
            request.Comment);

        _dbContext.Reviews.Add(review);
        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation("Review {ReviewId} created for order {OrderId} by buyer {BuyerId}", review.Id, orderId, buyerUserId);

        return new ReviewDto(
            review.Id,
            review.OrderId,
            review.ReviewerUserId,
            review.SellerUserId,
            review.Rating,
            review.Comment,
            review.CreatedAtUtc);
    }

    public async Task<PagedResult<ReviewDto>> GetSellerReviewsAsync(
        Guid sellerUserId,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _dbContext.Reviews
            .AsNoTracking()
            .Where(r => r.SellerUserId == sellerUserId && r.ModerationStatus == ModerationStatus.Published);

        var totalCount = await query.CountAsync(ct);

        var reviews = await query
            .OrderByDescending(r => r.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var dtos = reviews.Select(r => new ReviewDto(
            r.Id,
            r.OrderId,
            r.ReviewerUserId,
            r.SellerUserId,
            r.Rating,
            r.Comment,
            r.CreatedAtUtc)).ToList();

        return new PagedResult<ReviewDto>(dtos, page, pageSize, totalCount);
    }
}
