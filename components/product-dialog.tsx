"use client";

import { useEffect, useState } from "react";
import { Product, ProductCreate, ProductUpdate } from "@/lib/types";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { fetchClient } from "@/lib/api";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
  onSuccess: () => void;
}

export function ProductDialog({ open, onOpenChange, product, onSuccess }: ProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Product>>({
    id: "",
    name: "",
    category: "",
    role: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    if (product) {
      setFormData({ ...product });
    } else {
      setFormData({
        id: "",
        name: "",
        category: "",
        role: "",
        notes: "",
      });
    }
  }, [open, product]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      if (product) {
        const body: ProductUpdate = {
          name: formData.name,
          category: formData.category,
          role: formData.role,
          notes: formData.notes,
        };
        await fetchClient(`/api/products/${product.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        toast.success("제품을 수정했습니다.");
      } else {
        if (!formData.id) {
          toast.error("ID를 입력해주세요.");
          return;
        }
        const body: ProductCreate = {
          id: formData.id!,
          name: formData.name!,
          category: formData.category!,
          role: formData.role!,
          notes: formData.notes || "",
        };
        await fetchClient("/api/products", {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast.success("제품을 추가했습니다.");
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error("저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!product || !confirm("정말 삭제하시겠습니까?")) return;
    try {
      setLoading(true);
      await fetchClient(`/api/products/${product.id}`, { method: "DELETE" });
      toast.success("제품을 삭제했습니다.");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error("삭제에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const isEdit = !!product;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "제품 수정" : "새 제품 추가"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="id" className="text-right">
              ID
            </Label>
            <Input
              id="id"
              value={formData.id}
              onChange={(e) => setFormData((prev) => ({ ...prev, id: e.target.value }))}
              disabled={isEdit}
              className="col-span-3"
              placeholder="예: ampoule_vita_c"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              이름
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">
              카테고리
            </Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
              className="col-span-3"
              placeholder="예: ampoule"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">
              역할
            </Label>
            <Input
              id="role"
              value={formData.role}
              onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value }))}
              className="col-span-3"
              placeholder="예: daily_calm"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="notes" className="text-right">
              메모
            </Label>
            <Textarea
              id="notes"
              value={formData.notes || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between w-full">
          {isEdit && (
            <Button variant="destructive" onClick={handleDelete} disabled={loading} type="button">
              삭제
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
