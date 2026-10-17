"use client";

import React, { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ShieldCheck,
  Check,
  Clock,
  AlertCircle,
  Package,
  Phone,
  MapPin,
  Truck,
  Star,
  Loader2,
  AlertTriangle,
  Info,
  Store,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  ArrowRight,
} from "lucide-react";
import { ordersApi } from "@/lib/orders-api";
import { catalogApi, getProductImageUrl } from "@/lib/catalog-api";
import { OrderDto, ReviewDto, StoreProfileDto } from "@/types/api";
import { useAuth } from "@/lib/auth-context";
import { ApiException } from "@/lib/api-client";
import { MobileViewportContainer } from "@/components/layout/MobileViewportContainer";
import { AppHeader } from "@/components/layout/AppHeader";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [order, setOrder] = useState<OrderDto | null>(null);
  const [store, setStore] = useState<StoreProfileDto | null>(null);
  const [existingReview, setExistingReview] = useState<ReviewDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cancellation modal state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Shipping modal state
  const [isShipModalOpen, setIsShipModalOpen] = useState(false);
  const [courierTrackingInput, setCourierTrackingInput] = useState("");

  // Dispute modal state
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [disputeDescription, setDisputeDescription] = useState("");

  // Review submission state
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>("");
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  const fetchOrderDetails = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const orderData = await ordersApi.getOrderById(orderId);
      setOrder(orderData);

      // Concurrently fetch seller store profile & existing reviews
      try {
        const [storeData, reviewsData] = await Promise.all([
          catalogApi.getSellerStore(orderData.sellerUserId),
          catalogApi.getSellerReviews(orderData.sellerUserId, 1, 50),
        ]);
        setStore(storeData);

        // Check if a review already exists for this order
        const found = reviewsData.items.find((r) => r.orderId === orderData.id);
        if (found) {
          setExistingReview(found);
        }
      } catch {
        // Non-critical secondary fetches
      }
    } catch (err: unknown) {
      const msg =
        err instanceof ApiException
          ? err.message
          : err instanceof Error
          ? err.message
          : "Could not load order details.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [orderId, isAuthenticated]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/auth/login?returnUrl=/orders/${orderId}`);
    }
  }, [authLoading, isAuthenticated, router, orderId]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrderDetails();
    }
  }, [isAuthenticated, fetchOrderDetails]);

  // Handle Accept (Seller)
  const handleAcceptOrder = async () => {
    if (!order) return;
    setIsActionLoading(true);
    setErrorMessage(null);
    try {
      const updated = await ordersApi.acceptOrder(order.id);
      setOrder(updated);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to accept order.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Ship (Seller)
  const handleShipOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setIsActionLoading(true);
    setErrorMessage(null);
    try {
      const updated = await ordersApi.shipOrder(order.id, courierTrackingInput.trim() || undefined);
      setOrder(updated);
      setIsShipModalOpen(false);
      setCourierTrackingInput("");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to dispatch order.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Confirm Delivery (Buyer)
  const handleConfirmDelivery = async () => {
    if (!order) return;
    setIsActionLoading(true);
    setErrorMessage(null);
    try {
      const updated = await ordersApi.confirmDelivery(order.id);
      setOrder(updated);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to confirm delivery.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Cancel (Buyer / Seller)
  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !cancelReason.trim()) return;
    setIsActionLoading(true);
    setErrorMessage(null);
    try {
      const updated = await ordersApi.cancelOrder(order.id, cancelReason.trim());
      setOrder(updated);
      setIsCancelModalOpen(false);
      setCancelReason("");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to cancel order.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Dispute / Complaint
  const handleFileDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !disputeDescription.trim()) return;
    setIsActionLoading(true);
    setErrorMessage(null);
    try {
      await ordersApi.fileComplaint(order.id, disputeDescription.trim());
      setIsDisputeModalOpen(false);
      setDisputeDescription("");
      // Refresh order to reflect Disputed status
      await fetchOrderDetails();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to file dispute complaint.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Review Submission (Buyer on Completed order)
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !reviewComment.trim()) return;
    setIsSubmittingReview(true);
    setErrorMessage(null);
    try {
      const rev = await ordersApi.submitReview(order.id, reviewRating, reviewComment.trim());
      setExistingReview(rev);
      setReviewComment("");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to submit review.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-8 space-y-4 animate-pulse">
          <div className="h-4 bg-ivory-300 rounded w-1/3" />
          <div className="h-10 bg-ivory-300 rounded-2xl" />
          <div className="h-28 bg-ivory-300 rounded-2xl" />
          <div className="h-32 bg-ivory-300 rounded-2xl" />
        </div>
      </MobileViewportContainer>
    );
  }

  if (!order) {
    if (!isAuthenticated) {
      return (
        <MobileViewportContainer header={<AppHeader />}>
          <div className="py-12 max-w-md mx-auto text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 text-ink-500 flex items-center justify-center mx-auto border border-stone-200 shadow-2xs">
              <ShoppingBag className="w-6 h-6 text-jade-800" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-ink-900">
                Sign In to View Order
              </h1>
              <p className="text-xs text-ink-500 mt-1">
                Sign in with the relevant buyer or seller account to view this order.
              </p>
            </div>
            <Link
              href={`/auth/login?returnUrl=/orders/${orderId}`}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-jade-800 text-white font-semibold text-xs hover:bg-jade-900 transition-colors shadow-2xs cursor-pointer"
            >
              <span>Sign In to Your Account</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </MobileViewportContainer>
      );
    }

    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-ink-500 flex items-center justify-center mx-auto border border-stone-200 shadow-2xs">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-base font-bold text-ink-900">
              Order Not Accessible
            </h1>
            <p className="text-xs text-ink-500 mt-1">
              {errorMessage || "Order not found or you do not have permission to view it."}
            </p>
          </div>
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jade-800 text-white font-semibold text-xs hover:bg-jade-900 transition-colors shadow-2xs cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Orders</span>
          </Link>
        </div>
      </MobileViewportContainer>
    );
  }

  const isBuyer = user?.id.toLowerCase() === order.buyerUserId.toLowerCase();
  const isSellerActor = user?.id.toLowerCase() === order.sellerUserId.toLowerCase();
  const formattedSubtotal = new Intl.NumberFormat("en-US").format(order.subtotalAmount);

  return (
    <MobileViewportContainer
      header={<AppHeader />}
      footer={
        <div className="px-4 py-3 text-center text-xs text-ink-500 font-medium">
          <span>Non-Custodial Architecture · MatchGuard Myanmar</span>
        </div>
      }
    >
      <div className="space-y-4 py-3">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-700 hover:text-jade-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>My Orders</span>
          </Link>

          <OrderStatusBadge status={order.status} size="md" />
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 shadow-2xs animate-fade-in">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <div className="flex-1">
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-700 hover:text-red-900"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Order Meta Card */}
        <div className="p-4 rounded-3xl bg-white border border-stone-200/90 shadow-2xs space-y-3">
          <div className="flex items-start justify-between gap-2 border-b border-ivory-200 pb-2.5">
            <div>
              <span className="text-[10px] text-ink-500 uppercase font-semibold block">Order Reference</span>
              <h1 className="text-xs font-bold font-mono text-ink-900">
                #{order.id}
              </h1>
            </div>
            <span className="text-[11px] font-mono text-ink-500">
              {new Date(order.createdAtUtc).toLocaleDateString()}
            </span>
          </div>

          {/* Participant Role Banner */}
          <div className="flex items-center justify-between text-xs text-ink-700">
            <div className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-jade-700 shrink-0" />
              <span>Seller Store:</span>
              <strong className="text-ink-900 truncate">
                {store?.storeName || "Verified Artisan Store"}
              </strong>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-ivory-200 text-ink-800">
              {isBuyer ? "You are Buyer" : isSellerActor ? "You are Seller" : "Platform Viewer"}
            </span>
          </div>
        </div>

        {/* Non-Custodial Transparency Notice */}
        <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-800 text-[11px]">
            <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>Non-Custodial Direct Settlement</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            MatchGuard operates on a non-custodial model and does not hold payments in escrow. Buyers and sellers coordinate direct payment (KBZPay, WavePay, or Cash on Delivery) and fulfillment directly via phone.
          </p>
        </div>

        {/* Order Items Snapshot */}
        <div className="p-4 rounded-3xl bg-white border border-stone-200/90 shadow-2xs space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-600">
            Order Items ({order.items.length})
          </h2>

          <div className="divide-y divide-ivory-200">
            {order.items.map((item) => {
              const itemImgUrl = getProductImageUrl(item.primaryImageUrl);
              return (
                <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-stone-100 border border-stone-200/80 shrink-0 flex items-center justify-center">
                      {itemImgUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={itemImgUrl}
                          alt={item.productTitle}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <Package className="w-5 h-5 text-stone-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-ink-900 truncate">
                        {item.productId ? (
                          <Link
                            href={`/products/${item.productId}`}
                            className="hover:text-jade-800 hover:underline"
                          >
                            {item.productTitle}
                          </Link>
                        ) : (
                          item.productTitle
                        )}
                      </h3>
                      <span className="text-[11px] text-ink-500 block">
                        Quantity: {item.quantity} · Condition: {item.condition}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-ink-900">
                      {new Intl.NumberFormat("en-US").format(item.unitPrice * item.quantity)} {order.currencyCode}
                    </span>
                    <span className="block text-[10px] text-ink-400">
                      @{new Intl.NumberFormat("en-US").format(item.unitPrice)} each
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-ivory-200 flex items-baseline justify-between">
            <span className="text-xs font-bold text-ink-900 uppercase">Subtotal</span>
            <span className="text-base font-black text-jade-800 tracking-tight">
              {formattedSubtotal} {order.currencyCode}
            </span>
          </div>
        </div>

        {/* Delivery & Direct Settlement Coordination */}
        <div className="p-4 rounded-3xl bg-white border border-stone-200/90 shadow-2xs space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-600">
            Order &amp; Delivery Coordination
          </h2>

          {/* Seller Direct Settlement Contact (for Buyer to pay / coordinate) */}
          {store && (
            <div className="p-3 rounded-2xl bg-jade-50/70 border border-jade-200/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-jade-900 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-jade-700 shrink-0" />
                  <span>Merchant: {store.storeName}</span>
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white text-jade-800 border border-jade-300 shadow-2xs">
                  Direct Pay Contact
                </span>
              </div>
              <div className="text-xs text-ink-800 flex items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-jade-700 shrink-0" />
                  <span>Seller Phone:</span>
                  <a
                    href={`tel:${store.contactPhone}`}
                    className="font-bold text-jade-800 hover:underline tracking-wide"
                  >
                    {store.contactPhone}
                  </a>
                </div>
                {store.cityOrTownship && (
                  <span className="text-[11px] text-ink-500 font-medium">
                    {store.cityOrTownship}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-jade-800 leading-tight">
                Call or message the artisan directly using the number above to arrange payment (KBZPay / WavePay) or ask order questions.
              </p>
            </div>
          )}

          {/* Buyer Delivery Recipient Info */}
          <div className="space-y-1.5 text-xs text-ink-800 pt-1">
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-ink-600 shrink-0" />
              <span>Buyer Delivery Phone: <strong>{order.buyerContactPhone}</strong></span>
            </div>

            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-ink-600 shrink-0 mt-0.5" />
              <div>
                <span>{order.deliveryAddress}</span>
                <span className="block text-ink-500 text-[11px] font-medium">
                  {order.deliveryCityOrTownship}
                </span>
              </div>
            </div>

            {order.deliveryNotes && (
              <div className="pt-1 text-[11px] text-ink-600 bg-ivory-100 p-2 rounded-xl">
                <span className="font-semibold">Buyer Notes:</span> {order.deliveryNotes}
              </div>
            )}

            {order.courierTrackingReference && (
              <div className="pt-1 flex items-center gap-1.5 text-xs text-purple-800 bg-purple-50 p-2 rounded-xl border border-purple-200">
                <Truck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span>Courier Tracking Reference: <strong>{order.courierTrackingReference}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls based on Role & State */}
        <div className="space-y-2 pt-1">
          {/* Seller Action Controls */}
          {isSellerActor && (
            <div className="p-4 rounded-3xl bg-white border border-jade-300 shadow-sm space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-jade-800">
                Seller Order Actions
              </h2>

              <div className="flex flex-col gap-2">
                {order.status === "Placed" && (
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={handleAcceptOrder}
                    className="w-full py-2.5 px-4 rounded-xl bg-jade-700 hover:bg-jade-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {isActionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Accept Order</span>
                  </button>
                )}

                {order.status === "Accepted" && (
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={() => setIsShipModalOpen(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    <Truck className="w-4 h-4" />
                    <span>Dispatch / Mark Shipped</span>
                  </button>
                )}

                {(order.status === "Placed" || order.status === "Accepted") && (
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={() => setIsCancelModalOpen(true)}
                    className="w-full py-2 px-3 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5 text-stone-500" />
                    <span>Cancel Order</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Buyer Action Controls */}
          {isBuyer && (
            <div className="space-y-3">
              {/* Confirm Delivery button when Shipped */}
              {order.status === "Shipped" && (
                <div className="p-4 rounded-3xl bg-white border border-emerald-300 shadow-sm space-y-2.5">
                  <div>
                    <h2 className="text-xs font-bold text-emerald-900">
                      Confirm Delivery Received
                    </h2>
                    <p className="text-[11px] text-ink-600 leading-tight mt-0.5">
                      Confirm here once you have safely received the package. This completes the direct order.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={handleConfirmDelivery}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {isActionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Confirm Delivery Received</span>
                  </button>
                </div>
              )}

              {/* Cancel button when Placed */}
              {order.status === "Placed" && (
                <button
                  type="button"
                  disabled={isActionLoading}
                  onClick={() => setIsCancelModalOpen(true)}
                  className="w-full py-2 px-3 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5 text-stone-500" />
                  <span>Cancel Order Request</span>
                </button>
              )}

              {/* Verified Review Submission or Display when Completed */}
              {order.status === "Completed" && (
                <div className="p-4 rounded-3xl bg-white border border-jade-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-jade-800 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      <span>Transaction-Linked Review</span>
                    </h2>
                    <span className="text-[10px] text-jade-700 font-semibold">
                      Verified Purchase
                    </span>
                  </div>

                  {existingReview ? (
                    <div className="p-3 rounded-2xl bg-ivory-100 border border-stone-200/90 space-y-1.5">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < existingReview.rating
                                ? "text-amber-400 fill-amber-400"
                                : "text-ivory-300"
                            }`}
                          />
                        ))}
                        <span className="text-xs font-bold text-ink-800 ml-1">
                          {existingReview.rating} out of 5
                        </span>
                      </div>
                      <p className="text-xs text-ink-800 leading-relaxed myanmar-text">
                        &ldquo;{existingReview.comment}&rdquo;
                      </p>
                      <span className="text-[10px] text-ink-400 font-mono block">
                        Reviewed on {new Date(existingReview.createdAtUtc).toLocaleDateString()}
                      </span>
                    </div>
                  ) : (
                    <form onSubmit={handleReviewSubmit} className="space-y-3">
                      <p className="text-[11px] text-ink-600 leading-tight">
                        Rate your experience with this verified artisan to strengthen the community trust score.
                      </p>

                      {/* Interactive Star Rating */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-ink-700 mr-1">Rating:</span>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewRating(star)}
                            className="p-1 hover:scale-110 transition-transform"
                            aria-label={`Rate ${star} star`}
                          >
                            <Star
                              className={`w-5 h-5 ${
                                star <= reviewRating
                                  ? "text-amber-400 fill-amber-400"
                                  : "text-ivory-300"
                              }`}
                            />
                          </button>
                        ))}
                      </div>

                      {/* Comment Input */}
                      <textarea
                        required
                        rows={2}
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Write your review on product quality and delivery..."
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200/90 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-jade-500/20 focus:border-jade-600 transition-all shadow-2xs resize-none"
                      />

                      <button
                        type="submit"
                        disabled={isSubmittingReview || !reviewComment.trim()}
                        className="w-full py-2 px-3 rounded-xl bg-jade-700 hover:bg-jade-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
                      >
                        {isSubmittingReview ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        ) : (
                          <Star className="w-3.5 h-3.5 fill-white text-white" />
                        )}
                        <span>Submit Verified Review</span>
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Dispute Button */}
              {(order.status === "Placed" || order.status === "Accepted" || order.status === "Shipped") && (
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => setIsDisputeModalOpen(true)}
                    className="text-[11px] text-rose-700 hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Report an issue or file dispute</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status Timeline / History */}
        <div className="p-4 rounded-3xl bg-white border border-stone-200/90 shadow-2xs space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-600">
            Order Status Audit Trail
          </h2>

          <div className="relative pl-4 space-y-3 border-l-2 border-ivory-300">
            {order.history.map((hist, idx) => (
              <div key={hist.id || idx} className="relative text-xs">
                <span className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-jade-600 ring-4 ring-white" />
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink-900">
                      {hist.newStatus}
                    </span>
                    <span className="text-[10px] font-mono text-ink-400">
                      {new Date(hist.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(hist.createdAtUtc).toLocaleDateString()}
                    </span>
                  </div>
                  {hist.reason && (
                    <p className="text-[11px] text-ink-600 myanmar-text leading-tight">
                      {hist.reason}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cancel Order Dialog Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-stone-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 border border-stone-200/90 shadow-xl space-y-3">
            <h3 className="font-bold text-sm text-ink-900">
              Cancel Order
            </h3>
            <p className="text-xs text-ink-600">
              Please specify the cancellation reason for the audit trail:
            </p>
            <form onSubmit={handleCancelOrder} className="space-y-3">
              <textarea
                required
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Buyer requested cancellation / item unavailable..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200/90 bg-white text-ink-900 focus:outline-none focus:border-jade-600 resize-none shadow-2xs"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="flex-1 py-2 px-3 rounded-xl border border-stone-200/90 text-ink-700 text-xs font-semibold hover:bg-ivory-200"
                >
                  Keep Order
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading || !cancelReason.trim()}
                  className="flex-1 py-2 px-3 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-semibold disabled:opacity-60"
                >
                  Confirm Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispatch / Ship Order Dialog Modal */}
      {isShipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-stone-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 border border-stone-200/90 shadow-xl space-y-3">
            <h3 className="font-bold text-sm text-ink-900">
              Dispatch Order
            </h3>
            <p className="text-xs text-ink-600">
              Enter courier tracking reference or leave blank for direct hand-delivery:
            </p>
            <form onSubmit={handleShipOrder} className="space-y-3">
              <input
                type="text"
                value={courierTrackingInput}
                onChange={(e) => setCourierTrackingInput(e.target.value)}
                placeholder="ROYAL-EXPRESS-99182 / Delivery Boy"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200/90 bg-white text-ink-900 focus:outline-none focus:border-purple-600 shadow-2xs"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsShipModalOpen(false)}
                  className="flex-1 py-2 px-3 rounded-xl border border-stone-200/90 text-ink-700 text-xs font-semibold hover:bg-ivory-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="flex-1 py-2 px-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold disabled:opacity-60"
                >
                  Confirm Shipped
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Dispute Dialog Modal */}
      {isDisputeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-stone-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 border border-rose-200 shadow-xl space-y-3">
            <h3 className="font-bold text-sm text-rose-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>File Dispute Complaint</span>
            </h3>
            <p className="text-xs text-ink-600">
              Filing a dispute shifts this order to Disputed status for platform administrative review.
            </p>
            <form onSubmit={handleFileDispute} className="space-y-3">
              <textarea
                required
                rows={3}
                value={disputeDescription}
                onChange={(e) => setDisputeDescription(e.target.value)}
                placeholder="Describe the issue with goods, delivery, or merchant communication..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-rose-300 bg-white text-ink-900 focus:outline-none focus:border-rose-600 resize-none shadow-2xs"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDisputeModalOpen(false)}
                  className="flex-1 py-2 px-3 rounded-xl border border-ivory-300 text-ink-700 text-xs font-semibold hover:bg-ivory-200"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading || !disputeDescription.trim()}
                  className="flex-1 py-2 px-3 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold disabled:opacity-60"
                >
                  Submit Dispute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MobileViewportContainer>
  );
}
