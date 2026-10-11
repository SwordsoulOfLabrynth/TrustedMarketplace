namespace TrustedMarketplace.Application.Common.Exceptions;

/// <summary>
/// Exception thrown when a requested resource does not exist. Maps to HTTP 404 Not Found.
/// </summary>
public class NotFoundException : Exception
{
    public NotFoundException(string message) : base(message)
    {
    }

    public NotFoundException(string resourceName, object key)
        : base($"Resource '{resourceName}' with key '{key}' was not found.")
    {
    }
}
