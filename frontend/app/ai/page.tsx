"use client";

import { useState, useEffect } from "react";
import { fetchClient } from "@/lib/api";
import { AiPatchResponse, JsonPatchOperation, RulesResponse } from "@/lib/types";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import * as jsonpatch from "fast-json-patch";

export default function AiPage() {
    const [instruction, setInstruction] = useState("");
    const [loading, setLoading] = useState(false);
    const [patchRes, setPatchRes] = useState<AiPatchResponse | null>(null);
    const [currentSpec, setCurrentSpec] = useState<{ rules: any, conditions: any } | null>(null);

    useEffect(() => {
        // Load current rules on mount to be ready
        fetchClient("/api/rules").then(res => setCurrentSpec(res));
    }, []);

    const handleGenerate = async () => {
        if (!instruction.trim()) {
            toast.error("지시사항을 입력해주세요.");
            return;
        }
        if (!currentSpec) {
            toast.error("규칙 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
            return;
        }

        try {
            setLoading(true);
            const res = await fetchClient("/api/ai/patch", {
                method: 'POST',
                body: JSON.stringify({
                    userInstruction: instruction,
                    currentSpec: { rules: currentSpec.rules } // Only sending rules for now
                })
            });
            setPatchRes(res);
        } catch (error) {
            toast.error("AI 제안 생성 실패.");
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async () => {
        if (!patchRes || !currentSpec) return;

        try {
            setLoading(true);
            // Prepare base document
            const document = { rules: currentSpec.rules };

            // Apply patch
            const newDocument = jsonpatch.applyPatch(document, patchRes.jsonPatch).newDocument;

            // Save new rules
            // Note: patch might only touch rules, conditions are separate usually, but let's see.
            // If path is /rules/..., it modifies rules object.
            await fetchClient("/api/rules", {
                method: 'PATCH',
                body: JSON.stringify({
                    rules: newDocument.rules,
                    conditions: currentSpec.conditions // Keep existing conditions
                })
            });

            toast.success("규칙이 적용되었습니다.");
            setPatchRes(null);
            setInstruction("");
            // Reload spec
            const updated = await fetchClient("/api/rules");
            setCurrentSpec(updated);
        } catch (error) {
            console.error(error);
            toast.error("규칙 적용 실패. (호환되지 않는 패치일 수 있습니다)");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b p-4">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    AI 루틴 수정
                </h1>
            </header>

            <main className="p-4 space-y-6">
                <div className="space-y-4">
                    <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground">
                        <p>💡 원하는 루틴 변경사항을 자연어로 입력하세요.</p>
                        <p>"비타민 C 앰플을 이틀에 한 번만 바르고 싶어"</p>
                        <p>"주말에는 스킨케어 단계를 줄여줘"</p>
                    </div>

                    <Textarea
                        placeholder="지시사항을 입력하세요..."
                        className="min-h-[100px] text-base"
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                    />

                    <Button className="w-full" onClick={handleGenerate} disabled={loading || !currentSpec}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        AI 제안 생성
                    </Button>
                </div>

                {patchRes && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">제안된 변경사항</h2>
                            <Badge variant="secondary">Preview</Badge>
                        </div>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">{patchRes.summary}</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm font-mono bg-muted/30 p-4 max-h-[300px] overflow-auto">
                                {patchRes.jsonPatch.map((op, i) => (
                                    <div key={i} className="flex gap-2 mb-2 break-all">
                                        <span className={op.op === 'replace' ? 'text-blue-500' : op.op === 'add' ? 'text-green-500' : 'text-red-500'}>
                                            {op.op.toUpperCase()}
                                        </span>
                                        <span className="text-muted-foreground">{op.path}</span>
                                        {op.value !== undefined && (
                                            <span>Wait value: {JSON.stringify(op.value).slice(0, 20)}...</span>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Button className="w-full" variant="default" onClick={handleApply} disabled={loading}>
                            변경사항 적용하기
                        </Button>
                    </div>
                )}
            </main>

            <BottomNav />
        </div>
    );
}
