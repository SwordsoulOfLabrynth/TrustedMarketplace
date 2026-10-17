using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Domain.Credentials;
using TrustedMarketplace.Domain.Identity;
using TrustedMarketplace.Domain.Stores;
using TrustedMarketplace.Domain.Verification;
using TrustedMarketplace.Infrastructure.Credentials;
using TrustedMarketplace.Infrastructure.Identity;
using TrustedMarketplace.Infrastructure.Persistence;
using Xunit;

namespace TrustedMarketplace.UnitTests.Credentials;

public class CredentialServiceTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly CredentialService _credentialService;
    private readonly IConfiguration _configuration;

    public CredentialServiceTests()
    {
        var dbName = "Test_Cred_" + Guid.NewGuid().ToString("N");
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;

        _dbContext = new AppDbContext(options);

        _configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["FrontendBaseUrl"] = "https://trusted-marketplace.vercel.app"
            })
            .Build();

        _credentialService = new CredentialService(
            _dbContext,
            _configuration,
            NullLogger<CredentialService>.Instance);
    }

    public void Dispose()
    {
        _dbContext.Database.EnsureDeleted();
        _dbContext.Dispose();
    }

    private async Task<(ApplicationUser Seller, SellerApplication App, SellerProfile Store, ApplicationUser Admin)> SeedApprovedSellerAsync()
    {
        var admin = new ApplicationUser("admin@trustedmarketplace.local", "Platform Admin")
        {
            AccountStatus = AccountStatus.Active
        };
        _dbContext.Users.Add(admin);

        var seller = new ApplicationUser("artisan@trustedmarketplace.local", "Daw Khin Artisan")
        {
            AccountStatus = AccountStatus.Active
        };
        _dbContext.Users.Add(seller);

        var app = new SellerApplication(
            seller.Id,
            "Bagan Heritage Crafts",
            "IndividualCrafter",
            "09455554146");
        app.Approve(admin.Id, "National registry and identity verified.");
        _dbContext.SellerApplications.Add(app);

        var store = new SellerProfile(seller.Id, "Bagan Heritage Crafts", "09455554146");
        _dbContext.SellerProfiles.Add(store);

        await _dbContext.SaveChangesAsync();

        return (seller, app, store, admin);
    }

    [Fact]
    public async Task IssueCredential_EligibleApprovedSeller_IssuesActiveCredential()
    {
        var (seller, app, store, admin) = await SeedApprovedSellerAsync();

        var result = await _credentialService.IssueCredentialAsync(
            seller.Id,
            admin.Id,
            "Initial issuance",
            "corr-1");

        Assert.NotNull(result);
        Assert.Equal(seller.Id, result.SellerUserId);
        Assert.Equal("Active", result.Status);
        Assert.StartsWith("MG-ID-", result.PublicCredentialId);
        Assert.Equal("Identity Verified", result.CredentialType);
        Assert.Equal(store.StoreName, result.StoreName);
        Assert.Equal(seller.DisplayName, result.SellerDisplayName);

        var saved = await _dbContext.SellerCredentials.FirstOrDefaultAsync(c => c.Id == result.Id);
        Assert.NotNull(saved);
        Assert.Equal(CredentialStatus.Active, saved.Status);

        var audit = await _dbContext.AuditEvents.FirstOrDefaultAsync(a => a.Action == "SellerCredential_Issued");
        Assert.NotNull(audit);
    }

    [Fact]
    public async Task IssueCredential_UnapprovedSeller_ThrowsForbiddenException()
    {
        var admin = new ApplicationUser("admin@test.com", "Admin") { AccountStatus = AccountStatus.Active };
        var seller = new ApplicationUser("unapproved@test.com", "Unapproved Seller") { AccountStatus = AccountStatus.Active };
        _dbContext.Users.AddRange(admin, seller);

        var pendingApp = new SellerApplication(seller.Id, "Pending Store", "Crafter", "0911111111");
        _dbContext.SellerApplications.Add(pendingApp);
        await _dbContext.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            _credentialService.IssueCredentialAsync(seller.Id, admin.Id, "Try issue", "corr-2"));

        Assert.Equal("UNAPPROVED_SELLER", ex.Code);
    }

    [Fact]
    public async Task IssueCredential_SuspendedUser_ThrowsForbiddenException()
    {
        var (seller, _, _, admin) = await SeedApprovedSellerAsync();
        seller.Suspend();
        await _dbContext.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            _credentialService.IssueCredentialAsync(seller.Id, admin.Id, "Try issue suspended", "corr-3"));

        Assert.Equal("INACTIVE_USER_ACCOUNT", ex.Code);
    }

    [Fact]
    public async Task IssueCredential_DuplicateRequest_ReturnsExistingActiveWithoutDuplicating()
    {
        var (seller, _, _, admin) = await SeedApprovedSellerAsync();

        var cred1 = await _credentialService.IssueCredentialAsync(seller.Id, admin.Id, "First call", "corr-4a");
        var cred2 = await _credentialService.IssueCredentialAsync(seller.Id, admin.Id, "Second call", "corr-4b");

        Assert.Equal(cred1.Id, cred2.Id);
        Assert.Equal(cred1.PublicCredentialId, cred2.PublicCredentialId);

        var count = await _dbContext.SellerCredentials.CountAsync(c => c.SellerUserId == seller.Id);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task RevokeCredential_ValidReason_RevokesActiveCredentialAndEmitsAudit()
    {
        var (seller, _, _, admin) = await SeedApprovedSellerAsync();
        var issued = await _credentialService.IssueCredentialAsync(seller.Id, admin.Id, "Initial", "corr-5");

        var revoked = await _credentialService.RevokeCredentialAsync(
            issued.Id,
            admin.Id,
            "Workshop license expired",
            "corr-5-revoke");

        Assert.Equal("Revoked", revoked.Status);
        Assert.NotNull(revoked.RevokedAtUtc);
        Assert.Equal("Workshop license expired", revoked.RevocationReason);

        var audit = await _dbContext.AuditEvents.FirstOrDefaultAsync(a => a.Action == "SellerCredential_Revoked");
        Assert.NotNull(audit);
    }

    [Fact]
    public async Task RevokeCredential_EmptyReason_ThrowsValidationException()
    {
        var (seller, _, _, admin) = await SeedApprovedSellerAsync();
        var issued = await _credentialService.IssueCredentialAsync(seller.Id, admin.Id, "Initial", "corr-6");

        await Assert.ThrowsAsync<ValidationException>(() =>
            _credentialService.RevokeCredentialAsync(issued.Id, admin.Id, "   ", "corr-6-fail"));
    }

    [Fact]
    public async Task VerifyPublicCredential_ValidActive_ReturnsActiveAndSafeData()
    {
        var (seller, _, store, admin) = await SeedApprovedSellerAsync();
        var issued = await _credentialService.IssueCredentialAsync(seller.Id, admin.Id, "Initial", "corr-7");

        var verification = await _credentialService.VerifyPublicCredentialAsync(issued.PublicCredentialId);

        Assert.True(verification.IsValid);
        Assert.Equal("Active", verification.Status);
        Assert.Equal(seller.DisplayName, verification.SellerDisplayName);
        Assert.Equal(store.StoreName, verification.StoreName);
        Assert.Equal("Identity Verified", verification.CredentialType);
        Assert.NotNull(verification.IssuedAtUtc);
        Assert.Null(verification.RevokedAtUtc);
        Assert.Contains("verified the identity", verification.VerificationScope);
    }

    [Fact]
    public async Task VerifyPublicCredential_Revoked_ReturnsRevokedAndIsValidFalse()
    {
        var (seller, _, _, admin) = await SeedApprovedSellerAsync();
        var issued = await _credentialService.IssueCredentialAsync(seller.Id, admin.Id, "Initial", "corr-8");
        await _credentialService.RevokeCredentialAsync(issued.Id, admin.Id, "Identity documents invalidated", "corr-8-r");

        var verification = await _credentialService.VerifyPublicCredentialAsync(issued.PublicCredentialId);

        Assert.False(verification.IsValid);
        Assert.Equal("Revoked", verification.Status);
        Assert.NotNull(verification.RevokedAtUtc);
        Assert.Equal("Identity documents invalidated", verification.RevocationReason);
    }

    [Fact]
    public async Task VerifyPublicCredential_InvalidId_ReturnsInvalidWithoutPrivateDataLeakage()
    {
        var verification = await _credentialService.VerifyPublicCredentialAsync("MG-ID-FABRICATED-9999");

        Assert.False(verification.IsValid);
        Assert.Equal("Invalid", verification.Status);
        Assert.Null(verification.SellerDisplayName);
        Assert.Null(verification.StoreName);
        Assert.Null(verification.IssuedAtUtc);
    }

    [Fact]
    public async Task GetMyCredentialStatus_EligibleAndActive_ReturnsActiveCredential()
    {
        var (seller, _, _, admin) = await SeedApprovedSellerAsync();
        var issued = await _credentialService.IssueCredentialAsync(seller.Id, admin.Id, "Initial", "corr-9");

        var status = await _credentialService.GetMyCredentialStatusAsync(seller.Id);

        Assert.True(status.IsEligible);
        Assert.Null(status.IneligibilityReason);
        Assert.NotNull(status.ActiveCredential);
        Assert.Equal(issued.PublicCredentialId, status.ActiveCredential.PublicCredentialId);
        Assert.Single(status.History);
    }

    [Fact]
    public async Task GetMyCredentialStatus_Unverified_ReturnsIneligibleWithExplanation()
    {
        var unverifiedUser = new ApplicationUser("unverified@test.com", "Unverified User")
        {
            AccountStatus = AccountStatus.Active
        };
        _dbContext.Users.Add(unverifiedUser);
        await _dbContext.SaveChangesAsync();

        var status = await _credentialService.GetMyCredentialStatusAsync(unverifiedUser.Id);

        Assert.False(status.IsEligible);
        Assert.NotNull(status.IneligibilityReason);
        Assert.Null(status.ActiveCredential);
        Assert.Contains("No approved identity verification application found", status.IneligibilityReason);
    }

    [Fact]
    public async Task GenerateCertificatePdf_Owner_ProducesValidPdfBytes()
    {
        var (seller, _, _, admin) = await SeedApprovedSellerAsync();
        var issued = await _credentialService.IssueCredentialAsync(seller.Id, admin.Id, "Initial", "corr-10");

        var pdfBytes = await _credentialService.GenerateCertificatePdfAsync(
            issued.Id,
            seller.Id,
            isAdmin: false);

        Assert.NotNull(pdfBytes);
        Assert.True(pdfBytes.Length > 500);

        // PDF Header verification
        var header = System.Text.Encoding.ASCII.GetString(pdfBytes[..8]);
        Assert.StartsWith("%PDF-1.4", header);
    }

    [Fact]
    public async Task GenerateCertificatePdf_OtherSeller_ThrowsForbiddenException_IDOR_Protection()
    {
        var (sellerA, _, _, admin) = await SeedApprovedSellerAsync();
        var issuedA = await _credentialService.IssueCredentialAsync(sellerA.Id, admin.Id, "Initial A", "corr-11");

        var sellerB = new ApplicationUser("sellerB@test.com", "Seller B") { AccountStatus = AccountStatus.Active };
        _dbContext.Users.Add(sellerB);
        await _dbContext.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            _credentialService.GenerateCertificatePdfAsync(issuedA.Id, sellerB.Id, isAdmin: false));

        Assert.Equal("ACCESS_DENIED", ex.Code);
    }

    [Fact]
    public async Task GenerateBadgeSvg_ReturnsValidSvgWithPublicVerificationUrl()
    {
        var (seller, _, _, admin) = await SeedApprovedSellerAsync();
        var issued = await _credentialService.IssueCredentialAsync(seller.Id, admin.Id, "Initial", "corr-12");

        var svg = await _credentialService.GenerateBadgeSvgAsync(issued.PublicCredentialId);

        Assert.NotNull(svg);
        Assert.Contains("<svg", svg);
        Assert.Contains("Identity-Verified Seller", svg);
        Assert.Contains(issued.PublicCredentialId, svg);
        Assert.Contains("https://trusted-marketplace.vercel.app/verify/" + issued.PublicCredentialId, svg);
    }

    [Fact]
    public async Task GenerateBadgePng_ReturnsValidPngWithHeader()
    {
        var (seller, _, _, admin) = await SeedApprovedSellerAsync();
        var issued = await _credentialService.IssueCredentialAsync(seller.Id, admin.Id, "Initial", "corr-13");

        var pngBytes = await _credentialService.GenerateBadgePngAsync(issued.PublicCredentialId);

        Assert.NotNull(pngBytes);
        Assert.True(pngBytes.Length > 100);

        // Verify PNG magic bytes: 0x89 'P' 'N' 'G' 0x0D 0x0A 0x1A 0x0A
        Assert.Equal(0x89, pngBytes[0]);
        Assert.Equal((byte)'P', pngBytes[1]);
        Assert.Equal((byte)'N', pngBytes[2]);
        Assert.Equal((byte)'G', pngBytes[3]);
    }

    [Fact]
    public async Task GetMyCredentialStatus_ApprovedSellerWithoutPriorCredential_AutoHealsAndIssuesCredential()
    {
        // Seller approved by admin, but no credential was issued prior (e.g. migration or legacy approval)
        var (seller, _, store, _) = await SeedApprovedSellerAsync();

        var initialCount = await _dbContext.SellerCredentials.CountAsync(c => c.SellerUserId == seller.Id);
        Assert.Equal(0, initialCount);

        var status = await _credentialService.GetMyCredentialStatusAsync(seller.Id);

        Assert.True(status.IsEligible);
        Assert.Null(status.IneligibilityReason);
        Assert.NotNull(status.ActiveCredential);
        Assert.Equal("Active", status.ActiveCredential.Status);
        Assert.StartsWith("MG-ID-", status.ActiveCredential.PublicCredentialId);
        Assert.Equal(store.StoreName, status.ActiveCredential.StoreName);

        var finalCount = await _dbContext.SellerCredentials.CountAsync(c => c.SellerUserId == seller.Id);
        Assert.Equal(1, finalCount);
    }

    [Fact]
    public async Task GenerateBadgePng_Revoked_ReturnsValidPngWithRevokedStatus()
    {
        var (seller, _, _, admin) = await SeedApprovedSellerAsync();
        var issued = await _credentialService.IssueCredentialAsync(seller.Id, admin.Id, "Initial", "corr-14");
        await _credentialService.RevokeCredentialAsync(issued.Id, admin.Id, "Audit failure", "corr-14-r");

        var pngBytes = await _credentialService.GenerateBadgePngAsync(issued.PublicCredentialId);

        Assert.NotNull(pngBytes);
        Assert.True(pngBytes.Length > 100);
        Assert.Equal(0x89, pngBytes[0]);
        Assert.Equal((byte)'P', pngBytes[1]);
    }

    [Fact]
    public async Task GenerateBadgeSvg_SuspendedAccount_RendersRevokedStatus()
    {
        var (seller, _, _, admin) = await SeedApprovedSellerAsync();
        var issued = await _credentialService.IssueCredentialAsync(seller.Id, admin.Id, "Initial", "corr-15");

        seller.Suspend();
        await _dbContext.SaveChangesAsync();

        var svg = await _credentialService.GenerateBadgeSvgAsync(issued.PublicCredentialId);

        Assert.NotNull(svg);
        Assert.Contains("REVOKED", svg);
        Assert.DoesNotContain("ACTIVE VERIFIED", svg);
    }
}
