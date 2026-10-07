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
7. **Place anything, anywhere — precisely.** Boxes, images and labels can be dragged freely, with
   snapping to margins, grid, guides and other objects, so things line up without effort.
8. **Show me it's neat.** The app can prove a page is aligned and consistent, and tidy it in one
   click.
9. **Structure survives layout.** Moving things around never breaks numbering, marks or the memo.

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
| Move / resize / rotate | **Moveable** + **Selecto** (daybrush) | Drag, resize, rotate, marquee multi-select, snap guidelines, gap snapping |
| Geometry & snapping | Own pure-TS engine in `packages/shared/geometry` | Deterministic, unit-tested, same maths in editor and print |
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

**Layout** (see section 7)

| Node | Purpose |
|---|---|
| `layoutRow` + `layoutColumn` | Side-by-side blocks inside the flow (e.g. diagram beside its question, Column A/B). Column widths in % with snap presets |
| `floatingObject` | A freely positioned box (text box, image, shape, label, marks box, stamp). Stored as a child of the block it is anchored to, so it moves when that block moves |
| `pageLayer` | Holds objects pinned to a page (`page: 3`) or to every page (logo, watermark) |
| `guide` | A user ruler guide (horizontal/vertical, position in mm), stored in `paperMeta.guides` |

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

A floating label anchored to a question part:

```json
{
  "type": "floatingObject",
  "attrs": {
    "id": "fo_31c",
    "kind": "textBox",
    "anchor": { "to": "block", "offset": { "x": 120.0, "y": 4.5 } },
    "size": { "w": 40.0, "h": 12.0 },
    "rotation": 0,
    "z": 2,
    "wrap": "inFront",
    "locked": false,
    "style": { "border": "1pt solid", "fill": null, "padding": 2, "radius": 1 }
  },
  "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Label A" }] }]
}
```

All positions and sizes are in **millimetres** (0.1 mm precision), never pixels, so zoom, screen
size and print never change where things sit.

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
┌ Title · autosave status · Share · Export ▾ · Account ──────────────────────┐
├ Ribbon: Home | Insert | Questions | Arrange | Layout | Review | View ──────┤
├────────────┬──┬─────────────────────────────────────────┬─────────────────┤
│ Outline /  │  │ ┌ top ruler (mm, margins, indents) ────┐│ Inspector       │
│ Blocks /   │ l│ │                                       ││ (selected block │
│ Bank       │ e│ │        A4 page view                   ││  or object:     │
│ (tabs)     │ f│ │  (real pages, zoom 25–400%,           ││  X/Y/W/H, anchor│
│            │ t│ │   guides, grid, smart guides)         ││  wrap, marks…)  │
│            │  │ │                                       ││ Paper check     │
│            │  │ └───────────────────────────────────────┘│ Alignment check │
├────────────┴──┴─────────────────────────────────────────┴─────────────────┤
│ Status: p.2/6 · 150 marks · Snap ▾ · Write|Arrange · Student|Memo · 100%  │
└───────────────────────────────────────────────────────────────────────────┘
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
| Arrange | Text box, shape, label, side-by-side row · align (left/centre/right/top/middle/bottom) · "align to" Selection/Margins/Page · distribute · match size · group/lock · bring forward/send back · anchor & wrap |
| Layout | Margins, orientation, header/footer, page numbers, columns for MCQ options, line spacing, density, fit to pages |
| Review | Paper check, alignment check, tidy up, cognitive grid, mark summary, spell check, comments |
| View | Zoom, student/memo/variant preview, rulers, grid, guides, margins, bounding boxes, formatting marks (¶), snap toggles, Write/Arrange mode |

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
- **Drag handles** on every block; drop indicator lines (full detail in section 7).
- **Floating toolbar** next to the selection (bold, marks, lines, level, move up/down), so the
  ribbon is optional for common actions.
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

## 7. Layout & arrangement system

Word-style flow is best for typing; teachers also need to place things exactly where they want
them. The editor combines **three layout layers**, each with the right kind of movement:

| Layer | What lives there | How it moves |
|---|---|---|
| **Flow** | Questions, text, tables, answer space | Drag to reorder; reflows across pages; auto-numbered |
| **Layout rows** | Side-by-side blocks in the flow: diagram beside question, MCQ options in a 2×2 grid, Column A / Column B | Drop a block onto the side of another to make a row; drag the divider; widths snap to 50/50, 33/67, 25/75 |
| **Floating objects** | Text boxes, images, shapes, arrows, diagram labels, marks boxes, logos, stamps, "For examiner use" grids, watermarks | Free move / resize / rotate with snapping and alignment tools |

**Rule that keeps the paper safe:** numbered questions always live in the flow. Floating objects
are decoration and annotation, so moving them can never break numbering, marks or the memo.

### 7.1 Floating objects

- **Anchor** (shown as a small ⚓ while selected; drag it to re-anchor):
  - *To a block* (default): the object moves with its question when content reflows to another
    page.
  - *To a page*: fixed position on page N (e.g. an "Official use" box on page 1).
  - *To every page*: repeated art, watermark, "DRAFT" stamp.
- **Text wrap**:
  - *In front of text* / *Behind text*: no effect on the flow.
  - *Top & bottom*: the flow is pushed below the object.
  - *Square left/right*: text runs beside the object (Phase 5; it is the hardest to get exactly
    right in both the editor and PDF).
- **Properties** (Inspector): X, Y, W, H in mm/cm/in, rotation, 9-point reference anchor, z-order,
  lock, opacity, border, fill, padding, corner radius.
- **Content**: text boxes hold paragraphs, maths, images and tables, but not numbered questions.
- **Safety**:
  - Deleting a block that has anchored objects asks whether to delete them too or re-anchor them
    to the page.
  - A page-pinned object whose page no longer exists moves to the last page, with a warning.

### 7.2 Selecting & moving

| Action | Mouse / touch | Keyboard |
|---|---|---|
| Select | Click / tap | `Tab` cycles objects in Arrange mode |
| Multi-select | Shift/Ctrl-click; marquee drag from empty page space | `Ctrl+A` (all objects on page, Arrange mode) |
| Move | Drag | Arrows = 0.5 mm, `Shift`+arrows = 5 mm |
| Duplicate | `Alt`+drag | `Ctrl+D` |
| Resize | 8 handles; `Shift` keeps proportions; `Alt` resizes from centre | Inspector W/H |
| Rotate | Rotation handle, snaps to 15° (`Shift` = free) | Inspector |
| Cancel a drag | `Esc` mid-drag returns the object to where it started | |
| Group / ungroup | Context menu | `Ctrl+G` / `Ctrl+Shift+G` |
| Lock / unlock | Lock icon | `Ctrl+L` |
| Reorder flow blocks | Drag ⋮⋮ handle (a whole question moves with its sub-parts); drag in Outline | `Alt+↑ / Alt+↓` |
| Make a side-by-side row | Drop a block on the left/right edge of another | Arrange → "Place side by side" |

**Write mode vs Arrange mode** (toggle in the status bar, `Ctrl+Shift+A`):

- *Write mode* (default) is for typing. Floating objects can still be moved.
- *Arrange mode* turns off text editing. Every block shows its outline and handles, so on a tablet
  a finger drag always moves the box instead of selecting text by accident.

### 7.3 Snapping

Each snap target can be switched on or off from the **Snap ▾** popover in the status bar and from
the View tab. Settings are remembered per user.

| Snap to | What it does |
|---|---|
| **Margins** | Page content edges and the binding gutter |
| **Page centre** | Horizontal and vertical centre lines |
| **Grid** | Default 5 mm (1–20 mm); can be shown as faint dots |
| **Ruler guides** | User guides dragged out of the rulers |
| **Objects** (smart guides) | Edges and centres of nearby objects and flow blocks |
| **Equal spacing** | Shows `=` markers when gaps between three or more objects match, and snaps to equal spacing |
| **Text lines** | Aligns a label with the baseline of a question line or answer line |
| **Columns** | Layout-row dividers and the marks column |

Behaviour:

- The snap distance is 4 screen pixels at any zoom, so snapping feels the same at 50% and 200%.
- Coloured guide lines appear while dragging, along with **distance labels in mm** to the nearest
  margin and neighbours.
- Holding `Alt` while dragging turns snapping off temporarily; `Ctrl+;` switches all snapping on
  or off.
- The snapping maths is a pure function, `snap(rect, targets, threshold) → { rect, guides }`, in
  `packages/shared/geometry`, with full unit tests.

### 7.4 Align, distribute & size

Arrange tab and right-click menu:

- **Align**: left, centre, right, top, middle, bottom.
- **Align to**: *Selection* | *Margins* | *Page*, like Word's "Align to" option. With one object
  selected, it aligns to the margins.
- **Distribute** horizontally or vertically (equal gaps).
- **Match** width, height or both, using the first selected object.
- **Position presets**: a 9-point grid (top-left … bottom-right of the margins).
- Flow blocks: block alignment (left/centre/right) and indent steps that snap to the grid.

### 7.5 Rulers & guides

- **Top and left rulers** in mm (cm or inches optional). Margins are shaded and can be **dragged
  to change the page margins**, like in Word.
- With a block selected, the top ruler shows **indent markers** (first line, hanging) and **tab
  stops**, so the marks column can be set by clicking the ruler.
- **Guides**:
  - Drag from a ruler to create a guide.
  - Double-click a guide to type an exact position.
  - Guides can be locked or cleared.
  - Ready-made guides: "Marks column" (right margin − 15 mm), "Number column" (left margin
    + 10 mm), "Centre".
- Guides are saved with the document and also apply in templates.

### 7.6 Alignment check ("Is everything in line?")

Toggle **View → Show alignment**, or run **Review → Alignment check**:

- **Edge map**: thin coloured lines show every distinct left and right edge used on the page.
  Edges within 3 mm of each other that are not exactly equal are highlighted amber as "almost
  aligned", which is where things look untidy.
- **Checks**:
  - question numbers not on the same indent
  - marks not sitting in the marks column
  - answer lines with different start points or lengths in the same question
  - MCQ options not lined up
  - objects crossing the margins, going off the page, or overlapping text by mistake
  - uneven spacing between questions
  - mixed font sizes for the same role (e.g. two sizes of question text)
  - images below 150 dpi at print size
- Each issue appears in the panel. Clicking it jumps to the spot and highlights it.
- **Fix** (one issue) and **Tidy up** (all issues) snap each item to the nearest consistent value.
  Every fix is one undo step.

### 7.7 Implementation notes

- **Overlay**: each page gets an absolutely positioned overlay layer above the editor content.
  Floating objects are drawn there in mm, scaled by zoom. Moveable handles drag, resize, rotate and
  snap; Selecto handles marquee selection.
- **One undo history**: during a drag, the position lives only in temporary UI state. On drop, it
  is committed as **one ProseMirror transaction**. As a result:
  - one drag = one undo step
  - the document stays the single source of truth
  - it works with real-time co-editing later
- **Print fidelity**: the print/PDF render places objects using the same mm values in CSS, and the
  DOCX export writes them as Word anchored frames and images with absolute positions.
- **Performance**: snap targets come only from the current and neighbouring pages and are indexed
  in a simple spatial grid, so dragging stays at 60 fps on long papers.

---

## 8. Usability toolkit (beyond Word)

Features chosen because teachers keep doing these jobs by hand. The phase each one lands in is
shown as (P1)–(P6).

### 8.1 Speed

- **Command palette** `Ctrl+K` (P1): every action is searchable, e.g. "add 4 answer lines", "MCQ
  in 2 columns", "export memo", "go to question 5".
- **Type-to-format shortcuts** (P1):
  - `1.` at line start → question
  - `a)` → MCQ options
  - `(3)` → marks
  - `___` → blank
  - `---` → page break
- **Styles** (P2): named styles (Question text, Instruction, Passage, Heading). Change a style once
  and every block using it updates. **Format painter** included.
- **Bulk edit in the Outline** (P5): select several questions, then set marks or cognitive level,
  move them to a section, save them to the bank, or delete them.
- **Import an existing paper** (P5): upload a .docx (or paste from Word). The importer finds
  questions, numbering, marks and MCQ options and turns them into blocks. A review screen shows
  what was detected before anything is applied.
- **Find & replace** across the paper and memo (P2).

### 8.2 Making it fit

- **Density slider** (P3), compact ↔ spacious: adjusts spacing between questions and answer-line
  height across the whole paper.
- **Fit to N pages** (P3): automatically adjusts spacing, answer-line counts (within limits you
  set), MCQ option columns and image sizes to reach a target page count. It shows a before/after
  preview before applying.
- **Automatic answer space** (P3): a rule such as "2 lines per mark", with per-question overrides.
- **Page control per question** (P2): keep together, start on new page, keep with next; widow and
  orphan control.
- **CAPS print conventions, automatic** (P2):
  - "Please turn over" at the foot of every page except the last
  - "Page X of Y"
  - a blank page reading "This page was intentionally left blank" inserted when needed to give an
    even page count for double-sided printing

### 8.3 Many versions from one document

These are previews and exports, not copies, so editing the paper updates all of them.

| Variant | What changes |
|---|---|
| Student paper (P2) | Memos hidden |
| Memorandum (P5) | Answers, ticks and mark allocation shown; "MEMORANDUM" cover |
| Answer sheet (P5) | MCQ bubble grid plus numbered answer boxes, on a separate sheet |
| Large print (P5) | E.g. 18 pt, wider line spacing, larger answer space; layout reflows automatically |
| Dyslexia-friendly (P5) | Readable font, extra spacing, optional cream background |
| Low-ink (P3) | Fills removed and greyscale-safe borders, with a warning for colour-only meaning |
| Version A / B (P6) | Question order and/or option order shuffled; the memo follows the shuffle |

### 8.4 Print-smart

- **Print preview** (P3): two-page spreads for double-sided printing, greyscale preview, and the
  photocopier safe zone (warning when something sits within 5 mm of the paper edge).
- **Booklet and 2-up** (P6): A5 fold-over booklet with pages in the correct folding order, or two
  pages per sheet.
- **Copies calculator** (P3): learners × pages → sheets and reams needed.

### 8.5 Diagram tools

- **Label tool** (P4):
  - click a point on an image to add a leader line and a label box
  - labels letter themselves (A, B, C…) and line up neatly in a label column
  - the memo version fills in the answers
- **Shapes and arrows** (P4) with snapping. Image crop, rotate and flip (P4).
- **Generators** (P5): number line, axes/graph grid, fraction strips, tally table, all with
  settings in the Inspector.

### 8.6 Confidence & safety

- **History panel** (P4): a named undo list ("Moved Question 3", "Changed marks 1.2 → 4"); click
  any entry to go back.
- **Undo toast** after deletes (P1): "Question 4 deleted · Undo".
- Autosave status, offline buffer and version history (P1/P4).
- **Paper check** and **Alignment check** (P3/P5) catch mistakes before printing.

### 8.7 Learnability

- A first-run **guided tour** and a template picker for an empty document (P4).
- **Tooltips** show the keyboard shortcut for every button (P1).
- Contextual **floating toolbar**; right-click menus on everything (P1).
- **Touch**:
  - long-press opens the context menu
  - larger handles on touch screens
  - Arrange mode for safe dragging (P3)

### 8.8 Moderation (P6)

- Comments pinned to questions or to a spot on the page.
- Moderator suggestions that the teacher can accept or reject.
- A sign-off stamp with name and date. The paper is locked once it is marked final.

---

## 9. Backend

### 9.1 Database schema (PostgreSQL)

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

### 9.2 API routes (`/api/v1`)

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

### 9.3 Saving strategy

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

### 9.4 Exports

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

### 9.5 Security

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

## 10. Testing & quality

| Level | What |
|---|---|
| Unit (Vitest) | Numbering engine, marks engine, cognitive analysis, docx mapping, schema migrations, permission helper |
| API integration | Each route against a real Postgres (Testcontainers), auth flows, 409 conflicts |
| Editor | Command tests: Tab/Shift-Tab nesting, paste conversion, marks shortcut |
| E2E (Playwright) | Create paper from template → edit → autosave → reload → export PDF/DOCX |
| Geometry | Snapping, alignment, distribution and Tidy up as pure functions with fixture layouts |
| Interaction (Playwright) | Drag, resize, rotate, marquee, nudge, snap toggles, Write/Arrange mode on desktop and tablet viewports |
| Visual | Snapshot of rendered PDF pages for fixtures; editor page breaks vs. PDF page breaks |
| CI | Lint, typecheck, unit, integration, e2e on every PR |

---

## 11. Delivery phases

Each phase ends in something usable. Acceptance criteria in **bold**. Feature tags (P1)–(P6) in
section 8 refer to these phases.

### Phase 0 — Foundations
- pnpm monorepo, shared configs, Docker Compose (Postgres, Redis, MinIO, Mailpit)
- Fastify skeleton, Drizzle schema and migrations, auth module, email
- CI pipeline
- **A user can register, verify their email, log in and log out; CI is green.**

### Phase 1 — Editor core
- TipTap setup; nodes: paragraph, heading, lists, table, image, `question`, `questionPart`,
  `mcq`, `trueFalse`, `answerLines`, `answerBox`, `section`, `instructions`
- Numbering and marks engine in `shared`, rendered via decorations
- Ribbon (Home, Insert, Questions), slash menu, command palette, type-to-format shortcuts,
  floating toolbar, Inspector, Outline, smart Tab/Enter
- Block drag-and-drop with drop indicators; undo toast after deletes
- Basic documents API and autosave with the IndexedDB buffer, so work is never lost from day one
- **A teacher can type a 3-question CAPS paper with sub-questions using the keyboard only;
  numbering and totals are always correct after reordering; closing the tab loses nothing.**

### Phase 2 — Pages, styles & export
- Pagination plugin, `coverPage`, page control per question (keep together, new page)
- Layout tab: margins, header/footer, page numbers, CAPS print conventions
- Named styles, format painter, find & replace
- Render route, PDF worker, DOCX exporter, print
- **The PDF and print output match the on-screen pages; the DOCX opens cleanly in Word with marks
  aligned at the right margin.**

### Phase 3 — Layout & arrangement
- Geometry and snapping engine in `shared` (unit-tested first)
- Rulers with draggable margins, indent markers and tab stops; ruler guides and ready-made guides
- `floatingObject` (text box, image, shape) with block/page/every-page anchors and
  in front / behind / top & bottom wrap
- `layoutRow` side-by-side blocks with snapping column widths
- Moveable + Selecto overlay: move, resize, rotate, marquee multi-select, group, lock, z-order,
  arrow-key nudging
- Snap toggles (margins, centre, grid, guides, objects, equal spacing, text lines, columns),
  distance labels, `Alt` to bypass
- Arrange tab: align, align to selection/margins/page, distribute, match size, position presets
- Write / Arrange mode
- Alignment check panel, edge map, Fix and Tidy up
- Density slider, fit to N pages, automatic answer space, print preview, low-ink variant, copies
  calculator
- Floating objects in PDF and DOCX export
- **A teacher can place a labelled diagram beside a question, drag three text boxes into perfect
  alignment using only snapping, and get exactly that layout in the PDF and the DOCX. Alignment
  check reports zero issues on the built-in templates.**

### Phase 4 — Dashboard, history & diagrams
- Dashboard: list, search, filter, duplicate, trash
- Version history UI, named snapshots, History panel, conflict handling
- Org settings: logo, school name, default cover page
- Built-in templates: Test, Exam, Assignment, Worksheet, Homework
- Label tool, shapes and arrows, image crop/rotate/flip
- First-run tour and template picker
- **Any earlier version can be restored; a teacher can label a diagram (A–D) in under a minute.**

### Phase 5 — Teacher power tools
- `memo` node, Student ↔ Memo mode, memo export
- Cognitive-level tagging, analysis grid, Paper check panel
- Question bank (save, search, insert), user templates, bulk edit in Outline
- Import existing .docx papers
- `matchColumns`, `fillBlank`, `textPassage`, maths (KaTeX/MathLive), grid space, generators
- Variants: answer sheet, large print, dyslexia-friendly; square text wrap
- **One document produces the question paper, memo, answer sheet and large-print version; the
  cognitive grid matches a hand-calculated example.**

### Phase 6 — Schools & moderation
- School organisations, invites, roles, shared bank and templates
- Sharing (view/comment/edit), comments, moderator suggestions, sign-off, final lock
- Version A/B, booklet and 2-up printing
- Later: real-time co-editing (Yjs + Hocuspocus)
- **A head of department can create a school, invite teachers, moderate a paper and sign it
  off.**

---

## 12. Migration from the prototype

- Build on a new branch (`rebuild`); the current app stays on `main` until Phase 2 is complete (the new app can then save, print and
  export).
- Reuse: Tailwind theme tokens, shadcn components, template content ideas.
- Discard: the component-list store, `PageCanvas` renderers, and the duplicate print CSS.
- Prototype documents are not persisted anywhere, so no data migration is needed.

---

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Editor page breaks drift from PDF breaks | Same fonts/CSS, a shared measurement algorithm, visual regression tests; PDF is the authority for the page count |
| ProseMirror learning curve / custom node complexity | Build the numbering engine as pure functions first (fully unit-tested), keep node views thin |
| DOCX fidelity (maths, complex tables) | Phase 2 covers core nodes; maths via MathML→OMML in Phase 4; document known limits |
| Chromium in production is heavy | Separate worker container, concurrency limit, export cache |
| Building our own auth | Small surface, well-tested library primitives (argon2, crypto), rate limiting, security review before launch |
| Free positioning conflicts with reflowing content | Numbered content always stays in the flow; floating objects anchor to a block by default, so they move with their question; clear rules for deleted anchors and missing pages |
| Text wrap around floating objects is hard in a flow editor | v1 supports in front / behind / top & bottom only; square wrap comes in Phase 5, behind visual tests |
| Dragging vs. selecting text on tablets | Write / Arrange modes; larger touch handles; long-press menus |
| Snapping feels jumpy or slow on long papers | Zoom-independent threshold, snap targets limited to nearby pages with a spatial index, `Alt` to bypass; performance budget of 60 fps tested in CI |
| "Fit to N pages" gives odd results | Bounded adjustments within teacher-set limits, preview before apply, always one undo step |
| Scope creep | Phase acceptance criteria are the gate; nice-to-haves go to a backlog |

---

## 14. Open questions

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
