"use client";

import React from "react";
import Link from "next/link";
import { ProductDto } from "@/types/api";
import { ProductArtwork } from "@/components/marketplace/ProductArtwork";
import { getProductImageUrl } from "@/lib/catalog-api";
import { ShieldCheck, ShieldAlert, Shield, Store } from "lucide-react";

interface ProductCardProps {
  product: ProductDto;
}

export function ProductCard({ product }: ProductCardProps) {
  const formattedPrice = new Intl.NumberFormat("en-US").format(product.priceAmount);
  const primaryImage = getProductImageUrl(
    product.images?.find((img) => img.isPrimary) || product.images?.[0],
    product.id
  );

  const verificationStatus = product.sellerVerificationStatus || "Verified";

  return (
    <article className="group bg-white rounded-xl border border-stone-200/80 hover:border-stone-300 hover:shadow-xs transition-all duration-150 flex flex-col w-full min-w-0 overflow-hidden">
      {/* Product Visual */}
      <Link
        href={`/products/${product.id}`}
        className="block relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-jade-600/30 w-full"
        tabIndex={0}
      >
        <ProductArtwork
          title={product.title}
          categoryName={product.categoryName}
          imageUrl={primaryImage}
          aspectRatio="landscape"
        />
        {/* Category Badge overlay on visual */}
        {product.categoryName && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-stone-900/75 text-white text-[10px] font-medium backdrop-blur-xs select-none">
            {product.categoryName}
          </span>
        )}
      </Link>

      {/* Card Body */}
      <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between gap-2.5 min-w-0">
        <div className="space-y-1 min-w-0">
          {/* Product Title (Primary Element) */}
          <h3 className="font-bold text-xs sm:text-sm leading-snug text-ink-900 group-hover:text-jade-800 transition-colors line-clamp-2">
            <Link
              href={`/products/${product.id}`}
              className="focus:outline-none hover:underline"
            >
              {product.title}
            </Link>
          </h3>
        </div>

        {/* Price & Provenance */}
        <div className="pt-2 border-t border-stone-100 space-y-2 min-w-0">
          {/* Prominent Price */}
          <div className="flex items-baseline justify-between min-w-0">
            <span className="font-extrabold text-sm sm:text-base text-ink-900 tracking-tight">
              {formattedPrice} <span className="text-[11px] font-semibold text-jade-800">{product.currencyCode}</span>
            </span>
            {product.condition && (
              <span className="text-[10px] text-ink-400 capitalize font-medium shrink-0">
                {product.condition}
              </span>
            )}
          </div>

          {/* Seller Provenance & Verification Badge */}
          <div className="flex items-center justify-between text-[11px] text-ink-500 gap-1.5 min-w-0">
            <Link
              href={`/sellers/${product.sellerUserId}`}
              className="hover:text-jade-700 hover:underline flex items-center gap-1 truncate min-w-0 text-ink-700"
              title={`View ${product.storeName} store profile`}
            >
              <Store className="w-3.5 h-3.5 text-stone-500 shrink-0" />
              <span className="truncate font-medium text-ink-700 text-[11px]">{product.storeName}</span>
            </Link>

            {/* Server-Side Verification Badge */}
            {verificationStatus === "Verified" ? (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-jade-800 bg-jade-50 px-1.5 py-0.5 rounded border border-jade-200 shrink-0"
                title="Identity-Verified Seller"
              >
                <ShieldCheck className="w-3 h-3 text-jade-700 shrink-0" />
                <span>Verified</span>
              </span>
            ) : verificationStatus === "PendingReverification" ? (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0"
                title="Seller Verification Pending"
              >
                <ShieldAlert className="w-3 h-3 text-amber-600 shrink-0" />
                <span>Pending</span>
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] font-medium text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200 shrink-0"
                title="Unverified Seller"
              >
                <Shield className="w-3 h-3 text-stone-400 shrink-0" />
                <span>Unverified</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
