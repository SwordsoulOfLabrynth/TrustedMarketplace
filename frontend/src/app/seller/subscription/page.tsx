"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  CreditCard,
  Shield,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Copy,
  Check,
  RefreshCw,
  HelpCircle,
  Building2,
  Calendar,
  Layers,
  Info,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { sellerSubscriptionApi } from "@/lib/seller-api";
import {
  PlatformPaymentMethodDto,
  SellerQuotaDto,
  SellerSubscriptionDto,
  SubscriptionPlanDto,
} from "@/types/api";
import { MobileViewportContainer } from "@/components/layout/MobileViewportContainer";
import { AppHeader } from "@/components/layout/AppHeader";

export default function SellerSubscriptionPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Data states
  const [plans, setPlans] = useState<SubscriptionPlanDto[]>([]);
  const [quota, setQuota] = useState<SellerQuotaDto | null>(null);
  const [subscription, setSubscription] = useState<SellerSubscriptionDto | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PlatformPaymentMethodDto[]>([]);

  // Loading & error states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  // Upgrade form state
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedDurationMonths, setSelectedDurationMonths] = useState<number>(1);
  const [selectedProvider, setSelectedProvider] = useState<"KBZPay" | "WavePay">("KBZPay");
  const [transactionReference, setTransactionReference] = useState<string>("");
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const [plansData, quotaData, subData, methodsData] = await Promise.all([
        sellerSubscriptionApi.getPlans(),
        sellerSubscriptionApi.getMyQuota().catch(() => null),
        sellerSubscriptionApi.getMySubscriptionStatus().catch(() => null),
        sellerSubscriptionApi.getPlatformPaymentMethods().catch(() => []),
      ]);

      setPlans(plansData);
      setQuota(quotaData);
      setSubscription(subData);
      setPaymentMethods(methodsData);

      // Pre-select paid upgrade plan if seller has Free or wants upgrade
      if (plansData.length > 0) {
        const standardPlan = plansData.find((p) => p.name.toLowerCase() === "standard");
        const defaultPlan = standardPlan || plansData[0];
        setSelectedPlanId(defaultPlan.id);
      }
    } catch (err: unknown) {
      setPageError(
        err instanceof Error ? err.message : "Failed to load subscription information."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push("/auth/login?returnUrl=/seller/subscription");
      } else {
        fetchData();
      }
    }
  }, [authLoading, isAuthenticated, router, fetchData]);

  const handleCopy = (text: string, label: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedAccount(label);
      setTimeout(() => setCopiedAccount(null), 2500);
    }
  };

  const handleSelectPlan = (plan: SubscriptionPlanDto) => {
    setSelectedPlanId(plan.id);
    setSubmitFeedback(null);
    setReferenceError(null);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitFeedback(null);
    setReferenceError(null);

    if (!selectedPlanId) return;

    const chosenPlan = plans.find((p) => p.id === selectedPlanId);
    if (!chosenPlan) return;

    const isFreePlan = chosenPlan.priceAmount === 0;

    if (!isFreePlan) {
      const trimmedRef = transactionReference.trim();
      if (!trimmedRef) {
        setReferenceError("Transaction reference number is required.");
        return;
      }
      if (trimmedRef.length < 6) {
        setReferenceError("Transaction reference must be at least 6 characters.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const result = await sellerSubscriptionApi.submitPayment({
        subscriptionPlanId: chosenPlan.id,
        durationMonths: isFreePlan ? 1 : selectedDurationMonths,
        paymentMethod: isFreePlan ? undefined : selectedProvider,
        transactionReference: isFreePlan ? undefined : transactionReference.trim(),
      });

      setSubscription(result);
      if (isFreePlan) {
        setSubmitFeedback({
          type: "success",
          message: "Free subscription plan activated successfully!",
        });
      } else {
        setSubmitFeedback({
          type: "success",
          message:
            "Payment reference submitted! Your request is pending administrator verification.",
        });
      }
      setTransactionReference("");
      // Refresh current quota & status
      await fetchData();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to submit subscription payment.";
      setSubmitFeedback({
        type: "error",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-24 text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-jade-700 animate-spin mx-auto" />
          <p className="text-sm font-medium text-ink-600">Loading subscription details...</p>
        </div>
      </MobileViewportContainer>
    );
  }

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];
  const activeMethod =
    paymentMethods.find((m) => m.provider.toLowerCase() === selectedProvider.toLowerCase()) ||
    paymentMethods[0];

  const isPendingVerification = subscription?.status === "PendingVerification";
  const isRejected = subscription?.status === "Rejected";
  const isActive = subscription?.status === "Active";

  // Calculate pricing
  const totalAmount = (selectedPlan?.priceAmount || 0) * selectedDurationMonths;
  const currencyCode = selectedPlan?.currencyCode || "MMK";

  // Quota calculation
  const currentListings = quota?.currentActiveListings ?? 0;
  const maxListings = quota?.maxActiveListings ?? selectedPlan?.maxActiveListings ?? 10;
  const quotaPercent = Math.min(100, Math.round((currentListings / Math.max(1, maxListings)) * 100));

  return (
    <MobileViewportContainer
      header={<AppHeader />}
      footer={
        <div className="px-4 py-3 text-center text-xs text-ink-500 font-medium">
          <span>MatchGuard · Myanmar Non-Custodial Artisan Commerce</span>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto w-full py-4 sm:py-6 space-y-6">
        {/* Header Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-500">
              <Link href="/seller/products" className="hover:text-jade-800 transition-colors">
                Seller Hub
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
              <span className="text-jade-800">Subscription &amp; Quota</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-900">
              Seller Subscription &amp; Listing Capacity
            </h1>
            <p className="text-xs text-ink-600">
              Manage your store tier, unlock active product listing quotas, and submit official platform subscription payments via KBZPay or WavePay.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-ink-700 transition-colors shadow-2xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-ink-500" />
              <span>Refresh</span>
            </button>
            <Link
              href="/seller/products"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-jade-800 text-white hover:bg-jade-900 text-xs font-semibold transition-colors shadow-2xs"
            >
              <span>Manage Products</span>
            </Link>
          </div>
        </div>

        {pageError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{pageError}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 1: CURRENT ACTIVE PLAN & LISTING QUOTA INDICATOR                  */}
        {/* ========================================================================= */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-jade-50 text-jade-800 border border-jade-200 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-ink-900">
                    {quota?.planName || subscription?.planName || "Free Plan"}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : isPendingVerification
                        ? "bg-amber-50 text-amber-800 border border-amber-200"
                        : isRejected
                        ? "bg-red-50 text-red-800 border border-red-200"
                        : "bg-stone-100 text-stone-700 border border-stone-200"
                    }`}
                  >
                    {isActive ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Active Tier</span>
                      </>
                    ) : isPendingVerification ? (
                      <>
                        <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                        <span>Pending Verification</span>
                      </>
                    ) : isRejected ? (
                      <>
                        <XCircle className="w-3 h-3 text-red-600" />
                        <span>Payment Rejected</span>
                      </>
                    ) : (
                      <span>Active</span>
                    )}
                  </span>
                </div>
                <p className="text-xs text-ink-500">
                  {subscription?.expiresAtUtc && isActive ? (
                    <span>
                      Renews / Expires:{" "}
                      {new Date(subscription.expiresAtUtc).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  ) : isPendingVerification ? (
                    <span className="text-amber-700 font-medium">
                      Payment submitted {new Date(subscription!.paymentSubmittedAtUtc || Date.now()).toLocaleDateString()} · Awaiting admin review
                    </span>
                  ) : (
                    <span>Standard Free tier allocation</span>
                  )}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider block">
                Active Listings
              </span>
              <span className="text-lg font-bold font-mono text-ink-900">
                {currentListings}{" "}
                <span className="text-xs font-normal text-ink-500">
                  / {maxListings} max
                </span>
              </span>
            </div>
          </div>

          {/* Quota Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-ink-600 font-medium">Capacity Utilization</span>
              <span className="font-mono text-ink-700 font-bold">{quotaPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden border border-stone-200">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  quotaPercent >= 100
                    ? "bg-red-500"
                    : quotaPercent >= 80
                    ? "bg-amber-500"
                    : "bg-jade-600"
                }`}
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-ink-500">
              {quotaPercent >= 100 ? (
                <span className="text-red-700 font-semibold">
                  Listing limit reached. Upgrade to Standard or Premium to publish additional products.
                </span>
              ) : (
                <span>
                  You have {Math.max(0, maxListings - currentListings)} available listing slot{maxListings - currentListings !== 1 ? "s" : ""} remaining in your current tier.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STATUS BANNER: PENDING VERIFICATION STATE                                 */}
        {/* ========================================================================= */}
        {isPendingVerification && (
          <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-900 shadow-2xs space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 text-amber-800">
                <Clock className="w-4 h-4 animate-pulse" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-bold text-amber-950">
                  Payment Submitted — Pending Platform Verification
                </h3>
                <p className="text-xs text-amber-800 leading-relaxed">
                  We recorded your {subscription?.paymentMethod} payment reference{" "}
                  <strong className="font-mono bg-amber-100/80 px-1 py-0.5 rounded text-amber-950">
                    {subscription?.transactionReference}
                  </strong>{" "}
                  for the{" "}
                  <strong>{subscription?.planName} Plan</strong> (
                  {subscription?.paymentAmount?.toLocaleString()} {subscription?.paymentCurrency}).
                </p>
                <div className="p-2.5 rounded-xl bg-white/70 border border-amber-200 text-[11px] text-amber-900 space-y-1 mt-2">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                    <Info className="w-3.5 h-3.5 text-amber-700" />
                    <span>Administrative Invariant</span>
                  </div>
                  <p>
                    Submitting a transaction reference registers your submission in the administrative verification queue.
                    Your product listing quota will be automatically elevated once a platform administrator confirms receipt of funds on our {subscription?.paymentMethod} statement.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STATUS BANNER: REJECTED STATE & RECOVERY GUIDANCE                          */}
        {/* ========================================================================= */}
        {isRejected && (
          <div className="p-4 rounded-2xl bg-red-50/90 border border-red-300 text-red-900 shadow-2xs space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-red-100 border border-red-300 flex items-center justify-center shrink-0 text-red-800">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-bold text-red-950">
                  Previous Payment Submission Was Rejected
                </h3>
                <p className="text-xs text-red-800 leading-relaxed">
                  Reason provided by administrator:{" "}
                  <strong className="font-semibold text-red-950">
                    {subscription?.rejectionReason || "Transaction reference could not be verified on the bank statement."}
                  </strong>
                </p>
                <div className="p-2.5 rounded-xl bg-white/70 border border-red-200 text-[11px] text-red-900 space-y-1 mt-2">
                  <div className="flex items-center gap-1.5 font-semibold text-red-950">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>How to Recover:</span>
                  </div>
                  <p>
                    Please verify that you transferred the correct amount to our official account. Check the transaction ID / voucher number in your KBZPay or WavePay app receipt, and submit a corrected reference below.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 2: SUBSCRIPTION PLANS COMPARISON CARDS                            */}
        {/* ========================================================================= */}
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-bold text-ink-900">Choose a Plan</h2>
            <p className="text-xs text-ink-500">
              Fair, transparent pricing for genuine Myanmar artisans. Listing fees support platform security, buyer escrow verification, and dispute resolution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              const isCurrentTier =
                (quota?.planName || "").toLowerCase() === plan.name.toLowerCase() && isActive;
              const isFree = plan.priceAmount === 0;

              return (
                <div
                  key={plan.id}
                  onClick={() => handleSelectPlan(plan)}
                  className={`relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "bg-white border-jade-600 ring-2 ring-jade-600/20 shadow-md"
                      : "bg-white border-stone-200 hover:border-stone-300 shadow-2xs"
                  }`}
                >
                  {isCurrentTier && (
                    <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
                      Current Plan
                    </span>
                  )}

                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-base font-bold text-ink-900">{plan.name}</h3>
                        <p className="text-xs text-ink-500">
                          {isFree
                            ? "Starter tier for artisans"
                            : plan.name === "Standard"
                            ? "Ideal for growing workshops"
                            : "For high-volume artisan brands"}
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? "border-jade-600 bg-jade-600 text-white"
                            : "border-stone-300"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold font-mono text-ink-900">
                          {plan.priceAmount.toLocaleString()}
                        </span>
                        <span className="text-xs font-semibold text-ink-600">
                          {plan.currencyCode}
                        </span>
                        <span className="text-xs text-ink-500">/{plan.billingPeriod.toLowerCase()}</span>
                      </div>
                      {isFree && (
                        <span className="text-[11px] text-emerald-700 font-semibold">
                          Free forever for eligible sellers
                        </span>
                      )}
                    </div>

                    {/* Features list */}
                    <ul className="space-y-2 pt-2 border-t border-stone-100 text-xs text-ink-700">
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-jade-700 shrink-0" />
                        <span>
                          <strong>{plan.maxActiveListings}</strong> Active Product Listings
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-jade-700 shrink-0" />
                        <span>Public Artisan Storefront &amp; Slug</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-jade-700 shrink-0" />
                        <span>Direct Chat &amp; Non-Custodial Orders</span>
                      </li>
                      {!isFree && (
                        <li className="flex items-center gap-2 text-jade-800 font-semibold">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Priority Catalog Search Ranking</span>
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="pt-4 mt-2">
                    <button
                      type="button"
                      className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                        isSelected
                          ? "bg-jade-800 text-white"
                          : "bg-stone-100 hover:bg-stone-200 text-ink-800"
                      }`}
                    >
                      {isCurrentTier ? "Selected (Current)" : isSelected ? "Selected Plan" : "Choose Plan"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 3: CHECKOUT & PAYMENT METHOD / REFERENCE SUBMISSION               */}
        {/* ========================================================================= */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-6">
          <div className="pb-3 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-ink-900">
                {selectedPlan.priceAmount === 0
                  ? "Activate Free Tier"
                  : `Subscribe to ${selectedPlan.name} Plan`}
              </h2>
              <p className="text-xs text-ink-500">
                {selectedPlan.priceAmount === 0
                  ? "Instant activation without payment details."
                  : "Transfer subscription fees directly to our official platform account via mobile wallet."}
              </p>
            </div>

            {selectedPlan.priceAmount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-500 font-medium">Duration:</span>
                <select
                  value={selectedDurationMonths}
                  onChange={(e) => setSelectedDurationMonths(Number(e.target.value))}
                  disabled={isPendingVerification}
                  className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold text-ink-800 bg-white focus:outline-none focus:ring-2 focus:ring-jade-600/20"
                >
                  <option value={1}>1 Month</option>
                  <option value={3}>3 Months</option>
                  <option value={6}>6 Months</option>
                  <option value={12}>12 Months (1 Year)</option>
                </select>
              </div>
            )}
          </div>

          {selectedPlan.priceAmount === 0 ? (
            /* Free Plan Direct Activation Form */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs text-ink-700 space-y-1">
                <p className="font-semibold text-ink-900">No payment required for Free tier.</p>
                <p>
                  You will have access to 10 active product listings and standard storefront features.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSubmitPayment}
                disabled={isSubmitting || isPendingVerification}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-jade-800 text-white text-xs font-semibold hover:bg-jade-900 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Confirm Free Tier</span>
              </button>
            </div>
          ) : (
            /* Paid Plan Payment & Transfer Form */
            <form onSubmit={handleSubmitPayment} className="space-y-6">
              {/* Payment Method Switcher */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-ink-800 block">
                  Select Mobile Payment Provider
                </label>
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  <button
                    type="button"
                    onClick={() => setSelectedProvider("KBZPay")}
                    disabled={isPendingVerification}
                    className={`p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                      selectedProvider === "KBZPay"
                        ? "border-[#005bac] bg-blue-50/50 ring-2 ring-[#005bac]/20"
                        : "border-stone-200 bg-white hover:bg-stone-50"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#005bac] text-white flex items-center justify-center font-bold text-xs">
                      KBZ
                    </div>
                    <div className="text-left">
                      <span className="text-xs font-bold text-ink-900 block">KBZPay</span>
                      <span className="text-[10px] text-amber-800 font-semibold">Sandbox Simulation</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedProvider("WavePay")}
                    disabled={isPendingVerification}
                    className={`p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                      selectedProvider === "WavePay"
                        ? "border-[#ffd200] bg-yellow-50/50 ring-2 ring-[#ffd200]/40"
                        : "border-stone-200 bg-white hover:bg-stone-50"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#ffd200] text-ink-950 flex items-center justify-center font-bold text-xs">
                      Wave
                    </div>
                    <div className="text-left">
                      <span className="text-xs font-bold text-ink-900 block">WavePay</span>
                      <span className="text-[10px] text-amber-800 font-semibold">Sandbox Simulation</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Demo Sandbox Alert Banner */}
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2.5 shadow-2xs">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <div className="font-bold flex items-center gap-1.5 text-amber-950">
                    <span>Demo Sandbox Simulation · Do Not Transfer Real Funds</span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-normal">
                    The payment QR codes and recipient accounts shown below are safe test mocks for development and competition evaluation. Do <strong>NOT</strong> scan with a live mobile banking app or transfer real money. You can submit any test reference (e.g. <code className="font-mono bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-semibold">KBZ-TEST-998811</code>) to trigger the administrative verification queue.
                  </p>
                </div>
              </div>

              {/* Platform Account Details & QR Display Card */}
              {activeMethod && (
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        <Building2 className="w-3 h-3 text-amber-700" />
                        <span>Sandbox Test Account</span>
                      </span>
                      <h4 className="text-sm font-bold text-ink-900">{activeMethod.accountName}</h4>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-ink-800 bg-white px-2 py-1 rounded-lg border border-stone-200">
                          {activeMethod.accountPhone}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(activeMethod.accountPhone, "phone")}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-[11px] font-semibold text-ink-700 transition-colors cursor-pointer shadow-2xs"
                        >
                          {copiedAccount === "phone" ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-ink-500" />
                              <span>Copy Phone</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="text-left sm:text-right space-y-0.5">
                      <span className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider block">
                        Transfer Amount
                      </span>
                      <div className="text-xl font-bold font-mono text-jade-800">
                        {totalAmount.toLocaleString()} {currencyCode}
                      </div>
                      <span className="text-[10px] text-ink-500">
                        ({selectedDurationMonths} month{selectedDurationMonths !== 1 ? "s" : ""} @{" "}
                        {selectedPlan.priceAmount.toLocaleString()} {currencyCode})
                      </span>
                    </div>
                  </div>

                  {/* QR Code Graphic Frame */}
                  <div className="pt-3 border-t border-stone-200/60 flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-40 h-40 bg-white p-2 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-center shrink-0">
                      {activeMethod.qrCodeUrl ? (
                        <Image
                          src={activeMethod.qrCodeUrl}
                          alt={`${activeMethod.provider} QR Code`}
                          width={150}
                          height={150}
                          unoptimized
                          className="w-full h-full object-contain rounded-lg"
                        />
                      ) : (
                        <div className="text-center text-xs text-stone-400">QR Code Preview</div>
                      )}
                    </div>

                    <div className="space-y-2 text-xs text-ink-600 flex-1">
                      <h5 className="font-bold text-ink-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-jade-700" />
                        <span>Payment Steps:</span>
                      </h5>
                      <ol className="list-decimal list-inside space-y-1 text-ink-600 text-[11px] leading-relaxed">
                        <li>
                          Open your <strong>{selectedProvider}</strong> mobile app.
                        </li>
                        <li>
                          Scan the QR code or transfer exactly{" "}
                          <strong className="font-mono text-ink-900">
                            {totalAmount.toLocaleString()} {currencyCode}
                          </strong>{" "}
                          to <strong className="font-mono">{activeMethod.accountPhone}</strong>.
                        </li>
                        <li>
                          Save the transaction confirmation receipt from {selectedProvider}.
                        </li>
                        <li>
                          Copy the <strong>Transaction Reference / Voucher ID</strong> and enter it below.
                        </li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}

              {/* Transaction Reference Input */}
              <div className="space-y-2 max-w-lg">
                <label className="text-xs font-bold text-ink-900 flex items-center justify-between">
                  <span>Transaction Reference / Voucher Number</span>
                  <span className="text-[11px] text-stone-400 font-normal">Min 6 characters</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={transactionReference}
                    onChange={(e) => {
                      setTransactionReference(e.target.value);
                      if (referenceError) setReferenceError(null);
                    }}
                    placeholder="e.g. 20261015091244890123"
                    disabled={isPendingVerification}
                    className={`w-full px-3.5 py-2.5 rounded-xl border font-mono text-xs text-ink-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 bg-white transition-all ${
                      referenceError
                        ? "border-red-400 focus:ring-red-500/20"
                        : "border-stone-300 focus:ring-jade-600/20 focus:border-jade-600"
                    } ${isPendingVerification ? "bg-stone-100 cursor-not-allowed" : ""}`}
                  />
                </div>
                {referenceError && (
                  <p className="text-[11px] text-red-600 font-medium">{referenceError}</p>
                )}
                <p className="text-[11px] text-ink-500 leading-relaxed">
                  Submitting a reference records your submission in our admin verification queue. An administrator will inspect incoming funds before upgrading your listing quota.
                </p>
              </div>

              {submitFeedback && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
                    submitFeedback.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  }`}
                >
                  {submitFeedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  )}
                  <span>{submitFeedback.message}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || isPendingVerification}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-jade-800 hover:bg-jade-900 text-white text-xs font-semibold transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4" />
                  )}
                  <span>
                    {isPendingVerification
                      ? "Verification In Progress"
                      : "Submit Payment for Verification"}
                  </span>
                </button>

                {isPendingVerification && (
                  <span className="text-[11px] text-amber-700 font-medium">
                    You currently have a pending submission undergoing admin review.
                  </span>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </MobileViewportContainer>
  );
}
