using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrustedMarketplace.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UpdatePremiumSubscriptionPrice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "subscription_plans",
                keyColumn: "Id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333333"),
                column: "PriceAmount",
                value: 30000m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "subscription_plans",
                keyColumn: "Id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333333"),
                column: "PriceAmount",
                value: 45000m);
        }
    }
}
