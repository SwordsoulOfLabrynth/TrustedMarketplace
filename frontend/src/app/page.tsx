"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Search,
  ArrowRight,
  Store,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { catalogApi } from "@/lib/catalog-api";
import { CategoryDto, ProductDto } from "@/types/api";
import { MobileViewportContainer } from "@/components/layout/MobileViewportContainer";
import { AppHeader } from "@/components/layout/AppHeader";
import { ProductCard } from "@/components/marketplace/ProductCard";

export default function Home() {
  const router = useRouter();
  const { user, store, isAuthenticated, isSeller, isAdmin } = useAuth();

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<ProductDto[]>([]);
  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  const loadMarketplaceData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cats, productsRes] = await Promise.all([
        catalogApi.getCategories(),
        catalogApi.searchProducts({ pageSize: 6 }),
      ]);
      setCategories(cats);
      setFeaturedProducts(productsRes.items);
      setTotalProducts(productsRes.totalCount);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to connect to the marketplace backend. Please ensure the API is running."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMarketplaceData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchKeyword.trim()) {
      router.push(`/products?keyword=${encodeURIComponent(searchKeyword.trim())}`);
    } else {
      router.push("/products");
    }
  };

  const handleQuickTagClick = (tag: string) => {
    setSearchKeyword(tag);
    router.push(`/products?keyword=${encodeURIComponent(tag)}`);
  };

  return (
    <MobileViewportContainer
      header={<AppHeader />}
      footer={
        <div className="px-4 py-4 text-center text-xs text-ink-500 font-medium">
          <span>Non-Custodial Architecture · Trusted Marketplace Myanmar Pilot</span>
        </div>
      }
    >
      <div className="space-y-6 sm:space-y-8 py-2">
        {/* Active Session Notification (Role Contextual) */}
        {isAuthenticated && user && (
          <div className="px-3 py-2 rounded-xl bg-jade-50/80 border border-jade-200/60 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-ink-900 truncate">
                မင်္ဂလာပါ၊ {user.displayName}
              </span>
              <span className="text-[10px] text-jade-800 font-medium px-1.5 py-0.2 rounded bg-white/80 border border-jade-200 shrink-0">
                {isAdmin ? "Admin" : isSeller ? "Artisan Seller" : "Verified Buyer"}
              </span>
            </div>
            {isSeller ? (
              <Link
                href="/orders?tab=seller"
                className="text-[11px] font-semibold text-jade-800 hover:underline shrink-0 flex items-center gap-0.5"
              >
                <span>Orders</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            ) : (
              <Link
                href="/products"
                className="text-[11px] font-semibold text-jade-800 hover:underline shrink-0 flex items-center gap-0.5"
              >
                <span>Catalog</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        )}

        {/* Compact Marketplace Header & Discovery */}
        <section className="pt-1 pb-2 space-y-2.5">
          <div className="space-y-0.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-900 leading-snug">
              Direct from Myanmar Artisans
            </h1>
            <p className="text-xs text-ink-500 myanmar-text leading-relaxed">
              အတည်ပြုလက်မှတ်ရ လက်မှုပညာရှင်များထံမှ ကြားခံမလို တိုက်ရိုက်စိတ်ချစွာ ဝယ်ယူနိုင်ပါသည်။
            </p>
          </div>

          {/* Compact Search Bar */}
          <form onSubmit={handleSearchSubmit} className="pt-0.5">
            <div className="relative flex items-center w-full max-w-xl">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Search marionettes, lacquerware, textiles..."
                className="w-full pl-9 pr-20 py-2 rounded-xl bg-white border border-stone-300 text-ink-900 text-xs sm:text-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-jade-600/20 focus:border-jade-700 transition-all font-medium shadow-2xs"
              />
              <Search className="w-4 h-4 text-ink-400 absolute left-3 pointer-events-none" />
              <button
                type="submit"
                className="absolute right-1 px-3 py-1.5 rounded-lg bg-jade-800 hover:bg-jade-900 text-white font-semibold text-xs transition-colors shrink-0 cursor-pointer"
              >
                <span>Search</span>
              </button>
            </div>
          </form>

          {/* Quick Craft Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-500">
            <span className="font-medium text-ink-600">Popular:</span>
            {["Marionettes", "Lacquerware", "Lotus Silk"].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleQuickTagClick(tag)}
                className="px-2 py-0.5 rounded-lg bg-white border border-stone-200/90 hover:border-jade-300 text-ink-700 transition-colors shadow-2xs text-[11px] cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Connection Error</strong>
                <span>{error}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={loadMarketplaceData}
              className="px-2.5 py-1 rounded-lg bg-white border border-red-300 text-red-700 font-medium hover:bg-red-50 transition-colors shrink-0 flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Curated Products Section (Placed High for Immediate Visibility) */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between border-b border-stone-200/80 pb-2">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-ink-900 tracking-tight">
                Curated Craft Pieces
              </h2>
              <span className="text-[11px] text-ink-500">
                Verified Myanmar workshops ({totalProducts})
              </span>
            </div>
            <Link
              href="/products"
              className="text-xs font-semibold text-jade-800 hover:underline inline-flex items-center gap-0.5"
            >
              <span>All Catalog</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-stone-200 bg-white p-3 space-y-3 animate-pulse"
                >
                  <div className="aspect-4/3 bg-stone-200 rounded-xl" />
                  <div className="h-4 bg-stone-200 rounded w-3/4" />
                  <div className="h-4 bg-stone-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : featuredProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center rounded-3xl bg-white border border-stone-200 space-y-2">
              <Store className="w-7 h-7 text-ink-400 mx-auto" />
              <h3 className="font-semibold text-xs text-ink-800">No products available in this feed</h3>
              <p className="text-[11px] text-ink-500">
                Check back soon or explore categories in the full catalog.
              </p>
            </div>
          )}
        </section>

        {/* Traditional Craft Disciplines */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-600">
            Craft Disciplines
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <Link
              href="/products"
              className="p-3 rounded-xl bg-white border border-stone-200/80 hover:border-jade-500/40 hover:bg-stone-50/50 shadow-2xs transition-all space-y-0.5 block group"
            >
              <span className="font-bold text-xs text-ink-900 group-hover:text-jade-800 block">
                All Collections
              </span>
              <span className="text-[10px] text-ink-500 myanmar-text block">
                ပစ္စည်းအားလုံး ရှာဖွေရန်
              </span>
            </Link>

            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/products?categoryId=${cat.id}`}
                className="p-3 rounded-xl bg-white border border-stone-200/80 hover:border-jade-500/40 hover:bg-stone-50/50 shadow-2xs transition-all space-y-0.5 block group"
              >
                <span className="font-bold text-xs text-ink-900 group-hover:text-jade-800 block truncate">
                  {cat.name}
                </span>
                <span className="text-[10px] text-jade-700 myanmar-text block truncate">
                  {cat.slug}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Quiet Direct-Trade Reassurance (Single Line Footer Bar) */}
        <section className="pt-2 border-t border-stone-200/80 text-[11px] text-ink-600 grid grid-cols-1 sm:grid-cols-3 gap-3 py-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-jade-700 shrink-0" />
            <span>Government ID &amp; Workshop Audited</span>
          </div>
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-jade-700 shrink-0" />
            <span>Direct Mobile Settlement (KBZPay &amp; WavePay)</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-jade-700 shrink-0" />
            <span>Transaction-Linked Verified Reviews</span>
          </div>
        </section>
      </div>
    </MobileViewportContainer>
  );
}
