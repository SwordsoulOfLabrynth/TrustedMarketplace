using Microsoft.Extensions.Logging.Abstractions;
using TrustedMarketplace.Infrastructure.Search;
using Xunit;

namespace TrustedMarketplace.UnitTests.Search;

public class SemanticSearchTests
{
    private readonly MultilingualSemanticSearchService _service;

    public SemanticSearchTests()
    {
        _service = new MultilingualSemanticSearchService(NullLogger<MultilingualSemanticSearchService>.Instance);
    }

    [Fact]
    public async Task GenerateEmbedding_ReturnsNormalized384DimensionalVector()
    {
        var text = "Handmade Bagan Lacquerware Box";
        var embedding = await _service.GenerateEmbeddingAsync(text);

        Assert.NotNull(embedding);
        Assert.Equal(384, embedding.Length);

        // Vector should be L2-normalized: sum of squares ≈ 1.0
        float sumSq = 0f;
        foreach (var val in embedding)
        {
            sumSq += val * val;
        }
        Assert.InRange(sumSq, 0.98f, 1.02f);
    }

    [Fact]
    public async Task GenerateEmbedding_EmptyString_ReturnsZeroVector()
    {
        var embedding = await _service.GenerateEmbeddingAsync("   ");
        Assert.NotNull(embedding);
        Assert.Equal(384, embedding.Length);
        Assert.All(embedding, val => Assert.Equal(0f, val));
    }

    [Fact]
    public async Task CrossLingualSemanticMatch_BurmesePuppetQuery_MatchesEnglishMarionetteProduct()
    {
        // Burmese query for marionette puppet: "ရုပ်သေး" or "ရိုးရာလက်လုပ်ရုပ်သေး"
        var queryVec = await _service.GenerateEmbeddingAsync("ရိုးရာလက်လုပ် ရုပ်သေး");

        // Target product (English title & description)
        var puppetProductVec = await _service.GenerateEmbeddingAsync("Traditional Teakwood Marionette Puppet Handmade Bagan Puppetry");

        // Unrelated product
        var unrelatedProductVec = await _service.GenerateEmbeddingAsync("Organic Green Tea Leaf from Shan Highlands");

        var puppetSimilarity = _service.CalculateCosineSimilarity(queryVec, puppetProductVec);
        var unrelatedSimilarity = _service.CalculateCosineSimilarity(queryVec, unrelatedProductVec);

        Assert.True(puppetSimilarity > 0.40f, $"Puppet similarity was {puppetSimilarity}, expected > 0.40");
        Assert.True(puppetSimilarity > unrelatedSimilarity + 0.20f,
            $"Expected puppet ({puppetSimilarity}) to be significantly higher than unrelated ({unrelatedSimilarity})");
    }

    [Fact]
    public async Task CrossLingualSemanticMatch_BurmeseLacquerwareQuery_MatchesEnglishLacquerwareProduct()
    {
        // Burmese query for lacquerware: "ပုဂံ ယွန်းထည် ပန်းကန်"
        var queryVec = await _service.GenerateEmbeddingAsync("ပုဂံ ယွန်းထည် ပန်းကန်");

        // Lacquerware product
        var lacquerwareVec = await _service.GenerateEmbeddingAsync("Authentic Bagan Lacquerware Serving Bowl Tableware");

        // Unrelated product
        var puppetVec = await _service.GenerateEmbeddingAsync("Handmade Teak Marionette Puppet");

        var lacquerSimilarity = _service.CalculateCosineSimilarity(queryVec, lacquerwareVec);
        var puppetSimilarity = _service.CalculateCosineSimilarity(queryVec, puppetVec);

        Assert.True(lacquerSimilarity > 0.40f, $"Lacquerware similarity was {lacquerSimilarity}, expected > 0.40");
        Assert.True(lacquerSimilarity > puppetSimilarity,
            $"Lacquerware ({lacquerSimilarity}) should score higher than puppet ({puppetSimilarity}) for lacquerware query");
    }

    [Fact]
    public async Task CrossLingualSemanticMatch_EnglishQuery_MatchesBurmeseCraftDescription()
    {
        // English query: "traditional handmade silk scarf"
        var queryVec = await _service.GenerateEmbeddingAsync("traditional handmade silk scarf");

        // Burmese product: "ရိုးရာ လက်လုပ် ပိုးထည် ပုဆိုး"
        var burmeseSilkVec = await _service.GenerateEmbeddingAsync("ရိုးရာ လက်လုပ် ပိုးထည် ပုဆိုး");

        // Unrelated product: "ကျွန်းသစ် ပန်းပု ရုပ်တု" (teak wood carving)
        var burmeseWoodVec = await _service.GenerateEmbeddingAsync("ကျွန်းသစ် ပန်းပု ရုပ်တု");

        var silkSim = _service.CalculateCosineSimilarity(queryVec, burmeseSilkVec);
        var woodSim = _service.CalculateCosineSimilarity(queryVec, burmeseWoodVec);

        Assert.True(silkSim > 0.35f, $"Silk similarity was {silkSim}, expected > 0.35");
        Assert.True(silkSim > woodSim, $"Silk ({silkSim}) should score higher than wood ({woodSim}) for silk query");
    }

    [Fact]
    public async Task UnicodeNfcNormalization_HandlesBurmeseVariationsConsistently()
    {
        // Two strings representing identical semantic text with different decomposed Unicode representations
        var text1 = "ပုဂံယွန်းထည်";
        var text2 = "ပုဂံယွန်းထည်".Normalize(System.Text.NormalizationForm.FormD);

        var vec1 = await _service.GenerateEmbeddingAsync(text1);
        var vec2 = await _service.GenerateEmbeddingAsync(text2);

        var similarity = _service.CalculateCosineSimilarity(vec1, vec2);
        Assert.True(similarity > 0.99f, $"Expected similarity > 0.99 for normalized text, got {similarity}");
    }

    [Fact]
    public void ComputeContentHash_ReturnsConsistentSha256()
    {
        var text = "Handmade Mandalay Marionette";
        var hash1 = _service.ComputeContentHash(text);
        var hash2 = _service.ComputeContentHash(text);
        var hashDifferent = _service.ComputeContentHash(text + " Edited");

        Assert.NotEmpty(hash1);
        Assert.Equal(hash1, hash2);
        Assert.NotEqual(hash1, hashDifferent);
    }
}
