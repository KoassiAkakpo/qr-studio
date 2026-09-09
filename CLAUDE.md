# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev        # next dev
npm run build      # next build — also runs the TS check (tsconfig is noEmit)
npm run lint       # bare `eslint` (flat config); no `next lint`
npm test           # vitest run
npm run test:watch # vitest, watch mode
npx tsc --noEmit   # type-check without a full build
npx vitest run lib/qr-payloads.test.ts        # a single test file
npx vitest run -t "place la civilité"          # a single test by name
```

Vitest is configured in `vitest.config.mts` (node environment, `@/*` alias, only
`lib/**/*.test.ts` is collected — which is why pure logic belongs in `lib/` even
when it only serves one component, as `lib/dropzone-messages.ts` does). Test names and comments in the test suite are in
French, matching the audit notes in [PLAN.md](PLAN.md). There is no CI config.

`lib/qr-payloads.test.ts` locks down the wire format of every payload type. **Treat a
failure there as a real regression**, not a test to update: those assertions encode
RFC-level requirements (iCalendar/vCard escaping, `N:`/`ORG:` component order, `%20`
vs `+` in mailto) that were each shipped broken at some point. Change an expectation
only with a spec reason.

## Architecture

Single-page Next.js 16 App Router app (React 19). Everything is client-side — no API routes, no server actions, no persistence, no network calls at runtime. QR rendering, spreadsheet parsing, and ZIP building all happen in the browser.

The whole app is one route, [app/page.tsx](app/page.tsx), which owns all state (`mode`, `type`, `formData`, `appearance`) and passes it down. Child components are controlled and stateless with respect to that data: they take `value`/`onChange` pairs and never hold their own copy.

### The two orthogonal axes

Almost every change touches one of two independent concerns, and keeping them separate is the point of the file layout:

1. **Payload** — *what string* gets encoded, per QR type. Lives entirely in [lib/qr-payloads.ts](lib/qr-payloads.ts).
2. **Appearance** — *how* that string is drawn. Lives entirely in [lib/qr-appearance.ts](lib/qr-appearance.ts).

`buildQrPayload(formData) -> string` and `appearanceToStylingOptions(appearance, payload)` are the two seams. `QrPreview` and `renderQrPngBlob` only ever see the finished payload string plus a `QrAppearance`, never form data.

### Adding or changing a QR type

`QrType` is a 9-member union and `QrFormData` is a discriminated union on `type`. Because the switch statements return from every branch with no `default`, adding a member to `QrType` makes TypeScript flag every place that must be updated. Expect to touch all of these:

- [lib/qr-payloads.ts](lib/qr-payloads.ts): the `QrType` union, a `…Data` interface, a `QrFormData` arm, `QR_TYPE_META` (label/placeholder/hint), `defaultDataFor`, `buildQrPayload`, and the three batch helpers `templateHeadersFor` / `templateRowFor` / `rowToFormData`.
- [components/type-forms.tsx](components/type-forms.tsx): a `TypeForm` case.
- [app/page.tsx](app/page.tsx): an entry in `TYPE_ICONS` — the only thing left outside `lib/`, because icons are JSX. It is typed `Record<QrType, ReactNode>`, so TypeScript refuses to compile until you add it.

`TYPE_ORDER` is derived from `QR_TYPE_META`'s keys, not maintained by hand, and drives both the sidebar and the batch `Select`. A new type appears in both automatically.

Encoding conventions established in `buildQrPayload`: `mailto:` built by hand with `encodeURIComponent` (**never `URLSearchParams`** — it encodes spaces as `+`, which mail clients show literally), `tel:`/`smsto:`, `WIFI:` with `escapeWifi`, `geo:`, `VEVENT` inside a full `VCALENDAR` envelope, vCard 3.0. `ensureUrl` prepends `https://` only when no scheme is present.

Three escaping rules that are easy to get wrong:

- `escapeText` covers both vCard and iCalendar TEXT values (same rules in RFC 6350 §3.4 and RFC 5545 §3.3.11). Every free-text value must go through it — an unescaped newline produces an orphan line that invalidates the whole payload.
- Structured values (`N:`, `ORG:`) use `structured()`, which escapes each component and joins with raw `;`. Never escape the component separator itself.
- `buildQrPayload` **must stay pure** — it runs inside a `useMemo`, so a `Date.now()` or random UID would change the payload on every keystroke and redraw the QR endlessly. The calendar `UID` is a `stableHash` of the event fields and `DTSTAMP` is derived from the start date for exactly this reason.

Calendar times are deliberately *floating local* (`toVEventDate`, no `Z`, no TZID). Excel date cells arrive as `Date` objects (`cellDates: true`) and go through `toDateTimeLocal`, which rounds to the minute — the Excel float renders 18:00 as 17:59:59.999.

### Batch mode

[components/batch-mode.tsx](components/batch-mode.tsx) is a three-step flow: download an `.xlsx` template → import a filled sheet → export a ZIP of PNGs. It shares the same appearance object as single mode — `AppearancePanel` is rendered in both tabs against the same `appearance` state, so a change made in one is immediately in effect in the other.

- Only the **first sheet** is read, and only the first `MAX_ROWS` (500) rows — beyond that the file is truncated and a warning says so.
- `rowToFormData` returns `null` for a row whose required fields are missing or malformed; those rows are counted as invalid and skipped rather than failing the import. Messages report `r.index + 2` to match the spreadsheet's 1-based numbering with a header row.
- An optional `filename` column overrides the derived name (`labelForRow` → `slugify`). Names then go through `dedupeFilenames`, **which is not optional**: JSZip accepts two entries with the same name and extraction silently overwrites one. Deduping is case-insensitive because macOS and Windows treat `A.png` and `a.png` as the same file, and it only runs across the rows that actually reach the ZIP so an invalid row cannot consume a name.
- ZIP export renders rows sequentially (`await`-per-row on purpose, to keep the tab responsive) and is cancellable through `cancelRef`, checked at the top of each iteration. A ref rather than state, so the running loop sees the change immediately.
- **`warning` and `error` are separate states.** `error` means the operation failed; `warning` means it succeeded with caveats (truncation, skipped rows, a cancelled export). Collapsing them is what made a successful import show a red alert.

`templateHeadersFor` must expose every field `rowToFormData` reads, or those columns are unreachable from an import — the `person` template silently omitted six of them. A test in `lib/qr-payloads.test.ts` asserts the two sets match for every type, so the drift cannot come back.

**`xlsx` is vendored, not installed from npm.** `package.json` points at `file:vendor/xlsx-0.20.3.tgz`, the publisher's own archive. Never "fix" this by running `npm install xlsx` — the npm registry stops at 0.18.5, which carries two unpatched high-severity advisories (prototype pollution, ReDoS) in the code path that parses user-supplied spreadsheets. [vendor/README.md](vendor/README.md) records the provenance, the sha256, and the upgrade procedure. `npm audit` must stay at zero.

`lib/excel.test.ts` runs real workbooks through `parseExcelFile`, so it is the guard that makes changing the spreadsheet library verifiable rather than a guess. `XLSX.writeFile` (used by `downloadTemplate`) is browser-only and therefore not covered — check it by hand in the batch tab after any version bump.

### File pickers

Both file inputs are `@mantine/dropzone` zones behind one wrapper,
[components/file-dropzone.tsx](components/file-dropzone.tsx).
There is no bare `FileInput` left, and `<input type="file">` should not come back
by hand.

- **`accept` maps each MIME type to its extensions**, and both halves earn their
  place: `attr-accept` matches the file's MIME type *or* the end of its name, and
  a `.csv` arrives labelled `application/vnd.ms-excel` from Excel or with no type
  at all from an archive. A MIME-only map silently rejects those files.
- Type and size are enforced declaratively (`accept`, `maxSize`, `multiple={false}`),
  so the `onFile` handlers only read the file. Do not re-check the size in the
  handler — the limit would then live in two places.
- **The zone's content is inert** (`pointer-events: none`, set by Mantine), which is
  what lets the logo thumbnail sit inside as the drop target's icon. Buttons must
  therefore live *beside* the zone, never inside it — that is why “Remove” sits on
  the size row.
- `onReject` fires *before* `onDrop`. Dropping one good and one bad file shows the
  error and then clears it, which is the intended outcome; do not "fix" it by
  reordering.
- `describeRejection` in [lib/dropzone-messages.ts](lib/dropzone-messages.ts) collapses
  react-dropzone's per-file error list into one message, preferring type over size
  over count. It is pure and tested; the raw library message is only a fallback for
  an unexpected code.
- The zone root is a tabbable `div` with no label of its own, so `inputLabel` is
  required and lands on the hidden input as `aria-label`.

### Rendering and export

`qr-code-styling` is used two different ways from [components/qr-preview.tsx](components/qr-preview.tsx):

- **Preview**: `type: "svg"`, one long-lived `QRCodeStyling` instance kept in a ref and mutated via `.update()` on each change — never re-instantiated, or the DOM node is orphaned.
- **Export**: a throwaway `type: "canvas"` instance and `getRawData("png")`, then the caption is composited on a 2D canvas because `qr-code-styling` cannot draw text.

The library sizes its SVG to the *export* resolution (`appearance.size`, default 640). The `.qr-preview-stage` rule at the bottom of [app/globals.css](app/globals.css) clamps it to the container — without it the preview overflows the layout horizontally.

`appearanceToStylingOptions` must emit **every** optional key on every call, `undefined` included — `gradient` on the three shape sections, and `image`. `QRCodeStyling.update()` deep-merges into the previous options, so a key that is merely *omitted* keeps its old value: dropping `gradient` in solid mode left the previous gradient painted on the code and switching back to a solid colour did nothing. Conditional spreads (`...(x ? {a} : {b})`) are the shape to avoid here. `lib/qr-appearance.test.ts` asserts the keys are present.

**Preview/export parity is the contract here.** The caption used to exist only in the preview, so exported PNGs silently lacked it. Anything added to the preview must also be drawn in `renderQrPngBlob`, and both sides must derive shared values from the same helper — `captionColorFor` and `captionFontSize` in [lib/qr-appearance.ts](lib/qr-appearance.ts) exist so the two cannot drift.

`captionFontSize` scales the exported caption by `PREVIEW_CAPTION_FONT_SIZE / PREVIEW_QR_WIDTH`, and `QrPreview` takes its non-compact `maxWidth` from that same `PREVIEW_QR_WIDTH`. **Resizing the preview means changing the constant, not the component** — hard-coding a new width there would silently make every exported caption the wrong size relative to the code. A test pins the fixed point: `captionFontSize(PREVIEW_QR_WIDTH) === PREVIEW_CAPTION_FONT_SIZE`.

Three traps in the compositing code:

- `ImageBitmap.close()` resets `width`/`height` to **0**. Read the dimensions into locals before closing, or the caption gets drawn over the QR instead of below it — which is exactly the bug that shipped in the first draft of this function.
- `await document.fonts.ready` before `fillText`, otherwise the first export of a session uses the fallback font.
- A canvas 2D context is not available in every environment; the function degrades to the plain QR blob rather than throwing.

Capacity is enforced *before* generation, never by catching: `exceedsCapacity` (a static version-40 byte table per ECL, validated against the real generator in `lib/qr-appearance.test.ts`) is computed during render, gates the image-producing buttons, and shows the byte budget in the badge. The `try`/`catch` around `.update()` is only a net for unexpected library throws — without it, an overflow escapes the effect and takes down the tree, since there is no error boundary. The failure is keyed to a `payload|ecl` signature so it expires during render rather than being cleared by a second `setState`.

## Layout

The Single tab is a two-column grid, `.qr-single-grid`: a `minmax(0, 1fr)` column
holding the form card *and* the Appearance card, then a 420px `.qr-sticky-aside`
holding the preview and the export actions. Below `75em` the columns stack and the
aside drops back to `position: static`, since a sticky panel with nothing beside it
would just cover the form.

**The Appearance card must stay inside the left grid column.** Moving it to a
full-width band under the grid ends the aside's grid row, the preview unsticks
immediately, and you are back to styling a QR you cannot see — which is the exact
problem this layout was built to fix. Measured before: the preview and the logo
dropzone sat 1218px apart with nothing sticky between them.

Two supporting rules earn their place:

- `.qr-field-grid` flows form fields into as many ~240px columns as fit. The form
  column is ~924px wide, so one field per row stretched a “Nickname” input to that
  full width. `.qr-field-wide` (`grid-column: 1 / -1`) opts a textarea or an address
  back into a full row.

  **Two mechanisms coexist in [components/type-forms.tsx](components/type-forms.tsx)
  and the choice is by field count**, not by taste. `.qr-field-grid` resolves to
  three columns at 924px, so it fits a section of three peer fields (Work, Phone
  numbers, Contact, Wi-Fi, Location, Social). A section of **two or four** fields
  gets Mantine `Grid` with explicit halves (`span={{ base: 12, sm: 6 }}`) instead —
  under auto-fit, four fields leave an orphan on a second row and two fields leave
  a dead third column, which is what Titles, Email, Phone / SMS and Calendar each
  did. Pairing Start with End in Calendar is the same rule paying off semantically.
  The cost is that a `Grid` section does not line its column edges up with a
  `.qr-field-grid` section above or below it, visible in the Person form where
  Titles is two columns and the three sections under it are three; the orphan was
  worse. Both mechanisms take their gap from **one token**: `gap="sm"` on the
  `Grid`s and `var(--mantine-spacing-sm)` on `.qr-field-grid`. `Grid` defaults to
  `md` (16px), which made field widths differ by ~2px between adjacent sections,
  so do not drop the explicit `gap`. Note the prop is `gap` in Mantine v9 — it was
  `gutter` in earlier versions, and `gutter` now type-errors rather than being
  silently ignored.

  The `Grid`s also carry `type="container"` with `breakpoints={FIELD_BREAKPOINTS}`,
  so they answer to the **width of the form column** rather than the viewport, the
  way `.qr-field-grid`'s `auto-fit` already does. `FIELD_BREAKPOINTS` is derived
  from that same rule — `minmax(240px, 1fr)` with a 12px gap needs 492px for two
  columns, 744 for three — so the two mechanisms switch at the same container
  width by construction instead of by coincidence. Only `sm` is referenced by any
  `span`; the other four exist because the prop is typed `Record<MantineSize, string>`.

  **Be aware of two traps here.** Mantine takes the container path only when
  *both* `type="container"` and `breakpoints` are set (`if (type === "container" &&
  breakpoints)` in its `Grid`); passing the type alone silently falls back to media
  queries with no warning. And the container path wraps the grid in an extra div
  carrying `container-type: inline-size`, so a `:scope > .mantine-Grid-root`
  selector no longer matches — which is exactly what made the sections vanish from
  the measurement probe while the page itself looked unchanged.

  Measured honestly: this produces **identical** column counts and field widths to
  the viewport version at 390, 768, 900 and 1400px, and no width reachable in the
  current layout makes the two disagree — the form column never drops below 492px
  while the viewport is still above 768px. It is kept for consistency of kind, not
  for a visible fix. Verified by moving `sm` to 1000px: a 924px column inside a
  1400px viewport then collapses to one column, which a media query would not do.
- `.qr-type-bar` is a single non-wrapping row that scrolls horizontally. The nine
  types used to own a 220px column that ran 362px tall and left 1276px of dead
  space under it. Because it scrolls, the active type can start off-screen on a
  phone, so an effect keyed to `type` scrolls `[data-type-active]` into view —
  with `block: "nearest"`, or it would drag the page down as well.

`AppearancePanel` lays its four sections out with `SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}`
rather than stacking them; stacked they were 1182px tall, of which 39% was visible
at load.

The Multiple Codes tab is a `SimpleGrid` of three equal-height step cards, then a
collapsed `Accordion` holding `AppearancePanel`, then a full-width results card. The
steps are one-time configuration and the thumbnails are what you look at, so the
thumbnails get the whole container — six columns at 1400px.

The Appearance accordion starts collapsed and its control carries
`describeAppearance(appearance)`, so the settings a whole batch is about to use stay
readable without opening it. Opening it pushes the first thumbnail to y=1129, off a
1000px screen, so `.qr-batch-appearance` puts a live sample of the first imported row
in a `.qr-sticky-aside` beside the controls. **Do not drop that sample** — without it
the panel is the same blind-styling trap the Single tab used to have, and the
thumbnails are too far down to serve as feedback.

## Styling: Mantine v9, exclusively

The UI was migrated from shadcn to Mantine v9 (commit `994ad01`), and Tailwind was removed entirely afterwards. **There is no Tailwind, no `clsx`, no `tailwind-merge`, and no `cn()` helper — do not reintroduce them or write utility classes.** Style with Mantine components, its style props (`p`, `gap`, `c`, `ta`, `ff`, `mih`), `var(--mantine-*)` tokens, `styles`/`classNames` props, or CSS Modules.

[app/globals.css](app/globals.css) is now only a document-level base (html/body sizing, font smoothing) plus the `.qr-preview-stage` clamp. Mantine's own reset from `@mantine/core/styles.css` supplies colors, typography and normalization, so that import must stay **before** `./globals.css` in [app/layout.tsx](app/layout.tsx).

PostCSS runs `postcss-preset-mantine`, then `postcss-simple-vars` supplying the `$mantine-breakpoint-*` variables — Mantine mixins and breakpoint vars in CSS depend on that chain.

Each Mantine package ships its own stylesheet and every one must be imported in
`app/layout.tsx`, after `@mantine/core/styles.css`: currently `notifications` and
`dropzone`. A missing import does not fail the build — the component simply
renders unstyled, so add the import in the same commit as the package.

The Geist fonts reach the page through the Mantine theme, not a CSS framework: `createTheme` in `app/layout.tsx` points `fontFamily`, `fontFamilyMonospace` and `headings.fontFamily` at the `--font-geist-*` variables that `next/font` defines via the `<html>` className. Removing either half silently falls back to Mantine's system stack.

`app/layout.tsx` must also keep `mantineHtmlProps` on `<html>` and `<ColorSchemeScript defaultColorScheme="auto" />` in `<head>`, with the same `defaultColorScheme` on `MantineProvider`.

### Dark mode

The scheme follows the OS by default and the header toggle overrides it, persisted by Mantine in `localStorage`. Two rules keep it working:

- **Chrome colours come from semantic tokens**, never from a fixed value or a numbered shade: `var(--mantine-color-body)`, `--mantine-color-text`, `--mantine-color-default-border`, `--mantine-color-default-hover`. A `gray-1` surface or a literal `rgba(255,255,255,…)` is invisible in dark mode. The translucent sticky header uses `color-mix(in srgb, var(--mantine-color-body) 85%, transparent)` so it stays translucent while following the scheme. Colours that belong to the *QR itself* (`appearance.bgColor`, the transparency checkerboard) are content and stay as they are.
- **Never branch on the colour scheme during render.** `useComputedColorScheme` returns the stored value on the client's very first render — `getInitialValueInEffect` only defers the media query, not `localStorage` — so a JSX branch on it makes the client's first render disagree with the server and hydration fails, silently regenerating the whole tree. Render both variants and let CSS hide one (`mantine-light-hidden` / `mantine-dark-hidden`), as the header toggle does; the computed scheme is safe inside event handlers only. Verify with a stored `dark` value, not just a fresh profile: that is the only state where the mismatch shows up.

`Text` renders a `<p>` and `Group` a `<div>`, so **neither goes inside a control that
renders a `<button>`** — `Accordion.Control`, `UnstyledButton`, `Button` — whose
content model is phrasing content only. Use `<Text span>` and `<Group component="span">`.
React does not warn about this particular nesting, so it passes review silently and
only shows up as invalid markup.

Accessibility conventions worth keeping: decorative icons use `ThemeIcon` (a `div`), never `ActionIcon` with `pointerEvents: "none"`, which leaves a focusable but inert button in the tab order. Every input needs an accessible name — a visible `label` where the design has room, `aria-label` where it does not (the contact form is placeholder-only by design, so its fields carry `aria-label`).

`next.config.ts` sets `optimizePackageImports` for `@mantine/core`, `@mantine/hooks` and `@mantine/dropzone`; add new large icon/component packages there rather than deep-importing.

### App icons

The tab icon is a pair, both picked up by Next's metadata file conventions from
`app/`: [app/icon.svg](app/icon.svg) is the source of truth and
`app/favicon.ico` is **derived from it**, not drawn separately. Regenerate the
`.ico` after any edit to the SVG, or the two drift:

```bash
magick -density 2304 -background none app/icon.svg -depth 8 PNG32:/tmp/m.png
for s in 16 32 48; do magick /tmp/m.png -filter box -resize ${s}x${s} -depth 8 PNG32:/tmp/f$s.png; done
magick /tmp/f16.png /tmp/f32.png /tmp/f48.png app/favicon.ico
```

Two things in that command are load-bearing. ImageMagick's own SVG renderer
drops the rounded background when asked for a small raster directly, so the
`.ico` frames must come from **one large render** (768px, an integer multiple of
16/32/48) downsampled with `-filter box` — box averaging over uniform blocks is
exact, where the default filter softens every module edge.

The SVG's geometry is arithmetic, not taste: a 7-module grid inside a
**half**-module margin is 8 module widths across, and 8 divides 16, 32, 48 and
64, so every favicon size lands on whole pixels. A full-module margin around an
8-module grid — the obvious first construction — gives 1.5px modules at 16px and
the pattern turns to mush. Two smaller constraints: `rx` is 6 rather than 7
because a radius of 7 clips the corner of the finder pattern at (2,2), and no
data module may sit orthogonally next to a finder — it merges with it on screen
and reads as a rendering fault, which is why the asymmetry module is at (3,3),
diagonal to one.

Next reports the `.ico` in `<head>` as `sizes="48x48"` (it takes the last frame),
so browsers wanting a small icon use the SVG. The extra `.ico` frames are there
for clients that ignore `sizes` and for bare `/favicon.ico` requests.

## Conventions worth matching

- Shape labels live once, in `DOTS_TYPE_LABELS` / `CORNER_TYPE_LABELS` in [lib/qr-appearance.ts](lib/qr-appearance.ts). `AppearancePanel` derives its `Select` data from them and `describeAppearance` reuses them, so a new shape needs one entry, not three. Both are `Record<…Type, string>`, so TypeScript demands the entry.
- Path alias `@/*` maps to the repo root: `@/lib/...`, `@/components/...`.
- Every component under `components/` is `"use client"`, as is `app/page.tsx`.
- `lib/utils.ts` holds exactly two helpers: `downloadBlob` (anchor-click + delayed `revokeObjectURL`) and `slugify`. Reuse them for any new download path instead of re-rolling the anchor dance.
- Browser-API features degrade rather than throw: `handleCopyImage` reports through a Mantine notification when the clipboard refuses an image, and `handleShare` shares the PNG when `navigator.canShare` accepts files, falling back to the payload as text. An `AbortError` means the user dismissed the share sheet and is deliberately not reported. Use `notifications.show` for user-facing failures — never `alert()`.
- **Detect browser capabilities with `useSyncExternalStore`, not `typeof navigator`.** The share button uses it with a server snapshot of `false`, so the server and the client's first render agree and hydration holds; reading `navigator.share` straight in the JSX is the same defect as branching on the colour scheme during render (see Dark mode). The subscribe/snapshot callbacks live at module scope so their identity is stable.
- Responsive rules belong in [app/globals.css](app/globals.css), keyed to Mantine's breakpoints (`75em` is `lg`). An inline `<style>` in JSX gets hoisted by React 19 and drifts from the rest of the layout. `repeat(auto-fit, minmax(a, b))` with a **fixed** `b` caps *every* track at `b`, which is what once left 616px of the batch container unused; `minmax(240px, 1fr)` in `.qr-field-grid` is the safe form of the same idiom, because `1fr` caps nothing.
- `scanabilityWarnings` in [lib/qr-appearance.ts](lib/qr-appearance.ts) is advisory only: it flags foreground/background contrast under 3:1 and a logo with error correction below Q, but never blocks an export. Keep it pure so it stays testable.
- Objects passed as props to `QrPreview` must be memoised. A fresh `{...appearance, size: 320}` literal per render changes the effect's dependencies and redraws every preview in the batch grid on each keystroke.
- `defaultDataFor` returns fully populated sample data (a real-looking vCard, a dated event) so the preview is never empty on load — keep that habit for new types.
