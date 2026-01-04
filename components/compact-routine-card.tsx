"use client";

import type { Product, TaskCard } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Sun, Moon, Droplets, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDetailedCategoryLabel, getProductName } from "@/lib/product-display";

interface CompactRoutineCardProps {
  card: TaskCard;
  productLookup?: Record<string, Product>;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
  loading: boolean;
}

const SLOT_INFO: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  AM: { label: "아침", icon: Sun, color: "bg-amber-500" },
  PM: { label: "저녁", icon: Moon, color: "bg-indigo-500" },
  SHOWER: { label: "샤워", icon: Droplets, color: "bg-cyan-500" },
  SUPP: { label: "영양제", icon: Sparkles, color: "bg-emerald-500" },
};

const ACTION_LABELS: Record<string, string> = {
  cleanse_optional: "세안",
  apply_serum: "앰플",
  apply_sunscreen: "선크림",
  double_cleanse_if_needed: "클렌징",
  optional_toner: "토너",
  apply_toner: "토너",
  apply_cream: "크림",
  apply_products: "제품",
  shampoo: "샴푸",
  conditioner_on_hair: "컨디셔너",
  body_wash_or_brush_teeth: "바디워시",
  rinse_conditioner: "헹굼",
  face_cleanse_last: "세안",
  apply_scalp_tonic: "두피토닉",
  keep_face_dry_initially: "얼굴X",
  wet_scalp_only: "두피적심",
  apply_scaler_massage_rinse: "스케일러",
  optional_light_shampoo: "샴푸",
  conditioner_on_hair_then_body_wash: "컨디셔너",
};

export function CompactRoutineCard({
  card,
  productLookup,
  onComplete,
  onSkip,
  loading,
}: CompactRoutineCardProps) {
  const slotInfo = SLOT_INFO[card.slot];
  const isDone = card.state === "completed";
  const isSkipped = card.state === "skipped";
  const SlotIcon = slotInfo?.icon || Sun;

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden transition-all",
        isDone && "opacity-50"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between px-3 py-1.5",
          slotInfo?.color || "bg-gray-500",
          "text-white"
        )}
      >
        <div className="flex items-center gap-2">
          <SlotIcon className="h-4 w-4" />
          <span className="font-semibold text-sm">{slotInfo?.label || card.slot}</span>
        </div>
        <Badge variant="outline" className="text-white border-white/50 text-xs px-2 py-0">
          {isDone ? "완료" : isSkipped ? "스킵" : "대기"}
        </Badge>
      </div>

      <div className="p-3 bg-card">
        <table className="w-full text-sm">
          <tbody>
            {card.steps.map((step, idx) => {
              const productNames =
                step.products.length > 0
                  ? step.products.map((p) => getProductName(p, productLookup)).join(", ")
                  : "-";

              const categoryLabels =
                step.products.length > 0
                  ? step.products
                      .map((p) => getDetailedCategoryLabel(productLookup?.[p]))
                      .filter((label) => label && label !== "-")
                      .join(", ") || (ACTION_LABELS[step.action] || step.action)
                  : ACTION_LABELS[step.action] || step.action;

              return (
                <tr key={idx} className="border-b last:border-0 border-muted">
                  <td className="py-1 pr-2 text-muted-foreground w-5 text-xs">
                    {step.step}
                  </td>
                  <td className="py-1 font-medium text-xs text-left">
                    {productNames}
                  </td>
                  <td className="py-1 text-right text-xs text-muted-foreground w-24">
                    {categoryLabels || "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {card.state === "due" && (
          <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSkip(card.taskInstanceId)}
              disabled={loading}
            >
              <X className="h-3 w-3 mr-1" />
              건너뛰기
            </Button>
            <Button
              size="sm"
              onClick={() => onComplete(card.taskInstanceId)}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="h-3 w-3 mr-1" />
              완료
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
