"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ArrowRight,
  Package,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { catalogApi } from "@/lib/catalog-api";
import { sellerProductsApi } from "@/lib/seller-products-api";
import { CategoryDto, CreateProductRequest } from "@/types/api";
import { MobileViewportContainer } from "@/components/layout/MobileViewportContainer";
import { AppHeader } from "@/components/layout/AppHeader";
import { ApiException } from "@/lib/api-client";

export default function NewProductPage() {
  const router = useRouter();
  const { user, store, isAuthenticated, isLoading: authLoading, isSeller } = useAuth();

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Form State
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priceAmount, setPriceAmount] = useState<number | "">("");
  const [condition, setCondition] = useState("New");
  const [description, setDescription] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login?returnUrl=/seller/products/new");
    } else if (!authLoading && !isSeller) {
      router.push("/orders");
    }
  }, [authLoading, isAuthenticated, isSeller, router]);

  useEffect(() => {
    (async () => {
      try {
        const cats = await catalogApi.getCategories();
        setCategories(cats);
        if (cats.length > 0) {
          setCategoryId(cats[0].id);
        }
      } catch (err: unknown) {
        setError("Failed to load catalog categories. Please refresh the page.");
      } finally {
        setIsLoadingCategories(false);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please provide a product title.");
      return;
    }
    if (!categoryId) {
      setError("Please select a category.");
      return;
    }
    if (priceAmount === "" || priceAmount <= 0) {
      setError("Please specify a valid price greater than 0 MMK.");
      return;
    }
    if (!description.trim()) {
      setError("Please describe the craft materials, origin, and details.");
      return;
    }

    setIsSubmitting(true);

    try {
      const request: CreateProductRequest = {
        title: title.trim(),
        categoryId,
        priceAmount: Number(priceAmount),
        condition,
        description: description.trim(),
        currencyCode: "MMK",
      };

      const created = await sellerProductsApi.createProduct(request);
      // Navigate to the edit page where the seller can immediately upload photos!
      router.push(`/seller/products/${created.id}/edit?created=true`);
    } catch (err: unknown) {
      let msg = "Failed to create product listing. Please check your inputs.";
      if (err instanceof ApiException) {
        msg = err.message;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <MobileViewportContainer
      header={<AppHeader />}
      footer={
        <div className="px-4 py-3 text-center text-xs text-ink-500 font-medium">
          <span>Non-Custodial Architecture · MatchGuard Myanmar Pilot</span>
        </div>
      }
    >
      <div className="space-y-6 py-2 max-w-2xl mx-auto">
        {/* Back Link */}
        <nav className="text-xs text-ink-500 flex items-center gap-1">
          <Link
            href="/seller/products"
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-700 hover:text-jade-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to My Listings</span>
          </Link>
        </nav>

        {/* Heading */}
        <div className="space-y-1 border-b border-stone-200/80 pb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-jade-50 text-jade-800 border border-jade-200">
              <ShieldCheck className="w-3 h-3 text-jade-700" />
              <span>{store?.storeName || "Artisan Workshop"}</span>
            </span>
            <span className="text-xs text-amber-700 font-semibold">Draft Listing</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-900">
            Create New Product Listing
          </h1>
          <p className="text-xs text-ink-500">
            Enter your product details below. You can upload authentic workshop photography in the next step.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2.5 shadow-2xs"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Product Details Form */}
        <form onSubmit={handleSubmit} className="space-y-5 bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/90 shadow-2xs">
          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="product-title" className="block text-xs font-bold text-ink-900">
              Product Title <span className="text-red-500">*</span>
            </label>
            <input
              id="product-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g., Mandalay Handwoven Silk Longyi, Bagan Lacquerware Bowl"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-jade-600/30 focus:border-jade-600 transition-colors"
            />
          </div>

          {/* Category & Condition Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div className="space-y-1.5">
              <label htmlFor="product-category" className="block text-xs font-bold text-ink-900">
                Craft Category <span className="text-red-500">*</span>
              </label>
              <select
                id="product-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={isSubmitting || isLoadingCategories}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-jade-600/30 focus:border-jade-600 bg-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Condition */}
            <div className="space-y-1.5">
              <label htmlFor="product-condition" className="block text-xs font-bold text-ink-900">
                Item Condition <span className="text-red-500">*</span>
              </label>
              <select
                id="product-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-jade-600/30 focus:border-jade-600 bg-white"
              >
                <option value="New">New (Brand New / Handcrafted)</option>
                <option value="LikeNew">Like New</option>
                <option value="Good">Good Condition</option>
                <option value="Vintage">Vintage / Heritage Piece</option>
              </select>
            </div>
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <label htmlFor="product-price" className="block text-xs font-bold text-ink-900">
              Price (MMK) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="product-price"
                type="number"
                min="1"
                step="any"
                required
                value={priceAmount}
                onChange={(e) =>
                  setPriceAmount(e.target.value === "" ? "" : Number(e.target.value))
                }
                disabled={isSubmitting}
                placeholder="25000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-jade-600/30 focus:border-jade-600 font-mono"
              />
              <span className="absolute right-3.5 top-2.5 text-xs font-bold text-ink-500">
                MMK
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="product-description" className="block text-xs font-bold text-ink-900">
              Artisan Description &amp; Origin <span className="text-red-500">*</span>
            </label>
            <textarea
              id="product-description"
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              placeholder="Describe the artisan technique, materials, origin township, and dimensions..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-jade-600/30 focus:border-jade-600 transition-colors myanmar-text leading-relaxed"
            />
          </div>

          {/* Step Guidance Notice */}
          <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 text-xs text-ink-600 flex items-start gap-2">
            <Package className="w-4 h-4 text-jade-700 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Step 1 of 2: Create your product draft. On the next screen, you will upload and arrange genuine workshop photography before publishing.
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-5 rounded-2xl bg-jade-800 hover:bg-jade-900 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating draft...</span>
              </>
            ) : (
              <>
                <span>Save Draft &amp; Proceed to Photography</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </MobileViewportContainer>
  );
}
