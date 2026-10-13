using TrustedMarketplace.Domain.Common;
using TrustedMarketplace.Domain.Common.Exceptions;

namespace TrustedMarketplace.Domain.Verification;

public class SellerApplication : BaseEntity
{
    private readonly List<VerificationEvidence> _evidence = new();

    public Guid UserId { get; private set; }
    public string ProposedStoreName { get; private set; } = string.Empty;
    public string BusinessType { get; private set; } = string.Empty;
    public string ContactPhone { get; private set; } = string.Empty;
    public ApplicationStatus Status { get; private set; } = ApplicationStatus.Pending;
    public DateTime SubmittedAtUtc { get; private set; }
    public DateTime? ReviewedAtUtc { get; private set; }
    public Guid? ReviewedByUserId { get; private set; }
    public string? DecisionReason { get; private set; }

    public IReadOnlyCollection<VerificationEvidence> Evidence => _evidence.AsReadOnly();

    private SellerApplication() : base() { }

    public SellerApplication(
        Guid userId,
        string proposedStoreName,
        string businessType,
        string contactPhone) : base()
    {
        if (userId == Guid.Empty)
            throw new ArgumentException("User ID cannot be empty.", nameof(userId));

        if (string.IsNullOrWhiteSpace(proposedStoreName))
            throw new ArgumentException("Proposed store name cannot be empty.", nameof(proposedStoreName));

        if (proposedStoreName.Length > 100)
            throw new ArgumentException("Proposed store name cannot exceed 100 characters.", nameof(proposedStoreName));

        if (string.IsNullOrWhiteSpace(businessType))
            throw new ArgumentException("Business type cannot be empty.", nameof(businessType));

        if (string.IsNullOrWhiteSpace(contactPhone))
            throw new ArgumentException("Contact phone cannot be empty.", nameof(contactPhone));

        UserId = userId;
        ProposedStoreName = proposedStoreName.Trim();
        BusinessType = businessType.Trim();
        ContactPhone = contactPhone.Trim();
        Status = ApplicationStatus.Pending;
        SubmittedAtUtc = DateTime.UtcNow;
    }

    public VerificationEvidence AddEvidence(
        EvidenceType evidenceType,
        string privateStorageKey,
        string originalFileName,
        long fileSizeBytes,
        string mimeType,
        string sha256Checksum)
    {
        if (Status != ApplicationStatus.Pending && Status != ApplicationStatus.MoreInformationRequired)
        {
            throw new DomainException($"Cannot upload evidence to an application in '{Status}' status.");
        }

        var evidence = new VerificationEvidence(
            Id,
            evidenceType,
            privateStorageKey,
            originalFileName,
            fileSizeBytes,
            mimeType,
            sha256Checksum);

        _evidence.Add(evidence);
        return evidence;
    }

    public void Approve(Guid reviewerId, string reason)
    {
        if (reviewerId == Guid.Empty)
            throw new ArgumentException("Reviewer ID cannot be empty.", nameof(reviewerId));

        if (Status != ApplicationStatus.Pending && Status != ApplicationStatus.MoreInformationRequired)
            throw new DomainException($"Cannot approve application in '{Status}' status.");

        Status = ApplicationStatus.Approved;
        ReviewedAtUtc = DateTime.UtcNow;
        ReviewedByUserId = reviewerId;
        DecisionReason = reason;

        foreach (var ev in _evidence)
        {
            ev.MarkReviewed(EvidenceReviewStatus.Verified);
        }
    }

    public void Reject(Guid reviewerId, string reason)
    {
        if (reviewerId == Guid.Empty)
            throw new ArgumentException("Reviewer ID cannot be empty.", nameof(reviewerId));

        if (string.IsNullOrWhiteSpace(reason))
            throw new DomainException("A reason is required when rejecting an application.");

        if (Status != ApplicationStatus.Pending && Status != ApplicationStatus.MoreInformationRequired)
            throw new DomainException($"Cannot reject application in '{Status}' status.");

        Status = ApplicationStatus.Rejected;
        ReviewedAtUtc = DateTime.UtcNow;
        ReviewedByUserId = reviewerId;
        DecisionReason = reason;

        // Proposed retention policy: 30 days after rejection
        var retentionExpiry = DateTime.UtcNow.AddDays(30);
        foreach (var ev in _evidence)
        {
            ev.MarkReviewed(EvidenceReviewStatus.Rejected);
            ev.SetRetention(retentionExpiry);
        }
    }

    public void RequestMoreInformation(Guid reviewerId, string reason)
    {
        if (reviewerId == Guid.Empty)
            throw new ArgumentException("Reviewer ID cannot be empty.", nameof(reviewerId));

        if (string.IsNullOrWhiteSpace(reason))
            throw new DomainException("A reason is required when requesting more information.");

        Status = ApplicationStatus.MoreInformationRequired;
        ReviewedAtUtc = DateTime.UtcNow;
        ReviewedByUserId = reviewerId;
        DecisionReason = reason;
    }
}
