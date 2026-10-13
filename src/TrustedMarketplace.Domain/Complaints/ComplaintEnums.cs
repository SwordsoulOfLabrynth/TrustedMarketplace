namespace TrustedMarketplace.Domain.Complaints;

public enum ComplaintStatus
{
    Submitted = 0,
    UnderReview = 1,
    Resolved = 2,
    Dismissed = 3
}

public enum ComplaintResolutionCode
{
    RefundAgreed = 0,
    GoodsDeliveredConfirmed = 1,
    WarningIssued = 2,
    Unfounded = 3
}
