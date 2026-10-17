using TrustedMarketplace.Application.Credentials.Dtos;
using TrustedMarketplace.Domain.Credentials;

namespace TrustedMarketplace.Application.Credentials;

public interface ICredentialService
{
    Task<SellerCredentialStatusDto> GetMyCredentialStatusAsync(Guid sellerUserId, CancellationToken ct = default);
    Task<SellerCredentialDto> IssueCredentialAsync(Guid sellerUserId, Guid adminUserId, string? reason, string correlationId, CancellationToken ct = default);
    Task<SellerCredentialDto> RevokeCredentialAsync(Guid credentialId, Guid adminUserId, string reason, string correlationId, CancellationToken ct = default);
    Task<PublicCredentialVerificationDto> VerifyPublicCredentialAsync(string publicCredentialId, CancellationToken ct = default);
    Task<byte[]> GenerateCertificatePdfAsync(Guid credentialId, Guid requestingUserId, bool isAdmin, CancellationToken ct = default);
    Task<string> GenerateBadgeSvgAsync(string publicCredentialId, CancellationToken ct = default);
    Task<byte[]> GenerateBadgePngAsync(string publicCredentialId, CancellationToken ct = default);
    Task<IReadOnlyList<SellerCredentialDto>> GetCredentialsForAdminAsync(CredentialStatus? statusFilter = null, int page = 1, int pageSize = 20, CancellationToken ct = default);
}
