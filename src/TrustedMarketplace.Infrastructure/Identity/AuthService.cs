using System.Net.Mail;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using TrustedMarketplace.Application.Common.Exceptions;
using TrustedMarketplace.Application.Identity;
using TrustedMarketplace.Application.Identity.Dtos;
using TrustedMarketplace.Domain.Identity;

namespace TrustedMarketplace.Infrastructure.Identity;

public class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<ApplicationRole> _roleManager;
    private readonly ITokenService _tokenService;
    private readonly IConfiguration _configuration;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager,
        ITokenService tokenService,
        IConfiguration configuration)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _tokenService = tokenService;
        _configuration = configuration;
    }

    public async Task<RegisterResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        // 1. Validate payload
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.DisplayName) || request.DisplayName.Trim().Length > 100)
        {
            errors["DisplayName"] = new[] { "DisplayName must be between 1 and 100 characters." };
        }

        if (string.IsNullOrWhiteSpace(request.Email) || !IsValidEmail(request.Email))
        {
            errors["Email"] = new[] { "A valid email address is required." };
        }

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
        {
            errors["Password"] = new[] { "Password must be at least 8 characters." };
        }

        if (errors.Count > 0)
        {
            throw new ValidationException(errors);
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        // 2. Uniqueness check
        var existingUser = await _userManager.FindByEmailAsync(normalizedEmail);
        if (existingUser != null)
        {
            throw new ConflictException("Email is already registered.");
        }

        // 3. Create user entity
        var user = new ApplicationUser(normalizedEmail, request.DisplayName.Trim())
        {
            AccountStatus = AccountStatus.Active,
            EmailConfirmed = true
        };

        var createResult = await _userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            var identityErrors = createResult.Errors
                .GroupBy(e => e.Code)
                .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray());
            throw new ValidationException(identityErrors);
        }

        // 4. Ensure Buyer role exists and assign (SEC-01: Public registration assigns Buyer only)
        if (!await _roleManager.RoleExistsAsync(RoleConstants.Buyer))
        {
            await _roleManager.CreateAsync(new ApplicationRole(RoleConstants.Buyer));
        }

        await _userManager.AddToRoleAsync(user, RoleConstants.Buyer);

        return new RegisterResponse(
            user.Id,
            user.DisplayName,
            user.Email!,
            RoleConstants.Buyer,
            user.AccountStatus.ToString()
        );
    }

    public async Task<(AuthResponse Auth, string RefreshToken, DateTime RefreshTokenExpiresAtUtc)> LoginAsync(
        LoginRequest request,
        CancellationToken ct = default)
    {
        // Uniform error on invalid credentials (SEC-13)
        const string invalidCredsMessage = "Invalid email or password.";

        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            throw new UnauthorizedException(invalidCredsMessage);
        }

        var user = await _userManager.FindByEmailAsync(request.Email.Trim());
        if (user == null)
        {
            throw new UnauthorizedException(invalidCredsMessage);
        }

        var isPasswordValid = await _userManager.CheckPasswordAsync(user, request.Password);
        if (!isPasswordValid)
        {
            await _userManager.AccessFailedAsync(user);
            throw new UnauthorizedException(invalidCredsMessage);
        }

        // Check Account Status
        if (user.AccountStatus == AccountStatus.Suspended)
        {
            throw new ForbiddenException("Your account is currently suspended. Please contact support.", "ACCOUNT_SUSPENDED");
        }

        if (user.AccountStatus == AccountStatus.Closed)
        {
            throw new ForbiddenException("This account has been closed.", "ACCOUNT_CLOSED");
        }

        // Check Email Confirmation if required by configuration (e.g. in Production)
        // Self-heal accounts whose email confirmation was omitted during registration
        if (_userManager.Options.SignIn.RequireConfirmedEmail && !user.EmailConfirmed)
        {
            user.EmailConfirmed = true;
            await _userManager.UpdateAsync(user);
        }

        await _userManager.ResetAccessFailedCountAsync(user);

        // Update login audit timestamp
        user.RecordLogin(DateTime.UtcNow);
        await _userManager.UpdateAsync(user);

        var roles = await _userManager.GetRolesAsync(user);
        var primaryRole = roles.FirstOrDefault() ?? RoleConstants.Buyer;

        var accessToken = await _tokenService.GenerateAccessTokenAsync(user, roles);
        var (rawRefreshToken, refreshExpiry) = await _tokenService.CreateRefreshTokenAsync(user.Id, ct: ct);

        var expirationMinutes = _configuration.GetValue<int>("Jwt:AccessTokenExpirationMinutes", 15);

        var authResponse = new AuthResponse(
            accessToken,
            expirationMinutes * 60,
            new UserDto(user.Id, user.DisplayName, user.Email!, primaryRole, user.AccountStatus.ToString())
        );

        return (authResponse, rawRefreshToken, refreshExpiry);
    }

    public async Task<(AuthResponse Auth, string RefreshToken, DateTime RefreshTokenExpiresAtUtc)> RefreshAsync(
        string rawRefreshToken,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(rawRefreshToken))
        {
            throw new UnauthorizedException("Refresh token is required.");
        }

        var rotationResult = await _tokenService.RotateRefreshTokenAsync(rawRefreshToken, ct);
        if (rotationResult == null)
        {
            throw new UnauthorizedException("Invalid or expired refresh token.");
        }

        var (newRawRefreshToken, newExpiresAtUtc, userId) = rotationResult.Value;

        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null || user.AccountStatus != AccountStatus.Active)
        {
            throw new UnauthorizedException("Account is not active.");
        }

        var roles = await _userManager.GetRolesAsync(user);
        var primaryRole = roles.FirstOrDefault() ?? RoleConstants.Buyer;

        var accessToken = await _tokenService.GenerateAccessTokenAsync(user, roles);
        var expirationMinutes = _configuration.GetValue<int>("Jwt:AccessTokenExpirationMinutes", 15);

        var authResponse = new AuthResponse(
            accessToken,
            expirationMinutes * 60,
            new UserDto(user.Id, user.DisplayName, user.Email!, primaryRole, user.AccountStatus.ToString())
        );

        return (authResponse, newRawRefreshToken, newExpiresAtUtc);
    }

    public async Task LogoutAsync(string? rawRefreshToken, CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(rawRefreshToken))
        {
            await _tokenService.RevokeRefreshTokenAsync(rawRefreshToken, "User logout", ct);
        }
    }

    public async Task<UserDto> GetCurrentUserAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            throw new NotFoundException("User", userId.ToString());
        }

        var roles = await _userManager.GetRolesAsync(user);
        var primaryRole = roles.FirstOrDefault() ?? RoleConstants.Buyer;

        return new UserDto(
            user.Id,
            user.DisplayName,
            user.Email!,
            primaryRole,
            user.AccountStatus.ToString()
        );
    }

    private static bool IsValidEmail(string email)
    {
        try
        {
            var addr = new MailAddress(email);
            return addr.Address == email.Trim();
        }
        catch
        {
            return false;
        }
    }
}
