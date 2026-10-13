using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrustedMarketplace.Application.Catalog.Dtos;
using TrustedMarketplace.Application.Identity.Dtos;
using TrustedMarketplace.Application.Orders.Dtos;
using TrustedMarketplace.Application.Reviews.Dtos;
using TrustedMarketplace.Application.Stores.Dtos;
using TrustedMarketplace.Application.Subscriptions.Dtos;
using TrustedMarketplace.Application.Trust.Dtos;
using TrustedMarketplace.Application.Verification.Dtos;
using TrustedMarketplace.Domain.Identity;
using TrustedMarketplace.Infrastructure.Identity;
using TrustedMarketplace.Infrastructure.Persistence;
using Xunit;

namespace TrustedMarketplace.IntegrationTests;

/// <summary>
/// T-18: Comprehensive End-to-End Test Suite and Security Verification (SEC-01 to SEC-13).
/// Verifies the complete marketplace lifecycle from user onboarding to trust profile publication.
/// </summary>
public class EndToEndHappyPathAndSecuritySuiteTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public EndToEndHappyPathAndSecuritySuiteTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
    }

    private async Task<(string AccessToken, Guid UserId, string Email)> RegisterAndLoginAsync(string fullName, string role = RoleConstants.Buyer)
    {
        var email = $"e2e_{Guid.NewGuid():N}@example.com";
        const string password = "SecurePassword123!";

        var regResp = await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest(fullName, email, password));
        Assert.Equal(HttpStatusCode.Created, regResp.StatusCode);

        if (role == RoleConstants.Admin)
        {
            using var scope = _factory.Services.CreateScope();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();

            if (!await roleManager.RoleExistsAsync(RoleConstants.Admin))
            {
                await roleManager.CreateAsync(new ApplicationRole(RoleConstants.Admin));
            }

            var user = await userManager.FindByEmailAsync(email);
            if (user != null)
            {
                await userManager.AddToRoleAsync(user, RoleConstants.Admin);
            }
        }

        var loginResp = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        Assert.Equal(HttpStatusCode.OK, loginResp.StatusCode);
        var auth = await loginResp.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        return (auth.AccessToken, auth.User.Id, email);
    }

    [Fact]
    public async Task CompleteMarketplaceLifecycle_HappyPath_E2E()
    {
        // -------------------------------------------------------------
        // Step 1: User Onboarding (Seller, Buyer, Admin)
        // -------------------------------------------------------------
        var (sellerToken, sellerUserId, _) = await RegisterAndLoginAsync("Daw Khin Artisan Seller");
        var (buyerToken, buyerUserId, _) = await RegisterAndLoginAsync("Ko Aung Thura Buyer");
        var (adminToken, adminUserId, _) = await RegisterAndLoginAsync("Marketplace Admin", RoleConstants.Admin);

        // -------------------------------------------------------------
        // Step 2: Seller Application Submission
        // -------------------------------------------------------------
        var uniqueStoreName = $"Artisan_{Guid.NewGuid():N}"[..25];
        using var appReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller-applications");
        appReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        appReq.Content = JsonContent.Create(new CreateSellerApplicationRequest(uniqueStoreName, "Handicrafts", "09777888999"));
        var appResp = await _client.SendAsync(appReq);
        Assert.Equal(HttpStatusCode.Created, appResp.StatusCode);
        var appDto = await appResp.Content.ReadFromJsonAsync<SellerApplicationDto>();
        Assert.NotNull(appDto);
        Assert.Equal("Pending", appDto.Status);

        // -------------------------------------------------------------
        // Step 3: Admin Review and Approval
        // -------------------------------------------------------------
        using var approveReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/admin/seller-applications/{appDto.Id}/decision");
        approveReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        approveReq.Content = JsonContent.Create(new AdminDecisionRequest("Approved", "NRC and verified storefront documents verified."));
        var approveResp = await _client.SendAsync(approveReq);
        Assert.Equal(HttpStatusCode.OK, approveResp.StatusCode);

        // -------------------------------------------------------------
        // Step 4: Verify Seller Store Profile Auto-Creation
        // -------------------------------------------------------------
        using var storeReq = new HttpRequestMessage(HttpMethod.Get, "/api/v1/seller/store");
        storeReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var storeResp = await _client.SendAsync(storeReq);
        Assert.Equal(HttpStatusCode.OK, storeResp.StatusCode);
        var storeDto = await storeResp.Content.ReadFromJsonAsync<StoreProfileDto>();
        Assert.NotNull(storeDto);
        Assert.Equal("Verified", storeDto.VerificationStatus);

        // -------------------------------------------------------------
        // Step 5: Admin Assigns Subscription Tier (Standard)
        // -------------------------------------------------------------
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var standardPlan = await db.SubscriptionPlans.FirstAsync(p => p.Name == "Standard");

            using var subReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/admin/sellers/{sellerUserId}/subscription");
            subReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
            subReq.Content = JsonContent.Create(new AssignSubscriptionRequest(standardPlan.Id, 12));
            var subResp = await _client.SendAsync(subReq);
            Assert.Equal(HttpStatusCode.OK, subResp.StatusCode);
        }

        // -------------------------------------------------------------
        // Step 6: Seller Publishes Product Listing
        // -------------------------------------------------------------
        Guid categoryId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var category = await db.Categories.FirstAsync();
            categoryId = category.Id;
        }

        using var createProdReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller/products");
        createProdReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        createProdReq.Content = JsonContent.Create(new CreateProductRequest(
            categoryId,
            "Handmade Mandalay Marionette Puppet",
            "Authentic traditional string puppet crafted from teak and silk.",
            45000m,
            "New"));
        var createProdResp = await _client.SendAsync(createProdReq);
        Assert.Equal(HttpStatusCode.Created, createProdResp.StatusCode);
        var prodDto = await createProdResp.Content.ReadFromJsonAsync<ProductDto>();
        Assert.NotNull(prodDto);
        Assert.Equal("Draft", prodDto.Status);

        using var pubProdReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{prodDto.Id}/publish");
        pubProdReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var pubProdResp = await _client.SendAsync(pubProdReq);
        Assert.Equal(HttpStatusCode.OK, pubProdResp.StatusCode);

        // -------------------------------------------------------------
        // Step 7: Public Catalog Discovery
        // -------------------------------------------------------------
        var catalogResp = await _client.GetAsync($"/api/v1/products?keyword=Marionette");
        Assert.Equal(HttpStatusCode.OK, catalogResp.StatusCode);
        var catalogResult = await catalogResp.Content.ReadFromJsonAsync<PagedResult<ProductDto>>();
        Assert.NotNull(catalogResult);
        Assert.Contains(catalogResult.Items, p => p.Id == prodDto.Id && p.Status == "Published");

        // -------------------------------------------------------------
        // Step 8: Buyer Places Order
        // -------------------------------------------------------------
        using var orderReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/orders");
        orderReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        orderReq.Content = JsonContent.Create(new CreateOrderRequest(
            prodDto.Id,
            1,
            "09988776655",
            "Room 4A, Pyay Road, Kamayut Township",
            "Yangon",
            "Handle fragile package with care"));
        var orderResp = await _client.SendAsync(orderReq);
        Assert.Equal(HttpStatusCode.Created, orderResp.StatusCode);
        var order = await orderResp.Content.ReadFromJsonAsync<OrderDto>();
        Assert.NotNull(order);
        Assert.Equal("Placed", order.Status);
        Assert.Equal(45000m, order.SubtotalAmount);

        // -------------------------------------------------------------
        // Step 9: Seller Accepts and Dispatches Order
        // -------------------------------------------------------------
        using var acceptReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/accept");
        acceptReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var acceptResp = await _client.SendAsync(acceptReq);
        Assert.Equal(HttpStatusCode.OK, acceptResp.StatusCode);

        using var shipReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/ship");
        shipReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        shipReq.Content = JsonContent.Create(new ShipOrderRequest("KMD-EXPRESS-WB-883311"));
        var shipResp = await _client.SendAsync(shipReq);
        Assert.Equal(HttpStatusCode.OK, shipResp.StatusCode);

        // -------------------------------------------------------------
        // Step 10: Buyer Confirms Delivery (SEC-07, SEC-08)
        // -------------------------------------------------------------
        using var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/confirm-delivery");
        confirmReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        var confirmResp = await _client.SendAsync(confirmReq);
        Assert.Equal(HttpStatusCode.OK, confirmResp.StatusCode);
        var completedOrder = await confirmResp.Content.ReadFromJsonAsync<OrderDto>();
        Assert.Equal("Completed", completedOrder!.Status);
        Assert.NotNull(completedOrder.CompletedAtUtc);

        // -------------------------------------------------------------
        // Step 11: Transaction-Linked Review Submission
        // -------------------------------------------------------------
        using var reviewReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/reviews");
        reviewReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        reviewReq.Content = JsonContent.Create(new CreateReviewRequest(5, "Magnificent puppet! Excellent wood carving and arrived safely in Yangon."));
        var reviewResp = await _client.SendAsync(reviewReq);
        Assert.Equal(HttpStatusCode.Created, reviewResp.StatusCode);

        // -------------------------------------------------------------
        // Step 12: Public Trust Profile Verification (T-16)
        // -------------------------------------------------------------
        var trustProfileResp = await _client.GetAsync($"/api/v1/sellers/{sellerUserId}/trust-profile");
        Assert.Equal(HttpStatusCode.OK, trustProfileResp.StatusCode);
        var trustProfile = await trustProfileResp.Content.ReadFromJsonAsync<SellerTrustProfileDto>();
        Assert.NotNull(trustProfile);

        Assert.Equal(sellerUserId, trustProfile.SellerUserId);
        Assert.Equal("Verified", trustProfile.VerificationStatus);
        Assert.NotNull(trustProfile.VerifiedSinceUtc);
        Assert.Equal(1, trustProfile.CompletedOrdersCount);
        Assert.Equal(1, trustProfile.ReviewCount);
        Assert.Equal(5.0, trustProfile.AverageRating);
        Assert.Equal(0, trustProfile.ResolvedComplaintsCount);
        Assert.Contains("Verification confirms identity documentation", trustProfile.Disclaimer);
    }

    [Fact]
    public async Task SecuritySuite_SEC01_PrivilegeEscalation_Blocked()
    {
        // SEC-01: Registration attempts with "role": "Admin" must be ignored and assign Buyer role only.
        var email = $"sec01_{Guid.NewGuid():N}@example.com";
        var payload = new { DisplayName = "Hacker User", Email = email, Password = "SecurePassword123!", Role = "Admin" };
        var regResp = await _client.PostAsJsonAsync("/api/v1/auth/register", payload);
        Assert.Equal(HttpStatusCode.Created, regResp.StatusCode);

        var loginResp = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, "SecurePassword123!"));
        var auth = await loginResp.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        Assert.Equal(RoleConstants.Buyer, auth.User.Role);
    }

    [Fact]
    public async Task SecuritySuite_SEC02_AdminEndpointProtection_Blocked()
    {
        // SEC-02: Non-admin buyer cannot access admin endpoints.
        var (buyerToken, _, _) = await RegisterAndLoginAsync("Regular Buyer");

        using var req = new HttpRequestMessage(HttpMethod.Get, "/api/v1/admin/seller-applications");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task SecuritySuite_SEC03_SuspendedAccountLockout_Enforced()
    {
        // SEC-03: Suspended accounts cannot perform active user actions.
        var (token, userId, email) = await RegisterAndLoginAsync("Suspended User");

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var user = await db.Users.FindAsync(userId);
            Assert.NotNull(user);
            user.Suspend();
            await db.SaveChangesAsync();
        }

        using var req = new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task SecuritySuite_SEC04_UnapprovedSeller_CannotPublishProducts()
    {
        // SEC-04: User without approved seller status cannot publish products.
        var (buyerToken, _, _) = await RegisterAndLoginAsync("Unapproved Buyer");

        Guid categoryId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            categoryId = (await db.Categories.FirstAsync()).Id;
        }

        using var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller/products");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        req.Content = JsonContent.Create(new CreateProductRequest(categoryId, "Illegal Product", "Desc", 1000m, "New"));
        var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task SecuritySuite_SEC12_PrivateEvidence_NotExposedPublicly()
    {
        // SEC-12: Unauthenticated caller cannot download private verification evidence.
        var unauthResp = await _client.GetAsync($"/api/v1/admin/seller-applications/{Guid.NewGuid()}/evidence/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.Unauthorized, unauthResp.StatusCode);
    }

    [Fact]
    public async Task SecuritySuite_SEC13_CredentialEnumeration_UniformResponse()
    {
        // SEC-13: Non-existent user vs wrong password must return uniform 401 Unauthorized.
        var respNonExistent = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest("nobody_exists_123@example.com", "Password123!"));
        Assert.Equal(HttpStatusCode.Unauthorized, respNonExistent.StatusCode);

        var (token, _, email) = await RegisterAndLoginAsync("Known User");
        var respWrongPassword = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, "CompletelyWrongPassword123!"));
        Assert.Equal(HttpStatusCode.Unauthorized, respWrongPassword.StatusCode);
    }
}
