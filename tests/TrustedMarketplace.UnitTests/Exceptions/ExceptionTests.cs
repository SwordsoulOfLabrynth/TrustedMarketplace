using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Domain.Common.Exceptions;

namespace TrustedMarketplace.UnitTests.Exceptions;

public class ExceptionTests
{
    [Fact]
    public void ValidationException_ShouldStoreErrorsDictionary()
    {
        // Arrange
        var errors = new Dictionary<string, string[]>
        {
            { "Email", new[] { "Invalid email." } },
            { "DisplayName", new[] { "Required field." } }
        };

        // Act
        var exception = new ValidationException(errors);

        // Assert
        Assert.Equal("One or more validation errors occurred.", exception.Message);
        Assert.Equal(2, exception.Errors.Count);
        Assert.Contains("Email", exception.Errors.Keys);
        Assert.Contains("DisplayName", exception.Errors.Keys);
    }

    [Fact]
    public void NotFoundException_ShouldFormatResourceAndKey()
    {
        // Act
        var exception = new NotFoundException("Order", "ord-999");

        // Assert
        Assert.Equal("Resource 'Order' with key 'ord-999' was not found.", exception.Message);
    }

    [Fact]
    public void ConflictException_ShouldStoreMessage()
    {
        // Act
        var exception = new ConflictException("User already exists.");

        // Assert
        Assert.Equal("User already exists.", exception.Message);
    }

    [Fact]
    public void ForbiddenException_ShouldStoreMessage()
    {
        // Act
        var exception = new ForbiddenException("Suspended account.");

        // Assert
        Assert.Equal("Suspended account.", exception.Message);
    }

    [Fact]
    public void DomainException_ShouldStoreMessageAndInnerException()
    {
        // Arrange
        var inner = new InvalidOperationException("Inner failure");

        // Act
        var exception = new DomainException("Domain violation", inner);

        // Assert
        Assert.Equal("Domain violation", exception.Message);
        Assert.Same(inner, exception.InnerException);
    }
}
