import seedData from "@/spec/seed.json";
import type {
  AiPatchResponse,
  CompleteRequest,
  DeleteResponse,
  Product,
  ProductCreate,
  ProductUpdate,
  RulesResponse,
  SkipRequest,
  TaskDefinition,
  TaskDefinitionCreate,
  TaskDefinitionUpdate,
  TaskCard,
  TodayResponse,
} from "@/lib/types";

const STORAGE_KEYS = {
  products: "routine_products",
  rules: "routine_rules",
  conditions: "routine_conditions",
  taskDefinitions: "routine_task_definitions",
  taskStatuses: "routine_task_statuses",
  ruleUsage: "routine_rule_usage",
};

const RULE_KEY_AM_VITC = "am_vitc";
const RULE_KEY_PM_HIGH_NIACIN = "pm_high_niacin";

const DEFAULT_CONDITIONS: Record<string, boolean> = {
  sensitive: false,
  irritated: false,
  dry: false,
  trouble: false,
  need_extra_hydration: false,
  lazy_mode: false,
};

const SLOT_PRIORITY: Record<string, number> = {
  AM: 0,
  PM: 1,
  SHOWER: 2,
  SCALP: 3,
  SUPP: 4,
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getSeedProducts(): Product[] {
  return (seedData as any).products.map((product: any) => ({
    ...product,
    is_active: product.is_active ?? true,
  }));
}

function getProducts(): Product[] {
  const products = readStorage<Product[]>(STORAGE_KEYS.products, getSeedProducts());
  let updated = false;
  const nextProducts = products.map((product) => {
    if (product.category === "serum") {
      updated = true;
      return { ...product, category: "ampoule" };
    }
    return product;
  });
  if (updated) {
    saveProducts(nextProducts);
  }
  return nextProducts;
}

function saveProducts(products: Product[]) {
  writeStorage(STORAGE_KEYS.products, products);
}

function getSeedTaskDefinitions(): TaskDefinition[] {
  return (seedData as any).taskDefinitions || [];
}

function getTaskDefinitions(): TaskDefinition[] {
  const taskDefinitions = readStorage<TaskDefinition[]>(
    STORAGE_KEYS.taskDefinitions,
    getSeedTaskDefinitions()
  );
  let updated = false;

  const nextDefinitions = taskDefinitions.map((task) => {
    if (task.id === "skin_am") {
      const actions = (task.steps || []).map((step) => step.action);
      const needsUpdate =
        actions.includes("cleanse_optional") ||
        actions.includes("apply_toner") ||
        !actions.includes("apply_cream");
      if (needsUpdate) {
        updated = true;
        return {
          ...task,
          steps: [
            { step: 1, action: "apply_serum", productSelector: "rule_based_serum_am" },
            { step: 2, action: "apply_cream", products: ["cream_minic_barrier"] },
            { step: 3, action: "apply_sunscreen", products: ["sunscreen_mediheal_madecassoside"] },
          ],
        };
      }
    }
    if (task.id === "skin_pm") {
      const actions = (task.steps || []).map((step) => step.action);
      const needsUpdate =
        actions.includes("double_cleanse_if_needed") ||
        actions.includes("optional_toner") ||
        !actions.includes("apply_toner");
      if (needsUpdate) {
        updated = true;
        return {
          ...task,
          steps: [
            { step: 1, action: "apply_toner", products: ["toner_dr_sante_azulene"] },
            { step: 2, action: "apply_serum", productSelector: "rule_based_serum_pm" },
            { step: 3, action: "apply_cream", products: ["cream_minic_barrier"] },
          ],
        };
      }
    }
    return task;
  });

  if (updated) {
    saveTaskDefinitions(nextDefinitions);
  }

  return nextDefinitions;
}

function saveTaskDefinitions(taskDefinitions: TaskDefinition[]) {
  writeStorage(STORAGE_KEYS.taskDefinitions, taskDefinitions);
}

function getRulesState(): RulesResponse {
  const seedRules = (seedData as any).rules || {};
  const rules = readStorage<Record<string, any>>(STORAGE_KEYS.rules, seedRules);
  const conditions = readStorage<Record<string, boolean>>(
    STORAGE_KEYS.conditions,
    { ...DEFAULT_CONDITIONS }
  );
  return { rules, conditions };
}

function saveRulesState(payload: RulesResponse) {
  writeStorage(STORAGE_KEYS.rules, payload.rules);
  writeStorage(STORAGE_KEYS.conditions, payload.conditions);
}

function getTaskStatuses(): Record<string, { lastCompletedAt?: string | null; lastSkippedAt?: string | null }> {
  return readStorage(STORAGE_KEYS.taskStatuses, {});
}

function saveTaskStatuses(statuses: Record<string, { lastCompletedAt?: string | null; lastSkippedAt?: string | null }>) {
  writeStorage(STORAGE_KEYS.taskStatuses, statuses);
}

function getRuleUsage(): Record<string, { lastUsedAt?: string | null }> {
  return readStorage(STORAGE_KEYS.ruleUsage, {});
}

function saveRuleUsage(usage: Record<string, { lastUsedAt?: string | null }>) {
  writeStorage(STORAGE_KEYS.ruleUsage, usage);
}

function nowKstIso() {
  const date = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return date.toISOString().replace("Z", "+09:00");
}

function toDateKeyFromIso(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date);
}

function dayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function isDue(taskDef: any, status: any, targetDateKey: string): boolean {
  if (typeof taskDef.interval_days === "number") {
    const lastCompletedKey = status?.lastCompletedAt ? toDateKeyFromIso(status.lastCompletedAt) : null;
    if (!lastCompletedKey) return true;
    const daysSince = dayNumber(targetDateKey) - dayNumber(lastCompletedKey);
    return daysSince >= taskDef.interval_days;
  }

  if (Array.isArray(taskDef.cron_weekdays)) {
    const date = new Date(`${targetDateKey}T00:00:00+09:00`);
    return taskDef.cron_weekdays.includes(date.getUTCDay() === 0 ? 6 : date.getUTCDay() - 1);
  }

  return false;
}

function stateForDate(status: any, targetDateKey: string): TaskCard["state"] | null {
  const completedKey = status?.lastCompletedAt ? toDateKeyFromIso(status.lastCompletedAt) : null;
  const skippedKey = status?.lastSkippedAt ? toDateKeyFromIso(status.lastSkippedAt) : null;
  if (completedKey === targetDateKey) return "completed";
  if (skippedKey === targetDateKey) return "skipped";
  return null;
}

function rotationDue(lastUsedAt: string | null | undefined, intervalDays?: number, targetDateKey?: string): boolean {
  if (!intervalDays || !targetDateKey) return false;
  if (!lastUsedAt) return true;
  const lastUsedKey = toDateKeyFromIso(lastUsedAt);
  if (lastUsedKey === targetDateKey) return true;
  const daysSince = dayNumber(targetDateKey) - dayNumber(lastUsedKey);
  return daysSince >= intervalDays;
}

function blockedByConditions(blockList: string[], conditions: Record<string, boolean>): boolean {
  return blockList.some((key) => conditions[key]);
}

function selectAmSerum(
  rules: Record<string, any>,
  conditions: Record<string, boolean>,
  ruleUsage: Record<string, { lastUsedAt?: string | null }>,
  targetDateKey: string
) {
  const amRules = rules.amSerumRotation || {};
  const defaultId = amRules.default;
  const vitcRule = amRules.vitc;
  if (!vitcRule) return defaultId;

  const blockList = vitcRule.only_if_condition_not || [];
  if (blockedByConditions(blockList, conditions)) return defaultId;

  const vitcId = vitcRule.productId;
  const intervalDays = vitcRule.interval_days;
  const usage = ruleUsage[RULE_KEY_AM_VITC];
  if (rotationDue(usage?.lastUsedAt, intervalDays, targetDateKey)) return vitcId;

  return defaultId;
}

function selectPmSerum(
  rules: Record<string, any>,
  conditions: Record<string, boolean>,
  ruleUsage: Record<string, { lastUsedAt?: string | null }>,
  targetDateKey: string,
  amSelected?: string | null
) {
  const pmRules = rules.pmSerumRotation || {};
  const defaultId = pmRules.default;
  const niacinRule = pmRules.highNiacinamide;
  if (!niacinRule) return defaultId;

  const blockList = niacinRule.only_if_condition_not || [];
  if (blockedByConditions(blockList, conditions)) return defaultId;

  const constraints = niacinRule.constraints || [];
  if (constraints.includes("do_not_pair_with_vitc_same_day")) {
    const vitcId = rules.amSerumRotation?.vitc?.productId;
    if (vitcId && amSelected === vitcId) return defaultId;
  }

  const niacinId = niacinRule.productId;
  const intervalDays = niacinRule.interval_days;
  const usage = ruleUsage[RULE_KEY_PM_HIGH_NIACIN];
  if (rotationDue(usage?.lastUsedAt, intervalDays, targetDateKey)) return niacinId;

  return defaultId;
}

function conditionMet(condition: string | undefined, conditions: Record<string, boolean>) {
  if (!condition) return true;
  if (condition === "skin_is_dry_or_sensitive") {
    return conditions.dry || conditions.sensitive || conditions.irritated;
  }
  return conditions[condition] || false;
}

function seasonKeyFromDateKey(dateKey: string): string {
  const [, monthStr] = dateKey.split("-");
  const month = Number(monthStr);
  if ([12, 1, 2].includes(month)) return "winter";
  if ([3, 4, 5].includes(month)) return "spring";
  if ([6, 7, 8].includes(month)) return "summer";
  return "fall";
}

function hydrationEnabled(
  rules: Record<string, any>,
  conditions: Record<string, boolean>,
  targetDateKey: string
) {
  const hydrationRule = rules.hydrationBoost || {};
  const toggleKey = hydrationRule.toggle;
  const productId = hydrationRule.productId;
  const autoSeasons = hydrationRule.autoSeasons || [];
  if (!productId) return { enabled: false, productId: "" };
  const seasonEnabled = autoSeasons.includes(seasonKeyFromDateKey(targetDateKey));
  const toggleEnabled = toggleKey ? !!conditions[toggleKey] : false;
  return { enabled: seasonEnabled || toggleEnabled, productId };
}

function applyHydrationOverride(
  selectedId: string | null | undefined,
  defaultId: string | null | undefined,
  rules: Record<string, any>,
  conditions: Record<string, boolean>,
  targetDateKey: string
) {
  if (!selectedId || selectedId !== defaultId) return selectedId;
  const { enabled, productId } = hydrationEnabled(rules, conditions, targetDateKey);
  if (!enabled || !productId) return selectedId;
  return productId;
}

function buildTaskSteps(
  taskDef: any,
  rules: Record<string, any>,
  conditions: Record<string, boolean>,
  ruleUsage: Record<string, { lastUsedAt?: string | null }>,
  targetDateKey: string,
  amSelected?: string | null
): { steps: any[]; amSelected?: string | null } {
  if (conditions.lazy_mode && (taskDef.id === "skin_am" || taskDef.id === "skin_pm")) {
    const key = taskDef.slot === "AM" ? "am" : "pm";
    const products = rules.lazyFallback?.[key] || [];
    return { steps: [{ step: 1, action: "apply_products", products }], amSelected };
  }

  const steps: any[] = [];
  let stepNumber = 1;
  let selectedAm = amSelected;

  for (const rawStep of taskDef.steps || []) {
    if (!conditionMet(rawStep.condition, conditions)) continue;

    let products = [...(rawStep.products || [])];
    const selector = rawStep.productSelector;

    if (selector === "rule_based_serum_am") {
      const defaultId = rules.amSerumRotation?.default;
      selectedAm = selectAmSerum(rules, conditions, ruleUsage, targetDateKey);
      selectedAm = applyHydrationOverride(selectedAm, defaultId, rules, conditions, targetDateKey) || null;
      products = selectedAm ? [selectedAm] : [];
    } else if (selector === "rule_based_serum_pm") {
      const defaultId = rules.pmSerumRotation?.default;
      let pmSelected = selectPmSerum(rules, conditions, ruleUsage, targetDateKey, selectedAm || undefined);
      pmSelected = applyHydrationOverride(pmSelected, defaultId, rules, conditions, targetDateKey) || null;
      products = pmSelected ? [pmSelected] : [];
    }

    steps.push({ step: stepNumber, action: rawStep.action, products });
    stepNumber += 1;
  }

  return { steps, amSelected: selectedAm };
}

function buildTodayCards(targetDateKey: string): TaskCard[] {
  const taskDefs = getTaskDefinitions();
  const statuses = getTaskStatuses();
  const { rules, conditions } = getRulesState();
  const ruleUsage = getRuleUsage();

  const candidates: Record<string, any> = {};

  for (const taskDef of taskDefs) {
    const status = statuses[taskDef.id] || {};
    const due = isDue(taskDef, status, targetDateKey);
    let state = stateForDate(status, targetDateKey);
    if (!due && !state) continue;
    if (!state) state = "due";

    const intervalScore = taskDef.interval_days || 0;
    const existing = candidates[taskDef.slot];
    if (!existing || intervalScore > existing.intervalScore) {
      candidates[taskDef.slot] = { taskDef, state, intervalScore };
    }
  }

  const orderedSlots = Object.keys(candidates).sort(
    (a, b) => (SLOT_PRIORITY[a] ?? 99) - (SLOT_PRIORITY[b] ?? 99)
  );

  const cards: TaskCard[] = [];
  let amSelected: string | null | undefined = null;

  for (const slot of orderedSlots) {
    const candidate = candidates[slot];
    const taskDef = candidate.taskDef;
    const built = buildTaskSteps(taskDef, rules, conditions, ruleUsage, targetDateKey, amSelected);
    amSelected = built.amSelected ?? amSelected;

    cards.push({
      taskInstanceId: `${taskDef.id}|${targetDateKey}`,
      taskDefinitionId: taskDef.id,
      slot: taskDef.slot,
      type: taskDef.type,
      state: candidate.state,
      steps: built.steps,
    });
  }

  return cards;
}

function deepMerge(base: Record<string, any>, updates: Record<string, any>) {
  const merged = { ...base };
  for (const key of Object.keys(updates)) {
    const value = updates[key];
    if (value && typeof value === "object" && !Array.isArray(value) && typeof merged[key] === "object") {
      merged[key] = deepMerge(merged[key], value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function updateRuleUsageForCompletion(taskDefinitionId: string, completedAtIso: string, targetDateKey: string) {
  const { rules, conditions } = getRulesState();
  if (conditions.lazy_mode) return;

  const usage = getRuleUsage();
  const vitcId = rules.amSerumRotation?.vitc?.productId;
  const niacinId = rules.pmSerumRotation?.highNiacinamide?.productId;
  const amSelected = selectAmSerum(rules, conditions, usage, targetDateKey);

  if (taskDefinitionId === "skin_am" && vitcId && amSelected === vitcId) {
    usage[RULE_KEY_AM_VITC] = { lastUsedAt: completedAtIso };
    saveRuleUsage(usage);
    return;
  }

  if (taskDefinitionId === "skin_pm" && niacinId) {
    const pmSelected = selectPmSerum(rules, conditions, usage, targetDateKey, amSelected);
    if (pmSelected === niacinId) {
      usage[RULE_KEY_PM_HIGH_NIACIN] = { lastUsedAt: completedAtIso };
      saveRuleUsage(usage);
    }
  }
}

export async function localApi(path: string, options: RequestInit = {}): Promise<any> {
  const method = (options.method || "GET").toUpperCase();
  const body = options.body ? JSON.parse(options.body.toString()) : undefined;

  if (path.startsWith("/api/time") && method === "GET") {
    return { nowKstIso: nowKstIso() };
  }

  if (path.startsWith("/api/today") && method === "GET") {
    const url = new URL(path, "http://local");
    const dateParam = url.searchParams.get("date");
    const targetDateKey = dateParam || toDateKeyFromIso(nowKstIso());
    const cards = buildTodayCards(targetDateKey);
    const response: TodayResponse = {
      date: targetDateKey,
      nowKstIso: nowKstIso(),
      cards,
    };
    return response;
  }

  if (path === "/api/products" && method === "GET") {
    return getProducts();
  }

  if (path === "/api/products" && method === "POST") {
    const products = getProducts();
    const payload = body as ProductCreate;
    if (products.some((p) => p.id === payload.id)) {
      throw new Error("Product id already exists");
    }
    const product: Product = {
      ...payload,
      is_active: true,
    };
    products.push(product);
    saveProducts(products);
    return product;
  }

  if (path.startsWith("/api/products/") && method === "PATCH") {
    const id = path.split("/").pop() || "";
    const products = getProducts();
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) throw new Error("Product not found");
    const update = body as ProductUpdate;
    products[index] = { ...products[index], ...update };
    saveProducts(products);
    return products[index];
  }

  if (path.startsWith("/api/products/") && method === "DELETE") {
    const id = path.split("/").pop() || "";
    const products = getProducts();
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) throw new Error("Product not found");
    products[index] = { ...products[index], is_active: false };
    saveProducts(products);
    const response: DeleteResponse = { ok: true, id };
    return response;
  }

  if (path === "/api/tasks" && method === "GET") {
    return getTaskDefinitions();
  }

  if (path === "/api/tasks" && method === "POST") {
    const taskDefinitions = getTaskDefinitions();
    const payload = body as TaskDefinitionCreate;
    if (taskDefinitions.some((t) => t.id === payload.id)) {
      throw new Error("Task definition id already exists");
    }
    taskDefinitions.push(payload);
    saveTaskDefinitions(taskDefinitions);
    return payload;
  }

  if (path.startsWith("/api/tasks/") && method === "PATCH") {
    const id = path.split("/").pop() || "";
    const taskDefinitions = getTaskDefinitions();
    const index = taskDefinitions.findIndex((t) => t.id === id);
    if (index === -1) throw new Error("Task definition not found");
    const update = body as TaskDefinitionUpdate;
    taskDefinitions[index] = { ...taskDefinitions[index], ...update };
    saveTaskDefinitions(taskDefinitions);
    return taskDefinitions[index];
  }

  if (path.startsWith("/api/tasks/") && method === "DELETE") {
    const id = path.split("/").pop() || "";
    const taskDefinitions = getTaskDefinitions();
    const nextDefinitions = taskDefinitions.filter((t) => t.id !== id);
    if (nextDefinitions.length === taskDefinitions.length) throw new Error("Task definition not found");
    saveTaskDefinitions(nextDefinitions);
    const statuses = getTaskStatuses();
    if (statuses[id]) {
      delete statuses[id];
      saveTaskStatuses(statuses);
    }
    const response: DeleteResponse = { ok: true, id };
    return response;
  }

  if (path === "/api/rules" && method === "GET") {
    return getRulesState();
  }

  if (path === "/api/rules" && method === "PATCH") {
    const current = getRulesState();
    const nextRules = body?.rules ? deepMerge(current.rules, body.rules) : current.rules;
    const nextConditions = body?.conditions
      ? { ...current.conditions, ...body.conditions }
      : current.conditions;
    const updated = { rules: nextRules, conditions: nextConditions };
    saveRulesState(updated);
    return updated;
  }

  if (path === "/api/complete" && method === "POST") {
    const payload = body as CompleteRequest;
    const [taskDefinitionId, targetDateKey] = payload.taskInstanceId.split("|");
    const statuses = getTaskStatuses();
    const status = statuses[taskDefinitionId] || {};
    status.lastCompletedAt = payload.completedAtIso;
    statuses[taskDefinitionId] = status;
    saveTaskStatuses(statuses);
    updateRuleUsageForCompletion(taskDefinitionId, payload.completedAtIso, targetDateKey);
    return { ok: true, taskDefinitionId, completedAtIso: payload.completedAtIso };
  }

  if (path === "/api/skip" && method === "POST") {
    const payload = body as SkipRequest;
    const [taskDefinitionId] = payload.taskInstanceId.split("|");
    const statuses = getTaskStatuses();
    const status = statuses[taskDefinitionId] || {};
    status.lastSkippedAt = payload.skippedAtIso;
    statuses[taskDefinitionId] = status;
    saveTaskStatuses(statuses);
    return { ok: true, taskDefinitionId, skippedAtIso: payload.skippedAtIso };
  }

  if (path === "/api/ai/patch" && method === "POST") {
    const response: AiPatchResponse = {
      jsonPatch: [],
      summary: "로컬 모드에서는 AI 패치를 사용할 수 없습니다. API Base URL과 Gemini 키를 설정하세요.",
    };
    return response;
  }

  throw new Error(`Unsupported local API route: ${method} ${path}`);
}
