using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrustedMarketplace.Application.Catalog.Dtos;
using TrustedMarketplace.Application.Complaints.Dtos;
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

public class OrdersAndTrustEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public OrdersAndTrustEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
    }

    private async Task<(string AccessToken, Guid UserId)> RegisterAndLoginUserAsync(string role = RoleConstants.Buyer)
    {
        var email = $"order_user_{Guid.NewGuid():N}@example.com";
        const string password = "SecurePassword123!";

        await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest("Order User", email, password));

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
        var auth = await loginResp.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        return (auth.AccessToken, auth.User.Id);
    }

    private async Task<(string SellerToken, Guid SellerUserId, Guid ProductId)> SetupApprovedSellerWithProductAsync()
    {
        var (sellerToken, sellerUserId) = await RegisterAndLoginUserAsync();
        var (adminToken, _) = await RegisterAndLoginUserAsync(RoleConstants.Admin);

        // Submit seller application
        using var appReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller-applications");
        appReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var uniqueStoreName = $"Store_{Guid.NewGuid():N}"[..25];
        appReq.Content = JsonContent.Create(new CreateSellerApplicationRequest(uniqueStoreName, "Retail", "0912345678"));
        var appResp = await _client.SendAsync(appReq);
        var appDto = await appResp.Content.ReadFromJsonAsync<SellerApplicationDto>();
        Assert.NotNull(appDto);

        // Admin approves
        using var approveReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/admin/seller-applications/{appDto.Id}/decision");
        approveReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        approveReq.Content = JsonContent.Create(new AdminDecisionRequest("Approved", "KYC verified"));
        await _client.SendAsync(approveReq);

        // Assign subscription
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var premiumPlan = await db.SubscriptionPlans.FirstAsync(p => p.Name == "Premium");
        var category = await db.Categories.FirstAsync();

        using var subReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/admin/sellers/{sellerUserId}/subscription");
        subReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        subReq.Content = JsonContent.Create(new AssignSubscriptionRequest(premiumPlan.Id, 6));
        await _client.SendAsync(subReq);

        // Create and publish product
        using var prodReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller/products");
        prodReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        prodReq.Content = JsonContent.Create(new CreateProductRequest(
            category.Id,
            "Traditional Bagan Lacquerware Box",
            "Authentic handcrafted lacquerware from Bagan.",
            35000m,
            "New"));
        var prodResp = await _client.SendAsync(prodReq);
        var prodDto = await prodResp.Content.ReadFromJsonAsync<ProductDto>();
        Assert.NotNull(prodDto);

        using var pubReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{prodDto.Id}/publish");
        pubReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        await _client.SendAsync(pubReq);

        return (sellerToken, sellerUserId, prodDto.Id);
    }

    [Fact]
    public async Task OrderLifecycle_And_BuyerDeliveryConfirmation_SEC_07_SEC_08()
    {
        var (sellerToken, sellerUserId, productId) = await SetupApprovedSellerWithProductAsync();
        var (buyerToken, buyerUserId) = await RegisterAndLoginUserAsync();
        var (otherToken, _) = await RegisterAndLoginUserAsync();

        // 1. Buyer places order
        using var placeReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/orders");
        placeReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        placeReq.Content = JsonContent.Create(new CreateOrderRequest(
            productId,
            2,
            "09777123456",
            "73rd Street, Chanayethazan",
            "Mandalay",
            "Call on delivery"));
        var placeResp = await _client.SendAsync(placeReq);
        Assert.Equal(HttpStatusCode.Created, placeResp.StatusCode);
        var order = await placeResp.Content.ReadFromJsonAsync<OrderDto>();
        Assert.NotNull(order);
        Assert.Equal("Placed", order.Status);
        Assert.Equal(70000m, order.SubtotalAmount);

        // 2. IDOR Protection (SEC-06): Third-party cannot view order
        using var idorReq = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/orders/{order.Id}");
        idorReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", otherToken);
        var idorResp = await _client.SendAsync(idorReq);
        Assert.Equal(HttpStatusCode.Forbidden, idorResp.StatusCode);

        // 3. Seller accepts order
        using var acceptReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/accept");
        acceptReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var acceptResp = await _client.SendAsync(acceptReq);
        Assert.Equal(HttpStatusCode.OK, acceptResp.StatusCode);
        var acceptedOrder = await acceptResp.Content.ReadFromJsonAsync<OrderDto>();
        Assert.Equal("Accepted", acceptedOrder!.Status);

        // 4. Seller ships order
        using var shipReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/ship");
        shipReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        shipReq.Content = JsonContent.Create(new ShipOrderRequest("ROYAL-WAYBILL-998877"));
        var shipResp = await _client.SendAsync(shipReq);
        Assert.Equal(HttpStatusCode.OK, shipResp.StatusCode);
        var shippedOrder = await shipResp.Content.ReadFromJsonAsync<OrderDto>();
        Assert.Equal("Shipped", shippedOrder!.Status);
        Assert.Equal("ROYAL-WAYBILL-998877", shippedOrder.CourierTrackingReference);

        // 5. SEC-07: Seller cannot confirm delivery
        using var sellerConfirmReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/confirm-delivery");
        sellerConfirmReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var sellerConfirmResp = await _client.SendAsync(sellerConfirmReq);
        Assert.Equal(HttpStatusCode.Forbidden, sellerConfirmResp.StatusCode);

        // 6. SEC-08: Buyer confirms delivery -> transitions to Completed
        using var buyerConfirmReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/confirm-delivery");
        buyerConfirmReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        var buyerConfirmResp = await _client.SendAsync(buyerConfirmReq);
        Assert.Equal(HttpStatusCode.OK, buyerConfirmResp.StatusCode);
        var completedOrder = await buyerConfirmResp.Content.ReadFromJsonAsync<OrderDto>();
        Assert.Equal("Completed", completedOrder!.Status);
        Assert.NotNull(completedOrder.CompletedAtUtc);
    }

    [Fact]
    public async Task Reviews_EnforceTransactionLink_And_SingleReview_SEC_09_SEC_10_SEC_11()
    {
        var (sellerToken, sellerUserId, productId) = await SetupApprovedSellerWithProductAsync();
        var (buyerToken, buyerUserId) = await RegisterAndLoginUserAsync();
        var (unrelatedBuyerToken, _) = await RegisterAndLoginUserAsync();

        // Buyer places order
        using var placeReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/orders");
        placeReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        placeReq.Content = JsonContent.Create(new CreateOrderRequest(productId, 1, "0911122233", "Address", "Yangon"));
        var placeResp = await _client.SendAsync(placeReq);
        var order = await placeResp.Content.ReadFromJsonAsync<OrderDto>();
        Assert.NotNull(order);

        // SEC-11: Cannot review an uncompleted order
        using var prematureReviewReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/reviews");
        prematureReviewReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        prematureReviewReq.Content = JsonContent.Create(new CreateReviewRequest(5, "Should fail before complete"));
        var prematureReviewResp = await _client.SendAsync(prematureReviewReq);
        Assert.Equal(HttpStatusCode.Conflict, prematureReviewResp.StatusCode);

        // Progress order to Completed
        using var acceptReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/accept");
        acceptReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        await _client.SendAsync(acceptReq);

        using var shipReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/ship");
        shipReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        shipReq.Content = JsonContent.Create(new ShipOrderRequest("WB-123"));
        await _client.SendAsync(shipReq);

        using var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/confirm-delivery");
        confirmReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        await _client.SendAsync(confirmReq);

        // SEC-09: Unrelated user cannot review the order
        using var unauthorizedReviewReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/reviews");
        unauthorizedReviewReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", unrelatedBuyerToken);
        unauthorizedReviewReq.Content = JsonContent.Create(new CreateReviewRequest(5, "Unauthorized review"));
        var unauthorizedReviewResp = await _client.SendAsync(unauthorizedReviewReq);
        Assert.Equal(HttpStatusCode.Forbidden, unauthorizedReviewResp.StatusCode);

        // Legitimate buyer reviews order
        using var validReviewReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/reviews");
        validReviewReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        validReviewReq.Content = JsonContent.Create(new CreateReviewRequest(5, "Flawless packaging and excellent quality!"));
        var validReviewResp = await _client.SendAsync(validReviewReq);
        Assert.Equal(HttpStatusCode.Created, validReviewResp.StatusCode);

        // SEC-10: Submitting a second review for the same order is rejected
        using var duplicateReviewReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/reviews");
        duplicateReviewReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        duplicateReviewReq.Content = JsonContent.Create(new CreateReviewRequest(4, "Second review attempt"));
        var duplicateReviewResp = await _client.SendAsync(duplicateReviewReq);
        Assert.Equal(HttpStatusCode.Conflict, duplicateReviewResp.StatusCode);

        // Public review listing for the seller
        var publicReviewsResp = await _client.GetAsync($"/api/v1/sellers/{sellerUserId}/reviews");
        Assert.Equal(HttpStatusCode.OK, publicReviewsResp.StatusCode);
        var pagedReviews = await publicReviewsResp.Content.ReadFromJsonAsync<PagedResult<ReviewDto>>();
        Assert.NotNull(pagedReviews);
        Assert.Contains(pagedReviews.Items, r => r.OrderId == order.Id && r.Rating == 5);
    }

    [Fact]
    public async Task Complaints_And_AdminDisputeResolution_T_15()
    {
        var (sellerToken, sellerUserId, productId) = await SetupApprovedSellerWithProductAsync();
        var (buyerToken, buyerUserId) = await RegisterAndLoginUserAsync();
        var (adminToken, _) = await RegisterAndLoginUserAsync(RoleConstants.Admin);

        // Buyer places order
        using var placeReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/orders");
        placeReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        placeReq.Content = JsonContent.Create(new CreateOrderRequest(productId, 1, "0911122233", "Address", "Yangon"));
        var placeResp = await _client.SendAsync(placeReq);
        var order = await placeResp.Content.ReadFromJsonAsync<OrderDto>();
        Assert.NotNull(order);

        // Accept and ship
        using var acceptReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/accept");
        acceptReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        await _client.SendAsync(acceptReq);

        using var shipReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/ship");
        shipReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        shipReq.Content = JsonContent.Create(new ShipOrderRequest("WB-999"));
        await _client.SendAsync(shipReq);

        // Buyer files complaint (Order transitions to Disputed)
        using var compReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/complaints");
        compReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        compReq.Content = JsonContent.Create(new FileComplaintRequest("Package arrived damaged with broken seals"));
        var compResp = await _client.SendAsync(compReq);
        Assert.Equal(HttpStatusCode.Created, compResp.StatusCode);
        var complaint = await compResp.Content.ReadFromJsonAsync<ComplaintDto>();
        Assert.NotNull(complaint);
        Assert.Equal("Submitted", complaint.Status);

        // Order is now Disputed
        using var verifyOrderReq = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/orders/{order.Id}");
        verifyOrderReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        var verifyOrderResp = await _client.SendAsync(verifyOrderReq);
        var disputedOrder = await verifyOrderResp.Content.ReadFromJsonAsync<OrderDto>();
        Assert.Equal("Disputed", disputedOrder!.Status);

        // Admin resolves complaint decision
        using var decReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/admin/complaints/{complaint.Id}/decision");
        decReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        decReq.Content = JsonContent.Create(new AdminComplaintDecisionRequest("RefundAgreed", "Seller agreed to direct transfer refund"));
        var decResp = await _client.SendAsync(decReq);
        Assert.Equal(HttpStatusCode.OK, decResp.StatusCode);

        // Admin resolves order dispute -> Cancelled
        using var resolveReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/admin/orders/{order.Id}/resolve-dispute");
        resolveReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        resolveReq.Content = JsonContent.Create(new ResolveDisputeRequest("Cancelled", "Full refund agreed between buyer and seller"));
        var resolveResp = await _client.SendAsync(resolveReq);
        Assert.Equal(HttpStatusCode.OK, resolveResp.StatusCode);
        var resolvedOrder = await resolveResp.Content.ReadFromJsonAsync<OrderDto>();
        Assert.Equal("Cancelled", resolvedOrder!.Status);
    }

    [Fact]
    public async Task TrustProfile_ReturnsExplainableMetrics_T_16()
    {
        var (sellerToken, sellerUserId, productId) = await SetupApprovedSellerWithProductAsync();
        var (buyerToken, _) = await RegisterAndLoginUserAsync();

        // Complete 1 order and review it with rating 5
        using var placeReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/orders");
        placeReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        placeReq.Content = JsonContent.Create(new CreateOrderRequest(productId, 1, "0912345678", "Address", "Mandalay"));
        var placeResp = await _client.SendAsync(placeReq);
        var order = await placeResp.Content.ReadFromJsonAsync<OrderDto>();
        Assert.NotNull(order);

        using var acceptReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/accept");
        acceptReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        await _client.SendAsync(acceptReq);

        using var shipReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/ship");
        shipReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        shipReq.Content = JsonContent.Create(new ShipOrderRequest("WAYBILL-TRUST-1"));
        await _client.SendAsync(shipReq);

        using var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/confirm-delivery");
        confirmReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        await _client.SendAsync(confirmReq);

        using var revReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/orders/{order.Id}/reviews");
        revReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        revReq.Content = JsonContent.Create(new CreateReviewRequest(5, "Outstanding product and packaging!"));
        await _client.SendAsync(revReq);

        // Fetch trust profile
        var trustResp = await _client.GetAsync($"/api/v1/sellers/{sellerUserId}/trust-profile");
        Assert.Equal(HttpStatusCode.OK, trustResp.StatusCode);
        var trustProfile = await trustResp.Content.ReadFromJsonAsync<SellerTrustProfileDto>();
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
}
