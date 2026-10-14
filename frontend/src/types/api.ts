/**
 * Language-agnostic TypeScript DTOs matching ASP.NET Core backend contracts.
 * Can be translated 1:1 into Dart models for the future Flutter application.
 */

export interface HealthResponse {
  status: string;
  timestampUtc: string;
  version: string;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
}

export interface UserDto {
  id: string;
  displayName: string;
  email: string;
  role: "Buyer" | "Admin" | string;
  accountStatus: "Active" | "Suspended" | "Closed" | string;
}

export interface AuthResponse {
  accessToken: string;
  expiresInSeconds: number;
  user: UserDto;
}

export interface RegisterRequest {
  displayName: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  id: string;
  displayName: string;
  email: string;
  role: string;
  accountStatus: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface StoreProfileDto {
  sellerUserId: string;
  storeName: string;
  slug: string;
  bio: string | null;
  contactPhone: string;
  cityOrTownship: string | null;
  logoStorageKey: string | null;
  verificationStatus: "Unverified" | "Verified" | "PendingReverification" | string;
  createdAtUtc: string;
}

export interface SellerTrustProfileDto {
  sellerUserId: string;
  verificationStatus: "Unverified" | "Verified" | "PendingReverification" | string;
  verifiedSinceUtc: string | null;
  completedOrdersCount: number;
  reviewCount: number;
  averageRating: number;
  resolvedComplaintsCount: number;
  disclaimer: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  parentCategoryId: string | null;
}

export interface ProductImageDto {
  id: string;
  storageKey: string;
  sortOrder: number;
  isPrimary?: boolean;
  url?: string;
  originalFileName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
}

export interface CreateProductRequest {
  categoryId: string;
  title: string;
  description: string;
  priceAmount: number;
  condition: string;
  currencyCode?: string;
}

export interface UpdateProductRequest {
  categoryId: string;
  title: string;
  description: string;
  priceAmount: number;
  condition: string;
}

export interface ReorderProductImagesRequest {
  imageIds: string[];
}

export interface ProductDto {
  id: string;
  sellerUserId: string;
  sellerProfileId: string;
  storeName: string;
  categoryId: string;
  categoryName: string;
  title: string;
  description: string;
  priceAmount: number;
  currencyCode: string;
  condition: string;
  status: string;
  createdAtUtc: string;
  images: ProductImageDto[];
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface ProductSearchQuery {
  keyword?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
}

export type OrderStatus =
  | "Placed"
  | "Accepted"
  | "Shipped"
  | "Completed"
  | "Cancelled"
  | "Disputed"
  | string;

export interface CreateOrderRequest {
  productId: string;
  quantity: number;
  buyerContactPhone: string;
  deliveryAddress: string;
  deliveryCityOrTownship: string;
  deliveryNotes?: string | null;
}

export interface OrderItemDto {
  id: string;
  productId: string | null;
  productTitle: string;
  unitPrice: number;
  quantity: number;
  condition: string;
  primaryImageUrl?: string | null;
}

export interface OrderStatusHistoryDto {
  id: string;
  actorUserId: string;
  previousStatus: string;
  newStatus: string;
  reason: string | null;
  createdAtUtc: string;
}

export interface OrderDto {
  id: string;
  buyerUserId: string;
  sellerUserId: string;
  sellerProfileId: string;
  status: OrderStatus;
  subtotalAmount: number;
  currencyCode: string;
  buyerContactPhone: string;
  deliveryAddress: string;
  deliveryCityOrTownship: string;
  deliveryNotes: string | null;
  courierTrackingReference: string | null;
  shippedAtUtc: string | null;
  completedAtUtc: string | null;
  createdAtUtc: string;
  items: OrderItemDto[];
  history: OrderStatusHistoryDto[];
}

export interface ShipOrderRequest {
  courierTrackingReference?: string | null;
}

export interface CancelOrderRequest {
  reason: string;
}

export interface CreateReviewRequest {
  rating: number;
  comment: string;
}

export interface ReviewDto {
  id: string;
  orderId: string;
  reviewerUserId: string;
  sellerUserId: string;
  rating: number;
  comment: string;
  createdAtUtc: string;
}

export interface FileComplaintRequest {
  description: string;
}

export interface ComplaintDto {
  id: string;
  reporterUserId: string;
  orderId: string | null;
  sellerUserId: string | null;
  status: string;
  description: string;
  resolutionCode: string | null;
  resolutionSummary: string | null;
  createdAtUtc: string;
  resolvedAtUtc: string | null;
}

export interface VerificationEvidenceDto {
  id: string;
  evidenceType: string;
  fileSizeBytes: number;
  mimeType: string;
  sha256Checksum: string;
  uploadedAtUtc: string;
  reviewStatus: string;
}

export interface SellerApplicationDto {
  id: string;
  userId: string;
  proposedStoreName: string;
  businessType: string;
  contactPhone: string;
  status: "Draft" | "Submitted" | "UnderReview" | "Approved" | "Rejected" | "MoreInformationRequired" | string;
  submittedAtUtc: string;
  reviewedAtUtc: string | null;
  decisionReason: string | null;
  evidence: VerificationEvidenceDto[];
}

export interface AdminDecisionRequest {
  decision: "Approved" | "Rejected" | "MoreInformationRequired";
  reason: string;
}

