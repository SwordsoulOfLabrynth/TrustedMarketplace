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

        // Border: Gold #B28544 (178, 133, 68) or Red #F87171 (248, 113, 113)
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

                    // Shield icon region: x between 24 and 56, y between 20 and 70
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

        // Draw gold checkmark inside shield
        DrawLine(rawRgba, width, height, 33, 44, 38, 50, 2, 178, 133, 68);
        DrawLine(rawRgba, width, height, 38, 50, 47, 36, 2, 178, 133, 68);

        // Header text: MATCHGUARD VERIFIED (Gold)
        DrawText(rawRgba, width, height, "MATCHGUARD VERIFIED", 74, 22, 1, false, 178, 133, 68);

        // Title: Identity-Verified Seller (Forest Green, bold)
        DrawText(rawRgba, width, height, "Identity-Verified Seller", 74, 38, 1, true, 19, 62, 45);

        // Subtitle: ID: {publicCredentialId} (Slate)
        var cleanId = string.IsNullOrWhiteSpace(publicCredentialId) ? "UNREGISTERED" : publicCredentialId.Trim().ToUpperInvariant();
        DrawText(rawRgba, width, height, $"ID: {cleanId}", 74, 56, 1, false, 100, 116, 139);

        // Right status pill
        var pillX = 274;
        var pillY = 32;
        var pillW = 88;
        var pillH = 26;

        var pillBgR = (byte)(isRevoked ? 254 : 220);
        var pillBgG = (byte)(isRevoked ? 226 : 252);
        var pillBgB = (byte)(isRevoked ? 226 : 231);

        var pillFgR = (byte)(isRevoked ? 153 : 22);
        var pillFgG = (byte)(isRevoked ? 27 : 101);
        var pillFgB = (byte)(isRevoked ? 27 : 52);

        // Fill pill
        FillRect(rawRgba, width, height, pillX, pillY, pillW, pillH, pillBgR, pillBgG, pillBgB, 255);
        // Pill border
        DrawRectOutline(rawRgba, width, height, pillX, pillY, pillW, pillH, pillFgR, pillFgG, pillFgB);

        var pillText = isRevoked ? "REVOKED" : "ACTIVE VERIFIED";
        var textWidth = pillText.Length * 6;
        var textX = pillX + (pillW - textWidth) / 2;
        DrawText(rawRgba, width, height, pillText, textX, pillY + 9, 1, true, pillFgR, pillFgG, pillFgB);

        return CreatePng(width, height, rawRgba);
    }

    private static void FillRect(byte[] rawRgba, int width, int height, int startX, int startY, int rectW, int rectH, byte r, byte g, byte b, byte a)
    {
        for (int y = startY; y < startY + rectH; y++)
        {
            if (y < 0 || y >= height) continue;
            for (int x = startX; x < startX + rectW; x++)
            {
                if (x < 0 || x >= width) continue;
                var offset = y * (1 + width * 4) + 1 + (x * 4);
                rawRgba[offset] = r;
                rawRgba[offset + 1] = g;
                rawRgba[offset + 2] = b;
                rawRgba[offset + 3] = a;
            }
        }
    }

    private static void DrawRectOutline(byte[] rawRgba, int width, int height, int startX, int startY, int rectW, int rectH, byte r, byte g, byte b)
    {
        for (int x = startX; x < startX + rectW; x++)
        {
            SetPixel(rawRgba, width, height, x, startY, r, g, b);
            SetPixel(rawRgba, width, height, x, startY + rectH - 1, r, g, b);
        }
        for (int y = startY; y < startY + rectH; y++)
        {
            SetPixel(rawRgba, width, height, startX, y, r, g, b);
            SetPixel(rawRgba, width, height, startX + rectW - 1, y, r, g, b);
        }
    }

    private static void SetPixel(byte[] rawRgba, int width, int height, int x, int y, byte r, byte g, byte b)
    {
        if (x < 0 || x >= width || y < 0 || y >= height) return;
        var offset = y * (1 + width * 4) + 1 + (x * 4);
        rawRgba[offset] = r;
        rawRgba[offset + 1] = g;
        rawRgba[offset + 2] = b;
        rawRgba[offset + 3] = 255;
    }

    private static void DrawLine(byte[] rawRgba, int width, int height, int x0, int y0, int x1, int y1, int strokeWidth, byte r, byte g, byte b)
    {
        int dx = Math.Abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        int dy = -Math.Abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        int err = dx + dy;
        int x = x0, y = y0;
        while (true)
        {
            for (int swY = -strokeWidth / 2; swY <= strokeWidth / 2; swY++)
            {
                for (int swX = -strokeWidth / 2; swX <= strokeWidth / 2; swX++)
                {
                    SetPixel(rawRgba, width, height, x + swX, y + swY, r, g, b);
                }
            }
            if (x == x1 && y == y1) break;
            int e2 = 2 * err;
            if (e2 >= dy) { err += dy; x += sx; }
            if (e2 <= dx) { err += dx; y += sy; }
        }
    }

    private static void DrawText(byte[] rawRgba, int width, int height, string text, int startX, int startY, int scale, bool bold, byte r, byte g, byte b)
    {
        var cursorX = startX;
        foreach (var ch in text)
        {
            if (ch == ' ')
            {
                cursorX += 4 * scale;
                continue;
            }

            if (Font5x7.TryGetValue(ch, out var cols))
            {
                for (int col = 0; col < 5; col++)
                {
                    var colBits = cols[col];
                    for (int bit = 0; bit < 7; bit++)
                    {
                        if ((colBits & (1 << bit)) != 0)
                        {
                            for (int dy = 0; dy < scale; dy++)
                            {
                                for (int dx = 0; dx < scale; dx++)
                                {
                                    SetPixel(rawRgba, width, height, cursorX + (col * scale) + dx, startY + (bit * scale) + dy, r, g, b);
                                    if (bold)
                                    {
                                        SetPixel(rawRgba, width, height, cursorX + (col * scale) + dx + 1, startY + (bit * scale) + dy, r, g, b);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            cursorX += ((5 + (bold ? 2 : 1)) * scale);
        }
    }

    private static readonly Dictionary<char, byte[]> Font5x7 = new()
    {
        [' '] = new byte[] { 0x00, 0x00, 0x00, 0x00, 0x00 },
        ['-'] = new byte[] { 0x08, 0x08, 0x08, 0x08, 0x08 },
        [':'] = new byte[] { 0x00, 0x36, 0x36, 0x00, 0x00 },
        ['.'] = new byte[] { 0x00, 0x60, 0x60, 0x00, 0x00 },
        ['/'] = new byte[] { 0x20, 0x10, 0x08, 0x04, 0x02 },
        ['_'] = new byte[] { 0x40, 0x40, 0x40, 0x40, 0x40 },
        ['0'] = new byte[] { 0x3E, 0x51, 0x49, 0x45, 0x3E },
        ['1'] = new byte[] { 0x00, 0x42, 0x7F, 0x40, 0x00 },
        ['2'] = new byte[] { 0x42, 0x61, 0x51, 0x49, 0x46 },
        ['3'] = new byte[] { 0x21, 0x41, 0x45, 0x4B, 0x31 },
        ['4'] = new byte[] { 0x18, 0x14, 0x12, 0x7F, 0x10 },
        ['5'] = new byte[] { 0x27, 0x45, 0x45, 0x45, 0x39 },
        ['6'] = new byte[] { 0x3C, 0x4A, 0x49, 0x49, 0x30 },
        ['7'] = new byte[] { 0x01, 0x71, 0x09, 0x05, 0x03 },
        ['8'] = new byte[] { 0x36, 0x49, 0x49, 0x49, 0x36 },
        ['9'] = new byte[] { 0x06, 0x49, 0x49, 0x29, 0x1E },
        ['A'] = new byte[] { 0x7E, 0x11, 0x11, 0x11, 0x7E },
        ['B'] = new byte[] { 0x7F, 0x49, 0x49, 0x49, 0x36 },
        ['C'] = new byte[] { 0x3E, 0x41, 0x41, 0x41, 0x22 },
        ['D'] = new byte[] { 0x7F, 0x41, 0x41, 0x22, 0x1C },
        ['E'] = new byte[] { 0x7F, 0x49, 0x49, 0x49, 0x41 },
        ['F'] = new byte[] { 0x7F, 0x09, 0x09, 0x09, 0x01 },
        ['G'] = new byte[] { 0x3E, 0x41, 0x49, 0x49, 0x7A },
        ['H'] = new byte[] { 0x7F, 0x08, 0x08, 0x08, 0x7F },
        ['I'] = new byte[] { 0x00, 0x41, 0x7F, 0x41, 0x00 },
        ['J'] = new byte[] { 0x20, 0x40, 0x41, 0x3F, 0x01 },
        ['K'] = new byte[] { 0x7F, 0x08, 0x14, 0x22, 0x41 },
        ['L'] = new byte[] { 0x7F, 0x40, 0x40, 0x40, 0x40 },
        ['M'] = new byte[] { 0x7F, 0x02, 0x0C, 0x02, 0x7F },
        ['N'] = new byte[] { 0x7F, 0x04, 0x08, 0x10, 0x7F },
        ['O'] = new byte[] { 0x3E, 0x41, 0x41, 0x41, 0x3E },
        ['P'] = new byte[] { 0x7F, 0x09, 0x09, 0x09, 0x06 },
        ['Q'] = new byte[] { 0x3E, 0x41, 0x51, 0x21, 0x5E },
        ['R'] = new byte[] { 0x7F, 0x09, 0x19, 0x29, 0x46 },
        ['S'] = new byte[] { 0x46, 0x49, 0x49, 0x49, 0x31 },
        ['T'] = new byte[] { 0x01, 0x01, 0x7F, 0x01, 0x01 },
        ['U'] = new byte[] { 0x3F, 0x40, 0x40, 0x40, 0x3F },
        ['V'] = new byte[] { 0x1F, 0x20, 0x40, 0x20, 0x1F },
        ['W'] = new byte[] { 0x3F, 0x40, 0x38, 0x40, 0x3F },
        ['X'] = new byte[] { 0x63, 0x14, 0x08, 0x14, 0x63 },
        ['Y'] = new byte[] { 0x07, 0x08, 0x70, 0x08, 0x07 },
        ['Z'] = new byte[] { 0x61, 0x51, 0x49, 0x45, 0x43 },
        ['a'] = new byte[] { 0x20, 0x54, 0x54, 0x54, 0x78 },
        ['b'] = new byte[] { 0x7F, 0x48, 0x44, 0x44, 0x38 },
        ['c'] = new byte[] { 0x38, 0x44, 0x44, 0x44, 0x20 },
        ['d'] = new byte[] { 0x38, 0x44, 0x44, 0x48, 0x7F },
        ['e'] = new byte[] { 0x38, 0x54, 0x54, 0x54, 0x18 },
        ['f'] = new byte[] { 0x08, 0x7E, 0x09, 0x01, 0x02 },
        ['g'] = new byte[] { 0x08, 0x14, 0x54, 0x54, 0x3C },
        ['h'] = new byte[] { 0x7F, 0x08, 0x04, 0x04, 0x78 },
        ['i'] = new byte[] { 0x00, 0x44, 0x7D, 0x40, 0x00 },
        ['j'] = new byte[] { 0x20, 0x40, 0x44, 0x3D, 0x00 },
        ['k'] = new byte[] { 0x7F, 0x10, 0x28, 0x44, 0x00 },
        ['l'] = new byte[] { 0x00, 0x41, 0x7F, 0x40, 0x00 },
        ['m'] = new byte[] { 0x7C, 0x04, 0x18, 0x04, 0x78 },
        ['n'] = new byte[] { 0x7C, 0x08, 0x04, 0x04, 0x78 },
        ['o'] = new byte[] { 0x38, 0x44, 0x44, 0x44, 0x38 },
        ['p'] = new byte[] { 0x7C, 0x14, 0x14, 0x14, 0x08 },
        ['q'] = new byte[] { 0x08, 0x14, 0x14, 0x18, 0x7C },
        ['r'] = new byte[] { 0x7C, 0x08, 0x04, 0x04, 0x08 },
        ['s'] = new byte[] { 0x48, 0x54, 0x54, 0x54, 0x20 },
        ['t'] = new byte[] { 0x04, 0x3F, 0x44, 0x40, 0x20 },
        ['u'] = new byte[] { 0x3C, 0x40, 0x40, 0x20, 0x7C },
        ['v'] = new byte[] { 0x1C, 0x20, 0x40, 0x20, 0x1C },
        ['w'] = new byte[] { 0x3C, 0x40, 0x30, 0x40, 0x3C },
        ['x'] = new byte[] { 0x44, 0x28, 0x10, 0x28, 0x44 },
        ['y'] = new byte[] { 0x0C, 0x50, 0x50, 0x50, 0x3C },
        ['z'] = new byte[] { 0x44, 0x64, 0x54, 0x4C, 0x44 }
    };

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
