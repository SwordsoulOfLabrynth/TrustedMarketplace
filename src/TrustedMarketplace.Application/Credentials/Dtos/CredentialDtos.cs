namespace TrustedMarketplace.Application.Credentials.Dtos;

public record SellerCredentialDto(
    Guid Id,
    string PublicCredentialId,
    Guid SellerUserId,
    string StoreName,
    string SellerDisplayName,
    string CredentialType,
    string Status,
    DateTime IssuedAtUtc,
    DateTime? RevokedAtUtc,
    string? RevocationReason,
    string PublicVerificationUrl,
    string BadgeSvgUrl,
    string BadgePngUrl,
    string CertificateDownloadUrl
);

public record PublicCredentialVerificationDto(
    string PublicCredentialId,
    string Status,
    string? SellerDisplayName,
    string? StoreName,
    string CredentialType,
    DateTime? IssuedAtUtc,
    DateTime? RevokedAtUtc,
    string? RevocationReason,
    string VerificationScope,
    bool IsValid
);

public record SellerCredentialStatusDto(
    bool IsEligible,
    string? IneligibilityReason,
    SellerCredentialDto? ActiveCredential,
    IReadOnlyList<SellerCredentialDto> History
);

public record IssueCredentialRequest(
    Guid SellerUserId,
    string? Reason = null
);

public record RevokeCredentialRequest(
    string Reason
);
