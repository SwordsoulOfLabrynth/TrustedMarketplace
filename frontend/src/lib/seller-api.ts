import { apiClient, ApiException } from "@/lib/api-client";
import {
  CreateSellerApplicationRequest,
  PlatformPaymentMethodDto,
  SellerApplicationDto,
  SellerQuotaDto,
  SellerSubscriptionDto,
  StoreProfileDto,
  SubmitSubscriptionPaymentRequest,
  SubscriptionPlanDto,
  UpdateStoreProfileRequest,
  VerificationEvidenceDto,
  SellerCredentialStatusDto,
  SellerCredentialDto,
} from "@/types/api";

export const sellerApplicationApi = {
  /**
   * Retrieves the current user's seller verification application status.
   * Returns null if no application has been submitted yet (404).
   */
  async getMyApplication(): Promise<SellerApplicationDto | null> {
    try {
      return await apiClient.get<SellerApplicationDto>("/api/v1/seller-applications/me");
    } catch (err: unknown) {
      if (err instanceof ApiException && err.status === 404) {
        return null;
      }
      throw err;
    }
  },

  /**
   * Submits a new seller verification application.
   */
  async submitApplication(
    request: CreateSellerApplicationRequest
  ): Promise<SellerApplicationDto> {
    return await apiClient.post<SellerApplicationDto>(
      "/api/v1/seller-applications",
      request
    );
  },

  /**
   * Uploads verification evidence (NRC front/back, business license, utility bill).
   * Enforces server-side magic byte validation and stores outside public web root.
   */
  async uploadEvidence(
    evidenceType: string,
    file: File
  ): Promise<VerificationEvidenceDto> {
    const formData = new FormData();
    formData.append("evidenceType", evidenceType);
    formData.append("file", file);

    return await apiClient.post<VerificationEvidenceDto>(
      "/api/v1/seller-applications/me/evidence",
      formData
    );
  },
};

export const sellerStoreApi = {
  /**
   * Retrieves current authenticated seller's store profile.
   */
  async getMyStore(): Promise<StoreProfileDto> {
    return await apiClient.get<StoreProfileDto>("/api/v1/seller/store");
  },

  /**
   * Updates store profile details (StoreName, Bio, ContactPhone, CityOrTownship).
   * Note: Modifying StoreName triggers automatic PendingReverification (Rule SEC-04).
   */
  async updateMyStore(
    request: UpdateStoreProfileRequest
  ): Promise<StoreProfileDto> {
    return await apiClient.put<StoreProfileDto>("/api/v1/seller/store", request);
  },
};

export const sellerSubscriptionApi = {
  /**
   * Retrieves all subscription plans, fees, and quota limits. Publicly configured.
   */
  async getPlans(): Promise<SubscriptionPlanDto[]> {
    return await apiClient.get<SubscriptionPlanDto[]>("/api/v1/subscription-plans");
  },

  /**
   * Retrieves configured platform payment channels (KBZPay, WavePay) with QR codes.
   */
  async getPlatformPaymentMethods(): Promise<PlatformPaymentMethodDto[]> {
    return await apiClient.get<PlatformPaymentMethodDto[]>("/api/v1/platform/payment-methods");
  },

  /**
   * Retrieves seller's active quota and active product listings count.
   */
  async getMyQuota(): Promise<SellerQuotaDto> {
    return await apiClient.get<SellerQuotaDto>("/api/v1/seller/subscription");
  },

  /**
   * Retrieves seller's latest subscription record (active tier or pending verification).
   * Returns null if no subscription record exists yet (204 No Content).
   */
  async getMySubscriptionStatus(): Promise<SellerSubscriptionDto | null> {
    try {
      return await apiClient.get<SellerSubscriptionDto | null>("/api/v1/seller/subscription/status");
    } catch (err: unknown) {
      if (err instanceof ApiException && (err.status === 204 || err.status === 404)) {
        return null;
      }
      throw err;
    }
  },

  /**
   * Submits a subscription tier selection and payment transfer reference (KBZPay / WavePay).
   */
  async submitPayment(
    request: SubmitSubscriptionPaymentRequest
  ): Promise<SellerSubscriptionDto> {
    return await apiClient.post<SellerSubscriptionDto>(
      "/api/v1/seller/subscription/subscribe",
      request
    );
  },
};

export const sellerCredentialsApi = {
  /**
   * Retrieves current seller's credential status, active credential, and history.
   */
  async getMyStatus(): Promise<SellerCredentialStatusDto> {
    return await apiClient.get<SellerCredentialStatusDto>("/api/v1/seller/credentials/my");
  },

  /**
   * Generates certificate download URL for active credential.
   */
  getMyCertificateDownloadUrl(): string {
    return `${apiClient.getBaseUrl()}/api/v1/seller/credentials/my/certificate`;
  },

  /**
   * Generates certificate download URL for specific credential ID.
   */
  getCertificateDownloadUrl(id: string): string {
    return `${apiClient.getBaseUrl()}/api/v1/seller/credentials/${id}/certificate`;
  },

  /**
   * Gets public badge SVG URL.
   */
  getBadgeSvgUrl(publicId: string): string {
    return `${apiClient.getBaseUrl()}/api/v1/public/credentials/${publicId}/badge.svg`;
  },

  /**
   * Gets public badge PNG URL.
   */
  getBadgePngUrl(publicId: string): string {
    return `${apiClient.getBaseUrl()}/api/v1/public/credentials/${publicId}/badge.png`;
  },

  /**
   * Securely streams official PDF certificate for currently authenticated seller.
   */
  async downloadMyCertificate(): Promise<Blob> {
    return await apiClient.requestBlob("/api/v1/seller/credentials/my/certificate");
  },

  /**
   * Securely streams official PDF certificate by credential ID.
   */
  async downloadCertificate(id: string): Promise<Blob> {
    return await apiClient.requestBlob(`/api/v1/seller/credentials/${id}/certificate`);
  },

  /**
   * Downloads official portable badge (SVG or PNG) as a Blob.
   */
  async downloadBadge(publicId: string, format: "svg" | "png"): Promise<Blob> {
    return await apiClient.requestBlob(`/api/v1/public/credentials/${publicId}/badge.${format}?download=true`);
  },
};

