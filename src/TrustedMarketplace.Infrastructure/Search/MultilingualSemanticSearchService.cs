using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using TrustedMarketplace.Application.Search;

namespace TrustedMarketplace.Infrastructure.Search;

public partial class MultilingualSemanticSearchService : ISemanticSearchService
{
    private const int EmbeddingDimension = 384;
    private readonly ILogger<MultilingualSemanticSearchService> _logger;

    // Cross-lingual semantic concept clusters (Burmese <-> English craft/commerce alignment)
    private static readonly Dictionary<string, int> ConceptAnchorIndices = new(StringComparer.OrdinalIgnoreCase)
    {
        // Category 1: Puppetry & Marionettes (ရုပ်သေး)
        ["marionette"] = 0, ["puppet"] = 0, ["puppets"] = 0, ["ရုပ်သေး"] = 0, ["ရုပ်သေးရုပ်"] = 0, ["ကြိုးဆွဲရုပ်"] = 0, ["string"] = 0,
        
        // Category 2: Lacquerware & Bagan crafts (ယွန်းထည်)
        ["lacquerware"] = 1, ["lacquer"] = 1, ["bagan"] = 1, ["ယွန်း"] = 1, ["ယွန်းထည်"] = 1, ["ပုဂံ"] = 1, ["ပုဂံထည်"] = 1,
        
        // Category 3: Textiles, Silk, Lotus, Weaving (အထည်အလိပ် / ပိုးထည်)
        ["silk"] = 2, ["lotus"] = 2, ["textile"] = 2, ["textiles"] = 2, ["handwoven"] = 2, ["weaving"] = 2, ["fabric"] = 2,
        ["ပိုး"] = 2, ["ပိုးထည်"] = 2, ["ကြာပိုး"] = 2, ["ကြာပိုးထည်"] = 2, ["ချည်ထည်"] = 2, ["ပုဆိုး"] = 2, ["လုံချည်"] = 2, ["စလွယ်"] = 2,
        
        // Category 4: Wood Carving & Teak Art (ပန်းပု / သစ်သား)
        ["wood"] = 3, ["wooden"] = 3, ["teak"] = 3, ["teakwood"] = 3, ["carving"] = 3, ["sculpture"] = 3,
        ["သစ်သား"] = 3, ["ကျွန်း"] = 3, ["ကျွန်းသစ်"] = 3, ["ပန်းပု"] = 3, ["သစ်ထွင်း"] = 3,
        
        // Category 5: Jewelry, Jade & Gems (ကျောက်စိမ်း / ရတနာ)
        ["gem"] = 4, ["gemstone"] = 4, ["gems"] = 4, ["jewelry"] = 4, ["jade"] = 4, ["ruby"] = 4, ["sapphire"] = 4, ["silver"] = 4, ["gold"] = 4,
        ["ကျောက်စိမ်း"] = 4, ["ပတ္တမြား"] = 4, ["နီလာ"] = 4, ["ရတနာ"] = 4, ["လက်ဝတ်"] = 4, ["လက်ဝတ်ရတနာ"] = 4, ["ငွေထည်"] = 4, ["ရွှေထည်"] = 4,
        
        // Category 6: Traditional Arts, Heritage & Handmade Crafts (လက်မှု / ရိုးရာ)
        ["artisan"] = 5, ["handmade"] = 5, ["handcrafted"] = 5, ["traditional"] = 5, ["heritage"] = 5, ["antique"] = 5, ["vintage"] = 5, ["authentic"] = 5, ["folk"] = 5,
        ["လက်မှု"] = 5, ["လက်မှုပစ္စည်း"] = 5, ["ရိုးရာ"] = 5, ["ရိုးရာပစ္စည်း"] = 5, ["လက်လုပ်"] = 5, ["အနုပညာ"] = 5, ["ရှေးဟောင်း"] = 5,
        
        // Category 7: Tea, Pickled Leaf & Organic Foods (လက်ဖက် / ရိုးရာအစားအစာ)
        ["tea"] = 6, ["green"] = 6, ["leaf"] = 6, ["fermented"] = 6, ["pickled"] = 6, ["food"] = 6, ["organic"] = 6,
        ["လက်ဖက်"] = 6, ["လက်ဖက်ခြောက်"] = 6, ["အချဉ်"] = 6, ["အစားအစာ"] = 6, ["ရိုးရာအစားအစာ"] = 6,
        
        // Category 8: Basketry, Bamboo & Rattan (ကြိမ် / ဝါး)
        ["bamboo"] = 7, ["rattan"] = 7, ["basket"] = 7, ["woven"] = 7, ["cane"] = 7,
        ["ကြိမ်"] = 7, ["ဝါး"] = 7, ["ခြင်းတောင်း"] = 7, ["ယက်လုပ်"] = 7,
        
        // Category 9: Pottery, Clay & Ceramics (မြေထည် / ကြွေထည်)
        ["pottery"] = 8, ["clay"] = 8, ["ceramic"] = 8, ["ceramics"] = 8, ["terracotta"] = 8, ["vase"] = 8, ["pot"] = 8,
        ["မြေထည်"] = 8, ["မြေအိုး"] = 8, ["ကြွေ"] = 8, ["ကြွေထည်"] = 8,
        
        // Category 10: Tableware, Home & Decor (အိမ်သုံး / အလှဆင်)
        ["bowl"] = 9, ["plate"] = 9, ["tray"] = 9, ["cup"] = 9, ["decor"] = 9, ["decoration"] = 9, ["tableware"] = 9, ["kitchen"] = 9,
        ["ပန်းကန်"] = 9, ["ခွက်"] = 9, ["လင်ပန်း"] = 9, ["အလှဆင်"] = 9, ["အိမ်သုံး"] = 9,
    };

    public MultilingualSemanticSearchService(ILogger<MultilingualSemanticSearchService> logger)
    {
        _logger = logger;
    }

    public Task<float[]> GenerateEmbeddingAsync(string text, CancellationToken ct = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                return Task.FromResult(new float[EmbeddingDimension]);
            }

            // 1. Unicode NFC normalization (essential for Myanmar script diacritics/medials)
            var normalized = text.Trim().Normalize(NormalizationForm.FormC);

            // 2. Tokenize into multilingual subwords and Burmese syllables
            var tokens = Tokenize(normalized);
            if (tokens.Count == 0)
            {
                return Task.FromResult(new float[EmbeddingDimension]);
            }

            // 3. Dense vector projection (384 dimensions)
            var vector = new float[EmbeddingDimension];

            // 3a. Concept Anchor Projection (Dimensions 0 to 95: 10 clusters * 9 dimensions each)
            // 3a. Concept Anchor Projection (Dimensions 0 to 89: 10 clusters * 9 dimensions each)
            var lowerText = normalized.ToLowerInvariant();
            var activatedClusters = new HashSet<int>();
            foreach (var (concept, clusterIdx) in ConceptAnchorIndices)
            {
                if (lowerText.Contains(concept) && activatedClusters.Add(clusterIdx))
                {
                    var baseOffset = clusterIdx * 9;
                    for (var k = 0; k < 9; k++)
                    {
                        var weight = 1.0f / (k + 1);
                        vector[baseOffset + k] += weight * 3.5f;
                    }
                }
            }

            // 3b. Multilingual Subword & Character N-Gram Hashing (Dimensions 96 to 383)
            const int hashOffset = 96;
            const int hashDim = EmbeddingDimension - hashOffset; // 288 dimensions

            foreach (var token in tokens)
            {
                var tokenHash = GetStableHash(token);
                var primaryDim = hashOffset + (int)((uint)tokenHash % (uint)hashDim);
                var sign = (tokenHash & 1) == 0 ? 1.0f : -1.0f;
                vector[primaryDim] += sign * 1.0f;

                // Character 3-grams for morphological variation and typos
                if (token.Length >= 3)
                {
                    for (var i = 0; i <= token.Length - 3; i++)
                    {
                        var gram = token.Substring(i, 3);
                        var gramHash = GetStableHash(gram);
                        var gramDim = hashOffset + (int)((uint)gramHash % (uint)hashDim);
                        var gramSign = (gramHash & 1) == 0 ? 0.4f : -0.4f;
                        vector[gramDim] += gramSign;
                    }
                }
            }

            // 4. L2 Normalization
            L2Normalize(vector);

            return Task.FromResult(vector);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to generate semantic embedding for text '{Text}'. Fallback to zero vector.", text);
            return Task.FromResult(new float[EmbeddingDimension]);
        }
    }

    public float CalculateCosineSimilarity(ReadOnlySpan<float> vectorA, ReadOnlySpan<float> vectorB)
    {
        if (vectorA.Length != vectorB.Length || vectorA.Length == 0)
        {
            return 0f;
        }

        float dot = 0f, magA = 0f, magB = 0f;
        for (var i = 0; i < vectorA.Length; i++)
        {
            var a = vectorA[i];
            var b = vectorB[i];
            dot += a * b;
            magA += a * a;
            magB += b * b;
        }

        var mag = (float)(Math.Sqrt(magA) * Math.Sqrt(magB));
        return mag > 1e-12f ? Math.Clamp(dot / mag, -1f, 1f) : 0f;
    }

    public string ComputeContentHash(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var bytes = Encoding.UTF8.GetBytes(text.Trim().Normalize(NormalizationForm.FormC));
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static void L2Normalize(Span<float> vector)
    {
        float sumSq = 0f;
        foreach (var val in vector)
        {
            sumSq += val * val;
        }

        if (sumSq > 1e-12f)
        {
            var norm = (float)Math.Sqrt(sumSq);
            for (var i = 0; i < vector.Length; i++)
            {
                vector[i] /= norm;
            }
        }
    }

    private static int GetStableHash(string s)
    {
        unchecked
        {
            int hash = 5381;
            foreach (var c in s)
            {
                hash = ((hash << 5) + hash) ^ c;
            }
            return hash;
        }
    }

    private static List<string> Tokenize(string text)
    {
        var tokens = new List<string>();

        // Regex for Latin alphanumeric words
        var words = Regex.Matches(text, @"[\p{L}\p{N}]+");
        foreach (Match match in words)
        {
            var val = match.Value.ToLowerInvariant();
            if (val.Length > 0)
            {
                tokens.Add(val);
            }
        }

        // Segment Burmese script (U+1000 to U+109F)
        var burmeseSegments = BurmeseSyllableRegex().Matches(text);
        foreach (Match match in burmeseSegments)
        {
            if (match.Value.Length > 0)
            {
                tokens.Add(match.Value);
            }
        }

        return tokens;
    }

    // Standard Burmese Syllable Segmenter Pattern (consonant + virama/medials + vowels + asat/killers)
    [GeneratedRegex(@"([\u1000-\u1021\u1023-\u102A\u103F\u1040-\u1049]|[\u104E])([\u103B-\u103E]|[\u1039][\u1000-\u1021])*([\u102B-\u1032\u1036-\u1038])*([\u103A][\u1000-\u1021\u103B-\u103E]*[\u103A]?)*", RegexOptions.Compiled)]
    private static partial Regex BurmeseSyllableRegex();
}
