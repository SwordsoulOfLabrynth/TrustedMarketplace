"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Package,
  ShoppingBag,
  Store,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { ordersApi } from "@/lib/orders-api";
import { getProductImageUrl } from "@/lib/catalog-api";
import { OrderDto } from "@/types/api";
import { useAuth } from "@/lib/auth-context";
import { MobileViewportContainer } from "@/components/layout/MobileViewportContainer";
import { AppHeader } from "@/components/layout/AppHeader";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";

function OrdersListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, store, isAuthenticated, isLoading: authLoading, isSeller } = useAuth();

  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"buyer" | "seller">(() => {
    if (tabParam === "seller" || tabParam === "buyer") return tabParam;
    return isSeller ? "seller" : "buyer";
  });

  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync tab with URL param or user seller status
  useEffect(() => {
    if (tabParam === "seller" || tabParam === "buyer") {
      setActiveTab(tabParam);
    } else if (isSeller) {
      setActiveTab("seller");
    }
  }, [tabParam, isSeller, user?.id]);

  const handleTabChange = (newTab: "buyer" | "seller") => {
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    router.replace(`/orders?${params.toString()}`);
  };

  const fetchOrders = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const data =
        activeTab === "seller"
          ? await ordersApi.getSellerOrders()
          : await ordersApi.getBuyerOrders();
      setOrders(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load orders. Please check your network connection."
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, activeTab]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login?returnUrl=/orders");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated, activeTab, fetchOrders]);

  if (authLoading) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-12 text-center text-xs text-ink-500 animate-pulse">
          Loading authentication session...
        </div>
      </MobileViewportContainer>
    );
  }

  if (!isAuthenticated) {
    return (
      <MobileViewportContainer header={<AppHeader />}>
        <div className="py-12 max-w-md mx-auto text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-ink-500 flex items-center justify-center mx-auto border border-stone-200 shadow-2xs">
            <ShoppingBag className="w-6 h-6 text-jade-800" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-ink-900">
              Sign In to View Orders
            </h1>
            <p className="text-xs text-ink-500 mt-1 myanmar-text">
              အော်ဒါမှတ်တမ်းများနှင့် တိုက်ရိုက်ဆက်သွယ်မှုများကို ကြည့်ရှုရန် အကောင့်ဝင်ရောက်ပါ။
            </p>
          </div>
          <Link
            href="/auth/login?returnUrl=/orders"
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
    <MobileViewportContainer
      header={<AppHeader />}
      footer={
        <div className="px-4 py-3 text-center text-xs text-ink-500 font-medium">
          <span>Non-Custodial Architecture · Trusted Marketplace Myanmar Pilot</span>
        </div>
      }
    >
      <div className="space-y-4 py-2">
        {/* Page Header */}
        <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-ink-900 tracking-tight">
              Order Hub · အော်ဒါမှတ်တမ်းများ
            </h1>
            <p className="text-xs text-ink-500 mt-0.5">
              Direct transaction coordination and delivery tracking
            </p>
          </div>

          <button
            type="button"
            onClick={fetchOrders}
            disabled={isLoading}
            className="p-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-ink-700 transition-colors shadow-2xs"
            title="Refresh orders"
            aria-label="Refresh orders"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Tab Switcher for Sellers */}
        {isSeller && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 p-1 bg-stone-200/70 rounded-2xl text-xs font-semibold select-none">
              <button
                type="button"
                onClick={() => handleTabChange("seller")}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "seller"
                    ? "bg-white text-ink-900 shadow-2xs font-bold"
                    : "text-ink-600 hover:text-ink-900"
                }`}
              >
                <Store className="w-3.5 h-3.5 text-jade-700" />
                <span>Store Orders (Incoming)</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("buyer")}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "buyer"
                    ? "bg-white text-ink-900 shadow-2xs font-bold"
                    : "text-ink-600 hover:text-ink-900"
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5 text-jade-700" />
                <span>My Purchases</span>
              </button>
            </div>
            {store && activeTab === "seller" && (
              <div className="px-1 text-[11px] text-ink-500 flex flex-wrap items-center justify-between gap-2 font-medium">
                <div className="flex items-center gap-1">
                  <span className="text-jade-800 font-semibold">{store.storeName}</span>
                  <span>· Incoming customer orders awaiting fulfillment</span>
                </div>
                <Link
                  href="/seller/products"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-jade-800 hover:underline shrink-0"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Manage Products &amp; Photography</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <div className="flex-1">
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={fetchOrders}
              className="text-xs font-semibold underline text-red-800"
            >
              Retry
            </button>
          </div>
        )}

        {/* Orders List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-white border border-stone-200 space-y-2.5 animate-pulse"
              >
                <div className="flex justify-between">
                  <div className="h-4 bg-stone-200 rounded w-1/3" />
                  <div className="h-4 bg-stone-200 rounded w-1/4" />
                </div>
                <div className="h-5 bg-stone-200 rounded w-3/4" />
                <div className="h-4 bg-stone-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : orders.length > 0 ? (
          <div className="space-y-3">
            {orders.map((order) => {
              const formattedSubtotal = new Intl.NumberFormat("en-US").format(
                order.subtotalAmount
              );
              const firstItem = order.items[0];
              const itemsCount = order.items.reduce((acc, i) => acc + i.quantity, 0);
              const itemImageUrl = getProductImageUrl(firstItem?.primaryImageUrl);

              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="block p-3.5 sm:p-4 rounded-2xl bg-white border border-stone-200/90 hover:border-jade-300 shadow-2xs hover:shadow-xs transition-all space-y-2.5 group"
                >
                  {/* Top Bar: Order ID & Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-ink-500 font-semibold">
                      #{order.id.substring(0, 8)}...
                    </span>
                    <OrderStatusBadge status={order.status} size="sm" />
                  </div>

                  {/* Thumbnail & Items Snapshot */}
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-stone-100 border border-stone-200/70 shrink-0 flex items-center justify-center">
                      {itemImageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={itemImageUrl}
                          alt={firstItem?.productTitle || "Order item"}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <Package className="w-5 h-5 sm:w-6 sm:h-6 text-stone-400" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <h3 className="text-xs sm:text-sm font-bold text-ink-900 group-hover:text-jade-800 transition-colors line-clamp-1">
                        {firstItem ? firstItem.productTitle : "Artisan Order Item"}
                      </h3>
                      <p className="text-[11px] text-ink-500">
                        {itemsCount} {itemsCount === 1 ? "piece" : "pieces"} · {order.deliveryCityOrTownship}
                      </p>
                    </div>
                  </div>

                  {/* Subtotal & Action */}
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-ink-400 block uppercase font-medium">Subtotal</span>
                      <span className="text-xs font-bold text-jade-800">
                        {formattedSubtotal} {order.currencyCode}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-semibold text-jade-700 group-hover:translate-x-0.5 transition-transform">
                      <span>View Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-10 text-center rounded-3xl bg-white border border-stone-200/90 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 text-ink-400 flex items-center justify-center mx-auto">
              <Package className="w-6 h-6 text-ink-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-ink-900">
                {activeTab === "seller"
                  ? "No incoming store orders yet"
                  : "No purchase orders yet"}
              </h3>
              <p className="text-xs text-ink-500 mt-0.5 myanmar-text">
                {activeTab === "seller"
                  ? "သင့်ဆိုင်ခွဲအတွက် အော်ဒါအသစ်မရှိသေးပါ။"
                  : "သင်ဝယ်ယူထားသော အော်ဒါမှတ်တမ်း မရှိသေးပါ။"}
              </p>
            </div>
            {activeTab === "buyer" && (
              <Link
                href="/products"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jade-800 text-white font-semibold text-xs hover:bg-jade-900 transition-colors shadow-2xs"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Explore Catalog</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </MobileViewportContainer>
  );
}

export default function OrdersListPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-ivory-100">
          <Loader2 className="w-6 h-6 animate-spin text-jade-700" />
        </div>
      }
    >
      <OrdersListContent />
    </Suspense>
  );
}
