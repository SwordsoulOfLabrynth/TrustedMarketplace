import { apiClient } from "@/lib/api-client";
import {
  CategoryDto,
  PagedResult,
  ProductDto,
  ProductSearchQuery,
  ReviewDto,
  SellerTrustProfileDto,
  StoreProfileDto,
} from "@/types/api";

function buildQueryString(params: Record<string, string | number | undefined | null>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  const str = searchParams.toString();
  return str ? `?${str}` : "";
}

export const catalogApi = {
  /**
   * Retrieves all active product categories.
   */
  async getCategories(): Promise<CategoryDto[]> {
    return apiClient.get<CategoryDto[]>("/api/v1/categories");
  },

  /**
   * Searches published product listings with keyword, category, price, and pagination filters.
   */
  async searchProducts(query: ProductSearchQuery = {}): Promise<PagedResult<ProductDto>> {
    const qs = buildQueryString({
      keyword: query.keyword,
      categoryId: query.categoryId,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      page: query.page,
      pageSize: query.pageSize,
    });
    return apiClient.get<PagedResult<ProductDto>>(`/api/v1/products${qs}`);
  },

  /**
   * Retrieves a single published product listing by ID.
   */
  async getProductById(id: string): Promise<ProductDto> {
    return apiClient.get<ProductDto>(`/api/v1/products/${id}`);
  },

  /**
   * Retrieves a seller's public store profile by their user ID.
   */
  async getSellerStore(sellerId: string): Promise<StoreProfileDto> {
    return apiClient.get<StoreProfileDto>(`/api/v1/sellers/${sellerId}/store`);
  },

  /**
   * Retrieves a seller's verified trust profile and explainable metrics.
   */
  async getSellerTrustProfile(sellerId: string): Promise<SellerTrustProfileDto> {
    return apiClient.get<SellerTrustProfileDto>(`/api/v1/sellers/${sellerId}/trust-profile`);
  },

  /**
   * Retrieves public paginated reviews for a seller.
   */
  async getSellerReviews(
    sellerId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PagedResult<ReviewDto>> {
    const qs = buildQueryString({ page, pageSize });
    return apiClient.get<PagedResult<ReviewDto>>(`/api/v1/sellers/${sellerId}/reviews${qs}`);
  },
};

/**
 * Resolves a full, public HTTP image URL for a product image from the backend media pipeline.
 */
export function getProductImageUrl(
  image?: { url?: string; storageKey?: string; id?: string } | string | null,
  productId?: string
): string | null {
  if (!image) return null;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:5248";
  if (typeof image === "string") {
    const trimmed = image.trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
    return trimmed.startsWith("http")
      ? trimmed
      : `${baseUrl}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
  }
  if (image.url && typeof image.url === "string" && image.url.trim().length > 0) {
    const trimmedUrl = image.url.trim();
    if (trimmedUrl === "null" || trimmedUrl === "undefined") return null;
    return trimmedUrl.startsWith("http")
      ? trimmedUrl
      : `${baseUrl}${trimmedUrl.startsWith("/") ? "" : "/"}${trimmedUrl}`;
  }
  if (productId && image.id) {
    return `${baseUrl}/api/v1/products/${productId}/images/${image.id}/content`;
  }
  if (image.storageKey && image.storageKey.startsWith("http")) {
    return image.storageKey;
  }
  return null;
}

