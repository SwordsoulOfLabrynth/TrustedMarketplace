namespace TrustedMarketplace.Domain.Auditing;

/// <summary>
/// Immutable audit log recording system and user administrative actions.
/// </summary>
public class AuditEvent
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid? ActorUserId { get; private set; }
    public string Action { get; private set; } = string.Empty;
    public string TargetType { get; private set; } = string.Empty;
    public string TargetId { get; private set; } = string.Empty;
    public string? Reason { get; private set; }
    public string? MetadataJson { get; private set; }
    public string CorrelationId { get; private set; } = string.Empty;
    public DateTime CreatedAtUtc { get; private set; } = DateTime.UtcNow;

    private AuditEvent() { }

    public static AuditEvent Create(
        string action,
        string targetType,
        string targetId,
        string correlationId,
        Guid? actorUserId = null,
        string? reason = null,
        string? metadataJson = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(action);
        ArgumentException.ThrowIfNullOrWhiteSpace(targetType);
        ArgumentException.ThrowIfNullOrWhiteSpace(targetId);

        return new AuditEvent
        {
            Id = Guid.NewGuid(),
            Action = action,
            TargetType = targetType,
            TargetId = targetId,
            CorrelationId = correlationId,
            ActorUserId = actorUserId,
            Reason = reason,
            MetadataJson = metadataJson,
            CreatedAtUtc = DateTime.UtcNow
        };
    }
}
