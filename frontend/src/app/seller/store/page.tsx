"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Store,
  ShieldCheck,
  ShieldAlert,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
  Building2,
  Phone,
  MapPin,
  FileText,
  AlertTriangle,
  Package,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { sellerStoreApi } from "@/lib/seller-api";
import { StoreProfileDto } from "@/types/api";
import { ApiException } from "@/lib/api-client";
import { MobileViewportContainer } from "@/components/layout/MobileViewportContainer";
import { AppHeader } from "@/components/layout/AppHeader";
import { SellerCertificateCard } from "@/components/seller/SellerCertificateCard";

export default function SellerStoreProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, isSeller } = useAuth();

  const [store, setStore] = useState<StoreProfileDto | null>(null);
  const [storeName, setStoreName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [cityOrTownship, setCityOrTownship] = useState("");
  const [bio, setBio] = useState("");

  const [initialStoreName, setInitialStoreName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchStoreProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await sellerStoreApi.getMyStore();
      setStore(data);
      setStoreName(data.storeName);
      setInitialStoreName(data.storeName);
      setContactPhone(data.contactPhone);
      setCityOrTownship(data.cityOrTownship || "");
      setBio(data.bio || "");
    } catch (err: unknown) {
      if (err instanceof ApiException && err.status === 404) {
        setErrorMessage(
          "No store profile found. You must have an approved seller application to access this page."
        );
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Failed to load store profile details."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push("/auth/login?returnUrl=/seller/store");
      } else if (!isSeller) {
        setIsLoading(false);
      } else {
        fetchStoreProfile();
      }
    }
  }, [authLoading, isAuthenticated, isSeller, router, fetchStoreProfile]);

  const isStoreNameChanged =
    initialStoreName.length > 0 &&
    storeName.trim().toLowerCase() !== initialStoreName.trim().toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!storeName.trim()) {
      setErrorMessage("Store name is required.");
      return;
    }

    if (storeName.trim().length > 100) {
      setErrorMessage("Store name cannot exceed 100 characters.");
      return;
    }

    if (!contactPhone.trim()) {
      setErrorMessage("Contact phone number is required.");
      return;
    }

    if (contactPhone.trim().length > 30) {
      setErrorMessage("Contact phone number cannot exceed 30 characters.");
      return;
    }

    if (bio && bio.length > 500) {
      setErrorMessage("Bio cannot exceed 500 characters.");
      return;
    }

    if (cityOrTownship && cityOrTownship.length > 100) {
      setErrorMessage("City or township cannot exceed 100 characters.");
      return;
    }

    setIsSaving(true);

    try {
      const updated = await sellerStoreApi.updateMyStore({
        storeName: storeName.trim(),
        contactPhone: contactPhone.trim(),
        cityOrTownship: cityOrTownship.trim() || null,
        bio: bio.trim() || null,
      });

      setStore(updated);
      setInitialStoreName(updated.storeName);

      if (updated.verificationStatus === "PendingReverification") {
        setSuccessMessage(
          "Store profile updated! Because the Store Name was modified, your store has shifted to PendingReverification status for administrative safety review."
        );
      } else {
        setSuccessMessage("Store profile updated successfully!");
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      if (err instanceof ApiException) {
        if (err.status === 409) {
          setErrorMessage(
            "A store with this name already exists. Please choose a unique store name."
          );
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Failed to update store profile. Please try again."
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || (isLoading && !errorMessage)) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-jade-700 mx-auto" />
          <p className="text-xs text-ink-500">Loading your store details...</p>
        </div>
      </MobileViewportContainer>
    );
  }

  if (!isSeller) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-ink-900">
              Artisan Seller Account Required
            </h1>
            <p className="text-xs text-ink-500 mt-1.5 max-w-sm mx-auto">
              An approved artisan seller account is required to edit store details.
            </p>
          </div>
          <Link
            href="/seller/apply"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-jade-800 hover:bg-jade-900 text-white font-semibold text-xs transition-colors shadow-2xs"
          >
            <span>Apply to Become an Artisan Seller</span>
          </Link>
        </div>
      </MobileViewportContainer>
    );
  }

  const isPendingReverification =
    store?.verificationStatus === "PendingReverification";
  const isReverificationRejected =
    store?.verificationStatus === "ReverificationRejected";

  return (
    <MobileViewportContainer
      header={<AppHeader />}
      footer={
        <div className="px-4 py-3 text-center text-xs text-ink-500 font-medium">
          <span>Non-Custodial Architecture · MatchGuard Myanmar Pilot</span>
        </div>
      }
    >
      <div className="space-y-6 py-2">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-200/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/seller/products"
                className="inline-flex items-center gap-1 text-xs font-semibold text-ink-600 hover:text-jade-800 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>My Listings</span>
              </Link>
              <span className="text-stone-300">/</span>
              <span className="text-xs text-ink-400">Store Profile</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-900">
              Manage Store Profile & Presence
            </h1>
            <p className="text-xs text-ink-500">
              Update your public store details, artisan workshop bio, and contact info.
            </p>
          </div>

          {store && (
            <div className="flex items-center gap-2">
              <Link
                href={`/sellers/${store.sellerUserId}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-stone-200 text-ink-700 hover:text-jade-800 hover:bg-stone-50 font-semibold text-xs transition-colors shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View Public Store</span>
              </Link>
            </div>
          )}
        </div>

        {/* Verification Status Overview Banner */}
        {store && (
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isReverificationRejected
                ? "bg-rose-50/90 border-rose-300 text-rose-950"
                : isPendingReverification
                ? "bg-amber-50/90 border-amber-300 text-amber-950"
                : "bg-jade-50/70 border-jade-200 text-jade-950"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-xl mt-0.5 ${
                  isReverificationRejected
                    ? "bg-rose-100 text-rose-800"
                    : isPendingReverification
                    ? "bg-amber-100 text-amber-800"
                    : "bg-jade-100 text-jade-800"
                }`}
              >
                {isReverificationRejected || isPendingReverification ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <ShieldCheck className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {isReverificationRejected
                      ? "Re-verification Rejected"
                      : isPendingReverification
                      ? "Pending Re-verification"
                      : "Verified Artisan Store"}
                  </span>
                  <span className="text-[11px] font-mono opacity-70">
                    slug: {store.slug}
                  </span>
                </div>
                <p className="text-xs leading-relaxed">
                  {isReverificationRejected
                    ? "Your requested store name change was rejected by administrators. You may update your store name in compliance with policy. Creating new product listings is paused until verified."
                    : isPendingReverification
                    ? "Your store name change is currently under review by administrators. Existing listings remain visible, but new product creation is paused until verification is complete."
                    : "Your store profile is verified with verified artisan credentials and business identity documents."}
                </p>
              </div>
            </div>

            <div className="shrink-0 text-right text-[11px] opacity-75 font-mono">
              Member since: {new Date(store.createdAtUtc).toLocaleDateString()}
            </div>
          </div>
        )}

        {/* Error / Success Alerts */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-2xl bg-jade-50 border border-jade-200 text-jade-800 text-xs flex items-start gap-2.5 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-jade-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{successMessage}</div>
          </div>
        )}

        {/* Warning Banner when user is changing store name */}
        {isStoreNameChanged && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-3 shadow-2xs">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">
                Store-Name Change Re-Verification Warning (Rule SEC-04)
              </span>
              <p className="leading-relaxed">
                Changing your store name triggers automatic security re-verification (status becomes PendingReverification) to protect buyers against impersonation. New product listings cannot be created until an administrator re-approves the updated name.
              </p>
            </div>
          </div>
        )}

        {/* Official Identity-Verified Seller Credential & Badge Section */}
        <SellerCertificateCard />

        {/* Store Edit Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl border border-stone-200/90 shadow-2xs overflow-hidden"
        >
          <div className="p-5 sm:p-6 space-y-5">
            {/* Store Name Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="storeName"
                className="block text-xs font-semibold text-ink-800"
              >
                Store Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="storeName"
                  type="text"
                  required
                  maxLength={100}
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. Bagan Lacquerware Workshop"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-jade-500/20 focus:border-jade-600 transition-all shadow-2xs"
                />
              </div>
              <span className="text-[11px] text-ink-400 block">
                Changing your store name triggers automatic admin re-verification. Max 100 characters.
              </span>
            </div>

            {/* Contact Phone & City / Township Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="contactPhone"
                  className="block text-xs font-semibold text-ink-800"
                >
                  Contact Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  id="contactPhone"
                  type="tel"
                  required
                  maxLength={30}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="09798881234"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-jade-500/20 focus:border-jade-600 transition-all shadow-2xs"
                />
                <span className="text-[11px] text-ink-400 block">
                  Used by buyers and couriers to coordinate delivery.
                </span>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="cityOrTownship"
                  className="block text-xs font-semibold text-ink-800"
                >
                  City or Township
                </label>
                <input
                  id="cityOrTownship"
                  type="text"
                  maxLength={100}
                  value={cityOrTownship}
                  onChange={(e) => setCityOrTownship(e.target.value)}
                  placeholder="e.g. Mandalay, Amarapura"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-jade-500/20 focus:border-jade-600 transition-all shadow-2xs"
                />
                <span className="text-[11px] text-ink-400 block">
                  Displayed on your public storefront and product cards.
                </span>
              </div>
            </div>

            {/* Bio & Craft Story */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="bio"
                  className="block text-xs font-semibold text-ink-800"
                >
                  Store Bio & Artisan Story
                </label>
                <span className="text-[11px] text-ink-400">
                  {bio.length} / 500 characters
                </span>
              </div>
              <textarea
                id="bio"
                rows={4}
                maxLength={500}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your craft tradition, workshop heritage, materials used, and authenticity guarantees..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-jade-500/20 focus:border-jade-600 transition-all shadow-2xs resize-none"
              />
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="px-5 py-4 bg-stone-50 border-t border-stone-200/80 flex items-center justify-between gap-3">
            <Link
              href="/seller/products"
              className="px-4 py-2 text-xs font-semibold text-ink-600 hover:text-ink-900 transition-colors"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-jade-800 hover:bg-jade-900 text-white font-semibold text-xs shadow-2xs transition-all disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Store Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </MobileViewportContainer>
  );
}
