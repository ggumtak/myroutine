"use client";

import { useEffect, useState } from "react";
import { fetchClient } from "@/lib/api";
import { Product } from "@/lib/types";
import { BottomNav } from "@/components/bottom-nav";
import { ProductDialog } from "@/components/product-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, PackageOpen, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// 카테고리 한글화
const CATEGORY_LABELS: Record<string, string> = {
  toner: "토너",
  serum: "세럼",
  ampoule: "앰플/원액",
  cream: "크림",
  sunscreen: "선크림",
  makeup: "메이크업",
  all_in_one: "올인원",
  scalp: "두피 케어",
};

// 역할(role) 한글화
const ROLE_LABELS: Record<string, string> = {
  optional_soothing: "선택적 진정",
  daily_calm: "데일리 진정",
  am_brightening: "아침 브라이트닝",
  pm_active_high_niacinamide: "저녁 고농도 나이아신",
  hydration_boost_optional: "수분 부스터 (선택)",
  daily_barrier_main: "데일리 장벽 (메인)",
  barrier_backup: "장벽 (백업)",
  daily_spf_must: "데일리 자차 (필수)",
  optional_cosmetic: "꾸미기용 (선택)",
  lazy_fallback: "게으름 대체용",
  scalp_scale: "두피 스케일링",
  optional_active: "선택적 활성성분",
  optional_repair: "선택적 리페어",
  post_shower_tonic: "샤워 후 토닉",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>(undefined);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetchClient("/api/products");
      setProducts(res);
    } catch (error) {
      toast.error("제품 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedProduct(undefined);
    setDialogOpen(true);
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.role.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-24">
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b px-4 py-3 flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          제품 관리
        </h1>
        <Button size="icon" onClick={handleAdd} aria-label="제품 추가" className="bg-primary/10 hover:bg-primary/20">
          <Plus className="h-5 w-5" />
        </Button>
      </header>

      <main className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="제품 이름, 역할, 카테고리로 검색..."
            className="pl-10 h-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3">
          {loading ? (
            Array(4)
              .fill(0)
              .map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.01]"
                onClick={() => handleEdit(product)}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base font-bold">{product.name}</CardTitle>
                        {!product.is_active && (
                          <Badge variant="secondary" className="text-xs bg-red-100 text-red-600">
                            비활성
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="ml-2 shrink-0">
                      {CATEGORY_LABELS[product.category] || product.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex gap-2 flex-wrap">
                    <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                      {ROLE_LABELS[product.role] || product.role.replace(/_/g, " ")}
                    </span>
                  </div>
                  {product.notes && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{product.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border">
              <div className="flex flex-col items-center gap-2">
                <PackageOpen className="h-6 w-6 text-muted-foreground" />
                <p className="text-lg">제품이 없습니다</p>
              </div>
                <p className="text-sm mt-2">우측 상단 + 버튼으로 추가해보세요</p>
            </div>
          )}
        </div>
      </main>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={selectedProduct}
        onSuccess={fetchProducts}
      />
      <BottomNav />
    </div>
  );
}
