using Microsoft.EntityFrameworkCore;
using TrustedMarketplace.Domain.Auditing;
using TrustedMarketplace.Domain.Common;
using TrustedMarketplace.Infrastructure.Persistence;
using TrustedMarketplace.Infrastructure.Persistence.Interceptors;

namespace TrustedMarketplace.UnitTests.Persistence;

public class AuditTrailInterceptorTests
{
    private class TestAuditableEntity : BaseEntity
    {
        public string Name { get; set; } = string.Empty;
    }

    private class TestDbContext : DbContext
    {
        public TestDbContext(DbContextOptions<TestDbContext> options) : base(options) { }

        public DbSet<TestAuditableEntity> Entities => Set<TestAuditableEntity>();
        public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
    }

    private static TestDbContext CreateTestDbContext()
    {
        var interceptor = new AuditableEntitySaveChangesInterceptor();
        var options = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .AddInterceptors(interceptor)
            .Options;

        return new TestDbContext(options);
    }

    [Fact]
    public async Task Adding_AuditableEntity_Populates_CreatedAtUtc_And_UpdatedAtUtc()
    {
        // Arrange
        await using var context = CreateTestDbContext();
        var beforeTime = DateTime.UtcNow.AddSeconds(-1);

        var entity = new TestAuditableEntity { Name = "Test" };

        // Act
        context.Entities.Add(entity);
        await context.SaveChangesAsync();

        var afterTime = DateTime.UtcNow.AddSeconds(1);

        // Assert
        Assert.True(entity.CreatedAtUtc >= beforeTime && entity.CreatedAtUtc <= afterTime);
        Assert.True(entity.UpdatedAtUtc >= beforeTime && entity.UpdatedAtUtc <= afterTime);
        Assert.Equal(entity.CreatedAtUtc, entity.UpdatedAtUtc);
    }

    [Fact]
    public async Task Modifying_AuditableEntity_Updates_UpdatedAtUtc_WhilePreserving_CreatedAtUtc()
    {
        // Arrange
        await using var context = CreateTestDbContext();
        var entity = new TestAuditableEntity { Name = "Initial" };
        context.Entities.Add(entity);
        await context.SaveChangesAsync();

        var originalCreatedAt = entity.CreatedAtUtc;
        var originalUpdatedAt = entity.UpdatedAtUtc;

        // Small delay to ensure timestamp progression
        await Task.Delay(15);

        // Act
        entity.Name = "Updated";
        await context.SaveChangesAsync();

        // Assert
        Assert.Equal(originalCreatedAt, entity.CreatedAtUtc);
        Assert.True(entity.UpdatedAtUtc > originalUpdatedAt);
    }

    [Fact]
    public async Task Adding_AuditEvent_Persists_Successfully()
    {
        // Arrange
        await using var context = CreateTestDbContext();
        var audit = AuditEvent.Create(
            action: "SellerApplication.Approved",
            targetType: "SellerApplication",
            targetId: Guid.NewGuid().ToString(),
            correlationId: Guid.NewGuid().ToString(),
            actorUserId: Guid.NewGuid(),
            reason: "Valid NRC verified"
        );

        // Act
        context.AuditEvents.Add(audit);
        await context.SaveChangesAsync();

        // Assert
        var savedAudit = await context.AuditEvents.FirstOrDefaultAsync(a => a.Id == audit.Id);
        Assert.NotNull(savedAudit);
        Assert.Equal("SellerApplication.Approved", savedAudit.Action);
        Assert.Equal("Valid NRC verified", savedAudit.Reason);
    }
}
