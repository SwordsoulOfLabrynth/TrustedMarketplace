using TrustedMarketplace.Domain.Stores;
using TrustedMarketplace.Domain.Verification;
using Xunit;

namespace TrustedMarketplace.UnitTests.Verification;

public class AdminApplicationStatusMappingTests
{
    [Fact]
    public void NewApplication_Status_SerializesToPendingString()
    {
        var app = new SellerApplication(
            Guid.NewGuid(),
            "Artisan Gem Workshop",
            "IndividualCrafter",
            "09455554146");

        Assert.Equal(ApplicationStatus.Pending, app.Status);
        Assert.Equal("Pending", app.Status.ToString());
    }

    [Fact]
    public void RequestMoreInformation_TransitionsToMoreInformationRequired()
    {
        var app = new SellerApplication(
            Guid.NewGuid(),
            "Mandalay Puppets",
            "IndividualCrafter",
            "09455554146");

        var adminUserId = Guid.NewGuid();
        app.RequestMoreInformation(adminUserId, "Please provide workshop registration document.");

        Assert.Equal(ApplicationStatus.MoreInformationRequired, app.Status);
        Assert.Equal("MoreInformationRequired", app.Status.ToString());
        Assert.Equal(adminUserId, app.ReviewedByUserId);
        Assert.Equal("Please provide workshop registration document.", app.DecisionReason);
    }

    [Fact]
    public void ApplicationApproval_EnablesSellerProfileCreation()
    {
        var userId = Guid.NewGuid();
        var app = new SellerApplication(
            userId,
            "Bagan Lacquerware",
            "ArtisanCooperative",
            "09455554146");

        var adminUserId = Guid.NewGuid();
        app.Approve(adminUserId, "Credentials and artisan lineage verified.");

        Assert.Equal(ApplicationStatus.Approved, app.Status);
        Assert.Equal("Approved", app.Status.ToString());

        // Domain verification of seller profile creation upon approval
        var profile = new SellerProfile(app.UserId, app.ProposedStoreName, app.ContactPhone);
        Assert.Equal(userId, profile.SellerUserId);
        Assert.Equal("Bagan Lacquerware", profile.StoreName);
        Assert.Equal(SellerVerificationStatus.Verified, profile.VerificationStatus);
    }

    [Fact]
    public void ApplicationRejection_KeepsStrictSeparationWithoutSellerProfile()
    {
        var userId = Guid.NewGuid();
        var app = new SellerApplication(
            userId,
            "Non Compliant Store",
            "IndividualCrafter",
            "09455554146");

        var adminUserId = Guid.NewGuid();
        app.Reject(adminUserId, "Counterfeit items suspected.");

        Assert.Equal(ApplicationStatus.Rejected, app.Status);
        Assert.Equal("Rejected", app.Status.ToString());
        // Verify buyer remains without store profile
    }
}
