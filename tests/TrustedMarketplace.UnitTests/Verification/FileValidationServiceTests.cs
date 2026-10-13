using TrustedMarketplace.Application.Common.Security;

namespace TrustedMarketplace.UnitTests.Verification;

public class FileValidationServiceTests
{
    [Fact]
    public void ValidateEvidenceFile_ValidJpeg_ReturnsValid()
    {
        var jpegBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01 };
        using var stream = new MemoryStream(jpegBytes);

        var (isValid, mimeType, error) = FileValidationService.ValidateEvidenceFile(
            stream, "nrc_front.jpg", "image/jpeg", jpegBytes.Length);

        Assert.True(isValid);
        Assert.Equal("image/jpeg", mimeType);
        Assert.Null(error);
    }

    [Fact]
    public void ValidateEvidenceFile_ValidPng_ReturnsValid()
    {
        var pngBytes = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D };
        using var stream = new MemoryStream(pngBytes);

        var (isValid, mimeType, error) = FileValidationService.ValidateEvidenceFile(
            stream, "license.png", "image/png", pngBytes.Length);

        Assert.True(isValid);
        Assert.Equal("image/png", mimeType);
        Assert.Null(error);
    }

    [Fact]
    public void ValidateEvidenceFile_ValidPdf_ReturnsValid()
    {
        var pdfBytes = new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x35, 0x0A, 0x25, 0xD0, 0xD4 };
        using var stream = new MemoryStream(pdfBytes);

        var (isValid, mimeType, error) = FileValidationService.ValidateEvidenceFile(
            stream, "utility_bill.pdf", "application/pdf", pdfBytes.Length);

        Assert.True(isValid);
        Assert.Equal("application/pdf", mimeType);
        Assert.Null(error);
    }

    [Fact]
    public void ValidateEvidenceFile_ValidWebp_ReturnsValid()
    {
        // RIFF (4 bytes) + Size (4 bytes) + WEBP (4 bytes)
        var webpBytes = new byte[]
        {
            0x52, 0x49, 0x46, 0x46,
            0x24, 0x00, 0x00, 0x00,
            0x57, 0x45, 0x42, 0x50,
            0x56, 0x50, 0x38, 0x20
        };
        using var stream = new MemoryStream(webpBytes);

        var (isValid, mimeType, error) = FileValidationService.ValidateEvidenceFile(
            stream, "id.webp", "image/webp", webpBytes.Length);

        Assert.True(isValid);
        Assert.Equal("image/webp", mimeType);
        Assert.Null(error);
    }

    [Theory]
    [InlineData("malicious.svg")]
    [InlineData("xss.html")]
    [InlineData("shell.exe")]
    [InlineData("script.bat")]
    [InlineData("hack.js")]
    public void ValidateEvidenceFile_ProhibitedExtension_RejectsFile(string filename)
    {
        var dummyBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 };
        using var stream = new MemoryStream(dummyBytes);

        var (isValid, _, error) = FileValidationService.ValidateEvidenceFile(
            stream, filename, "application/octet-stream", dummyBytes.Length);

        Assert.False(isValid);
        Assert.Contains("prohibited", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ValidateEvidenceFile_Exceeds5Mb_RejectsFile()
    {
        var dummyBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 };
        using var stream = new MemoryStream(dummyBytes);

        long oversized = (5 * 1024 * 1024) + 1;
        var (isValid, _, error) = FileValidationService.ValidateEvidenceFile(
            stream, "huge.jpg", "image/jpeg", oversized);

        Assert.False(isValid);
        Assert.Contains("exceeds the 5 MB limit", error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ValidateEvidenceFile_EmptyFile_RejectsFile()
    {
        using var stream = new MemoryStream(Array.Empty<byte>());

        var (isValid, _, error) = FileValidationService.ValidateEvidenceFile(
            stream, "empty.png", "image/png", 0);

        Assert.False(isValid);
        Assert.Contains("empty", error, StringComparison.OrdinalIgnoreCase);
    }
}
