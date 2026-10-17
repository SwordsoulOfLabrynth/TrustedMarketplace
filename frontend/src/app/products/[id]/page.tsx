"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Tag,
  Store,
  Phone,
  MapPin,
  Clock,
  ArrowRight,
  AlertCircle,
  ShoppingBag,
  Edit3,
} from "lucide-react";
import { catalogApi, getProductImageUrl } from "@/lib/catalog-api";
import { ProductDto, SellerTrustProfileDto, StoreProfileDto } from "@/types/api";
import { useAuth } from "@/lib/auth-context";
import { MobileViewportContainer } from "@/components/layout/MobileViewportContainer";
import { AppHeader } from "@/components/layout/AppHeader";
import { ProductArtwork } from "@/components/marketplace/ProductArtwork";
import { OrderPlacementModal } from "@/components/orders/OrderPlacementModal";

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const productId = resolvedParams.id;

  const { user, isAuthenticated } = useAuth();

  const [product, setProduct] = useState<ProductDto | null>(null);
  const [store, setStore] = useState<StoreProfileDto | null>(null);
  const [trustProfile, setTrustProfile] = useState<SellerTrustProfileDto | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState<boolean>(false);
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
        const prod = await catalogApi.getProductById(productId);
        if (!isMounted) return;
        setProduct(prod);

        // Fetch seller store & trust profile concurrently
        try {
          const [storeData, trustData] = await Promise.all([
            catalogApi.getSellerStore(prod.sellerUserId),
            catalogApi.getSellerTrustProfile(prod.sellerUserId),
          ]);
          if (isMounted) {
            setStore(storeData);
            setTrustProfile(trustData);
          }
        } catch {
          // If seller profile endpoints fail or 404, proceed gracefully
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          setIsNotFound(true);
        } else {
          setError("Failed to load product details. Please check your network connection.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  if (isLoading) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-6 space-y-4 animate-pulse">
          <div className="h-4 bg-stone-200 rounded w-1/4" />
          <div className="aspect-4/3 bg-stone-200 rounded-3xl" />
          <div className="h-6 bg-stone-200 rounded w-3/4" />
          <div className="h-4 bg-stone-200 rounded w-1/3" />
          <div className="h-20 bg-stone-200 rounded-2xl" />
        </div>
      </MobileViewportContainer>
    );
  }

  if (isNotFound || !product) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-ink-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-base font-bold text-ink-900">
              Product Not Found
            </h1>
            <p className="text-xs text-ink-500 mt-1">
              The requested product could not be found or has been unlisted.
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jade-800 text-white font-semibold text-xs hover:bg-jade-900 transition-colors shadow-2xs"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Catalog</span>
          </Link>
        </div>
      </MobileViewportContainer>
    );
  }

  const formattedPrice = new Intl.NumberFormat("en-US").format(product.priceAmount);
  const isOwnProduct = user?.id.toLowerCase() === product.sellerUserId.toLowerCase();

  const handleOrderClick = () => {
    if (!isAuthenticated) {
      router.push(`/auth/login?returnUrl=/products/${product.id}`);
      return;
    }
    setIsOrderModalOpen(true);
  };

  return (
    <MobileViewportContainer
      header={<AppHeader />}
      footer={
        <div className="px-4 py-3 text-center text-xs text-ink-500 font-medium">
          <span>Non-Custodial Architecture · Trusted Marketplace Myanmar Pilot</span>
        </div>
      }
    >
      <div className="space-y-5 py-2">
        {/* Breadcrumb Navigation */}
        <nav className="text-xs text-ink-500 flex items-center gap-1.5">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span>/</span>
          <Link href="/products" className="hover:underline">
            Catalog
          </Link>
          <span>/</span>
          <span className="text-ink-800 font-medium truncate max-w-[200px] sm:max-w-xs">
            {product.categoryName}
          </span>
        </nav>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 2-Column Editorial Spread */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
          {/* Left Column: Product Visual */}
          <div className="lg:col-span-6 space-y-3">
            {(() => {
              const hasMultipleImages = product.images && product.images.length > 1;
              const activeImage =
                product.images?.[selectedImageIndex] ||
                product.images?.find((img) => img.isPrimary) ||
                product.images?.[0];
              const activeImageUrl = getProductImageUrl(activeImage, product.id);

              return (
                <>
                  <div className="relative rounded-3xl overflow-hidden border border-stone-200/90 shadow-2xs bg-white group">
                    <ProductArtwork
                      title={product.title}
                      categoryName={product.categoryName}
                      imageUrl={activeImageUrl}
                      aspectRatio="landscape"
                    />

                    {/* Prev / Next controls for multi-photo listings */}
                    {hasMultipleImages && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedImageIndex((prev) =>
                              prev > 0 ? prev - 1 : product.images.length - 1
                            )
                          }
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 sm:opacity-75 focus:opacity-100 cursor-pointer"
                          title="Previous photo"
                          aria-label="Previous photo"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedImageIndex((prev) =>
                              prev < product.images.length - 1 ? prev + 1 : 0
                            )
                          }
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 sm:opacity-75 focus:opacity-100 cursor-pointer"
                          title="Next photo"
                          aria-label="Next photo"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>

                        <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/60 text-white font-mono text-[10px] backdrop-blur-xs font-semibold select-none">
                          {selectedImageIndex + 1} / {product.images.length}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Thumbnail Strip for Multi-Photo Listings */}
                  {hasMultipleImages && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {product.images.map((img, idx) => {
                        const thumbUrl = getProductImageUrl(img, product.id);
                        const isSelected = idx === selectedImageIndex;
                        return (
                          <button
                            key={img.id}
                            type="button"
                            onClick={() => setSelectedImageIndex(idx)}
                            className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all bg-stone-100 cursor-pointer ${
                              isSelected
                                ? "border-jade-700 ring-2 ring-jade-700/20"
                                : "border-stone-200 hover:border-stone-300 opacity-70 hover:opacity-100"
                            }`}
                            title={`View photo ${idx + 1}`}
                            aria-label={`View photo ${idx + 1}`}
                          >
                            {thumbUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={thumbUrl}
                                alt={`${product.title} thumbnail ${idx + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-stone-400 font-mono">
                                #{idx + 1}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}

            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-ink-500 px-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-jade-700 shrink-0" />
                <span>Handcrafted in Myanmar · Verified Workshop</span>
              </span>
              <span className="font-mono text-ink-700 font-medium">Condition: {product.condition}</span>
            </div>
          </div>

          {/* Right Column: Title, Maker, Price, Order Action & Description */}
          <div className="lg:col-span-6 space-y-5">
            {/* Title & Artisan Provenance */}
            <div className="space-y-2 border-b border-stone-200/80 pb-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                  <Tag className="w-3 h-3 text-jade-700" />
                  <span>{product.categoryName}</span>
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-ink-900 leading-snug">
                {product.title}
              </h1>

              {/* Maker Byline */}
              <div className="flex items-center gap-2 pt-1 text-xs text-ink-600">
                <span>Crafted by</span>
                <Link
                  href={`/sellers/${product.sellerUserId}`}
                  className="font-bold text-jade-800 hover:underline flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-jade-600" />
                  <span>{product.storeName}</span>
                </Link>
                {store?.cityOrTownship && (
                  <span className="text-ink-400">· {store.cityOrTownship}</span>
                )}
              </div>
            </div>

            {/* Price & Order Action */}
            <div className="space-y-3.5">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-jade-800 tracking-tight">
                  {formattedPrice}
                </span>
                <span className="text-sm font-semibold text-ink-600">
                  {product.currencyCode}
                </span>
              </div>

              {isOwnProduct ? (
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-ink-700 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink-900">Your Workshop Listing</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-stone-200 text-ink-800 uppercase tracking-wider">
                      {product.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-500 leading-relaxed">
                    Self-ordering is disabled for your own store. You can manage this listing, update details, or upload genuine workshop photography.
                  </p>
                  <Link
                    href={`/seller/products/${product.id}/edit`}
                    className="w-full py-2.5 px-4 rounded-xl bg-jade-800 hover:bg-jade-900 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit Listing &amp; Photography</span>
                  </Link>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleOrderClick}
                  className="w-full py-3.5 px-5 rounded-2xl bg-jade-800 hover:bg-jade-900 text-white font-bold text-sm tracking-wide shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{isAuthenticated ? "Order Directly from Artisan" : "Sign In to Place Order"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              <p className="text-[11px] text-ink-500 text-center leading-relaxed">
                Direct non-custodial transaction: After placing your order, the artisan will contact you to coordinate KBZPay, WavePay, or Cash on Delivery.
              </p>
            </div>

            {/* Description */}
            <div className="border-t border-stone-200/80 pt-4 space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-600">
                Artisan Piece Details
              </h2>
              <p className="text-xs sm:text-sm text-ink-800 leading-relaxed whitespace-pre-line myanmar-text">
                {product.description}
              </p>
              <div className="pt-2 text-[10px] text-ink-400 font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Listed: {new Date(product.createdAtUtc).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Artisan Workshop Dossier Card */}
            <div className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-jade-700 block">
                    Verified Maker Workshop
                  </span>
                  <h3 className="text-sm font-bold text-ink-900 flex items-center gap-1.5 mt-0.5">
                    <Store className="w-4 h-4 text-jade-700 shrink-0" />
                    <span>{product.storeName}</span>
                  </h3>
                </div>

                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-jade-50 text-jade-800 border border-jade-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-jade-600" />
                  Verified
                </span>
              </div>

              {store && (
                <div className="grid grid-cols-2 gap-2 text-xs text-ink-700">
                  {store.cityOrTownship && (
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-jade-600 shrink-0" />
                      <span className="truncate">{store.cityOrTownship}</span>
                    </div>
                  )}
                  {store.contactPhone && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Phone className="w-3.5 h-3.5 text-jade-600 shrink-0" />
                      <span className="truncate">{store.contactPhone}</span>
                    </div>
                  )}
                </div>
              )}

              {trustProfile && (
                <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-1 text-xs text-ink-600">
                  <span>Rating: <strong className="text-ink-900">{trustProfile.averageRating.toFixed(1)} ★</strong> ({trustProfile.reviewCount} reviews)</span>
                  <span>{trustProfile.completedOrdersCount} fulfilled orders</span>
                </div>
              )}

              <Link
                href={`/sellers/${product.sellerUserId}`}
                className="w-full py-2 px-3 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-ink-900 text-xs font-semibold flex items-center justify-between transition-colors"
              >
                <span>View Full Storefront &amp; Reviews</span>
                <ArrowRight className="w-3.5 h-3.5 text-jade-700" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Order Placement Modal */}
      <OrderPlacementModal
        product={product}
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
      />
    </MobileViewportContainer>
  );
}
