using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Domain.Common.Exceptions;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
[Route("api/v1/test-errors")]
[ApiExplorerSettings(IgnoreApi = true)]
public class TestErrorsController : ControllerBase, IActionFilter
{
    private readonly IWebHostEnvironment _environment;

    public TestErrorsController(IWebHostEnvironment environment)
    {
        _environment = environment;
    }

    [NonAction]
    public void OnActionExecuting(ActionExecutingContext context)
    {
        // Enforce that test endpoints can never be executed in Staging or Production
        if (!_environment.IsDevelopment())
        {
            context.Result = new NotFoundResult();
        }
    }

    [NonAction]
    public void OnActionExecuted(ActionExecutedContext context)
    {
    }

    [HttpGet("validation")]
    public IActionResult ThrowValidation()
    {
        var errors = new Dictionary<string, string[]>
        {
            { "Email", new[] { "Email address is invalid." } },
            { "Password", new[] { "Password must be at least 8 characters long." } }
        };
        throw new ValidationException(errors);
    }

    [HttpGet("domain-violation")]
    public IActionResult ThrowDomainRule()
    {
        throw new DomainException("Cannot publish a product with a negative price amount.");
    }

    [HttpGet("not-found")]
    public IActionResult ThrowNotFound()
    {
        throw new NotFoundException("Product", "prod-123");
    }

    [HttpGet("conflict")]
    public IActionResult ThrowConflict()
    {
        throw new ConflictException("An active seller application already exists for this user.");
    }

    [HttpGet("forbidden")]
    public IActionResult ThrowForbidden()
    {
        throw new ForbiddenException("Account is suspended. Action is prohibited.");
    }

    [HttpGet("server-error")]
    public IActionResult ThrowServerError()
    {
        throw new InvalidOperationException("Fatal database connection string leak attempt: secret_db_pw");
    }
}
