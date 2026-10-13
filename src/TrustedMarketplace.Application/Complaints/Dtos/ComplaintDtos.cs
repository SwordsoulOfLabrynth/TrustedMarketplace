namespace TrustedMarketplace.Application.Complaints.Dtos;

public record FileComplaintRequest(
    string Description
);

public record ComplaintDto(
    Guid Id,
    Guid ReporterUserId,
    Guid? OrderId,
    Guid? SellerUserId,
    string Status,
    string Description,
    string? ResolutionCode,
    string? ResolutionSummary,
    DateTime CreatedAtUtc,
    DateTime? ResolvedAtUtc
);

public record AdminComplaintDecisionRequest(
    string ResolutionCode, // RefundAgreed, GoodsDeliveredConfirmed, WarningIssued, Unfounded
    string ResolutionSummary
);
