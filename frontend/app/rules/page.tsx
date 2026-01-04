"use client";

import { useEffect, useState } from "react";
import { fetchClient } from "@/lib/api";
import { RulesResponse } from "@/lib/types";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export default function RulesPage() {
    const [data, setData] = useState<RulesResponse | null>(null);
    const [rulesJson, setRulesJson] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                const res = await fetchClient("/api/rules");
                setData(res);
                setRulesJson(JSON.stringify(res.rules, null, 2));
            } catch (error) {
                toast.error("규칙을 불러오지 못했습니다.");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const handleConditionToggle = (key: string, val: boolean) => {
        if (!data) return;
        setData({
            ...data,
            conditions: {
                ...data.conditions,
                [key]: val,
            },
        });
    };

    const handleSave = async () => {
        if (!data) return;
        try {
            setSaving(true);
            let parsedRules;
            try {
                parsedRules = JSON.parse(rulesJson);
            } catch (e) {
                toast.error("규칙 JSON 형식이 올바르지 않습니다.");
                setSaving(false);
                return;
            }

            await fetchClient("/api/rules", {
                method: 'PATCH',
                body: JSON.stringify({
                    rules: parsedRules,
                    conditions: data.conditions,
                })
            });
            toast.success("저장되었습니다.");
        } catch (error) {
            toast.error("저장 실패.");
        } finally {
            setSaving(false);
        }
    };

    const CONDITION_LABELS: Record<string, string> = {
        sensitive: "민감성 (Sensitive)",
        irritated: "자극받음 (Irritated)",
        dry: "건조함 (Dry)",
        trouble: "트러블 (Trouble)",
        need_extra_hydration: "수분 보충 필요",
        lazy_mode: "게으름 모드 (Lazy)",
    };

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b p-4 flex justify-between items-center">
                <h1 className="text-xl font-bold">규칙 설정</h1>
                <Button onClick={handleSave} disabled={loading || saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    저장
                </Button>
            </header>

            <main className="p-4 space-y-6">
                {loading ? (
                    <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : data ? (
                    <>
                        <section className="space-y-4">
                            <h2 className="text-lg font-semibold">상태 조건 (Conditions)</h2>
                            <div className="grid grid-cols-1 gap-4 bg-card border rounded-lg p-4">
                                {Object.entries(data.conditions).map(([key, val]) => (
                                    <div key={key} className="flex items-center justify-between">
                                        <Label htmlFor={key} className="flex flex-col">
                                            <span>{CONDITION_LABELS[key] || key}</span>
                                        </Label>
                                        <Switch
                                            id={key}
                                            checked={val}
                                            onCheckedChange={(c) => handleConditionToggle(key, c)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-lg font-semibold">규칙 JSON (Rules)</h2>
                            <div className="relative">
                                <Textarea
                                    className="font-mono text-xs min-h-[400px] leading-relaxed"
                                    value={rulesJson}
                                    onChange={(e) => setRulesJson(e.target.value)}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                JSON 문법을 준수하여 수정해주세요. 잘못된 형식은 저장되지 않습니다.
                            </p>
                        </section>
                    </>
                ) : null}
            </main>

            <BottomNav />
        </div>
    );
}
