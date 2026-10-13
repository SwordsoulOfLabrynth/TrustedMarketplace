using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Stores;
using TrustedMarketplace.Application.Stores.Dtos;

namespace TrustedMarketplace.Api.Controllers;

[ApiController]
[Route("api/v1/sellers")]
public class SellersController : ControllerBase
{
    private readonly ISellerStoreService _storeService;

    public SellersController(ISellerStoreService storeService)
    {
        _storeService = storeService;
    }

    /// <summary>
    /// Retrieves a public store profile by seller user ID.
    /// Accessible anonymously.
    /// </summary>
    [HttpGet("{sellerId:guid}/store")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(StoreProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetStore(Guid sellerId, CancellationToken ct)
    {
        var store = await _storeService.GetStoreBySellerIdAsync(sellerId, ct);
        if (store == null)
        {
            throw new NotFoundException($"Store profile for seller '{sellerId}' was not found.");
        }
        return Ok(store);
    }
}
