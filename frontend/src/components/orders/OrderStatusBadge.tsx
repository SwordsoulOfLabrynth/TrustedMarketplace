"use client";

import React from "react";
import { OrderStatus } from "@/types/api";
import { Clock, CheckCircle2, Truck, Check, XCircle, AlertTriangle } from "lucide-react";

interface OrderStatusBadgeProps {
  status: OrderStatus;
  size?: "sm" | "md";
}

export function OrderStatusBadge({ status, size = "sm" }: OrderStatusBadgeProps) {
  const normalized = status.toString();

  let colorClasses = "bg-stone-100 text-stone-700 border-stone-200";
  let icon = <Clock className="w-3 h-3" />;
  let burmeseLabel = "";

  switch (normalized) {
    case "Placed":
      colorClasses = "bg-amber-50 text-amber-800 border-amber-200";
      icon = <Clock className="w-3 h-3 text-amber-600" />;
      burmeseLabel = "စောင့်ဆိုင်းဆဲ";
      break;
    case "Accepted":
      colorClasses = "bg-sky-50 text-sky-800 border-sky-200";
      icon = <CheckCircle2 className="w-3 h-3 text-sky-600" />;
      burmeseLabel = "လက်ခံပြီး";
      break;
    case "Shipped":
      colorClasses = "bg-purple-50 text-purple-800 border-purple-200";
      icon = <Truck className="w-3 h-3 text-purple-600" />;
      burmeseLabel = "ပို့ဆောင်ဆဲ";
      break;
    case "Completed":
      colorClasses = "bg-emerald-50 text-emerald-800 border-emerald-200";
      icon = <Check className="w-3 h-3 text-emerald-600" />;
      burmeseLabel = "ပြီးမြောက်ပြီး";
      break;
    case "Cancelled":
      colorClasses = "bg-stone-100 text-stone-600 border-stone-200";
      icon = <XCircle className="w-3 h-3 text-stone-500" />;
      burmeseLabel = "ပယ်ဖျက်ပြီး";
      break;
    case "Disputed":
      colorClasses = "bg-rose-50 text-rose-800 border-rose-200";
      icon = <AlertTriangle className="w-3 h-3 text-rose-600" />;
      burmeseLabel = "အငြင်းပွားဆဲ";
      break;
  }

  const paddingClass = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border shadow-2xs ${paddingClass} ${colorClasses}`}
    >
      {icon}
      <span>{normalized}</span>
      {burmeseLabel && (
        <span className="opacity-75 font-normal text-[10px] myanmar-text">
          · {burmeseLabel}
        </span>
      )}
    </span>
  );
}
