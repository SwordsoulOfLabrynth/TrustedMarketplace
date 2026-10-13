namespace TrustedMarketplace.Application.Common.Security;

public static class FileValidationService
{
    public const long MaxFileSizeBytes = 5 * 1024 * 1024; // 5 MB

    private static readonly byte[] JpegHeader = { 0xFF, 0xD8, 0xFF };
    private static readonly byte[] PngHeader = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
    private static readonly byte[] PdfHeader = { 0x25, 0x50, 0x44, 0x46 }; // %PDF
    private static readonly byte[] RiffHeader = { 0x52, 0x49, 0x46, 0x46 }; // RIFF (for WEBP)
    private static readonly byte[] WebpHeader = { 0x57, 0x45, 0x42, 0x50 }; // WEBP

    public static (bool IsValid, string DetectedMimeType, string? ErrorMessage) ValidateEvidenceFile(
        Stream stream,
        string fileName,
        string declaredContentType,
        long fileSizeBytes)
    {
        if (fileSizeBytes <= 0)
        {
            return (false, string.Empty, "Uploaded file is empty.");
        }

        if (fileSizeBytes > MaxFileSizeBytes)
        {
            return (false, string.Empty, $"File size exceeds the 5 MB limit (file size: {fileSizeBytes / 1024 / 1024} MB).");
        }

        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (ext is ".svg" or ".html" or ".htm" or ".exe" or ".dll" or ".bat" or ".sh" or ".js")
        {
            return (false, string.Empty, $"File extension '{ext}' is prohibited. SVGs and executable scripts are not permitted.");
        }

        if (!stream.CanRead || !stream.CanSeek)
        {
            return (false, string.Empty, "File stream must be readable and seekable.");
        }

        var initialPosition = stream.Position;
        try
        {
            stream.Position = 0;
            var buffer = new byte[16];
            var bytesRead = stream.Read(buffer, 0, buffer.Length);

            if (bytesRead < 4)
            {
                return (false, string.Empty, "File is too short to determine file type header.");
            }

            // Check JPEG (FF D8 FF)
            if (buffer[0] == JpegHeader[0] && buffer[1] == JpegHeader[1] && buffer[2] == JpegHeader[2])
            {
                return (true, "image/jpeg", null);
            }

            // Check PNG (89 50 4E 47 0D 0A 1A 0A)
            if (bytesRead >= 8 && buffer.Take(8).SequenceEqual(PngHeader))
            {
                return (true, "image/png", null);
            }

            // Check PDF (%PDF)
            if (buffer.Take(4).SequenceEqual(PdfHeader))
            {
                return (true, "application/pdf", null);
            }

            // Check WEBP (RIFF....WEBP)
            if (bytesRead >= 12 &&
                buffer.Take(4).SequenceEqual(RiffHeader) &&
                buffer.Skip(8).Take(4).SequenceEqual(WebpHeader))
            {
                return (true, "image/webp", null);
            }

            return (false, string.Empty, "File content header does not match accepted image or document formats (JPEG, PNG, WEBP, PDF).");
        }
        finally
        {
            stream.Position = initialPosition;
        }
    }
}
