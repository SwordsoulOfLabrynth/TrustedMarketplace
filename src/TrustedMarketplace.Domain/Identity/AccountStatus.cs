namespace TrustedMarketplace.Domain.Identity;

/// <summary>
/// Represents the account standing of a user in the marketplace.
/// Suspended or Closed accounts are restricted from state-mutating actions.
/// </summary>
public enum AccountStatus
{
    Active = 1,
    Suspended = 2,
    Closed = 3
}
