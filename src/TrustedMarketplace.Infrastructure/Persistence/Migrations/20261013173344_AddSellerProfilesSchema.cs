using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrustedMarketplace.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSellerProfilesSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "seller_profiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SellerUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    StoreName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Bio = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ContactPhone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CityOrTownship = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    LogoStorageKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    VerificationStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seller_profiles", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_seller_profiles_SellerUserId",
                table: "seller_profiles",
                column: "SellerUserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_seller_profiles_Slug",
                table: "seller_profiles",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_seller_profiles_StoreName",
                table: "seller_profiles",
                column: "StoreName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_seller_profiles_VerificationStatus",
                table: "seller_profiles",
                column: "VerificationStatus");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "seller_profiles");
        }
    }
}
