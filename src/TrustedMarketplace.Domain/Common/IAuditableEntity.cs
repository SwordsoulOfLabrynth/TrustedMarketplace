namespace TrustedMarketplace.Domain.Common;

/// <summary>
/// Defines audit timestamps for entities that track creation and modification times in UTC.
/// </summary>
public interface IAuditableEntity
{
    DateTime CreatedAtUtc { get; set; }
    DateTime UpdatedAtUtc { get; set; }
}
