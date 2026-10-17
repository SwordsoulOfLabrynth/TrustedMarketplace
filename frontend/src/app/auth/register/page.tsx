"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ApiException } from "@/lib/api-client";
import { MobileViewportContainer } from "@/components/layout/MobileViewportContainer";
import { AppHeader } from "@/components/layout/AppHeader";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password requirement checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!displayName.trim()) {
      setErrorMessage("Full name is required.");
      return;
    }

    if (!email.trim()) {
      setErrorMessage("Email address is required.");
      return;
    }

    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasDigit) {
      setErrorMessage(
        "Password must be at least 8 characters and include uppercase, lowercase, and numeric characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await register(displayName.trim(), email.trim(), password);
      // Successful registration auto-logs in and routes to homepage
      router.push("/");
    } catch (err: unknown) {
      let msg = "Registration failed. Please check your details and try again.";
      if (err instanceof ApiException) {
        if (err.status === 409) {
          msg = "An account with this email address is already registered. Please sign in or use a different email.";
        } else if (err.problem?.detail) {
          msg = err.problem.detail;
        } else if (err.message && !err.message.includes("status 409")) {
          msg = err.message;
        } else {
          msg = "An account with this email address is already registered. Please sign in or use a different email.";
        }
      } else if (err instanceof Error) {
        msg = err.message.includes("409")
          ? "An account with this email address is already registered. Please sign in or use a different email."
          : err.message;
      }
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
          <span>Non-Custodial Architecture · MatchGuard Myanmar Pilot</span>
        </div>
      }
    >
      <div className="max-w-md mx-auto w-full py-6 sm:py-10 space-y-5">
        {/* Header Title */}
        <div className="space-y-1.5 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 mx-auto mb-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/branding/matchguard-icon-192.png"
              alt="MatchGuard Shield"
              className="w-full h-full object-contain drop-shadow-xs"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-ink-900">
            Create Buyer Account
          </h1>
          <p className="text-xs text-ink-500 leading-relaxed">
            Join <span className="font-bold text-[#133E2D]">Match</span><span className="font-bold text-[#B28544]">Guard</span> to discover and order authentic handcrafted goods directly from verified artisans
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <strong className="block font-semibold text-amber-950">Registration Notice</strong>
              <p className="leading-relaxed text-amber-900">{errorMessage}</p>
              {(errorMessage.includes("already registered") || errorMessage.includes("already exist")) && (
                <div className="pt-1">
                  <Link
                    href="/auth/login"
                    className="inline-flex items-center gap-1 font-bold text-jade-800 hover:text-jade-900 underline underline-offset-2"
                  >
                    <span>Click here to sign in with this email</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white p-5 sm:p-7 rounded-3xl border border-stone-200/90 shadow-2xs space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Display Name */}
            <div className="space-y-1">
              <label
                htmlFor="displayName"
                className="block text-xs font-semibold text-ink-700"
              >
                Full Name / Display Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="displayName"
                  type="text"
                  required
                  maxLength={100}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Daw Su Hlaing"
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-jade-600/20 focus:border-jade-700 transition-all font-medium"
                />
              </div>
            </div>

            {/* Email */}
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
                  placeholder="buyer@example.com"
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-jade-600/20 focus:border-jade-700 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password */}
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
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
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

            {/* Confirm Password */}
            <div className="space-y-1">
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold text-ink-700"
              >
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-jade-600/20 focus:border-jade-700 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password Checklist */}
            <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 text-[11px] space-y-1.5">
              <span className="font-semibold text-ink-700 block">Password Requirements:</span>
              <div className="grid grid-cols-2 gap-1.5 text-ink-600">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      hasMinLength ? "text-jade-700" : "text-stone-300"
                    }`}
                  />
                  <span className={hasMinLength ? "text-ink-900 font-medium" : ""}>
                    8+ characters
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      hasUppercase ? "text-jade-700" : "text-stone-300"
                    }`}
                  />
                  <span className={hasUppercase ? "text-ink-900 font-medium" : ""}>
                    Uppercase letter
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      hasLowercase ? "text-jade-700" : "text-stone-300"
                    }`}
                  />
                  <span className={hasLowercase ? "text-ink-900 font-medium" : ""}>
                    Lowercase letter
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      hasDigit ? "text-jade-700" : "text-stone-300"
                    }`}
                  />
                  <span className={hasDigit ? "text-ink-900 font-medium" : ""}>
                    Numeric digit
                  </span>
                </div>
              </div>
              {confirmPassword && (
                <div className="pt-1 flex items-center gap-1.5 border-t border-stone-200">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      passwordsMatch ? "text-jade-700" : "text-red-500"
                    }`}
                  />
                  <span
                    className={
                      passwordsMatch
                        ? "text-jade-700 font-medium"
                        : "text-red-600 font-medium"
                    }
                  >
                    {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                  </span>
                </div>
              )}
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
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <span>Create Buyer Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Sign In link */}
          <div className="text-center text-xs text-ink-600 pt-3 border-t border-stone-100">
            <span>Already have an account? </span>
            <Link
              href="/auth/login"
              className="font-bold text-jade-800 hover:underline"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Informational notice */}
        <div className="p-3.5 rounded-2xl bg-stone-100 border border-stone-200 text-ink-700 text-[11px] leading-relaxed flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-jade-700 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-semibold text-ink-900">Seller Verification Notice:</strong>
            All accounts register initially as verified Buyers. To sell handcrafted pieces, apply for artisan seller verification with national ID and workshop proof.
          </div>
        </div>
      </div>
    </MobileViewportContainer>
  );
}
