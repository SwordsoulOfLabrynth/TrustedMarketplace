using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrustedMarketplace.Application.Identity.Dtos;
using TrustedMarketplace.Application.Stores.Dtos;
using TrustedMarketplace.Application.Verification.Dtos;
using TrustedMarketplace.Domain.Identity;
using TrustedMarketplace.Infrastructure.Identity;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.IntegrationTests;

public class SellerStoreEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public SellerStoreEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
    }

    private async Task<(string AccessToken, Guid UserId)> RegisterAndLoginUserAsync()
    {
        var email = $"store_user_{Guid.NewGuid():N}@example.com";
        const string password = "SecurePassword123!";

        await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest("Store Owner", email, password));
        var loginResp = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        var auth = await loginResp.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        return (auth.AccessToken, auth.User.Id);
    }

    private async Task<string> CreateAdminAndGetTokenAsync()
    {
        var adminEmail = $"admin_store_{Guid.NewGuid():N}@example.com";
        const string password = "AdminPassword123!";

        using (var scope = _factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();

            if (!await roleManager.RoleExistsAsync(RoleConstants.Admin))
            {
                await roleManager.CreateAsync(new ApplicationRole(RoleConstants.Admin));
            }

            var adminUser = new ApplicationUser(adminEmail, "Store Admin") { EmailConfirmed = true };
            await userManager.CreateAsync(adminUser, password);
            await userManager.AddToRoleAsync(adminUser, RoleConstants.Admin);
        }

        var loginResp = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(adminEmail, password));
        var auth = await loginResp.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        return auth.AccessToken;
    }

    [Fact]
    public async Task AdminApproval_AutomaticallyProvisionsVerifiedStoreProfile()
    {
        var (sellerToken, sellerUserId) = await RegisterAndLoginUserAsync();
        var adminToken = await CreateAdminAndGetTokenAsync();

        // Submit application
        using var appReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller-applications");
        appReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        appReq.Content = JsonContent.Create(new CreateSellerApplicationRequest("Unique Silk Weaving", "Crafter", "0911223344"));
        var appResp = await _client.SendAsync(appReq);
        var createdApp = await appResp.Content.ReadFromJsonAsync<SellerApplicationDto>();
        Assert.NotNull(createdApp);

        // Admin approves
        using var decisionReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/admin/seller-applications/{createdApp.Id}/decision");
        decisionReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        decisionReq.Content = JsonContent.Create(new AdminDecisionRequest("Approved", "Verified business credentials"));
        var decisionResp = await _client.SendAsync(decisionReq);
        Assert.Equal(HttpStatusCode.OK, decisionResp.StatusCode);

        // Verify public store profile exists anonymously
        var storeResp = await _client.GetAsync($"/api/v1/sellers/{sellerUserId}/store");
        Assert.Equal(HttpStatusCode.OK, storeResp.StatusCode);
        var storeDto = await storeResp.Content.ReadFromJsonAsync<StoreProfileDto>();
        Assert.NotNull(storeDto);
        Assert.Equal("Unique Silk Weaving", storeDto.StoreName);
        Assert.Equal("unique-silk-weaving", storeDto.Slug);
        Assert.Equal("Verified", storeDto.VerificationStatus);
    }

    [Fact]
    public async Task GetPublicStore_NonExistentSeller_Returns404NotFound()
    {
        var randomId = Guid.NewGuid();
        var resp = await _client.GetAsync($"/api/v1/sellers/{randomId}/store");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task UpdateStoreProfile_ChangingStoreName_ShiftsToPendingReverification_SEC_04()
    {
        var (sellerToken, sellerUserId) = await RegisterAndLoginUserAsync();
        var adminToken = await CreateAdminAndGetTokenAsync();

        // Apply and approve
        using var appReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller-applications");
        appReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        appReq.Content = JsonContent.Create(new CreateSellerApplicationRequest("Bagan Lacquerware", "Artisan", "0977665544"));
        var appResp = await _client.SendAsync(appReq);
        var createdApp = await appResp.Content.ReadFromJsonAsync<SellerApplicationDto>();
        Assert.NotNull(createdApp);

        using var decReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/admin/seller-applications/{createdApp.Id}/decision");
        decReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        decReq.Content = JsonContent.Create(new AdminDecisionRequest("Approved", "Verified"));
        await _client.SendAsync(decReq);

        // 1. Seller updates bio & township without changing name -> remains Verified
        using var update1Req = new HttpRequestMessage(HttpMethod.Put, "/api/v1/seller/store");
        update1Req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        update1Req.Content = JsonContent.Create(new UpdateStoreProfileRequest("Bagan Lacquerware", "Authentic handcrafted lacquerware", "0977665544", "Bagan"));
        var update1Resp = await _client.SendAsync(update1Req);
        Assert.Equal(HttpStatusCode.OK, update1Resp.StatusCode);
        var updated1Dto = await update1Resp.Content.ReadFromJsonAsync<StoreProfileDto>();
        Assert.NotNull(updated1Dto);
        Assert.Equal("Verified", updated1Dto.VerificationStatus);

        // 2. Seller modifies StoreName -> shifts to PendingReverification (SEC-04)
        using var update2Req = new HttpRequestMessage(HttpMethod.Put, "/api/v1/seller/store");
        update2Req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        update2Req.Content = JsonContent.Create(new UpdateStoreProfileRequest("Bagan Royal Lacquerware", "Authentic handcrafted lacquerware", "0977665544", "Bagan"));
        var update2Resp = await _client.SendAsync(update2Req);
        Assert.Equal(HttpStatusCode.OK, update2Resp.StatusCode);
        var updated2Dto = await update2Resp.Content.ReadFromJsonAsync<StoreProfileDto>();
        Assert.NotNull(updated2Dto);
        Assert.Equal("Bagan Royal Lacquerware", updated2Dto.StoreName);
        Assert.Equal("bagan-royal-lacquerware", updated2Dto.Slug);
        Assert.Equal("PendingReverification", updated2Dto.VerificationStatus);

        // Verify AuditEvent logged for reverification trigger
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var audit = await db.AuditEvents
                .Where(a => a.Action == "SellerStoreNameChanged_PendingReverification" && a.ActorUserId == sellerUserId)
                .FirstOrDefaultAsync();
            Assert.NotNull(audit);
            Assert.Contains("Automatic reverification triggered", audit.Reason);
        }
    }
}
