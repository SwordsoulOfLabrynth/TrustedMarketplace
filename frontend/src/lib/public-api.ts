import { apiClient } from "@/lib/api-client";
import { PublicCredentialVerificationDto } from "@/types/api";

export const publicCredentialsApi = {
  /**
   * Public validation lookup for seller credentials.
   */
  async verifyCredential(credentialId: string): Promise<PublicCredentialVerificationDto> {
    return await apiClient.get<PublicCredentialVerificationDto>(
      `/api/v1/public/credentials/${encodeURIComponent(credentialId)}`
    );
  },

  getBadgeSvgUrl(credentialId: string): string {
    return `${apiClient.getBaseUrl()}/api/v1/public/credentials/${encodeURIComponent(credentialId)}/badge.svg`;
  },

  getBadgePngUrl(credentialId: string): string {
    return `${apiClient.getBaseUrl()}/api/v1/public/credentials/${encodeURIComponent(credentialId)}/badge.png`;
  },
};
