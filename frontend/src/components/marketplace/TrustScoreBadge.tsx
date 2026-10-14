"use client";

import React from "react";
import { ShieldCheck, Star, PackageCheck, AlertCircle } from "lucide-react";

interface TrustScoreBadgeProps {
  verificationStatus: string;
  averageRating: number;
  reviewCount: number;
  completedOrdersCount?: number;
  showDetails?: boolean;
}

export function TrustScoreBadge({
  verificationStatus,
  averageRating,
  reviewCount,
  completedOrdersCount,
  showDetails = false,
}: TrustScoreBadgeProps) {
  const isVerified = verificationStatus === "Verified";

  return (
    <div className="inline-flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Verification Status Pill */}
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
            isVerified
              ? "bg-jade-50 text-jade-800 border-jade-200"
              : "bg-amber-50 text-amber-800 border-amber-200"
          }`}
        >
          {isVerified ? (
            <ShieldCheck className="w-3.5 h-3.5 text-jade-700" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
          )}
          <span>{verificationStatus}</span>
        </span>

        {/* Rating Stars */}
        {reviewCount > 0 ? (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            <span>{averageRating.toFixed(1)}</span>
            <span className="text-amber-700/70 font-normal text-[11px]">
              ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
            </span>
          </div>
        ) : (
          <span className="text-xs text-ink-500 italic">No reviews yet</span>
        )}

        {/* Completed Orders Count */}
        {completedOrdersCount !== undefined && completedOrdersCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-600">
            <PackageCheck className="w-3.5 h-3.5 text-jade-600" />
            <span>{completedOrdersCount} orders fulfilled</span>
          </span>
        )}
      </div>

      {showDetails && (
        <p className="text-[11px] text-ink-500 leading-tight">
          Trust metrics are calculated strictly from verified order transactions and admin-audited seller verification.
        </p>
      )}
    </div>
  );
}
