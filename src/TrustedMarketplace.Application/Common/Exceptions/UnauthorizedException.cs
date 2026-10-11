namespace TrustedMarketplace.Application.Common.Exceptions;

public class UnauthorizedException : Exception
{
    public string Code { get; }

    public UnauthorizedException(string message = "Invalid email or password.", string code = "UNAUTHORIZED")
        : base(message)
    {
        Code = code;
    }
}
