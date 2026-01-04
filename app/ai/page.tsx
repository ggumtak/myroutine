"use client";

import { useState, useEffect } from "react";
import { fetchClient } from "@/lib/api";
import { AiPatchResponse, Product, RulesResponse, TaskDefinition } from "@/lib/types";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles, Info, KeyRound, Cpu } from "lucide-react";
import * as jsonpatch from "fast-json-patch";

// AI 컨텍스트 정보
const AI_HELP_CONTEXT = `
역할
- 이 앱은 루틴(카드), 제품, 규칙을 관리하는 개인 루틴 매니저입니다.
- AI는 사용자의 지시를 현재 데이터에 반영하는 JSON Patch를 제안합니다.

출력 형식
{
  "jsonPatch": [ ...RFC6902... ],
  "summary": "변경 요약 또는 질문 답변"
}

가능한 수정 범위 (currentSpec)
- rules: 루틴 규칙 로직
- conditions: 피부 컨디션 토글
- products: 제품 목록 (추가/수정/비활성)
- taskDefinitions: 루틴 카드 정의 (추가/수정/삭제)

제품 카테고리 코드
- toner, serum, ampoule, cream, sunscreen, all_in_one, makeup, scalp

제품 역할 코드
- optional_soothing, daily_calm, am_brightening, pm_active_high_niacinamide
- hydration_boost_optional, daily_barrier_main, barrier_backup, daily_spf_must
- optional_cosmetic, lazy_fallback, scalp_scale, optional_active, optional_repair, post_shower_tonic

요청 예시
- "비타C 세럼 주 2회로 줄여줘"
- "새 토너 추가: 클레어스 수분토너"
- "저녁 고농도 나이아신은 4일 간격으로"
- "샤워 루틴에 두피 스케일러 단계 추가해줘"
`;

const AI_STORAGE_KEYS = {
  apiKey: "GEMINI_API_KEY",
  modelName: "GEMINI_MODEL_NAME",
};

const DEFAULT_MODEL_NAME = "gemini-3.0-flash";

export default function AiPage() {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [patchRes, setPatchRes] = useState<AiPatchResponse | null>(null);
  const [currentSpec, setCurrentSpec] = useState<RulesResponse | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [taskDefinitions, setTaskDefinitions] = useState<TaskDefinition[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState(DEFAULT_MODEL_NAME);
  const hasApiKey = apiKey.trim().length > 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedKey = window.localStorage.getItem(AI_STORAGE_KEYS.apiKey) || "";
    const storedModel = window.localStorage.getItem(AI_STORAGE_KEYS.modelName) || DEFAULT_MODEL_NAME;
    setApiKey(storedKey);
    setModelName(storedModel);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const rulesRes = await fetchClient("/api/rules");
        setCurrentSpec(rulesRes as RulesResponse);
      } catch (error) {
        toast.error("규칙 데이터를 불러오지 못했습니다.");
      }

      try {
        const productsRes = await fetchClient("/api/products");
        setProducts(productsRes as Product[]);
      } catch (error) {
        toast.error("제품 데이터를 불러오지 못했습니다.");
      }

      try {
        const taskRes = await fetchClient("/api/tasks");
        setTaskDefinitions(taskRes as TaskDefinition[]);
      } catch (error) {
        setTaskDefinitions([]);
      }
    }
    load();
  }, []);

  const handleSaveConfig = () => {
    if (typeof window === "undefined") return;
    const trimmedKey = apiKey.trim();
    const trimmedModel = modelName.trim() || DEFAULT_MODEL_NAME;

    if (trimmedKey) {
      window.localStorage.setItem(AI_STORAGE_KEYS.apiKey, trimmedKey);
    } else {
      window.localStorage.removeItem(AI_STORAGE_KEYS.apiKey);
    }

    window.localStorage.setItem(AI_STORAGE_KEYS.modelName, trimmedModel);
    setModelName(trimmedModel);
    toast.success("AI 설정을 저장했습니다.");
  };

  const handleGenerate = async () => {
    if (!instruction.trim()) {
      toast.error("지시어를 입력해주세요.");
      return;
    }
    if (!currentSpec) {
      toast.error("규칙 데이터를 불러오는 중입니다.");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        userInstruction: instruction,
        currentSpec: {
          rules: currentSpec.rules,
          conditions: currentSpec.conditions,
          products,
          taskDefinitions,
        },
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        ...(modelName.trim() ? { modelName: modelName.trim() } : {}),
      };

      const res = await fetchClient("/api/ai/patch", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setPatchRes(res);
    } catch (error) {
      toast.error("AI 제안 생성 실패");
    } finally {
      setLoading(false);
    }
  };

  const diffById = <T extends { id: string }>(before: T[], after: T[]) => {
    const beforeMap = new Map(before.map((item) => [item.id, item]));
    const afterMap = new Map(after.map((item) => [item.id, item]));
    const added: T[] = [];
    const updated: T[] = [];
    const removed: string[] = [];

    for (const [id, afterItem] of afterMap) {
      const beforeItem = beforeMap.get(id);
      if (!beforeItem) {
        added.push(afterItem);
      } else if (JSON.stringify(beforeItem) !== JSON.stringify(afterItem)) {
        updated.push(afterItem);
      }
    }

    for (const id of beforeMap.keys()) {
      if (!afterMap.has(id)) removed.push(id);
    }

    return { added, updated, removed };
  };

  const handleApply = async () => {
    if (!patchRes || !currentSpec) return;

    try {
      setLoading(true);
      if (patchRes.jsonPatch.length === 0) {
        toast.success(patchRes.summary || "변경사항이 없습니다.");
        setPatchRes(null);
        setInstruction("");
        return;
      }

      const document = {
        rules: currentSpec.rules,
        conditions: currentSpec.conditions,
        products,
        taskDefinitions,
      };
      const newDocument = jsonpatch.applyPatch(document, patchRes.jsonPatch).newDocument as typeof document;

      const nextRules = newDocument.rules ?? currentSpec.rules;
      const nextConditions = newDocument.conditions ?? currentSpec.conditions;
      const nextProducts = Array.isArray(newDocument.products) ? newDocument.products : products;
      const nextTaskDefinitions = Array.isArray(newDocument.taskDefinitions)
        ? newDocument.taskDefinitions
        : taskDefinitions;

      await fetchClient("/api/rules", {
        method: "PATCH",
        body: JSON.stringify({
          rules: nextRules,
          conditions: nextConditions,
        }),
      });

      const productDiff = diffById(products, nextProducts);
      for (const product of productDiff.added) {
        await fetchClient("/api/products", {
          method: "POST",
          body: JSON.stringify({
            id: product.id,
            name: product.name,
            category: product.category,
            role: product.role,
            notes: product.notes ?? undefined,
            verified: product.verified ?? {},
          }),
        });
      }

      for (const product of productDiff.updated) {
        await fetchClient(`/api/products/${product.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: product.name,
            category: product.category,
            role: product.role,
            notes: product.notes ?? null,
            verified: product.verified ?? {},
            is_active: product.is_active,
          }),
        });
      }

      for (const id of productDiff.removed) {
        await fetchClient(`/api/products/${id}`, { method: "DELETE" });
      }

      const taskDiff = diffById(taskDefinitions, nextTaskDefinitions);
      for (const task of taskDiff.added) {
        await fetchClient("/api/tasks", {
          method: "POST",
          body: JSON.stringify({
            id: task.id,
            slot: task.slot,
            type: task.type,
            steps: task.steps,
            interval_days: task.interval_days,
            cron_weekdays: task.cron_weekdays,
          }),
        });
      }

      for (const task of taskDiff.updated) {
        await fetchClient(`/api/tasks/${task.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            slot: task.slot,
            type: task.type,
            steps: task.steps,
            interval_days: task.interval_days,
            cron_weekdays: task.cron_weekdays,
          }),
        });
      }

      for (const id of taskDiff.removed) {
        await fetchClient(`/api/tasks/${id}`, { method: "DELETE" });
      }

      const updatedRules = await fetchClient("/api/rules");
      setCurrentSpec(updatedRules as RulesResponse);

      const updatedProducts = await fetchClient("/api/products");
      setProducts(updatedProducts as Product[]);

      try {
        const updatedTasks = await fetchClient("/api/tasks");
        setTaskDefinitions(updatedTasks as TaskDefinition[]);
      } catch (error) {
        setTaskDefinitions(nextTaskDefinitions);
      }

      toast.success("변경사항을 적용했습니다!");
      setPatchRes(null);
      setInstruction("");
    } catch (error) {
      console.error(error);
      toast.error("변경사항 적용 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-emerald-500" />
          AI 루틴 수정
        </h1>
      </header>

      <main className="p-4 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">AI 설정</CardTitle>
              <Badge variant={hasApiKey ? "secondary" : "outline"}>
                {hasApiKey ? "키 저장됨" : "키 없음"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ai-api-key" className="flex items-center gap-2 text-xs">
                <KeyRound className="h-4 w-4" />
                Gemini API Key
              </Label>
              <Input
                id="ai-api-key"
                type="password"
                placeholder="AIza..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-model-name" className="flex items-center gap-2 text-xs">
                <Cpu className="h-4 w-4" />
                모델 이름
              </Label>
              <Input
                id="ai-model-name"
                placeholder={DEFAULT_MODEL_NAME}
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              API 키는 브라우저 로컬스토리지에 저장됩니다. 백엔드가 필요하면 상단 설정에서 API 주소를
              지정하세요.
            </p>
            <Button variant="secondary" className="w-full" onClick={handleSaveConfig}>
              설정 저장
            </Button>
          </CardContent>
        </Card>

        {/* 도움말 토글 */}
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="w-full flex items-center justify-between px-3 py-2 bg-emerald-500/10 rounded-lg text-sm text-emerald-600 hover:bg-emerald-500/20 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            AI가 이해하는 것들 보기
          </span>
          <span>{showHelp ? "접기" : "펼치기"}</span>
        </button>

        {showHelp && (
          <Card className="bg-muted/30">
            <CardContent className="p-4 text-sm whitespace-pre-line text-muted-foreground">
              {AI_HELP_CONTEXT}
            </CardContent>
          </Card>
        )}

        {/* 입력 영역 */}
        <div className="space-y-3">
          <Textarea
            placeholder="예: 비타C를 주 2회로 줄여줘"
            className="min-h-[100px] text-base"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />

          <Button className="w-full" onClick={handleGenerate} disabled={loading || !currentSpec}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            AI 제안 생성
          </Button>
        </div>

        {/* 결과 */}
        {patchRes && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">제안된 변경사항</h2>
              <Badge variant="secondary">미리보기</Badge>
            </div>

            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm">{patchRes.summary}</CardTitle>
                <CardDescription className="text-xs">
                  아래 패치를 적용하면 데이터가 변경됩니다
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs font-mono bg-muted/30 p-3 max-h-[200px] overflow-auto">
                {patchRes.jsonPatch.length === 0 ? (
                  <span className="text-muted-foreground">변경사항 없음</span>
                ) : (
                  patchRes.jsonPatch.map((op, i) => (
                    <div key={i} className="flex gap-2 mb-1">
                      <span
                        className={
                          op.op === "replace"
                            ? "text-blue-500"
                            : op.op === "add"
                              ? "text-green-500"
                              : "text-red-500"
                        }
                      >
                        {op.op.toUpperCase()}
                      </span>
                      <span className="text-muted-foreground truncate">{op.path}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Button className="w-full" onClick={handleApply} disabled={loading}>
              변경사항 적용하기
            </Button>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
