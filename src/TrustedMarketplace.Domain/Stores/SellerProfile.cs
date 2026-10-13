using System.Text.RegularExpressions;
using TrustedMarketplace.Domain.Common;
using TrustedMarketplace.Domain.Common.Exceptions;

namespace TrustedMarketplace.Domain.Stores;

public class SellerProfile : BaseEntity
{
    public Guid SellerUserId { get; private set; }
    public string StoreName { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public string? Bio { get; private set; }
    public string ContactPhone { get; private set; } = string.Empty;
    public string? CityOrTownship { get; private set; }
    public string? LogoStorageKey { get; private set; }
    public SellerVerificationStatus VerificationStatus { get; private set; } = SellerVerificationStatus.Verified;

    private SellerProfile() : base() { }

    public SellerProfile(
        Guid sellerUserId,
        string storeName,
        string contactPhone,
        string? bio = null,
        string? cityOrTownship = null) : base()
    {
        if (sellerUserId == Guid.Empty)
            throw new ArgumentException("Seller user ID cannot be empty.", nameof(sellerUserId));

        if (string.IsNullOrWhiteSpace(storeName))
            throw new ArgumentException("Store name cannot be empty.", nameof(storeName));

        if (storeName.Length > 100)
            throw new ArgumentException("Store name cannot exceed 100 characters.", nameof(storeName));

        if (string.IsNullOrWhiteSpace(contactPhone))
            throw new ArgumentException("Contact phone cannot be empty.", nameof(contactPhone));

        if (contactPhone.Length > 30)
            throw new ArgumentException("Contact phone cannot exceed 30 characters.", nameof(contactPhone));

        SellerUserId = sellerUserId;
        StoreName = storeName.Trim();
        Slug = GenerateSlug(StoreName);
        ContactPhone = contactPhone.Trim();
        Bio = bio?.Trim();
        CityOrTownship = cityOrTownship?.Trim();
        VerificationStatus = SellerVerificationStatus.Verified;
    }

    /// <summary>
    /// Updates store profile details.
    /// If StoreName is modified, VerificationStatus automatically reverts to PendingReverification (SEC-04).
    /// </summary>
    public bool UpdateProfile(
        string newStoreName,
        string? newBio,
        string newContactPhone,
        string? newCityOrTownship)
    {
        if (string.IsNullOrWhiteSpace(newStoreName))
            throw new DomainException("Store name cannot be empty.");

        if (newStoreName.Length > 100)
            throw new DomainException("Store name cannot exceed 100 characters.");

        if (string.IsNullOrWhiteSpace(newContactPhone))
            throw new DomainException("Contact phone cannot be empty.");

        if (newContactPhone.Length > 30)
            throw new DomainException("Contact phone cannot exceed 30 characters.");

        var trimmedName = newStoreName.Trim();
        var storeNameChanged = !string.Equals(StoreName, trimmedName, StringComparison.OrdinalIgnoreCase);

        StoreName = trimmedName;
        if (storeNameChanged)
        {
            Slug = GenerateSlug(StoreName);
            VerificationStatus = SellerVerificationStatus.PendingReverification;
        }

        Bio = newBio?.Trim();
        ContactPhone = newContactPhone.Trim();
        CityOrTownship = newCityOrTownship?.Trim();

        return storeNameChanged;
    }

    public void MarkVerified()
    {
        VerificationStatus = SellerVerificationStatus.Verified;
    }

    public static string GenerateSlug(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return Guid.NewGuid().ToString("N")[..8];

        var str = text.ToLowerInvariant();
        // Replace invalid chars with hyphen
        str = Regex.Replace(str, @"[^a-z0-9\s-]", "");
        // Convert multiple spaces/hyphens into single space
        str = Regex.Replace(str, @"\s+", " ").Trim();
        // Replace spaces with hyphens
        str = Regex.Replace(str, @"\s", "-");

        return string.IsNullOrWhiteSpace(str) ? Guid.NewGuid().ToString("N")[..8] : str;
    }
}
