using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Complaints;
using TrustedMarketplace.Application.Complaints.Dtos;
using TrustedMarketplace.Domain.Auditing;
using TrustedMarketplace.Domain.Complaints;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.Infrastructure.Complaints;

public class ComplaintService : IComplaintService
{
    private readonly AppDbContext _dbContext;
    private readonly ILogger<ComplaintService> _logger;

    public ComplaintService(AppDbContext dbContext, ILogger<ComplaintService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<ComplaintDto> FileOrderComplaintAsync(
        Guid orderId,
        Guid actorUserId,
        FileComplaintRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Description))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Description"] = new[] { "Complaint description cannot be empty." }
            });
        }

        var order = await _dbContext.Orders
            .Include(o => o.History)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);

        if (order == null)
        {
            throw new NotFoundException($"Order with ID '{orderId}' was not found.");
        }

        if (order.BuyerUserId != actorUserId && order.SellerUserId != actorUserId)
        {
            throw new ForbiddenException("FORBIDDEN", "Only order participants can file a dispute for this order.");
        }

        // Shift order status to Disputed
        var history = order.MarkDisputed(actorUserId, $"Complaint filed: {request.Description}");
        _dbContext.OrderStatusHistories.Add(history);

        var complaint = new Complaint(
            actorUserId,
            orderId,
            order.SellerUserId,
            request.Description);

        _dbContext.Complaints.Add(complaint);
        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation("Complaint {ComplaintId} filed for order {OrderId} by user {UserId}", complaint.Id, orderId, actorUserId);

        return ToDto(complaint);
    }

    public async Task<ComplaintDto?> GetComplaintByIdAsync(Guid complaintId, Guid callerUserId, bool isAdmin, CancellationToken ct = default)
    {
        var complaint = await _dbContext.Complaints
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == complaintId, ct);

        if (complaint == null)
            return null;

        if (!isAdmin && complaint.ReporterUserId != callerUserId && complaint.SellerUserId != callerUserId)
        {
            throw new ForbiddenException("FORBIDDEN", "You do not have permission to view this complaint.");
        }

        return ToDto(complaint);
    }

    public async Task<IReadOnlyList<ComplaintDto>> GetComplaintsForAdminAsync(int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var complaints = await _dbContext.Complaints
            .AsNoTracking()
            .OrderByDescending(c => c.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return complaints.Select(ToDto).ToList();
    }

    public async Task<ComplaintDto> ProcessComplaintDecisionAsync(
        Guid complaintId,
        Guid adminUserId,
        AdminComplaintDecisionRequest request,
        string correlationId,
        CancellationToken ct = default)
    {
        var complaint = await _dbContext.Complaints
            .FirstOrDefaultAsync(c => c.Id == complaintId, ct);

        if (complaint == null)
        {
            throw new NotFoundException($"Complaint with ID '{complaintId}' was not found.");
        }

        if (!Enum.TryParse<ComplaintResolutionCode>(request.ResolutionCode, true, out var resolutionCode))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["ResolutionCode"] = new[] { "ResolutionCode must be 'RefundAgreed', 'GoodsDeliveredConfirmed', 'WarningIssued', or 'Unfounded'." }
            });
        }

        if (resolutionCode == ComplaintResolutionCode.Unfounded)
        {
            complaint.Dismiss(adminUserId, request.ResolutionSummary);
        }
        else
        {
            complaint.Resolve(adminUserId, resolutionCode, request.ResolutionSummary);
        }

        var audit = AuditEvent.Create(
            action: $"Complaint_{complaint.Status}",
            targetType: "Complaint",
            targetId: complaint.Id.ToString(),
            correlationId: correlationId,
            actorUserId: adminUserId,
            reason: $"Admin resolved complaint with code {resolutionCode}: {request.ResolutionSummary}");

        _dbContext.AuditEvents.Add(audit);
        await _dbContext.SaveChangesAsync(ct);

        return ToDto(complaint);
    }

    private static ComplaintDto ToDto(Complaint c) =>
        new(
            c.Id,
            c.ReporterUserId,
            c.OrderId,
            c.SellerUserId,
            c.Status.ToString(),
            c.Description,
            c.ResolutionCode?.ToString(),
            c.ResolutionSummary,
            c.CreatedAtUtc,
            c.ResolvedAtUtc);
}
