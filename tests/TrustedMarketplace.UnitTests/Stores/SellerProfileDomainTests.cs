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

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void UpdateProfile_EmptyStoreName_ThrowsDomainException(string invalidName)
    {
        var profile = new SellerProfile(Guid.NewGuid(), "Store Name", "0912345678");

        Assert.Throws<DomainException>(() =>
            profile.UpdateProfile(invalidName, "Bio", "0912345678", "City"));
    }
}
