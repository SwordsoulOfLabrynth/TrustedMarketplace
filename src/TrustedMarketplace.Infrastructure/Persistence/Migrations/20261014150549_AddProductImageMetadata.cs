using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrustedMarketplace.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProductImageMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "FileSizeBytes",
                table: "product_images",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "MimeType",
                table: "product_images",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "image/jpeg");

            migrationBuilder.AddColumn<string>(
                name: "OriginalFileName",
                table: "product_images",
                type: "character varying(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FileSizeBytes",
                table: "product_images");

            migrationBuilder.DropColumn(
                name: "MimeType",
                table: "product_images");

            migrationBuilder.DropColumn(
                name: "OriginalFileName",
                table: "product_images");
        }
    }
}
