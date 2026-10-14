import { apiClient } from "@/lib/api-client";
import {
  CreateProductRequest,
  ProductDto,
  ProductImageDto,
  ReorderProductImagesRequest,
  UpdateProductRequest,
} from "@/types/api";

export const sellerProductsApi = {
  /**
   * Retrieves all product listings belonging to the authenticated seller (Drafts, Published, Archived).
   */
  async getMyProducts(): Promise<ProductDto[]> {
    return apiClient.get<ProductDto[]>("/api/v1/seller/products");
  },

  /**
   * Retrieves a product by ID (including draft/archived products if caller is the owner).
   */
  async getProductById(id: string): Promise<ProductDto> {
    return apiClient.get<ProductDto>(`/api/v1/products/${id}`);
  },

  /**
   * Creates a new product listing in Draft status.
   */
  async createProduct(request: CreateProductRequest): Promise<ProductDto> {
    return apiClient.post<ProductDto>("/api/v1/seller/products", request);
  },

  /**
   * Updates product metadata (title, category, price, condition, description).
   */
  async updateProduct(id: string, request: UpdateProductRequest): Promise<ProductDto> {
    return apiClient.patch<ProductDto>(`/api/v1/seller/products/${id}`, request);
  },

  /**
   * Publishes a draft product listing to the public catalog.
   */
  async publishProduct(id: string): Promise<ProductDto> {
    return apiClient.post<ProductDto>(`/api/v1/seller/products/${id}/publish`);
  },

  /**
   * Archives a product listing, hiding it from public discovery.
   */
  async archiveProduct(id: string): Promise<ProductDto> {
    return apiClient.post<ProductDto>(`/api/v1/seller/products/${id}/archive`);
  },

  /**
   * Uploads an image file (JPEG, PNG, WebP) for the specified product.
   */
  async uploadProductImage(productId: string, file: File): Promise<ProductImageDto> {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<ProductImageDto>(`/api/v1/seller/products/${productId}/images`, formData);
  },

  /**
   * Deletes a product image and its physical storage file.
   */
  async deleteProductImage(productId: string, imageId: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/seller/products/${productId}/images/${imageId}`);
  },

  /**
   * Sets an image as the primary cover photo for the product (SortOrder = 0).
   */
  async setPrimaryProductImage(productId: string, imageId: string): Promise<ProductImageDto> {
    return apiClient.put<ProductImageDto>(
      `/api/v1/seller/products/${productId}/images/${imageId}/primary`
    );
  },

  /**
   * Reorders the list of product images according to the provided image ID array.
   */
  async reorderProductImages(
    productId: string,
    imageIds: string[]
  ): Promise<ProductImageDto[]> {
    const payload: ReorderProductImagesRequest = { imageIds };
    return apiClient.put<ProductImageDto[]>(
      `/api/v1/seller/products/${productId}/images/reorder`,
      payload
    );
  },

  /**
   * Retrieves all image metadata for a product.
   */
  async getProductImages(productId: string): Promise<ProductImageDto[]> {
    return apiClient.get<ProductImageDto[]>(`/api/v1/products/${productId}/images`);
  },
};
