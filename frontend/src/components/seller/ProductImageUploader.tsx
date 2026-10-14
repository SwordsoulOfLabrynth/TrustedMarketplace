"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  UploadCloud,
  X,
  Star,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Image as ImageIcon,
} from "lucide-react";
import { ProductImageDto } from "@/types/api";
import { sellerProductsApi } from "@/lib/seller-products-api";
import { getProductImageUrl } from "@/lib/catalog-api";
import { ApiException } from "@/lib/api-client";

interface ProductImageUploaderProps {
  productId: string;
  images: ProductImageDto[];
  onImagesChange: (updatedImages: ProductImageDto[]) => void;
  disabled?: boolean;
}

const MAX_IMAGES = 8;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

interface UploadingFile {
  id: string;
  name: string;
  previewUrl: string;
  progress: number;
  error?: string;
}

export function ProductImageUploader({
  productId,
  images,
  onImagesChange,
  disabled = false,
}: ProductImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [brokenImageIds, setBrokenImageIds] = useState<Record<string, boolean>>({});

  const clearMessages = () => {
    setActionError(null);
    setSuccessMessage(null);
  };

  const validateFile = (file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES.includes(file.type)) {
      return `"${file.name}" has an unsupported format. Only genuine JPEG, PNG, and WebP photographs are permitted.`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      return `"${file.name}" is ${sizeMb} MB, which exceeds the 5 MB file size limit.`;
    }
    return null;
  };

  const handleFiles = async (files: FileList | File[]) => {
    clearMessages();
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      setActionError(`This product already has the maximum of ${MAX_IMAGES} images. Remove an image before adding more.`);
      return;
    }

    const filesToUpload = fileArray.slice(0, remainingSlots);
    if (fileArray.length > remainingSlots) {
      setActionError(`You can only add ${remainingSlots} more image${remainingSlots === 1 ? "" : "s"} (limit: ${MAX_IMAGES}). The remaining files were skipped.`);
    }

    // Client-side validation check
    for (const file of filesToUpload) {
      const error = validateFile(file);
      if (error) {
        setActionError(error);
        return;
      }
    }

    setIsProcessing(true);

    // Create transient uploading items
    const newUploading: UploadingFile[] = filesToUpload.map((file) => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      progress: 25,
    }));
    setUploadingFiles((prev) => [...prev, ...newUploading]);

    let currentImages = [...images];
    const errors: string[] = [];
    let successCount = 0;

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      const uploadItem = newUploading[i];

      try {
        // Update progress indication
        setUploadingFiles((prev) =>
          prev.map((item) =>
            item.id === uploadItem.id ? { ...item, progress: 65 } : item
          )
        );

        const uploadedDto = await sellerProductsApi.uploadProductImage(productId, file);
        currentImages = [...currentImages, uploadedDto];
        onImagesChange(currentImages);
        successCount++;

        // Remove from uploading list once successfully committed
        setUploadingFiles((prev) => prev.filter((item) => item.id !== uploadItem.id));
        URL.revokeObjectURL(uploadItem.previewUrl);
      } catch (err: unknown) {
        let msg = `Failed to upload "${file.name}".`;
        if (err instanceof ApiException) {
          msg = err.message;
        } else if (err instanceof Error) {
          msg = err.message;
        }
        errors.push(msg);

        // Mark upload item as errored
        setUploadingFiles((prev) =>
          prev.map((item) =>
            item.id === uploadItem.id ? { ...item, error: msg, progress: 0 } : item
          )
        );
      }
    }

    setIsProcessing(false);

    if (errors.length > 0) {
      setActionError(errors.join(" · "));
    }
    if (successCount > 0) {
      setSuccessMessage(`Successfully uploaded ${successCount} image${successCount > 1 ? "s" : ""}.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isProcessing) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isProcessing) return;
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleDelete = async (imageId: string) => {
    clearMessages();
    setIsProcessing(true);
    try {
      await sellerProductsApi.deleteProductImage(productId, imageId);
      const remaining = images.filter((img) => img.id !== imageId);
      // Promote first item if deleted was primary
      const updated = remaining.map((img, idx) => ({
        ...img,
        sortOrder: idx,
        isPrimary: idx === 0,
      }));
      onImagesChange(updated);
      setSuccessMessage("Image removed.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof ApiException ? err.message : "Failed to remove image.";
      setActionError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSetPrimary = async (imageId: string) => {
    clearMessages();
    setIsProcessing(true);
    try {
      await sellerProductsApi.setPrimaryProductImage(productId, imageId);
      // Locally reorder with target at index 0
      const target = images.find((img) => img.id === imageId);
      if (target) {
        const others = images.filter((img) => img.id !== imageId);
        const reordered = [target, ...others].map((img, idx) => ({
          ...img,
          sortOrder: idx,
          isPrimary: idx === 0,
        }));
        onImagesChange(reordered);
      }
      setSuccessMessage("Cover photo updated.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof ApiException ? err.message : "Failed to update cover photo.";
      setActionError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMove = async (currentIndex: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    clearMessages();
    setIsProcessing(true);

    const reordered = [...images];
    const temp = reordered[currentIndex];
    reordered[currentIndex] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    const normalized = reordered.map((img, idx) => ({
      ...img,
      sortOrder: idx,
      isPrimary: idx === 0,
    }));

    try {
      const imageIds = normalized.map((img) => img.id);
      await sellerProductsApi.reorderProductImages(productId, imageIds);
      onImagesChange(normalized);
      setSuccessMessage("Image order saved.");
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch (err: unknown) {
      const msg = err instanceof ApiException ? err.message : "Failed to reorder images.";
      setActionError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const dismissUploadError = (id: string) => {
    setUploadingFiles((prev) => {
      const item = prev.find((x) => x.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const isUploadDisabled = disabled || isProcessing || images.length >= MAX_IMAGES;

  return (
    <div className="space-y-4">
      {/* Feedback Alerts */}
      {actionError && (
        <div
          role="alert"
          aria-live="polite"
          className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2 shadow-2xs"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span className="flex-1">{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-500 hover:text-red-800 p-0.5"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 rounded-xl bg-jade-50 border border-jade-200 text-jade-800 text-xs flex items-center gap-2 shadow-2xs"
        >
          <CheckCircle2 className="w-4 h-4 text-jade-600 shrink-0" />
          <span className="flex-1 font-medium">{successMessage}</span>
        </div>
      )}

      {/* Dropzone Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploadDisabled && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
          isDragging
            ? "border-jade-600 bg-jade-50/50 scale-[1.005]"
            : isUploadDisabled
            ? "border-stone-200 bg-stone-50 cursor-not-allowed opacity-70"
            : "border-stone-300 hover:border-jade-600 hover:bg-stone-50/60 bg-white"
        }`}
        tabIndex={isUploadDisabled ? -1 : 0}
        role="button"
        aria-label="Upload genuine product photography"
        onKeyDown={(e) => {
          if (!isUploadDisabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(",")}
          multiple
          onChange={handleFileSelect}
          disabled={isUploadDisabled}
          className="hidden"
          aria-hidden="true"
        />

        <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
          <div className="w-10 h-10 rounded-xl bg-jade-50 text-jade-800 flex items-center justify-center border border-jade-200">
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin text-jade-700" />
            ) : (
              <UploadCloud className="w-5 h-5 text-jade-700" />
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs sm:text-sm font-bold text-ink-900">
              {isUploadDisabled && images.length >= MAX_IMAGES
                ? `Maximum limit reached (${MAX_IMAGES}/${MAX_IMAGES} photos)`
                : "Click to upload product photographs or drag & drop"}
            </p>
            <p className="text-[11px] text-ink-500">
              JPEG, PNG, or WebP · Maximum 5 MB per file · Up to {MAX_IMAGES} genuine photos
            </p>
          </div>
        </div>
      </div>

      {/* Uploading / Pending Queue */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
            Uploading ({uploadingFiles.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {uploadingFiles.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-stone-200 bg-white text-xs shadow-2xs"
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 shrink-0 border border-stone-200 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.previewUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                  {item.error ? (
                    <div className="absolute inset-0 bg-red-600/70 flex items-center justify-center text-white">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-white">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink-900 truncate text-[11px]">{item.name}</p>
                  {item.error ? (
                    <p className="text-[10px] text-red-600 font-medium truncate">{item.error}</p>
                  ) : (
                    <div className="w-full bg-stone-200 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div
                        className="bg-jade-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {item.error && (
                  <button
                    type="button"
                    onClick={() => dismissUploadError(item.id)}
                    className="p-1 text-stone-400 hover:text-ink-700"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Committed Images Gallery */}
      {images.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-ink-600">
            <span className="font-bold text-ink-900">
              Product Photography ({images.length}/{MAX_IMAGES})
            </span>
            <span className="text-[11px] text-ink-500">
              The first image is your primary catalog cover photo
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {images.map((image, index) => {
              const isCover = image.isPrimary || index === 0;
              const displayUrl = getProductImageUrl(image, productId);

              return (
                <div
                  key={image.id}
                  className={`group relative flex flex-col rounded-2xl overflow-hidden border transition-all bg-white shadow-2xs ${
                    isCover
                      ? "border-jade-600 ring-2 ring-jade-600/20"
                      : "border-stone-200 hover:border-stone-300"
                  }`}
                >
                  {/* Photo Display */}
                  <div className="aspect-square bg-stone-100 relative overflow-hidden flex items-center justify-center">
                    {displayUrl && !brokenImageIds[image.id] ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={displayUrl}
                        alt={`Product image ${index + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={() =>
                          setBrokenImageIds((prev) => ({ ...prev, [image.id]: true }))
                        }
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1 text-stone-400 p-2 text-center">
                        <ImageIcon className="w-8 h-8 stroke-1 text-stone-300" />
                        <span className="text-[9px] font-mono">Photo {index + 1}</span>
                      </div>
                    )}

                    {/* Cover Photo Badge */}
                    {isCover && (
                      <div className="absolute top-2 left-2 bg-jade-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
                        <span>Cover Photo</span>
                      </div>
                    )}

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleDelete(image.id)}
                      disabled={disabled || isProcessing}
                      className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-xs opacity-90 sm:opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Delete image"
                      aria-label={`Delete image ${index + 1}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Management Bar */}
                  <div className="p-2 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-1 text-[11px]">
                    {/* Make Cover Button */}
                    {!isCover ? (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(image.id)}
                        disabled={disabled || isProcessing}
                        className="text-jade-800 hover:text-jade-950 font-semibold text-[10px] flex items-center gap-1 hover:underline"
                        title="Set as primary cover image"
                      >
                        <Star className="w-3 h-3 text-stone-400 hover:text-amber-500" />
                        <span>Make Cover</span>
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-jade-800 uppercase tracking-wider">
                        Primary
                      </span>
                    )}

                    {/* Reorder Arrows */}
                    <div className="flex items-center gap-0.5 ml-auto">
                      <button
                        type="button"
                        onClick={() => handleMove(index, "left")}
                        disabled={disabled || isProcessing || index === 0}
                        className="p-1 text-ink-500 hover:text-ink-900 disabled:opacity-30 disabled:hover:text-ink-500 rounded hover:bg-stone-200"
                        title="Move left"
                        aria-label={`Move image ${index + 1} left`}
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(index, "right")}
                        disabled={disabled || isProcessing || index === images.length - 1}
                        className="p-1 text-ink-500 hover:text-ink-900 disabled:opacity-30 disabled:hover:text-ink-500 rounded hover:bg-stone-200"
                        title="Move right"
                        aria-label={`Move image ${index + 1} right`}
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
