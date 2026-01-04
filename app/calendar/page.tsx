"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchClient } from "@/lib/api";
import { Product, TodayResponse, TaskCard } from "@/lib/types";
import { CompactRoutineCard } from "@/components/compact-routine-card";
import { BottomNav } from "@/components/bottom-nav";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { buildProductLookup } from "@/lib/product-display";

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [cards, setCards] = useState<TaskCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  const productLookup = useMemo(() => buildProductLookup(products), [products]);

  useEffect(() => {
    async function fetchData() {
      if (!date) return;
      try {
        setLoading(true);
        const dateStr = format(date, "yyyy-MM-dd");
        const res = await fetchClient(`/api/today?date=${dateStr}`);
        setCards((res as TodayResponse).cards);
      } catch (error) {
        toast.error("데이터를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [date]);

  useEffect(() => {
    fetchClient("/api/products")
      .then((res) => setProducts(res as Product[]))
      .catch(() => {
        toast.error("제품 정보를 불러오지 못했습니다.");
      });
  }, []);

  const handleAction = async (action: "complete" | "skip", id: string) => {
    try {
      const endpoint = action === "complete" ? "/api/complete" : "/api/skip";
      const body =
        action === "complete"
          ? { taskInstanceId: id, completedAtIso: new Date().toISOString() }
          : { taskInstanceId: id, skippedAtIso: new Date().toISOString() };

      await fetchClient(endpoint, { method: "POST", body: JSON.stringify(body) });
      toast.success(action === "complete" ? "완료했습니다." : "건너뛰었습니다.");
      const dateStr = format(date!, "yyyy-MM-dd");
      const res = await fetchClient(`/api/today?date=${dateStr}`);
      setCards((res as TodayResponse).cards);
    } catch (error) {
      toast.error("요청 처리에 실패했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b p-4">
        <h1 className="text-xl font-bold">캘린더</h1>
      </header>

      <main className="p-4 flex flex-col items-center space-y-6">
        <div className="bg-card rounded-lg border shadow-sm p-4 w-full flex justify-center">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            locale={ko}
            className="rounded-md border"
          />
        </div>

        <div className="w-full space-y-4">
          <h2 className="text-lg font-semibold">
            {date ? format(date, "yyyy년 M월 d일 (EEE)", { locale: ko }) : "날짜 선택"}
          </h2>

          {loading ? (
            Array(3)
              .fill(0)
              .map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)
          ) : cards.length > 0 ? (
            cards.map((card) => (
              <CompactRoutineCard
                key={card.taskInstanceId}
                card={card}
                onComplete={(id) => handleAction("complete", id)}
                onSkip={(id) => handleAction("skip", id)}
                loading={loading}
                productLookup={productLookup}
              />
            ))
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              해당 날짜의 기록이 없습니다.
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
