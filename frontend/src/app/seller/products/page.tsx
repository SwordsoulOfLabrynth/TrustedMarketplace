"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Package,
  Edit3,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  CheckCircle2,
  Archive,
  ArrowRight,
  RefreshCw,
  Store,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { sellerProductsApi } from "@/lib/seller-products-api";
import { getProductImageUrl } from "@/lib/catalog-api";
import { ProductDto } from "@/types/api";
import { MobileViewportContainer } from "@/components/layout/MobileViewportContainer";
import { AppHeader } from "@/components/layout/AppHeader";

export default function SellerProductsPage() {
  const router = useRouter();
  const { user, store, isAuthenticated, isLoading: authLoading, isSeller } = useAuth();

  const [products, setProducts] = useState<ProductDto[]>([]);
  const [filter, setFilter] = useState<"all" | "Published" | "Draft" | "Archived">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await sellerProductsApi.getMyProducts();
      setProducts(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load seller listings. Please verify your connection."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push("/auth/login?returnUrl=/seller/products");
      } else if (!isSeller) {
        // Buyer without store
        setError("You must have a verified seller workshop account to manage products.");
        setIsLoading(false);
      } else {
        fetchProducts();
      }
    }
  }, [authLoading, isAuthenticated, isSeller, router, fetchProducts]);

  const handlePublish = async (id: string, title: string) => {
    try {
      await sellerProductsApi.publishProduct(id);
      setActionSuccess(`"${title}" has been published to the catalog.`);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchProducts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to publish listing.");
    }
  };

  const handleArchive = async (id: string, title: string) => {
    try {
      await sellerProductsApi.archiveProduct(id);
      setActionSuccess(`"${title}" has been archived.`);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchProducts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to archive listing.");
    }
  };

  if (authLoading || (isLoading && products.length === 0 && !error)) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-jade-700 mx-auto" />
          <p className="text-xs text-ink-500">Loading your artisan listings...</p>
        </div>
      </MobileViewportContainer>
    );
  }

  const filteredProducts = products.filter((p) => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  return (
    <MobileViewportContainer
      header={<AppHeader />}
      footer={
        <div className="px-4 py-3 text-center text-xs text-ink-500 font-medium">
          <span>Non-Custodial Architecture · MatchGuard Myanmar Pilot</span>
        </div>
      }
    >
      <div className="space-y-6 py-2">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-200/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-jade-50 text-jade-800 border border-jade-200">
                <ShieldCheck className="w-3 h-3 text-jade-700" />
                <span>{store?.storeName || "Artisan Workshop"}</span>
              </span>
              <span className="text-xs text-ink-400 font-mono">
                {products.length} listing{products.length === 1 ? "" : "s"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-900">
              Manage Product Listings & Photography
            </h1>
            <p className="text-xs text-ink-500">
              Organize, update, and publish your handcrafted catalog items and workshop photography.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchProducts}
              className="p-2.5 text-ink-600 hover:text-jade-800 hover:bg-stone-100 rounded-xl transition-colors border border-stone-200"
              title="Refresh listings"
              aria-label="Refresh listings"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <Link
              href="/seller/store"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-stone-200 text-ink-700 hover:text-jade-800 hover:bg-stone-50 font-semibold text-xs transition-colors shadow-2xs"
            >
              <Store className="w-4 h-4 text-jade-700" />
              <span>Store Profile</span>
            </Link>

            <Link
              href="/seller/subscription"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-stone-200 text-ink-700 hover:text-jade-800 hover:bg-stone-50 font-semibold text-xs transition-colors shadow-2xs"
            >
              <CreditCard className="w-4 h-4 text-jade-700" />
              <span>Plans &amp; Quota</span>
            </Link>

            <Link
              href="/seller/products/new"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-jade-800 hover:bg-jade-900 text-white font-semibold text-xs transition-colors shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Product</span>
            </Link>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {actionSuccess && (
          <div className="p-3 rounded-2xl bg-jade-50 border border-jade-200 text-jade-800 text-xs flex items-center gap-2 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-jade-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {(["all", "Published", "Draft", "Archived"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0 ${
                filter === status
                  ? "bg-jade-800 text-white shadow-2xs"
                  : "bg-white text-ink-600 hover:bg-stone-100 border border-stone-200"
              }`}
            >
              {status === "all" ? "All Listings" : status}
              <span className="ml-1.5 text-[10px] opacity-75">
                (
                {status === "all"
                  ? products.length
                  : products.filter((p) => p.status === status).length}
                )
              </span>
            </button>
          ))}
        </div>

        {/* Listings Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProducts.map((product) => {
              const coverImage = product.images?.find((img) => img.isPrimary) || product.images?.[0];
              const coverUrl = getProductImageUrl(coverImage, product.id);
              const formattedPrice = new Intl.NumberFormat("en-US").format(product.priceAmount);

              return (
                <article
                  key={product.id}
                  className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-2xs flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Thumbnail */}
                    <div className="w-20 h-20 rounded-xl bg-stone-100 overflow-hidden shrink-0 border border-stone-200 flex items-center justify-center relative">
                      {coverUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={coverUrl}
                          alt={product.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-stone-400 p-1 text-center">
                          <ImageIcon className="w-6 h-6 stroke-1" />
                          <span className="text-[9px] mt-0.5">No photo</span>
                        </div>
                      )}
                      {product.images?.length > 0 && (
                        <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-mono px-1 rounded">
                          {product.images.length}
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            product.status === "Published"
                              ? "bg-jade-50 text-jade-800 border border-jade-200"
                              : product.status === "Draft"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-stone-100 text-stone-600 border border-stone-200"
                          }`}
                        >
                          {product.status}
                        </span>
                        <span className="text-[10px] text-ink-400 uppercase font-medium">
                          {product.categoryName}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-ink-900 leading-snug line-clamp-1">
                        {product.title}
                      </h3>

                      <div className="flex items-baseline gap-1 pt-0.5">
                        <span className="font-extrabold text-sm text-ink-900">
                          {formattedPrice}
                        </span>
                        <span className="text-[11px] font-semibold text-jade-800">
                          {product.currencyCode}
                        </span>
                        <span className="text-[10px] text-ink-400 ml-2">
                          Condition: {product.condition}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/seller/products/${product.id}/edit`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-ink-800 font-semibold transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit &amp; Photos</span>
                      </Link>

                      {product.status === "Published" && (
                        <Link
                          href={`/products/${product.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-ink-600 hover:text-jade-800 hover:bg-stone-50 transition-colors"
                          title="View public listing"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">View</span>
                        </Link>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {product.status === "Draft" && (
                        <button
                          type="button"
                          onClick={() => handlePublish(product.id, product.title)}
                          className="px-2.5 py-1.5 rounded-lg bg-jade-50 hover:bg-jade-100 text-jade-800 font-semibold transition-colors border border-jade-200 text-[11px]"
                        >
                          Publish
                        </button>
                      )}
                      {product.status === "Published" && (
                        <button
                          type="button"
                          onClick={() => handleArchive(product.id, product.title)}
                          className="px-2.5 py-1.5 rounded-lg text-stone-500 hover:text-red-700 hover:bg-red-50 transition-colors text-[11px]"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center p-6 rounded-3xl bg-white border border-stone-200/90 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto">
              <Package className="w-6 h-6 text-stone-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-ink-900">No listings found</h2>
              <p className="text-xs text-ink-500">
                {filter === "all"
                  ? "You don't have any products in your store yet. Click below to add your first item."
                  : `No ${filter.toLowerCase()} products found in this category.`}
              </p>
            </div>
            {filter === "all" && (
              <Link
                href="/seller/products/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jade-800 text-white font-semibold text-xs hover:bg-jade-900 transition-colors shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Listing</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </MobileViewportContainer>
  );
}
