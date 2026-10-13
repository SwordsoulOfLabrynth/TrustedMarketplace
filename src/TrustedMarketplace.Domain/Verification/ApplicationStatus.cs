namespace TrustedMarketplace.Domain.Verification;

public enum ApplicationStatus
{
    Pending = 0,
    MoreInformationRequired = 1,
    Approved = 2,
    Rejected = 3,
    Suspended = 4
}
