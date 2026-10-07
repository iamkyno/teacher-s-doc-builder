# Teacher Paper Builder — Rebuild Plan & Architecture

> Status: **Draft for review**. Nothing here is built yet. This document replaces the current
> prototype (Lovable scaffold) with a production architecture.

---

## 1. Vision

**"Microsoft Word, but for teachers."** A teacher opens the app and types a question paper the way
they would in Word — but with ready-made, CAPS-aware building blocks (questions, sub-questions,
MCQs, answer lines, mark allocations, cover pages, memos) that number, total and lay themselves
out automatically.

### Decisions already made

| Topic | Decision |
|---|---|
| Backend | Custom Node API (Fastify + PostgreSQL) |
| Users | Individual teachers first; data model ready for schools from day one |
| Export (v1) | Print, PDF, Word (.docx) |
| Default style | South African CAPS (numbering, marks, memos, cognitive levels) |

### Usability principles (what the prototype got wrong)

1. **One continuous document.** Typing, Enter, Backspace, selection, copy/paste all work across
   blocks — no isolated text boxes.
2. **Nothing manual that can be computed.** Numbering, mark totals, page count, cognitive-level
   analysis are always derived, never typed.
3. **What you see is what prints.** The editor shows real A4 pages; PDF and print use the same
   layout rules.
4. **Never lose work.** Autosave, version history, offline draft buffer.
5. **Keyboard first, mouse friendly.** Slash menu, shortcuts, plus a familiar ribbon.
6. **Tablet usable.** Panels collapse into drawers; touch-friendly targets.

---

## 2. System overview

```
┌──────────────────────────── Browser ─────────────────────────────┐
│  apps/web  (React + TipTap editor)                                │
│   • Editor (ProseMirror doc)  • Ribbon / panels  • Page view     │
│   • TanStack Query client     • IndexedDB draft buffer           │
└───────────────┬───────────────────────────────────────────────────┘
                │ HTTPS, JSON, session cookie
┌───────────────▼───────────────────────────────────────────────────┐
│  apps/api  (Fastify)                                              │
│   • Auth  • Documents  • Versions  • Question bank  • Templates   │
│   • Assets (presigned uploads)  • Export job API                  │
└──────┬──────────────────┬───────────────────────┬─────────────────┘
       │                  │                       │
┌──────▼──────┐   ┌───────▼───────┐       ┌───────▼──────────────┐
│ PostgreSQL  │   │ Redis (BullMQ)│──────▶│ Export worker        │
│ (Drizzle)   │   └───────────────┘       │ • PDF: Playwright    │
└─────────────┘                           │ • DOCX: docx lib     │
                    ┌─────────────────┐   └──────────┬───────────┘
                    │ S3 storage      │◀─────────────┘
                    │ (MinIO / R2)    │  images, logos, exports
                    └─────────────────┘
```

`packages/shared` is imported by **web, api and worker**, so numbering, marks and document
validation behave identically everywhere.

---

## 3. Repository layout (pnpm monorepo)

```
teacher-paper-builder/
├── apps/
│   ├── web/                 # React + Vite + TipTap
│   │   └── src/
│   │       ├── editor/      # TipTap setup, extensions, node views
│   │       │   ├── nodes/   # question, questionPart, mcq, answerLines, coverPage …
│   │       │   ├── plugins/ # numbering decorations, pagination, marks checks
│   │       │   └── commands/
│   │       ├── features/    # dashboard, auth, question-bank, templates, settings
│   │       ├── components/  # ribbon, panels, shadcn/ui
│   │       ├── api/         # typed API client (from shared zod schemas)
│   │       └── print/       # /render/:id route used by PDF worker
│   ├── api/                 # Fastify REST API
│   │   └── src/
│   │       ├── modules/     # auth, documents, versions, bank, templates, assets, exports, orgs
│   │       ├── db/          # Drizzle schema + migrations
│   │       ├── lib/         # mail, storage, rate-limit, permissions
│   │       └── server.ts
│   └── worker/              # BullMQ consumers: pdf, docx, thumbnails
├── packages/
│   ├── shared/              # doc schema, zod API schemas, CAPS numbering/marks engine
│   ├── docx-export/         # ProseMirror JSON → .docx
│   └── config/              # eslint, tsconfig, tailwind presets
├── docker-compose.yml       # postgres, redis, minio, mailpit
└── docs/
```

---

## 4. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere | One language, shared types |
| Editor | **TipTap 3 (ProseMirror)** | Mature rich-text engine; custom nodes; undo/redo, paste, collaboration-ready (Yjs) |
| UI | React, Vite, Tailwind, shadcn/ui, lucide | Keep what works from prototype |
| Client data | TanStack Query; Zustand for UI-only state | Server cache vs. local UI state kept separate |
| Routing | React Router | Already in use |
| Maths | KaTeX (render), MathLive (input) | Fast, print-quality formulas |
| API | **Fastify** + `fastify-type-provider-zod` | Fast, typed request/response validation |
| DB | **PostgreSQL 16** + **Drizzle ORM** | JSONB for documents, full-text search for question bank |
| Auth | Own implementation: argon2id + server-side sessions | Full control, no vendor lock-in |
| Jobs | BullMQ + Redis | Exports off the request thread, retries |
| PDF | Playwright (Chromium) | Pixel-identical to the editor's print CSS |
| DOCX | `docx` npm library | Native, editable Word output |
| Storage | S3-compatible (MinIO dev, Cloudflare R2 / S3 prod) | Images, logos, generated files |
| Email | Nodemailer (SMTP provider); Mailpit in dev | Verification, password reset |
| Tests | Vitest (unit), Playwright (e2e + visual) | |
| Infra | Docker Compose; single VPS or Fly/Render to start | Simple, cheap, scalable later |

---

## 5. Document model

The document is a **ProseMirror JSON tree**, stored as `jsonb`, validated by a shared schema and
versioned with `schemaVersion` so old documents can be migrated.

### 5.1 Node catalogue (preset elements)

**Structure**

| Node | Purpose |
|---|---|
| `doc` | Root. Attrs: `schemaVersion`, `paperMeta` |
| `coverPage` | CAPS cover: subject, grade, paper no., date, marks, time, examiner, moderator, page-count statement, logo |
| `instructions` | "Instructions and information" numbered list box |
| `section` | Section A/B/C heading with optional section total |
| `pageBreak` | Explicit page break |

**Questions**

| Node | Purpose |
|---|---|
| `question` | Top-level question → numbered `1`, `2` … shows `[total]` at end |
| `questionPart` | Nested sub-question → `1.1`, `1.1.1` (max depth 3). Leaf parts carry `marks` |
| `stem` | The question text (rich paragraphs, images, maths, tables) |
| `mcq` + `mcqOption` | Options A–D (configurable), optional correct answer |
| `trueFalse` | True/False with optional "correct the false statement" |
| `matchColumns` | Column A ↔ Column B table, auto-lettered |
| `fillBlank` | Inline `blank` nodes inside text (width configurable) |
| `memo` | Answer / marking guideline attached to any question part (hidden in student mode) |

**Answer space**

| Node | Purpose |
|---|---|
| `answerLines` | N ruled lines, line spacing setting |
| `answerBox` | Bordered box of set height |
| `gridSpace` | Squared/graph paper area |
| `workingSpace` | Blank space of set height |

**Content**

`paragraph`, `heading`, `bulletList`, `orderedList`, `table`, `image` (with caption &
"Figure x"), `math` (inline/block), `textPassage` (boxed reading text with line numbers),
`callout`.

### 5.2 Example JSON

```json
{
  "type": "question",
  "attrs": { "id": "q_8f2", "cognitiveLevel": null },
  "content": [
    { "type": "stem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Study the diagram and answer the questions." }] }] },
    {
      "type": "questionPart",
      "attrs": { "id": "p_1a", "marks": 2, "cognitiveLevel": "L1", "topic": "Photosynthesis" },
      "content": [
        { "type": "stem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Name the process shown." }] }] },
        { "type": "answerLines", "attrs": { "count": 2 } },
        { "type": "memo", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Photosynthesis ✓✓" }] }] }
      ]
    }
  ]
}
```

### 5.3 Derived values (never stored)

Computed by `packages/shared/engine` from the doc on every change:

- **Numbering**: `question` index → `1`; `questionPart` path → `1.2.3`. Rendered via decorations,
  so moving a question renumbers everything instantly.
- **Marks**:
  - leaf `questionPart.marks` is the source of truth
  - parent part total = sum of children → shown `(n)` right-aligned
  - question total = sum → shown `[n]` at end of question
  - section total, paper total → `TOTAL: n`
- **Page count** → fills "This question paper consists of X pages" on the cover.
- **Cognitive analysis** → marks per level vs. CAPS target %.
- **Checks** (shown in a "Paper check" panel, never blocking):
  - computed total ≠ declared total in `paperMeta`
  - a part with no marks
  - a question with no memo (in memo mode)
  - cognitive spread outside target bands

---

## 6. Editor & UX

### 6.1 Layout

```
┌ Title · autosave status · Share · Export ▾ · Account ──────────────────┐
├ Ribbon tabs: Home | Insert | Questions | Layout | Review | View ───────┤
├────────────┬───────────────────────────────────────────┬──────────────┤
│ Outline /  │                                           │ Inspector    │
│ Blocks /   │            A4 page view                   │ (selected    │
│ Bank       │      (real pages, zoom 50–200%)           │  block)      │
│ (tabs)     │                                           │ Paper check  │
├────────────┴───────────────────────────────────────────┴──────────────┤
│ Status bar: page 2 of 6 · 150 marks · words · Student ▸ Memo toggle   │
└───────────────────────────────────────────────────────────────────────┘
```

- **Left panel tabs**:
  - *Outline*: question tree with marks; drag to reorder whole questions
  - *Blocks*: preset library to drag or click
  - *Bank*: search saved questions and insert them
- **Inspector**: context settings for the selected block (marks, lines, options count, level,
  topic…).
- **Tablet (<1024px)**: side panels become slide-over drawers; ribbon collapses to icon groups.

### 6.2 Ribbon tabs

| Tab | Contents |
|---|---|
| Home | Undo/redo, font, size, B/I/U, colour, align, lists, clear formatting |
| Insert | Image, table, maths, text passage, page break, symbols |
| Questions | Question, sub-question, MCQ, True/False, match columns, blank, answer lines/box/grid, memo |
| Layout | Margins, orientation, header/footer, page numbers, columns for MCQ options, line spacing |
| Review | Paper check, cognitive grid, mark summary, spell check |
| View | Zoom, student/memo mode, show page breaks, outline |

### 6.3 Interaction details

- **Slash menu** (`/`): fuzzy search all blocks — `/mcq`, `/lines 5`, `/q`.
- **Smart Enter/Tab**:
  - In a question stem, `Enter` → new paragraph
  - `Ctrl+Enter` → next sibling part
  - `Tab` → indent into a sub-part (1.1 → 1.1.1)
  - `Shift+Tab` → outdent
- **Marks shortcut**: type `(3)` at end of a part → converts into the marks attribute.
- **Shortcuts**:
  - `Ctrl+Z`/`Y` undo/redo
  - `Ctrl+B/I/U` formatting
  - `Ctrl+P` print
  - `Ctrl+S` force-save + snapshot
  - `Ctrl+Shift+M` memo mode
- **Paste from Word/Google Docs**: cleaned to allowed nodes; numbered lists like `1.1` optionally
  converted to `questionPart`.
- **Drag handles** on every block; drop indicator lines.
- **Accessibility**: full keyboard navigation, ARIA labels on ribbon, focus rings, 4.5:1 contrast.

### 6.4 Pagination

- A ProseMirror plugin measures top-level block heights against A4 content height (from Layout
  margins) and inserts **page-gap widget decorations**. The document stays one flow; only the view
  is split into pages.
- Keep-together rules:
  - a question stem stays with its first part
  - an MCQ never splits
  - answer lines may split
  - images and tables never split unless taller than a page
- Print/PDF use CSS paged media with the **same fonts (self-hosted)**, same widths and same
  `break-inside` rules, so breaks match. A visual regression test compares editor breaks with PDF
  output.

### 6.5 Modes

- **Student paper**: memos hidden.
- **Memo**: question text plus memo content, with ticks and mark allocation; the cover says
  "MEMORANDUM".
- **Both export separately** from the same document.

---

## 7. Backend

### 7.1 Database schema (PostgreSQL)

```sql
users (
  id uuid pk, email citext unique not null, password_hash text not null,
  name text, email_verified_at timestamptz, created_at, updated_at
)
sessions (
  id uuid pk, user_id fk, token_hash text unique, expires_at timestamptz,
  user_agent text, ip inet, created_at
)
email_tokens (
  id uuid pk, user_id fk, purpose text check (purpose in ('verify','reset')),
  token_hash text, expires_at, used_at
)

organizations (
  id uuid pk, name text, kind text check (kind in ('personal','school')),
  logo_asset_id fk null, settings jsonb default '{}',   -- default header, fonts, numbering style
  created_at
)
memberships (
  org_id fk, user_id fk, role text check (role in ('owner','admin','hod','teacher')),
  primary key (org_id, user_id)
)

documents (
  id uuid pk, org_id fk, owner_id fk, title text,
  subject text, grade smallint, term smallint, paper_type text,  -- test|exam|assignment|worksheet
  content jsonb not null, schema_version int not null,
  revision int not null default 1,                               -- optimistic concurrency
  status text default 'draft',                                   -- draft|final
  total_marks int,                                               -- denormalised for dashboard
  thumbnail_asset_id fk null,
  created_at, updated_at, deleted_at                             -- soft delete (trash)
)
document_versions (
  id uuid pk, document_id fk, revision int, content jsonb,
  label text null, created_by fk, created_at
)

templates (
  id uuid pk, org_id fk null,          -- null = built-in
  name text, description text, paper_type text,
  content jsonb, created_by fk null, created_at
)

question_bank_items (
  id uuid pk, org_id fk, created_by fk,
  content jsonb,                       -- a single `question` or `questionPart` node
  subject text, grade smallint, topic text, cognitive_level text,
  marks int, tags text[],
  search tsvector generated always as (...) stored,
  created_at, updated_at
)

assets (
  id uuid pk, org_id fk, storage_key text, mime text, bytes int,
  width int, height int, created_by fk, created_at
)

export_jobs (
  id uuid pk, document_id fk, requested_by fk,
  format text check (format in ('pdf','docx')),
  variant text check (variant in ('paper','memo')),
  revision int, status text,           -- queued|running|done|failed
  asset_id fk null, error text, created_at, finished_at
)
```

On sign-up, a `personal` organisation is created automatically. Every resource belongs to an
`org_id`, so adding schools later means creating a `school` org and inviting members. No migration
of ownership is needed.

### 7.2 API routes (`/api/v1`)

| Area | Routes |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/verify-email` · `POST /auth/forgot-password` · `POST /auth/reset-password` |
| Documents | `GET /documents?q=&subject=&grade=&status=&cursor=` · `POST /documents` (blank or `fromTemplateId`) · `GET /documents/:id` · `PATCH /documents/:id` (meta) · `PUT /documents/:id/content` (`{content, baseRevision}` → 409 on conflict) · `POST /documents/:id/duplicate` · `DELETE /documents/:id` (trash) · `POST /documents/:id/restore` |
| Versions | `GET /documents/:id/versions` · `POST /documents/:id/versions` (named snapshot) · `GET /documents/:id/versions/:vid` · `POST /documents/:id/versions/:vid/restore` |
| Exports | `POST /documents/:id/exports` (`{format, variant}`) · `GET /exports/:jobId` (status + signed download URL) |
| Assets | `POST /assets/upload-url` (presigned PUT) · `POST /assets/:id/complete` · `GET /assets/:id` (signed URL) |
| Templates | `GET /templates` · `POST /templates` (save doc as template) · `DELETE /templates/:id` |
| Question bank | `GET /bank?q=&subject=&grade=&topic=&level=` · `POST /bank` · `PATCH /bank/:id` · `DELETE /bank/:id` |
| Orgs (Phase 5) | `GET /orgs` · `POST /orgs` · `POST /orgs/:id/invites` · `PATCH /orgs/:id/members/:userId` · `DELETE /orgs/:id/members/:userId` |
| Render (internal) | `GET /internal/render-token/:docId` (short-lived token for the PDF worker) |

All request and response bodies are defined as zod schemas in `packages/shared/api`. The web
client is generated from the same schemas, so a contract mismatch is a compile error.

### 7.3 Saving strategy

1. Every editor change → debounced save (1.5 s idle) via `PUT /content` with `baseRevision`.
2. Before the request, the latest doc is written to **IndexedDB**. It is cleared on success, so a
   lost connection or a closed tab never loses work. On reload, an unsaved local draft is offered
   for recovery.
3. Server increments `revision`. If `baseRevision` is stale (another tab), it returns **409**, and
   the client shows "This document changed elsewhere — reload / keep mine".
4. **Snapshots** go into `document_versions`:
   - automatically every 10 minutes of active editing
   - before every export
   - on `Ctrl+S`
   - Retention: keep all named snapshots and the last 50 automatic ones.
5. Status indicator: *Saving… / Saved / Offline — changes kept on this device*.

### 7.4 Exports

- **PDF**:
  1. Worker requests a render token
  2. Playwright opens `web/render/:id?variant=paper|memo&token=…` (a print-only route with no UI
     chrome)
  3. Waits for fonts, images and KaTeX
  4. `page.pdf({ format: 'A4', displayHeaderFooter, footerTemplate: 'Page X of Y' })`
  5. Uploads to S3 and returns a signed URL
- **DOCX**: `packages/docx-export` walks the JSON:
  - question parts → paragraphs with a **right-aligned tab stop**, so `(3)` sits at the margin
    like typed papers
  - tables → Word tables
  - answer lines → paragraphs with a bottom border
  - maths → MathML → OMML, so equations stay editable in Word
  - footer with a `PAGE`/`NUMPAGES` field
- **Print**: browser print of the same render route, opened in a hidden iframe, so it matches the
  PDF.
- Exports are cached per `(document, revision, format, variant)`, so a re-export of an unchanged
  document is instant.

### 7.5 Security

- Passwords: **argon2id**; minimum length 10; checked against a breached-password list.
- Sessions:
  - random 256-bit token in an `HttpOnly; Secure; SameSite=Lax` cookie
  - only its SHA-256 hash is stored
  - sliding 30-day expiry
  - "log out everywhere" is available
- CSRF: SameSite cookie, plus an `Origin` check and a required `X-Requested-With` header on writes.
- Authorisation: every query is scoped by membership. A central `can(user, action, resource)`
  helper is tested per role.
- Rate limits on login, register and reset; account lock-out with backoff.
- Uploads:
  - images only (MIME type sniffed from the file contents) with a size cap
  - re-encoded server-side (sharp) to strip metadata
- Document HTML is never trusted. Content is ProseMirror JSON validated against the schema; unknown
  nodes are rejected.
- **POPIA** (South African data protection):
  - collect minimal personal info
  - privacy policy
  - "export my data" and "delete my account" endpoints
  - choose hosting region accordingly

---

## 8. Testing & quality

| Level | What |
|---|---|
| Unit (Vitest) | Numbering engine, marks engine, cognitive analysis, docx mapping, schema migrations, permission helper |
| API integration | Each route against a real Postgres (Testcontainers), auth flows, 409 conflicts |
| Editor | Command tests: Tab/Shift-Tab nesting, paste conversion, marks shortcut |
| E2E (Playwright) | Create paper from template → edit → autosave → reload → export PDF/DOCX |
| Visual | Snapshot of rendered PDF pages for fixtures; editor page breaks vs. PDF page breaks |
| CI | Lint, typecheck, unit, integration, e2e on every PR |

---

## 9. Delivery phases

Each phase ends in something usable. Acceptance criteria in **bold**.

### Phase 0 — Foundations
- pnpm monorepo, shared configs, Docker Compose (Postgres, Redis, MinIO, Mailpit)
- Fastify skeleton, Drizzle schema and migrations, auth module, email
- CI pipeline
- **A user can register, verify their email, log in and log out; CI is green.**

### Phase 1 — Editor core
- TipTap setup; nodes: paragraph, heading, lists, table, image, `question`, `questionPart`,
  `mcq`, `trueFalse`, `answerLines`, `answerBox`, `section`, `instructions`
- Numbering and marks engine in `shared`, rendered via decorations
- Ribbon (Home, Insert, Questions), slash menu, Inspector, Outline, shortcuts, smart Tab/Enter
- **A teacher can type a 3-question CAPS paper with sub-questions using the keyboard only;
  numbering and totals are always correct after reordering.**

### Phase 2 — Pages & export
- Pagination plugin, Layout tab (margins, header/footer, page numbers), `coverPage`
- Render route, PDF worker, DOCX exporter, print
- **The PDF and print output match the on-screen pages; the DOCX opens cleanly in Word with marks
  aligned at the right margin.**

### Phase 3 — Saving & dashboard
- Documents API, autosave with IndexedDB buffer, conflict handling, version history UI
- Dashboard: list, search, filter, duplicate, trash
- Org settings: logo, school name, default cover page
- Built-in templates: Test, Exam, Assignment, Worksheet, Homework
- **Closing the tab mid-edit loses nothing; any earlier version can be restored.**

### Phase 4 — Teacher power tools
- `memo` node, Student ↔ Memo mode, memo export
- Cognitive-level tagging, analysis grid, Paper check panel
- Question bank (save, search, insert), user templates
- `matchColumns`, `fillBlank`, `textPassage`, maths (KaTeX/MathLive), grid space
- **One document produces both the question paper and the memo; the cognitive grid matches a
  hand-calculated example.**

### Phase 5 — Schools
- School organisations, invites, roles, shared bank and templates
- Document sharing (view/comment/edit) and moderation workflow (draft → moderated → final)
- Version A/B (shuffle questions or options)
- Later: real-time co-editing (Yjs + Hocuspocus)
- **A head of department can create a school, invite teachers and see shared papers.**

---

## 10. Migration from the prototype

- Build on a new branch (`rebuild`); the current app stays on `main` until Phase 3 is complete.
- Reuse: Tailwind theme tokens, shadcn components, template content ideas.
- Discard: the component-list store, `PageCanvas` renderers, and the duplicate print CSS.
- Prototype documents are not persisted anywhere, so no data migration is needed.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Editor page breaks drift from PDF breaks | Same fonts/CSS, a shared measurement algorithm, visual regression tests; PDF is the authority for the page count |
| ProseMirror learning curve / custom node complexity | Build the numbering engine as pure functions first (fully unit-tested), keep node views thin |
| DOCX fidelity (maths, complex tables) | Phase 2 covers core nodes; maths via MathML→OMML in Phase 4; document known limits |
| Chromium in production is heavy | Separate worker container, concurrency limit, export cache |
| Building our own auth | Small surface, well-tested library primitives (argon2, crypto), rate limiting, security review before launch |
| Scope creep | Phase acceptance criteria are the gate; nice-to-haves go to a backlog |

---

## 12. Open questions

1. **Product name and domain**: keep "Teacher Paper Builder"?
2. **Hosting**: South African region (for POPIA and latency), or EU with a POPIA-compliant
   agreement?
3. **Languages**: do papers need **Afrikaans / bilingual** (English + Afrikaans side by side)
   layouts? This affects the node design if yes.
4. **Default font and size** for CAPS papers (e.g. Arial 11/12) and default margins.
5. **Subjects in v1**: any subject-specific needs early on (Maths formulas, Accounting tables,
   Geography maps)?
6. **Monetisation**: free, freemium (limits on exports or the bank), or school licences? This
   affects the org/billing tables.
