namespace TrustedMarketplace.Application.Search;

public enum EmbeddingInputType
{
    Query,
    Passage
}

public interface IEmbeddingProvider
{
    string ProviderName { get; }
    int Dimension { get; }
    Task<float[]?> GenerateEmbeddingAsync(string text, EmbeddingInputType inputType, CancellationToken ct = default);
}
