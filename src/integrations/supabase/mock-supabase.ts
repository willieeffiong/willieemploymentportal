// In-memory mock Supabase client used automatically when Supabase env vars are not configured.

export interface MockUser {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
}

export interface MockSession {
  access_token: string;
  user: MockUser;
}

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const DEMO_APPLICANT_ID = "00000000-0000-4000-8000-000000000002";

const tables: Record<string, Record<string, unknown>[]> = {
  app_settings: [
    {
      id: 1,
      deadline: "2026-08-10T23:59:59+01:00",
      manually_closed: false,
      deadline_change: null,
      deadline_changed_at: null,
    },
  ],
  user_roles: [
    { id: "role-admin-1", user_id: ADMIN_ID, role: "admin" },
    { id: "role-user-1", user_id: DEMO_APPLICANT_ID, role: "applicant" },
  ],
  profiles: [
    {
      id: ADMIN_ID,
      full_name: "Engr. Willie Effiong",
      email: "willieeffiong52@gmail.com",
      status: "accepted",
      employment_status: "employed",
      engineering_field: "Electrical Engineering",
      state_of_origin: "Akwa Ibom",
      lga: "Uyo",
      phone: "+234 800 000 0001",
      created_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
    },
    {
      id: DEMO_APPLICANT_ID,
      full_name: "Adaeze Chidinma Okafor",
      email: "applicant@example.com",
      status: "pending",
      employment_status: "pending",
      engineering_field: "Civil Engineering",
      state_of_origin: "Anambra",
      lga: "Awka South",
      phone: "+234 800 000 0002",
      bio: "Structural and highway infrastructure engineer passionate about sustainable urban development.",
      created_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
    },
  ],
  posts: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      author_id: ADMIN_ID,
      body: "Welcome to the Willie Lab Tech 2026 Empowerment Portal! Applications are open from 29th July to 10th August 2026 across 21 engineering disciplines.",
      audience: "all",
      media: [],
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
    },
    {
      id: "10000000-0000-4000-8000-000000000002",
      author_id: ADMIN_ID,
      body: "Reminder: Please ensure your profile includes your full three names, valid engineering discipline, and supporting credentials before final submission.",
      audience: "all",
      media: [],
      created_at: new Date(Date.now() - 3_600_000).toISOString(),
    },
  ],
  post_reactions: [],
  post_comments: [],
  post_views: [],
  notifications: [],
  messages: [],
  public_messages: [],
  documents: [],
  login_attempts: [],
  assistant_threads: [],
  assistant_messages: [],
  ai_provider_settings: [],
};

function getTable(name: string): Record<string, unknown>[] {
  if (!tables[name]) tables[name] = [];
  return tables[name];
}

function makeQueryBuilder(tableName: string) {
  let op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  let payload: unknown = null;
  let filters: ((row: Record<string, unknown>) => boolean)[] = [];
  let orderBy: { col: string; ascending: boolean } | null = null;
  let limitCount: number | null = null;
  let singleMode: "single" | "maybeSingle" | null = null;

  const execute = (): { data: unknown; error: null; count: number } => {
    const rows = getTable(tableName);

    if (op === "insert") {
      const items = Array.isArray(payload) ? payload : [payload];
      const inserted = items.map((item) => {
        const record = {
          id: (item as Record<string, unknown>)?.id ?? crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...(item as Record<string, unknown>),
        };
        rows.push(record);
        return record;
      });
      const result = singleMode ? inserted[0] ?? null : inserted;
      return { data: result, error: null, count: inserted.length };
    }

    if (op === "upsert") {
      const items = Array.isArray(payload) ? payload : [payload];
      const upserted = items.map((item) => {
        const rec = item as Record<string, unknown>;
        const idx = rows.findIndex(
          (r) =>
            (rec.id !== undefined && r.id === rec.id) ||
            (rec.email !== undefined && r.email === rec.email),
        );
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], ...rec };
          return rows[idx];
        }
        const created = { id: rec.id ?? crypto.randomUUID(), ...rec };
        rows.push(created);
        return created;
      });
      const result = singleMode ? upserted[0] ?? null : upserted;
      return { data: result, error: null, count: upserted.length };
    }

    const matches = (row: Record<string, unknown>) => filters.every((fn) => fn(row));

    if (op === "update") {
      const updated: Record<string, unknown>[] = [];
      for (let i = 0; i < rows.length; i += 1) {
        if (matches(rows[i])) {
          rows[i] = { ...rows[i], ...(payload as Record<string, unknown>) };
          updated.push(rows[i]);
        }
      }
      const result = singleMode ? updated[0] ?? null : updated;
      return { data: result, error: null, count: updated.length };
    }

    if (op === "delete") {
      const remaining: Record<string, unknown>[] = [];
      const deleted: Record<string, unknown>[] = [];
      for (const row of rows) {
        if (matches(row)) deleted.push(row);
        else remaining.push(row);
      }
      tables[tableName] = remaining;
      const result = singleMode ? deleted[0] ?? null : deleted;
      return { data: result, error: null, count: deleted.length };
    }

    let result = rows.filter(matches);
    if (orderBy) {
      const { col, ascending } = orderBy;
      result = [...result].sort((a, b) => {
        const av = String(a[col] ?? "");
        const bv = String(b[col] ?? "");
        return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (limitCount !== null) result = result.slice(0, limitCount);
    if (singleMode === "single" || singleMode === "maybeSingle") {
      return { data: result[0] ?? null, error: null, count: result.length };
    }
    return { data: result, error: null, count: result.length };
  };

  const builder: Record<string, unknown> = {
    select: () => {
      if (op === "select") op = "select";
      return builder;
    },
    insert: (data: unknown) => {
      op = "insert";
      payload = data;
      return builder;
    },
    update: (data: unknown) => {
      op = "update";
      payload = data;
      return builder;
    },
    upsert: (data: unknown) => {
      op = "upsert";
      payload = data;
      return builder;
    },
    delete: () => {
      op = "delete";
      return builder;
    },
    eq: (col: string, val: unknown) => {
      filters.push((r) => r[col] === val);
      return builder;
    },
    neq: (col: string, val: unknown) => {
      filters.push((r) => r[col] !== val);
      return builder;
    },
    in: (col: string, vals: unknown[]) => {
      filters.push((r) => vals.includes(r[col]));
      return builder;
    },
    ilike: (col: string, val: string) => {
      const needle = val.replace(/%/g, "").toLowerCase();
      filters.push((r) => String(r[col] ?? "").toLowerCase().includes(needle));
      return builder;
    },
    order: (col: string, opts?: { ascending?: boolean }) => {
      orderBy = { col, ascending: opts?.ascending ?? true };
      return builder;
    },
    limit: (n: number) => {
      limitCount = n;
      return builder;
    },
    single: () => {
      singleMode = "single";
      return builder;
    },
    maybeSingle: () => {
      singleMode = "maybeSingle";
      return builder;
    },
    then: (resolve: (val: unknown) => unknown, reject?: (err: unknown) => unknown) => {
      return Promise.resolve().then(() => execute()).then(resolve, reject);
    },
  };

  return builder;
}

const STORAGE_KEY = "willie_mock_session";

function readClientSession(): MockSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MockSession) : null;
  } catch {
    return null;
  }
}

function writeClientSession(session: MockSession | null) {
  if (typeof window === "undefined") return;
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore storage errors */
  }
}

export function getMockUserIdFromToken(token?: string | null): string {
  if (!token) return DEMO_APPLICANT_ID;
  if (token === `mock-token-${ADMIN_ID}`) return ADMIN_ID;
  if (token === `mock-token-${DEMO_APPLICANT_ID}`) return DEMO_APPLICANT_ID;
  return DEMO_APPLICANT_ID;
}

export function createMockSupabaseClient() {
  return {
    from: (table: string) => makeQueryBuilder(table),
    storage: {
      from: (_bucket: string) => ({
        upload: async (path: string) => ({ data: { path }, error: null }),
        createSignedUrl: async (path: string) => ({ data: { signedUrl: path }, error: null }),
        download: async () => ({ data: null, error: null }),
        remove: async () => ({ data: [], error: null }),
      }),
    },
    auth: {
      getSession: async () => ({
        data: { session: readClientSession() },
        error: null,
      }),
      getUser: async (token?: string) => {
        if (token) {
          const uid = getMockUserIdFromToken(token);
          const isAdmin = uid === ADMIN_ID;
          return {
            data: {
              user: {
                id: uid,
                email: isAdmin ? "willieeffiong52@gmail.com" : "applicant@example.com",
              },
            },
            error: null,
          };
        }
        const session = readClientSession();
        return { data: { user: session?.user ?? null }, error: null };
      },
      getClaims: async (token?: string) => {
        const uid = getMockUserIdFromToken(token);
        return { data: { claims: { sub: uid } }, error: null };
      },
      signInWithPassword: async ({ email }: { email: string; password: string }) => {
        const isAdmin = email.trim().toLowerCase() === "willieeffiong52@gmail.com";
        const id = isAdmin ? ADMIN_ID : DEMO_APPLICANT_ID;
        const user: MockUser = { id, email: email.trim().toLowerCase() };
        const session: MockSession = { access_token: `mock-token-${id}`, user };
        writeClientSession(session);
        return { data: { user, session }, error: null };
      },
      signOut: async () => {
        writeClientSession(null);
        return { error: null };
      },
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      admin: {
        createUser: async ({ email }: { email: string }) => {
          const id = crypto.randomUUID();
          return { data: { user: { id, email } }, error: null };
        },
        updateUserById: async (id: string) => ({
          data: { user: { id } },
          error: null,
        }),
        listUsers: async () => ({
          data: { users: [] },
          error: null,
        }),
      },
    },
  };
}
