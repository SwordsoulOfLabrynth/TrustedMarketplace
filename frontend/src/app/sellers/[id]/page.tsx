"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ShieldCheck,
  Star,
  PackageCheck,
  ShieldAlert,
  MapPin,
  Phone,
  Calendar,
  AlertCircle,
  Store,
} from "lucide-react";
import { catalogApi } from "@/lib/catalog-api";
import {
  ProductDto,
  ReviewDto,
  SellerTrustProfileDto,
  StoreProfileDto,
} from "@/types/api";
import { MobileViewportContainer } from "@/components/layout/MobileViewportContainer";
import { AppHeader } from "@/components/layout/AppHeader";
import { ProductCard } from "@/components/marketplace/ProductCard";

interface SellerProfilePageProps {
  params: Promise<{ id: string }>;
}

export default function SellerProfilePage({ params }: SellerProfilePageProps) {
  const resolvedParams = use(params);
  const sellerId = resolvedParams.id;

  const [store, setStore] = useState<StoreProfileDto | null>(null);
  const [trustProfile, setTrustProfile] = useState<SellerTrustProfileDto | null>(null);
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [sellerProducts, setSellerProducts] = useState<ProductDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setIsNotFound(false);
    setError(null);

    (async () => {
      try {
        const [storeRes, trustRes, reviewsRes, catalogRes] = await Promise.all([
          catalogApi.getSellerStore(sellerId),
          catalogApi.getSellerTrustProfile(sellerId),
          catalogApi.getSellerReviews(sellerId),
          catalogApi.searchProducts({ pageSize: 100 }),
        ]);

        if (!isMounted) return;
        setStore(storeRes);
        setTrustProfile(trustRes);
        setReviews(reviewsRes.items);

        // Filter products for this seller
        const matching = catalogRes.items.filter(
          (p) => p.sellerUserId.toLowerCase() === sellerId.toLowerCase()
        );
        setSellerProducts(matching);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          setIsNotFound(true);
        } else {
          setError("Failed to load seller storefront. Please verify your connection.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [sellerId]);

  if (isLoading) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-6 space-y-4 animate-pulse">
          <div className="h-4 bg-stone-200 rounded w-1/4" />
          <div className="h-28 bg-stone-200 rounded-3xl" />
          <div className="h-16 bg-stone-200 rounded-2xl" />
          <div className="h-40 bg-stone-200 rounded-2xl" />
        </div>
      </MobileViewportContainer>
    );
  }

  if (isNotFound || !store) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-ink-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-base font-bold text-ink-900">
              Artisan Workshop Not Found
            </h1>
            <p className="text-xs text-ink-500 mt-1">
              The requested artisan workshop could not be found or has not been verified yet.
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jade-800 text-white font-semibold text-xs hover:bg-jade-900 transition-colors shadow-2xs"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Marketplace</span>
          </Link>
        </div>
      </MobileViewportContainer>
    );
  }

  const isVerified = trustProfile?.verificationStatus === "Verified";
  const verifiedDate = trustProfile?.verifiedSinceUtc
    ? new Date(trustProfile.verifiedSinceUtc).toLocaleDateString()
    : null;

  return (
    <MobileViewportContainer
      header={<AppHeader />}
      footer={
        <div className="px-4 py-3 text-center text-xs text-ink-500 font-medium">
          <span>Non-Custodial Architecture · Trusted Marketplace Myanmar Pilot</span>
        </div>
      }
    >
      <div className="space-y-6 py-2">
        {/* Back Link */}
        <nav className="text-xs text-ink-500 flex items-center gap-1">
          <Link
            href="/products"
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-700 hover:text-jade-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Catalog</span>
          </Link>
        </nav>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Official Artisan Workshop Header */}
        <section className="p-5 sm:p-7 rounded-3xl bg-white border border-stone-200/90 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-bold tracking-wider uppercase border border-stone-200">
                <Store className="w-3 h-3 text-jade-700" />
                <span>Verified Artisan Workshop</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-900 leading-tight">
                {store.storeName}
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border shadow-2xs flex items-center gap-1.5 ${
                  isVerified
                    ? "bg-jade-50 text-jade-800 border-jade-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                {isVerified ? (
                  <ShieldCheck className="w-4 h-4 text-jade-700" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                )}
                <span>{store.verificationStatus}</span>
              </span>
            </div>
          </div>

          {/* Bio */}
          {store.bio && (
            <p className="text-xs sm:text-sm text-ink-700 leading-relaxed myanmar-text max-w-3xl">
              {store.bio}
            </p>
          )}

          {/* Location & Metadata Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-stone-200/80 text-xs text-ink-600">
            {store.cityOrTownship && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-jade-700 shrink-0" />
                <span>Workshop: <strong className="text-ink-800">{store.cityOrTownship}</strong></span>
              </div>
            )}
            {store.contactPhone && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-jade-700 shrink-0" />
                <span>Contact Phone: <strong className="text-ink-800">{store.contactPhone}</strong></span>
              </div>
            )}
            {verifiedDate && (
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-500">
                <Calendar className="w-3.5 h-3.5 text-jade-700 shrink-0" />
                <span>Verified {verifiedDate}</span>
              </div>
            )}
          </div>
        </section>

        {/* PRIMARY: Artisan Handcrafted Pieces (Featured First!) */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1.5 border-b border-stone-200/80 pb-2.5">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-ink-900 tracking-tight">
                Handcrafted Pieces by {store.storeName}
              </h2>
              <p className="text-xs text-ink-500 mt-0.5">
                Authentic workshop pieces available for direct purchase ({sellerProducts.length})
              </p>
            </div>
            <Link
              href="/products"
              className="text-xs font-semibold text-jade-700 hover:text-jade-900 shrink-0 self-start sm:self-auto"
            >
              Browse all marketplace
            </Link>
          </div>

          {sellerProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
              {sellerProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center rounded-3xl bg-white border border-stone-200 text-xs text-ink-500">
              No active listings currently published by this artisan workshop.
            </div>
          )}
        </section>

        {/* SECONDARY: Trust Audit Record & Verified Buyer Reviews */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-2">
          {/* Trust Metrics Column */}
          {trustProfile && (
            <section className="lg:col-span-5 p-5 rounded-3xl bg-white border border-stone-200/90 shadow-2xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-jade-700" />
                <span>Workshop Trust Record</span>
              </h2>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-stone-50 rounded-2xl border border-stone-200">
                  <div className="flex items-center justify-center gap-1 text-amber-500 mb-0.5">
                    <Star className="w-4 h-4 fill-amber-400" />
                    <span className="font-bold text-base text-ink-900">
                      {trustProfile.averageRating.toFixed(1)}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-ink-600 block">
                    {trustProfile.reviewCount} {trustProfile.reviewCount === 1 ? "Review" : "Reviews"}
                  </span>
                </div>

                <div className="p-2.5 bg-stone-50 rounded-2xl border border-stone-200">
                  <div className="flex items-center justify-center gap-1 text-jade-700 mb-0.5">
                    <PackageCheck className="w-4 h-4" />
                    <span className="font-bold text-base text-ink-900">
                      {trustProfile.completedOrdersCount}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-ink-600 block">
                    Fulfilled Orders
                  </span>
                </div>

                <div className="p-2.5 bg-stone-50 rounded-2xl border border-stone-200">
                  <div className="flex items-center justify-center gap-1 text-blue-600 mb-0.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="font-bold text-base text-ink-900">
                      {trustProfile.resolvedComplaintsCount}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-ink-600 block">
                    Resolved Issues
                  </span>
                </div>
              </div>

              {/* Official Platform Disclaimer */}
              <p className="text-[11px] text-ink-500 leading-relaxed border-t border-stone-100 pt-3">
                {trustProfile.disclaimer}
              </p>
            </section>
          )}

          {/* Verified Reviews Column */}
          <section className="lg:col-span-7 space-y-3">
            <div className="flex items-baseline justify-between border-b border-stone-200/80 pb-2">
              <h2 className="text-sm font-bold text-ink-900 tracking-tight">
                Verified Buyer Reviews ({reviews.length})
              </h2>
              <span className="text-[11px] text-ink-500 font-mono">
                Transaction-Linked
              </span>
            </div>

            {reviews.length > 0 ? (
              <div className="space-y-3">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < rev.rating
                                ? "text-amber-400 fill-amber-400"
                                : "text-stone-200"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] font-mono text-ink-400">
                        {new Date(rev.createdAtUtc).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs text-ink-800 leading-relaxed myanmar-text">
                      &ldquo;{rev.comment}&rdquo;
                    </p>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[10px] text-ink-500">
                      <span className="flex items-center gap-1 font-semibold text-jade-700">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Verified Transaction</span>
                      </span>
                      <span className="font-mono">
                        Buyer: {rev.reviewerUserId.substring(0, 8)}...
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center rounded-2xl bg-white border border-stone-200 text-xs text-ink-500 space-y-1">
                <span>No buyer reviews recorded yet.</span>
                <p className="text-[11px] text-ink-400">
                  Reviews are strictly transaction-linked and can only be submitted after verified delivery confirmation.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </MobileViewportContainer>
  );
}
