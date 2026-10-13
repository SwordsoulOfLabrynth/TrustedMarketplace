using TrustedMarketplace.Application.Catalog.Dtos;
using TrustedMarketplace.Application.Reviews.Dtos;

namespace TrustedMarketplace.Application.Reviews;

public interface IReviewService
{
    Task<ReviewDto> SubmitReviewAsync(Guid orderId, Guid buyerUserId, CreateReviewRequest request, CancellationToken ct = default);
    Task<PagedResult<ReviewDto>> GetSellerReviewsAsync(Guid sellerUserId, int page = 1, int pageSize = 20, CancellationToken ct = default);
}
