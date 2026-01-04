"use client";

import { useState } from "react";
import { TaskCard } from "@/lib/types";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoutineCardProps {
    card: TaskCard;
    onComplete: (id: string) => void;
    onSkip: (id: string) => void;
    loading: boolean;
}

const TYPE_LABELS: Record<string, string> = {
    skincare: "스킨케어",
    shower: "샤워",
    scalp: "두피 관리",
    mask: "마스크팩",
    // add more as needed
};

const SLOT_LABELS: Record<string, string> = {
    AM: "오전",
    PM: "오후",
    SHOWER: "샤워 시",
};

export function RoutineCard({ card, onComplete, onSkip, loading }: RoutineCardProps) {
    const [expanded, setExpanded] = useState(true);

    const title = `${SLOT_LABELS[card.slot] || card.slot} ${TYPE_LABELS[card.type] || card.type}`;
    const isDone = card.state === 'completed';
    const isSkipped = card.state === 'skipped';

    return (
        <Card className={cn("w-full mb-4 transition-all", isDone && "opacity-60 bg-muted/30")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-bold">{title}</CardTitle>
                <Badge variant={isDone ? "default" : isSkipped ? "secondary" : "outline"}>
                    {isDone ? "완료됨" : isSkipped ? "건너뜀" : "진행 중"}
                </Badge>
            </CardHeader>
            <CardContent>
                {expanded ? (
                    <ul className="space-y-3">
                        {card.steps.map((step, idx) => (
                            <li key={idx} className="text-sm flex gap-2 items-start">
                                <span className="font-mono text-muted-foreground w-4">{step.step}.</span>
                                <div className="flex-1">
                                    <div className="font-medium">{step.action.replace(/_/g, " ")}</div>
                                    {step.products.length > 0 && (
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            {step.products.map(p => p.replace(/_/g, " ")).join(", ")}
                                        </div>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-sm text-muted-foreground">
                        {card.steps.length}단계 숨겨짐
                    </div>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 h-6 text-xs"
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                    {expanded ? "접기" : "펼치기"}
                </Button>
            </CardContent>
            {card.state === 'due' && (
                <CardFooter className="grid grid-cols-2 gap-2 pt-0">
                    <Button
                        variant="outline"
                        onClick={() => onSkip(card.taskInstanceId)}
                        disabled={loading}
                    >
                        <X className="h-4 w-4 mr-2" />
                        건너뛰기
                    </Button>
                    <Button
                        onClick={() => onComplete(card.taskInstanceId)}
                        disabled={loading}
                    >
                        <Check className="h-4 w-4 mr-2" />
                        완료
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
