using TrustedMarketplace.Domain.Common.Exceptions;
using TrustedMarketplace.Domain.Verification;

namespace TrustedMarketplace.UnitTests.Verification;

public class SellerApplicationDomainTests
{
    [Fact]
    public void NewApplication_ValidParameters_InitializesWithPendingStatus()
    {
        var userId = Guid.NewGuid();
        var app = new SellerApplication(userId, "Mandalay Crafts", "IndividualCrafter", "0912345678");

        Assert.Equal(userId, app.UserId);
        Assert.Equal("Mandalay Crafts", app.ProposedStoreName);
        Assert.Equal("IndividualCrafter", app.BusinessType);
        Assert.Equal("0912345678", app.ContactPhone);
        Assert.Equal(ApplicationStatus.Pending, app.Status);
        Assert.Empty(app.Evidence);
        Assert.Null(app.ReviewedAtUtc);
    }

    [Theory]
    [InlineData("", "Retail", "0912345678")]
    [InlineData("Store", "", "0912345678")]
    [InlineData("Store", "Retail", "")]
    public void NewApplication_InvalidParameters_ThrowsArgumentException(string storeName, string businessType, string phone)
    {
        Assert.Throws<ArgumentException>(() =>
            new SellerApplication(Guid.NewGuid(), storeName, businessType, phone));
    }

    [Fact]
    public void AddEvidence_PendingStatus_AddsEvidenceSuccessfully()
    {
        var app = new SellerApplication(Guid.NewGuid(), "Mandalay Crafts", "IndividualCrafter", "0912345678");

        var evidence = app.AddEvidence(
            EvidenceType.NationalIdFront,
            "2026/10/fake.jpg",
            "nrc_front.jpg",
            1024,
            "image/jpeg",
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

        Assert.Single(app.Evidence);
        Assert.Equal(EvidenceType.NationalIdFront, evidence.EvidenceType);
        Assert.Equal(EvidenceReviewStatus.Pending, evidence.ReviewStatus);
    }

    [Fact]
    public void Approve_FromPending_TransitionsToApprovedAndMarksEvidenceVerified()
    {
        var reviewerId = Guid.NewGuid();
        var app = new SellerApplication(Guid.NewGuid(), "Mandalay Crafts", "IndividualCrafter", "0912345678");
        var evidence = app.AddEvidence(
            EvidenceType.NationalIdFront,
            "2026/10/fake.jpg",
            "nrc_front.jpg",
            1024,
            "image/jpeg",
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

        app.Approve(reviewerId, "NRC verified against registry.");

        Assert.Equal(ApplicationStatus.Approved, app.Status);
        Assert.Equal(reviewerId, app.ReviewedByUserId);
        Assert.Equal("NRC verified against registry.", app.DecisionReason);
        Assert.NotNull(app.ReviewedAtUtc);
        Assert.Equal(EvidenceReviewStatus.Verified, evidence.ReviewStatus);
    }

    [Fact]
    public void Reject_FromPending_TransitionsToRejectedAndSetsRetention()
    {
        var reviewerId = Guid.NewGuid();
        var app = new SellerApplication(Guid.NewGuid(), "Mandalay Crafts", "IndividualCrafter", "0912345678");
        var evidence = app.AddEvidence(
            EvidenceType.NationalIdFront,
            "2026/10/fake.jpg",
            "nrc_front.jpg",
            1024,
            "image/jpeg",
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

        app.Reject(reviewerId, "Document illegible.");

        Assert.Equal(ApplicationStatus.Rejected, app.Status);
        Assert.Equal("Document illegible.", app.DecisionReason);
        Assert.Equal(EvidenceReviewStatus.Rejected, evidence.ReviewStatus);
        Assert.NotNull(evidence.RetentionUntilUtc);
    }

    [Fact]
    public void AddEvidence_WhenApproved_ThrowsDomainException()
    {
        var app = new SellerApplication(Guid.NewGuid(), "Mandalay Crafts", "IndividualCrafter", "0912345678");
        app.Approve(Guid.NewGuid(), "Approved.");

        Assert.Throws<DomainException>(() =>
            app.AddEvidence(
                EvidenceType.BusinessLicense,
                "2026/10/fake.jpg",
                "license.jpg",
                1024,
                "image/jpeg",
                "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"));
    }
}
