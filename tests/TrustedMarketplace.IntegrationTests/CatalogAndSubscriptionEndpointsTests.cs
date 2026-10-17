using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrustedMarketplace.Application.Catalog.Dtos;
using TrustedMarketplace.Application.Identity.Dtos;
using TrustedMarketplace.Application.Stores.Dtos;
using TrustedMarketplace.Application.Subscriptions.Dtos;
using TrustedMarketplace.Application.Verification.Dtos;
using TrustedMarketplace.Domain.Identity;
using TrustedMarketplace.Infrastructure.Identity;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.IntegrationTests;

public class CatalogAndSubscriptionEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public CatalogAndSubscriptionEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
    }

    private async Task<(string AccessToken, Guid UserId)> RegisterAndLoginUserAsync(string role = RoleConstants.Buyer)
    {
        var email = $"catalog_user_{Guid.NewGuid():N}@example.com";
        const string password = "SecurePassword123!";

        await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest("Catalog User", email, password));

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

    private async Task<(string SellerToken, Guid SellerUserId)> CreateApprovedSellerAsync()
    {
        var (sellerToken, sellerUserId) = await RegisterAndLoginUserAsync();
        var (adminToken, _) = await RegisterAndLoginUserAsync(RoleConstants.Admin);

        // Submit and approve
        using var appReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller-applications");
        appReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        appReq.Content = JsonContent.Create(new CreateSellerApplicationRequest($"Approved Store {Guid.NewGuid():N}"[..25], "Artisan", "0911223344"));
        var appResp = await _client.SendAsync(appReq);
        var createdApp = await appResp.Content.ReadFromJsonAsync<SellerApplicationDto>();
        Assert.NotNull(createdApp);

        using var decReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/admin/seller-applications/{createdApp.Id}/decision");
        decReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        decReq.Content = JsonContent.Create(new AdminDecisionRequest("Approved", "Verified business"));
        await _client.SendAsync(decReq);

        return (sellerToken, sellerUserId);
    }

    [Fact]
    public async Task GetSubscriptionPlans_ReturnsSeededTiers_Publicly()
    {
        var response = await _client.GetAsync("/api/v1/subscription-plans");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var plans = await response.Content.ReadFromJsonAsync<List<SubscriptionPlanDto>>();
        Assert.NotNull(plans);
        Assert.True(plans.Count >= 3);
        Assert.Contains(plans, p => p.Name == "Free" && p.MaxActiveListings == 10 && p.PriceAmount == 0m);
        Assert.Contains(plans, p => p.Name == "Standard" && p.MaxActiveListings == 30 && p.PriceAmount == 15000m);
        Assert.Contains(plans, p => p.Name == "Premium" && p.MaxActiveListings == 100 && p.PriceAmount == 30000m);
    }

    [Fact]
    public async Task GetCategories_ReturnsSeededCategories_Publicly()
    {
        var response = await _client.GetAsync("/api/v1/categories");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var categories = await response.Content.ReadFromJsonAsync<List<CategoryDto>>();
        Assert.NotNull(categories);
        Assert.True(categories.Count >= 4);
    }

    [Fact]
    public async Task CreateProduct_NonSeller_Returns403Forbidden()
    {
        var (token, _) = await RegisterAndLoginUserAsync();

        // Get category
        var catResp = await _client.GetAsync("/api/v1/categories");
        var categories = await catResp.Content.ReadFromJsonAsync<List<CategoryDto>>();
        var categoryId = categories![0].Id;

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller/products");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new CreateProductRequest(categoryId, "Illegal Product", "Desc", 1000m, "New"));

        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ProductLifecycle_CreateDraft_Edit_Publish_Search_Archive_SEC_04_SEC_05()
    {
        var (sellerToken, sellerUserId) = await CreateApprovedSellerAsync();
        var (otherSellerToken, _) = await CreateApprovedSellerAsync();

        var catResp = await _client.GetAsync("/api/v1/categories");
        var categories = await catResp.Content.ReadFromJsonAsync<List<CategoryDto>>();
        var categoryId = categories![0].Id;

        // 1. Create draft product
        using var createReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller/products");
        createReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        createReq.Content = JsonContent.Create(new CreateProductRequest(
            categoryId, "Handmade Marionette Puppet", "Traditional marionette puppet made from teakwood", 45000m, "New"));

        var createResp = await _client.SendAsync(createReq);
        Assert.Equal(HttpStatusCode.Created, createResp.StatusCode);
        var product = await createResp.Content.ReadFromJsonAsync<ProductDto>();
        Assert.NotNull(product);
        Assert.Equal("Draft", product.Status);

        // 2. Draft is hidden from public search
        var searchResp1 = await _client.GetAsync($"/api/v1/products?keyword=Marionette");
        var search1 = await searchResp1.Content.ReadFromJsonAsync<PagedResult<ProductDto>>();
        Assert.NotNull(search1);
        Assert.DoesNotContain(search1.Items, p => p.Id == product.Id);

        // 3. SEC-05: Other seller cannot edit or publish this product
        using var hackEditReq = new HttpRequestMessage(HttpMethod.Patch, $"/api/v1/seller/products/{product.Id}");
        hackEditReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", otherSellerToken);
        hackEditReq.Content = JsonContent.Create(new UpdateProductRequest(categoryId, "Hacked Title", "Hacked", 1m, "Used"));
        var hackEditResp = await _client.SendAsync(hackEditReq);
        Assert.Equal(HttpStatusCode.Forbidden, hackEditResp.StatusCode);

        using var hackPubReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{product.Id}/publish");
        hackPubReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", otherSellerToken);
        var hackPubResp = await _client.SendAsync(hackPubReq);
        Assert.Equal(HttpStatusCode.Forbidden, hackPubResp.StatusCode);

        // 4. Owner publishes product
        using var pubReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{product.Id}/publish");
        pubReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var pubResp = await _client.SendAsync(pubReq);
        Assert.Equal(HttpStatusCode.OK, pubResp.StatusCode);
        var publishedDto = await pubResp.Content.ReadFromJsonAsync<ProductDto>();
        Assert.NotNull(publishedDto);
        Assert.Equal("Published", publishedDto.Status);

        // 5. T-12: Public search now finds published product
        var searchResp2 = await _client.GetAsync($"/api/v1/products?keyword=Marionette");
        var search2 = await searchResp2.Content.ReadFromJsonAsync<PagedResult<ProductDto>>();
        Assert.NotNull(search2);
        Assert.Contains(search2.Items, p => p.Id == product.Id);

        // 6. Public product detail endpoint returns product
        var detailResp = await _client.GetAsync($"/api/v1/products/{product.Id}");
        Assert.Equal(HttpStatusCode.OK, detailResp.StatusCode);

        // 7. Owner archives product -> hidden from public search
        using var archiveReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{product.Id}/archive");
        archiveReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var archiveResp = await _client.SendAsync(archiveReq);
        Assert.Equal(HttpStatusCode.OK, archiveResp.StatusCode);

        var searchResp3 = await _client.GetAsync($"/api/v1/products?keyword=Marionette");
        var search3 = await searchResp3.Content.ReadFromJsonAsync<PagedResult<ProductDto>>();
        Assert.NotNull(search3);
        Assert.DoesNotContain(search3.Items, p => p.Id == product.Id);
    }

    [Fact]
    public async Task PublishProduct_WhenStoreInPendingReverification_Returns403_SEC_04()
    {
        var (sellerToken, _) = await CreateApprovedSellerAsync();

        var catResp = await _client.GetAsync("/api/v1/categories");
        var categories = await catResp.Content.ReadFromJsonAsync<List<CategoryDto>>();
        var categoryId = categories![0].Id;

        // Create draft product
        using var createReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller/products");
        createReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        createReq.Content = JsonContent.Create(new CreateProductRequest(categoryId, "Silk Scarf", "Silk", 20000m, "New"));
        var createResp = await _client.SendAsync(createReq);
        var product = await createResp.Content.ReadFromJsonAsync<ProductDto>();
        Assert.NotNull(product);

        // Seller changes store name -> shifts store to PendingReverification
        using var storeReq = new HttpRequestMessage(HttpMethod.Put, "/api/v1/seller/store");
        storeReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        storeReq.Content = JsonContent.Create(new UpdateStoreProfileRequest($"Brand New Name {Guid.NewGuid():N}"[..25], "Bio", "0911223344", "Yangon"));
        await _client.SendAsync(storeReq);

        // Seller attempts to publish product -> rejected under SEC-04
        using var pubReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{product.Id}/publish");
        pubReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var pubResp = await _client.SendAsync(pubReq);

        Assert.Equal(HttpStatusCode.Forbidden, pubResp.StatusCode);
    }

    [Fact]
    public async Task AdminCanAssignSubscription_AndListingCapacityIsUpdated_T_17()
    {
        var (sellerToken, sellerUserId) = await CreateApprovedSellerAsync();
        var (adminToken, _) = await RegisterAndLoginUserAsync(RoleConstants.Admin);

        // Fetch plans
        var plansResp = await _client.GetAsync("/api/v1/subscription-plans");
        var plans = await plansResp.Content.ReadFromJsonAsync<List<SubscriptionPlanDto>>();
        var standardPlan = plans!.First(p => p.Name == "Standard");

        // Admin assigns Standard plan
        using var assignReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/admin/sellers/{sellerUserId}/subscription");
        assignReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        assignReq.Content = JsonContent.Create(new AssignSubscriptionRequest(standardPlan.Id, 3));
        var assignResp = await _client.SendAsync(assignReq);
        Assert.Equal(HttpStatusCode.OK, assignResp.StatusCode);

        // Seller checks quota
        using var quotaReq = new HttpRequestMessage(HttpMethod.Get, "/api/v1/seller/subscription");
        quotaReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var quotaResp = await _client.SendAsync(quotaReq);
        Assert.Equal(HttpStatusCode.OK, quotaResp.StatusCode);

        var quota = await quotaResp.Content.ReadFromJsonAsync<SellerQuotaDto>();
        Assert.NotNull(quota);
        Assert.Equal("Standard", quota.PlanName);
        Assert.Equal(30, quota.MaxActiveListings);
    }

    [Fact]
    public async Task AdminCatalogSearchStatus_AccessControl_AndSuccess()
    {
        // 1. Anonymous -> 401
        var anonResp = await _client.GetAsync("/api/v1/admin/catalog/search-status");
        Assert.Equal(HttpStatusCode.Unauthorized, anonResp.StatusCode);

        // 2. Buyer -> 403
        var (buyerToken, _) = await RegisterAndLoginUserAsync(RoleConstants.Buyer);
        using var buyerReq = new HttpRequestMessage(HttpMethod.Get, "/api/v1/admin/catalog/search-status");
        buyerReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        var buyerResp = await _client.SendAsync(buyerReq);
        Assert.Equal(HttpStatusCode.Forbidden, buyerResp.StatusCode);

        // 3. Admin -> 200 OK
        var (adminToken, _) = await RegisterAndLoginUserAsync(RoleConstants.Admin);
        using var adminReq = new HttpRequestMessage(HttpMethod.Get, "/api/v1/admin/catalog/search-status");
        adminReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        var adminResp = await _client.SendAsync(adminReq);
        Assert.Equal(HttpStatusCode.OK, adminResp.StatusCode);
    }

    [Fact]
    public async Task AdminCanTriggerReindexProductEmbeddings_Successfully()
    {
        var (adminToken, _) = await RegisterAndLoginUserAsync(RoleConstants.Admin);
        using var reindexReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/admin/catalog/reindex-embeddings?force=false");
        reindexReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        var reindexResp = await _client.SendAsync(reindexReq);
        Assert.Equal(HttpStatusCode.OK, reindexResp.StatusCode);
    }
}
