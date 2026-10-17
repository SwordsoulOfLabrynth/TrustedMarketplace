using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using TrustedMarketplace.Domain.Catalog;
using TrustedMarketplace.Domain.Identity;
using TrustedMarketplace.Domain.Orders;
using TrustedMarketplace.Domain.Reviews;
using TrustedMarketplace.Domain.Stores;
using TrustedMarketplace.Domain.Subscriptions;
using TrustedMarketplace.Domain.Verification;
using TrustedMarketplace.Infrastructure.Identity;
using TrustedMarketplace.Infrastructure.Persistence.Configurations;

namespace TrustedMarketplace.Infrastructure.Persistence;

/// <summary>
/// Development-only demo seeder for presentation and competition evaluation.
/// Strictly guarded to run only when explicitly enabled in Development environments.
/// All credentials and emails are configurable with zero hardcoded production secrets.
/// </summary>
public static class DemoDataSeeder
{
    public static async Task SeedDemoDataAsync(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        ILogger logger,
        bool isDevelopment)
    {
        if (!isDevelopment)
        {
            logger.LogInformation("Skipping DemoDataSeeder: Non-development environment detected.");
            return;
        }

        var isEnabled = configuration.GetValue<bool>("DemoSeed:Enabled", false);
        if (!isEnabled)
        {
            logger.LogInformation("DemoDataSeeder is disabled by configuration ('DemoSeed:Enabled' is false).");
            return;
        }

        using var scope = serviceProvider.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        logger.LogInformation("Starting development demo data seeding...");

        // 1. Ensure Identity roles exist
        if (!await roleManager.RoleExistsAsync(RoleConstants.Buyer))
        {
            await roleManager.CreateAsync(new ApplicationRole(RoleConstants.Buyer));
        }
        if (!await roleManager.RoleExistsAsync(RoleConstants.Admin))
        {
            await roleManager.CreateAsync(new ApplicationRole(RoleConstants.Admin));
        }

        // 2. Seed Admin user
        var adminEmail = configuration["DemoSeed:AdminEmail"] ?? "admin@trustedmarketplace.local";
        var adminPassword = configuration["DemoSeed:AdminPassword"] ?? "AdminDemo123!";
        var adminUser = await userManager.FindByEmailAsync(adminEmail);
        if (adminUser == null)
        {
            adminUser = new ApplicationUser(adminEmail, "System Administrator")
            {
                EmailConfirmed = true,
                AccountStatus = AccountStatus.Active
            };
            var result = await userManager.CreateAsync(adminUser, adminPassword);
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(adminUser, RoleConstants.Admin);
                logger.LogInformation("Demo Admin seeded: {Email}", adminEmail);
            }
            else
            {
                logger.LogError("Failed to seed demo admin: {Errors}", string.Join(", ", result.Errors.Select(e => e.Description)));
            }
        }

        // 3. Seed Verified Seller user & store
        var sellerEmail = configuration["DemoSeed:SellerEmail"] ?? "artisan.seller@trustedmarketplace.local";
        var sellerPassword = configuration["DemoSeed:SellerPassword"] ?? "SellerDemo123!";
        var sellerUser = await userManager.FindByEmailAsync(sellerEmail);
        if (sellerUser == null)
        {
            sellerUser = new ApplicationUser(sellerEmail, "Daw Khin Artisan")
            {
                EmailConfirmed = true,
                AccountStatus = AccountStatus.Active
            };
            var result = await userManager.CreateAsync(sellerUser, sellerPassword);
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(sellerUser, RoleConstants.Buyer);
                logger.LogInformation("Demo Seller account seeded: {Email}", sellerEmail);
            }
        }

        // 4. Ensure Seller has an approved application
        var sellerApp = await dbContext.SellerApplications
            .FirstOrDefaultAsync(a => a.UserId == sellerUser.Id);
        if (sellerApp == null)
        {
            sellerApp = new SellerApplication(
                sellerUser.Id,
                "Mandalay Marionettes & Crafts",
                "Traditional Handicrafts",
                "09798881234");
            sellerApp.Approve(adminUser.Id, "Business registry, workshop inspection, and identity verified.");
            dbContext.SellerApplications.Add(sellerApp);
            await dbContext.SaveChangesAsync();
            logger.LogInformation("Demo Seller Application seeded and approved.");
        }

        // 5. Ensure Seller has an active verified Store Profile
        var sellerProfile = await dbContext.SellerProfiles
            .FirstOrDefaultAsync(p => p.SellerUserId == sellerUser.Id);
        if (sellerProfile == null)
        {
            sellerProfile = new SellerProfile(
                sellerUser.Id,
                "Mandalay Marionettes & Crafts",
                "09798881234",
                "Authentic handcrafted traditional Myanmar marionettes, Bagan lacquerware, and wood carvings.",
                "Mandalay");
            dbContext.SellerProfiles.Add(sellerProfile);
            await dbContext.SaveChangesAsync();
            logger.LogInformation("Demo Store Profile seeded: {StoreName}", sellerProfile.StoreName);
        }

        // 6. Ensure Seller has an active Subscription (Premium Plan)
        var subscription = await dbContext.SellerSubscriptions
            .FirstOrDefaultAsync(s => s.SellerUserId == sellerUser.Id && s.Status == SubscriptionStatus.Active);
        if (subscription == null)
        {
            subscription = new SellerSubscription(
                sellerUser.Id,
                SubscriptionPlanConfiguration.PremiumPlanId,
                DateTime.UtcNow.AddDays(-30),
                DateTime.UtcNow.AddMonths(11),
                adminUser.Id);
            dbContext.SellerSubscriptions.Add(subscription);
            await dbContext.SaveChangesAsync();
            logger.LogInformation("Demo Seller Subscription seeded with Premium tier.");
        }

        // 6.1 Ensure Seller has an active Identity-Verified Seller Credential
        var sellerCred = await dbContext.SellerCredentials
            .FirstOrDefaultAsync(c => c.SellerUserId == sellerUser.Id && c.Status == TrustedMarketplace.Domain.Credentials.CredentialStatus.Active);
        if (sellerCred == null)
        {
            sellerCred = TrustedMarketplace.Domain.Credentials.SellerCredential.Issue(
                sellerUser.Id,
                sellerApp.Id,
                adminUser.Id,
                "MG-ID-DEMO-ARTISAN-01",
                TrustedMarketplace.Domain.Credentials.CredentialType.IdentityVerified);
            dbContext.SellerCredentials.Add(sellerCred);
            await dbContext.SaveChangesAsync();
            logger.LogInformation("Demo Identity-Verified Seller Credential seeded: {PublicId}", sellerCred.PublicCredentialId);
        }

        // 7. Ensure sample Myanmar artisan products exist
        var existingProductsCount = await dbContext.Products
            .CountAsync(p => p.SellerUserId == sellerUser.Id);

        Product? sampleProduct1 = null;
        if (existingProductsCount == 0)
        {
            sampleProduct1 = new Product(
                sellerUser.Id,
                sellerProfile.Id,
                CategoryConfiguration.HandicraftsId,
                "Handcrafted Mandalay Teak Marionette Puppet",
                "Traditional string puppet hand-carved from seasoned teak wood with hand-sewn silk and sequined costume.",
                45000m,
                ProductCondition.New,
                "MMK");
            sampleProduct1.AddImage(
                "products/seed/mandalay-teak-marionette.jpg",
                sortOrder: 0,
                originalFileName: "mandalay-teak-marionette.jpg",
                mimeType: "image/jpeg",
                fileSizeBytes: 859434);
            sampleProduct1.Publish();
            dbContext.Products.Add(sampleProduct1);

            var sampleProduct2 = new Product(
                sellerUser.Id,
                sellerProfile.Id,
                CategoryConfiguration.HandicraftsId,
                "Bagan Traditional Lacquerware Bowl",
                "Authentic 14-layer bamboo and lacquer bowl featuring classical Bagan geometric engraving.",
                28000m,
                ProductCondition.New,
                "MMK");
            sampleProduct2.AddImage(
                "products/seed/bagan-lacquerware-bowl.jpg",
                sortOrder: 0,
                originalFileName: "bagan-lacquerware-bowl.jpg",
                mimeType: "image/jpeg",
                fileSizeBytes: 812791);
            sampleProduct2.Publish();
            dbContext.Products.Add(sampleProduct2);

            var sampleProduct3 = new Product(
                sellerUser.Id,
                sellerProfile.Id,
                CategoryConfiguration.FashionId,
                "Inle Lake Handwoven Lotus Silk Scarf",
                "Rare handwoven scarf crafted from natural lotus stem fibers by artisan weavers of Inle Lake.",
                65000m,
                ProductCondition.New,
                "MMK");
            sampleProduct3.AddImage(
                "products/seed/inle-lotus-silk-scarf.jpg",
                sortOrder: 0,
                originalFileName: "inle-lotus-silk-scarf.jpg",
                mimeType: "image/jpeg",
                fileSizeBytes: 914578);
            sampleProduct3.Publish();
            dbContext.Products.Add(sampleProduct3);

            await dbContext.SaveChangesAsync();
            logger.LogInformation("Demo Catalog Products seeded (3 published products with showcase photography).");
        }
        else
        {
            sampleProduct1 = await dbContext.Products
                .FirstOrDefaultAsync(p => p.SellerUserId == sellerUser.Id);

            var existingProducts = await dbContext.Products
                .Include(p => p.Images)
                .Where(p => p.SellerUserId == sellerUser.Id)
                .ToListAsync();

            var anyUpdated = false;
            foreach (var p in existingProducts)
            {
                if (p.Images.Count == 0)
                {
                    if (p.Title.Contains("Marionette", StringComparison.OrdinalIgnoreCase))
                    {
                        p.AddImage("products/seed/mandalay-teak-marionette.jpg", 0, "mandalay-teak-marionette.jpg", "image/jpeg", 859434);
                        anyUpdated = true;
                    }
                    else if (p.Title.Contains("Lacquerware", StringComparison.OrdinalIgnoreCase))
                    {
                        p.AddImage("products/seed/bagan-lacquerware-bowl.jpg", 0, "bagan-lacquerware-bowl.jpg", "image/jpeg", 812791);
                        anyUpdated = true;
                    }
                    else if (p.Title.Contains("Lotus", StringComparison.OrdinalIgnoreCase) || p.Title.Contains("Silk", StringComparison.OrdinalIgnoreCase))
                    {
                        p.AddImage("products/seed/inle-lotus-silk-scarf.jpg", 0, "inle-lotus-silk-scarf.jpg", "image/jpeg", 914578);
                        anyUpdated = true;
                    }
                }
            }

            if (anyUpdated)
            {
                await dbContext.SaveChangesAsync();
                logger.LogInformation("Attached missing showcase photography to existing demo products.");
            }
        }

        // 8. Seed Buyer user
        var buyerEmail = configuration["DemoSeed:BuyerEmail"] ?? "buyer@trustedmarketplace.local";
        var buyerPassword = configuration["DemoSeed:BuyerPassword"] ?? "BuyerDemo123!";
        var buyerUser = await userManager.FindByEmailAsync(buyerEmail);
        if (buyerUser == null)
        {
            buyerUser = new ApplicationUser(buyerEmail, "Ko Aung Thura")
            {
                EmailConfirmed = true,
                AccountStatus = AccountStatus.Active
            };
            var result = await userManager.CreateAsync(buyerUser, buyerPassword);
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(buyerUser, RoleConstants.Buyer);
                logger.LogInformation("Demo Buyer account seeded: {Email}", buyerEmail);
            }
        }

        // 9. Seed 1 Completed Order and Verified Review for realistic trust profile demonstration
        var existingOrdersCount = await dbContext.Orders
            .CountAsync(o => o.SellerUserId == sellerUser.Id && o.BuyerUserId == buyerUser.Id);

        if (existingOrdersCount == 0 && sampleProduct1 != null)
        {
            var demoOrder = new Order(
                buyerUser.Id,
                sellerUser.Id,
                sellerProfile.Id,
                sampleProduct1.PriceAmount,
                "09977112233",
                "Room 4A, Pyay Road, Kamayut Township",
                "Yangon",
                "Please deliver during business hours.");

            var item = demoOrder.AddItem(
                sampleProduct1.Id,
                sampleProduct1.Title,
                sampleProduct1.PriceAmount,
                1,
                sampleProduct1.Condition.ToString());

            var acceptHist = demoOrder.Accept(sellerUser.Id);
            var shipHist = demoOrder.Ship(sellerUser.Id, "ROYAL-WAYBILL-DEMO-991");
            var confirmHist = demoOrder.ConfirmDelivery(buyerUser.Id);

            dbContext.Orders.Add(demoOrder);
            dbContext.OrderStatusHistories.Add(acceptHist);
            dbContext.OrderStatusHistories.Add(shipHist);
            dbContext.OrderStatusHistories.Add(confirmHist);

            var demoReview = new Review(
                demoOrder.Id,
                buyerUser.Id,
                sellerUser.Id,
                5,
                "Exquisite craftsmanship! The marionette strings and detailed teak carving reflect true Mandalay heritage. Prompt delivery.");

            dbContext.Reviews.Add(demoReview);

            await dbContext.SaveChangesAsync();
            logger.LogInformation("Demo Completed Order and Verified 5-star Review seeded.");
        }

        logger.LogInformation("Development demo data seeding completed successfully.");
    }
}
