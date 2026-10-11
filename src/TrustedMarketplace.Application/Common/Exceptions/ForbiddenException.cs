namespace TrustedMarketplace.Application.Common.Exceptions;

/// <summary>
/// Exception thrown when an authenticated caller is forbidden from accessing or mutating a resource. Maps to HTTP 403 Forbidden.
/// </summary>
public class ForbiddenException : Exception
{
    public string Code { get; }

    public ForbiddenException(string message, string code = "FORBIDDEN") : base(message)
    {
        Code = code;
    }
}
