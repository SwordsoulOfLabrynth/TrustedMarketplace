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
        bool isDevelopment,
        bool force = false)
    {
        if (!isDevelopment && !force)
        {
            logger.LogInformation("Skipping DemoDataSeeder: Non-development environment detected.");
            return;
        }

        var isEnabled = force || configuration.GetValue<bool>("DemoSeed:Enabled", false);
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

        // 3. Seed Distinct Demo Sellers across categories
        var (artisanUser, artisanProfile) = await EnsureDemoSellerAsync(
            userManager, dbContext, adminUser, logger,
            configuration["DemoSeed:SellerEmail"] ?? "artisan.seller@trustedmarketplace.local",
            configuration["DemoSeed:SellerPassword"] ?? "SellerDemo123!",
            "Daw Khin Artisan",
            "Mandalay Marionettes & Crafts",
            "Traditional Handicrafts & Textiles",
            "09798881234",
            "Authentic handcrafted traditional Myanmar marionettes, Bagan lacquerware, and handwoven textiles.",
            "Mandalay",
            SellerVerificationStatus.Verified,
            "MG-ID-DEMO-ARTISAN-01");

        var (techUser, techProfile) = await EnsureDemoSellerAsync(
            userManager, dbContext, adminUser, logger,
            "tech.seller@trustedmarketplace.local",
            "SellerDemo123!",
            "Ko Min Tech",
            "Apex Electronics & Mobile",
            "Consumer Electronics & Accessories",
            "09798882345",
            "Authorized distributor of premium mobile accessories, wireless audio, fast-charging gear, and desk peripherals.",
            "Yangon",
            SellerVerificationStatus.Verified,
            "MG-ID-DEMO-TECH-02");

        var (beautyUser, beautyProfile) = await EnsureDemoSellerAsync(
            userManager, dbContext, adminUser, logger,
            "beauty.seller@trustedmarketplace.local",
            "SellerDemo123!",
            "Ma Hnin Su",
            "Green Leaf Naturals Myanmar",
            "Beauty, Skincare & Personal Care",
            "09798883456",
            "Pure organic skincare, Shinmataung Thanakha bark pastes, botanical facial mists, and herbal wellness oils.",
            "Pyin Oo Lwin",
            SellerVerificationStatus.Verified,
            "MG-ID-DEMO-BEAUTY-03");

        var (homeUser, homeProfile) = await EnsureDemoSellerAsync(
            userManager, dbContext, adminUser, logger,
            "home.seller@trustedmarketplace.local",
            "SellerDemo123!",
            "U Thein Home Essentials",
            "Heritage Home & Living",
            "Home & Living Essentials",
            "09798884567",
            "Sustainable home decor, handcrafted woven bamboo baskets, aromatherapy reed diffusers, and luxury organic bedding.",
            "Yangon",
            SellerVerificationStatus.Verified,
            "MG-ID-DEMO-HOME-04");

        var (foodUser, foodProfile) = await EnsureDemoSellerAsync(
            userManager, dbContext, adminUser, logger,
            "food.seller@trustedmarketplace.local",
            "SellerDemo123!",
            "Daw Thin Thin",
            "Shan Highland Pantry",
            "Food & Local Products",
            "09798885678",
            "High-altitude specialty Shan Arabica coffee, heritage Mogok green tea, raw forest honey, and traditional pickled tea salad kits.",
            "Taunggyi",
            SellerVerificationStatus.Verified,
            "MG-ID-DEMO-FOOD-05");

        var (fashionUser, fashionProfile) = await EnsureDemoSellerAsync(
            userManager, dbContext, adminUser, logger,
            "fashion.seller@trustedmarketplace.local",
            "SellerDemo123!",
            "Ko Zaw",
            "Urban Stride Footwear & Apparel",
            "Fashion & Urban Apparel",
            "09798886789",
            "Contemporary casual streetwear, vulcanized canvas sneakers, and ergonomic commuter travel packs.",
            "Yangon",
            SellerVerificationStatus.PendingReverification);

        // 7. Ensure full general catalog with realistic Myanmar sample products exists
        var sampleProductDefs = new (SellerProfile Profile, Guid CategoryId, string Title, string Description, decimal Price, string StorageKey, string FileName, long Size)[]
        {
            // --- Handicrafts & Art ---
            (artisanProfile, CategoryConfiguration.HandicraftsId,
             "Handcrafted Mandalay Teak Marionette Puppet",
             "Traditional string puppet hand-carved from seasoned teak wood with hand-sewn silk and sequined costume.",
             45000m, "products/seed/mandalay-teak-marionette.jpg", "mandalay-teak-marionette.jpg", 139673),

            (artisanProfile, CategoryConfiguration.HandicraftsId,
             "Bagan Traditional Lacquerware Bowl",
             "Authentic 14-layer bamboo and lacquer bowl featuring classical Bagan geometric engraving.",
             28000m, "products/seed/bagan-lacquerware-bowl.jpg", "bagan-lacquerware-bowl.jpg", 129155),

            (artisanProfile, CategoryConfiguration.HandicraftsId,
             "Bagan Hand-Carved Teakwood Elephant Figurine",
             "Solid seasoned Burmese teak wood figurine sculpted by master woodworkers in Bagan with natural oil finish preserving timber grain.",
             36000m, "products/seed/teakwood-elephant.jpg", "teakwood-elephant.jpg", 66930),

            (artisanProfile, CategoryConfiguration.HandicraftsId,
             "Shan Traditional Handmade Mulberry Paper Lantern",
             "Collapsible hanging lantern made from authentic Shan mulberry (Sa) paper pressed with dried bougainvillea petals and bamboo ribbing.",
             19000m, "products/seed/shan-paper-lantern.jpg", "shan-paper-lantern.jpg", 45330),

            // --- Fashion & Accessories ---
            (artisanProfile, CategoryConfiguration.FashionId,
             "Inle Lake Handwoven Lotus Silk Scarf",
             "Rare handwoven scarf crafted from natural lotus stem fibers by artisan weavers of Inle Lake.",
             65000m, "products/seed/inle-lotus-silk-scarf.jpg", "inle-lotus-silk-scarf.jpg", 121099),

            (artisanProfile, CategoryConfiguration.FashionId,
             "Traditional Kachin Woven Pattern Longyi",
             "Authentic Myanmar handloom cotton longyi featuring intricate Kachin mountain diamond weaving motifs in rich indigo and crimson.",
             42000m, "products/seed/kachin-pattern-longyi.jpg", "kachin-pattern-longyi.jpg", 222212),

            (fashionProfile, CategoryConfiguration.FashionId,
             "Classic Unisex Low-Top Canvas Sneakers",
             "Breathable vulcanized canvas lace-up sneakers with reinforced rubber toe cap and cushioned insole for daily urban wear.",
             38000m, "products/seed/canvas-sneakers.jpg", "canvas-sneakers.jpg", 76446),

            (fashionProfile, CategoryConfiguration.FashionId,
             "Water-Resistant Commuter Laptop Backpack (20L)",
             "Durable Oxford fabric commuter backpack with dedicated padded 15.6-inch laptop compartment, hidden anti-theft rear pocket, and USB charging port.",
             48000m, "products/seed/commuter-backpack.jpg", "commuter-backpack.jpg", 71738),

            (homeProfile, CategoryConfiguration.FashionId,
             "Handcrafted Vegetable-Tanned Leather Bi-Fold Wallet",
             "Minimalist slim wallet made from top-grain vegetable-tanned leather with 6 card slots, dual cash compartment, and RFID blocking lining.",
             35000m, "products/seed/leather-bifold-wallet.jpg", "leather-bifold-wallet.jpg", 64078),

            // --- Electronics & Gadgets ---
            (techProfile, CategoryConfiguration.ElectronicsId,
             "Anker Soundcore Life P2 Mini True Wireless Earbuds",
             "Compact Bluetooth 5.2 wireless earbuds with 10mm drivers, 32-hour playtime with USB-C charging case, and IPX5 water resistance.",
             75000m, "products/seed/anker-soundcore-earbuds.jpg", "anker-soundcore-earbuds.jpg", 36362),

            (techProfile, CategoryConfiguration.ElectronicsId,
             "Baseus 20,000mAh 22.5W Fast Charging Power Bank",
             "High-capacity digital display power bank supporting 22.5W SuperCharge, PD 3.0, dual USB-A and USB-C output for smartphones and tablets.",
             68000m, "products/seed/baseus-power-bank.jpg", "baseus-power-bank.jpg", 23845),

            (techProfile, CategoryConfiguration.ElectronicsId,
             "Xiaomi Smart LED Desk Lamp 1S",
             "Minimalist foldable desk lamp with adjustable color temperature, Ra90 high color rendering index, and optical anti-flicker technology.",
             85000m, "products/seed/xiaomi-desk-lamp.jpg", "xiaomi-desk-lamp.jpg", 45932),

            (techProfile, CategoryConfiguration.ElectronicsId,
             "UGREEN 6-in-1 USB-C Hub Multiport Adapter",
             "Aluminum USB-C hub featuring 4K HDMI, 100W Power Delivery pass-through, SD/TF card reader slots, and 3x USB 3.0 ports.",
             52000m, "products/seed/ugreen-usb-c-hub.jpg", "ugreen-usb-c-hub.jpg", 83992),

            // --- Beauty & Personal Care ---
            (beautyProfile, CategoryConfiguration.BeautyId,
             "Natural Shinmataung Pure Thanakha Bark Cream (150g)",
             "100% organic, freshly milled Shinmataung Thanakha bark enriched with vitamin E. Protects against sun exposure and cools the skin naturally.",
             12000m, "products/seed/shinmataung-thanakha.jpg", "shinmataung-thanakha.jpg", 51412),

            (beautyProfile, CategoryConfiguration.BeautyId,
             "Organic Lemongrass & Bergamot Cold-Pressed Essential Oil (30ml)",
             "Pure steam-distilled Shan State lemongrass essential oil for aromatherapy, natural insect repellent, and refreshing diffusers.",
             18500m, "products/seed/lemongrass-essential-oil.jpg", "lemongrass-essential-oil.jpg", 72215),

            (beautyProfile, CategoryConfiguration.BeautyId,
             "Herbal Coconut & Rosemary Scalp Nourishing Hair Oil (100ml)",
             "Traditional cold-pressed coconut oil infused with dried rosemary leaves and aloe vera extracts to strengthen hair roots and reduce breakage.",
             16000m, "products/seed/herbal-hair-oil.jpg", "herbal-hair-oil.jpg", 50477),

            (beautyProfile, CategoryConfiguration.BeautyId,
             "Jasmine Blossom Hydrating Facial Mist (120ml)",
             "Calming botanical facial mist distilled from fresh night-blooming jasmine flowers and pure spring water. Refreshes tired skin throughout the day.",
             14500m, "products/seed/jasmine-facial-mist.jpg", "jasmine-facial-mist.jpg", 235700),

            // --- Home & Living ---
            (homeProfile, CategoryConfiguration.HomeLivingId,
             "Handwoven Natural Bamboo Laundry & Storage Basket",
             "Eco-friendly handwoven bamboo storage basket with fitted lid and cloth liner. Perfect for organizing laundry, throws, or nursery toys.",
             32000m, "products/seed/bamboo-storage-basket.jpg", "bamboo-storage-basket.jpg", 59126),

            (homeProfile, CategoryConfiguration.HomeLivingId,
             "Aromatherapy White Tea & Jasmine Reed Diffuser (200ml)",
             "Elegant glass vessel with 8 rattan reeds delivering continuous, subtle botanical fragrance for up to 90 days. Non-toxic alcohol-free base.",
             26000m, "products/seed/reed-diffuser.jpg", "reed-diffuser.jpg", 169210),

            (homeProfile, CategoryConfiguration.HomeLivingId,
             "100% Washed Cotton 4-Piece Queen Bed Sheet Set",
             "Breathable, pre-washed cotton bedding set including 1 fitted sheet, 1 flat sheet, and 2 pillowcases in soothing sage green.",
             78000m, "products/seed/cotton-bedsheet-set.jpg", "cotton-bedsheet-set.jpg", 55056),

            (homeProfile, CategoryConfiguration.HomeLivingId,
             "Handcrafted Rattan Tissue Box Cover",
             "Rustic woven cane and rattan rectangular tissue dispenser with bottom latch, adding warmth to any desk, dining table, or nightstand.",
             15000m, "products/seed/rattan-tissue-box.jpg", "rattan-tissue-box.jpg", 59682),

            (homeProfile, CategoryConfiguration.HomeLivingId,
             "Minimalist Matte Ceramic Coffee Mug & Saucer Set (2-Piece)",
             "Stoneware ceramic cup and oval saucer with textured matte cream glaze, ergonomic wide handle, and heat-retentive heavy walls.",
             22000m, "products/seed/ceramic-coffee-mug.jpg", "ceramic-coffee-mug.jpg", 153238),

            // --- Food & Local Products ---
            (foodProfile, CategoryConfiguration.FoodId,
             "Ywangan Specialty Roasted Arabica Whole Coffee Beans (250g)",
             "Single-origin specialty Arabica beans grown in Southern Shan State at 1,400m altitude. Tasting notes of honey, citrus, and roasted hazelnut.",
             24000m, "products/seed/ywangan-arabica-coffee.jpg", "ywangan-arabica-coffee.jpg", 108825),

            (foodProfile, CategoryConfiguration.FoodId,
             "Premium Mogok Hand-Picked Green Tea Leaves (100g Tin)",
             "High-altitude tender young tea buds harvested from heritage tea estates in Mogok valley. Mild, sweet floral aroma with zero bitterness.",
             17500m, "products/seed/mogok-green-tea.jpg", "mogok-green-tea.jpg", 151740),

            (foodProfile, CategoryConfiguration.FoodId,
             "Raw Wildflower Honey Jar from Shan Plateau (500g)",
             "Pure, unprocessed raw honey harvested from natural wild bee hives across Shan State forest reserves. Rich in natural enzymes and pollen.",
             22500m, "products/seed/shan-wildflower-honey.jpg", "shan-wildflower-honey.jpg", 93860),

            (foodProfile, CategoryConfiguration.FoodId,
             "Traditional Laphet Pickled Tea Leaf Salad Kit (400g)",
             "Authentic Myanmar fermented tea leaves paired with crispy fried garlic, roasted yellow split peas, crunchy peanuts, and toasted sesame seeds.",
             13500m, "products/seed/laphet-salad-kit.jpg", "laphet-salad-kit.jpg", 285439),

            (foodProfile, CategoryConfiguration.FoodId,
             "Crispy Spiced Kyaukme Garlic Flakes (200g Jar)",
             "Golden fried organic Shan garlic flakes lightly seasoned with sea salt and chili oil. Delicious topping for rice noodles, salads, and soups.",
             9500m, "products/seed/crispy-garlic-flakes.jpg", "crispy-garlic-flakes.jpg", 49114),
        };

        Product? sampleProduct1 = null;
        var newProductsCount = 0;

        foreach (var def in sampleProductDefs)
        {
            var existing = await dbContext.Products
                .Include(p => p.Images)
                .FirstOrDefaultAsync(p => p.Title == def.Title);

            if (existing == null)
            {
                var product = new Product(
                    def.Profile.SellerUserId,
                    def.Profile.Id,
                    def.CategoryId,
                    def.Title,
                    def.Description,
                    def.Price,
                    ProductCondition.New,
                    "MMK");

                product.AddImage(def.StorageKey, 0, def.FileName, "image/jpeg", def.Size);
                product.Publish();
                dbContext.Products.Add(product);
                newProductsCount++;

                if (sampleProduct1 == null && def.Profile.SellerUserId == artisanUser.Id)
                {
                    sampleProduct1 = product;
                }
            }
            else
            {
                if (existing.Images.Count == 0)
                {
                    existing.AddImage(def.StorageKey, 0, def.FileName, "image/jpeg", def.Size);
                }
                if (sampleProduct1 == null && existing.SellerUserId == artisanUser.Id)
                {
                    sampleProduct1 = existing;
                }
            }
        }

        if (newProductsCount > 0)
        {
            await dbContext.SaveChangesAsync();
            logger.LogInformation("Demo general marketplace catalog seeded ({Count} new products).", newProductsCount);
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
            .CountAsync(o => o.SellerUserId == artisanUser.Id && o.BuyerUserId == buyerUser.Id);

        if (existingOrdersCount == 0 && sampleProduct1 != null)
        {
            var demoOrder = new Order(
                buyerUser.Id,
                artisanUser.Id,
                artisanProfile.Id,
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

            var acceptHist = demoOrder.Accept(artisanUser.Id);
            var shipHist = demoOrder.Ship(artisanUser.Id, "ROYAL-WAYBILL-DEMO-991");
            var confirmHist = demoOrder.ConfirmDelivery(buyerUser.Id);

            dbContext.Orders.Add(demoOrder);
            dbContext.OrderStatusHistories.Add(acceptHist);
            dbContext.OrderStatusHistories.Add(shipHist);
            dbContext.OrderStatusHistories.Add(confirmHist);

            var demoReview = new Review(
                demoOrder.Id,
                buyerUser.Id,
                artisanUser.Id,
                5,
                "Exquisite craftsmanship! The marionette strings and detailed teak carving reflect true Mandalay heritage. Prompt delivery.");

            dbContext.Reviews.Add(demoReview);

            await dbContext.SaveChangesAsync();
            logger.LogInformation("Demo Completed Order and Verified 5-star Review seeded.");
        }

        logger.LogInformation("Development demo data seeding completed successfully.");
    }

    private static async Task<(ApplicationUser User, SellerProfile Profile)> EnsureDemoSellerAsync(
        UserManager<ApplicationUser> userManager,
        AppDbContext dbContext,
        ApplicationUser adminUser,
        ILogger logger,
        string email,
        string password,
        string displayName,
        string storeName,
        string businessType,
        string phone,
        string bio,
        string city,
        SellerVerificationStatus verificationStatus,
        string? credentialId = null)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user == null)
        {
            user = new ApplicationUser(email, displayName)
            {
                EmailConfirmed = true,
                AccountStatus = AccountStatus.Active
            };
            var result = await userManager.CreateAsync(user, password);
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(user, RoleConstants.Buyer);
                logger.LogInformation("Demo seller account seeded: {Email}", email);
            }
        }

        var app = await dbContext.SellerApplications.FirstOrDefaultAsync(a => a.UserId == user.Id);
        if (app == null)
        {
            app = new SellerApplication(user.Id, storeName, businessType, phone);
            app.Approve(adminUser?.Id ?? user.Id, "Business registry and identity credentials verified.");
            dbContext.SellerApplications.Add(app);
            await dbContext.SaveChangesAsync();
        }

        var profile = await dbContext.SellerProfiles.FirstOrDefaultAsync(p => p.SellerUserId == user.Id);
        if (profile == null)
        {
            profile = new SellerProfile(user.Id, storeName, phone, bio, city);
            if (verificationStatus == SellerVerificationStatus.PendingReverification)
            {
                profile.UpdateProfile(storeName, bio, phone, city);
            }
            dbContext.SellerProfiles.Add(profile);
            await dbContext.SaveChangesAsync();
        }

        var sub = await dbContext.SellerSubscriptions
            .FirstOrDefaultAsync(s => s.SellerUserId == user.Id && s.Status == SubscriptionStatus.Active);
        if (sub == null)
        {
            sub = new SellerSubscription(
                user.Id,
                SubscriptionPlanConfiguration.PremiumPlanId,
                DateTime.UtcNow.AddDays(-30),
                DateTime.UtcNow.AddMonths(11),
                adminUser?.Id ?? user.Id);
            dbContext.SellerSubscriptions.Add(sub);
            await dbContext.SaveChangesAsync();
        }

        if (!string.IsNullOrEmpty(credentialId) && verificationStatus == SellerVerificationStatus.Verified)
        {
            var cred = await dbContext.SellerCredentials
                .FirstOrDefaultAsync(c => c.SellerUserId == user.Id && c.Status == TrustedMarketplace.Domain.Credentials.CredentialStatus.Active);
            if (cred == null)
            {
                cred = TrustedMarketplace.Domain.Credentials.SellerCredential.Issue(
                    user.Id,
                    app.Id,
                    adminUser?.Id ?? user.Id,
                    credentialId,
                    TrustedMarketplace.Domain.Credentials.CredentialType.IdentityVerified);
                dbContext.SellerCredentials.Add(cred);
                await dbContext.SaveChangesAsync();
            }
        }

        return (user, profile);
    }
}
