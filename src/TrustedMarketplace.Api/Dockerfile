# Multi-stage Dockerfile for TrustedMarketplace ASP.NET Core API (.NET 10)
# Pinned to exact GA release to match local SDK 10.0.401
FROM mcr.microsoft.com/dotnet/sdk:10.0.401-noble AS build
WORKDIR /src

# Copy csproj files for layer caching
COPY ["src/TrustedMarketplace.Domain/TrustedMarketplace.Domain.csproj", "src/TrustedMarketplace.Domain/"]
COPY ["src/TrustedMarketplace.Application/TrustedMarketplace.Application.csproj", "src/TrustedMarketplace.Application/"]
COPY ["src/TrustedMarketplace.Infrastructure/TrustedMarketplace.Infrastructure.csproj", "src/TrustedMarketplace.Infrastructure/"]
COPY ["src/TrustedMarketplace.Api/TrustedMarketplace.Api.csproj", "src/TrustedMarketplace.Api/"]

RUN dotnet restore "src/TrustedMarketplace.Api/TrustedMarketplace.Api.csproj"

# Copy full source tree and publish
COPY src/ src/
WORKDIR "/src/src/TrustedMarketplace.Api"
RUN dotnet publish "TrustedMarketplace.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Production runtime image — pinned to match SDK 10.0.401
FROM mcr.microsoft.com/dotnet/aspnet:10.0.10-noble AS runtime
WORKDIR /app

# Install curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Create directories for local private evidence and public media
RUN mkdir -p /app/storage/private_evidence /app/storage/public_media && \
    chown -R app:app /app/storage

USER app

COPY --from=build --chown=app:app /app/publish .

ENV ASPNETCORE_HTTP_PORTS=8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENV Storage__LocalPrivateRoot=/app/storage/private_evidence
ENV Storage__LocalPublicRoot=/app/storage/public_media

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/api/v1/health || exit 1

ENTRYPOINT ["dotnet", "TrustedMarketplace.Api.dll"]
