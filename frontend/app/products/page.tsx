"use client";

import { useEffect, useState } from "react";
import { fetchClient } from "@/lib/api";
import { Product } from "@/lib/types";
import { BottomNav } from "@/components/bottom-nav";
import { ProductDialog } from "@/components/product-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.role.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b p-4 flex justify-between items-center">
                <h1 className="text-xl font-bold">화장품 보관함</h1>
                <Button size="icon" onClick={handleAdd}>
                    <Plus className="h-5 w-5" />
                </Button>
            </header>

            <main className="p-4 space-y-4">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="검색..."
                        className="pl-8"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {loading ? (
                        Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
                    ) : filteredProducts.length > 0 ? (
                        filteredProducts.map(product => (
                            <Card key={product.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleEdit(product)}>
                                <CardHeader className="p-4 pb-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <CardTitle className="text-base font-bold">{product.name}</CardTitle>
                                                {!product.is_active && <Badge variant="secondary" className="text-xs">비활성</Badge>}
                                            </div>
                                            <CardDescription className="text-xs mt-1">{product.id}</CardDescription>
                                        </div>
                                        <Badge variant="outline">{product.category}</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <div className="flex gap-2 text-sm text-muted-foreground">
                                        <span className="px-2 py-0.5 bg-secondary rounded text-secondary-foreground text-xs">
                                            {product.role}
                                        </span>
                                    </div>
                                    {product.notes && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{product.notes}</p>}
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <div className="text-center py-10 text-muted-foreground">
                            제품이 없습니다.
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
