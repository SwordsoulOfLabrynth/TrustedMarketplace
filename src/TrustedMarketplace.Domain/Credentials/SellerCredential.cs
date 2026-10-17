using TrustedMarketplace.Domain.Common;
using TrustedMarketplace.Domain.Common.Exceptions;

namespace TrustedMarketplace.Domain.Credentials;

public class SellerCredential : BaseEntity
{
    public Guid SellerUserId { get; private set; }
    public Guid SellerApplicationId { get; private set; }
    public string PublicCredentialId { get; private set; } = string.Empty;
    public CredentialType CredentialType { get; private set; } = CredentialType.IdentityVerified;
    public CredentialStatus Status { get; private set; } = CredentialStatus.Active;
    public DateTime IssuedAtUtc { get; private set; }
    public Guid IssuedByAdminUserId { get; private set; }
    public DateTime? RevokedAtUtc { get; private set; }
    public Guid? RevokedByAdminUserId { get; private set; }
    public string? RevocationReason { get; private set; }

    private SellerCredential() : base() { }

    public static SellerCredential Issue(
        Guid sellerUserId,
        Guid sellerApplicationId,
        Guid issuedByAdminUserId,
        string publicCredentialId,
        CredentialType credentialType = CredentialType.IdentityVerified)
    {
        if (sellerUserId == Guid.Empty)
            throw new ArgumentException("Seller user ID cannot be empty.", nameof(sellerUserId));

        if (sellerApplicationId == Guid.Empty)
            throw new ArgumentException("Seller application ID cannot be empty.", nameof(sellerApplicationId));

        if (issuedByAdminUserId == Guid.Empty)
            throw new ArgumentException("Issued by admin user ID cannot be empty.", nameof(issuedByAdminUserId));

        if (string.IsNullOrWhiteSpace(publicCredentialId))
            throw new ArgumentException("Public credential ID cannot be empty.", nameof(publicCredentialId));

        var now = DateTime.UtcNow;

        return new SellerCredential
        {
            SellerUserId = sellerUserId,
            SellerApplicationId = sellerApplicationId,
            IssuedByAdminUserId = issuedByAdminUserId,
            PublicCredentialId = publicCredentialId.Trim(),
            CredentialType = credentialType,
            Status = CredentialStatus.Active,
            IssuedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };
    }

    public void Revoke(Guid revokedByAdminUserId, string reason)
    {
        if (revokedByAdminUserId == Guid.Empty)
            throw new ArgumentException("Revoking admin user ID cannot be empty.", nameof(revokedByAdminUserId));

        if (string.IsNullOrWhiteSpace(reason))
            throw new DomainException("A specific reason is required to revoke an issued credential.");

        if (Status == CredentialStatus.Revoked)
            throw new DomainException("This credential has already been revoked.");

        Status = CredentialStatus.Revoked;
        RevokedAtUtc = DateTime.UtcNow;
        RevokedByAdminUserId = revokedByAdminUserId;
        RevocationReason = reason.Trim();
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
