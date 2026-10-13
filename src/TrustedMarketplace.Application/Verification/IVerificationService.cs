using TrustedMarketplace.Application.Verification.Dtos;
using TrustedMarketplace.Domain.Verification;

namespace TrustedMarketplace.Application.Verification;

public interface IVerificationService
{
    Task<SellerApplicationDto> SubmitApplicationAsync(Guid userId, CreateSellerApplicationRequest request, CancellationToken ct = default);
    Task<SellerApplicationDto?> GetMyApplicationAsync(Guid userId, CancellationToken ct = default);
    Task<VerificationEvidenceDto> UploadEvidenceAsync(Guid userId, EvidenceType evidenceType, Stream fileStream, string fileName, string contentType, long fileLength, CancellationToken ct = default);
    Task<IReadOnlyList<SellerApplicationDto>> GetApplicationsForAdminAsync(int page = 1, int pageSize = 20, ApplicationStatus? statusFilter = null, CancellationToken ct = default);
    Task<SellerApplicationDto?> GetApplicationByIdForAdminAsync(Guid applicationId, CancellationToken ct = default);
    Task<(Stream FileStream, string ContentType, string FileName)?> GetEvidenceFileForAdminAsync(Guid applicationId, Guid evidenceId, Guid adminUserId, string correlationId, CancellationToken ct = default);
    Task<SellerApplicationDto> ProcessAdminDecisionAsync(Guid applicationId, Guid adminUserId, AdminDecisionRequest request, string correlationId, CancellationToken ct = default);
}
