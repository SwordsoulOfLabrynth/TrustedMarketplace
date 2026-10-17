"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { X, ShieldCheck, AlertCircle, Loader2, ArrowRight, Info, Plus, Minus } from "lucide-react";
import { ProductDto } from "@/types/api";
import { ordersApi } from "@/lib/orders-api";
import { ApiException } from "@/lib/api-client";

interface OrderPlacementModalProps {
  product: ProductDto;
  isOpen: boolean;
  onClose: () => void;
}

export function OrderPlacementModal({
  product,
  isOpen,
  onClose,
}: OrderPlacementModalProps) {
  const router = useRouter();

  const [quantity, setQuantity] = useState(1);
  const [buyerContactPhone, setBuyerContactPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCityOrTownship, setDeliveryCityOrTownship] = useState("Yangon");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const subtotal = product.priceAmount * quantity;
  const formattedSubtotal = new Intl.NumberFormat("en-US").format(subtotal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (quantity < 1) {
      setErrorMessage("Quantity must be at least 1.");
      return;
    }

    if (!buyerContactPhone.trim()) {
      setErrorMessage("Contact phone number is required so the seller can coordinate delivery.");
      return;
    }

    if (!deliveryAddress.trim()) {
      setErrorMessage("Delivery address is required.");
      return;
    }

    if (!deliveryCityOrTownship.trim()) {
      setErrorMessage("Delivery city or township is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const order = await ordersApi.createOrder({
        productId: product.id,
        quantity,
        buyerContactPhone: buyerContactPhone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        deliveryCityOrTownship: deliveryCityOrTownship.trim(),
        deliveryNotes: deliveryNotes.trim() || undefined,
      });

      onClose();
      router.push(`/orders/${order.id}`);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiException
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to place order. Please try again.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-stone-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl border border-ivory-300 shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-ivory-200 flex items-center justify-between bg-ivory-100/50">
          <div>
            <h2 className="text-sm font-bold text-ink-900">
              Confirm Non-Custodial Order
            </h2>
            <span className="text-[11px] text-jade-700 font-medium block">
              Direct Artisan Settlement
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ivory-200 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Product Summary Snapshot */}
          <div className="p-3 rounded-2xl bg-ivory-100 border border-ivory-300 flex items-center justify-between gap-3">
            <div className="truncate">
              <h3 className="font-semibold text-xs text-ink-900 truncate">
                {product.title}
              </h3>
              <div className="flex items-center gap-1 text-[11px] text-ink-500 mt-0.5">
                <ShieldCheck className="w-3 h-3 text-jade-600" />
                <span className="truncate">{product.storeName}</span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs font-bold text-jade-800">
                {new Intl.NumberFormat("en-US").format(product.priceAmount)} {product.currencyCode}
              </span>
              <span className="block text-[10px] text-ink-400">per item</span>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form id="orderForm" onSubmit={handleSubmit} className="space-y-3.5">
            {/* Quantity Stepper */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-ivory-300 bg-white">
              <span className="text-xs font-semibold text-ink-800">Order Quantity</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-7 h-7 rounded-lg bg-ivory-200 text-ink-700 flex items-center justify-center hover:bg-ivory-300 transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-xs font-bold w-6 text-center">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-7 h-7 rounded-lg bg-ivory-200 text-ink-700 flex items-center justify-center hover:bg-ivory-300 transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Buyer Contact Phone */}
            <div className="space-y-1">
              <label
                htmlFor="buyerPhone"
                className="block text-xs font-semibold text-ink-700"
              >
                Contact Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                id="buyerPhone"
                type="tel"
                required
                value={buyerContactPhone}
                onChange={(e) => setBuyerContactPhone(e.target.value)}
                placeholder="09798881234"
                className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-jade-500/20 focus:border-jade-600 transition-all shadow-2xs"
              />
            </div>

            {/* Delivery Address */}
            <div className="space-y-1">
              <label
                htmlFor="delivAddress"
                className="block text-xs font-semibold text-ink-700"
              >
                Street Delivery Address <span className="text-red-500">*</span>
              </label>
              <textarea
                id="delivAddress"
                required
                rows={2}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="No. 42, Bogyoke Aung San Road..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-jade-500/20 focus:border-jade-600 transition-all shadow-2xs resize-none"
              />
            </div>

            {/* Delivery City / Township */}
            <div className="space-y-1">
              <label
                htmlFor="delivCity"
                className="block text-xs font-semibold text-ink-700"
              >
                City / Township <span className="text-red-500">*</span>
              </label>
              <input
                id="delivCity"
                type="text"
                required
                value={deliveryCityOrTownship}
                onChange={(e) => setDeliveryCityOrTownship(e.target.value)}
                placeholder="Yangon / Mandalay / Taunggyi"
                className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-jade-500/20 focus:border-jade-600 transition-all shadow-2xs"
              />
            </div>

            {/* Delivery Notes */}
            <div className="space-y-1">
              <label
                htmlFor="delivNotes"
                className="block text-xs font-semibold text-ink-700"
              >
                Delivery Notes (Optional)
              </label>
              <input
                id="delivNotes"
                type="text"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Preferred delivery time, landmark..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 bg-white text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-jade-500/20 focus:border-jade-600 transition-all shadow-2xs"
              />
            </div>
          </form>

          {/* Non-Custodial Direct Settlement Notice */}
          <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-[11px] leading-relaxed space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-800">
              <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Direct Settlement &amp; Payment Agreement</span>
            </div>
            <p className="leading-relaxed">
              MatchGuard operates non-custodially and does not hold funds. After you place this order, the verified artisan will contact your phone number to coordinate direct payment (KBZPay, WavePay, or Cash on Delivery) and fulfillment details.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-ivory-200 bg-ivory-100/50 flex items-center justify-between gap-3">
          <div>
            <span className="block text-[10px] text-ink-500 uppercase font-semibold">Total Subtotal</span>
            <span className="text-base font-black text-jade-800 tracking-tight">
              {formattedSubtotal} <span className="text-xs font-semibold text-ink-700">{product.currencyCode}</span>
            </span>
          </div>

          <button
            type="submit"
            form="orderForm"
            disabled={isSubmitting}
            className="py-2.5 px-4 rounded-xl bg-jade-700 hover:bg-jade-800 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-60 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Placing Order...</span>
              </>
            ) : (
              <>
                <span>Place Order</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
