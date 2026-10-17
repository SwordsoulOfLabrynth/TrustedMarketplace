"use client";

import React from "react";
import Image from "next/image";

interface MatchGuardLogoProps {
  variant?: "icon" | "horizontal" | "full";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  showTagline?: boolean;
  priority?: boolean;
}

const sizeMap = {
  xs: { iconSize: 22, height: 22, textScale: "text-xs", subScale: "text-[8px]" },
  sm: { iconSize: 28, height: 28, textScale: "text-sm", subScale: "text-[9px]" },
  md: { iconSize: 36, height: 36, textScale: "text-base", subScale: "text-[10px]" },
  lg: { iconSize: 48, height: 48, textScale: "text-xl", subScale: "text-xs" },
  xl: { iconSize: 64, height: 64, textScale: "text-2xl", subScale: "text-sm" },
};

export function MatchGuardIcon({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/images/branding/matchguard-icon-192.png"
        alt="MatchGuard Shield"
        width={size}
        height={size}
        className="object-contain w-full h-full drop-shadow-2xs select-none"
        priority
      />
    </div>
  );
}

export function MatchGuardLogo({
  variant = "horizontal",
  size = "md",
  className = "",
  showTagline = true,
  priority = false,
}: MatchGuardLogoProps) {
  const cfg = sizeMap[size];

  if (variant === "icon") {
    return <MatchGuardIcon size={cfg.iconSize} className={className} />;
  }

  if (variant === "full") {
    return (
      <div className={`flex flex-col items-center text-center gap-2 select-none ${className}`}>
        <MatchGuardIcon size={size === "xl" ? 80 : cfg.iconSize * 1.6} />
        <div className="space-y-0.5">
          <span className={`font-black tracking-tight ${cfg.textScale} block leading-tight`}>
            <span className="text-[#133E2D]">Match</span>
            <span className="text-[#B28544]">Guard</span>
          </span>
          {showTagline && (
            <span className={`text-[#1C5640] font-semibold tracking-wider uppercase block ${cfg.subScale}`}>
              Buy Safe &bull; Sell Confidently
            </span>
          )}
        </div>
      </div>
    );
  }

  // Horizontal variant (Ideal for AppHeader, Navigation, etc.)
  return (
    <div className={`flex items-center gap-2 select-none min-w-0 ${className}`}>
      <MatchGuardIcon size={cfg.iconSize} />
      <div className="truncate min-w-0 leading-tight">
        <span className={`font-black tracking-tight block ${cfg.textScale}`}>
          <span className="text-[#133E2D]">Match</span>
          <span className="text-[#B28544]">Guard</span>
        </span>
        {showTagline ? (
          <span className={`text-[#1C5640] font-semibold tracking-wider uppercase block ${cfg.subScale} truncate`}>
            Buy Safe &bull; Sell Confidently
          </span>
        ) : (
          <span className={`text-jade-800 font-medium block ${cfg.subScale} truncate`}>
            Verified Artisan Crafts
          </span>
        )}
      </div>
    </div>
  );
}

export default MatchGuardLogo;
