/**
 * Thin DefraDB HTTP client.
 *
 * Talks to a local DefraDB node over its HTTP API:
 *   POST /api/v0/graphql     — queries & mutations
 *   POST /api/v0/collections — add SDL schema (bootstrap)
 *
 * Values are serialized inline into the GraphQL document via `gqlValue`
 * (JSON-escaped strings, bare keys for input objects) rather than relying on
 * GraphQL variables, keeping the wire format dead simple and injection-safe.
 */
import { config } from "../config.js";

const API = () => `${config.defraUrl}/api/v0`;

export class DefraError extends Error {
  constructor(message: string, public readonly detail?: unknown) {
    super(message);
  }
}

/** Serialize a JS value into GraphQL literal syntax. */
export function gqlValue(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(gqlValue).join(", ")}]`;
  if (typeof v === "object") {
    const fields = Object.entries(v as Record<string, unknown>)
      .filter(([, val]) => val !== undefined)
      .map(([k, val]) => `${k}: ${gqlValue(val)}`);
    return `{${fields.join(", ")}}`;
  }
  throw new DefraError(`Cannot serialize value of type ${typeof v}`);
}

export async function gql<T = any>(query: string): Promise<T> {
  const res = await fetch(`${API()}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new DefraError(`DefraDB HTTP ${res.status}`, body);
  }
  if (body?.errors?.length) {
    throw new DefraError(body.errors[0]?.message ?? "DefraDB GraphQL error", body.errors);
  }
  return (body?.data ?? body) as T;
}

export async function addSchema(sdl: string): Promise<{ ok: boolean; detail?: unknown }> {
  const res = await fetch(`${API()}/collections`, { method: "POST", body: sdl });
  const body = await res.text();
  if (!res.ok) return { ok: false, detail: body };
  return { ok: true, detail: body };
}

export async function listCollections(): Promise<string[]> {
  const res = await fetch(`${API()}/collections`);
  if (!res.ok) return [];
  const body = await res.json().catch(() => []);
  const items = Array.isArray(body) ? body : [body];
  return items
    .map((c: any) => c?.Name ?? c?.name ?? c?.Description?.Name)
    .filter(Boolean);
}

export async function health(): Promise<boolean> {
  try {
    const res = await fetch(`${config.defraUrl}/health-check`);
    return res.ok;
  } catch {
    return false;
  }
}

// ---- CRUD helpers -----------------------------------------------------------

/** Create a document; returns its _docID. */
export async function createDoc(collection: string, input: Record<string, unknown>): Promise<string> {
  const data = await gql(`mutation { add_${collection}(input: ${gqlValue(input)}) { _docID } }`);
  const row = data?.[`add_${collection}`]?.[0];
  if (!row?._docID) throw new DefraError(`add_${collection} returned no _docID`, data);
  return row._docID as string;
}

/** Query documents with an optional Defra filter object and options. */
export async function findDocs<T = any>(
  collection: string,
  fields: string[],
  opts: { filter?: Record<string, unknown>; order?: Record<string, "ASC" | "DESC">; limit?: number; offset?: number } = {}
): Promise<T[]> {
  const args: string[] = [];
  if (opts.filter && Object.keys(opts.filter).length) args.push(`filter: ${gqlValue(opts.filter)}`);
  if (opts.order) {
    const [k, dir] = Object.entries(opts.order)[0]!;
    args.push(`order: {${k}: ${dir}}`);
  }
  if (opts.limit !== undefined) args.push(`limit: ${opts.limit}`);
  if (opts.offset !== undefined) args.push(`offset: ${opts.offset}`);
  const argStr = args.length ? `(${args.join(", ")})` : "";
  const data = await gql(`query { ${collection}${argStr} { _docID ${fields.join(" ")} } }`);
  return (data?.[collection] ?? []) as T[];
}

export async function updateDoc(collection: string, docID: string, input: Record<string, unknown>): Promise<void> {
  await gql(
    `mutation { update_${collection}(docID: ${gqlValue(docID)}, input: ${gqlValue(input)}) { _docID } }`
  );
}

export async function deleteDoc(collection: string, docID: string): Promise<void> {
  await gql(`mutation { delete_${collection}(docID: ${gqlValue(docID)}) { _docID } }`);
}
