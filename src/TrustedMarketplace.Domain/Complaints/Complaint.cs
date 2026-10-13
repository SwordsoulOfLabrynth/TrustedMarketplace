using TrustedMarketplace.Domain.Common;
using TrustedMarketplace.Domain.Common.Exceptions;
using TrustedMarketplace.Domain.Orders;

namespace TrustedMarketplace.Domain.Complaints;

public class Complaint : BaseEntity
{
    public Guid ReporterUserId { get; private set; }
    public Guid? OrderId { get; private set; }
    public Guid? SellerUserId { get; private set; }
    public ComplaintStatus Status { get; private set; } = ComplaintStatus.Submitted;
    public string Description { get; private set; } = string.Empty;
    public Guid? AssignedToUserId { get; private set; }
    public ComplaintResolutionCode? ResolutionCode { get; private set; }
    public string? ResolutionSummary { get; private set; }
    public DateTime? ResolvedAtUtc { get; private set; }

    // Navigation property
    public Order? Order { get; private set; }

    private Complaint() : base() { }

    public Complaint(
        Guid reporterUserId,
        Guid? orderId,
        Guid? sellerUserId,
        string description) : base()
    {
        if (reporterUserId == Guid.Empty)
            throw new ArgumentException("Reporter user ID cannot be empty.", nameof(reporterUserId));

        if (string.IsNullOrWhiteSpace(description))
            throw new DomainException("Complaint description cannot be empty.");

        ReporterUserId = reporterUserId;
        OrderId = orderId;
        SellerUserId = sellerUserId;
        Description = description.Trim();
        Status = ComplaintStatus.Submitted;
    }

    public void AssignTo(Guid adminUserId)
    {
        AssignedToUserId = adminUserId;
        Status = ComplaintStatus.UnderReview;
    }

    public void Resolve(
        Guid adminUserId,
        ComplaintResolutionCode resolutionCode,
        string resolutionSummary)
    {
        if (string.IsNullOrWhiteSpace(resolutionSummary))
            throw new DomainException("A resolution summary is required.");

        AssignedToUserId = adminUserId;
        Status = ComplaintStatus.Resolved;
        ResolutionCode = resolutionCode;
        ResolutionSummary = resolutionSummary.Trim();
        ResolvedAtUtc = DateTime.UtcNow;
    }

    public void Dismiss(
        Guid adminUserId,
        string resolutionSummary)
    {
        if (string.IsNullOrWhiteSpace(resolutionSummary))
            throw new DomainException("A dismissal reason/summary is required.");

        AssignedToUserId = adminUserId;
        Status = ComplaintStatus.Dismissed;
        ResolutionCode = ComplaintResolutionCode.Unfounded;
        ResolutionSummary = resolutionSummary.Trim();
        ResolvedAtUtc = DateTime.UtcNow;
    }
}
