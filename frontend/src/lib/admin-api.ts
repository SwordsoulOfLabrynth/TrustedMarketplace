import { apiClient } from "@/lib/api-client";
import { AdminDecisionRequest, SellerApplicationDto } from "@/types/api";

export interface GetApplicationsParams {
  page?: number;
  pageSize?: number;
  status?: string;
}

export const adminApi = {
  /**
   * Fetches paginated seller verification applications for administrative review.
   */
  async getSellerApplications(
    params?: GetApplicationsParams
  ): Promise<SellerApplicationDto[]> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.pageSize) searchParams.set("pageSize", params.pageSize.toString());
    if (params?.status) searchParams.set("status", params.status);

    const query = searchParams.toString();
    const endpoint = `/api/v1/admin/seller-applications${query ? `?${query}` : ""}`;
    return await apiClient.get<SellerApplicationDto[]>(endpoint);
  },

  /**
   * Fetches single seller application with full evidence metadata.
   */
  async getApplicationById(id: string): Promise<SellerApplicationDto> {
    return await apiClient.get<SellerApplicationDto>(
      `/api/v1/admin/seller-applications/${id}`
    );
  },

  /**
   * Submits administrative decision (Approved, Rejected, MoreInformationRequired).
   */
  async processDecision(
    id: string,
    request: AdminDecisionRequest
  ): Promise<SellerApplicationDto> {
    return await apiClient.post<SellerApplicationDto>(
      `/api/v1/admin/seller-applications/${id}/decision`,
      request
    );
  },
};
