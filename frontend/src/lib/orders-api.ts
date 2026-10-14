import { apiClient } from "@/lib/api-client";
import {
  CancelOrderRequest,
  ComplaintDto,
  CreateOrderRequest,
  CreateReviewRequest,
  FileComplaintRequest,
  OrderDto,
  ReviewDto,
  ShipOrderRequest,
} from "@/types/api";

export const ordersApi = {
  /**
   * Places a new non-custodial order on a published product listing.
   */
  async createOrder(request: CreateOrderRequest): Promise<OrderDto> {
    return apiClient.post<OrderDto>("/api/v1/orders", request);
  },

  /**
   * Retrieves order details by ID with items and status history.
   * IDOR protected by backend.
   */
  async getOrderById(id: string): Promise<OrderDto> {
    return apiClient.get<OrderDto>(`/api/v1/orders/${id}`);
  },

  /**
   * Retrieves all orders placed by the current authenticated buyer.
   */
  async getBuyerOrders(): Promise<OrderDto[]> {
    return apiClient.get<OrderDto[]>("/api/v1/buyer/orders");
  },

  /**
   * Retrieves all incoming orders placed for the current authenticated seller's store.
   */
  async getSellerOrders(): Promise<OrderDto[]> {
    return apiClient.get<OrderDto[]>("/api/v1/seller/orders");
  },

  /**
   * Accepts a Placed order (Seller only).
   */
  async acceptOrder(id: string): Promise<OrderDto> {
    return apiClient.post<OrderDto>(`/api/v1/orders/${id}/accept`);
  },

  /**
   * Dispatches an Accepted order with optional courier tracking reference (Seller only).
   */
  async shipOrder(id: string, courierTrackingReference?: string): Promise<OrderDto> {
    const payload: ShipOrderRequest = { courierTrackingReference };
    return apiClient.post<OrderDto>(`/api/v1/orders/${id}/ship`, payload);
  },

  /**
   * Confirms delivery of a Shipped order, marking it Completed (Buyer only, SEC-07, SEC-08).
   */
  async confirmDelivery(id: string): Promise<OrderDto> {
    return apiClient.post<OrderDto>(`/api/v1/orders/${id}/confirm-delivery`);
  },

  /**
   * Cancels an order with a reason.
   * Buyer can cancel while Placed; seller can cancel before Shipped.
   */
  async cancelOrder(id: string, reason: string): Promise<OrderDto> {
    const payload: CancelOrderRequest = { reason };
    return apiClient.post<OrderDto>(`/api/v1/orders/${id}/cancel`, payload);
  },

  /**
   * Submits a transaction-linked review for a completed order (Buyer only, SEC-09, SEC-10, SEC-11).
   */
  async submitReview(orderId: string, rating: number, comment: string): Promise<ReviewDto> {
    const payload: CreateReviewRequest = { rating, comment };
    return apiClient.post<ReviewDto>(`/api/v1/orders/${orderId}/reviews`, payload);
  },

  /**
   * Files a dispute complaint against an order, automatically shifting status to Disputed.
   */
  async fileComplaint(orderId: string, description: string): Promise<ComplaintDto> {
    const payload: FileComplaintRequest = { description };
    return apiClient.post<ComplaintDto>(`/api/v1/orders/${orderId}/complaints`, payload);
  },
};
