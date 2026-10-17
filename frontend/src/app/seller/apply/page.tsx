"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  FileCheck,
  Upload,
  AlertCircle,
  CheckCircle2,
  Clock,
  Store,
  Phone,
  Building2,
  FileText,
  Loader2,
  ArrowRight,
  Info,
  ChevronRight,
  XCircle,
  Plus,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { sellerApplicationApi } from "@/lib/seller-api";
import { SellerApplicationDto, VerificationEvidenceDto } from "@/types/api";
import { MobileViewportContainer } from "@/components/layout/MobileViewportContainer";
import { AppHeader } from "@/components/layout/AppHeader";

const BUSINESS_TYPES = [
  { value: "IndividualCrafter", label: "Individual Crafter / Artisan" },
  { value: "ArtisanWorkshop", label: "Traditional Workshop / Guild" },
  { value: "RetailShop", label: "Craft & Heritage Retail Store" },
  { value: "TraditionalManufacturer", label: "Heritage Manufacturer" },
];

const EVIDENCE_TYPES = [
  { value: "NationalIdFront", label: "National Registration Card (NRC Front)" },
  { value: "NationalIdBack", label: "National Registration Card (NRC Back)" },
  { value: "BusinessLicense", label: "City Municipal Trade License" },
  { value: "UtilityBill", label: "Workshop Utility Bill / Proof of Address" },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getEvidenceLabel(type: string): string {
  const match = EVIDENCE_TYPES.find((t) => t.value.toLowerCase() === type.toLowerCase());
  return match ? match.label : type;
}

export default function SellerApplicationPage() {
  const router = useRouter();
  const { user, store, isAuthenticated, isLoading: authLoading, isAdmin, isSeller } = useAuth();

  const [application, setApplication] = useState<SellerApplicationDto | null>(null);
  const [isFetchingApp, setIsFetchingApp] = useState<boolean>(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Application Form State
  const [proposedStoreName, setProposedStoreName] = useState("");
  const [businessType, setBusinessType] = useState("IndividualCrafter");
  const [contactPhone, setContactPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formFeedback, setFormFeedback] = useState<string | null>(null);

  // Evidence Upload State (Initial & Supplementary)
  const [evidenceType, setEvidenceType] = useState("NationalIdFront");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [evidenceFeedback, setEvidenceFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchApplication = useCallback(async () => {
    setIsFetchingApp(true);
    setPageError(null);
    try {
      const app = await sellerApplicationApi.getMyApplication();
      setApplication(app);
    } catch (err: unknown) {
      setPageError(err instanceof Error ? err.message : "Failed to load seller application.");
    } finally {
      setIsFetchingApp(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push("/auth/login?returnUrl=/seller/apply");
      } else {
        fetchApplication();
      }
    }
  }, [authLoading, isAuthenticated, router, fetchApplication]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
      return;
    }

    // Validate size (< 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setEvidenceFeedback("File size must not exceed 5MB.");
      return;
    }

    // Validate type (JPEG, PNG, WebP)
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setEvidenceFeedback("Only JPEG, PNG, or WebP images are permitted (PDFs/SVGs disallowed).");
      return;
    }

    setEvidenceFeedback(null);
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setFilePreviewUrl(objectUrl);
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposedStoreName.trim()) {
      setFormFeedback("Proposed store name is required.");
      return;
    }
    if (!contactPhone.trim()) {
      setFormFeedback("Contact phone number is required.");
      return;
    }

    setIsSubmitting(true);
    setFormFeedback(null);

    try {
      // 1. Submit application metadata
      const newApp = await sellerApplicationApi.submitApplication({
        proposedStoreName: proposedStoreName.trim(),
        businessType,
        contactPhone: contactPhone.trim(),
      });

      // 2. If evidence file was selected, upload it immediately
      if (selectedFile) {
        try {
          await sellerApplicationApi.uploadEvidence(evidenceType, selectedFile);
        } catch (uploadErr: unknown) {
          console.warn("Evidence upload note:", uploadErr);
        }
      }

      // Reset file input & refresh application data
      setSelectedFile(null);
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
      await fetchApplication();
    } catch (err: unknown) {
      setFormFeedback(
        err instanceof Error ? err.message : "Failed to submit seller application."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadSupplementaryEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setEvidenceFeedback("Please select an evidence document file to upload.");
      return;
    }

    setIsUploadingEvidence(true);
    setEvidenceFeedback(null);

    try {
      await sellerApplicationApi.uploadEvidence(evidenceType, selectedFile);
      setSelectedFile(null);
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchApplication();
    } catch (err: unknown) {
      setEvidenceFeedback(
        err instanceof Error ? err.message : "Failed to upload verification evidence."
      );
    } finally {
      setIsUploadingEvidence(false);
    }
  };

  if (authLoading || isFetchingApp) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-20 text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-jade-700 mx-auto" />
          <p className="text-xs text-ink-500">Checking seller verification status...</p>
        </div>
      </MobileViewportContainer>
    );
  }

  // Admin persona check
  if (isAdmin) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-12 max-w-md mx-auto text-center space-y-4 px-4">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-800 flex items-center justify-center mx-auto border border-stone-300 shadow-2xs">
            <Shield className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-bold text-ink-900">Administrator Account</h1>
            <p className="text-xs text-ink-600 leading-relaxed">
              You are logged in as a platform administrator. Administrators inspect and verify seller applications rather than holding seller store profiles.
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 text-white font-semibold text-xs hover:bg-black transition-colors shadow-2xs"
          >
            <span>Open Admin Verification Console</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </MobileViewportContainer>
    );
  }

  // Already an approved seller
  if (isSeller) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-12 max-w-md mx-auto text-center space-y-4 px-4">
          <div className="w-12 h-12 rounded-2xl bg-jade-50 text-jade-700 flex items-center justify-center mx-auto border border-jade-200 shadow-2xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-bold text-ink-900">
              Verified Artisan Seller
            </h1>
            <p className="text-xs text-jade-800 font-medium">
              {store?.storeName}
            </p>
            <p className="text-xs text-ink-600 leading-relaxed pt-1">
              Your account has already been verified and holds an active artisan storefront. You can manage your products, photography, and incoming orders.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <Link
              href="/seller/products"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-jade-800 text-white font-semibold text-xs hover:bg-jade-900 transition-colors shadow-2xs"
            >
              <Store className="w-4 h-4" />
              <span>Manage Store Listings</span>
            </Link>
            <Link
              href={`/sellers/${user?.id}`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-ink-700 transition-colors shadow-2xs"
            >
              <span>View Public Storefront</span>
            </Link>
          </div>
        </div>
      </MobileViewportContainer>
    );
  }

  return (
    <MobileViewportContainer
      header={<AppHeader />}
      footer={
        <div className="px-4 py-3 text-center text-xs text-ink-500 font-medium">
          <span>TrustedMarketplace Myanmar · Secure Human-Verified Artisan Onboarding</span>
        </div>
      }
    >
      <div className="max-w-2xl mx-auto w-full py-4 sm:py-6 space-y-6">
        {/* Page Title & Breadcrumb */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[11px] font-medium text-ink-500">
            <Link href="/" className="hover:text-jade-800">Home</Link>
            <ChevronRight className="w-3 h-3 text-ink-400" />
            <span className="text-ink-800 font-semibold">Seller Verification</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-900">
            Artisan Seller Verification Application
          </h1>
          <p className="text-xs text-ink-600 leading-relaxed">
            Apply for verified seller status to showcase and sell authentic handcrafted goods directly to buyers.
          </p>
        </div>

        {/* Global Page Error */}
        {pageError && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="flex-1">{pageError}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CASE A: EXISTING APPLICATION EXISTS                                       */}
        {/* ========================================================================= */}
        {application ? (
          <div className="space-y-5">
            {/* Status Banner */}
            <div
              className={`p-4 rounded-3xl border shadow-2xs space-y-2 ${
                application.status === "Approved"
                  ? "bg-jade-50/80 border-jade-200 text-jade-950"
                  : application.status === "Rejected"
                  ? "bg-red-50/80 border-red-200 text-red-950"
                  : application.status === "MoreInformationRequired"
                  ? "bg-amber-50/80 border-amber-200 text-amber-950"
                  : "bg-blue-50/80 border-blue-200 text-blue-950"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {application.status === "Approved" ? (
                    <ShieldCheck className="w-5 h-5 text-jade-700 shrink-0" />
                  ) : application.status === "Rejected" ? (
                    <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                  ) : application.status === "MoreInformationRequired" ? (
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  ) : (
                    <Clock className="w-5 h-5 text-blue-600 shrink-0" />
                  )}
                  <span className="font-bold text-sm">
                    {application.status === "Approved"
                      ? "Application Approved"
                      : application.status === "Rejected"
                      ? "Application Declined"
                      : application.status === "MoreInformationRequired"
                      ? "Additional Information Required"
                      : "Verification Under Administrative Review"}
                  </span>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-white/80 border border-current shadow-2xs">
                  {application.status}
                </span>
              </div>

              <p className="text-xs leading-relaxed text-ink-700">
                {application.status === "Approved"
                  ? "Congratulations! Your identity and store credentials have been verified by platform administrators. You can now publish authentic listings."
                  : application.status === "Rejected"
                  ? "Your application was reviewed and could not be approved at this time. Please review the administrator notes below."
                  : application.status === "MoreInformationRequired"
                  ? "The administration team has reviewed your submission and requested additional documentation before approving your store."
                  : "Your application has been received and queued for administrative review. Private evidence documents (NRC cards and licenses) are isolated securely and protected by audit logging."}
              </p>

              {application.decisionReason && (
                <div className="mt-2 p-2.5 rounded-xl bg-white/90 border border-current/20 text-xs space-y-0.5">
                  <span className="font-semibold block text-[11px] text-ink-500 uppercase tracking-wider">
                    Administrative Note / Rationale:
                  </span>
                  <p className="text-ink-800 italic">“{application.decisionReason}”</p>
                </div>
              )}
            </div>

            {/* Application Overview Card */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white border border-stone-200/90 shadow-2xs space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500 border-b border-stone-100 pb-2">
                Application Record
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-ink-400 block font-semibold uppercase">Proposed Store Name</span>
                  <span className="font-bold text-ink-900">{application.proposedStoreName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-ink-400 block font-semibold uppercase">Business Classification</span>
                  <span className="font-medium text-ink-800">{application.businessType}</span>
                </div>
                <div>
                  <span className="text-[10px] text-ink-400 block font-semibold uppercase">Contact Phone</span>
                  <span className="font-mono text-ink-800">{application.contactPhone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-ink-400 block font-semibold uppercase">Submitted On</span>
                  <span className="text-ink-800 font-mono">
                    {new Date(application.submittedAtUtc).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Attached Verification Documents */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white border border-stone-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">
                  Uploaded Verification Evidence ({application.evidence.length})
                </h2>
                <span className="text-[10px] font-semibold text-jade-700 bg-jade-50 px-2 py-0.5 rounded-md border border-jade-200">
                  Isolated in Private Vault
                </span>
              </div>

              {application.evidence.length === 0 ? (
                <div className="py-6 text-center text-xs text-ink-400 border border-dashed border-stone-200 rounded-2xl">
                  <span>No verification documents attached yet. Please upload NRC front/back below.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {application.evidence.map((ev: VerificationEvidenceDto) => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-2xl bg-stone-50/70 border border-stone-200/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-jade-700 shrink-0 shadow-2xs">
                          <FileCheck className="w-4 h-4" />
                        </div>
                        <div className="truncate min-w-0">
                          <span className="font-semibold text-ink-900 block truncate">
                            {getEvidenceLabel(ev.evidenceType)}
                          </span>
                          <span className="text-[10px] text-ink-400 font-mono">
                            {formatBytes(ev.fileSizeBytes)} · SHA-256: {ev.sha256Checksum.slice(0, 10)}...
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            ev.reviewStatus === "Approved"
                              ? "bg-jade-100 text-jade-800"
                              : ev.reviewStatus === "Rejected"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {ev.reviewStatus}
                        </span>
                        <span className="block text-[10px] text-ink-400 mt-0.5">
                          {new Date(ev.uploadedAtUtc).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Supplementary Evidence Upload (if under review or more info required) */}
            {(application.status === "Submitted" ||
              application.status === "UnderReview" ||
              application.status === "Pending" ||
              application.status === "MoreInformationRequired") && (
              <div className="p-4 sm:p-5 rounded-3xl bg-white border border-stone-200/90 shadow-2xs space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-800 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-jade-700" />
                    <span>Upload Additional Evidence Document</span>
                  </h3>
                  <p className="text-xs text-ink-500">
                    Provide supplementary NRC or business licensing documents for administrative evaluation.
                  </p>
                </div>

                {evidenceFeedback && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{evidenceFeedback}</span>
                  </div>
                )}

                <form onSubmit={handleUploadSupplementaryEvidence} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-700">Document Type</label>
                    <select
                      value={evidenceType}
                      onChange={(e) => setEvidenceType(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200/90 bg-white text-ink-900 focus:outline-none focus:border-jade-600 shadow-2xs cursor-pointer"
                    >
                      {EVIDENCE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-700">Document Photo (JPEG, PNG, WebP)</label>
                    <div className="relative border-2 border-dashed border-stone-200 hover:border-jade-600 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-stone-50/50">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      {selectedFile ? (
                        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-jade-800">
                          <CheckCircle2 className="w-4 h-4 text-jade-600" />
                          <span>{selectedFile.name} ({formatBytes(selectedFile.size)})</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Upload className="w-5 h-5 text-ink-400 mx-auto" />
                          <p className="text-xs text-ink-600 font-medium">Click or drag document image to select</p>
                          <p className="text-[10px] text-ink-400">Maximum file size: 5MB</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {filePreviewUrl && (
                    <div className="p-2 border border-stone-200 rounded-xl bg-stone-50 flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={filePreviewUrl}
                        alt="Preview"
                        className="w-16 h-12 object-cover rounded-lg border border-stone-200"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-ink-800 block">Selected File Preview</span>
                        <span className="text-[10px] text-ink-500">Will be uploaded to private vault</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isUploadingEvidence || !selectedFile}
                    className="w-full py-2.5 px-4 rounded-xl bg-jade-800 hover:bg-jade-900 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                  >
                    {isUploadingEvidence ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading Evidence...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Document</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* CASE B: NEW APPLICATION FORM (FIRST-TIME APPLICATION)                     */
          /* ========================================================================= */
          <div className="space-y-5">
            {/* Informational Hero Card */}
            <div className="p-4 sm:p-5 rounded-3xl bg-jade-50/70 border border-jade-200/80 shadow-2xs space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-2xl bg-jade-800 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <ShieldCheck className="w-5 h-5 text-jade-100" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xs font-bold text-ink-900 uppercase tracking-wider">
                    Human-Verified Myanmar Heritage Marketplace
                  </h2>
                  <p className="text-xs text-ink-700 leading-relaxed">
                    TrustedMarketplace requires all sellers to undergo human administrative identity verification before publishing products. This preserves buyer confidence and protects authentic artisans.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/90 border border-jade-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-jade-900">
                  <Info className="w-3.5 h-3.5 text-jade-700 shrink-0" />
                  <span>Private Evidence Isolation Policy (SEC-12)</span>
                </div>
                <p className="text-[11px] text-ink-600 leading-relaxed">
                  Your National Registration Card (NRC) and business documents are encrypted and saved outside the public web root. Documents are strictly inaccessible to buyers and can only be inspected by authorized administrators with immutable audit logging.
                </p>
              </div>
            </div>

            {/* Error Alert */}
            {formFeedback && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 shadow-2xs animate-fade-in">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="flex-1">{formFeedback}</span>
              </div>
            )}

            {/* Application Creation Form */}
            <form
              onSubmit={handleSubmitApplication}
              className="p-4 sm:p-6 rounded-3xl bg-white border border-stone-200/90 shadow-2xs space-y-4"
            >
              <div className="space-y-1 border-b border-stone-100 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink-900">
                  Seller Store Registration Form
                </h2>
                <p className="text-[11px] text-ink-500">
                  Please provide accurate business details as they appear on official identity documents.
                </p>
              </div>

              {/* Proposed Store Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700 block">
                  Proposed Store Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={proposedStoreName}
                    onChange={(e) => setProposedStoreName(e.target.value)}
                    placeholder="e.g. Mandalay Marionettes & Crafts"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200/90 bg-white text-ink-900 focus:outline-none focus:border-jade-600 shadow-2xs"
                  />
                  <Store className="w-4 h-4 text-ink-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Business Classification */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700 block">
                  Business Classification <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200/90 bg-white text-ink-900 focus:outline-none focus:border-jade-600 shadow-2xs cursor-pointer appearance-none"
                  >
                    {BUSINESS_TYPES.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  <Building2 className="w-4 h-4 text-ink-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Contact Phone */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700 block">
                  Primary Contact Phone <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="e.g. 09798881234"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200/90 bg-white text-ink-900 focus:outline-none focus:border-jade-600 shadow-2xs font-mono"
                  />
                  <Phone className="w-4 h-4 text-ink-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Identity Evidence Document Section */}
              <div className="pt-2 border-t border-stone-100 space-y-3">
                <div className="space-y-0.5">
                  <label className="text-xs font-bold text-ink-900 uppercase tracking-wider block">
                    Identity Verification Document
                  </label>
                  <p className="text-[11px] text-ink-500">
                    Upload an authentic National Registration Card (NRC) or business registration document photo.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink-700 block">Document Type</label>
                  <select
                    value={evidenceType}
                    onChange={(e) => setEvidenceType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200/90 bg-white text-ink-900 focus:outline-none focus:border-jade-600 shadow-2xs cursor-pointer"
                  >
                    {EVIDENCE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative border-2 border-dashed border-stone-200 hover:border-jade-600 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-stone-50/50">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-xs font-semibold text-jade-800">
                      <CheckCircle2 className="w-4 h-4 text-jade-600" />
                      <span>{selectedFile.name} ({formatBytes(selectedFile.size)})</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-5 h-5 text-ink-400 mx-auto" />
                      <p className="text-xs text-ink-600 font-medium">Click or drag document photo to attach</p>
                      <p className="text-[10px] text-ink-400">Formats: JPEG, PNG, WebP · Max: 5MB</p>
                    </div>
                  )}
                </div>

                {filePreviewUrl && (
                  <div className="p-2 border border-stone-200 rounded-xl bg-stone-50 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={filePreviewUrl}
                      alt="Preview"
                      className="w-16 h-12 object-cover rounded-lg border border-stone-200"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-ink-800 block">Attached Document Preview</span>
                      <span className="text-[10px] text-ink-500">Ready for secure private upload</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl bg-jade-800 hover:bg-jade-900 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Application &amp; Encrypting Evidence...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Submit Seller Verification Application</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </MobileViewportContainer>
  );
}
