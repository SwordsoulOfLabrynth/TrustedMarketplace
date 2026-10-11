namespace TrustedMarketplace.Domain.Common.Exceptions;

/// <summary>
/// Exception thrown when a core domain business rule or invariant is violated.
/// </summary>
public class DomainException : Exception
{
    public DomainException(string message) : base(message)
    {
    }

    public DomainException(string message, Exception innerException) : base(message, innerException)
    {
    }
}
