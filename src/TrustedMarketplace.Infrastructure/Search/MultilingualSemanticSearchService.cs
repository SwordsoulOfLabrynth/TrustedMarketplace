using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;
using TrustedMarketplace.Application.Search;

namespace TrustedMarketplace.Infrastructure.Search;

public class MultilingualSemanticSearchService : ISemanticSearchService
{
    private readonly IEmbeddingProvider? _externalProvider;
    private readonly LocalConceptHashEmbeddingProvider _localProvider;
    private readonly ILogger<MultilingualSemanticSearchService> _logger;

    public string ActiveProviderName => _externalProvider != null ? $"{_externalProvider.ProviderName} (with LocalConceptHash fallback)" : _localProvider.ProviderName;

    public MultilingualSemanticSearchService(
        LocalConceptHashEmbeddingProvider localProvider,
        ILogger<MultilingualSemanticSearchService> logger,
        IEmbeddingProvider? externalProvider = null)
    {
        _localProvider = localProvider;
        _logger = logger;
        _externalProvider = externalProvider;
    }

    public async Task<float[]> GenerateEmbeddingAsync(string text, EmbeddingInputType inputType = EmbeddingInputType.Query, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return new float[_localProvider.Dimension];
        }

        // 1. Try external provider if registered
        if (_externalProvider != null)
        {
            try
            {
                var externalResult = await _externalProvider.GenerateEmbeddingAsync(text, inputType, ct);
                if (externalResult != null && externalResult.Length > 0)
                {
                    return externalResult;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "External embedding provider {Provider} failed. Gracefully falling back to local concept-hash.", _externalProvider.ProviderName);
            }
        }

        // 2. Resilient fallback to local concept-hash embedding provider
        var localResult = await _localProvider.GenerateEmbeddingAsync(text, inputType, ct);
        return localResult ?? new float[_localProvider.Dimension];
    }

    public float CalculateCosineSimilarity(ReadOnlySpan<float> vectorA, ReadOnlySpan<float> vectorB)
    {
        if (vectorA.Length == 0 || vectorB.Length == 0 || vectorA.Length != vectorB.Length)
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
}
