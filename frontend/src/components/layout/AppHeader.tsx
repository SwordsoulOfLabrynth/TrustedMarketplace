"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, LogOut, User as UserIcon, ShieldAlert, Shield, ShoppingBag, Package, Store, CreditCard } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function AppHeader() {
  const pathname = usePathname() || "";
  const { user, store, isAuthenticated, isLoading, logout, isAdmin, isSeller, isBuyer } = useAuth();

  const isCatalogActive = pathname === "/products" || pathname.startsWith("/products/");
  const isOrdersActive = pathname === "/orders" || pathname.startsWith("/orders/");
  const isSellerProductsActive = pathname === "/seller/products" || pathname.startsWith("/seller/products/");
  const isSellerStoreActive = pathname === "/seller/store";
  const isSubscriptionActive = pathname === "/seller/subscription";
  const isApplyActive = pathname === "/seller/apply";
  const isAdminActive = pathname.startsWith("/admin");

  return (
    <header className="px-3 sm:px-6 lg:px-8 py-2 sm:py-3.5">
      <div className="flex items-center justify-between gap-1.5 sm:gap-3 w-full min-w-0">
        {/* Brand Logo & Name */}
        <Link
          href="/"
          className="flex items-center gap-1.5 sm:gap-2 group transition-opacity hover:opacity-90 min-w-0 shrink"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-jade-800 flex items-center justify-center text-white shadow-xs transition-transform group-hover:scale-105 shrink-0">
            <ShieldCheck className="w-4 h-4 text-jade-50" />
          </div>
          <div className="truncate min-w-0">
            <span className="font-bold text-xs sm:text-sm tracking-tight text-ink-900 block leading-tight truncate">
              TrustedMarketplace
            </span>
            <span className="text-[9px] sm:text-[10px] text-jade-800 font-medium block leading-tight truncate">
              Verified Artisan Crafts
            </span>
          </div>
        </Link>

        {/* Navigation & Auth State */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Quick Catalog Link */}
          <Link
            href="/products"
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
              isCatalogActive
                ? "bg-stone-200 text-ink-900"
                : "text-ink-700 hover:text-jade-800 hover:bg-stone-100"
            }`}
            title="Browse Product Catalog"
            aria-label="Browse Product Catalog"
          >
            <ShoppingBag className="w-4 h-4 text-jade-800 shrink-0" />
            <span className="hidden sm:inline">Catalog</span>
          </Link>

          {/* Orders Link when Authenticated */}
          {isAuthenticated && (
            <Link
              href="/orders"
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                isOrdersActive
                  ? "bg-stone-200 text-ink-900"
                  : "text-ink-700 hover:text-jade-800 hover:bg-stone-100"
              }`}
              title="My Orders"
              aria-label="My Orders"
            >
              <Package className="w-4 h-4 text-jade-800 shrink-0" />
              <span className="hidden sm:inline">Orders</span>
            </Link>
          )}

          {/* Become a Seller Link when Authenticated as regular Buyer */}
          {isAuthenticated && isBuyer && (
            <Link
              href="/seller/apply"
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                isApplyActive
                  ? "bg-jade-100 text-jade-900"
                  : "text-ink-700 hover:text-jade-800 hover:bg-stone-100"
              }`}
              title="Apply to Become an Artisan Seller"
              aria-label="Become a Seller"
            >
              <Store className="w-4 h-4 text-jade-800 shrink-0" />
              <span className="hidden sm:inline">Become a Seller</span>
              <span className="sm:hidden">Sell</span>
            </Link>
          )}

          {/* Seller Links when Authenticated as Seller */}
          {isAuthenticated && isSeller && (
            <>
              <Link
                href="/seller/products"
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  isSellerProductsActive
                    ? "bg-jade-100 text-jade-900"
                    : "text-ink-700 hover:text-jade-800 hover:bg-stone-100"
                }`}
                title="My Store Listings & Photography"
                aria-label="My Store Listings & Photography"
              >
                <Package className="w-4 h-4 text-jade-800 shrink-0" />
                <span className="hidden sm:inline">Listings</span>
              </Link>

              <Link
                href="/seller/store"
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  isSellerStoreActive
                    ? "bg-jade-100 text-jade-900"
                    : "text-ink-700 hover:text-jade-800 hover:bg-stone-100"
                }`}
                title="Manage Store Profile"
                aria-label="Manage Store Profile"
              >
                <Store className="w-4 h-4 text-jade-800 shrink-0" />
                <span className="hidden sm:inline">Store Profile</span>
              </Link>

              <Link
                href="/seller/subscription"
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  isSubscriptionActive
                    ? "bg-jade-100 text-jade-900"
                    : "text-ink-700 hover:text-jade-800 hover:bg-stone-100"
                }`}
                title="Subscription Plans & Quota"
                aria-label="Subscription Plans & Quota"
              >
                <CreditCard className="w-4 h-4 text-jade-800 shrink-0" />
                <span className="hidden sm:inline">Plans &amp; Quota</span>
              </Link>
            </>
          )}

          {/* Admin Console Link when Authenticated as Admin */}
          {isAuthenticated && isAdmin && (
            <Link
              href="/admin"
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                isAdminActive
                  ? "bg-stone-200 text-ink-900"
                  : "text-ink-700 hover:text-jade-800 hover:bg-stone-100"
              }`}
              title="Admin Console"
              aria-label="Admin Console"
            >
              <Shield className="w-4 h-4 text-stone-800 shrink-0" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}

          {isLoading ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-stone-100 text-ink-400 text-xs animate-pulse">
              <span className="w-2 h-2 rounded-full bg-ink-400 animate-ping" />
              <span className="text-[11px] hidden sm:inline">Connecting...</span>
            </div>
          ) : isAuthenticated && user ? (
            <div className="flex items-center gap-1 sm:gap-1.5">
              {/* Role Badges */}
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 text-stone-800 border border-stone-300 shadow-2xs">
                  <Shield className="w-3 h-3 text-stone-600" />
                  <span className="hidden sm:inline">Admin</span>
                </span>
              ) : isSeller ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-jade-50 text-jade-800 border border-jade-200 shadow-2xs">
                  <ShieldCheck className="w-3 h-3 text-jade-700" />
                  {store?.verificationStatus === "PendingReverification" ? (
                    <span className="text-amber-700 flex items-center gap-0.5">
                      <ShieldAlert className="w-3 h-3 text-amber-600" />
                      <span className="hidden sm:inline">Re-verifying</span>
                    </span>
                  ) : (
                    <span>Seller</span>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 text-stone-700 border border-stone-200 shadow-2xs">
                  <UserIcon className="w-3 h-3 text-stone-500" />
                  <span>Buyer</span>
                </span>
              )}

              {/* Logout button */}
              <button
                type="button"
                onClick={() => logout()}
                className="p-1.5 text-ink-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-target sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <Link
                href="/auth/login"
                className="px-2.5 py-1 text-xs font-semibold text-ink-700 hover:text-jade-800 hover:bg-stone-100 rounded-lg transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className="px-2.5 py-1 text-xs font-semibold text-white bg-jade-800 hover:bg-jade-900 rounded-lg shadow-xs transition-colors"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
