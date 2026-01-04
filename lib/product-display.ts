import type { Product } from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  toner: "토너",
  serum: "세럼",
  ampoule: "앰플",
  cream: "크림",
  sunscreen: "선크림",
  all_in_one: "올인원",
  makeup: "메이크업",
  scalp: "두피",
};

const ROLE_DETAIL_OVERRIDES: Record<string, string> = {
  optional_cosmetic: "메이크업",
  lazy_fallback: "올인원",
  scalp_scale: "두피스케일러",
  post_shower_tonic: "두피토닉",
};

const ROLE_DETAIL_PREFIXES: Record<string, string> = {
  optional_soothing: "진정",
  daily_calm: "진정",
  hydration_boost_optional: "수분",
  daily_barrier_main: "장벽",
  barrier_backup: "장벽",
  am_brightening: "브라이트닝",
  pm_active_high_niacinamide: "고농도",
  daily_spf_must: "자차",
  optional_active: "액티브",
  optional_repair: "리페어",
};

export function buildProductLookup(products: Product[]) {
  return products.reduce<Record<string, Product>>((acc, product) => {
    acc[product.id] = product;
    return acc;
  }, {});
}

export function getProductName(productId: string, lookup?: Record<string, Product>): string {
  const product = lookup?.[productId];
  if (product?.name) return product.name;
  return productId.replace(/_/g, " ");
}

export function getDetailedCategoryLabel(product?: Product): string {
  if (!product) return "-";
  const override = ROLE_DETAIL_OVERRIDES[product.role];
  if (override) return override;
  const categoryLabel = CATEGORY_LABELS[product.category] || product.category;
  const prefix = ROLE_DETAIL_PREFIXES[product.role];
  if (!prefix) return categoryLabel;
  return `${prefix}${categoryLabel}`;
}
