"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Loader2,
  Save,
  CheckCircle2,
  ExternalLink,
  Archive,
  Globe,
  Camera,
  FileText,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { catalogApi } from "@/lib/catalog-api";
import { sellerProductsApi } from "@/lib/seller-products-api";
import { CategoryDto, ProductDto, ProductImageDto, UpdateProductRequest } from "@/types/api";
import { MobileViewportContainer } from "@/components/layout/MobileViewportContainer";
import { AppHeader } from "@/components/layout/AppHeader";
import { ProductImageUploader } from "@/components/seller/ProductImageUploader";
import { ApiException } from "@/lib/api-client";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default function EditProductPage({ params }: EditProductPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedParams = use(params);
  const productId = resolvedParams.id;
  const isJustCreated = searchParams.get("created") === "true";

  const { user, store, isAuthenticated, isLoading: authLoading, isSeller } = useAuth();

  const [product, setProduct] = useState<ProductDto | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priceAmount, setPriceAmount] = useState<number | "">("");
  const [condition, setCondition] = useState("New");
  const [description, setDescription] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/auth/login?returnUrl=/seller/products/${productId}/edit`);
    }
  }, [authLoading, isAuthenticated, productId, router]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let isMounted = true;
    setIsLoading(true);
    setIsUnauthorized(false);
    setIsNotFound(false);
    setFormError(null);

    (async () => {
      try {
        const [prodData, cats] = await Promise.all([
          sellerProductsApi.getProductById(productId),
          catalogApi.getCategories(),
        ]);

        if (!isMounted) return;

        // Security check: Must belong to current seller
        if (prodData.sellerUserId.toLowerCase() !== user.id.toLowerCase()) {
          setIsUnauthorized(true);
          setIsLoading(false);
          return;
        }

        setProduct(prodData);
        setCategories(cats);
        setTitle(prodData.title);
        setCategoryId(prodData.categoryId);
        setPriceAmount(prodData.priceAmount);
        setCondition(prodData.condition || "New");
        setDescription(prodData.description);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          setIsNotFound(true);
        } else if (msg.includes("403") || msg.toLowerCase().includes("forbidden")) {
          setIsUnauthorized(true);
        } else {
          setFormError("Failed to load product details. Please check your connection.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [productId, isAuthenticated, user]);

  const handleImagesChange = (updatedImages: ProductImageDto[]) => {
    setProduct((prev) => (prev ? { ...prev, images: updatedImages } : null));
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!title.trim()) {
      setFormError("Product title cannot be empty.");
      return;
    }
    if (!categoryId) {
      setFormError("Please select a category.");
      return;
    }
    if (priceAmount === "" || priceAmount <= 0) {
      setFormError("Please enter a valid price greater than 0 MMK.");
      return;
    }
    if (!description.trim()) {
      setFormError("Please provide an artisan description.");
      return;
    }

    setIsSubmitting(true);

    try {
      const updateReq: UpdateProductRequest = {
        title: title.trim(),
        categoryId,
        priceAmount: Number(priceAmount),
        condition,
        description: description.trim(),
      };

      const updated = await sellerProductsApi.updateProduct(productId, updateReq);
      setProduct((prev) => (prev ? { ...prev, ...updated } : updated));
      setFormSuccess("Product details saved successfully.");
      setTimeout(() => setFormSuccess(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof ApiException ? err.message : "Failed to update product details.";
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(true);
    try {
      const published = await sellerProductsApi.publishProduct(productId);
      setProduct((prev) => (prev ? { ...prev, status: "Published" } : published));
      setFormSuccess("Listing is now published live on the public catalog!");
      setTimeout(() => setFormSuccess(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof ApiException ? err.message : "Failed to publish listing.";
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(true);
    try {
      const archived = await sellerProductsApi.archiveProduct(productId);
      setProduct((prev) => (prev ? { ...prev, status: "Archived" } : archived));
      setFormSuccess("Listing has been archived and hidden from public search.");
      setTimeout(() => setFormSuccess(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof ApiException ? err.message : "Failed to archive listing.";
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-jade-700 mx-auto" />
          <p className="text-xs text-ink-500">Loading product editor...</p>
        </div>
      </MobileViewportContainer>
    );
  }

  // Strict ownership boundary: Never expose another seller's image-management controls
  if (isUnauthorized) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-16 max-w-md mx-auto text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-bold text-ink-900">Access Restricted</h1>
            <p className="text-xs text-ink-600 leading-relaxed">
              You do not own this product listing. Image management and listing edits are strictly restricted to the verified artisan workshop account that created it.
            </p>
          </div>
          <Link
            href="/seller/products"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jade-800 text-white font-semibold text-xs hover:bg-jade-900 transition-colors shadow-2xs"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Return to My Listings</span>
          </Link>
        </div>
      </MobileViewportContainer>
    );
  }

  if (isNotFound || !product) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-16 max-w-md mx-auto text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-bold text-ink-900">Product Not Found</h1>
            <p className="text-xs text-ink-500">
              The requested listing does not exist or has been permanently removed.
            </p>
          </div>
          <Link
            href="/seller/products"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jade-800 text-white font-semibold text-xs hover:bg-jade-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Return to My Listings</span>
          </Link>
        </div>
      </MobileViewportContainer>
    );
  }

  return (
    <MobileViewportContainer
      header={<AppHeader />}
      footer={
        <div className="px-4 py-3 text-center text-xs text-ink-500 font-medium">
          <span>Non-Custodial Architecture · MatchGuard Myanmar Pilot</span>
        </div>
      }
    >
      <div className="space-y-6 py-2 max-w-3xl mx-auto">
        {/* Navigation & Header */}
        <div className="space-y-3 border-b border-stone-200/80 pb-4">
          <nav className="text-xs text-ink-500 flex items-center justify-between">
            <Link
              href="/seller/products"
              className="inline-flex items-center gap-1 font-semibold text-ink-700 hover:text-jade-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to My Listings</span>
            </Link>

            {product.status === "Published" && (
              <Link
                href={`/products/${product.id}`}
                target="_blank"
                className="inline-flex items-center gap-1 font-semibold text-jade-800 hover:underline"
              >
                <span>View Public Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    product.status === "Published"
                      ? "bg-jade-50 text-jade-800 border border-jade-200"
                      : product.status === "Draft"
                      ? "bg-amber-50 text-amber-800 border border-amber-200"
                      : "bg-stone-100 text-stone-600 border border-stone-200"
                  }`}
                >
                  {product.status} Listing
                </span>
                <span className="text-xs text-ink-400 font-mono">
                  ID: {product.id.substring(0, 8)}...
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-900 leading-snug">
                {product.title}
              </h1>
            </div>

            {/* Publication / Status Action */}
            <div className="flex items-center gap-2">
              {product.status === "Draft" ? (
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jade-800 hover:bg-jade-900 disabled:opacity-50 text-white font-semibold text-xs shadow-2xs transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Publish to Catalog</span>
                </button>
              ) : product.status === "Published" ? (
                <button
                  type="button"
                  onClick={handleArchive}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 hover:bg-red-50 hover:text-red-700 text-ink-700 font-semibold text-xs transition-colors"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jade-800 hover:bg-jade-900 text-white font-semibold text-xs shadow-2xs transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Re-publish</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Just Created Banner */}
        {isJustCreated && (
          <div className="p-3.5 rounded-2xl bg-jade-50 border border-jade-200 text-jade-900 text-xs flex items-start gap-2.5 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-jade-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Product draft created successfully!</p>
              <p className="text-jade-800 mt-0.5 leading-relaxed">
                Now upload genuine workshop photography below. The first photo you upload will automatically become your catalog cover photo.
              </p>
            </div>
          </div>
        )}

        {/* Global Notifications */}
        {formError && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2.5 shadow-2xs"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {formSuccess && (
          <div
            role="status"
            className="p-3.5 rounded-2xl bg-jade-50 border border-jade-200 text-jade-800 text-xs flex items-center gap-2.5 shadow-2xs"
          >
            <CheckCircle2 className="w-4 h-4 text-jade-600 shrink-0" />
            <span>{formSuccess}</span>
          </div>
        )}

        {/* SECTION 1: PRODUCT PHOTOGRAPHY WORKBENCH */}
        <section className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/90 shadow-2xs space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink-900">
                <Camera className="w-4 h-4 text-jade-700" />
                <span>Genuine Product Photography</span>
              </div>
              <p className="text-[11px] text-ink-500">
                High-resolution craft photos elevate buyer trust and showcase authenticity.
              </p>
            </div>

            <span className="text-[11px] font-mono font-medium text-ink-500 px-2 py-0.5 rounded bg-stone-100">
              {product.images?.length || 0} / 8 photos
            </span>
          </div>

          <ProductImageUploader
            productId={product.id}
            images={product.images || []}
            onImagesChange={handleImagesChange}
            disabled={isSubmitting}
          />
        </section>

        {/* SECTION 2: LISTING METADATA FORM */}
        <section className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/90 shadow-2xs space-y-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-ink-900 border-b border-stone-100 pb-3">
            <FileText className="w-4 h-4 text-jade-700" />
            <span>Listing Details &amp; Pricing</span>
          </div>

          <form onSubmit={handleSaveDetails} className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <label htmlFor="edit-title" className="block text-xs font-bold text-ink-900">
                Product Title <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-jade-600/30 focus:border-jade-600"
              />
            </div>

            {/* Category & Condition Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="edit-category" className="block text-xs font-bold text-ink-900">
                  Craft Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-jade-600/30 focus:border-jade-600 bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-condition" className="block text-xs font-bold text-ink-900">
                  Item Condition <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit-condition"
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
              <label htmlFor="edit-price" className="block text-xs font-bold text-ink-900">
                Price (MMK) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="edit-price"
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={priceAmount}
                  onChange={(e) =>
                    setPriceAmount(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-jade-600/30 focus:border-jade-600 font-mono"
                />
                <span className="absolute right-3.5 top-2.5 text-xs font-bold text-ink-500">
                  MMK
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label htmlFor="edit-description" className="block text-xs font-bold text-ink-900">
                Artisan Description &amp; Origin <span className="text-red-500">*</span>
              </label>
              <textarea
                id="edit-description"
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-jade-600/30 focus:border-jade-600 leading-relaxed myanmar-text"
              />
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-jade-800 hover:bg-jade-900 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-2xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Listing Details</span>
                </>
              )}
            </button>
          </form>
        </section>
      </div>
    </MobileViewportContainer>
  );
}
