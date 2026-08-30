# DotMoney

A personal finance advocate for Canadians — think Rocket Money, but built here and
backed by **DefraDB** so user financial data lives in a user-centric, local-first
document store instead of a central SQL silo.

Phase 1 (MVP) of [plan.md](plan.md): auth, bank data via Plaid sandbox or CSV
import, automatic subscription detection, provincial cancellation/refund letter
templates, spending analysis, and budgets.

## Stack

| Layer | Tech |
|---|---|
| Data store | DefraDB (HTTP GraphQL API, port 9181) |
| API | Node 22, Express, TypeScript (`apps/api`, port 4000) |
| Web | Next.js 14, Tailwind, Recharts (`apps/web`, port 3000) |
| Bank linking | Plaid (sandbox, `country_codes: [CA]`) with CSV fallback |

## Quick start

```sh
nvm use                       # Node 22 (see .nvmrc)
npm install
cp .env.example .env          # set DEFRA_BIN; Plaid keys optional

# three terminals:
npm run dev:defra             # 1. DefraDB node (uses DEFRA_BIN)
npm run bootstrap && npm run seed && npm run dev:api   # 2. schema + demo data + API
npm run dev:web               # 3. web app → http://localhost:3000
```

Demo login: `demo@dotmoney.ca` / `demo-password-123` (~283 seeded transactions,
8 detectable subscriptions including deliberate streaming duplicates).

## How the data layer works

- All collections (`User`, `BankAccount`, `Txn`, `Sub`, `CancellationRequest`,
  `Budget`, `Goal`) are defined in
  [apps/api/src/defra/schema.graphql](apps/api/src/defra/schema.graphql) and added
  via `POST /api/v0/collections`.
- Every user-owned document carries an indexed `userId` foreign key instead of a
  Defra `@relation`. Each collection is therefore an independent **ACP boundary**:
  the Phase 2 plan is a SourceHub policy with `owner`/`reader` relations per
  document (`@policy` on each type), which slots in without a schema migration —
  and enables user-to-user sharing (household accounts) later.
- The thin client in [apps/api/src/lib/defra.ts](apps/api/src/lib/defra.ts)
  serializes values inline (JSON-escaped) into GraphQL documents; mutations are
  `add_X` / `update_X` / `delete_X` (v1.0 naming).

### DefraDB v1.0 quirks discovered while building

- `type Subscription` collides with GraphQL's root subscription type → the
  collection is named `Sub`.
- DefraDB docIDs are **content-derived**: two byte-identical documents collide.
  The seed script nudges exact-duplicate transactions; the Plaid/CSV importers
  dedupe on `date|amount|description` before writing.
- String fields have no `_gt`/`_lt` filter operators (v1.0), so date-range cuts happen
  app-side. Migrating `date` to Defra's `DateTime` scalar would push ranges back
  into the query.
- Schema add endpoint is `POST /api/v0/collections` (not `/schema`).

## Compliance posture (Phase 1)

- **PIPEDA**: data minimization by design — only transaction data needed for the
  features; the Defra document model keeps a clean per-user deletion boundary
  (delete-by-filter on `userId` across collections).
- **Legal templates** cite the consumer protection statute for all 10 provinces
  (ON/BC/QC/AB/MB/SK/NS/NB/NL/PE) and are labeled *guidance, not legal advice*
  in both the API response and the UI. A legal review is a Phase 2 gate before
  public launch.
- **Not yet production-grade** (tracked for hosted deployment): JWTs in
  localStorage → httpOnly cookies; Plaid access tokens stored plaintext in the
  local node → envelope encryption; add rate limiting, 2FA, and a real keyring
  (`defradb start` without `--no-keyring`).

## API surface

`POST /auth/register|login|refresh-token` · `GET|PATCH /user/profile` ·
`POST /banks/link-token|exchange|sync|import-csv` · `GET /banks/accounts` ·
`GET|PATCH|DELETE /transactions` · `POST /transactions/recategorize` ·
`PATCH /banks/accounts/:id` (rename/tag an import) ·
`GET|POST|DELETE /merchants` · `GET /merchants/uncategorized` ·
`GET|POST|PATCH|DELETE /subscriptions` ·
`GET /cancellation-requests/templates` · `GET|POST|PATCH /cancellation-requests` ·
`GET|POST|PATCH|DELETE /budgets` ·
`GET /spending-analysis/dashboard?months=1|3|6|12|0&accountId=…|anomalies|opportunities`

Transactions and the dashboard both scope to a single account (`accountId`) or
all of them, and the dashboard window is selectable (1M/3M/6M/1Y/All). CSV
imports create an account row that can be renamed, so each upload is tagged and
filterable.

## Categorization

**Merchant naming.** Bank descriptors bury the merchant in transaction-type
wording, processor prefixes, corporate suffixes and a per-transaction reference
code — `"E-Transfer Request Fulfilled Paybilt Inc. Km8f9u"` → `"Paybilt"`.
`normalizeMerchant` strips all four (reference codes only from the tail, so
`F45 Training` and `7-Eleven` survive) and title-cases the result, with catalog
names used verbatim so hand-written ones like `Max (HBO)` stay intact. Without
this every payment looks like a new merchant. Re-run over existing data with
`npx tsx src/scripts/renormalize-merchants.ts [--dry]` — it cleans user-created
merchant *rule* names too, since a matching rule supplies the stored name.

Merchant-first: the Defra `Merchant` collection holds a built-in catalog of
~375 Canadian + US merchants plus each user's own entries, and is the primary
categorization input (longest pattern wins; user entries beat built-ins). Regex
rules and Plaid's `personal_finance_category` are fallbacks; only then "Other".
Anything still uncategorized surfaces on the **Merchants** page grouped by
merchant — assigning a category once creates a catalog entry and sorts every
past and future transaction from that merchant. Transaction categories can also
be edited inline on the Transactions page; budgets and the dashboard recompute
from transactions on every read, so edits show up immediately.

## Roadmap

Phase 2 (advocate features + **Source ACP** document policies), Phase 3
(ML categorization, forecasts, mobile), Phase 4 (premium tier, partnerships) —
see [plan.md](plan.md).
