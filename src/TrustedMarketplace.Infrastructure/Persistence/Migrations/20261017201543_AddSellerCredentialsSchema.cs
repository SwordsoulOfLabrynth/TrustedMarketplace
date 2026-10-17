using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrustedMarketplace.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSellerCredentialsSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "seller_credentials",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SellerUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SellerApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    PublicCredentialId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CredentialType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    IssuedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IssuedByAdminUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RevokedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RevokedByAdminUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    RevocationReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_seller_credentials", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_seller_credentials_PublicCredentialId",
                table: "seller_credentials",
                column: "PublicCredentialId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_seller_credentials_SellerApplicationId",
                table: "seller_credentials",
                column: "SellerApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_seller_credentials_SellerUserId_CredentialType_Active",
                table: "seller_credentials",
                columns: new[] { "SellerUserId", "CredentialType" },
                unique: true,
                filter: "\"Status\" = 'Active'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "seller_credentials");
        }
    }
}
