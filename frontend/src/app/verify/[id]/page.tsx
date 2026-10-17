"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
  ExternalLink,
  Loader2,
  Calendar,
  User,
  Store,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Info,
  Award,
} from "lucide-react";
import { publicCredentialsApi } from "@/lib/public-api";
import { PublicCredentialVerificationDto } from "@/types/api";
import { MobileViewportContainer } from "@/components/layout/MobileViewportContainer";
import { AppHeader } from "@/components/layout/AppHeader";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PublicCredentialVerificationPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const credentialId = resolvedParams.id;

  const [verification, setVerification] = useState<PublicCredentialVerificationDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadVerification() {
      if (!credentialId) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await publicCredentialsApi.verifyCredential(credentialId);
        setVerification(res);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while verifying the credential."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadVerification();
  }, [credentialId]);

  const badgeSvgUrl = credentialId
    ? publicCredentialsApi.getBadgeSvgUrl(credentialId)
    : "";

  return (
    <MobileViewportContainer header={<AppHeader />}>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between text-xs text-ink-500">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 hover:text-ink-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Marketplace</span>
          </Link>
          <span className="font-mono text-[11px] opacity-75">
            Registry Verification Service
          </span>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-3xl border border-stone-200/90 p-8 shadow-2xs flex flex-col items-center justify-center gap-3 text-ink-500 text-xs min-h-[220px]">
            <Loader2 className="w-6 h-6 animate-spin text-jade-700" />
            <span className="font-medium text-ink-700">
              Validating credential with MatchGuard Official Registry...
            </span>
            <span className="text-[11px] font-mono text-ink-400">{credentialId}</span>
          </div>
        )}

        {/* Network / Unexpected Error */}
        {!isLoading && error && (
          <div className="bg-white rounded-3xl border border-rose-300 p-6 shadow-2xs space-y-3">
            <div className="flex items-start gap-3 text-rose-800">
              <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-sm font-bold tracking-tight">Verification Check Failed</h2>
                <p className="text-xs text-rose-700 leading-relaxed">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Result 1: Invalid Credential */}
        {!isLoading && !error && verification && (verification.status === "Invalid" || !verification.isValid && verification.status !== "Revoked" && verification.status !== "Suspended") && (
          <div className="bg-white rounded-3xl border border-rose-200 shadow-2xs overflow-hidden">
            <div className="bg-rose-50 border-b border-rose-200 p-6 flex flex-col items-center text-center space-y-3">
              <div className="p-3 rounded-2xl bg-rose-100 text-rose-700">
                <ShieldX className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-rose-800 bg-rose-200/60 px-2 py-0.5 rounded-md">
                  Verification Failed
                </span>
                <h2 className="text-lg font-bold text-rose-950">Invalid Credential</h2>
                <p className="text-xs text-rose-800/90 max-w-sm leading-relaxed">
                  The identifier <span className="font-mono font-semibold">{credentialId}</span> does not match any official, active credential in the MatchGuard registry.
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-4 text-xs text-ink-700">
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-[11px] leading-relaxed space-y-1">
                <span className="font-bold text-ink-900 block">Buyer Security Advisory</span>
                <p>
                  MatchGuard generates unique, cryptographic credential identifiers for all authorized artisans. Never accept claims of identity verification without an authentic active registry status.
                </p>
              </div>

              <div className="pt-2 flex justify-center">
                <Link
                  href="/"
                  className="px-5 py-2.5 rounded-xl bg-jade-800 hover:bg-jade-900 text-white font-semibold text-xs shadow-2xs transition-colors"
                >
                  Explore Verified Artisan Stores
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Result 2: Revoked Credential */}
        {!isLoading && !error && verification && verification.status === "Revoked" && (
          <div className="bg-white rounded-3xl border border-rose-300 shadow-2xs overflow-hidden">
            <div className="bg-gradient-to-r from-rose-900 to-rose-950 p-6 text-white text-center flex flex-col items-center space-y-3">
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs text-rose-200 border border-white/15">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-rose-200 bg-white/15 px-2.5 py-0.5 rounded-md">
                  Registry Status
                </span>
                <h2 className="text-lg font-bold">Credential Revoked</h2>
                <p className="text-xs text-rose-200/90 leading-relaxed font-mono">
                  {verification.publicCredentialId}
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>Administrative Revocation Recorded</span>
                </div>
                <p className="leading-relaxed">
                  This identity credential was officially revoked on{" "}
                  <span className="font-medium">
                    {verification.revokedAtUtc ? new Date(verification.revokedAtUtc).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "Recorded date"}
                  </span>.
                </p>
                {verification.revocationReason && (
                  <p className="text-[11px] text-rose-800 pt-1 italic">
                    Reason: &quot;{verification.revocationReason}&quot;
                  </p>
                )}
              </div>

              {/* Scope Box */}
              <div className="p-3.5 rounded-2xl bg-ivory-100 border border-ivory-300 text-[11px] text-ink-600 leading-relaxed space-y-1">
                <span className="font-bold text-ink-900 block">Verification Scope Notice</span>
                <p>{verification.verificationScope}</p>
              </div>
            </div>
          </div>
        )}

        {/* Result 3: Suspended Credential */}
        {!isLoading && !error && verification && verification.status === "Suspended" && (
          <div className="bg-white rounded-3xl border border-amber-300 shadow-2xs overflow-hidden">
            <div className="bg-gradient-to-r from-amber-700 to-amber-900 p-6 text-white text-center flex flex-col items-center space-y-3">
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs text-amber-200 border border-white/15">
                <Clock className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-200 bg-white/15 px-2.5 py-0.5 rounded-md">
                  Registry Status
                </span>
                <h2 className="text-lg font-bold">Credential Suspended</h2>
                <p className="text-xs text-amber-200/90 leading-relaxed font-mono">
                  {verification.publicCredentialId}
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs leading-relaxed">
                The seller account associated with this credential is currently suspended. Credential verification rights are temporarily inactive.
              </div>
            </div>
          </div>
        )}

        {/* Result 4: Active Valid Credential */}
        {!isLoading && !error && verification && verification.isValid && verification.status === "Active" && (
          <div className="bg-white rounded-3xl border border-jade-200/90 shadow-2xs overflow-hidden">
            {/* Trust Header */}
            <div className="bg-gradient-to-r from-jade-800 to-jade-950 p-6 sm:p-7 text-white text-center flex flex-col items-center space-y-3">
              <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-xs text-emerald-300 border border-white/15">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-200 bg-emerald-500/25 px-2.5 py-0.5 rounded-md border border-emerald-400/30">
                  Official Registry Verified
                </span>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Identity-Verified Seller
                </h2>
                <p className="text-xs text-jade-200/90 leading-relaxed">
                  Verified by MatchGuard Central Registry
                </p>
              </div>
            </div>

            {/* Details Section */}
            <div className="p-5 sm:p-6 space-y-5">
              {/* Verified Entity Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-1">
                  <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider block">
                    Credential Identifier
                  </span>
                  <span className="font-mono text-xs font-bold text-ink-900 tracking-wider">
                    {verification.publicCredentialId}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-1">
                  <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider block">
                    Credential Status
                  </span>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-800">
                      Active &amp; In Good Standing
                    </span>
                  </div>
                </div>

                {verification.sellerDisplayName && (
                  <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-1">
                    <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider block">
                      Verified Seller Name
                    </span>
                    <div className="flex items-center gap-1.5 text-ink-900 text-xs font-semibold">
                      <User className="w-3.5 h-3.5 text-jade-700" />
                      <span>{verification.sellerDisplayName}</span>
                    </div>
                  </div>
                )}

                {verification.storeName && (
                  <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-1">
                    <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider block">
                      Registered Store Name
                    </span>
                    <div className="flex items-center gap-1.5 text-ink-900 text-xs font-semibold">
                      <Store className="w-3.5 h-3.5 text-jade-700" />
                      <span>{verification.storeName}</span>
                    </div>
                  </div>
                )}

                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-1 sm:col-span-2">
                  <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider block">
                    Issue Timestamp (UTC)
                  </span>
                  <div className="flex items-center gap-1.5 text-ink-700 text-xs font-mono">
                    <Calendar className="w-3.5 h-3.5 text-jade-700" />
                    <span>
                      {verification.issuedAtUtc
                        ? new Date(verification.issuedAtUtc).toISOString().replace("T", " ").slice(0, 19) + " UTC"
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Official Portable Badge Embed Preview */}
              <div className="p-4 rounded-2xl border border-jade-100 bg-jade-50/50 space-y-2">
                <span className="text-[11px] font-bold text-jade-950 uppercase tracking-wider block">
                  Official Verification Badge
                </span>
                <div className="flex items-center justify-start p-3 bg-white rounded-xl border border-stone-200 shadow-2xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={badgeSvgUrl}
                    alt="MatchGuard Identity Verified Badge"
                    width={220}
                    height={54}
                    className="h-10 w-auto"
                  />
                </div>
              </div>

              {/* Mandatory Scope Disclaimer (Rule T-01) */}
              <div className="p-4 rounded-2xl bg-ivory-100 border border-ivory-300 text-xs space-y-1.5 text-ink-700">
                <div className="flex items-center gap-1.5 font-bold text-ink-900">
                  <Info className="w-4 h-4 text-jade-700 shrink-0" />
                  <span>Verification Scope &amp; Limitations</span>
                </div>
                <p className="text-[11px] leading-relaxed text-ink-600">
                  {verification.verificationScope}
                </p>
              </div>

              {/* Anti-Tamper Advisory */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-[11px] text-ink-500 leading-relaxed text-center">
                This verification result is dynamically generated directly by the official MatchGuard registry server. Static screenshots or offline badges do not constitute proof of identity.
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileViewportContainer>
  );
}
