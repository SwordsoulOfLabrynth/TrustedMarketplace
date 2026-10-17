using System.IO.Compression;
using System.Security;
using System.Text;
using TrustedMarketplace.Domain.Credentials;

namespace TrustedMarketplace.Infrastructure.Credentials;

public static class BadgeGenerator
{
    public static string GenerateSvgBadge(
        string publicCredentialId,
        string sellerDisplayName,
        string storeName,
        CredentialStatus status,
        string publicVerificationUrl)
    {
        var isRevoked = status == CredentialStatus.Revoked;
        var safeUrl = SecurityElement.Escape(publicVerificationUrl) ?? string.Empty;
        var safeSeller = SecurityElement.Escape(sellerDisplayName) ?? string.Empty;
        var safeStore = SecurityElement.Escape(storeName) ?? string.Empty;
        var safeId = SecurityElement.Escape(publicCredentialId) ?? string.Empty;

        var statusText = isRevoked ? "REVOKED" : "ACTIVE VERIFIED";
        var statusBg = isRevoked ? "#FEE2E2" : "#DCFCE7";
        var statusFg = isRevoked ? "#991B1B" : "#166534";
        var borderColor = isRevoked ? "#F87171" : "#B28544";

        var svg = new StringBuilder();
        svg.AppendLine($@"<svg xmlns=""http://www.w3.org/2000/svg"" viewBox=""0 0 380 90"" width=""380"" height=""90"" role=""img"" aria-label=""Identity Verified by MatchGuard - {safeSeller}"">");
        svg.AppendLine(@"  <defs>");
        svg.AppendLine(@"    <linearGradient id=""bgGrad"" x1=""0%"" y1=""0%"" x2=""100%"" y2=""100%"">");
        svg.AppendLine(@"      <stop offset=""0%"" stop-color=""#FCFAF7"" />");
        svg.AppendLine(@"      <stop offset=""100%"" stop-color=""#F4EFE6"" />");
        svg.AppendLine(@"    </linearGradient>");
        svg.AppendLine(@"    <linearGradient id=""shieldGrad"" x1=""0%"" y1=""0%"" x2=""100%"" y2=""100%"">");
        svg.AppendLine(@"      <stop offset=""0%"" stop-color=""#133E2D"" />");
        svg.AppendLine(@"      <stop offset=""100%"" stop-color=""#0A241A"" />");
        svg.AppendLine(@"    </linearGradient>");
        svg.AppendLine(@"    <filter id=""cardShadow"" x=""-5%"" y=""-5%"" width=""110%"" height=""115%"">");
        svg.AppendLine(@"      <feDropShadow dx=""0"" dy=""2"" stdDeviation=""3"" flood-color=""#133E2D"" flood-opacity=""0.08"" />");
        svg.AppendLine(@"    </filter>");
        svg.AppendLine(@"  </defs>");

        // Anchor wrapper pointing to public verification page
        svg.AppendLine($@"  <a href=""{safeUrl}"" target=""_blank"" rel=""noopener noreferrer"" style=""cursor: pointer; text-decoration: none;"">");

        // Outer Card
        svg.AppendLine($@"    <rect x=""3"" y=""3"" width=""374"" height=""84"" rx=""14"" fill=""url(#bgGrad)"" stroke=""{borderColor}"" stroke-width=""1.2"" filter=""url(#cardShadow)"" />");

        // Left Shield Icon
        svg.AppendLine(@"    <g transform=""translate(18, 17)"">");
        svg.AppendLine(@"      <path d=""M28 2 C22 4 14 6 10 8 C9 12 8 24 11 34 C14 43 22 50 28 54 C34 50 42 43 45 34 C48 24 47 12 46 8 C42 6 34 4 28 2 Z"" fill=""url(#shieldGrad)"" />");
        svg.AppendLine(@"      <path d=""M28 4 L28 52 C33 48 40 42 43 33 C46 24 45 13 44 9 C40 7 34 5 28 4 Z"" fill=""#1D5941"" opacity=""0.5"" />");
        svg.AppendLine(@"      <path d=""M22 26 L26 31 L35 19"" stroke=""#B28544"" stroke-width=""2.6"" stroke-linecap=""round"" stroke-linejoin=""round"" fill=""none"" />");
        svg.AppendLine(@"    </g>");

        // Middle Content
        svg.AppendLine(@"    <g transform=""translate(80, 22)"">");
        svg.AppendLine(@"      <text x=""0"" y=""10"" font-family=""-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"" font-size=""8.5"" font-weight=""800"" fill=""#B28544"" letter-spacing=""1.2"">MATCHGUARD VERIFIED</text>");
        svg.AppendLine($@"      <text x=""0"" y=""28"" font-family=""-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"" font-size=""13.5"" font-weight=""800"" fill=""#133E2D"">Identity-Verified Seller</text>");
        svg.AppendLine($@"      <text x=""0"" y=""44"" font-family=""-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"" font-size=""9"" font-weight=""500"" fill=""#64748B"">ID: {safeId}</text>");
        svg.AppendLine(@"    </g>");

        // Right Status Pill
        svg.AppendLine(@"    <g transform=""translate(275, 32)"">");
        svg.AppendLine($@"      <rect x=""0"" y=""0"" width=""88"" height=""26"" rx=""8"" fill=""{statusBg}"" stroke=""{statusFg}"" stroke-width=""0.8"" stroke-opacity=""0.3"" />");
        svg.AppendLine($@"      <text x=""44"" y=""16"" text-anchor=""middle"" font-family=""-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"" font-size=""8"" font-weight=""800"" fill=""{statusFg}"" letter-spacing=""0.5"">{statusText}</text>");
        svg.AppendLine(@"    </g>");

        svg.AppendLine(@"  </a>");
        svg.AppendLine(@"</svg>");

        return svg.ToString();
    }

    public static byte[] GeneratePngBadge(
        string publicCredentialId,
        string sellerDisplayName,
        string storeName,
        CredentialStatus status,
        string publicVerificationUrl)
    {
        // 380 x 90 PNG image generated via pure standard C# (ZLibStream + RGBA raster)
        const int width = 380;
        const int height = 90;

        var isRevoked = status == CredentialStatus.Revoked;

        // Palette
        // Background: #FAF7F2 (250, 247, 242)
        // Border: Gold #B28544 (178, 133, 68) or Red #F87171 (248, 113, 113)
        // Green: #133E2D (19, 62, 45)
        // Gold: #B28544 (178, 133, 68)

        var borderR = (byte)(isRevoked ? 248 : 178);
        var borderG = (byte)(isRevoked ? 113 : 133);
        var borderB = (byte)(isRevoked ? 113 : 68);

        var rawRgba = new byte[height * (1 + width * 4)];

        for (int y = 0; y < height; y++)
        {
            var rowStart = y * (1 + width * 4);
            rawRgba[rowStart] = 0; // Filter: None

            for (int x = 0; x < width; x++)
            {
                var pixelStart = rowStart + 1 + (x * 4);

                // Border check (1px outline with rounded corner approximations)
                var isBorder = (x == 2 || x == width - 3 || y == 2 || y == height - 3);

                if (isBorder)
                {
                    rawRgba[pixelStart] = borderR;
                    rawRgba[pixelStart + 1] = borderG;
                    rawRgba[pixelStart + 2] = borderB;
                    rawRgba[pixelStart + 3] = 255;
                }
                else if (x > 2 && x < width - 3 && y > 2 && y < height - 3)
                {
                    // Card background with subtle vertical gradient
                    var t = (double)y / height;
                    var bgR = (byte)(252 - (t * 8));
                    var bgG = (byte)(250 - (t * 11));
                    var bgB = (byte)(247 - (t * 17));

                    // Shield icon region: x between 20 and 56, y between 18 and 72
                    if (x >= 24 && x <= 56 && y >= 20 && y <= 70)
                    {
                        var shieldDx = Math.Abs(x - 40);
                        var isInsideShield = (shieldDx <= 14) && (y - 20 <= 45 - (shieldDx * 1.5));

                        if (isInsideShield)
                        {
                            rawRgba[pixelStart] = 19;     // #133E2D
                            rawRgba[pixelStart + 1] = 62;
                            rawRgba[pixelStart + 2] = 45;
                            rawRgba[pixelStart + 3] = 255;
                            continue;
                        }
                    }

                    rawRgba[pixelStart] = bgR;
                    rawRgba[pixelStart + 1] = bgG;
                    rawRgba[pixelStart + 2] = bgB;
                    rawRgba[pixelStart + 3] = 255;
                }
                else
                {
                    // Transparent exterior outside rounded border
                    rawRgba[pixelStart] = 0;
                    rawRgba[pixelStart + 1] = 0;
                    rawRgba[pixelStart + 2] = 0;
                    rawRgba[pixelStart + 3] = 0;
                }
            }
        }

        return CreatePng(width, height, rawRgba);
    }

    private static byte[] CreatePng(int width, int height, byte[] rawScanlines)
    {
        using var ms = new MemoryStream();
        // PNG Signature
        ms.Write(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }, 0, 8);

        // IHDR Chunk
        var ihdr = new byte[13];
        WriteBigEndianInt32(ihdr, 0, width);
        WriteBigEndianInt32(ihdr, 4, height);
        ihdr[8] = 8; // Bit depth: 8
        ihdr[9] = 6; // Color type: RGBA (6)
        ihdr[10] = 0; // Compression: Deflate
        ihdr[11] = 0; // Filter: Standard
        ihdr[12] = 0; // Interlace: None
        WriteChunk(ms, "IHDR", ihdr);

        // IDAT Chunk (ZLib compressed)
        byte[] compressedData;
        using (var compressMs = new MemoryStream())
        {
            using (var zlib = new ZLibStream(compressMs, CompressionLevel.Optimal, leaveOpen: true))
            {
                zlib.Write(rawScanlines, 0, rawScanlines.Length);
            }
            compressedData = compressMs.ToArray();
        }
        WriteChunk(ms, "IDAT", compressedData);

        // IEND Chunk
        WriteChunk(ms, "IEND", Array.Empty<byte>());

        return ms.ToArray();
    }

    private static void WriteChunk(Stream stream, string type, byte[] data)
    {
        var typeBytes = Encoding.ASCII.GetBytes(type);
        var lenBytes = new byte[4];
        WriteBigEndianInt32(lenBytes, 0, data.Length);
        stream.Write(lenBytes, 0, 4);
        stream.Write(typeBytes, 0, 4);
        if (data.Length > 0)
        {
            stream.Write(data, 0, data.Length);
        }

        var crc = CalculateCrc32(typeBytes, data);
        var crcBytes = new byte[4];
        WriteBigEndianInt32(crcBytes, 0, (int)crc);
        stream.Write(crcBytes, 0, 4);
    }

    private static void WriteBigEndianInt32(byte[] buffer, int offset, int value)
    {
        buffer[offset] = (byte)((value >> 24) & 0xFF);
        buffer[offset + 1] = (byte)((value >> 16) & 0xFF);
        buffer[offset + 2] = (byte)((value >> 8) & 0xFF);
        buffer[offset + 3] = (byte)(value & 0xFF);
    }

    private static uint CalculateCrc32(byte[] type, byte[] data)
    {
        var crc = 0xFFFFFFFF;
        for (int i = 0; i < type.Length; i++)
            crc = CrcTable[(crc ^ type[i]) & 0xFF] ^ (crc >> 8);
        for (int i = 0; i < data.Length; i++)
            crc = CrcTable[(crc ^ data[i]) & 0xFF] ^ (crc >> 8);
        return crc ^ 0xFFFFFFFF;
    }

    private static readonly uint[] CrcTable = InitializeCrcTable();

    private static uint[] InitializeCrcTable()
    {
        var table = new uint[256];
        for (uint i = 0; i < 256; i++)
        {
            var c = i;
            for (int k = 0; k < 8; k++)
            {
                if ((c & 1) != 0)
                    c = 0xEDB88320 ^ (c >> 1);
                else
                    c >>= 1;
            }
            table[i] = c;
        }
        return table;
    }
}
