using TrustedMarketplace.Domain.Verification;

namespace TrustedMarketplace.Application.Verification.Dtos;

public record CreateSellerApplicationRequest(
    string ProposedStoreName,
    string BusinessType,
    string ContactPhone
);

public record VerificationEvidenceDto(
    Guid Id,
    string EvidenceType,
    long FileSizeBytes,
    string MimeType,
    string Sha256Checksum,
    DateTime UploadedAtUtc,
    string ReviewStatus
);

public record SellerApplicationDto(
    Guid Id,
    Guid UserId,
    string ProposedStoreName,
    string BusinessType,
    string ContactPhone,
    string Status,
    DateTime SubmittedAtUtc,
    DateTime? ReviewedAtUtc,
    string? DecisionReason,
    List<VerificationEvidenceDto> Evidence
);

public record AdminDecisionRequest(
    string Decision, // "Approved", "Rejected", "MoreInformationRequired"
    string Reason
);
