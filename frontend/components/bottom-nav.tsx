"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Package, Settings2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
    const pathname = usePathname();

    const items = [
        { href: "/", label: "홈", icon: Home },
        { href: "/calendar", label: "달력", icon: Calendar },
        { href: "/products", label: "제품", icon: Package },
        { href: "/rules", label: "규칙", icon: Settings2 },
        { href: "/ai", label: "AI", icon: Sparkles },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 border-t bg-background p-2 pb-safe">
            <div className="flex justify-around items-center">
                {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[60px]",
                                isActive
                                    ? "text-primary font-bold bg-muted/50"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Icon className="h-5 w-5" />
                            <span className="text-xs">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
