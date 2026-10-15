using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrustedMarketplace.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProductEmbeddings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "product_embeddings",
                columns: table => new
                {
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Vector = table.Column<string>(type: "text", nullable: false),
                    ContentHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    IndexedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_embeddings", x => x.ProductId);
                    table.ForeignKey(
                        name: "FK_product_embeddings_products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "product_embeddings");
        }
    }
}
