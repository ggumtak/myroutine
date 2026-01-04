"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchClient } from "@/lib/api";
import { TimeResponse, TodayResponse, RulesResponse, TaskCard } from "@/lib/types";
import { RoutineCard } from "@/components/routine-card";
import { BottomNav } from "@/components/bottom-nav";
import { SettingsDialog } from "@/components/settings-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Home() {
  const [time, setTime] = useState<string>("");
  const [cards, setCards] = useState<TaskCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [lazyMode, setLazyMode] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [timeRes, todayRes, rulesRes] = await Promise.all([
        fetchClient("/api/time"),
        fetchClient("/api/today"),
        fetchClient("/api/rules")
      ]);

      setTime((timeRes as TimeResponse).nowKstIso);
      setCards((todayRes as TodayResponse).cards);
      setLazyMode((rulesRes as RulesResponse).conditions.lazy_mode || false);
    } catch (error) {
      console.error(error);
      toast.error("데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Refresh time every minute? or just rely on initial
    const interval = setInterval(() => {
      // Just updating the display time locally or refined fetch?
      // Let's just fetch simple time to keep it synced
      fetchClient("/api/time").then(res => setTime((res as TimeResponse).nowKstIso)).catch(() => { });
    }, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleAction = async (action: 'complete' | 'skip', id: string) => {
    try {
      setActionLoading(true);
      const endpoint = action === 'complete' ? '/api/complete' : '/api/skip';
      const body = action === 'complete'
        ? { taskInstanceId: id, completedAtIso: new Date().toISOString() }
        : { taskInstanceId: id, skippedAtIso: new Date().toISOString() };

      await fetchClient(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      toast.success(action === 'complete' ? "완료되었습니다!" : "건너뛰었습니다.");
      // Soft refresh cards
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
      setLazyMode(val); // Optimistic
      await fetchClient("/api/rules", {
        method: "PATCH",
        body: JSON.stringify({ conditions: { lazy_mode: val } })
      });
      toast.success(val ? "게으름 모드 켜짐 😴" : "게으름 모드 꺼짐 💪");
      // Refresh cards as they might change
      const todayRes = await fetchClient("/api/today");
      setCards((todayRes as TodayResponse).cards);
    } catch (error) {
      setLazyMode(!val); // Revert
      toast.error("설정 변경 실패");
    }
  };

  const completedCount = cards.filter(c => c.state === 'completed').length;
  const totalCount = cards.length;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b p-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">오눌의 루틴</h1>
          <p className="text-xs text-muted-foreground">
            {time ? new Date(time).toLocaleString('ko-KR', {
              month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit'
            }) : "로딩 중..."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SettingsDialog />
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-6">
        {/* Lazy Mode Toggle */}
        <div className="flex items-center justify-between bg-secondary/20 p-4 rounded-lg border">
          <Label htmlFor="lazy-mode" className="flex flex-col">
            <span className="font-semibold">게으름 모드</span>
            <span className="text-xs text-muted-foreground">최소한의 루틴만 진행합니다</span>
          </Label>
          <Switch
            id="lazy-mode"
            checked={lazyMode}
            onCheckedChange={toggleLazyMode}
          />
        </div>

        {/* Summary */}
        <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 text-center">
          <span className="text-sm text-muted-foreground">오늘 완료한 루틴</span>
          <div className="text-2xl font-bold text-primary">
            {completedCount} / {totalCount}
          </div>
        </div>

        {/* Cards */}
        <div className="space-y-4">
          {loading && cards.length === 0 ? (
            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)
          ) : cards.length > 0 ? (
            cards.map(card => (
              <RoutineCard
                key={card.taskInstanceId}
                card={card}
                onComplete={(id) => handleAction('complete', id)}
                onSkip={(id) => handleAction('skip', id)}
                loading={actionLoading}
              />
            ))
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              할 일이 없습니다! 🎉
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
