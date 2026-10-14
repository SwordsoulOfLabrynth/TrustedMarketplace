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
using TrustedMarketplace.Application.Verification.Dtos;
using TrustedMarketplace.Domain.Identity;
using TrustedMarketplace.Infrastructure.Identity;
using TrustedMarketplace.Infrastructure.Persistence;

namespace TrustedMarketplace.IntegrationTests;

public class ProductImageEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    private static readonly byte[] ValidJpegBytes =
        { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48 };

    private static readonly byte[] ValidPngBytes =
        { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52 };

    private static readonly byte[] ValidWebpBytes =
        { 0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20 };

    public ProductImageEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
    }

    private async Task<(string AccessToken, Guid UserId)> RegisterAndLoginUserAsync(string role = RoleConstants.Buyer)
    {
        var email = $"img_user_{Guid.NewGuid():N}@example.com";
        const string password = "SecurePassword123!";

        await _client.PostAsJsonAsync("/api/v1/auth/register", new RegisterRequest("Image User", email, password));

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

        using var appReq = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller-applications");
        appReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        appReq.Content = JsonContent.Create(new CreateSellerApplicationRequest($"Approved Store {Guid.NewGuid():N}"[..25], "Artisan", "0911223344"));
        var appResp = await _client.SendAsync(appReq);
        var createdApp = await appResp.Content.ReadFromJsonAsync<SellerApplicationDto>();
        Assert.NotNull(createdApp);

        using var decReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/admin/seller-applications/{createdApp.Id}/decision");
        decReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        decReq.Content = JsonContent.Create(new AdminDecisionRequest("Approved", "Valid application"));
        await _client.SendAsync(decReq);

        return (sellerToken, sellerUserId);
    }

    private async Task<Guid> GetActiveCategoryIdAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var cat = await db.Categories.FirstAsync(c => c.IsActive);
        return cat.Id;
    }

    private async Task<ProductDto> CreateProductAsync(string sellerToken)
    {
        var categoryId = await GetActiveCategoryIdAsync();
        using var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/seller/products");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        req.Content = JsonContent.Create(new CreateProductRequest(categoryId, "Handmade Marionette", "Authentic craft", 45000, "New"));
        var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var product = await resp.Content.ReadFromJsonAsync<ProductDto>();
        Assert.NotNull(product);
        return product;
    }

    [Fact]
    public async Task UploadProductImage_ValidJpeg_Returns201CreatedAndPersistsMetadata()
    {
        var (sellerToken, _) = await CreateApprovedSellerAsync();
        var product = await CreateProductAsync(sellerToken);

        using var multipart = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(ValidJpegBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        multipart.Add(fileContent, "file", "puppet.jpg");

        using var uploadReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{product.Id}/images");
        uploadReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        uploadReq.Content = multipart;

        var uploadResp = await _client.SendAsync(uploadReq);
        var body = await uploadResp.Content.ReadAsStringAsync();
        Assert.True(uploadResp.StatusCode == HttpStatusCode.Created, $"Status: {uploadResp.StatusCode}, Body: {body}");

        var imageDto = await uploadResp.Content.ReadFromJsonAsync<ProductImageDto>();
        Assert.NotNull(imageDto);
        Assert.Equal(0, imageDto.SortOrder);
        Assert.True(imageDto.IsPrimary);
        Assert.Equal("puppet.jpg", imageDto.OriginalFileName);
        Assert.Equal("image/jpeg", imageDto.MimeType);
        Assert.Contains($"/api/v1/products/{product.Id}/images/{imageDto.Id}/content", imageDto.Url);
    }

    [Fact]
    public async Task UploadProductImage_Unauthenticated_Returns401Unauthorized()
    {
        var (sellerToken, _) = await CreateApprovedSellerAsync();
        var product = await CreateProductAsync(sellerToken);

        using var multipart = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(ValidJpegBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        multipart.Add(fileContent, "file", "puppet.jpg");

        using var uploadReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{product.Id}/images");
        uploadReq.Content = multipart;

        var uploadResp = await _client.SendAsync(uploadReq);
        Assert.Equal(HttpStatusCode.Unauthorized, uploadResp.StatusCode);
    }

    [Fact]
    public async Task UploadProductImage_SellerACannotUploadToSellerBProduct_Returns403Forbidden()
    {
        var (sellerAToken, _) = await CreateApprovedSellerAsync();
        var (sellerBToken, _) = await CreateApprovedSellerAsync();
        var productA = await CreateProductAsync(sellerAToken);

        using var multipart = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(ValidJpegBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        multipart.Add(fileContent, "file", "puppet.jpg");

        using var uploadReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{productA.Id}/images");
        uploadReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerBToken);
        uploadReq.Content = multipart;

        var uploadResp = await _client.SendAsync(uploadReq);
        Assert.Equal(HttpStatusCode.Forbidden, uploadResp.StatusCode);
    }

    [Fact]
    public async Task UploadProductImage_UnsupportedFormat_PdfAndSvg_Returns400BadRequest()
    {
        var (sellerToken, _) = await CreateApprovedSellerAsync();
        var product = await CreateProductAsync(sellerToken);

        // 1. Try PDF
        var pdfBytes = new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x35 };
        using var pdfMultipart = new MultipartFormDataContent();
        var pdfContent = new ByteArrayContent(pdfBytes);
        pdfContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        pdfMultipart.Add(pdfContent, "file", "document.pdf");

        using var pdfReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{product.Id}/images");
        pdfReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        pdfReq.Content = pdfMultipart;

        var pdfResp = await _client.SendAsync(pdfReq);
        Assert.Equal(HttpStatusCode.BadRequest, pdfResp.StatusCode);

        // 2. Try SVG
        var svgBytes = "<svg xmlns=\"http://www.w3.org/2000/svg\"><circle r=\"10\"/></svg>"u8.ToArray();
        using var svgMultipart = new MultipartFormDataContent();
        var svgContent = new ByteArrayContent(svgBytes);
        svgContent.Headers.ContentType = new MediaTypeHeaderValue("image/svg+xml");
        svgMultipart.Add(svgContent, "file", "image.svg");

        using var svgReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{product.Id}/images");
        svgReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        svgReq.Content = svgMultipart;

        var svgResp = await _client.SendAsync(svgReq);
        Assert.Equal(HttpStatusCode.BadRequest, svgResp.StatusCode);
    }

    [Fact]
    public async Task UploadProductImage_MismatchedOrCorruptHeader_Returns400BadRequest()
    {
        var (sellerToken, _) = await CreateApprovedSellerAsync();
        var product = await CreateProductAsync(sellerToken);

        // Text content disguised with .jpg extension
        var fakeBytes = "Hello this is just text"u8.ToArray();
        using var multipart = new MultipartFormDataContent();
        var content = new ByteArrayContent(fakeBytes);
        content.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        multipart.Add(content, "file", "fake.jpg");

        using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{product.Id}/images");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        req.Content = multipart;

        var resp = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task ProductImages_PrimaryCoverAndReordering_WorksSuccessfully()
    {
        var (sellerToken, _) = await CreateApprovedSellerAsync();
        var product = await CreateProductAsync(sellerToken);

        // Upload image 1 (JPEG)
        using var m1 = new MultipartFormDataContent();
        var c1 = new ByteArrayContent(ValidJpegBytes);
        c1.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        m1.Add(c1, "file", "img1.jpg");
        using var req1 = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{product.Id}/images");
        req1.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        req1.Content = m1;
        var r1 = await _client.SendAsync(req1);
        var img1 = await r1.Content.ReadFromJsonAsync<ProductImageDto>();
        Assert.NotNull(img1);
        Assert.True(img1.IsPrimary);

        // Upload image 2 (PNG)
        using var m2 = new MultipartFormDataContent();
        var c2 = new ByteArrayContent(ValidPngBytes);
        c2.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        m2.Add(c2, "file", "img2.png");
        using var req2 = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{product.Id}/images");
        req2.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        req2.Content = m2;
        var r2 = await _client.SendAsync(req2);
        var img2 = await r2.Content.ReadFromJsonAsync<ProductImageDto>();
        Assert.NotNull(img2);
        Assert.False(img2.IsPrimary);

        // Set image 2 as primary
        using var primReq = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/seller/products/{product.Id}/images/{img2.Id}/primary");
        primReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var primResp = await _client.SendAsync(primReq);
        Assert.Equal(HttpStatusCode.OK, primResp.StatusCode);
        var updatedImg2 = await primResp.Content.ReadFromJsonAsync<ProductImageDto>();
        Assert.NotNull(updatedImg2);
        Assert.True(updatedImg2.IsPrimary);
        Assert.Equal(0, updatedImg2.SortOrder);

        // Verify anonymous query on draft product returns 404 (draft privacy)
        var anonListResp = await _client.GetAsync($"/api/v1/products/{product.Id}/images");
        Assert.Equal(HttpStatusCode.NotFound, anonListResp.StatusCode);

        // Verify authorized seller query on draft product returns 200 OK with correct order
        using var authListReq = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/products/{product.Id}/images");
        authListReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var listResp = await _client.SendAsync(authListReq);
        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);
        var list = await listResp.Content.ReadFromJsonAsync<List<ProductImageDto>>();
        Assert.NotNull(list);
        Assert.Equal(2, list.Count);
        Assert.Equal(img2.Id, list[0].Id);
        Assert.True(list[0].IsPrimary);
        Assert.Equal(img1.Id, list[1].Id);
        Assert.False(list[1].IsPrimary);
    }

    [Fact]
    public async Task ServeProductImage_PublicAccessAndHeaders_ReturnsBinaryContentWithCacheHeaders()
    {
        var (sellerToken, _) = await CreateApprovedSellerAsync();
        var product = await CreateProductAsync(sellerToken);

        // Upload WebP image
        using var m = new MultipartFormDataContent();
        var c = new ByteArrayContent(ValidWebpBytes);
        c.Headers.ContentType = new MediaTypeHeaderValue("image/webp");
        m.Add(c, "file", "artisan.webp");
        using var uploadReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{product.Id}/images");
        uploadReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        uploadReq.Content = m;
        var uploadResp = await _client.SendAsync(uploadReq);
        var imageDto = await uploadResp.Content.ReadFromJsonAsync<ProductImageDto>();
        Assert.NotNull(imageDto);

        // Publish product so it is publicly accessible
        using var pubReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{product.Id}/publish");
        pubReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var pubResp = await _client.SendAsync(pubReq);
        Assert.Equal(HttpStatusCode.OK, pubResp.StatusCode);

        // Fetch image content anonymously
        var contentResp = await _client.GetAsync($"/api/v1/products/{product.Id}/images/{imageDto.Id}/content");
        Assert.Equal(HttpStatusCode.OK, contentResp.StatusCode);
        Assert.Equal("image/webp", contentResp.Content.Headers.ContentType?.MediaType);
        Assert.True(contentResp.Headers.CacheControl?.Public);
        Assert.Contains("nosniff", contentResp.Headers.GetValues("X-Content-Type-Options"));

        var downloadedBytes = await contentResp.Content.ReadAsByteArrayAsync();
        Assert.Equal(ValidWebpBytes, downloadedBytes);
    }

    [Fact]
    public async Task DeleteProductImage_CleansUpAndRemovesFromCatalog()
    {
        var (sellerToken, _) = await CreateApprovedSellerAsync();
        var product = await CreateProductAsync(sellerToken);

        // Upload image
        using var m = new MultipartFormDataContent();
        var c = new ByteArrayContent(ValidJpegBytes);
        c.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        m.Add(c, "file", "delete_me.jpg");
        using var uploadReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{product.Id}/images");
        uploadReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        uploadReq.Content = m;
        var uploadResp = await _client.SendAsync(uploadReq);
        var imageDto = await uploadResp.Content.ReadFromJsonAsync<ProductImageDto>();
        Assert.NotNull(imageDto);

        // Delete image
        using var delReq = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/seller/products/{product.Id}/images/{imageDto.Id}");
        delReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var delResp = await _client.SendAsync(delReq);
        Assert.Equal(HttpStatusCode.NoContent, delResp.StatusCode);

        // Subsequent content request returns 404
        var getResp = await _client.GetAsync($"/api/v1/products/{product.Id}/images/{imageDto.Id}/content");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task SecurityIsolation_PrivateEvidenceStorage_CannotBeAccessedThroughProductImageRoutes()
    {
        // Any random GUID or non-existent product image returns 404, never private files
        var getResp = await _client.GetAsync($"/api/v1/products/{Guid.NewGuid()}/images/{Guid.NewGuid()}/content");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);
    }

    [Fact]
    public async Task ServeProductImage_DraftProduct_ReturnsPrivateNoCacheHeadersForOwner()
    {
        var (sellerToken, _) = await CreateApprovedSellerAsync();
        var product = await CreateProductAsync(sellerToken);

        using var m = new MultipartFormDataContent();
        var c = new ByteArrayContent(ValidJpegBytes);
        c.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        m.Add(c, "file", "draft_cover.jpg");
        using var uploadReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{product.Id}/images");
        uploadReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        uploadReq.Content = m;
        var uploadResp = await _client.SendAsync(uploadReq);
        var imageDto = await uploadResp.Content.ReadFromJsonAsync<ProductImageDto>();
        Assert.NotNull(imageDto);

        // Fetch image content as the authorized seller owner
        using var getReq = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/products/{product.Id}/images/{imageDto.Id}/content");
        getReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var contentResp = await _client.SendAsync(getReq);

        Assert.Equal(HttpStatusCode.OK, contentResp.StatusCode);
        Assert.Equal("image/jpeg", contentResp.Content.Headers.ContentType?.MediaType);
        // Verify private caching headers to prevent intermediary CDN/proxy leak
        Assert.False(contentResp.Headers.CacheControl?.Public ?? false);
        Assert.True(contentResp.Headers.CacheControl?.NoCache ?? false);
        Assert.True(contentResp.Headers.CacheControl?.NoStore ?? false);
        Assert.Contains("nosniff", contentResp.Headers.GetValues("X-Content-Type-Options"));
    }

    [Fact]
    public async Task ServeProductImage_DraftProduct_Returns404NotFoundForAnonymousAndOtherSellers()
    {
        var (sellerAToken, _) = await CreateApprovedSellerAsync();
        var (sellerBToken, _) = await CreateApprovedSellerAsync();
        var product = await CreateProductAsync(sellerAToken);

        using var m = new MultipartFormDataContent();
        var c = new ByteArrayContent(ValidJpegBytes);
        c.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        m.Add(c, "file", "private_draft.jpg");
        using var uploadReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{product.Id}/images");
        uploadReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerAToken);
        uploadReq.Content = m;
        var uploadResp = await _client.SendAsync(uploadReq);
        var imageDto = await uploadResp.Content.ReadFromJsonAsync<ProductImageDto>();
        Assert.NotNull(imageDto);

        // 1. Anonymous user receives 404
        var anonResp = await _client.GetAsync($"/api/v1/products/{product.Id}/images/{imageDto.Id}/content");
        Assert.Equal(HttpStatusCode.NotFound, anonResp.StatusCode);

        // 2. Different seller receives 404 (does not leak existence of draft listing)
        using var strangerReq = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/products/{product.Id}/images/{imageDto.Id}/content");
        strangerReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerBToken);
        var strangerResp = await _client.SendAsync(strangerReq);
        Assert.Equal(HttpStatusCode.NotFound, strangerResp.StatusCode);
    }

    [Fact]
    public async Task DeleteProductImage_ImageBelongingToDifferentProduct_Returns400BadRequestAndDoesNotDelete()
    {
        var (sellerToken, _) = await CreateApprovedSellerAsync();
        var productA = await CreateProductAsync(sellerToken);
        var productB = await CreateProductAsync(sellerToken);

        // Upload image to Product A
        using var m = new MultipartFormDataContent();
        var c = new ByteArrayContent(ValidJpegBytes);
        c.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        m.Add(c, "file", "prodA.jpg");
        using var uploadReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{productA.Id}/images");
        uploadReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        uploadReq.Content = m;
        var uploadResp = await _client.SendAsync(uploadReq);
        var imageA = await uploadResp.Content.ReadFromJsonAsync<ProductImageDto>();
        Assert.NotNull(imageA);

        // Attempt to delete Image A via Product B's delete endpoint
        using var delReq = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/seller/products/{productB.Id}/images/{imageA.Id}");
        delReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var delResp = await _client.SendAsync(delReq);

        // Must reject since image does not belong to Product B
        Assert.Equal(HttpStatusCode.BadRequest, delResp.StatusCode);

        // Verify Image A still exists on Product A
        using var checkReq = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/products/{productA.Id}/images");
        checkReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var checkResp = await _client.SendAsync(checkReq);
        var images = await checkResp.Content.ReadFromJsonAsync<List<ProductImageDto>>();
        Assert.NotNull(images);
        Assert.Contains(images, i => i.Id == imageA.Id);
    }

    [Fact]
    public async Task ReorderProductImages_OtherSellerProduct_Returns403Forbidden()
    {
        var (sellerAToken, _) = await CreateApprovedSellerAsync();
        var (sellerBToken, _) = await CreateApprovedSellerAsync();
        var productA = await CreateProductAsync(sellerAToken);

        // Upload image to Product A
        using var m = new MultipartFormDataContent();
        var c = new ByteArrayContent(ValidJpegBytes);
        c.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        m.Add(c, "file", "prodA.jpg");
        using var uploadReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{productA.Id}/images");
        uploadReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerAToken);
        uploadReq.Content = m;
        var uploadResp = await _client.SendAsync(uploadReq);
        var imageA = await uploadResp.Content.ReadFromJsonAsync<ProductImageDto>();
        Assert.NotNull(imageA);

        // Seller B attempts to reorder images on Product A
        using var reorderReq = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/seller/products/{productA.Id}/images/reorder");
        reorderReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerBToken);
        reorderReq.Content = JsonContent.Create(new ReorderProductImagesRequest(new List<Guid> { imageA.Id }));
        var reorderResp = await _client.SendAsync(reorderReq);

        Assert.Equal(HttpStatusCode.Forbidden, reorderResp.StatusCode);
    }

    [Fact]
    public async Task StorageKey_PathTraversalAndRootedKey_SafelyBlocked()
    {
        using var scope = _factory.Services.CreateScope();
        var storage = scope.ServiceProvider.GetRequiredService<TrustedMarketplace.Application.Common.Interfaces.IFileStorageService>();

        // 1. Directory traversal attempt
        var traversalStream = await storage.GetProductImageAsync("../../private_evidence/secret.pdf");
        Assert.Null(traversalStream);

        // 2. Rooted Linux path attempt
        var linuxRootedStream = await storage.GetProductImageAsync("/etc/passwd");
        Assert.Null(linuxRootedStream);

        // 3. Rooted Windows path attempt
        var winRootedStream = await storage.GetProductImageAsync("C:\\Windows\\System32\\drivers\\etc\\hosts");
        Assert.Null(winRootedStream);

        // 4. Backslash prefix attempt
        var backslashStream = await storage.GetProductImageAsync("\\Windows\\System32\\cmd.exe");
        Assert.Null(backslashStream);
    }

    [Fact]
    public async Task UploadProductImage_ExceedsMaxImagesLimit_Returns400BadRequest()
    {
        var (sellerToken, _) = await CreateApprovedSellerAsync();
        var product = await CreateProductAsync(sellerToken);

        // Upload up to the limit (8 images)
        for (var i = 0; i < 8; i++)
        {
            using var m = new MultipartFormDataContent();
            var c = new ByteArrayContent(ValidJpegBytes);
            c.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
            m.Add(c, "file", $"img_{i}.jpg");
            using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{product.Id}/images");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
            req.Content = m;
            var resp = await _client.SendAsync(req);
            Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        }

        // Attempt to upload 9th image
        using var extraM = new MultipartFormDataContent();
        var extraC = new ByteArrayContent(ValidJpegBytes);
        extraC.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        extraM.Add(extraC, "file", "img_exceeded.jpg");
        using var extraReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/seller/products/{product.Id}/images");
        extraReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        extraReq.Content = extraM;
        var extraResp = await _client.SendAsync(extraReq);

        Assert.Equal(HttpStatusCode.BadRequest, extraResp.StatusCode);
        var body = await extraResp.Content.ReadAsStringAsync();
        Assert.Contains("DOMAIN_RULE_VIOLATION", body);
    }
}
