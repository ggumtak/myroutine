"use client";

import { useState } from "react";
import { Product, TaskCard } from "@/lib/types";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, ChevronDown, ChevronUp, Sun, Moon, Droplets, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoutineCardProps {
  card: TaskCard;
  productLookup?: Record<string, Product>;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
  loading: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  skincare: "스킨케어",
  hygiene: "샤워",
  scalp: "두피 케어",
  mask: "마스크팩",
};

const SLOT_LABELS: Record<string, string> = {
  AM: "아침",
  PM: "저녁",
  SHOWER: "샤워",
  SUPP: "영양제",
};

const SLOT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  AM: Sun,
  PM: Moon,
  SHOWER: Droplets,
  SUPP: Sparkles,
};

const SLOT_COLORS: Record<string, string> = {
  AM: "from-amber-500/20 to-orange-500/20 border-amber-500/30",
  PM: "from-indigo-500/20 to-purple-500/20 border-indigo-500/30",
  SHOWER: "from-cyan-500/20 to-blue-500/20 border-cyan-500/30",
  SUPP: "from-emerald-500/20 to-green-500/20 border-emerald-500/30",
};

const SLOT_BADGE_COLORS: Record<string, string> = {
  AM: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  PM: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
  SHOWER: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  SUPP: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
};

// 액션 한글화 매핑
const ACTION_LABELS: Record<string, string> = {
  cleanse_optional: "세안 (선택)",
  apply_serum: "세럼 바르기",
  apply_sunscreen: "선크림 바르기",
  double_cleanse_if_needed: "이중 클렌징",
  optional_toner: "토너 (선택)",
  apply_cream: "크림 바르기",
  apply_products: "제품 바르기",
  shampoo: "샴푸하기",
  conditioner_on_hair: "컨디셔너 바르기",
  body_wash_or_brush_teeth: "바디워시 또는 양치",
  rinse_conditioner: "컨디셔너 헹구기",
  face_cleanse_last: "얼굴 세안 (마지막)",
  apply_scalp_tonic: "두피 토닉 바르기",
  keep_face_dry_initially: "얼굴 안 적시기",
  wet_scalp_only: "두피만 적시기",
  apply_scaler_massage_rinse: "스케일러 마사지 후 헹구기",
  optional_light_shampoo: "가볍게 샴푸 (선택)",
  conditioner_on_hair_then_body_wash: "컨디셔너 후 바디워시",
};

// 제품 ID → 한글 이름 매핑
const PRODUCT_NAMES: Record<string, string> = {
  toner_dr_sante_azulene: "상떼 아줄렌 수더 토너",
  serum_parnell_cicamanu_92: "파넬 시카마누 92세럼",
  serum_uiq_vita_c: "유이크 비타씨 잡티세럼",
  serum_parnell_niacinamide_high: "파넬 나이아신아마이드 20.35 세럼",
  ampoule_wellage_hyaluronic_blue_100: "웰라쥬 히알루로닉 블루 100 앰플",
  cream_minic_barrier: "미닉 장벽크림",
  cream_rovectin_ultra: "로벡틴 장벽크림",
  sunscreen_mediheal_madecassoside: "메디힐 마데카소사이드 선세럼",
  makeup_minic_cover_or_toneup: "미닉 톤업/커버 로션",
  allinone_minic_collard_green: "미닉 올인원",
  scalp_scaler_drforhair_poligen_seasalt_plus: "닥터포헤어 씨솔트+ 스케일러",
  scalp_tonic_labo_h: "라보에이치 두피토닉",
  extract_nano_recipe_bakuchiol_10000: "나노레시피 바쿠치올 원액",
  extract_nano_recipe_pdrn_100000: "나노레시피 PDRN 원액",
  extract_nano_recipe_azulene_cooling: "나노레시피 아줄렌 쿨링 원액",
};

function getProductName(productId: string, productLookup?: Record<string, Product>): string {
  const product = productLookup?.[productId];
  if (product?.name) return product.name;
  return PRODUCT_NAMES[productId] || productId.replace(/_/g, " ");
}

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action.replace(/_/g, " ");
}

export function RoutineCard({ card, onComplete, onSkip, loading, productLookup }: RoutineCardProps) {
  const [expanded, setExpanded] = useState(true);

  const title = `${SLOT_LABELS[card.slot] || card.slot} ${TYPE_LABELS[card.type] || card.type}`;
  const isDone = card.state === "completed";
  const isSkipped = card.state === "skipped";
  const SlotIcon = SLOT_ICONS[card.slot] || Sun;
  const slotColor = SLOT_COLORS[card.slot] || "";
  const badgeColor = SLOT_BADGE_COLORS[card.slot] || "";

  return (
    <Card
      className={cn(
        "w-full mb-4 transition-all duration-300 overflow-hidden",
        "bg-gradient-to-br border-2",
        slotColor,
        isDone && "opacity-60 scale-[0.98]",
        !isDone && !isSkipped && "hover:shadow-lg hover:scale-[1.01]"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            "bg-background/80 backdrop-blur-sm shadow-sm"
          )}>
            <SlotIcon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold">{title}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {card.steps.length}단계 루틴
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "font-semibold px-3 py-1",
            isDone && "bg-green-500/10 text-green-600 border-green-500/30",
            isSkipped && "bg-gray-500/10 text-gray-500 border-gray-500/30",
            !isDone && !isSkipped && badgeColor
          )}
        >
          {isDone ? "완료" : isSkipped ? "건너뜀" : "대기 중"}
        </Badge>
      </CardHeader>
      <CardContent className="pb-2">
        {expanded ? (
          <ul className="space-y-3">
            {card.steps.map((step, idx) => (
              <li
                key={idx}
                className={cn(
                  "flex gap-3 items-start p-3 rounded-lg transition-all",
                  "bg-background/60 backdrop-blur-sm"
                )}
              >
                <span className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                  "bg-primary/10 text-primary"
                )}>
                  {step.step}
                </span>
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {getActionLabel(step.action)}
                  </div>
                  {step.products.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {step.products.map((p) => (
                        <span
                          key={p}
                          className={cn(
                            "text-xs px-2 py-1 rounded-full",
                            "bg-primary/10 text-primary font-medium"
                          )}
                        >
                          {getProductName(p, productLookup)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground py-3 px-4 bg-background/40 rounded-lg">
            {card.steps.length}단계 숨김
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-3 h-8 text-xs hover:bg-background/60"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
          {expanded ? "접기" : "펼치기"}
        </Button>
      </CardContent>
      {card.state === "due" && (
        <CardFooter className="grid grid-cols-2 gap-3 pt-2 pb-4">
          <Button
            variant="outline"
            onClick={() => onSkip(card.taskInstanceId)}
            disabled={loading}
            className="h-11 text-sm font-medium hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/30"
          >
            <X className="h-4 w-4 mr-2" />
            건너뛰기
          </Button>
          <Button
            onClick={() => onComplete(card.taskInstanceId)}
            disabled={loading}
            className="h-11 text-sm font-medium bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="h-4 w-4 mr-2" />
            완료
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
