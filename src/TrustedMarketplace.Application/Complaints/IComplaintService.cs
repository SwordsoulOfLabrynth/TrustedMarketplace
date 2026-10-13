using TrustedMarketplace.Application.Complaints.Dtos;

namespace TrustedMarketplace.Application.Complaints;

public interface IComplaintService
{
    Task<ComplaintDto> FileOrderComplaintAsync(Guid orderId, Guid actorUserId, FileComplaintRequest request, CancellationToken ct = default);
    Task<ComplaintDto?> GetComplaintByIdAsync(Guid complaintId, Guid callerUserId, bool isAdmin, CancellationToken ct = default);
    Task<IReadOnlyList<ComplaintDto>> GetComplaintsForAdminAsync(int page = 1, int pageSize = 20, CancellationToken ct = default);
    Task<ComplaintDto> ProcessComplaintDecisionAsync(Guid complaintId, Guid adminUserId, AdminComplaintDecisionRequest request, string correlationId, CancellationToken ct = default);
}
