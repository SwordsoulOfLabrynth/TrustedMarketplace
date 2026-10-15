import { apiClient } from "@/lib/api-client";
import {
  AdminComplaintDecisionRequest,
  AdminDecisionRequest,
  AdminStoreReverificationRequest,
  ComplaintDto,
  OrderDto,
  ResolveDisputeRequest,
  SellerApplicationDto,
  SellerSubscriptionDto,
  StoreProfileDto,
  VerifySubscriptionPaymentRequest,
} from "@/types/api";

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

  /**
   * Fetches all complaints/disputes across the platform for administrative review.
   */
  async getComplaints(page = 1, pageSize = 50): Promise<ComplaintDto[]> {
    const params = new URLSearchParams();
    if (page) params.set("page", page.toString());
    if (pageSize) params.set("pageSize", pageSize.toString());
    const query = params.toString();
    return await apiClient.get<ComplaintDto[]>(
      `/api/v1/admin/complaints${query ? `?${query}` : ""}`
    );
  },

  /**
   * Fetches single complaint details by ID.
   */
  async getComplaintById(id: string): Promise<ComplaintDto> {
    return await apiClient.get<ComplaintDto>(`/api/v1/complaints/${id}`);
  },

  /**
   * Records administrative resolution decision on a complaint.
   */
  async processComplaintDecision(
    id: string,
    request: AdminComplaintDecisionRequest
  ): Promise<ComplaintDto> {
    return await apiClient.post<ComplaintDto>(
      `/api/v1/admin/complaints/${id}/decision`,
      request
    );
  },

  /**
   * Resolves a disputed order as Completed or Cancelled with audit trail.
   */
  async resolveOrderDispute(
    orderId: string,
    request: ResolveDisputeRequest
  ): Promise<OrderDto> {
    return await apiClient.post<OrderDto>(
      `/api/v1/admin/orders/${orderId}/resolve-dispute`,
      request
    );
  },

  /**
   * Fetches seller subscription records and payment submissions for administrative verification.
   */
  async getSubscriptions(status?: string): Promise<SellerSubscriptionDto[]> {
    const params = new URLSearchParams();
    if (status && status !== "All") params.set("status", status);
    const query = params.toString();
    return await apiClient.get<SellerSubscriptionDto[]>(
      `/api/v1/admin/subscriptions${query ? `?${query}` : ""}`
    );
  },

  /**
   * Approves or rejects a pending subscription payment submission.
   * Approving updates the seller's active plan and listing capacity; rejecting logs an audit reason.
   */
  async verifySubscriptionPayment(
    id: string,
    request: VerifySubscriptionPaymentRequest
  ): Promise<SellerSubscriptionDto> {
    return await apiClient.post<SellerSubscriptionDto>(
      `/api/v1/admin/subscriptions/${id}/verify`,
      request
    );
  },

  /**
   * Fetches seller store profiles for administrative re-verification review.
   */
  async getSellerStores(status?: string): Promise<StoreProfileDto[]> {
    const params = new URLSearchParams();
    if (status && status !== "All") params.set("status", status);
    const query = params.toString();
    return await apiClient.get<StoreProfileDto[]>(
      `/api/v1/admin/seller-stores${query ? `?${query}` : ""}`
    );
  },

  /**
   * Approves or rejects a store profile change pending re-verification.
   */
  async processStoreReverificationDecision(
    sellerUserId: string,
    request: AdminStoreReverificationRequest
  ): Promise<StoreProfileDto> {
    return await apiClient.post<StoreProfileDto>(
      `/api/v1/admin/seller-stores/${sellerUserId}/decision`,
      request
    );
  },
};

