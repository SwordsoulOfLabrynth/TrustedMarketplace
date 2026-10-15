using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrustedMarketplace.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSubscriptionPaymentLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "seller_subscriptions",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.AddColumn<decimal>(
                name: "PaymentAmount",
                table: "seller_subscriptions",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentCurrency",
                table: "seller_subscriptions",
                type: "character varying(3)",
                maxLength: 3,
                nullable: false,
                defaultValue: "MMK");

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "seller_subscriptions",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentProofStorageKey",
                table: "seller_subscriptions",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PaymentSubmittedAtUtc",
                table: "seller_subscriptions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                table: "seller_subscriptions",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewedAtUtc",
                table: "seller_subscriptions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReviewedByUserId",
                table: "seller_subscriptions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TransactionReference",
                table: "seller_subscriptions",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_seller_subscriptions_TransactionReference",
                table: "seller_subscriptions",
                column: "TransactionReference",
                unique: true,
                filter: "\"TransactionReference\" IS NOT NULL AND \"Status\" != 'Rejected'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_seller_subscriptions_TransactionReference",
                table: "seller_subscriptions");

            migrationBuilder.DropColumn(
                name: "PaymentAmount",
                table: "seller_subscriptions");

            migrationBuilder.DropColumn(
                name: "PaymentCurrency",
                table: "seller_subscriptions");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "seller_subscriptions");

            migrationBuilder.DropColumn(
                name: "PaymentProofStorageKey",
                table: "seller_subscriptions");

            migrationBuilder.DropColumn(
                name: "PaymentSubmittedAtUtc",
                table: "seller_subscriptions");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                table: "seller_subscriptions");

            migrationBuilder.DropColumn(
                name: "ReviewedAtUtc",
                table: "seller_subscriptions");

            migrationBuilder.DropColumn(
                name: "ReviewedByUserId",
                table: "seller_subscriptions");

            migrationBuilder.DropColumn(
                name: "TransactionReference",
                table: "seller_subscriptions");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "seller_subscriptions",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(30)",
                oldMaxLength: 30);
        }
    }
}
