using System.Text;
using QRCoder;
using TrustedMarketplace.Domain.Credentials;

namespace TrustedMarketplace.Infrastructure.Credentials;

public static class CertificatePdfGenerator
{
    private const string Disclaimer =
        "MatchGuard has verified the identity of this seller based on its verification process. This certificate does not guarantee product quality, product authenticity, legal compliance, seller conduct, or the safety of any transaction.";

    public static byte[] Generate(
        string publicCredentialId,
        string sellerDisplayName,
        string storeName,
        DateTime issuedAtUtc,
        CredentialStatus status,
        string publicVerificationUrl)
    {
        var sb = new StringBuilder();

        // 1. Setup page dimensions: A4 Portrait (595.28 x 841.89 points)
        const double pageWidth = 595.28;
        const double pageHeight = 841.89;

        // Background warm cream
        sb.AppendLine("q");
        sb.AppendLine("0.984 0.976 0.961 rg"); // #FAF8F5
        sb.AppendLine($"0 0 {pageWidth:F2} {pageHeight:F2} re f");
        sb.AppendLine("Q");

        // Outer ornamental border (Forest Green)
        sb.AppendLine("q");
        sb.AppendLine("2.5 w");
        sb.AppendLine("0.075 0.243 0.176 RG"); // #133E2D
        sb.AppendLine($"28 28 {pageWidth - 56:F2} {pageHeight - 56:F2} re S");
        sb.AppendLine("Q");

        // Inner ornamental border (MatchGuard Gold)
        sb.AppendLine("q");
        sb.AppendLine("1.0 w");
        sb.AppendLine("0.698 0.522 0.267 RG"); // #B28544
        sb.AppendLine($"34 34 {pageWidth - 68:F2} {pageHeight - 68:F2} re S");
        sb.AppendLine("Q");

        // Corner accents
        DrawCornerAccents(sb, 34, 34, pageWidth - 34, pageHeight - 34);

        // Header Shield Icon (Drawn in vector coordinates)
        DrawMatchGuardShield(sb, pageWidth / 2, 755, 24);

        // Header Brand Text
        DrawCenteredText(sb, "MATCHGUARD", pageWidth / 2, 715, "F2", 18, 0.075, 0.243, 0.176);
        DrawCenteredText(sb, "OFFICIAL IDENTITY VERIFICATION AUTHORITY", pageWidth / 2, 700, "F1", 8.5, 0.698, 0.522, 0.267);

        // Gold decorative line below header
        sb.AppendLine("q");
        sb.AppendLine("1.0 w");
        sb.AppendLine("0.698 0.522 0.267 RG");
        sb.AppendLine($"160 686 m {pageWidth - 160:F2} 686 l S");
        sb.AppendLine("Q");

        // Certificate Titles
        DrawCenteredText(sb, "CERTIFICATE OF IDENTITY VERIFICATION", pageWidth / 2, 655, "F2", 13, 0.698, 0.522, 0.267);
        DrawCenteredText(sb, "IDENTITY-VERIFIED SELLER", pageWidth / 2, 626, "F2", 24, 0.075, 0.243, 0.176);

        // Confirmation Statement
        DrawCenteredText(sb, "This official credential confirms that MatchGuard has reviewed and verified the", pageWidth / 2, 585, "F1", 10.5, 0.25, 0.28, 0.32);
        DrawCenteredText(sb, "identity documentation and verified store registration of the artisan seller:", pageWidth / 2, 570, "F1", 10.5, 0.25, 0.28, 0.32);

        // Seller Display Name & Store Box
        sb.AppendLine("q");
        sb.AppendLine("0.965 0.953 0.933 rg");
        sb.AppendLine($"80 488 {pageWidth - 160:F2} 64 re f");
        sb.AppendLine("0.5 w 0.85 0.80 0.72 RG");
        sb.AppendLine($"80 488 {pageWidth - 160:F2} 64 re S");
        sb.AppendLine("Q");

        var cleanSellerName = SanitizeForPdf(sellerDisplayName);
        var cleanStoreName = SanitizeForPdf(storeName);

        DrawCenteredText(sb, cleanSellerName, pageWidth / 2, 526, "F2", 18, 0.075, 0.243, 0.176);
        DrawCenteredText(sb, $"Store: {cleanStoreName}", pageWidth / 2, 502, "F1", 11, 0.40, 0.35, 0.28);

        // Credential Metadata Cards
        DrawMetadataBlock(sb, publicCredentialId, issuedAtUtc, status, pageWidth);

        // Vector QR Code & Verification URL
        DrawVectorQrCode(sb, publicVerificationUrl, pageWidth / 2, 275, 110);

        DrawCenteredText(sb, "Scan QR code or visit the public link below to verify current status:", pageWidth / 2, 205, "F1", 9, 0.35, 0.38, 0.42);
        DrawCenteredText(sb, publicVerificationUrl, pageWidth / 2, 192, "F2", 9.5, 0.075, 0.243, 0.176);

        // Verification Scope Disclaimer Box (T-01, T-03)
        sb.AppendLine("q");
        sb.AppendLine("0.95 0.96 0.95 rg"); // subtle soft green
        sb.AppendLine($"55 88 {pageWidth - 110:F2} 78 re f");
        sb.AppendLine("0.5 w 0.75 0.82 0.76 RG");
        sb.AppendLine($"55 88 {pageWidth - 110:F2} 78 re S");
        sb.AppendLine("Q");

        DrawCenteredText(sb, "VERIFICATION SCOPE & LIMITATIONS", pageWidth / 2, 150, "F2", 8.5, 0.075, 0.243, 0.176);

        var disclaimerLine1 = "MatchGuard has verified the identity of this seller based on its verification process. This certificate";
        var disclaimerLine2 = "does not guarantee product quality, product authenticity, legal compliance, seller conduct,";
        var disclaimerLine3 = "or the safety of any transaction.";

        DrawCenteredText(sb, disclaimerLine1, pageWidth / 2, 134, "F1", 8, 0.30, 0.33, 0.37);
        DrawCenteredText(sb, disclaimerLine2, pageWidth / 2, 122, "F1", 8, 0.30, 0.33, 0.37);
        DrawCenteredText(sb, disclaimerLine3, pageWidth / 2, 110, "F1", 8, 0.30, 0.33, 0.37);

        // Bottom Footer
        DrawCenteredText(sb, $"MatchGuard Security Operations · Credential {publicCredentialId} · Issued {issuedAtUtc:yyyy-MM-dd HH:mm} UTC", pageWidth / 2, 50, "F1", 7.5, 0.50, 0.53, 0.57);

        var contentBytes = Encoding.ASCII.GetBytes(sb.ToString());

        // Assemble Standard PDF Document
        return BuildPdf(pageWidth, pageHeight, contentBytes);
    }

    private static void DrawCornerAccents(StringBuilder sb, double x1, double y1, double x2, double y2)
    {
        sb.AppendLine("q");
        sb.AppendLine("1.5 w 0.698 0.522 0.267 RG");
        // Top-left
        sb.AppendLine($"{x1} {y2 - 16:F2} m {x1} {y2:F2} l {x1 + 16:F2} {y2:F2} l S");
        // Top-right
        sb.AppendLine($"{x2 - 16:F2} {y2:F2} m {x2} {y2:F2} l {x2} {y2 - 16:F2} l S");
        // Bottom-left
        sb.AppendLine($"{x1} {y1 + 16:F2} m {x1} {y1:F2} l {x1 + 16:F2} {y1:F2} l S");
        // Bottom-right
        sb.AppendLine($"{x2 - 16:F2} {y1:F2} m {x2} {y1:F2} l {x2} {y1 + 16:F2} l S");
        sb.AppendLine("Q");
    }

    private static void DrawMatchGuardShield(StringBuilder sb, double cx, double cy, double radius)
    {
        sb.AppendLine("q");
        // Left half shield (Forest Green)
        sb.AppendLine("0.075 0.243 0.176 rg");
        sb.AppendLine($"{cx:F2} {cy + radius:F2} m");
        sb.AppendLine($"{cx - radius:F2} {cy + radius * 0.5:F2} l");
        sb.AppendLine($"{cx - radius * 0.85:F2} {cy - radius * 0.3:F2} l");
        sb.AppendLine($"{cx:F2} {cy - radius:F2} l");
        sb.AppendLine($"{cx:F2} {cy + radius:F2} l f");

        // Right half shield (Lighter Forest Green)
        sb.AppendLine("0.137 0.412 0.310 rg");
        sb.AppendLine($"{cx:F2} {cy + radius:F2} m");
        sb.AppendLine($"{cx + radius:F2} {cy + radius * 0.5:F2} l");
        sb.AppendLine($"{cx + radius * 0.85:F2} {cy - radius * 0.3:F2} l");
        sb.AppendLine($"{cx:F2} {cy - radius:F2} l");
        sb.AppendLine($"{cx:F2} {cy + radius:F2} l f");

        // Central Gold Emblem Check
        sb.AppendLine("1.8 w 0.698 0.522 0.267 RG");
        sb.AppendLine($"{cx - 7:F2} {cy:F2} m {cx - 2:F2} {cy - 5:F2} l {cx + 8:F2} {cy + 6:F2} l S");
        sb.AppendLine("Q");
    }

    private static void DrawMetadataBlock(StringBuilder sb, string credentialId, DateTime issuedAtUtc, CredentialStatus status, double pageWidth)
    {
        var boxWidth = 135.0;
        var boxHeight = 44.0;
        var spacing = 14.0;
        var totalWidth = (boxWidth * 3) + (spacing * 2);
        var startX = (pageWidth - totalWidth) / 2.0;
        var y = 425.0;

        // Box 1: Credential ID
        DrawMetaCard(sb, startX, y, boxWidth, boxHeight, "CREDENTIAL ID", credentialId, "F2", 9, 0.075, 0.243, 0.176);

        // Box 2: Issue Date (UTC)
        var dateStr = issuedAtUtc.ToString("MMMM dd, yyyy");
        DrawMetaCard(sb, startX + boxWidth + spacing, y, boxWidth, boxHeight, "ISSUE DATE (UTC)", dateStr, "F2", 9, 0.075, 0.243, 0.176);

        // Box 3: Verification Status
        var statusStr = status == CredentialStatus.Active ? "ACTIVE · VERIFIED" : status.ToString().ToUpperInvariant();
        var statusColor = status == CredentialStatus.Active ? (0.075, 0.50, 0.25) : (0.75, 0.15, 0.15);
        DrawMetaCard(sb, startX + (boxWidth + spacing) * 2, y, boxWidth, boxHeight, "STATUS", statusStr, "F2", 9, statusColor.Item1, statusColor.Item2, statusColor.Item3);
    }

    private static void DrawMetaCard(
        StringBuilder sb,
        double x,
        double y,
        double w,
        double h,
        string label,
        string val,
        string font,
        double fontSize,
        double r,
        double g,
        double b)
    {
        sb.AppendLine("q");
        sb.AppendLine("1.0 1.0 1.0 rg");
        sb.AppendLine($"{x:F2} {y:F2} {w:F2} {h:F2} re f");
        sb.AppendLine("0.5 w 0.85 0.85 0.85 RG");
        sb.AppendLine($"{x:F2} {y:F2} {w:F2} {h:F2} re S");
        sb.AppendLine("Q");

        var cx = x + (w / 2.0);
        DrawCenteredText(sb, label, cx, y + h - 14, "F1", 7.5, 0.55, 0.55, 0.55);
        DrawCenteredText(sb, val, cx, y + 12, font, fontSize, r, g, b);
    }

    private static void DrawVectorQrCode(StringBuilder sb, string url, double centerX, double centerY, double size)
    {
        using var generator = new QRCodeGenerator();
        using var qrCodeData = generator.CreateQrCode(url, QRCodeGenerator.ECCLevel.M);

        var matrix = qrCodeData.ModuleMatrix;
        var count = matrix.Count;
        if (count == 0) return;

        var moduleSize = size / count;
        var startX = centerX - (size / 2.0);
        var startY = centerY - (size / 2.0);

        // White background for QR code
        sb.AppendLine("q");
        sb.AppendLine("1.0 1.0 1.0 rg");
        sb.AppendLine($"{startX - 6:F2} {startY - 6:F2} {size + 12:F2} {size + 12:F2} re f");
        sb.AppendLine("0.5 w 0.85 0.85 0.85 RG");
        sb.AppendLine($"{startX - 6:F2} {startY - 6:F2} {size + 12:F2} {size + 12:F2} re S");

        // QR Code vector modules (drawn in Forest Green #133E2D)
        sb.AppendLine("0.075 0.243 0.176 rg");
        for (var row = 0; row < count; row++)
        {
            var bitArray = matrix[row];
            var y = startY + ((count - 1 - row) * moduleSize);

            for (var col = 0; col < count; col++)
            {
                if (bitArray[col])
                {
                    var x = startX + (col * moduleSize);
                    sb.AppendLine($"{x:F2} {y:F2} {moduleSize:F2} {moduleSize:F2} re f");
                }
            }
        }
        sb.AppendLine("Q");
    }

    private static void DrawCenteredText(
        StringBuilder sb,
        string text,
        double cx,
        double y,
        string font,
        double fontSize,
        double r,
        double g,
        double b)
    {
        var escaped = EscapePdfString(text);
        // Approximate width: standard characters average ~0.55 of font size
        var estimatedWidth = text.Length * fontSize * 0.52;
        var x = cx - (estimatedWidth / 2.0);

        sb.AppendLine("BT");
        sb.AppendLine($"/{font} {fontSize:F1} Tf");
        sb.AppendLine($"{r:F3} {g:F3} {b:F3} rg");
        sb.AppendLine($"{x:F2} {y:F2} Td");
        sb.AppendLine($"({escaped}) Tj");
        sb.AppendLine("ET");
    }

    private static string SanitizeForPdf(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var clean = text.Trim();
        // Keep within printable ASCII for Standard 14 Helvetica fonts
        var sb = new StringBuilder();
        foreach (var ch in clean)
        {
            if (ch >= 32 && ch <= 126)
            {
                sb.Append(ch);
            }
            else
            {
                sb.Append(' ');
            }
        }
        return sb.ToString();
    }

    private static string EscapePdfString(string text)
    {
        return text
            .Replace("\\", "\\\\")
            .Replace("(", "\\(")
            .Replace(")", "\\)");
    }

    private static byte[] BuildPdf(double width, double height, byte[] contentBytes)
    {
        using var ms = new MemoryStream();
        using var writer = new StreamWriter(ms, Encoding.ASCII);

        var offsets = new List<long>();

        // Header
        writer.Write("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
        writer.Flush();

        // 1: Catalog
        offsets.Add(ms.Position);
        writer.Write("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
        writer.Flush();

        // 2: Pages
        offsets.Add(ms.Position);
        writer.Write("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
        writer.Flush();

        // 3: Page
        offsets.Add(ms.Position);
        writer.Write($"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width:F2} {height:F2}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n");
        writer.Flush();

        // 4: Content Stream
        offsets.Add(ms.Position);
        writer.Write($"4 0 obj\n<< /Length {contentBytes.Length} >>\nstream\n");
        writer.Flush();
        ms.Write(contentBytes, 0, contentBytes.Length);
        writer.Write("\nendstream\nendobj\n");
        writer.Flush();

        // 5: Font F1 (Helvetica)
        offsets.Add(ms.Position);
        writer.Write("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n");
        writer.Flush();

        // 6: Font F2 (Helvetica-Bold)
        offsets.Add(ms.Position);
        writer.Write("6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n");
        writer.Flush();

        // Cross-Reference Table
        var xrefOffset = ms.Position;
        writer.Write($"xref\n0 {offsets.Count + 1}\n");
        writer.Write("0000000000 65535 f \n");
        foreach (var offset in offsets)
        {
            writer.Write($"{offset:D10} 00000 n \n");
        }

        // Trailer
        writer.Write($"trailer\n<< /Size {offsets.Count + 1} /Root 1 0 R >>\nstartxref\n{xrefOffset}\n%%EOF\n");
        writer.Flush();

        return ms.ToArray();
    }
}
