"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  ShoppingBag,
  SlidersHorizontal,
} from "lucide-react";
import { catalogApi } from "@/lib/catalog-api";
import { CategoryDto, ProductDto } from "@/types/api";
import { MobileViewportContainer } from "@/components/layout/MobileViewportContainer";
import { AppHeader } from "@/components/layout/AppHeader";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { CategoryPill } from "@/components/marketplace/CategoryPill";

function ProductCatalogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL state
  const currentKeyword = searchParams.get("keyword") || "";
  const currentCategoryId = searchParams.get("categoryId") || "";
  const currentMinPrice = searchParams.get("minPrice") || "";
  const currentMaxPrice = searchParams.get("maxPrice") || "";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);

  // Local form inputs
  const [searchInput, setSearchInput] = useState(currentKeyword);
  const [minPriceInput, setMinPriceInput] = useState(currentMinPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(currentMaxPrice);
  const [showPriceFilter, setShowPriceFilter] = useState(false);

  // Data state
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [pageSize] = useState<number>(10);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync inputs when URL changes
  useEffect(() => {
    setSearchInput(currentKeyword);
    setMinPriceInput(currentMinPrice);
    setMaxPriceInput(currentMaxPrice);
  }, [currentKeyword, currentMinPrice, currentMaxPrice]);

  // Push URL update helper
  const updateUrl = useCallback(
    (params: Record<string, string | number | undefined | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(params)) {
        if (val === undefined || val === null || val === "") {
          sp.delete(key);
        } else {
          sp.set(key, String(val));
        }
      }
      router.push(`/products?${sp.toString()}`);
    },
    [router, searchParams]
  );

  // Fetch categories once
  useEffect(() => {
    catalogApi
      .getCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Fetch products whenever search params change
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    catalogApi
      .searchProducts({
        keyword: currentKeyword || undefined,
        categoryId: currentCategoryId || undefined,
        minPrice: currentMinPrice ? parseFloat(currentMinPrice) : undefined,
        maxPrice: currentMaxPrice ? parseFloat(currentMaxPrice) : undefined,
        page: currentPage,
        pageSize,
      })
      .then((res) => {
        if (isMounted) {
          setProducts(res.items);
          setTotalCount(res.totalCount);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load products from catalog."
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentKeyword, currentCategoryId, currentMinPrice, currentMaxPrice, currentPage, pageSize]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrl({ keyword: searchInput.trim(), page: 1 });
  };

  const handleCategorySelect = (catId?: string) => {
    updateUrl({ categoryId: catId || undefined, page: 1 });
  };

  const handlePriceApply = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrl({
      minPrice: minPriceInput ? parseFloat(minPriceInput) : undefined,
      maxPrice: maxPriceInput ? parseFloat(maxPriceInput) : undefined,
      page: 1,
    });
    setShowPriceFilter(false);
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setMinPriceInput("");
    setMaxPriceInput("");
    router.push("/products");
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const hasActiveFilters = Boolean(
    currentKeyword || currentCategoryId || currentMinPrice || currentMaxPrice
  );

  return (
    <MobileViewportContainer
      header={<AppHeader />}
      footer={
        <div className="px-4 py-3 text-center text-xs text-ink-500 font-medium">
          <span>Non-Custodial Architecture · MatchGuard Myanmar</span>
        </div>
      }
    >
      <div className="space-y-4 py-3">
        {/* Page Title & Breadcrumbs */}
        <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
          <div>
            <nav className="text-[11px] text-ink-500 flex items-center gap-1 mb-0.5">
              <Link href="/" className="hover:underline">
                Home
              </Link>
              <span>/</span>
              <span className="text-ink-800 font-medium">Catalog</span>
            </nav>
            <h1 className="text-lg sm:text-xl font-bold text-ink-900 tracking-tight">
              Artisan Catalog
            </h1>
          </div>

          <span className="text-xs text-ink-500 font-mono bg-white px-2.5 py-1 rounded-lg border border-stone-200 shadow-2xs">
            {totalCount} {totalCount === 1 ? "piece" : "pieces"}
          </span>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search crafts, materials, or artisans — e.g. marionette, lacquerware, lotus silk..."
              className="w-full pl-9 pr-8 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-jade-600/20 focus:border-jade-700 transition-all shadow-2xs font-medium"
            />
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-3 pointer-events-none" />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  updateUrl({ keyword: undefined, page: 1 });
                }}
                className="absolute right-2.5 top-3 text-ink-400 hover:text-ink-700"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Price Filter Toggle Button */}
          <button
            type="button"
            onClick={() => setShowPriceFilter(!showPriceFilter)}
            className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors shadow-2xs flex items-center justify-center shrink-0 gap-1.5 ${
              showPriceFilter || currentMinPrice || currentMaxPrice
                ? "bg-jade-50 border-jade-300 text-jade-800 font-semibold"
                : "bg-white border-stone-300 text-ink-700 hover:bg-stone-50"
            }`}
            title="Filter by price bounds"
            aria-label="Filter by price bounds"
          >
            <SlidersHorizontal className="w-4 h-4 text-jade-700" />
            <span className="hidden sm:inline text-xs">Price</span>
          </button>
        </form>

        {/* Quick Semantic Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-500 pt-0.5">
          <span className="font-medium text-ink-600 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-jade-600" />
            <span>Try:</span>
          </span>
          {[
            { label: "Puppets (Marionettes)", q: "Puppets" },
            { label: "Lacquerware", q: "Lacquerware" },
            { label: "Lotus Silk", q: "Lotus Silk" },
            { label: "Teakwood", q: "Teakwood" },
            { label: "Tea", q: "Tea" },
          ].map(({ label, q }) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setSearchInput(q);
                updateUrl({ keyword: q, page: 1 });
              }}
              className={`px-2 py-0.5 rounded-lg border text-[11px] transition-colors shadow-2xs cursor-pointer ${
                currentKeyword === q
                  ? "bg-jade-100 border-jade-400 text-jade-900 font-semibold"
                  : "bg-white border-stone-200 hover:border-jade-300 text-ink-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Collapsible Price Filter Panel */}
        {showPriceFilter && (
          <form
            onSubmit={handlePriceApply}
            className="p-3 rounded-2xl bg-white border border-jade-200 space-y-2.5 shadow-xs animate-fade-in"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-800 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-jade-700" />
                <span>Price Bounds (MMK)</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setMinPriceInput("");
                  setMaxPriceInput("");
                  updateUrl({ minPrice: undefined, maxPrice: undefined, page: 1 });
                }}
                className="text-[11px] text-ink-500 hover:text-red-600 hover:underline"
              >
                Reset Price
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="minPrice"
                  className="block text-[10px] font-semibold text-ink-600 mb-0.5"
                >
                  Min Price (MMK)
                </label>
                <input
                  id="minPrice"
                  type="number"
                  min="0"
                  step="any"
                  value={minPriceInput}
                  onChange={(e) => setMinPriceInput(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-ivory-300 bg-ivory-100/60 text-ink-900 focus:outline-none focus:border-jade-600"
                />
              </div>

              <div>
                <label
                  htmlFor="maxPrice"
                  className="block text-[10px] font-semibold text-ink-600 mb-0.5"
                >
                  Max Price (MMK)
                </label>
                <input
                  id="maxPrice"
                  type="number"
                  min="0"
                  step="any"
                  value={maxPriceInput}
                  onChange={(e) => setMaxPriceInput(e.target.value)}
                  placeholder="100000"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-ivory-300 bg-ivory-100/60 text-ink-900 focus:outline-none focus:border-jade-600"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-1.5 px-3 rounded-lg bg-jade-700 hover:bg-jade-800 text-white font-semibold text-xs transition-colors"
            >
              Apply Price Filter
            </button>
          </form>
        )}

        {/* Category Horizontal Filter Carousel */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <CategoryPill
            name="All"
            isActive={!currentCategoryId}
            onClick={() => handleCategorySelect(undefined)}
          />
          {categories.map((cat) => (
            <CategoryPill
              key={cat.id}
              name={cat.name}
              isActive={currentCategoryId === cat.id}
              onClick={() => handleCategorySelect(cat.id)}
            />
          ))}
        </div>

        {/* Active Filters Clear Bar */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-ink-600 text-[11px]">
              Filters active:{" "}
              {currentKeyword && <span className="font-semibold text-ink-900">&quot;{currentKeyword}&quot; </span>}
              {currentMinPrice && <span>&ge; {currentMinPrice} MMK </span>}
              {currentMaxPrice && <span>&le; {currentMaxPrice} MMK </span>}
            </span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-jade-700 font-semibold text-[11px] hover:underline flex items-center gap-0.5"
            >
              <X className="w-3 h-3" />
              <span>Clear All</span>
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start justify-between gap-2 shadow-2xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => updateUrl({ page: currentPage })}
              className="px-2 py-0.5 rounded bg-white text-red-700 border border-red-300 text-xs font-medium flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-stone-200/80 bg-white p-3 space-y-3 animate-pulse"
              >
                <div className="aspect-4/3 bg-stone-100 rounded-xl" />
                <div className="h-4 bg-stone-100 rounded w-3/4" />
                <div className="h-4 bg-stone-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="p-10 text-center rounded-3xl bg-white border border-ivory-300 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-ivory-200 text-ink-500 flex items-center justify-center mx-auto">
              <ShoppingBag className="w-6 h-6 text-ink-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-ink-900">
                No matching products found
              </h3>
              <p className="text-xs text-ink-500 mt-0.5">
                Try adjusting your keywords, category, or price range filters.
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 rounded-xl bg-jade-700 text-white font-semibold text-xs hover:bg-jade-800 transition-colors inline-flex items-center gap-1.5 shadow-2xs"
              >
                <span>Reset All Filters</span>
              </button>
            )}
          </div>
        )}

        {/* Pagination Bar */}
        {!isLoading && totalPages > 1 && (
          <div className="pt-2 flex items-center justify-between border-t border-ivory-300 text-xs text-ink-700">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => updateUrl({ page: currentPage - 1 })}
              className="px-3 py-1.5 rounded-xl border border-ivory-300 bg-white hover:bg-ivory-200/60 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium transition-colors shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="font-mono text-[11px] text-ink-600">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => updateUrl({ page: currentPage + 1 })}
              className="px-3 py-1.5 rounded-xl border border-ivory-300 bg-white hover:bg-ivory-200/60 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium transition-colors shadow-2xs"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </MobileViewportContainer>
  );
}

export default function ProductCatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-ivory-100">
          <div className="w-6 h-6 border-2 border-jade-700 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ProductCatalogContent />
    </Suspense>
  );
}
