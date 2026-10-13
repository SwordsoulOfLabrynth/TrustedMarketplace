namespace TrustedMarketplace.Application.Reviews.Dtos;

public record CreateReviewRequest(
    int Rating,
    string Comment
);

public record ReviewDto(
    Guid Id,
    Guid OrderId,
    Guid ReviewerUserId,
    Guid SellerUserId,
    int Rating,
    string Comment,
    DateTime CreatedAtUtc
);
