"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings2 } from "lucide-react";
import { getBaseUrl, setBaseUrl } from "@/lib/api";
import { toast } from "sonner";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (open) {
      setUrl(getBaseUrl());
    }
  }, [open]);

  const handleSave = () => {
    setBaseUrl(url);
    toast.success("API 주소가 저장되었습니다.");
    setOpen(false);
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="설정 열기">
          <Settings2 className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>설정</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>API 기본 주소 (Base URL)</Label>
            <Input
              placeholder="예: http://localhost:8000 (비워두면 현재 주소 사용)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              백엔드 서버 주소를 입력하세요. 변경 시 페이지가 새로고침됩니다.
            </p>
          </div>
          <Button onClick={handleSave} className="w-full">저장</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
