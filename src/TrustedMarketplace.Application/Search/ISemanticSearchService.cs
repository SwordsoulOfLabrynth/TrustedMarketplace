namespace TrustedMarketplace.Application.Search;

public interface ISemanticSearchService
{
    /// <summary>
    /// Generates a dense normalized semantic vector embedding for the given Burmese or English text.
    /// Supports distinguishing between query and passage inputs.
    /// </summary>
    Task<float[]> GenerateEmbeddingAsync(string text, EmbeddingInputType inputType = EmbeddingInputType.Query, CancellationToken ct = default);

    /// <summary>
    /// Calculates the cosine similarity between two normalized vectors. Range: [-1.0, 1.0], typically [0.0, 1.0].
    /// </summary>
    float CalculateCosineSimilarity(ReadOnlySpan<float> vectorA, ReadOnlySpan<float> vectorB);

    /// <summary>
    /// Computes a SHA-256 hash of the indexed product text (title, description, category) to detect content updates.
    /// </summary>
    string ComputeContentHash(string text);

    /// <summary>
    /// Gets the name of the currently active primary embedding provider (e.g., "Nvidia-NIM", "LocalConceptHash").
    /// </summary>
    string ActiveProviderName { get; }
}
