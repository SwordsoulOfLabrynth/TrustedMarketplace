using TrustedMarketplace.Domain.Common;

namespace TrustedMarketplace.Domain.Verification;

public class VerificationEvidence : BaseEntity
{
    public Guid SellerApplicationId { get; private set; }
    public EvidenceType EvidenceType { get; private set; }
    public string PrivateStorageKey { get; private set; } = string.Empty;
    public string OriginalFileName { get; private set; } = string.Empty;
    public long FileSizeBytes { get; private set; }
    public string MimeType { get; private set; } = string.Empty;
    public string Sha256Checksum { get; private set; } = string.Empty;
    public DateTime UploadedAtUtc { get; private set; }
    public EvidenceReviewStatus ReviewStatus { get; private set; } = EvidenceReviewStatus.Pending;
    public DateTime? RetentionUntilUtc { get; private set; }

    // Navigation property
    public SellerApplication? SellerApplication { get; private set; }

    private VerificationEvidence() : base() { }

    public VerificationEvidence(
        Guid sellerApplicationId,
        EvidenceType evidenceType,
        string privateStorageKey,
        string originalFileName,
        long fileSizeBytes,
        string mimeType,
        string sha256Checksum) : base()
    {
        if (sellerApplicationId == Guid.Empty)
            throw new ArgumentException("Seller application ID cannot be empty.", nameof(sellerApplicationId));

        if (string.IsNullOrWhiteSpace(privateStorageKey))
            throw new ArgumentException("Private storage key cannot be empty.", nameof(privateStorageKey));

        if (string.IsNullOrWhiteSpace(originalFileName))
            throw new ArgumentException("Original file name cannot be empty.", nameof(originalFileName));

        if (fileSizeBytes <= 0)
            throw new ArgumentException("File size must be greater than zero.", nameof(fileSizeBytes));

        if (string.IsNullOrWhiteSpace(mimeType))
            throw new ArgumentException("MIME type cannot be empty.", nameof(mimeType));

        if (string.IsNullOrWhiteSpace(sha256Checksum))
            throw new ArgumentException("SHA-256 checksum cannot be empty.", nameof(sha256Checksum));

        SellerApplicationId = sellerApplicationId;
        EvidenceType = evidenceType;
        PrivateStorageKey = privateStorageKey;
        OriginalFileName = originalFileName;
        FileSizeBytes = fileSizeBytes;
        MimeType = mimeType;
        Sha256Checksum = sha256Checksum;
        UploadedAtUtc = DateTime.UtcNow;
        ReviewStatus = EvidenceReviewStatus.Pending;
    }

    public void MarkReviewed(EvidenceReviewStatus status)
    {
        ReviewStatus = status;
    }

    public void SetRetention(DateTime retentionUntilUtc)
    {
        RetentionUntilUtc = retentionUntilUtc;
    }
}
