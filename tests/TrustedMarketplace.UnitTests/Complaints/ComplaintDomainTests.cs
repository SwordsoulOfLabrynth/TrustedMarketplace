using TrustedMarketplace.Domain.Complaints;
using Xunit;

namespace TrustedMarketplace.UnitTests.Complaints;

public class ComplaintDomainTests
{
    private readonly Guid _reporterUserId = Guid.NewGuid();
    private readonly Guid _orderId = Guid.NewGuid();
    private readonly Guid _sellerUserId = Guid.NewGuid();

    [Fact]
    public void Constructor_InitializesComplaintInPendingStatus()
    {
        var complaint = new Complaint(_reporterUserId, _orderId, _sellerUserId, "Item never delivered by courier");

        Assert.Equal(_reporterUserId, complaint.ReporterUserId);
        Assert.Equal(_orderId, complaint.OrderId);
        Assert.Equal(_sellerUserId, complaint.SellerUserId);
        Assert.Equal("Item never delivered by courier", complaint.Description);
        Assert.Equal(ComplaintStatus.Submitted, complaint.Status);
        Assert.Null(complaint.ResolutionCode);
    }

    [Fact]
    public void Resolve_UpdatesStatusAndResolutionCode()
    {
        var complaint = new Complaint(_reporterUserId, _orderId, _sellerUserId, "Item never delivered");
        var adminId = Guid.NewGuid();

        complaint.Resolve(adminId, ComplaintResolutionCode.RefundAgreed, "Parties settled with direct refund");

        Assert.Equal(ComplaintStatus.Resolved, complaint.Status);
        Assert.Equal(ComplaintResolutionCode.RefundAgreed, complaint.ResolutionCode);
        Assert.Equal("Parties settled with direct refund", complaint.ResolutionSummary);
        Assert.NotNull(complaint.ResolvedAtUtc);
    }

    [Fact]
    public void Dismiss_UpdatesStatusToDismissed()
    {
        var complaint = new Complaint(_reporterUserId, _orderId, _sellerUserId, "False allegation");
        var adminId = Guid.NewGuid();

        complaint.Dismiss(adminId, "Tracking proves delivery receipt signed");

        Assert.Equal(ComplaintStatus.Dismissed, complaint.Status);
        Assert.Equal(ComplaintResolutionCode.Unfounded, complaint.ResolutionCode);
        Assert.NotNull(complaint.ResolvedAtUtc);
    }
}
