using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Credentials;
using TrustedMarketplace.Application.Credentials.Dtos;
using TrustedMarketplace.Domain.Auditing;
using TrustedMarketplace.Domain.Credentials;
using TrustedMarketplace.Domain.Identity;
using TrustedMarketplace.Domain.Stores;
using TrustedMarketplace.Domain.Verification;
using TrustedMarketplace.Infrastructure.Identity;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.Infrastructure.Credentials;

public class CredentialService : ICredentialService
{
    private const string StandardScope =
        "MatchGuard has verified the identity of this seller based on its verification process. This certificate does not guarantee product quality, product authenticity, legal compliance, seller conduct, or the safety of any transaction.";

    private readonly AppDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<CredentialService> _logger;

    public CredentialService(
        AppDbContext dbContext,
        IConfiguration configuration,
        ILogger<CredentialService> logger)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _logger = logger;
    }

    private string GetFrontendBaseUrl()
    {
        var configured = _configuration["FrontendBaseUrl"] ?? _configuration["Cors:AllowedOrigins:0"];
        if (string.IsNullOrWhiteSpace(configured) || configured.Contains("localhost"))
        {
            return "https://trusted-marketplace.vercel.app";
        }
        return configured.TrimEnd('/');
    }

    public async Task<SellerCredentialStatusDto> GetMyCredentialStatusAsync(Guid sellerUserId, CancellationToken ct = default)
    {
        var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == sellerUserId, ct);
        if (user == null)
        {
            throw new NotFoundException("User", sellerUserId.ToString());
        }

        if (user.AccountStatus != AccountStatus.Active)
        {
            return new SellerCredentialStatusDto(
                IsEligible: false,
                IneligibilityReason: $"Your account is currently {user.AccountStatus}. Only active seller accounts in good standing can receive official credentials.",
                ActiveCredential: null,
                History: Array.Empty<SellerCredentialDto>()
            );
        }

        var approvedApp = await _dbContext.SellerApplications
            .AsNoTracking()
            .Where(a => a.UserId == sellerUserId && a.Status == ApplicationStatus.Approved)
            .OrderByDescending(a => a.ReviewedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (approvedApp == null)
        {
            var pendingApp = await _dbContext.SellerApplications
                .AsNoTracking()
                .Where(a => a.UserId == sellerUserId && a.Status == ApplicationStatus.Pending)
                .FirstOrDefaultAsync(ct);

            var reason = pendingApp != null
                ? "Your identity verification application is currently under administrative review. Once approved, your official certificate and portable badges will be generated immediately."
                : "No approved identity verification application found for this account. To qualify for official MatchGuard certification, submit your national registration documentation via the Seller Verification page.";

            return new SellerCredentialStatusDto(
                IsEligible: false,
                IneligibilityReason: reason,
                ActiveCredential: null,
                History: Array.Empty<SellerCredentialDto>()
            );
        }

        var store = await _dbContext.SellerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.SellerUserId == sellerUserId, ct);

        // Fetch credentials
        var credentials = await _dbContext.SellerCredentials
            .AsNoTracking()
            .Where(c => c.SellerUserId == sellerUserId)
            .OrderByDescending(c => c.IssuedAtUtc)
            .ToListAsync(ct);

        // Auto-heal: If seller is approved by admin, has an active account, but no credential exists yet, issue initial credential.
        if (!credentials.Any())
        {
            var adminId = approvedApp.ReviewedByUserId ?? sellerUserId;
            var newCredDto = await IssueCredentialAsync(
                sellerUserId,
                adminId,
                "Auto-issued official credential for approved verified seller.",
                Guid.NewGuid().ToString("N"),
                ct);

            return new SellerCredentialStatusDto(
                IsEligible: true,
                IneligibilityReason: null,
                ActiveCredential: newCredDto,
                History: new[] { newCredDto }
            );
        }

        var storeName = store?.StoreName ?? approvedApp.ProposedStoreName;
        var displayName = user.DisplayName;
        var frontendUrl = GetFrontendBaseUrl();

        var historyDtos = credentials.Select(c => MapToDto(c, storeName, displayName, frontendUrl)).ToList();
        var activeCredential = historyDtos.FirstOrDefault(c => c.Status == "Active");

        return new SellerCredentialStatusDto(
            IsEligible: true,
            IneligibilityReason: null,
            ActiveCredential: activeCredential,
            History: historyDtos
        );
    }

    public async Task<SellerCredentialDto> IssueCredentialAsync(
        Guid sellerUserId,
        Guid adminUserId,
        string? reason,
        string correlationId,
        CancellationToken ct = default)
    {
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == sellerUserId, ct);
        if (user == null)
        {
            throw new NotFoundException("User", sellerUserId.ToString());
        }

        if (user.AccountStatus != AccountStatus.Active)
        {
            throw new ForbiddenException($"Cannot issue credential to an account in '{user.AccountStatus}' standing.", "INACTIVE_USER_ACCOUNT");
        }

        var approvedApp = await _dbContext.SellerApplications
            .Where(a => a.UserId == sellerUserId && a.Status == ApplicationStatus.Approved)
            .OrderByDescending(a => a.ReviewedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (approvedApp == null)
        {
            throw new ForbiddenException("Seller does not have an approved identity verification application. Verification approval is mandatory prior to credential issuance.", "UNAPPROVED_SELLER");
        }

        var store = await _dbContext.SellerProfiles
            .FirstOrDefaultAsync(s => s.SellerUserId == sellerUserId, ct);

        // Check if an active credential already exists for this seller
        var existingActive = await _dbContext.SellerCredentials
            .FirstOrDefaultAsync(c => c.SellerUserId == sellerUserId &&
                                      c.CredentialType == CredentialType.IdentityVerified &&
                                      c.Status == CredentialStatus.Active, ct);

        var storeName = store?.StoreName ?? approvedApp.ProposedStoreName;
        var frontendUrl = GetFrontendBaseUrl();

        if (existingActive != null)
        {
            _logger.LogInformation("Active credential already exists for seller {SellerUserId}: {CredentialId}", sellerUserId, existingActive.PublicCredentialId);
            return MapToDto(existingActive, storeName, user.DisplayName, frontendUrl);
        }

        var publicId = GeneratePublicCredentialId();

        var credential = SellerCredential.Issue(
            sellerUserId: sellerUserId,
            sellerApplicationId: approvedApp.Id,
            issuedByAdminUserId: adminUserId,
            publicCredentialId: publicId,
            credentialType: CredentialType.IdentityVerified);

        _dbContext.SellerCredentials.Add(credential);

        var audit = AuditEvent.Create(
            action: "SellerCredential_Issued",
            targetType: "SellerCredential",
            targetId: credential.Id.ToString(),
            correlationId: correlationId,
            actorUserId: adminUserId,
            reason: reason ?? "Official Identity-Verified Seller credential issued following approved verification.");

        _dbContext.AuditEvents.Add(audit);

        await _dbContext.SaveChangesAsync(ct);

        _logger.LogInformation("Issued credential {PublicId} for seller {SellerId} by admin {AdminId}", publicId, sellerUserId, adminUserId);

        return MapToDto(credential, storeName, user.DisplayName, frontendUrl);
    }

    public async Task<SellerCredentialDto> RevokeCredentialAsync(
        Guid credentialId,
        Guid adminUserId,
        string reason,
        string correlationId,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Reason"] = new[] { "A specific revocation reason is required." }
            });
        }

        var credential = await _dbContext.SellerCredentials
            .FirstOrDefaultAsync(c => c.Id == credentialId, ct);

        if (credential == null)
        {
            throw new NotFoundException($"Seller credential '{credentialId}' was not found.");
        }

        credential.Revoke(adminUserId, reason);

        var audit = AuditEvent.Create(
            action: "SellerCredential_Revoked",
            targetType: "SellerCredential",
            targetId: credential.Id.ToString(),
            correlationId: correlationId,
            actorUserId: adminUserId,
            reason: reason);

        _dbContext.AuditEvents.Add(audit);

        await _dbContext.SaveChangesAsync(ct);

        _logger.LogWarning("Revoked credential {PublicId} by admin {AdminId}. Reason: {Reason}", credential.PublicCredentialId, adminUserId, reason);

        var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == credential.SellerUserId, ct);
        var store = await _dbContext.SellerProfiles.AsNoTracking().FirstOrDefaultAsync(s => s.SellerUserId == credential.SellerUserId, ct);

        return MapToDto(credential, store?.StoreName ?? "Verified Store", user?.DisplayName ?? "Artisan Seller", GetFrontendBaseUrl());
    }

    public async Task<PublicCredentialVerificationDto> VerifyPublicCredentialAsync(string publicCredentialId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(publicCredentialId))
        {
            return new PublicCredentialVerificationDto(
                PublicCredentialId: string.Empty,
                Status: "Invalid",
                SellerDisplayName: null,
                StoreName: null,
                CredentialType: "Identity Verified",
                IssuedAtUtc: null,
                RevokedAtUtc: null,
                RevocationReason: null,
                VerificationScope: StandardScope,
                IsValid: false
            );
        }

        var cleanId = publicCredentialId.Trim().ToUpperInvariant();

        var credential = await _dbContext.SellerCredentials
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.PublicCredentialId == cleanId, ct);

        if (credential == null)
        {
            return new PublicCredentialVerificationDto(
                PublicCredentialId: cleanId,
                Status: "Invalid",
                SellerDisplayName: null,
                StoreName: null,
                CredentialType: "Identity Verified",
                IssuedAtUtc: null,
                RevokedAtUtc: null,
                RevocationReason: null,
                VerificationScope: StandardScope,
                IsValid: false
            );
        }

        var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == credential.SellerUserId, ct);
        var store = await _dbContext.SellerProfiles.AsNoTracking().FirstOrDefaultAsync(s => s.SellerUserId == credential.SellerUserId, ct);

        // Check if account status has been suspended since issuance
        var isAccountActive = user != null && user.AccountStatus == AccountStatus.Active;
        var effectiveStatus = (!isAccountActive && credential.Status == CredentialStatus.Active)
            ? "Suspended"
            : credential.Status.ToString();

        var isValid = credential.Status == CredentialStatus.Active && isAccountActive;

        return new PublicCredentialVerificationDto(
            PublicCredentialId: credential.PublicCredentialId,
            Status: effectiveStatus,
            SellerDisplayName: user?.DisplayName,
            StoreName: store?.StoreName,
            CredentialType: "Identity Verified",
            IssuedAtUtc: credential.IssuedAtUtc,
            RevokedAtUtc: credential.RevokedAtUtc,
            RevocationReason: credential.RevocationReason,
            VerificationScope: StandardScope,
            IsValid: isValid
        );
    }

    public async Task<byte[]> GenerateCertificatePdfAsync(
        Guid credentialId,
        Guid requestingUserId,
        bool isAdmin,
        CancellationToken ct = default)
    {
        var credential = await _dbContext.SellerCredentials
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == credentialId, ct);

        if (credential == null)
        {
            throw new NotFoundException($"Seller credential '{credentialId}' was not found.");
        }

        if (!isAdmin && credential.SellerUserId != requestingUserId)
        {
            throw new ForbiddenException("You do not have permission to access another seller's certificate.", "ACCESS_DENIED");
        }

        var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == credential.SellerUserId, ct);
        var store = await _dbContext.SellerProfiles.AsNoTracking().FirstOrDefaultAsync(s => s.SellerUserId == credential.SellerUserId, ct);

        var publicUrl = $"{GetFrontendBaseUrl()}/verify/{credential.PublicCredentialId}";

        return CertificatePdfGenerator.Generate(
            publicCredentialId: credential.PublicCredentialId,
            sellerDisplayName: user?.DisplayName ?? "Artisan Seller",
            storeName: store?.StoreName ?? "Artisan Store",
            issuedAtUtc: credential.IssuedAtUtc,
            status: credential.Status,
            publicVerificationUrl: publicUrl
        );
    }

    public async Task<string> GenerateBadgeSvgAsync(string publicCredentialId, CancellationToken ct = default)
    {
        var cleanId = publicCredentialId.Trim().ToUpperInvariant();
        var credential = await _dbContext.SellerCredentials
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.PublicCredentialId == cleanId, ct);

        var publicUrl = $"{GetFrontendBaseUrl()}/verify/{cleanId}";

        if (credential == null)
        {
            return BadgeGenerator.GenerateSvgBadge(
                cleanId,
                "Unverified",
                "Unregistered",
                CredentialStatus.Revoked,
                publicUrl);
        }

        var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == credential.SellerUserId, ct);
        var store = await _dbContext.SellerProfiles.AsNoTracking().FirstOrDefaultAsync(s => s.SellerUserId == credential.SellerUserId, ct);

        var isAccountActive = user != null && user.AccountStatus == AccountStatus.Active;
        var effectiveStatus = (!isAccountActive && credential.Status == CredentialStatus.Active)
            ? CredentialStatus.Revoked
            : credential.Status;

        return BadgeGenerator.GenerateSvgBadge(
            credential.PublicCredentialId,
            user?.DisplayName ?? "Artisan Seller",
            store?.StoreName ?? "Artisan Store",
            effectiveStatus,
            publicUrl);
    }

    public async Task<byte[]> GenerateBadgePngAsync(string publicCredentialId, CancellationToken ct = default)
    {
        var cleanId = publicCredentialId.Trim().ToUpperInvariant();
        var credential = await _dbContext.SellerCredentials
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.PublicCredentialId == cleanId, ct);

        var publicUrl = $"{GetFrontendBaseUrl()}/verify/{cleanId}";

        if (credential == null)
        {
            return BadgeGenerator.GeneratePngBadge(
                cleanId,
                "Unverified",
                "Unregistered",
                CredentialStatus.Revoked,
                publicUrl);
        }

        var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == credential.SellerUserId, ct);
        var store = await _dbContext.SellerProfiles.AsNoTracking().FirstOrDefaultAsync(s => s.SellerUserId == credential.SellerUserId, ct);

        var isAccountActive = user != null && user.AccountStatus == AccountStatus.Active;
        var effectiveStatus = (!isAccountActive && credential.Status == CredentialStatus.Active)
            ? CredentialStatus.Revoked
            : credential.Status;

        return BadgeGenerator.GeneratePngBadge(
            credential.PublicCredentialId,
            user?.DisplayName ?? "Artisan Seller",
            store?.StoreName ?? "Artisan Store",
            effectiveStatus,
            publicUrl);
    }

    public async Task<IReadOnlyList<SellerCredentialDto>> GetCredentialsForAdminAsync(
        CredentialStatus? statusFilter = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _dbContext.SellerCredentials.AsNoTracking();

        if (statusFilter.HasValue)
        {
            query = query.Where(c => c.Status == statusFilter.Value);
        }

        var credentials = await query
            .OrderByDescending(c => c.IssuedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var sellerUserIds = credentials.Select(c => c.SellerUserId).Distinct().ToList();
        var users = await _dbContext.Users.AsNoTracking()
            .Where(u => sellerUserIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName, ct);

        var stores = await _dbContext.SellerProfiles.AsNoTracking()
            .Where(s => sellerUserIds.Contains(s.SellerUserId))
            .ToDictionaryAsync(s => s.SellerUserId, s => s.StoreName, ct);

        var frontendUrl = GetFrontendBaseUrl();

        return credentials.Select(c =>
        {
            users.TryGetValue(c.SellerUserId, out var displayName);
            stores.TryGetValue(c.SellerUserId, out var storeName);
            return MapToDto(c, storeName ?? "Artisan Store", displayName ?? "Seller", frontendUrl);
        }).ToList();
    }

    private static string GeneratePublicCredentialId()
    {
        // 12 cryptographically random alphanumeric characters formatted as MG-ID-XXXX-XXXX-XXXX
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var randomBytes = RandomNumberGenerator.GetBytes(12);
        var sb = new StringBuilder("MG-ID-");

        for (int i = 0; i < 12; i++)
        {
            if (i > 0 && i % 4 == 0)
            {
                sb.Append('-');
            }
            sb.Append(chars[randomBytes[i] % chars.Length]);
        }

        return sb.ToString();
    }

    private static SellerCredentialDto MapToDto(
        SellerCredential c,
        string storeName,
        string sellerDisplayName,
        string frontendUrl)
    {
        var publicVerificationUrl = $"{frontendUrl}/verify/{c.PublicCredentialId}";
        var badgeSvgUrl = $"/api/v1/public/credentials/{c.PublicCredentialId}/badge.svg";
        var badgePngUrl = $"/api/v1/public/credentials/{c.PublicCredentialId}/badge.png";
        var certificateUrl = $"/api/v1/seller/credentials/{c.Id}/certificate";

        return new SellerCredentialDto(
            Id: c.Id,
            PublicCredentialId: c.PublicCredentialId,
            SellerUserId: c.SellerUserId,
            StoreName: storeName,
            SellerDisplayName: sellerDisplayName,
            CredentialType: c.CredentialType == CredentialType.IdentityVerified ? "Identity Verified" : c.CredentialType.ToString(),
            Status: c.Status.ToString(),
            IssuedAtUtc: c.IssuedAtUtc,
            RevokedAtUtc: c.RevokedAtUtc,
            RevocationReason: c.RevocationReason,
            PublicVerificationUrl: publicVerificationUrl,
            BadgeSvgUrl: badgeSvgUrl,
            BadgePngUrl: badgePngUrl,
            CertificateDownloadUrl: certificateUrl
        );
    }
}
