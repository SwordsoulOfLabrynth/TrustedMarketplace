using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrustedMarketplace.Application.Identity.Dtos;
using TrustedMarketplace.Application.Verification.Dtos;
using TrustedMarketplace.Domain.Identity;
using TrustedMarketplace.Infrastructure.Identity;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.IntegrationTests;

public class SellerApplicationEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public SellerApplicationEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
    }

    private async Task<(string AccessToken, Guid UserId)> RegisterAndLoginBuyerAsync()
    {
        var email = $"seller_applicant_{Guid.NewGuid():N}@example.com";
        const string password = "SecurePassword123!";

        await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest("Applicant Buyer", email, password));
        var loginResp = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password));
        var auth = await loginResp.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        return (auth.AccessToken, auth.User.Id);
    }

    private async Task<string> CreateAdminAndGetTokenAsync()
    {
        var adminEmail = $"admin_verify_{Guid.NewGuid():N}@example.com";
        const string password = "AdminPassword123!";

        using (var scope = _factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();

            if (!await roleManager.RoleExistsAsync(RoleConstants.Admin))
            {
                await roleManager.CreateAsync(new ApplicationRole(RoleConstants.Admin));
            }

            var adminUser = new ApplicationUser(adminEmail, "Verification Admin")
            {
                EmailConfirmed = true
            };

            await userManager.CreateAsync(adminUser, password);
            await userManager.AddToRoleAsync(adminUser, RoleConstants.Admin);
        }

        var loginResp = await _client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(adminEmail, password));
        var auth = await loginResp.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);

        return auth.AccessToken;
    }

    [Fact]
    public async Task SubmitApplication_ValidRequest_Returns201Created()
    {
        var (token, _) = await RegisterAndLoginBuyerAsync();

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller-applications");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(new CreateSellerApplicationRequest(
            "Aung Crafts", "IndividualCrafter", "0912345678"));

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<SellerApplicationDto>();
        Assert.NotNull(result);
        Assert.Equal("Aung Crafts", result.ProposedStoreName);
        Assert.Equal("Pending", result.Status);
    }

    [Fact]
    public async Task SubmitApplication_DuplicatePending_Returns409Conflict()
    {
        var (token, _) = await RegisterAndLoginBuyerAsync();

        // 1st submit
        using var req1 = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller-applications");
        req1.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        req1.Content = JsonContent.Create(new CreateSellerApplicationRequest("Store One", "Retail", "0911111111"));
        var resp1 = await _client.SendAsync(req1);
        Assert.Equal(HttpStatusCode.Created, resp1.StatusCode);

        // 2nd submit
        using var req2 = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller-applications");
        req2.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        req2.Content = JsonContent.Create(new CreateSellerApplicationRequest("Store Two", "Retail", "0922222222"));
        var resp2 = await _client.SendAsync(req2);

        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);
    }

    [Fact]
    public async Task UploadEvidence_ValidJpeg_SavesPrivatelyAndReturns201Created()
    {
        var (token, _) = await RegisterAndLoginBuyerAsync();

        // Create application
        using var appReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller-applications");
        appReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        appReq.Content = JsonContent.Create(new CreateSellerApplicationRequest("Store With Docs", "Retail", "0911223344"));
        var appResp = await _client.SendAsync(appReq);
        Assert.Equal(HttpStatusCode.Created, appResp.StatusCode);

        // Upload JPEG evidence
        var jpegBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48 };
        using var multipart = new MultipartFormDataContent();
        multipart.Add(new StringContent("NationalIdFront"), "evidenceType");
        var fileContent = new ByteArrayContent(jpegBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        multipart.Add(fileContent, "file", "nrc_front.jpg");

        using var uploadReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller-applications/me/evidence");
        uploadReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        uploadReq.Content = multipart;

        var uploadResp = await _client.SendAsync(uploadReq);
        var body = await uploadResp.Content.ReadAsStringAsync();
        Assert.True(uploadResp.StatusCode == HttpStatusCode.Created, $"Status: {uploadResp.StatusCode}, Body: {body}");
        var evidenceDto = await uploadResp.Content.ReadFromJsonAsync<VerificationEvidenceDto>();
        Assert.NotNull(evidenceDto);
        Assert.Equal("NationalIdFront", evidenceDto.EvidenceType);
        Assert.Equal("Pending", evidenceDto.ReviewStatus);
        Assert.NotEmpty(evidenceDto.Sha256Checksum);
    }

    [Fact]
    public async Task UploadEvidence_ProhibitedSvg_Returns400BadRequest_SEC_12()
    {
        var (token, _) = await RegisterAndLoginBuyerAsync();

        // Create application
        using var appReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller-applications");
        appReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        appReq.Content = JsonContent.Create(new CreateSellerApplicationRequest("Store Svg Test", "Retail", "0911223344"));
        await _client.SendAsync(appReq);

        // Upload SVG file
        var svgBytes = System.Text.Encoding.UTF8.GetBytes("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");
        using var multipart = new MultipartFormDataContent();
        multipart.Add(new StringContent("NationalIdFront"), "evidenceType");
        var fileContent = new ByteArrayContent(svgBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/svg+xml");
        multipart.Add(fileContent, "file", "nrc_exploit.svg");

        using var uploadReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller-applications/me/evidence");
        uploadReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        uploadReq.Content = multipart;

        var uploadResp = await _client.SendAsync(uploadReq);

        Assert.Equal(HttpStatusCode.BadRequest, uploadResp.StatusCode);
    }

    [Fact]
    public async Task AnonymousAccess_ToSellerEndpoints_Returns401Unauthorized_SEC_12()
    {
        var resp1 = await _client.GetAsync("/api/v1/seller-applications/me");
        Assert.Equal(HttpStatusCode.Unauthorized, resp1.StatusCode);

        var resp2 = await _client.PostAsJsonAsync("/api/v1/seller-applications", new CreateSellerApplicationRequest("Anon", "Retail", "091"));
        Assert.Equal(HttpStatusCode.Unauthorized, resp2.StatusCode);
    }

    [Fact]
    public async Task AdminVerificationWorkflow_DownloadEvidenceStreamsAndLogsAudit_ApproveUpdatesState()
    {
        var (buyerToken, _) = await RegisterAndLoginBuyerAsync();
        var adminToken = await CreateAdminAndGetTokenAsync();

        // 1. Buyer creates application
        using var appReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller-applications");
        appReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        appReq.Content = JsonContent.Create(new CreateSellerApplicationRequest("Admin Workflow Store", "Crafter", "0999887766"));
        var appResp = await _client.SendAsync(appReq);
        var createdApp = await appResp.Content.ReadFromJsonAsync<SellerApplicationDto>();
        Assert.NotNull(createdApp);

        // 2. Buyer uploads evidence
        var jpegBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48 };
        using var multipart = new MultipartFormDataContent();
        multipart.Add(new StringContent("NationalIdFront"), "evidenceType");
        var fileContent = new ByteArrayContent(jpegBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        multipart.Add(fileContent, "file", "nrc.jpg");

        using var uploadReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller-applications/me/evidence");
        uploadReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", buyerToken);
        uploadReq.Content = multipart;
        var uploadResp = await _client.SendAsync(uploadReq);
        var evidenceDto = await uploadResp.Content.ReadFromJsonAsync<VerificationEvidenceDto>();
        Assert.NotNull(evidenceDto);

        // 3. Admin retrieves application details
        using var adminGetReq = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/admin/seller-applications/{createdApp.Id}");
        adminGetReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        var adminGetResp = await _client.SendAsync(adminGetReq);
        Assert.Equal(HttpStatusCode.OK, adminGetResp.StatusCode);

        // 4. Admin downloads evidence stream (SEC-12, Audit verification)
        using var streamReq = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/admin/seller-applications/{createdApp.Id}/evidence/{evidenceDto.Id}");
        streamReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        var streamResp = await _client.SendAsync(streamReq);
        Assert.Equal(HttpStatusCode.OK, streamResp.StatusCode);
        var downloadedBytes = await streamResp.Content.ReadAsByteArrayAsync();
        Assert.True(downloadedBytes.Length > 0);

        // Verify audit event exists
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var audit = await db.AuditEvents
                .Where(a => a.Action == "EvidenceViewed" && a.TargetId == evidenceDto.Id.ToString())
                .FirstOrDefaultAsync();
            Assert.NotNull(audit);
            Assert.Equal("VerificationEvidence", audit.TargetType);
        }

        // 5. Admin approves application
        using var decisionReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/admin/seller-applications/{createdApp.Id}/decision");
        decisionReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        decisionReq.Content = JsonContent.Create(new AdminDecisionRequest("Approved", "All credentials verified against national registry."));
        var decisionResp = await _client.SendAsync(decisionReq);
        Assert.Equal(HttpStatusCode.OK, decisionResp.StatusCode);
        var updatedApp = await decisionResp.Content.ReadFromJsonAsync<SellerApplicationDto>();
        Assert.NotNull(updatedApp);
        Assert.Equal("Approved", updatedApp.Status);

        // Verify decision history and approval audit
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var history = await db.VerificationDecisionHistories
                .Where(h => h.SellerApplicationId == createdApp.Id)
                .FirstOrDefaultAsync();
            Assert.NotNull(history);
            Assert.Equal("Pending", history.PreviousStatus);
            Assert.Equal("Approved", history.NewStatus);

            var approvalAudit = await db.AuditEvents
                .Where(a => a.Action == "SellerApplication_Approved" && a.TargetId == createdApp.Id.ToString())
                .FirstOrDefaultAsync();
            Assert.NotNull(approvalAudit);
        }
    }
}
