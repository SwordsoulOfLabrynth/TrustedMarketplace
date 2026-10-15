using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using TrustedMarketplace.Application.Search;

namespace TrustedMarketplace.Infrastructure.Search;

public class NvidiaEmbeddingProvider : IEmbeddingProvider
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<NvidiaEmbeddingProvider> _logger;
    private readonly string _endpoint;
    private readonly string _model;
    private readonly string _apiKey;
    private readonly bool _isEnabled;

    public string ProviderName => $"Nvidia-NIM({_model})";
    public int Dimension { get; private set; } = 1024; // Default dimension for BGE-M3 / Arctic-embed-l

    public NvidiaEmbeddingProvider(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<NvidiaEmbeddingProvider> logger)
    {
        _httpClient = httpClient;
        _logger = logger;

        _endpoint = configuration["Search:Nvidia:Endpoint"] ?? "https://integrate.api.nvidia.com/v1/embeddings";
        _model = configuration["Search:Nvidia:Model"] ?? "baai/bge-m3";

        // Read API key strictly from environment variable or configuration (never hardcoded)
        _apiKey = configuration["Search:Nvidia:ApiKey"] ?? Environment.GetEnvironmentVariable("NVIDIA_API_KEY") ?? string.Empty;

        var configuredEnabled = configuration.GetValue<bool?>("Search:Nvidia:Enabled");
        _isEnabled = configuredEnabled ?? !string.IsNullOrWhiteSpace(_apiKey);

        var timeoutSeconds = configuration.GetValue<int>("Search:Nvidia:TimeoutSeconds", 5);
        _httpClient.Timeout = TimeSpan.FromSeconds(Math.Clamp(timeoutSeconds, 1, 30));
    }

    public async Task<float[]?> GenerateEmbeddingAsync(string text, EmbeddingInputType inputType, CancellationToken ct = default)
    {
        if (!_isEnabled || string.IsNullOrWhiteSpace(_apiKey))
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(text))
        {
            return new float[Dimension];
        }

        try
        {
            var requestBody = new NvidiaEmbeddingRequest
            {
                Model = _model,
                Input = [text.Trim()],
                InputType = inputType == EmbeddingInputType.Passage ? "passage" : "query",
                EncodingFormat = "float"
            };

            var jsonContent = new StringContent(
                JsonSerializer.Serialize(requestBody),
                Encoding.UTF8,
                "application/json");

            using var request = new HttpRequestMessage(HttpMethod.Post, _endpoint);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            request.Content = jsonContent;

            using var response = await _httpClient.SendAsync(request, ct);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(ct);
                // Sanitize error: never log headers or authorization credentials
                var safeDetail = TruncateSafe(errorBody, 200);
                _logger.LogWarning(
                    "NVIDIA NIM embedding call failed with HTTP {StatusCode} for model {Model}. Detail: {Detail}. Failing over to local embedding provider.",
                    (int)response.StatusCode,
                    _model,
                    safeDetail);
                return null;
            }

            var responseStream = await response.Content.ReadAsStreamAsync(ct);
            var result = await JsonSerializer.DeserializeAsync<NvidiaEmbeddingResponse>(responseStream, cancellationToken: ct);

            if (result?.Data != null && result.Data.Count > 0 && result.Data[0].Embedding.Count > 0)
            {
                var vector = result.Data[0].Embedding.ToArray();
                Dimension = vector.Length;
                return vector;
            }

            _logger.LogWarning("NVIDIA NIM response returned empty embedding vector for model {Model}. Falling back to local provider.", _model);
            return null;
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            _logger.LogWarning("NVIDIA NIM embedding request timed out. Failing over to local embedding provider.");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Exception calling NVIDIA NIM embedding endpoint for model {Model}. Failing over to local provider.", _model);
            return null;
        }
    }

    private static string TruncateSafe(string text, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var sanitized = text.Replace("\r", " ").Replace("\n", " ");
        return sanitized.Length <= maxLength ? sanitized : sanitized[..maxLength] + "...";
    }

    private sealed class NvidiaEmbeddingRequest
    {
        [JsonPropertyName("model")]
        public required string Model { get; init; }

        [JsonPropertyName("input")]
        public required List<string> Input { get; init; }

        [JsonPropertyName("input_type")]
        public string InputType { get; init; } = "query";

        [JsonPropertyName("encoding_format")]
        public string EncodingFormat { get; init; } = "float";
    }

    private sealed class NvidiaEmbeddingResponse
    {
        [JsonPropertyName("data")]
        public List<NvidiaEmbeddingDataItem> Data { get; init; } = [];

        [JsonPropertyName("model")]
        public string? Model { get; init; }
    }

    private sealed class NvidiaEmbeddingDataItem
    {
        [JsonPropertyName("embedding")]
        public List<float> Embedding { get; init; } = [];

        [JsonPropertyName("index")]
        public int Index { get; init; }
    }
}
