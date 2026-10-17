using TrustedMarketplace.Domain.Common.Exceptions;
using TrustedMarketplace.Domain.Credentials;
using Xunit;

namespace TrustedMarketplace.UnitTests.Credentials;

public class SellerCredentialDomainTests
{
    [Fact]
    public void Issue_ValidParameters_CreatesActiveCredential()
    {
        var sellerUserId = Guid.NewGuid();
        var applicationId = Guid.NewGuid();
        var adminUserId = Guid.NewGuid();
        var publicId = "MG-ID-TEST-1234-5678";

        var credential = SellerCredential.Issue(
            sellerUserId,
            applicationId,
            adminUserId,
            publicId,
            CredentialType.IdentityVerified);

        Assert.NotNull(credential);
        Assert.Equal(sellerUserId, credential.SellerUserId);
        Assert.Equal(applicationId, credential.SellerApplicationId);
        Assert.Equal(adminUserId, credential.IssuedByAdminUserId);
        Assert.Equal(publicId, credential.PublicCredentialId);
        Assert.Equal(CredentialStatus.Active, credential.Status);
        Assert.Equal(CredentialType.IdentityVerified, credential.CredentialType);
        Assert.Null(credential.RevokedAtUtc);
        Assert.Null(credential.RevokedByAdminUserId);
        Assert.Null(credential.RevocationReason);
    }

    [Fact]
    public void Issue_EmptySellerUserId_ThrowsArgumentException()
    {
        Assert.Throws<ArgumentException>(() =>
            SellerCredential.Issue(Guid.Empty, Guid.NewGuid(), Guid.NewGuid(), "MG-ID-123"));
    }

    [Fact]
    public void Issue_EmptyApplicationId_ThrowsArgumentException()
    {
        Assert.Throws<ArgumentException>(() =>
            SellerCredential.Issue(Guid.NewGuid(), Guid.Empty, Guid.NewGuid(), "MG-ID-123"));
    }

    [Fact]
    public void Issue_EmptyAdminUserId_ThrowsArgumentException()
    {
        Assert.Throws<ArgumentException>(() =>
            SellerCredential.Issue(Guid.NewGuid(), Guid.NewGuid(), Guid.Empty, "MG-ID-123"));
    }

    [Fact]
    public void Issue_EmptyPublicCredentialId_ThrowsArgumentException()
    {
        Assert.Throws<ArgumentException>(() =>
            SellerCredential.Issue(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "   "));
    }

    [Fact]
    public void Revoke_ValidReason_TransitionsStatusToRevoked()
    {
        var credential = SellerCredential.Issue(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "MG-ID-TEST-REVOKE");

        var adminUserId = Guid.NewGuid();
        var reason = "Artisan business license expired and was not renewed.";

        credential.Revoke(adminUserId, reason);

        Assert.Equal(CredentialStatus.Revoked, credential.Status);
        Assert.NotNull(credential.RevokedAtUtc);
        Assert.Equal(adminUserId, credential.RevokedByAdminUserId);
        Assert.Equal(reason, credential.RevocationReason);
    }

    [Fact]
    public void Revoke_EmptyReason_ThrowsDomainException()
    {
        var credential = SellerCredential.Issue(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "MG-ID-TEST-REVOKE-FAIL");

        Assert.Throws<DomainException>(() => credential.Revoke(Guid.NewGuid(), "   "));
    }

    [Fact]
    public void Revoke_AlreadyRevoked_ThrowsDomainException()
    {
        var credential = SellerCredential.Issue(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "MG-ID-TEST-REVOKE-TWICE");

        var adminId = Guid.NewGuid();
        credential.Revoke(adminId, "First revocation");

        var ex = Assert.Throws<DomainException>(() => credential.Revoke(adminId, "Second attempt"));
        Assert.Contains("already been revoked", ex.Message);
    }
}
