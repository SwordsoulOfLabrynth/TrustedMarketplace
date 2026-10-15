using TrustedMarketplace.Domain.Common.Exceptions;
using TrustedMarketplace.Domain.Stores;

namespace TrustedMarketplace.UnitTests.Stores;

public class SellerProfileDomainTests
{
    [Fact]
    public void NewProfile_ValidData_InitializesWithVerifiedStatusAndSlug()
    {
        var sellerId = Guid.NewGuid();
        var profile = new SellerProfile(sellerId, "Mandalay Woodcrafts", "0912345678", "Handmade crafts", "Mandalay");

        Assert.Equal(sellerId, profile.SellerUserId);
        Assert.Equal("Mandalay Woodcrafts", profile.StoreName);
        Assert.Equal("mandalay-woodcrafts", profile.Slug);
        Assert.Equal("0912345678", profile.ContactPhone);
        Assert.Equal("Handmade crafts", profile.Bio);
        Assert.Equal("Mandalay", profile.CityOrTownship);
        Assert.Equal(SellerVerificationStatus.Verified, profile.VerificationStatus);
    }

    [Fact]
    public void UpdateProfile_WithoutStoreNameChange_PreservesVerifiedStatus()
    {
        var profile = new SellerProfile(Guid.NewGuid(), "Mandalay Woodcrafts", "0912345678");

        var changed = profile.UpdateProfile("Mandalay Woodcrafts", "Updated bio", "0999999999", "Yangon");

        Assert.False(changed);
        Assert.Equal(SellerVerificationStatus.Verified, profile.VerificationStatus);
        Assert.Equal("Updated bio", profile.Bio);
        Assert.Equal("0999999999", profile.ContactPhone);
        Assert.Equal("Yangon", profile.CityOrTownship);
    }

    [Fact]
    public void UpdateProfile_WithStoreNameChange_SetsPendingReverificationAndUpdatesSlug_SEC_04()
    {
        var profile = new SellerProfile(Guid.NewGuid(), "Old Store Name", "0912345678");

        var changed = profile.UpdateProfile("New Shiny Store", "Bio", "0912345678", "Mandalay");

        Assert.True(changed);
        Assert.Equal(SellerVerificationStatus.PendingReverification, profile.VerificationStatus);
        Assert.Equal("New Shiny Store", profile.StoreName);
        Assert.Equal("new-shiny-store", profile.Slug);
    }

    [Fact]
    public void MarkVerified_RestoresVerificationStatusToVerified()
    {
        var profile = new SellerProfile(Guid.NewGuid(), "Store Name", "0912345678");
        profile.UpdateProfile("Changed Name", null, "0912345678", null);
        Assert.Equal(SellerVerificationStatus.PendingReverification, profile.VerificationStatus);

        profile.MarkVerified();

        Assert.Equal(SellerVerificationStatus.Verified, profile.VerificationStatus);
    }

    [Fact]
    public void ApproveReverification_WhenPending_SetsStatusToVerified()
    {
        var profile = new SellerProfile(Guid.NewGuid(), "Store Name", "0912345678");
        profile.UpdateProfile("Renamed Store", null, "0912345678", null);
        Assert.Equal(SellerVerificationStatus.PendingReverification, profile.VerificationStatus);

        profile.ApproveReverification();

        Assert.Equal(SellerVerificationStatus.Verified, profile.VerificationStatus);
    }

    [Fact]
    public void ApproveReverification_WhenNotPending_ThrowsDomainException()
    {
        var profile = new SellerProfile(Guid.NewGuid(), "Store Name", "0912345678");
        Assert.Equal(SellerVerificationStatus.Verified, profile.VerificationStatus);

        var ex = Assert.Throws<DomainException>(() => profile.ApproveReverification());
        Assert.Contains("Cannot approve", ex.Message);
    }

    [Fact]
    public void RejectReverification_WhenPending_SetsStatusToReverificationRejected()
    {
        var profile = new SellerProfile(Guid.NewGuid(), "Store Name", "0912345678");
        profile.UpdateProfile("Brand Spoof Store", null, "0912345678", null);
        Assert.Equal(SellerVerificationStatus.PendingReverification, profile.VerificationStatus);

        profile.RejectReverification("Potential brand spoofing detected.");

        Assert.Equal(SellerVerificationStatus.ReverificationRejected, profile.VerificationStatus);
    }

    [Fact]
    public void RejectReverification_WhenNotPending_ThrowsDomainException()
    {
        var profile = new SellerProfile(Guid.NewGuid(), "Store Name", "0912345678");
        Assert.Equal(SellerVerificationStatus.Verified, profile.VerificationStatus);

        var ex = Assert.Throws<DomainException>(() => profile.RejectReverification("Reason"));
        Assert.Contains("Cannot reject", ex.Message);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void RejectReverification_EmptyReason_ThrowsDomainException(string? invalidReason)
    {
        var profile = new SellerProfile(Guid.NewGuid(), "Store Name", "0912345678");
        profile.UpdateProfile("Renamed Store", null, "0912345678", null);

        var ex = Assert.Throws<DomainException>(() => profile.RejectReverification(invalidReason!));
        Assert.Contains("reason is required", ex.Message);
    }

    [Fact]
    public void UpdateProfile_WhenReverificationRejected_ChangingName_ResetsToPendingReverification()
    {
        var profile = new SellerProfile(Guid.NewGuid(), "Store Name", "0912345678");
        profile.UpdateProfile("Rejected Store", null, "0912345678", null);
        profile.RejectReverification("Disallowed name.");
        Assert.Equal(SellerVerificationStatus.ReverificationRejected, profile.VerificationStatus);

        var changed = profile.UpdateProfile("Legitimate Artisan Store", null, "0912345678", null);
        Assert.True(changed);
        Assert.Equal(SellerVerificationStatus.PendingReverification, profile.VerificationStatus);
    }
}
