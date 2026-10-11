using Microsoft.AspNetCore.Mvc;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new
        {
            status = "Healthy",
            timestampUtc = DateTime.UtcNow,
            version = "0.1.0"
        });
    }
}
