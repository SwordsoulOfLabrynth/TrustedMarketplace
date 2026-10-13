using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Common.Interfaces;
using TrustedMarketplace.Application.Common.Security;
using TrustedMarketplace.Application.Verification;
using TrustedMarketplace.Application.Verification.Dtos;
using TrustedMarketplace.Domain.Auditing;
using TrustedMarketplace.Domain.Verification;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.Infrastructure.Verification;

public class VerificationService : IVerificationService
{
    private readonly AppDbContext _dbContext;
    private readonly IFileStorageService _fileStorageService;
    private readonly ILogger<VerificationService> _logger;

    public VerificationService(
        AppDbContext dbContext,
        IFileStorageService fileStorageService,
        ILogger<VerificationService> logger)
    {
        _dbContext = dbContext;
        _fileStorageService = fileStorageService;
        _logger = logger;
    }

    public async Task<SellerApplicationDto> SubmitApplicationAsync(
        Guid userId,
        CreateSellerApplicationRequest request,
        CancellationToken ct = default)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.ProposedStoreName) || request.ProposedStoreName.Trim().Length > 100)
        {
            errors["ProposedStoreName"] = new[] { "Proposed store name must be between 1 and 100 characters." };
        }

        if (string.IsNullOrWhiteSpace(request.BusinessType) || request.BusinessType.Trim().Length > 50)
        {
            errors["BusinessType"] = new[] { "Business type must be between 1 and 50 characters." };
        }

        if (string.IsNullOrWhiteSpace(request.ContactPhone) || request.ContactPhone.Trim().Length > 30)
        {
            errors["ContactPhone"] = new[] { "Contact phone must be between 1 and 30 characters." };
        }

        if (errors.Count > 0)
        {
            throw new ValidationException(errors);
        }

        // Check if an active application already exists for this user
        var existingApplication = await _dbContext.SellerApplications
            .Where(a => a.UserId == userId && (
                a.Status == ApplicationStatus.Pending ||
                a.Status == ApplicationStatus.MoreInformationRequired ||
                a.Status == ApplicationStatus.Approved))
            .FirstOrDefaultAsync(ct);

        if (existingApplication != null)
        {
            throw new ConflictException(
                existingApplication.Status == ApplicationStatus.Approved
                    ? "User is already an approved seller."
                    : "An active seller application is already pending or under review for this account.");
        }

        var application = new SellerApplication(
            userId,
            request.ProposedStoreName,
            request.BusinessType,
            request.ContactPhone);

        _dbContext.SellerApplications.Add(application);
        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation("Submitted new seller application {ApplicationId} for user {UserId}", application.Id, userId);

        return ToDto(application);
    }

    public async Task<SellerApplicationDto?> GetMyApplicationAsync(Guid userId, CancellationToken ct = default)
    {
        var application = await _dbContext.SellerApplications
            .Include(a => a.Evidence)
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.SubmittedAtUtc)
            .FirstOrDefaultAsync(ct);

        return application == null ? null : ToDto(application);
    }

    public async Task<VerificationEvidenceDto> UploadEvidenceAsync(
        Guid userId,
        EvidenceType evidenceType,
        Stream fileStream,
        string fileName,
        string contentType,
        long fileLength,
        CancellationToken ct = default)
    {
        var application = await _dbContext.SellerApplications
            .Include(a => a.Evidence)
            .Where(a => a.UserId == userId && (
                a.Status == ApplicationStatus.Pending ||
                a.Status == ApplicationStatus.MoreInformationRequired))
            .OrderByDescending(a => a.SubmittedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (application == null)
        {
            throw new NotFoundException("No pending seller application found for this account.");
        }

        var (isValid, detectedMimeType, errorMessage) = FileValidationService.ValidateEvidenceFile(
            fileStream,
            fileName,
            contentType,
            fileLength);

        if (!isValid)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["File"] = new[] { errorMessage ?? "Invalid file format or size." }
            });
        }

        // Calculate SHA-256 Checksum
        fileStream.Position = 0;
        using var sha256 = SHA256.Create();
        var hashBytes = await sha256.ComputeHashAsync(fileStream, ct);
        var sha256Hex = Convert.ToHexStringLower(hashBytes);
        fileStream.Position = 0;

        // Save file securely to private storage
        var storageKey = await _fileStorageService.SavePrivateFileAsync(
            fileStream,
            fileName,
            detectedMimeType,
            ct);

        var evidence = application.AddEvidence(
            evidenceType,
            storageKey,
            fileName,
            fileLength,
            detectedMimeType,
            sha256Hex);

        _dbContext.VerificationEvidences.Add(evidence);

        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Uploaded evidence {EvidenceId} ({EvidenceType}) for application {ApplicationId}",
            evidence.Id,
            evidenceType,
            application.Id);

        return new VerificationEvidenceDto(
            evidence.Id,
            evidence.EvidenceType.ToString(),
            evidence.FileSizeBytes,
            evidence.MimeType,
            evidence.Sha256Checksum,
            evidence.UploadedAtUtc,
            evidence.ReviewStatus.ToString());
    }

    public async Task<IReadOnlyList<SellerApplicationDto>> GetApplicationsForAdminAsync(
        int page = 1,
        int pageSize = 20,
        ApplicationStatus? statusFilter = null,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _dbContext.SellerApplications
            .Include(a => a.Evidence)
            .AsQueryable();

        if (statusFilter.HasValue)
        {
            query = query.Where(a => a.Status == statusFilter.Value);
        }

        var applications = await query
            .OrderByDescending(a => a.SubmittedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return applications.Select(ToDto).ToList();
    }

    public async Task<SellerApplicationDto?> GetApplicationByIdForAdminAsync(Guid applicationId, CancellationToken ct = default)
    {
        var application = await _dbContext.SellerApplications
            .Include(a => a.Evidence)
            .FirstOrDefaultAsync(a => a.Id == applicationId, ct);

        return application == null ? null : ToDto(application);
    }

    public async Task<(Stream FileStream, string ContentType, string FileName)?> GetEvidenceFileForAdminAsync(
        Guid applicationId,
        Guid evidenceId,
        Guid adminUserId,
        string correlationId,
        CancellationToken ct = default)
    {
        var application = await _dbContext.SellerApplications
            .Include(a => a.Evidence)
            .FirstOrDefaultAsync(a => a.Id == applicationId, ct);

        if (application == null)
        {
            return null;
        }

        var evidence = application.Evidence.FirstOrDefault(e => e.Id == evidenceId);
        if (evidence == null)
        {
            return null;
        }

        var stream = await _fileStorageService.GetPrivateFileAsync(evidence.PrivateStorageKey, ct);
        if (stream == null)
        {
            _logger.LogWarning("Evidence file not found on disk for storage key {Key}", evidence.PrivateStorageKey);
            return null;
        }

        // Audit log the private evidence download
        var audit = AuditEvent.Create(
            action: "EvidenceViewed",
            targetType: "VerificationEvidence",
            targetId: evidence.Id.ToString(),
            correlationId: correlationId,
            actorUserId: adminUserId,
            reason: $"Admin downloaded private evidence for application {applicationId}");

        _dbContext.AuditEvents.Add(audit);
        await _dbContext.SaveChangesAsync(ct);

        return (stream, evidence.MimeType, evidence.OriginalFileName);
    }

    public async Task<SellerApplicationDto> ProcessAdminDecisionAsync(
        Guid applicationId,
        Guid adminUserId,
        AdminDecisionRequest request,
        string correlationId,
        CancellationToken ct = default)
    {
        var application = await _dbContext.SellerApplications
            .Include(a => a.Evidence)
            .FirstOrDefaultAsync(a => a.Id == applicationId, ct);

        if (application == null)
        {
            throw new NotFoundException($"Seller application with ID '{applicationId}' was not found.");
        }

        var previousStatus = application.Status.ToString();

        switch (request.Decision.Trim())
        {
            case "Approved":
                application.Approve(adminUserId, request.Reason);
                break;
            case "Rejected":
                application.Reject(adminUserId, request.Reason);
                break;
            case "MoreInformationRequired":
                application.RequestMoreInformation(adminUserId, request.Reason);
                break;
            default:
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    ["Decision"] = new[] { "Decision must be 'Approved', 'Rejected', or 'MoreInformationRequired'." }
                });
        }

        var history = new VerificationDecisionHistory(
            application.Id,
            adminUserId,
            previousStatus,
            application.Status.ToString(),
            request.Reason);

        _dbContext.VerificationDecisionHistories.Add(history);

        var audit = AuditEvent.Create(
            action: $"SellerApplication_{application.Status}",
            targetType: "SellerApplication",
            targetId: applicationId.ToString(),
            correlationId: correlationId,
            actorUserId: adminUserId,
            reason: request.Reason);

        _dbContext.AuditEvents.Add(audit);
        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Admin {AdminId} updated application {ApplicationId} to {Status}",
            adminUserId,
            application.Id,
            application.Status);

        return ToDto(application);
    }

    private static SellerApplicationDto ToDto(SellerApplication app)
    {
        return new SellerApplicationDto(
            app.Id,
            app.UserId,
            app.ProposedStoreName,
            app.BusinessType,
            app.ContactPhone,
            app.Status.ToString(),
            app.SubmittedAtUtc,
            app.ReviewedAtUtc,
            app.DecisionReason,
            app.Evidence.Select(e => new VerificationEvidenceDto(
                e.Id,
                e.EvidenceType.ToString(),
                e.FileSizeBytes,
                e.MimeType,
                e.Sha256Checksum,
                e.UploadedAtUtc,
                e.ReviewStatus.ToString())).ToList());
    }
}
