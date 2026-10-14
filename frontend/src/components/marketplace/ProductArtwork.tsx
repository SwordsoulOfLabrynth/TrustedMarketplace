"use client";

import React, { useState, useEffect } from "react";
import { ImageOff, Sparkles } from "lucide-react";

interface ProductArtworkProps {
  title: string;
  categoryName?: string;
  imageUrl?: string | null;
  className?: string;
  aspectRatio?: "square" | "landscape" | "banner" | "wide";
  objectFit?: "cover" | "contain";
  loading?: "eager" | "lazy";
}

export function ProductArtwork({
  title,
  categoryName = "",
  imageUrl,
  className = "",
  aspectRatio = "landscape",
  objectFit = "cover",
  loading = "eager",
}: ProductArtworkProps) {
  const [hasImageError, setHasImageError] = useState(false);

  // Reset error state when imageUrl prop changes
  useEffect(() => {
    setHasImageError(false);
  }, [imageUrl]);

  const aspectClass =
    aspectRatio === "square"
      ? "aspect-square"
      : aspectRatio === "banner"
      ? "aspect-[21/9]"
      : aspectRatio === "wide"
      ? "aspect-[16/9]"
      : "aspect-[4/3]";

  const validImageUrl =
    imageUrl &&
    typeof imageUrl === "string" &&
    imageUrl.trim().length > 0 &&
    imageUrl !== "null" &&
    imageUrl !== "undefined"
      ? imageUrl.trim()
      : null;

  // If a valid genuine image URL is supplied and has not failed, display real photography
  if (validImageUrl && !hasImageError) {
    return (
      <div
        className={`relative w-full overflow-hidden bg-stone-100 flex items-center justify-center select-none ${aspectClass} ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={validImageUrl}
          alt={title}
          onError={() => setHasImageError(true)}
          className={`w-full h-full ${
            objectFit === "contain" ? "object-contain p-2" : "object-cover"
          } transition-transform duration-300 group-hover:scale-[1.02]`}
          loading={loading}
        />
      </div>
    );
  }

  // Dignified, restrained craft placeholder when photography has not yet been uploaded or errored
  return (
    <div
      className={`relative w-full overflow-hidden bg-stone-50/80 border-b border-stone-200/50 flex flex-col items-center justify-center p-3 text-center select-none ${aspectClass} ${className}`}
      aria-label={`Artisan craft listing: ${title}`}
    >
      <div className="relative z-10 flex flex-col items-center gap-1.5 max-w-full px-2">
        <div className="w-8 h-8 rounded-full bg-stone-200/60 flex items-center justify-center text-stone-400">
          {hasImageError ? (
            <ImageOff className="w-4 h-4 text-stone-400" />
          ) : (
            <Sparkles className="w-4 h-4 text-stone-400" />
          )}
        </div>
        {categoryName && (
          <span className="text-[10px] font-semibold tracking-wider text-stone-500 uppercase font-sans truncate max-w-[140px]">
            {categoryName}
          </span>
        )}
        <span className="text-[10px] text-stone-400 font-sans">
          {hasImageError ? "Photo unavailable" : "Photography pending"}
        </span>
      </div>
    </div>
  );
}
