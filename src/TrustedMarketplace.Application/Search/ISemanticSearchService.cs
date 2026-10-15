namespace TrustedMarketplace.Application.Search;

public interface ISemanticSearchService
{
    /// <summary>
    /// Generates a dense 384-dimensional normalized semantic vector embedding for the given Burmese or English text.
    /// </summary>
    Task<float[]> GenerateEmbeddingAsync(string text, CancellationToken ct = default);

    /// <summary>
    /// Calculates the cosine similarity between two normalized vectors. Range: [-1.0, 1.0], typically [0.0, 1.0].
    /// </summary>
    float CalculateCosineSimilarity(ReadOnlySpan<float> vectorA, ReadOnlySpan<float> vectorB);

    /// <summary>
    /// Computes a SHA-256 hash of the indexed product text (title, description, category) to detect content updates.
    /// </summary>
    string ComputeContentHash(string text);
}
