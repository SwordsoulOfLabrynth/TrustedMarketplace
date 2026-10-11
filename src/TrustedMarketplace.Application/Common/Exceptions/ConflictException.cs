namespace TrustedMarketplace.Application.Common.Exceptions;

/// <summary>
/// Exception thrown when an operation conflicts with the current resource state or creates a duplicate. Maps to HTTP 409 Conflict.
/// </summary>
public class ConflictException : Exception
{
    public ConflictException(string message) : base(message)
    {
    }
}
