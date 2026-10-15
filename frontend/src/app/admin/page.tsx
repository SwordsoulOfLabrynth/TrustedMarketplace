"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  AlertCircle,
  Loader2,
  RefreshCw,
  Building2,
  Phone,
  Calendar,
  ExternalLink,
  ChevronRight,
  Filter,
  AlertTriangle,
  Scale,
  Truck,
  Package,
  ShoppingBag,
  ArrowRight,
  User,
  CreditCard,
  Copy,
  Check,
  Store,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { adminApi } from "@/lib/admin-api";
import { ordersApi } from "@/lib/orders-api";
import {
  AdminDecisionRequest,
  AdminStoreReverificationRequest,
  ComplaintDto,
  OrderDto,
  SellerApplicationDto,
  SellerSubscriptionDto,
  StoreProfileDto,
  VerificationEvidenceDto,
} from "@/types/api";
import { MobileViewportContainer } from "@/components/layout/MobileViewportContainer";
import { AppHeader } from "@/components/layout/AppHeader";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<
    "verifications" | "disputes" | "subscriptions" | "reverifications"
  >("verifications");

  // ==========================================
  // TAB 1: SELLER APPLICATIONS QUEUE STATE
  // ==========================================
  const [applications, setApplications] = useState<SellerApplicationDto[]>([]);
  const [isAppsLoading, setIsAppsLoading] = useState<boolean>(true);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [selectedAppStatus, setSelectedAppStatus] = useState<string>("All");

  // Application Decision Modal State
  const [activeApp, setActiveApp] = useState<SellerApplicationDto | null>(null);
  const [decisionReason, setDecisionReason] = useState<string>("");
  const [decisionAction, setDecisionAction] = useState<"Approved" | "Rejected" | null>(null);
  const [isDecidingApp, setIsDecidingApp] = useState<boolean>(false);
  const [appDecisionFeedback, setAppDecisionFeedback] = useState<string | null>(null);

  // ==========================================
  // TAB 2: COMPLAINTS & DISPUTES QUEUE STATE
  // ==========================================
  const [complaints, setComplaints] = useState<ComplaintDto[]>([]);
  const [isComplaintsLoading, setIsComplaintsLoading] = useState<boolean>(true);
  const [complaintsError, setComplaintsError] = useState<string | null>(null);
  const [selectedComplaintStatus, setSelectedComplaintStatus] = useState<string>("All");

  // Dispute Adjudication Modal State
  const [activeComplaint, setActiveComplaint] = useState<ComplaintDto | null>(null);
  const [disputedOrder, setDisputedOrder] = useState<OrderDto | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState<boolean>(false);
  const [resolutionCode, setResolutionCode] = useState<string>("GoodsDeliveredConfirmed");
  const [resolutionSummary, setResolutionSummary] = useState<string>("");
  const [orderResolutionAction, setOrderResolutionAction] = useState<"KeepDisputed" | "Completed" | "Cancelled">("Completed");
  const [isAdjudicatingDispute, setIsAdjudicatingDispute] = useState<boolean>(false);
  const [disputeFeedback, setDisputeFeedback] = useState<string | null>(null);

  // ==========================================
  // TAB 3: SUBSCRIPTIONS & PAYMENTS QUEUE STATE
  // ==========================================
  const [subscriptions, setSubscriptions] = useState<SellerSubscriptionDto[]>([]);
  const [isSubsLoading, setIsSubsLoading] = useState<boolean>(true);
  const [subsError, setSubsError] = useState<string | null>(null);
  const [selectedSubStatus, setSelectedSubStatus] = useState<string>("All");

  // Subscription Decision Modal State
  const [activeSub, setActiveSub] = useState<SellerSubscriptionDto | null>(null);
  const [subDecisionAction, setSubDecisionAction] = useState<"Approved" | "Rejected" | null>(null);
  const [subRejectionReason, setSubRejectionReason] = useState<string>("");
  const [subDurationMonths, setSubDurationMonths] = useState<number>(1);
  const [isDecidingSub, setIsDecidingSub] = useState<boolean>(false);
  const [subDecisionFeedback, setSubDecisionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  // ==========================================
  // TAB 4: STORE RE-VERIFICATIONS QUEUE STATE
  // ==========================================
  const [stores, setStores] = useState<StoreProfileDto[]>([]);
  const [isStoresLoading, setIsStoresLoading] = useState<boolean>(true);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [selectedStoreStatus, setSelectedStoreStatus] = useState<string>("All");

  // Store Decision Modal State
  const [activeStore, setActiveStore] = useState<StoreProfileDto | null>(null);
  const [storeDecisionAction, setStoreDecisionAction] = useState<"Approved" | "Rejected" | null>(null);
  const [storeDecisionReason, setStoreDecisionReason] = useState<string>("");
  const [isDecidingStore, setIsDecidingStore] = useState<boolean>(false);
  const [storeDecisionFeedback, setStoreDecisionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ------------------------------------------
  // Data Fetching
  // ------------------------------------------
  const fetchApplications = useCallback(async () => {
    setIsAppsLoading(true);
    setAppsError(null);
    try {
      const data = await adminApi.getSellerApplications();
      setApplications(data);
    } catch (err: unknown) {
      setAppsError(err instanceof Error ? err.message : "Failed to load seller applications.");
    } finally {
      setIsAppsLoading(false);
    }
  }, []);

  const fetchComplaints = useCallback(async () => {
    setIsComplaintsLoading(true);
    setComplaintsError(null);
    try {
      const data = await adminApi.getComplaints(1, 100);
      setComplaints(data);
    } catch (err: unknown) {
      setComplaintsError(err instanceof Error ? err.message : "Failed to load complaints and disputes.");
    } finally {
      setIsComplaintsLoading(false);
    }
  }, []);

  const fetchSubscriptions = useCallback(async () => {
    setIsSubsLoading(true);
    setSubsError(null);
    try {
      const data = await adminApi.getSubscriptions();
      setSubscriptions(data);
    } catch (err: unknown) {
      setSubsError(err instanceof Error ? err.message : "Failed to load subscription payments.");
    } finally {
      setIsSubsLoading(false);
    }
  }, []);

  const fetchStores = useCallback(async () => {
    setIsStoresLoading(true);
    setStoresError(null);
    try {
      const data = await adminApi.getSellerStores();
      setStores(data);
    } catch (err: unknown) {
      setStoresError(err instanceof Error ? err.message : "Failed to load seller stores.");
    } finally {
      setIsStoresLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push("/auth/login?returnUrl=/admin");
      } else if (isAdmin) {
        fetchApplications();
        fetchComplaints();
        fetchSubscriptions();
        fetchStores();
      }
    }
  }, [
    authLoading,
    isAuthenticated,
    isAdmin,
    router,
    fetchApplications,
    fetchComplaints,
    fetchSubscriptions,
    fetchStores,
  ]);

  // Load order details when opening complaint modal
  const openComplaintModal = async (complaint: ComplaintDto) => {
    setActiveComplaint(complaint);
    setDisputeFeedback(null);
    setResolutionSummary("");
    setResolutionCode("GoodsDeliveredConfirmed");
    setOrderResolutionAction("Completed");
    setDisputedOrder(null);

    if (complaint.orderId) {
      setIsLoadingOrder(true);
      try {
        const orderData = await ordersApi.getOrderById(complaint.orderId);
        setDisputedOrder(orderData);
        if (orderData.status !== "Disputed") {
          setOrderResolutionAction("KeepDisputed");
        }
      } catch {
        // Fallback gracefully if order detail cannot be loaded
        setDisputedOrder(null);
      } finally {
        setIsLoadingOrder(false);
      }
    }
  };

  // ------------------------------------------
  // Handlers
  // ------------------------------------------
  const handleAppDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeApp || !decisionAction) return;

    if (!decisionReason.trim()) {
      setAppDecisionFeedback("Please provide a decision rationale note for audit records.");
      return;
    }

    setIsDecidingApp(true);
    setAppDecisionFeedback(null);

    try {
      const updated = await adminApi.processDecision(activeApp.id, {
        decision: decisionAction,
        reason: decisionReason.trim(),
      });

      setApplications((prev) =>
        prev.map((app) => (app.id === updated.id ? updated : app))
      );
      setActiveApp(null);
      setDecisionReason("");
      setDecisionAction(null);
    } catch (err: unknown) {
      setAppDecisionFeedback(
        err instanceof Error ? err.message : "Failed to record administrative decision."
      );
    } finally {
      setIsDecidingApp(false);
    }
  };

  const handleAdjudicateDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeComplaint) return;

    if (!resolutionSummary.trim()) {
      setDisputeFeedback("Please provide an administrative findings summary for the audit log.");
      return;
    }

    setIsAdjudicatingDispute(true);
    setDisputeFeedback(null);

    try {
      // 1. Process complaint decision record
      const updatedComplaint = await adminApi.processComplaintDecision(activeComplaint.id, {
        resolutionCode,
        resolutionSummary: resolutionSummary.trim(),
      });

      // 2. If complaint is linked to an order and admin chose an order resolution transition
      if (
        activeComplaint.orderId &&
        orderResolutionAction !== "KeepDisputed" &&
        (orderResolutionAction === "Completed" || orderResolutionAction === "Cancelled")
      ) {
        try {
          await adminApi.resolveOrderDispute(activeComplaint.orderId, {
            resolvedStatus: orderResolutionAction,
            reason: resolutionSummary.trim(),
          });
        } catch (orderErr: unknown) {
          console.warn("Dispute order transition note:", orderErr);
        }
      }

      // Update complaints state and close modal
      setComplaints((prev) =>
        prev.map((c) => (c.id === updatedComplaint.id ? updatedComplaint : c))
      );
      setActiveComplaint(null);
      setResolutionSummary("");
      setDisputedOrder(null);
    } catch (err: unknown) {
      setDisputeFeedback(
        err instanceof Error ? err.message : "Failed to record dispute adjudication."
      );
    } finally {
      setIsAdjudicatingDispute(false);
    }
  };

  const handleCopyRef = (ref: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(ref);
      setCopiedRef(ref);
      setTimeout(() => setCopiedRef(null), 2000);
    }
  };

  const openSubDecisionModal = (sub: SellerSubscriptionDto, action: "Approved" | "Rejected") => {
    setActiveSub(sub);
    setSubDecisionAction(action);
    setSubRejectionReason("");
    setSubDurationMonths(sub.durationMonths || 1);
    setSubDecisionFeedback(null);
  };

  const handleSubDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSub || !subDecisionAction) return;

    if (subDecisionAction === "Rejected" && !subRejectionReason.trim()) {
      setSubDecisionFeedback({
        type: "error",
        message: "A rejection reason is required to explain why the payment reference could not be verified.",
      });
      return;
    }

    setIsDecidingSub(true);
    setSubDecisionFeedback(null);
    try {
      const updated = await adminApi.verifySubscriptionPayment(activeSub.id, {
        decision: subDecisionAction,
        reason: subDecisionAction === "Rejected" ? subRejectionReason.trim() : undefined,
        durationMonths: subDurationMonths,
      });

      setSubscriptions((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
      setSubDecisionFeedback({
        type: "success",
        message: `Subscription payment ${subDecisionAction.toLowerCase()} successfully!`,
      });

      setTimeout(() => {
        setActiveSub(null);
        setSubDecisionAction(null);
        setSubRejectionReason("");
        setSubDecisionFeedback(null);
      }, 900);
    } catch (err: unknown) {
      setSubDecisionFeedback({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to record payment verification decision.",
      });
    } finally {
      setIsDecidingSub(false);
    }
  };

  const openStoreDecisionModal = (
    store: StoreProfileDto,
    action: "Approved" | "Rejected"
  ) => {
    setActiveStore(store);
    setStoreDecisionAction(action);
    setStoreDecisionReason("");
    setStoreDecisionFeedback(null);
  };

  const handleStoreDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore || !storeDecisionAction) return;

    if (storeDecisionAction === "Rejected" && !storeDecisionReason.trim()) {
      setStoreDecisionFeedback({
        type: "error",
        message: "A rejection reason is required to explain why this store profile update was rejected.",
      });
      return;
    }

    setIsDecidingStore(true);
    setStoreDecisionFeedback(null);

    try {
      const updated = await adminApi.processStoreReverificationDecision(activeStore.sellerUserId, {
        decision: storeDecisionAction,
        reason: storeDecisionReason.trim() || undefined,
      });

      setStores((prev) =>
        prev.map((s) => (s.sellerUserId === activeStore.sellerUserId ? updated : s))
      );

      setStoreDecisionFeedback({
        type: "success",
        message: `Store "${updated.storeName}" has been successfully ${
          storeDecisionAction === "Approved" ? "approved and restored to Verified status" : "rejected"
        }.`,
      });

      setTimeout(() => {
        setActiveStore(null);
        setStoreDecisionAction(null);
        setStoreDecisionReason("");
        setStoreDecisionFeedback(null);
      }, 1000);
    } catch (err: unknown) {
      setStoreDecisionFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to record administrative store decision.",
      });
    } finally {
      setIsDecidingStore(false);
    }
  };

  if (authLoading) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-20 text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-jade-700 mx-auto" />
          <p className="text-xs text-ink-500">Verifying administrative access...</p>
        </div>
      </MobileViewportContainer>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!isAdmin) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-16 max-w-md mx-auto text-center space-y-4 px-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200 shadow-2xs">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-bold text-ink-900">Access Restricted</h1>
            <p className="text-xs text-ink-600 leading-relaxed">
              This administrative portal is strictly restricted to platform administrator accounts.
              Your account ({user?.email}) does not hold administrative privileges.
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jade-800 text-white font-semibold text-xs hover:bg-jade-900 transition-colors shadow-2xs"
          >
            <span>Return to Catalog</span>
          </Link>
        </div>
      </MobileViewportContainer>
    );
  }

  // ==========================================
  // Summary Counts
  // ==========================================
  // Applications
  const totalAppsCount = applications.length;
  const pendingAppsCount = applications.filter(
    (a) => a.status === "Submitted" || a.status === "UnderReview"
  ).length;
  const approvedAppsCount = applications.filter((a) => a.status === "Approved").length;
  const rejectedAppsCount = applications.filter(
    (a) => a.status === "Rejected" || a.status === "MoreInformationRequired"
  ).length;

  const filteredApplications =
    selectedAppStatus === "All"
      ? applications
      : applications.filter((a) => a.status.toLowerCase() === selectedAppStatus.toLowerCase());

  // Complaints
  const totalComplaintsCount = complaints.length;
  const openComplaintsCount = complaints.filter(
    (c) => c.status === "Submitted" || c.status === "UnderReview"
  ).length;
  const resolvedComplaintsCount = complaints.filter((c) => c.status === "Resolved").length;
  const dismissedComplaintsCount = complaints.filter((c) => c.status === "Dismissed").length;

  const filteredComplaints =
    selectedComplaintStatus === "All"
      ? complaints
      : complaints.filter(
          (c) => c.status.toLowerCase() === selectedComplaintStatus.toLowerCase()
        );

  // Subscriptions & Payments
  const totalSubsCount = subscriptions.length;
  const pendingSubsCount = subscriptions.filter(
    (s) => s.status === "PendingVerification"
  ).length;
  const activeSubsCount = subscriptions.filter((s) => s.status === "Active").length;
  const rejectedSubsCount = subscriptions.filter((s) => s.status === "Rejected").length;

  const filteredSubscriptions =
    selectedSubStatus === "All"
      ? subscriptions
      : subscriptions.filter(
          (s) => s.status.toLowerCase() === selectedSubStatus.toLowerCase()
        );

  // Store Re-verifications
  const totalStoresCount = stores.length;
  const pendingStoresCount = stores.filter(
    (s) => s.verificationStatus === "PendingReverification"
  ).length;
  const verifiedStoresCount = stores.filter((s) => s.verificationStatus === "Verified").length;
  const rejectedStoresCount = stores.filter(
    (s) => s.verificationStatus === "ReverificationRejected"
  ).length;

  const filteredStores =
    selectedStoreStatus === "All"
      ? stores
      : stores.filter(
          (s) => s.verificationStatus.toLowerCase() === selectedStoreStatus.toLowerCase()
        );

  return (
    <MobileViewportContainer
      header={<AppHeader />}
      footer={
        <div className="px-4 py-3 text-center text-xs text-ink-500 font-medium">
          <span>TrustedMarketplace Governance Console · Administrative Audit Mode</span>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto w-full py-4 sm:py-6 space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-800 border border-stone-300">
                <Shield className="w-3 h-3 text-stone-700" />
                <span>Admin Console</span>
              </span>
              <span className="text-xs text-jade-700 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-jade-600" />
                <span>Active Session</span>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-900">
              Platform Administration &amp; Governance
            </h1>
            <p className="text-xs text-ink-500">
              Review genuine Myanmar artisan credentials, evaluate complaints, and adjudicate delivery disputes.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (activeTab === "verifications") fetchApplications();
              else if (activeTab === "disputes") fetchComplaints();
              else if (activeTab === "subscriptions") fetchSubscriptions();
              else fetchStores();
            }}
            disabled={isAppsLoading || isComplaintsLoading || isSubsLoading || isStoresLoading}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-ink-700 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isAppsLoading || isComplaintsLoading || isSubsLoading || isStoresLoading ? "animate-spin text-jade-700" : "text-ink-500"
              }`}
            />
            <span>Refresh</span>
          </button>
        </div>

        {/* Primary Admin Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-stone-200 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("verifications")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "verifications"
                ? "bg-jade-800 text-white shadow-2xs"
                : "bg-white text-ink-600 hover:bg-stone-100 border border-stone-200"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Seller Verifications</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "verifications"
                  ? "bg-white/20 text-white"
                  : "bg-stone-100 text-ink-700"
              }`}
            >
              {pendingAppsCount > 0 ? `${pendingAppsCount} pending` : totalAppsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("disputes")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "disputes"
                ? "bg-jade-800 text-white shadow-2xs"
                : "bg-white text-ink-600 hover:bg-stone-100 border border-stone-200"
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Disputes &amp; Complaints</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "disputes"
                  ? "bg-white/20 text-white"
                  : openComplaintsCount > 0
                  ? "bg-rose-100 text-rose-800 font-bold"
                  : "bg-stone-100 text-ink-700"
              }`}
            >
              {openComplaintsCount > 0 ? `${openComplaintsCount} open` : totalComplaintsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("subscriptions")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "subscriptions"
                ? "bg-jade-800 text-white shadow-2xs"
                : "bg-white text-ink-600 hover:bg-stone-100 border border-stone-200"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Subscriptions &amp; Payments</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "subscriptions"
                  ? "bg-white/20 text-white"
                  : pendingSubsCount > 0
                  ? "bg-amber-100 text-amber-800 font-bold"
                  : "bg-stone-100 text-ink-700"
              }`}
            >
              {pendingSubsCount > 0 ? `${pendingSubsCount} pending` : totalSubsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("reverifications")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "reverifications"
                ? "bg-jade-800 text-white shadow-2xs"
                : "bg-white text-ink-600 hover:bg-stone-100 border border-stone-200"
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Store Re-verifications</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "reverifications"
                  ? "bg-white/20 text-white"
                  : pendingStoresCount > 0
                  ? "bg-amber-100 text-amber-800 font-bold"
                  : "bg-stone-100 text-ink-700"
              }`}
            >
              {pendingStoresCount > 0 ? `${pendingStoresCount} pending` : totalStoresCount}
            </span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1 CONTENT: SELLER VERIFICATION QUEUE                                  */}
        {/* ========================================================================= */}
        {activeTab === "verifications" && (
          <div className="space-y-6 animate-fade-in">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-white border border-stone-200/80 shadow-2xs space-y-1">
                <div className="text-[11px] font-semibold text-ink-500">Total Applications</div>
                <div className="text-xl sm:text-2xl font-bold text-ink-900 font-mono">{totalAppsCount}</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 shadow-2xs space-y-1">
                <div className="text-[11px] font-semibold text-amber-800">Pending Review</div>
                <div className="text-xl sm:text-2xl font-bold text-amber-900 font-mono">{pendingAppsCount}</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-jade-50/60 border border-jade-200/80 shadow-2xs space-y-1">
                <div className="text-[11px] font-semibold text-jade-800">Approved Artisans</div>
                <div className="text-xl sm:text-2xl font-bold text-jade-900 font-mono">{approvedAppsCount}</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 shadow-2xs space-y-1">
                <div className="text-[11px] font-semibold text-stone-600">Other / Rejected</div>
                <div className="text-xl sm:text-2xl font-bold text-stone-800 font-mono">{rejectedAppsCount}</div>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {["All", "Submitted", "UnderReview", "Approved", "Rejected"].map((tab) => {
                const isActive = selectedAppStatus.toLowerCase() === tab.toLowerCase();
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSelectedAppStatus(tab)}
                    className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      isActive
                        ? "bg-jade-800 text-white shadow-2xs"
                        : "bg-white text-ink-600 hover:bg-stone-100 border border-stone-200"
                    }`}
                  >
                    {tab === "UnderReview" ? "Under Review" : tab}
                  </button>
                );
              })}
            </div>

            {/* Apps Error Alert */}
            {appsError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{appsError}</span>
              </div>
            )}

            {/* Applications List */}
            {isAppsLoading ? (
              <div className="py-16 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-jade-700 mx-auto" />
                <p className="text-xs text-ink-500">Loading seller applications...</p>
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="py-14 text-center border border-dashed border-stone-300 rounded-2xl bg-stone-50/50 space-y-2">
                <Building2 className="w-8 h-8 text-stone-400 mx-auto" />
                <p className="text-xs font-semibold text-ink-700">No applications found</p>
                <p className="text-[11px] text-ink-500">
                  {selectedAppStatus === "All"
                    ? "No seller verification submissions exist in the database yet."
                    : `No applications with status "${selectedAppStatus}".`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredApplications.map((app) => {
                  const isPending = app.status === "Submitted" || app.status === "UnderReview";
                  const isApproved = app.status === "Approved";
                  const isRejected = app.status === "Rejected";

                  return (
                    <div
                      key={app.id}
                      className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs hover:border-stone-300 transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold text-ink-900">{app.proposedStoreName}</h2>
                            {isApproved && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-jade-50 text-jade-800 border border-jade-200">
                                <CheckCircle2 className="w-3 h-3 text-jade-700" />
                                <span>Approved</span>
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-700" />
                                <span>{app.status === "UnderReview" ? "Under Review" : "Submitted"}</span>
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-800 border border-red-200">
                                <XCircle className="w-3 h-3 text-red-700" />
                                <span>Rejected</span>
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-stone-400" />
                              <span>{app.businessType}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-stone-400" />
                              <span>{app.contactPhone}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-stone-400" />
                              <span>{new Date(app.submittedAtUtc).toLocaleDateString()}</span>
                            </span>
                          </div>
                        </div>

                        {isPending && (
                          <div className="flex items-center gap-2 pt-2 sm:pt-0">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveApp(app);
                                setDecisionAction("Approved");
                                setDecisionReason(
                                  "Verified genuine Myanmar artisan credentials and physical workshop evidence."
                                );
                                setAppDecisionFeedback(null);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-jade-800 hover:bg-jade-900 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveApp(app);
                                setDecisionAction("Rejected");
                                setDecisionReason(
                                  "Evidence provided does not meet marketplace artisan authenticity standards."
                                );
                                setAppDecisionFeedback(null);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-white border border-stone-300 hover:border-red-400 hover:text-red-700 text-ink-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Decision Reason if reviewed */}
                      {app.decisionReason && (
                        <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-[11px] text-ink-600">
                          <span className="font-semibold text-ink-800">Admin Audit Note:</span>{" "}
                          {app.decisionReason}
                        </div>
                      )}

                      {/* Evidence Files Summary */}
                      {app.evidence && app.evidence.length > 0 && (
                        <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center gap-2 text-[11px] text-ink-600">
                          <span className="font-semibold text-ink-700">
                            Verification Evidence ({app.evidence.length}):
                          </span>
                          {app.evidence.map((ev: VerificationEvidenceDto) => (
                            <span
                              key={ev.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200 text-stone-700 text-[10px] font-mono"
                            >
                              <FileText className="w-3 h-3 text-stone-500" />
                              <span>{ev.evidenceType}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2 CONTENT: DISPUTES & COMPLAINTS QUEUE                                */}
        {/* ========================================================================= */}
        {activeTab === "disputes" && (
          <div className="space-y-6 animate-fade-in">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-white border border-stone-200/80 shadow-2xs space-y-1">
                <div className="text-[11px] font-semibold text-ink-500">Total Disputes</div>
                <div className="text-xl sm:text-2xl font-bold text-ink-900 font-mono">
                  {totalComplaintsCount}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200/80 shadow-2xs space-y-1">
                <div className="text-[11px] font-semibold text-rose-800">Open Disputes</div>
                <div className="text-xl sm:text-2xl font-bold text-rose-900 font-mono">
                  {openComplaintsCount}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-jade-50/60 border border-jade-200/80 shadow-2xs space-y-1">
                <div className="text-[11px] font-semibold text-jade-800">Resolved Cases</div>
                <div className="text-xl sm:text-2xl font-bold text-jade-900 font-mono">
                  {resolvedComplaintsCount}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 shadow-2xs space-y-1">
                <div className="text-[11px] font-semibold text-stone-600">Dismissed Cases</div>
                <div className="text-xl sm:text-2xl font-bold text-stone-800 font-mono">
                  {dismissedComplaintsCount}
                </div>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {["All", "Submitted", "UnderReview", "Resolved", "Dismissed"].map((tab) => {
                const isActive = selectedComplaintStatus.toLowerCase() === tab.toLowerCase();
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSelectedComplaintStatus(tab)}
                    className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      isActive
                        ? "bg-jade-800 text-white shadow-2xs"
                        : "bg-white text-ink-600 hover:bg-stone-100 border border-stone-200"
                    }`}
                  >
                    {tab === "UnderReview" ? "Under Review" : tab}
                  </button>
                );
              })}
            </div>

            {/* Complaints Error Alert */}
            {complaintsError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{complaintsError}</span>
              </div>
            )}

            {/* Complaints List */}
            {isComplaintsLoading ? (
              <div className="py-16 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-jade-700 mx-auto" />
                <p className="text-xs text-ink-500">Loading complaints and dispute queue...</p>
              </div>
            ) : filteredComplaints.length === 0 ? (
              <div className="py-14 text-center border border-dashed border-stone-300 rounded-2xl bg-stone-50/50 space-y-2">
                <Scale className="w-8 h-8 text-stone-400 mx-auto" />
                <p className="text-xs font-semibold text-ink-700">No disputes found</p>
                <p className="text-[11px] text-ink-500">
                  {selectedComplaintStatus === "All"
                    ? "No complaints or order disputes have been filed across the platform."
                    : `No complaints with status "${selectedComplaintStatus}".`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredComplaints.map((c) => {
                  const isOpen = c.status === "Submitted" || c.status === "UnderReview";
                  const isResolved = c.status === "Resolved";
                  const isDismissed = c.status === "Dismissed";

                  return (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs hover:border-stone-300 transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold font-mono text-ink-900">
                              Dispute #{c.id.slice(0, 8)}
                            </span>
                            {c.orderId && (
                              <Link
                                href={`/orders/${c.orderId}`}
                                target="_blank"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-jade-800 hover:underline bg-jade-50 px-2 py-0.5 rounded-md border border-jade-200"
                              >
                                <Package className="w-3 h-3 text-jade-700" />
                                <span>Order #{c.orderId.slice(0, 8)}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </Link>
                            )}

                            {isOpen && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>{c.status}</span>
                              </span>
                            )}
                            {isResolved && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-jade-50 text-jade-800 border border-jade-200">
                                <CheckCircle2 className="w-3 h-3 text-jade-700" />
                                <span>Resolved</span>
                              </span>
                            )}
                            {isDismissed && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-300">
                                <XCircle className="w-3 h-3 text-stone-500" />
                                <span>Dismissed</span>
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-stone-400" />
                              <span>Reporter: {c.reporterUserId.slice(0, 8)}...</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-stone-400" />
                              <span>{new Date(c.createdAtUtc).toLocaleString()}</span>
                            </span>
                          </div>
                        </div>

                        {isOpen && (
                          <button
                            type="button"
                            onClick={() => openComplaintModal(c)}
                            className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-jade-800 hover:bg-jade-900 text-white text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Scale className="w-3.5 h-3.5" />
                            <span>Adjudicate Dispute</span>
                          </button>
                        )}
                      </div>

                      {/* Description Card */}
                      <div className="p-3 rounded-xl bg-stone-50/80 border border-stone-200/80 text-xs space-y-1">
                        <span className="text-[10px] uppercase font-bold text-ink-500 tracking-wider block">
                          Allegation / Issue Description
                        </span>
                        <p className="text-ink-800 leading-relaxed font-sans">{c.description}</p>
                      </div>

                      {/* Resolution Audit Trail */}
                      {c.resolutionSummary && (
                        <div className="p-3 rounded-xl bg-jade-50/70 border border-jade-200/80 text-xs space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-jade-900">
                            <span>Administrative Finding: {c.resolutionCode}</span>
                            {c.resolvedAtUtc && (
                              <span className="font-mono">{new Date(c.resolvedAtUtc).toLocaleString()}</span>
                            )}
                          </div>
                          <p className="text-ink-800 italic">“{c.resolutionSummary}”</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3 CONTENT: SUBSCRIPTIONS & PAYMENT VERIFICATION QUEUE                 */}
        {/* ========================================================================= */}
        {activeTab === "subscriptions" && (
          <div className="space-y-6 animate-fade-in">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-1">
                <span className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider block">
                  Total Submissions
                </span>
                <span className="text-xl font-bold font-mono text-ink-900">{totalSubsCount}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200 shadow-2xs space-y-1">
                <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                  <span>Pending Review</span>
                </span>
                <span className="text-xl font-bold font-mono text-amber-900">
                  {pendingSubsCount}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200 shadow-2xs space-y-1">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Active Subscriptions</span>
                </span>
                <span className="text-xl font-bold font-mono text-emerald-900">
                  {activeSubsCount}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-red-50/50 border border-red-200 shadow-2xs space-y-1">
                <span className="text-[11px] font-semibold text-red-800 uppercase tracking-wider block flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-red-600" />
                  <span>Rejected / Mismatched</span>
                </span>
                <span className="text-xl font-bold font-mono text-red-900">{rejectedSubsCount}</span>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-ink-500 flex items-center gap-1 mr-1">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter:</span>
                </span>
                {["All", "PendingVerification", "Active", "Rejected"].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setSelectedSubStatus(status)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      selectedSubStatus.toLowerCase() === status.toLowerCase()
                        ? "bg-jade-800 text-white shadow-2xs"
                        : "bg-white text-ink-600 hover:bg-stone-100 border border-stone-200"
                    }`}
                  >
                    {status === "PendingVerification"
                      ? "Pending Verification"
                      : status}
                  </button>
                ))}
              </div>

              <span className="text-xs text-ink-400 font-mono">
                Showing {filteredSubscriptions.length} of {totalSubsCount} submissions
              </span>
            </div>

            {subsError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{subsError}</span>
              </div>
            )}

            {/* Subscriptions List */}
            {isSubsLoading ? (
              <div className="py-16 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-jade-700 mx-auto" />
                <p className="text-xs text-ink-500">Loading subscription payment queue...</p>
              </div>
            ) : filteredSubscriptions.length === 0 ? (
              <div className="py-14 text-center border border-dashed border-stone-300 rounded-2xl bg-stone-50/50 space-y-2">
                <CreditCard className="w-8 h-8 text-stone-400 mx-auto" />
                <p className="text-xs font-semibold text-ink-700">No subscription submissions found</p>
                <p className="text-[11px] text-ink-500">
                  {selectedSubStatus === "All"
                    ? "No sellers have submitted subscription payments yet."
                    : `No subscriptions with status "${selectedSubStatus}".`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSubscriptions.map((sub) => {
                  const isPending = sub.status === "PendingVerification";
                  const isActive = sub.status === "Active";
                  const isRejected = sub.status === "Rejected";
                  const isKBZ = sub.paymentMethod?.toLowerCase() === "kbzpay";
                  const isWave = sub.paymentMethod?.toLowerCase() === "wavepay";

                  return (
                    <div
                      key={sub.id}
                      className={`p-4 rounded-2xl bg-white border transition-all space-y-3.5 shadow-2xs ${
                        isPending
                          ? "border-amber-300 ring-1 ring-amber-300/40"
                          : "border-stone-200 hover:border-stone-300"
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-stone-100">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-ink-900 flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-jade-800" />
                              <span>{sub.storeName || "Artisan Workshop"}</span>
                            </span>
                            <span className="text-[11px] text-stone-400 font-mono">
                              Seller ID: {sub.sellerUserId.slice(0, 8)}...
                            </span>

                            {isPending && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                                <span>Pending Verification</span>
                              </span>
                            )}
                            {isActive && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Active Tier</span>
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-800 border border-red-200">
                                <XCircle className="w-3 h-3 text-red-600" />
                                <span>Rejected</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Plan & Amount Header */}
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-stone-100 text-ink-800 border border-stone-200">
                            {sub.planName} Plan ({sub.maxActiveListings} Listings)
                          </span>
                          <span className="text-sm font-bold font-mono text-jade-800">
                            {sub.paymentAmount !== null && sub.paymentAmount !== undefined
                              ? `${sub.paymentAmount.toLocaleString()} ${sub.paymentCurrency || "MMK"}`
                              : "0 MMK"}
                          </span>
                        </div>
                      </div>

                      {/* Card Body Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {/* Provider */}
                        <div className="space-y-0.5">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block">
                            Payment Method
                          </span>
                          <div className="flex items-center gap-1.5">
                            {isKBZ ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-blue-50 text-[#005bac] border border-blue-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#005bac]" />
                                <span>KBZPay</span>
                              </span>
                            ) : isWave ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-yellow-50 text-yellow-900 border border-yellow-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                                <span>WavePay</span>
                              </span>
                            ) : (
                              <span className="font-medium text-ink-700">
                                {sub.paymentMethod || "Direct"}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Transaction Reference */}
                        <div className="space-y-0.5">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block">
                            Transaction Ref
                          </span>
                          {sub.transactionReference ? (
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-[11px] font-bold text-ink-900 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200 truncate max-w-[140px]">
                                {sub.transactionReference}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyRef(sub.transactionReference!)}
                                className="p-1 text-stone-400 hover:text-ink-700 hover:bg-stone-100 rounded transition-colors cursor-pointer"
                                title="Copy reference"
                              >
                                {copiedRef === sub.transactionReference ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-stone-400 italic">None</span>
                          )}
                        </div>

                        {/* Duration */}
                        <div className="space-y-0.5">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block">
                            Duration
                          </span>
                          <span className="font-semibold text-ink-800">
                            {sub.durationMonths || 1} month{sub.durationMonths !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {/* Submitted Time */}
                        <div className="space-y-0.5">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block">
                            Submitted
                          </span>
                          <span className="text-ink-600 text-[11px] font-mono">
                            {sub.paymentSubmittedAtUtc
                              ? new Date(sub.paymentSubmittedAtUtc).toLocaleString()
                              : new Date(sub.startsAtUtc).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Expiry or Rejection Details Banner */}
                      {isActive && sub.expiresAtUtc && (
                        <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-[11px] text-ink-600 flex items-center justify-between">
                          <span>
                            Active Subscription Expires:{" "}
                            <strong className="font-mono text-ink-800">
                              {new Date(sub.expiresAtUtc).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </strong>
                          </span>
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Listing Quota: {sub.maxActiveListings}</span>
                          </span>
                        </div>
                      )}

                      {isRejected && sub.rejectionReason && (
                        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-800 space-y-0.5">
                          <span className="font-bold uppercase tracking-wider text-[10px] text-red-900 block">
                            Rejection Audit Rationale:
                          </span>
                          <p className="italic">“{sub.rejectionReason}”</p>
                        </div>
                      )}

                      {/* Review Buttons */}
                      {isPending && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-100">
                          <button
                            type="button"
                            onClick={() => openSubDecisionModal(sub, "Rejected")}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject Reference</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openSubDecisionModal(sub, "Approved")}
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-jade-800 hover:bg-jade-900 text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verify &amp; Activate Plan</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4 CONTENT: STORE RE-VERIFICATIONS QUEUE                              */}
        {/* ========================================================================= */}
        {activeTab === "reverifications" && (
          <div className="space-y-6 animate-fade-in">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-1">
                <span className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider block">
                  Total Stores
                </span>
                <span className="text-xl font-bold font-mono text-ink-900">{totalStoresCount}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200 shadow-2xs space-y-1">
                <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                  <span>Pending Re-verification</span>
                </span>
                <span className="text-xl font-bold font-mono text-amber-900">
                  {pendingStoresCount}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200 shadow-2xs space-y-1">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Verified Stores</span>
                </span>
                <span className="text-xl font-bold font-mono text-emerald-900">
                  {verifiedStoresCount}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-red-50/50 border border-red-200 shadow-2xs space-y-1">
                <span className="text-[11px] font-semibold text-red-800 uppercase tracking-wider block flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-red-600" />
                  <span>Re-verification Rejected</span>
                </span>
                <span className="text-xl font-bold font-mono text-red-900">{rejectedStoresCount}</span>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-ink-500 flex items-center gap-1 mr-1">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter:</span>
                </span>
                {["All", "PendingReverification", "Verified", "ReverificationRejected"].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setSelectedStoreStatus(status)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      selectedStoreStatus.toLowerCase() === status.toLowerCase()
                        ? "bg-jade-800 text-white shadow-2xs"
                        : "bg-white text-ink-600 hover:bg-stone-100 border border-stone-200"
                    }`}
                  >
                    {status === "PendingReverification"
                      ? "Pending Re-verification"
                      : status === "ReverificationRejected"
                      ? "Rejected"
                      : status}
                  </button>
                ))}
              </div>

              <span className="text-xs text-ink-400 font-mono">
                Showing {filteredStores.length} of {totalStoresCount} stores
              </span>
            </div>

            {storesError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{storesError}</span>
              </div>
            )}

            {/* Stores List */}
            {isStoresLoading ? (
              <div className="py-16 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-jade-700 mx-auto" />
                <p className="text-xs text-ink-500">Loading store re-verification queue...</p>
              </div>
            ) : filteredStores.length === 0 ? (
              <div className="py-14 text-center border border-dashed border-stone-300 rounded-2xl bg-stone-50/50 space-y-2">
                <Store className="w-8 h-8 text-stone-400 mx-auto" />
                <p className="text-xs font-semibold text-ink-700">No stores found</p>
                <p className="text-[11px] text-ink-500">
                  {selectedStoreStatus === "All"
                    ? "There are currently no seller stores registered on the platform."
                    : `No stores matching filter "${selectedStoreStatus}".`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredStores.map((st) => {
                  const isPending = st.verificationStatus === "PendingReverification";
                  const isVerified = st.verificationStatus === "Verified";
                  const isRejected = st.verificationStatus === "ReverificationRejected";

                  return (
                    <div
                      key={st.sellerUserId}
                      className={`p-4 rounded-2xl border transition-all space-y-3 bg-white shadow-2xs ${
                        isPending
                          ? "border-amber-300 ring-1 ring-amber-200/50"
                          : isRejected
                          ? "border-red-200"
                          : "border-stone-200"
                      }`}
                    >
                      {/* Store Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isPending
                                ? "bg-amber-100 text-amber-800"
                                : isRejected
                                ? "bg-red-100 text-red-800"
                                : "bg-jade-100 text-jade-800"
                            }`}
                          >
                            <Store className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-bold text-ink-900">{st.storeName}</h3>
                              <span className="text-[11px] font-mono text-ink-400">
                                slug: {st.slug}
                              </span>
                            </div>
                            <p className="text-[11px] text-ink-500">
                              Artisan Store Profile · Member since {new Date(st.createdAtUtc).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3 animate-pulse" />
                              <span>Pending Re-verification</span>
                            </span>
                          )}
                          {isVerified && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Verified Store</span>
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
                              <XCircle className="w-3 h-3" />
                              <span>Re-verification Rejected</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Store Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block">
                            Seller User ID
                          </span>
                          <span className="font-mono text-ink-700 text-[11px] break-all">
                            {st.sellerUserId}
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block">
                            Contact Phone
                          </span>
                          <span className="font-semibold text-ink-800 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-ink-400" />
                            <span>{st.contactPhone || "None provided"}</span>
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 block">
                            City / Township
                          </span>
                          <span className="font-semibold text-ink-800 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-ink-400" />
                            <span>{st.cityOrTownship || "Not specified"}</span>
                          </span>
                        </div>
                      </div>

                      {/* Bio preview if available */}
                      {st.bio && (
                        <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80 text-[11px] text-ink-600 space-y-0.5">
                          <span className="font-semibold text-ink-700 text-[10px] uppercase tracking-wider block">
                            Store Description / Bio:
                          </span>
                          <p className="line-clamp-2 italic text-ink-800">“{st.bio}”</p>
                        </div>
                      )}

                      {/* Pending Notice & Action Buttons */}
                      {isPending && (
                        <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                          <div className="flex items-center gap-2 text-xs text-amber-900">
                            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>
                              Store name or profile details were modified. Product publishing is blocked until approved.
                            </span>
                          </div>

                          <div className="flex items-center justify-end gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => openStoreDecisionModal(st, "Rejected")}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject Update</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openStoreDecisionModal(st, "Approved")}
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-jade-800 hover:bg-jade-900 text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve &amp; Verify</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {isRejected && (
                        <div className="p-2.5 rounded-xl bg-red-50/80 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                          <span>
                            Re-verification was rejected. Product publishing remains suspended until compliant store details are submitted.
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 1: SELLER APPLICATION DECISION MODAL                                */}
        {/* ========================================================================= */}
        {activeApp && decisionAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-stone-200 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  {decisionAction === "Approved" ? (
                    <div className="w-8 h-8 rounded-xl bg-jade-50 text-jade-800 flex items-center justify-center border border-jade-200">
                      <CheckCircle2 className="w-4 h-4 text-jade-700" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-red-50 text-red-800 flex items-center justify-center border border-red-200">
                      <XCircle className="w-4 h-4 text-red-700" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-ink-900">
                      {decisionAction === "Approved" ? "Approve Artisan Workshop" : "Reject Application"}
                    </h3>
                    <p className="text-[11px] text-ink-500">{activeApp.proposedStoreName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveApp(null)}
                  className="text-stone-400 hover:text-ink-700 text-xs font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {appDecisionFeedback && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {appDecisionFeedback}
                </div>
              )}

              <form onSubmit={handleAppDecision} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="decision-reason" className="block text-xs font-bold text-ink-900">
                    Administrative Audit Rationale <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="decision-reason"
                    rows={3}
                    required
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    disabled={isDecidingApp}
                    placeholder="Enter verifiable compliance rationale..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-jade-600/30 focus:border-jade-600"
                  />
                  <p className="text-[10px] text-ink-500">
                    This reason is recorded immutably in system audit logs (SEC-12).
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setActiveApp(null)}
                    disabled={isDecidingApp}
                    className="px-3.5 py-1.5 rounded-xl border border-stone-300 text-xs font-semibold text-ink-700 hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDecidingApp}
                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer ${
                      decisionAction === "Approved"
                        ? "bg-jade-800 hover:bg-jade-900"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {isDecidingApp && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm {decisionAction}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 2: DISPUTE & COMPLAINT ADJUDICATION MODAL                           */}
        {/* ========================================================================= */}
        {activeComplaint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-stone-200 p-5 sm:p-6 space-y-4 my-8">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200 shrink-0">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink-900">
                      Dispute Adjudication &amp; Settlement
                    </h3>
                    <p className="text-[11px] text-ink-500 font-mono">
                      Complaint #{activeComplaint.id.slice(0, 8)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveComplaint(null)}
                  className="text-stone-400 hover:text-ink-700 text-xs font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Feedback Alert */}
              {disputeFeedback && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{disputeFeedback}</span>
                </div>
              )}

              {/* Disputed Order Context */}
              {isLoadingOrder ? (
                <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 text-center text-xs text-ink-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-jade-700" />
                  <span>Fetching transaction details...</span>
                </div>
              ) : disputedOrder ? (
                <div className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200/90 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink-900 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-jade-800" />
                      <span>Order #{disputedOrder.id.slice(0, 8)}</span>
                    </span>
                    <OrderStatusBadge status={disputedOrder.status} size="sm" />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div>
                      <span className="text-ink-400 block">Subtotal</span>
                      <span className="font-bold text-ink-900">
                        {new Intl.NumberFormat("en-US").format(disputedOrder.subtotalAmount)} MMK
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-400 block">Courier Tracking</span>
                      <span className="font-mono text-ink-800">
                        {disputedOrder.courierTrackingReference || "Direct hand-off / none"}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-400 block">Buyer Phone</span>
                      <span className="font-mono text-ink-800">{disputedOrder.buyerContactPhone}</span>
                    </div>
                    <div>
                      <span className="text-ink-400 block">Delivery Township</span>
                      <span className="text-ink-800">{disputedOrder.deliveryCityOrTownship}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Allegation Note */}
              <div className="p-3 rounded-2xl bg-rose-50/50 border border-rose-200/80 text-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-900 block">
                  Reported Issue Description
                </span>
                <p className="text-ink-800 leading-relaxed font-sans">{activeComplaint.description}</p>
              </div>

              {/* Adjudication Form */}
              <form onSubmit={handleAdjudicateDispute} className="space-y-4 pt-1">
                {/* Resolution Finding Code */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-ink-900 block">
                    Administrative Resolution Finding <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={resolutionCode}
                    onChange={(e) => setResolutionCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white text-ink-900 focus:outline-none focus:border-jade-600 shadow-2xs cursor-pointer"
                  >
                    <option value="GoodsDeliveredConfirmed">
                      GoodsDeliveredConfirmed · Courier waybill proof confirms receipt
                    </option>
                    <option value="RefundAgreed">
                      RefundAgreed · Parties agreed to return or refund
                    </option>
                    <option value="WarningIssued">
                      WarningIssued · Policy infraction recorded against merchant
                    </option>
                    <option value="Unfounded">
                      Unfounded · Malicious or unsubstantiated complaint (Dismiss)
                    </option>
                  </select>
                </div>

                {/* Linked Order Resolution (if order is disputed) */}
                {disputedOrder && disputedOrder.status === "Disputed" && (
                  <div className="space-y-1 p-3 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs space-y-2">
                    <label className="text-xs font-bold text-amber-950 block">
                      Order State Transition (Non-Custodial Dispute Adjudication)
                    </label>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      As administrator, you can settle the disputed order into Completed or Cancelled status:
                    </p>
                    <select
                      value={orderResolutionAction}
                      onChange={(e) =>
                        setOrderResolutionAction(e.target.value as "KeepDisputed" | "Completed" | "Cancelled")
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 bg-white text-ink-900 focus:outline-none focus:border-amber-600 shadow-2xs cursor-pointer font-semibold"
                    >
                      <option value="Completed">Transition Order to COMPLETED (Confirm delivery)</option>
                      <option value="Cancelled">Transition Order to CANCELLED (Cancel transaction)</option>
                      <option value="KeepDisputed">Keep Order in DISPUTED (Settle complaint record only)</option>
                    </select>
                  </div>
                )}

                {/* Audit Rationale */}
                <div className="space-y-1">
                  <label htmlFor="adjudication-rationale" className="text-xs font-bold text-ink-900 block">
                    Administrative Audit Finding &amp; Summary <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="adjudication-rationale"
                    rows={3}
                    required
                    value={resolutionSummary}
                    onChange={(e) => setResolutionSummary(e.target.value)}
                    disabled={isAdjudicatingDispute}
                    placeholder="e.g. Courier tracking verified with dispatcher. Delivery confirmed to recipient at stated address."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-jade-600/30 focus:border-jade-600"
                  />
                  <p className="text-[10px] text-ink-500">
                    Logged immutably to AuditEvents and recorded on the seller trust profile.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setActiveComplaint(null)}
                    disabled={isAdjudicatingDispute}
                    className="px-3.5 py-1.5 rounded-xl border border-stone-300 text-xs font-semibold text-ink-700 hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAdjudicatingDispute || !resolutionSummary.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jade-800 hover:bg-jade-900 disabled:opacity-50 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    {isAdjudicatingDispute && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Dispute Resolution</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 3: SUBSCRIPTION PAYMENT VERIFICATION MODAL                          */}
        {/* ========================================================================= */}
        {activeSub && subDecisionAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-stone-200 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  {subDecisionAction === "Approved" ? (
                    <div className="w-8 h-8 rounded-xl bg-jade-50 text-jade-800 flex items-center justify-center border border-jade-200">
                      <CheckCircle2 className="w-4 h-4 text-jade-700" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-red-50 text-red-800 flex items-center justify-center border border-red-200">
                      <XCircle className="w-4 h-4 text-red-700" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-ink-900">
                      {subDecisionAction === "Approved"
                        ? "Verify & Activate Subscription"
                        : "Reject Subscription Payment"}
                    </h3>
                    <p className="text-[11px] text-ink-500">
                      {activeSub.storeName || "Artisan Workshop"} · {activeSub.planName} Plan
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSub(null);
                    setSubDecisionAction(null);
                  }}
                  className="text-stone-400 hover:text-ink-700 text-xs font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {subDecisionFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                    subDecisionFeedback.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  }`}
                >
                  {subDecisionFeedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  )}
                  <span>{subDecisionFeedback.message}</span>
                </div>
              )}

              {/* Submission Details Summary Box */}
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-ink-500 font-medium">Provider:</span>
                  <span className="font-bold text-ink-800">{activeSub.paymentMethod}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-500 font-medium">Transaction Ref:</span>
                  <span className="font-mono font-bold text-ink-900 bg-white px-2 py-0.5 rounded border border-stone-200">
                    {activeSub.transactionReference || "None"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-500 font-medium">Transfer Amount:</span>
                  <span className="font-mono font-bold text-jade-800">
                    {activeSub.paymentAmount !== null && activeSub.paymentAmount !== undefined
                      ? `${activeSub.paymentAmount.toLocaleString()} ${activeSub.paymentCurrency || "MMK"}`
                      : "0 MMK"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-500 font-medium">Target Quota:</span>
                  <span className="font-semibold text-ink-800">
                    {activeSub.maxActiveListings} Active Listings
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubDecision} className="space-y-4">
                {subDecisionAction === "Approved" ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-ink-900">
                        Confirm Duration (Months)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={subDurationMonths}
                        onChange={(e) => setSubDurationMonths(Math.max(1, parseInt(e.target.value) || 1))}
                        disabled={isDecidingSub}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-jade-600/30 focus:border-jade-600 font-mono"
                      />
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900 space-y-1">
                      <div className="flex items-center gap-1 font-semibold text-emerald-950">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Platform Impact:</span>
                      </div>
                      <p>
                        Confirming approval will instantly transition this subscription to <strong>Active</strong>, calculate the expiration date ({subDurationMonths} month{subDurationMonths !== 1 ? "s" : ""} from today), elevate the seller&apos;s product listing quota to <strong>{activeSub.maxActiveListings} listings</strong>, and record an immutable audit event.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-ink-900">
                      Rejection Audit Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={subRejectionReason}
                      onChange={(e) => setSubRejectionReason(e.target.value)}
                      disabled={isDecidingSub}
                      placeholder="e.g. Reference number not found in KBZPay statement, or transfer amount was insufficient."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
                    />
                    <p className="text-[10px] text-ink-500">
                      This explanation will be visible to the seller so they can submit a corrected payment reference.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSub(null);
                      setSubDecisionAction(null);
                    }}
                    disabled={isDecidingSub}
                    className="px-3.5 py-1.5 rounded-xl border border-stone-300 text-xs font-semibold text-ink-700 hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      isDecidingSub ||
                      (subDecisionAction === "Rejected" && !subRejectionReason.trim())
                    }
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 ${
                      subDecisionAction === "Approved"
                        ? "bg-jade-800 hover:bg-jade-900"
                        : "bg-red-700 hover:bg-red-800"
                    }`}
                  >
                    {isDecidingSub && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>
                      {subDecisionAction === "Approved"
                        ? "Approve & Activate Quota"
                        : "Confirm Rejection"}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 4: STORE RE-VERIFICATION DECISION MODAL                             */}
        {/* ========================================================================= */}
        {activeStore && storeDecisionAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-stone-200 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  {storeDecisionAction === "Approved" ? (
                    <div className="w-8 h-8 rounded-xl bg-jade-50 text-jade-800 flex items-center justify-center border border-jade-200">
                      <CheckCircle2 className="w-4 h-4 text-jade-700" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-red-50 text-red-800 flex items-center justify-center border border-red-200">
                      <XCircle className="w-4 h-4 text-red-700" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-ink-900">
                      {storeDecisionAction === "Approved"
                        ? "Approve Store Re-verification"
                        : "Reject Store Re-verification"}
                    </h3>
                    <p className="text-[11px] text-ink-500">
                      {activeStore.storeName} ({activeStore.slug})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveStore(null);
                    setStoreDecisionAction(null);
                  }}
                  className="text-stone-400 hover:text-ink-700 text-xs font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {storeDecisionFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    storeDecisionFeedback.type === "success"
                      ? "bg-jade-50 border border-jade-200 text-jade-800"
                      : "bg-red-50 border border-red-200 text-red-800"
                  }`}
                >
                  {storeDecisionFeedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-jade-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{storeDecisionFeedback.message}</span>
                </div>
              )}

              <form onSubmit={handleStoreDecision} className="space-y-4">
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5 text-xs text-ink-700">
                  <div className="flex justify-between">
                    <span className="text-ink-500">Store Name:</span>
                    <strong className="text-ink-900">{activeStore.storeName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-500">Slug:</span>
                    <span className="font-mono text-ink-700">/sellers/{activeStore.slug}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-500">Phone:</span>
                    <span className="text-ink-800">{activeStore.contactPhone || "None"}</span>
                  </div>
                  {activeStore.cityOrTownship && (
                    <div className="flex justify-between">
                      <span className="text-ink-500">Location:</span>
                      <span className="text-ink-800">{activeStore.cityOrTownship}</span>
                    </div>
                  )}
                </div>

                <div className="text-xs text-ink-600 leading-relaxed">
                  {storeDecisionAction === "Approved" ? (
                    <p className="p-2.5 rounded-xl bg-jade-50/70 border border-jade-200/60 text-jade-950">
                      Approving restores this store to <strong>Verified</strong> status and immediately unlocks product publishing and listing creation.
                    </p>
                  ) : (
                    <p className="p-2.5 rounded-xl bg-red-50/70 border border-red-200/60 text-red-950">
                      Rejecting marks the store as <strong>ReverificationRejected</strong> and maintains the block on product publishing until the seller updates with compliant information.
                    </p>
                  )}
                </div>

                {storeDecisionAction === "Rejected" && (
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-ink-700">
                      Rejection Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={storeDecisionReason}
                      onChange={(e) => setStoreDecisionReason(e.target.value)}
                      disabled={isDecidingStore}
                      placeholder="e.g. Store name contains trademarked brand names or misleading claims."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
                    />
                    <p className="text-[10px] text-ink-500">
                      This explanation will assist the artisan in correcting their store profile details.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveStore(null);
                      setStoreDecisionAction(null);
                    }}
                    disabled={isDecidingStore}
                    className="px-3.5 py-1.5 rounded-xl border border-stone-300 text-xs font-semibold text-ink-700 hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      isDecidingStore ||
                      (storeDecisionAction === "Rejected" && !storeDecisionReason.trim())
                    }
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 ${
                      storeDecisionAction === "Approved"
                        ? "bg-jade-800 hover:bg-jade-900"
                        : "bg-red-700 hover:bg-red-800"
                    }`}
                  >
                    {isDecidingStore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>
                      {storeDecisionAction === "Approved"
                        ? "Approve & Restore Verified"
                        : "Confirm Rejection"}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MobileViewportContainer>
  );
}
