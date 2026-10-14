"use client";

import React from "react";
import Link from "next/link";
import { ProductDto } from "@/types/api";
import { ProductArtwork } from "@/components/marketplace/ProductArtwork";
import { getProductImageUrl } from "@/lib/catalog-api";
import { ShieldCheck } from "lucide-react";

interface ProductCardProps {
  product: ProductDto;
}

export function ProductCard({ product }: ProductCardProps) {
  const formattedPrice = new Intl.NumberFormat("en-US").format(product.priceAmount);
  const primaryImage = getProductImageUrl(
    product.images?.find((img) => img.isPrimary) || product.images?.[0],
    product.id
  );

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
        <div className="pt-2 border-t border-stone-100 space-y-1.5 min-w-0">
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

          {/* Secondary Seller Info */}
          <div className="flex items-center justify-between text-[11px] text-ink-500 gap-1 min-w-0">
            <Link
              href={`/sellers/${product.sellerUserId}`}
              className="hover:text-jade-700 hover:underline flex items-center gap-1 truncate min-w-0"
              title={`View ${product.storeName} store profile`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-jade-700 shrink-0" />
              <span className="truncate font-medium text-ink-600">{product.storeName}</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
