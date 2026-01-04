"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { fetchClient } from "@/lib/api";
import { TimeResponse, TodayResponse, RulesResponse, TaskCard, Product } from "@/lib/types";
import { BottomNav } from "@/components/bottom-nav";
import { SettingsDialog } from "@/components/settings-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RoutineCard } from "@/components/routine-card";
import { buildProductLookup } from "@/lib/product-display";

// 스킨케어 카테고리 (TH 순서)
const SKINCARE_CATEGORIES = ["toner", "ampoule", "cream", "sunscreen", "all_in_one"];
const SKINCARE_LABELS: Record<string, string> = {
  toner: "토너",
  ampoule: "앰플",
  cream: "크림",
  sunscreen: "선크림",
  all_in_one: "올인원",
};

// 헤어케어 카테고리
const HAIRCARE_CATEGORIES = ["scalp"];
const HAIRCARE_LABELS: Record<string, string> = {
  scalp: "두피",
};

export default function Home() {
  const [time, setTime] = useState<string>("");
  const [cards, setCards] = useState<TaskCard[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [lazyMode, setLazyMode] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // 오늘 사용할 제품 ID 추출
  const todayProductIds = useMemo(() => {
    const ids = new Set<string>();
    cards.forEach((card) => {
      card.steps.forEach((step) => {
        step.products.forEach((p) => ids.add(p));
      });
    });
    return ids;
  }, [cards]);

  // 카테고리별 제품 그룹화
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, Product[]> = {};
    products.filter(p => p.is_active !== false).forEach((product) => {
      const cat = product.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(product);
    });
    return grouped;
  }, [products]);

  const productLookup = useMemo(() => buildProductLookup(products), [products]);

  // 가장 긴 카테고리의 제품 수 (테이블 행 개수)
  const maxSkincareRows = useMemo(() => {
    return Math.max(...SKINCARE_CATEGORIES.map(cat => productsByCategory[cat]?.length || 0), 1);
  }, [productsByCategory]);

  const maxHaircareRows = useMemo(() => {
    return Math.max(...HAIRCARE_CATEGORIES.map(cat => productsByCategory[cat]?.length || 0), 1);
  }, [productsByCategory]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [timeRes, todayRes, rulesRes, productsRes] = await Promise.all([
        fetchClient("/api/time"),
        fetchClient("/api/today"),
        fetchClient("/api/rules"),
        fetchClient("/api/products"),
      ]);

      setTime((timeRes as TimeResponse).nowKstIso);
      setCards((todayRes as TodayResponse).cards);
      setLazyMode((rulesRes as RulesResponse).conditions.lazy_mode || false);
      setProducts(productsRes as Product[]);
    } catch (error) {
      console.error(error);
      toast.error("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      fetchClient("/api/time")
        .then((res) => setTime((res as TimeResponse).nowKstIso))
        .catch(() => { });
    }, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleAction = async (action: "complete" | "skip", id: string) => {
    try {
      setActionLoading(true);
      const endpoint = action === "complete" ? "/api/complete" : "/api/skip";
      const body =
        action === "complete"
          ? { taskInstanceId: id, completedAtIso: new Date().toISOString() }
          : { taskInstanceId: id, skippedAtIso: new Date().toISOString() };

      await fetchClient(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      toast.success(action === "complete" ? "완료!" : "건너뜀");
      const todayRes = await fetchClient("/api/today");
      setCards((todayRes as TodayResponse).cards);
    } catch (error) {
      toast.error("요청 처리에 실패했습니다.");
    } finally {
      setActionLoading(false);
    }
  };

  const toggleLazyMode = async (val: boolean) => {
    try {
      setLazyMode(val);
      await fetchClient("/api/rules", {
        method: "PATCH",
        body: JSON.stringify({ conditions: { lazy_mode: val } }),
      });
      toast.success(val ? "게으름 모드 ON" : "게으름 모드 OFF");
      const todayRes = await fetchClient("/api/today");
      setCards((todayRes as TodayResponse).cards);
    } catch (error) {
      setLazyMode(!val);
      toast.error("설정 변경 실패");
    }
  };

  const completedCount = cards.filter((c) => c.state === "completed").length;
  const totalCount = cards.length;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">오늘의 루틴</h1>
          <p className="text-xs text-muted-foreground">
            {time
              ? new Date(time).toLocaleString("ko-KR", {
                month: "long",
                day: "numeric",
                weekday: "short",
              })
              : "로딩 중..."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xl font-bold text-primary">{completedCount}/{totalCount}</div>
          <SettingsDialog />
        </div>
      </header>

      <main className="p-3 space-y-4">
        {/* 게으름 모드 토글 */}
        <div className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-lg">
          <Label htmlFor="lazy-mode" className="text-sm">게으름 모드</Label>
          <Switch id="lazy-mode" checked={lazyMode} onCheckedChange={toggleLazyMode} />
        </div>

        {/* 오늘의 루틴 */}
        <section>
          <h2 className="text-sm font-bold mb-2">오늘의 루틴</h2>
          {loading ? (
            <div className="space-y-3">
              {Array(2)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-40 w-full rounded-xl" />
                ))}
            </div>
          ) : cards.length > 0 ? (
            <div className="space-y-3">
              {cards.map((card) => (
                <RoutineCard
                  key={card.taskInstanceId}
                  card={card}
                  onComplete={(id) => handleAction("complete", id)}
                  onSkip={(id) => handleAction("skip", id)}
                  loading={actionLoading}
                  productLookup={productLookup}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground bg-muted/30 rounded-xl text-sm">
              오늘 할 일이 없습니다!
            </div>
          )}
        </section>

        {/* 스킨케어 제품 테이블 */}
        <section>
          <h2 className="text-sm font-bold mb-2">스킨케어 제품</h2>
          {loading ? (
            <Skeleton className="h-20 w-full rounded-lg" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/70">
                    {SKINCARE_CATEGORIES.map((cat) => (
                      <th key={cat} className="px-2 py-1.5 text-center font-semibold border-r last:border-0">
                        {SKINCARE_LABELS[cat]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxSkincareRows }).map((_, rowIdx) => (
                    <tr key={rowIdx} className="border-t">
                      {SKINCARE_CATEGORIES.map((cat) => {
                        const product = productsByCategory[cat]?.[rowIdx];
                        if (!product) {
                          return <td key={cat} className="px-2 py-1.5 text-center border-r last:border-0">-</td>;
                        }
                        const isActive = todayProductIds.has(product.id);
                        return (
                          <td
                            key={cat}
                            className={cn(
                              "px-2 py-1.5 text-center border-r last:border-0 transition-all",
                              isActive
                                ? "bg-primary text-primary-foreground font-bold"
                                : "text-muted-foreground"
                            )}
                          >
                            {product.name}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 헤어케어 제품 테이블 */}
        {!loading && HAIRCARE_CATEGORIES.some(cat => productsByCategory[cat]?.length > 0) && (
          <section>
            <h2 className="text-sm font-bold mb-2">헤어케어 제품</h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/70">
                    {HAIRCARE_CATEGORIES.map((cat) => (
                      <th key={cat} className="px-2 py-1.5 text-center font-semibold">
                        {HAIRCARE_LABELS[cat]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxHaircareRows }).map((_, rowIdx) => (
                    <tr key={rowIdx} className="border-t">
                      {HAIRCARE_CATEGORIES.map((cat) => {
                        const product = productsByCategory[cat]?.[rowIdx];
                        if (!product) {
                          return <td key={cat} className="px-2 py-1.5 text-center">-</td>;
                        }
                        const isActive = todayProductIds.has(product.id);
                        return (
                          <td
                            key={cat}
                            className={cn(
                              "px-2 py-1.5 text-center transition-all",
                              isActive
                                ? "bg-primary text-primary-foreground font-bold"
                                : "text-muted-foreground"
                            )}
                          >
                            {product.name}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
