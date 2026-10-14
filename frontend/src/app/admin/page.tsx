"use client";

import React, { useEffect, useState, useTransition } from "react";
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
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { adminApi } from "@/lib/admin-api";
import { SellerApplicationDto, VerificationEvidenceDto } from "@/types/api";
import { MobileViewportContainer } from "@/components/layout/MobileViewportContainer";
import { AppHeader } from "@/components/layout/AppHeader";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();

  const [applications, setApplications] = useState<SellerApplicationDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("All");

  // Decision Modal State
  const [activeApp, setActiveApp] = useState<SellerApplicationDto | null>(null);
  const [decisionReason, setDecisionReason] = useState<string>("");
  const [decisionAction, setDecisionAction] = useState<"Approved" | "Rejected" | null>(null);
  const [isDeciding, setIsDeciding] = useState<boolean>(false);
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null);

  const fetchApplications = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminApi.getSellerApplications();
      setApplications(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load seller applications.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push("/auth/login?returnUrl=/admin");
      } else if (isAdmin) {
        fetchApplications();
      }
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const handleDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeApp || !decisionAction) return;

    if (!decisionReason.trim()) {
      setDecisionFeedback("Please provide a decision rationale note for audit records.");
      return;
    }

    setIsDeciding(true);
    setDecisionFeedback(null);

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
      setDecisionFeedback(
        err instanceof Error ? err.message : "Failed to record administrative decision."
      );
    } finally {
      setIsDeciding(false);
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

  // Summary counts
  const totalCount = applications.length;
  const pendingCount = applications.filter(
    (a) => a.status === "Submitted" || a.status === "UnderReview"
  ).length;
  const approvedCount = applications.filter((a) => a.status === "Approved").length;
  const rejectedCount = applications.filter(
    (a) => a.status === "Rejected" || a.status === "MoreInformationRequired"
  ).length;

  const filteredApplications =
    selectedStatus === "All"
      ? applications
      : applications.filter((a) => a.status.toLowerCase() === selectedStatus.toLowerCase());

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
              Artisan Verification &amp; Applications
            </h1>
            <p className="text-xs text-ink-500">
              Review genuine Myanmar artisan credentials, workshop evidence, and identity submissions.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchApplications}
            disabled={isLoading}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-ink-700 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-jade-700" : "text-ink-500"}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-white border border-stone-200/80 shadow-2xs space-y-1">
            <div className="text-[11px] font-semibold text-ink-500">Total Applications</div>
            <div className="text-xl sm:text-2xl font-bold text-ink-900 font-mono">{totalCount}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 shadow-2xs space-y-1">
            <div className="text-[11px] font-semibold text-amber-800">Pending Review</div>
            <div className="text-xl sm:text-2xl font-bold text-amber-900 font-mono">{pendingCount}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-jade-50/60 border border-jade-200/80 shadow-2xs space-y-1">
            <div className="text-[11px] font-semibold text-jade-800">Approved Artisans</div>
            <div className="text-xl sm:text-2xl font-bold text-jade-900 font-mono">{approvedCount}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 shadow-2xs space-y-1">
            <div className="text-[11px] font-semibold text-stone-600">Other / Rejected</div>
            <div className="text-xl sm:text-2xl font-bold text-stone-800 font-mono">{rejectedCount}</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {["All", "Submitted", "UnderReview", "Approved", "Rejected"].map((tab) => {
            const isActive = selectedStatus.toLowerCase() === tab.toLowerCase();
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setSelectedStatus(tab)}
                className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors ${
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

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Applications List */}
        {isLoading ? (
          <div className="py-16 text-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-jade-700 mx-auto" />
            <p className="text-xs text-ink-500">Loading seller applications...</p>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="py-14 text-center border border-dashed border-stone-300 rounded-2xl bg-stone-50/50 space-y-2">
            <Building2 className="w-8 h-8 text-stone-400 mx-auto" />
            <p className="text-xs font-semibold text-ink-700">No applications found</p>
            <p className="text-[11px] text-ink-500">
              {selectedStatus === "All"
                ? "No seller verification submissions exist in the database yet."
                : `No applications with status "${selectedStatus}".`}
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
                            setDecisionReason("Verified genuine Myanmar artisan credentials and physical workshop evidence.");
                            setDecisionFeedback(null);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-jade-800 hover:bg-jade-900 text-white text-xs font-semibold shadow-2xs transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveApp(app);
                            setDecisionAction("Rejected");
                            setDecisionReason("Evidence provided does not meet marketplace artisan authenticity standards.");
                            setDecisionFeedback(null);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white border border-stone-300 hover:border-red-400 hover:text-red-700 text-ink-700 text-xs font-semibold shadow-2xs transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Decision Reason if reviewed */}
                  {app.decisionReason && (
                    <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-[11px] text-ink-600">
                      <span className="font-semibold text-ink-800">Admin Audit Note:</span> {app.decisionReason}
                    </div>
                  )}

                  {/* Evidence Files Summary */}
                  {app.evidence && app.evidence.length > 0 && (
                    <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center gap-2 text-[11px] text-ink-600">
                      <span className="font-semibold text-ink-700">Verification Evidence ({app.evidence.length}):</span>
                      {app.evidence.map((ev, idx) => (
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

        {/* Decision Modal */}
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
                  className="text-stone-400 hover:text-ink-700 text-xs font-bold p-1"
                >
                  ✕
                </button>
              </div>

              {decisionFeedback && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {decisionFeedback}
                </div>
              )}

              <form onSubmit={handleDecision} className="space-y-4">
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
                    disabled={isDeciding}
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
                    disabled={isDeciding}
                    className="px-3.5 py-1.5 rounded-xl border border-stone-300 text-xs font-semibold text-ink-700 hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDeciding}
                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-white text-xs font-semibold shadow-2xs transition-colors ${
                      decisionAction === "Approved"
                        ? "bg-jade-800 hover:bg-jade-900"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {isDeciding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm {decisionAction}</span>
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
