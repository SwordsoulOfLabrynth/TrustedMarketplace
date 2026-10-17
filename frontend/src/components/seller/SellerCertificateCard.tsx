"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Download,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
  FileCheck,
  Code,
  Award,
  Info,
} from "lucide-react";
import { sellerCredentialsApi } from "@/lib/seller-api";
import { SellerCredentialStatusDto } from "@/types/api";

export function SellerCertificateCard() {
  const [data, setData] = useState<SellerCredentialStatusDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [isDownloadingSvg, setIsDownloadingSvg] = useState<boolean>(false);
  const [isDownloadingPng, setIsDownloadingPng] = useState<boolean>(false);

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await sellerCredentialsApi.getMyStatus();
      setData(res);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load seller verification credential status."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const activeCred = data?.activeCredential;
  const publicId = activeCred?.publicCredentialId;

  // Compute public verification URL
  const publicVerifyUrl =
    typeof window !== "undefined" && publicId
      ? `${window.location.origin}/verify/${publicId}`
      : activeCred?.publicVerificationUrl || "";

  // Compute portable badge URLs
  const badgeSvgUrl = publicId
    ? sellerCredentialsApi.getBadgeSvgUrl(publicId)
    : "";
  const badgePngUrl = publicId
    ? sellerCredentialsApi.getBadgePngUrl(publicId)
    : "";

  // Safe HTML embed snippet (escapes seller data and attributes)
  const embedSnippet = publicId
    ? `<a href="${publicVerifyUrl}" target="_blank" rel="noopener noreferrer" title="MatchGuard Identity-Verified Seller">\n  <img src="${badgeSvgUrl}" alt="Identity Verified by MatchGuard" width="380" height="90" style="border:none;max-width:100%;" />\n</a>`
    : "";

  const handleCopyLink = async () => {
    if (!publicVerifyUrl) return;
    try {
      await navigator.clipboard.writeText(publicVerifyUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleCopySnippet = async () => {
    if (!embedSnippet) return;
    try {
      await navigator.clipboard.writeText(embedSnippet);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleDownloadPdf = async () => {
    if (!activeCred) return;
    setIsDownloadingPdf(true);
    try {
      const blob = await sellerCredentialsApi.downloadMyCertificate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MatchGuard-Certificate-${activeCred.publicCredentialId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Failed to download official certificate."
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadBadge = async (format: "svg" | "png") => {
    if (!publicId) return;
    if (format === "svg") setIsDownloadingSvg(true);
    else setIsDownloadingPng(true);

    try {
      const blob = await sellerCredentialsApi.downloadBadge(publicId, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MatchGuard-Badge-${publicId}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : `Failed to download ${format.toUpperCase()} badge.`
      );
    } finally {
      if (format === "svg") setIsDownloadingSvg(false);
      else setIsDownloadingPng(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl border border-stone-200/90 p-6 shadow-2xs flex items-center justify-center gap-3 text-ink-500 text-xs min-h-[140px]">
        <Loader2 className="w-4 h-4 animate-spin text-jade-700" />
        <span>Loading credential and verification badge status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-3xl border border-rose-200 p-5 shadow-2xs">
        <div className="flex items-start gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block">Credential Status Notice</span>
            <p className="leading-relaxed">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Case 1: Ineligible Seller (no approved application or suspended account)
  if (!data?.isEligible) {
    return (
      <div className="bg-white rounded-3xl border border-stone-200/90 shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-stone-100 text-stone-600 shrink-0 mt-0.5">
              <Award className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-ink-900 tracking-tight">
                Identity-Verified Seller Certificate & Portable Badge
              </h3>
              <p className="text-xs text-ink-600 leading-relaxed">
                Official MatchGuard credentials confirm that your identity or business registration has been reviewed and approved by platform administrators.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Qualification Required</span>
            </div>
            <p className="leading-relaxed">
              {data?.ineligibilityReason ||
                "Your seller account must have an approved identity verification application to receive an official certificate and badge."}
            </p>
            <div className="pt-1">
              <Link
                href="/seller/apply"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-jade-800 hover:text-jade-900 underline underline-offset-2"
              >
                <span>View or Submit Identity Verification Application</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Credential was Revoked
  const latestRevoked = data?.history.find((c) => c.status === "Revoked");
  if (!activeCred && latestRevoked) {
    return (
      <div className="bg-white rounded-3xl border border-rose-300 shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-100 text-rose-700 shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-ink-900 tracking-tight">
                  Verification Credential Revoked
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-rose-100 text-rose-800">
                  Revoked
                </span>
              </div>
              <p className="text-xs text-ink-600 leading-relaxed">
                Credential ID: <span className="font-mono font-medium">{latestRevoked.publicCredentialId}</span>
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs space-y-1.5">
            <span className="font-semibold block">Revocation Notice</span>
            <p className="leading-relaxed">
              Your previously issued credential was revoked on{" "}
              {new Date(latestRevoked.revokedAtUtc || "").toLocaleDateString()}:{" "}
              <span className="font-medium italic">&quot;{latestRevoked.revocationReason}&quot;</span>.
            </p>
            <p className="text-[11px] text-rose-800 pt-1 leading-relaxed">
              Per MatchGuard security rules, portable badges and public verification pages reflect this status in real-time. If you believe this was an error, please reach out to platform administrators.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Case 3: Eligible but credential issuance is pending or in progress
  if (!activeCred) {
    return (
      <div className="bg-white rounded-3xl border border-stone-200/90 shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-jade-50 text-jade-700 shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-ink-900 tracking-tight">
                Identity-Verified Seller Credential
              </h3>
              <p className="text-xs text-ink-600 leading-relaxed">
                Your identity verification has been approved! Your official credential certificate and portable badges are currently being activated.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-jade-50/80 border border-jade-200 text-jade-950 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <Loader2 className="w-4 h-4 animate-spin text-jade-700 shrink-0" />
                <span>Activation in Progress</span>
              </div>
              <button
                type="button"
                onClick={loadStatus}
                className="inline-flex items-center gap-1 text-xs font-semibold text-jade-800 hover:text-jade-900 underline underline-offset-2 cursor-pointer"
              >
                Refresh Status
              </button>
            </div>
            <p className="leading-relaxed text-ink-600">
              Platform services synchronize active credentials in real time. Click refresh to load your newly issued certificate and portable badges.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Case 4: Active Eligible Credential (activeCred and publicId guaranteed non-null)
  return (
    <div className="bg-white rounded-3xl border border-jade-200/90 shadow-2xs overflow-hidden">
      {/* Header Accent */}
      <div className="bg-gradient-to-r from-jade-800 to-jade-950 p-5 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-xs text-jade-300 border border-white/15 shrink-0 mt-0.5">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold tracking-tight text-white">
                  Identity-Verified Seller Credential
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  Active
                </span>
              </div>
              <p className="text-xs text-jade-200/90 leading-relaxed">
                Credential ID:{" "}
                <span className="font-mono text-white font-semibold tracking-wider">
                  {publicId}
                </span>
              </p>
            </div>
          </div>

          <div className="shrink-0 text-left sm:text-right">
            <span className="text-[11px] text-jade-300/90 block">Issued UTC</span>
            <span className="text-xs font-mono font-medium text-white">
              {new Date(activeCred.issuedAtUtc).toISOString().replace("T", " ").slice(0, 19) + " UTC"}
            </span>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Scope Disclaimer Box (Rule T-01) */}
        <div className="p-3.5 rounded-2xl bg-ivory-100 border border-ivory-300 text-ink-700 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-jade-700 shrink-0 mt-0.5" />
          <div className="space-y-1 text-[11px] leading-relaxed">
            <span className="font-semibold text-ink-900 block">
              Official Verification Scope
            </span>
            <p>
              MatchGuard has verified the identity of this seller based on its official review process. This credential confirms identity verification only and does not guarantee product quality, product authenticity, legal compliance, seller conduct, or the safety of any transaction.
            </p>
          </div>
        </div>

        {/* Action Grid: Certificate Download & Badge Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left Column: Official PDF Certificate */}
          <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/50 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-ink-900 font-bold text-xs">
                <FileCheck className="w-4 h-4 text-jade-700" />
                <span>Official PDF Certificate</span>
              </div>
              <p className="text-[11px] text-ink-600 leading-relaxed">
                Download an official, digitally verifiable PDF certificate featuring your registered store name, unique non-guessable credential ID, and official verification QR code.
              </p>
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-jade-800 hover:bg-jade-900 text-white font-semibold text-xs shadow-2xs transition-all disabled:opacity-60 cursor-pointer"
            >
              {isDownloadingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Generating Certificate...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download PDF Certificate</span>
                </>
              )}
            </button>
          </div>

          {/* Right Column: Portable Live Badges */}
          <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/50 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-ink-900 font-bold text-xs">
                <Award className="w-4 h-4 text-jade-700" />
                <span>Portable Verification Badges</span>
              </div>
              <p className="text-[11px] text-ink-600 leading-relaxed">
                Display your verified standing on external shops, websites, and social profiles.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleDownloadBadge("svg")}
                disabled={isDownloadingSvg}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-ink-800 text-xs font-semibold shadow-2xs transition-all disabled:opacity-60 cursor-pointer"
              >
                {isDownloadingSvg ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-jade-700" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-jade-700" />
                )}
                <span>SVG Badge</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadBadge("png")}
                disabled={isDownloadingPng}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-ink-800 text-xs font-semibold shadow-2xs transition-all disabled:opacity-60 cursor-pointer"
              >
                {isDownloadingPng ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-jade-700" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-jade-700" />
                )}
                <span>PNG Badge</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Badge Preview */}
        <div className="p-4 rounded-2xl border border-jade-100 bg-jade-50/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-jade-950 uppercase tracking-wider block">
              Live Badge Preview
            </span>
            <span className="text-[10px] text-jade-800/80 font-mono">
              Vector SVG
            </span>
          </div>
          <div className="flex items-center justify-start p-3 bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={badgeSvgUrl}
              alt={`Identity Verified by MatchGuard - ${activeCred.sellerDisplayName || activeCred.storeName}`}
              width={380}
              height={90}
              className="h-12 sm:h-14 w-auto max-w-full object-contain"
            />
          </div>
        </div>

        {/* Public Verification Link */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-ink-800">
            Official Public Verification URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={publicVerifyUrl}
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-stone-300 bg-stone-50 text-ink-700 select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-jade-800 hover:bg-jade-900 text-white font-semibold text-xs shrink-0 transition-colors cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <Link
              href={`/verify/${publicId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl border border-stone-300 hover:bg-stone-50 text-ink-600 hover:text-ink-900 transition-colors"
              title="Open Public Verification Page"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* HTML Embed Snippet */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-ink-800">
              Safe HTML Website Embed Snippet
            </label>
            <button
              type="button"
              onClick={handleCopySnippet}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-jade-800 hover:text-jade-900 cursor-pointer"
            >
              {copiedSnippet ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700">Snippet Copied!</span>
                </>
              ) : (
                <>
                  <Code className="w-3 h-3" />
                  <span>Copy HTML Code</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-3 rounded-xl bg-stone-900 text-jade-300 text-[11px] font-mono overflow-x-auto leading-relaxed border border-stone-800">
            {embedSnippet}
          </pre>
          <span className="text-[11px] text-ink-400 block">
            Paste this snippet into your website footer, checkout, or about page to link directly to your real-time verification status.
          </span>
        </div>
      </div>
    </div>
  );
}
