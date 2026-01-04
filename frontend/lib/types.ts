export interface TimeResponse {
    nowKstIso: string;
}

export interface TaskStep {
    step: number;
    action: string;
    products: string[];
    productSelector?: string;
    condition?: string;
}

export interface TaskCard {
    taskInstanceId: string;
    taskDefinitionId: string;
    slot: string;
    type: string;
    state: 'due' | 'completed' | 'skipped';
    steps: TaskStep[];
}

export interface TodayResponse {
    date: string;
    nowKstIso: string;
    cards: TaskCard[];
}

export interface CompleteRequest {
    taskInstanceId: string;
    completedAtIso: string;
}

export interface SkipRequest {
    taskInstanceId: string;
    skippedAtIso: string;
}

export interface Product {
    id: string;
    name: string;
    category: string;
    role: string;
    notes?: string | null;
    verified?: Record<string, any>;
    is_active: boolean;
}

export interface ProductCreate {
    id: string;
    name: string;
    category: string;
    role: string;
    notes?: string;
    verified?: Record<string, any>;
}

export interface ProductUpdate {
    name?: string;
    category?: string;
    role?: string;
    notes?: string | null;
    verified?: Record<string, any>;
    is_active?: boolean;
}

export interface DeleteResponse {
    ok: boolean;
    id: string;
}

export interface RulesResponse {
    rules: Record<string, any>;
    conditions: Record<string, boolean>;
}

export interface AiPatchRequest {
    userInstruction: string;
    currentSpec: {
        rules: Record<string, any>;
        // products could be included if needed by backend, spec says "currentSpec" is object
    };
}

export interface JsonPatchOperation {
    op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
    path: string;
    from?: string;
    value?: any;
}

export interface AiPatchResponse {
    jsonPatch: JsonPatchOperation[];
    summary: string;
}
