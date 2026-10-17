"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Lock, Mail, Eye, EyeOff, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { MobileViewportContainer } from "@/components/layout/MobileViewportContainer";
import { AppHeader } from "@/components/layout/AppHeader";

function getPostLoginRedirect(
  user: { role: string },
  store: { storeName?: string } | null,
  returnUrlParam: string | null
): string {
  const isAdmin = user.role === "Admin";
  const isSeller = user.role === "Buyer" && store !== null;

  // Default role landing pages
  const defaultDestination = isAdmin
    ? "/admin"
    : isSeller
    ? "/seller/products"
    : "/products";

  if (!returnUrlParam) {
    return defaultDestination;
  }

  const clean = returnUrlParam.trim();

  // Guard against external/protocol-relative URLs or login loop
  if (
    !clean.startsWith("/") ||
    clean.startsWith("//") ||
    clean.startsWith("/auth/login") ||
    clean.startsWith("/auth/register")
  ) {
    return defaultDestination;
  }

  // If returnUrl is root "/", direct users to their role workspace
  if (clean === "/") {
    return defaultDestination;
  }

  // Role authorization guards on protected routes:
  // Admin routes: only Admin allowed
  if (clean.startsWith("/admin") && !isAdmin) {
    return defaultDestination;
  }

  // Seller routes: only active Seller allowed (except /seller/apply which is for prospective seller applicants)
  if (clean.startsWith("/seller") && clean !== "/seller/apply" && !isSeller) {
    return defaultDestination;
  }

  return clean;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");

  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { user, store } = await login(email, password);
      const destination = getPostLoginRedirect(user, store, returnUrl);
      router.push(destination);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Invalid email or password. Please verify your credentials.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="max-w-md mx-auto w-full py-6 sm:py-10 space-y-5">
        {/* Header Title */}
        <div className="space-y-1 text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-stone-100 text-jade-800 border border-stone-200 shadow-2xs mb-1">
            <Lock className="w-5 h-5 text-jade-800" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-900">
            Sign In to TrustedMarketplace
          </h1>
          <p className="text-xs text-ink-500 leading-relaxed">
            Access your verified artisan and buyer account securely
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="block font-semibold">Authentication Notice</strong>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white p-5 sm:p-7 rounded-3xl border border-stone-200/90 shadow-2xs space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Email field */}
            <div className="space-y-1">
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-ink-700"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@trustedmarketplace.local"
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-jade-600/20 focus:border-jade-700 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1">
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-ink-700"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-jade-600/20 focus:border-jade-700 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-400 hover:text-ink-700"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-jade-800 hover:bg-jade-900 text-white font-bold text-xs tracking-wide shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Register Prompt */}
          <div className="text-center text-xs text-ink-600 pt-3 border-t border-stone-100">
            <span>Don&apos;t have an account? </span>
            <Link
              href="/auth/register"
              className="font-bold text-jade-800 hover:underline"
            >
              Register here
            </Link>
          </div>
        </div>

        {/* Development Seed Reference (Clean & Quiet) */}
        <div className="p-3.5 rounded-2xl bg-stone-100 border border-stone-200 text-xs space-y-2">
          <div className="flex items-center justify-between font-semibold text-ink-700 text-[11px]">
            <span>Local Evaluation Credentials</span>
            <span className="text-jade-800 font-mono text-[10px]">Development</span>
          </div>
          <div className="space-y-1.5 text-[10px] sm:text-[11px] font-mono text-ink-700">
            <div className="break-all flex flex-wrap items-center justify-between gap-1">
              <span><strong className="text-ink-900">Seller:</strong> artisan.seller@trustedmarketplace.local</span>
              <button
                type="button"
                onClick={() => {
                  setEmail("artisan.seller@trustedmarketplace.local");
                  setPassword("SellerDemo123!");
                }}
                className="text-[10px] text-jade-700 font-sans font-semibold hover:underline cursor-pointer"
              >
                Use Seller
              </button>
            </div>
            <div className="break-all flex flex-wrap items-center justify-between gap-1">
              <span><strong className="text-ink-900">Buyer:</strong> buyer@trustedmarketplace.local</span>
              <button
                type="button"
                onClick={() => {
                  setEmail("buyer@trustedmarketplace.local");
                  setPassword("BuyerDemo123!");
                }}
                className="text-[10px] text-jade-700 font-sans font-semibold hover:underline cursor-pointer"
              >
                Use Buyer
              </button>
            </div>
            <div className="break-all flex flex-wrap items-center justify-between gap-1">
              <span><strong className="text-ink-900">Admin:</strong> admin@trustedmarketplace.local</span>
              <button
                type="button"
                onClick={() => {
                  setEmail("admin@trustedmarketplace.local");
                  setPassword("AdminDemo123!");
                }}
                className="text-[10px] text-jade-700 font-sans font-semibold hover:underline cursor-pointer"
              >
                Use Admin
              </button>
            </div>
          </div>
        </div>

        {/* Quiet Security Assurance */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-ink-500">
          <ShieldCheck className="w-3.5 h-3.5 text-jade-700" />
          <span>In-Memory Access Tokens &amp; HttpOnly Refresh Protection</span>
        </div>
      </div>
    </MobileViewportContainer>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-ivory-100">
          <Loader2 className="w-6 h-6 animate-spin text-jade-700" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
