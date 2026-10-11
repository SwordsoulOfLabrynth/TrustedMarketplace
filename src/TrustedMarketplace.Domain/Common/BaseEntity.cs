namespace TrustedMarketplace.Domain.Common;

/// <summary>
/// Base entity representing a domain object with a unique GUID identifier and UTC audit timestamps.
/// </summary>
public abstract class BaseEntity : IAuditableEntity
{
    public Guid Id { get; protected set; } = Guid.NewGuid();
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    public void UpdateTimestamp(DateTime utcNow)
    {
        UpdatedAtUtc = utcNow;
    }
}
