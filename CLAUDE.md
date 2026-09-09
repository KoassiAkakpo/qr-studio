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
`lib/**/*.test.ts` is collected). Test names and comments in the test suite are in
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
- [components/qr-studio/type-forms.tsx](components/qr-studio/type-forms.tsx): a `TypeForm` case.
- [app/page.tsx](app/page.tsx): an entry in `TYPE_ICONS` — the only thing left outside `lib/`, because icons are JSX. It is typed `Record<QrType, ReactNode>`, so TypeScript refuses to compile until you add it.

`TYPE_ORDER` is derived from `QR_TYPE_META`'s keys, not maintained by hand, and drives both the sidebar and the batch `Select`. A new type appears in both automatically.

Encoding conventions established in `buildQrPayload`: `mailto:` built by hand with `encodeURIComponent` (**never `URLSearchParams`** — it encodes spaces as `+`, which mail clients show literally), `tel:`/`smsto:`, `WIFI:` with `escapeWifi`, `geo:`, `VEVENT` inside a full `VCALENDAR` envelope, vCard 3.0. `ensureUrl` prepends `https://` only when no scheme is present.

Three escaping rules that are easy to get wrong:

- `escapeText` covers both vCard and iCalendar TEXT values (same rules in RFC 6350 §3.4 and RFC 5545 §3.3.11). Every free-text value must go through it — an unescaped newline produces an orphan line that invalidates the whole payload.
- Structured values (`N:`, `ORG:`) use `structured()`, which escapes each component and joins with raw `;`. Never escape the component separator itself.
- `buildQrPayload` **must stay pure** — it runs inside a `useMemo`, so a `Date.now()` or random UID would change the payload on every keystroke and redraw the QR endlessly. The calendar `UID` is a `stableHash` of the event fields and `DTSTAMP` is derived from the start date for exactly this reason.

Calendar times are deliberately *floating local* (`toVEventDate`, no `Z`, no TZID). Excel date cells arrive as `Date` objects (`cellDates: true`) and go through `toDateTimeLocal`, which rounds to the minute — the Excel float renders 18:00 as 17:59:59.999.

### Batch mode

[components/qr-studio/batch-mode.tsx](components/qr-studio/batch-mode.tsx) is a three-step flow: download an `.xlsx` template → import a filled sheet → export a ZIP of PNGs. It shares the same appearance object as single mode, so a batch always renders with whatever the Appearance panel currently shows.

- Only the **first sheet** is read, and only the first `MAX_ROWS` (500) rows — beyond that the file is truncated and a warning says so.
- `rowToFormData` returns `null` for a row whose required fields are missing or malformed; those rows are counted as invalid and skipped rather than failing the import. Messages report `r.index + 2` to match the spreadsheet's 1-based numbering with a header row.
- An optional `filename` column overrides the derived name (`labelForRow` → `slugify`). Names then go through `dedupeFilenames`, **which is not optional**: JSZip accepts two entries with the same name and extraction silently overwrites one. Deduping is case-insensitive because macOS and Windows treat `A.png` and `a.png` as the same file, and it only runs across the rows that actually reach the ZIP so an invalid row cannot consume a name.
- ZIP export renders rows sequentially (`await`-per-row on purpose, to keep the tab responsive) and is cancellable through `cancelRef`, checked at the top of each iteration. A ref rather than state, so the running loop sees the change immediately.
- **`warning` and `error` are separate states.** `error` means the operation failed; `warning` means it succeeded with caveats (truncation, skipped rows, a cancelled export). Collapsing them is what made a successful import show a red alert.

`templateHeadersFor` must expose every field `rowToFormData` reads, or those columns are unreachable from an import — the `person` template silently omitted six of them. A test in `lib/qr-payloads.test.ts` asserts the two sets match for every type, so the drift cannot come back.

**`xlsx` is vendored, not installed from npm.** `package.json` points at `file:vendor/xlsx-0.20.3.tgz`, the publisher's own archive. Never "fix" this by running `npm install xlsx` — the npm registry stops at 0.18.5, which carries two unpatched high-severity advisories (prototype pollution, ReDoS) in the code path that parses user-supplied spreadsheets. [vendor/README.md](vendor/README.md) records the provenance, the sha256, and the upgrade procedure. `npm audit` must stay at zero.

`lib/excel.test.ts` runs real workbooks through `parseExcelFile`, so it is the guard that makes changing the spreadsheet library verifiable rather than a guess. `XLSX.writeFile` (used by `downloadTemplate`) is browser-only and therefore not covered — check it by hand in the batch tab after any version bump.

### Rendering and export

`qr-code-styling` is used two different ways from [components/qr-studio/qr-preview.tsx](components/qr-studio/qr-preview.tsx):

- **Preview**: `type: "svg"`, one long-lived `QRCodeStyling` instance kept in a ref and mutated via `.update()` on each change — never re-instantiated, or the DOM node is orphaned.
- **Export**: a throwaway `type: "canvas"` instance and `getRawData("png")`, then the caption is composited on a 2D canvas because `qr-code-styling` cannot draw text.

The library sizes its SVG to the *export* resolution (`appearance.size`, default 640). The `.qr-preview-stage` rule at the bottom of [app/globals.css](app/globals.css) clamps it to the container — without it the preview overflows the layout horizontally.

`appearanceToStylingOptions` must emit **every** optional key on every call, `undefined` included — `gradient` on the three shape sections, and `image`. `QRCodeStyling.update()` deep-merges into the previous options, so a key that is merely *omitted* keeps its old value: dropping `gradient` in solid mode left the previous gradient painted on the code and switching back to a solid colour did nothing. Conditional spreads (`...(x ? {a} : {b})`) are the shape to avoid here. `lib/qr-appearance.test.ts` asserts the keys are present.

**Preview/export parity is the contract here.** The caption used to exist only in the preview, so exported PNGs silently lacked it. Anything added to the preview must also be drawn in `renderQrPngBlob`, and both sides must derive shared values from the same helper — `captionColorFor` and `captionFontSize` in [lib/qr-appearance.ts](lib/qr-appearance.ts) exist so the two cannot drift.

Three traps in the compositing code:

- `ImageBitmap.close()` resets `width`/`height` to **0**. Read the dimensions into locals before closing, or the caption gets drawn over the QR instead of below it — which is exactly the bug that shipped in the first draft of this function.
- `await document.fonts.ready` before `fillText`, otherwise the first export of a session uses the fallback font.
- A canvas 2D context is not available in every environment; the function degrades to the plain QR blob rather than throwing.

Capacity is enforced *before* generation, never by catching: `exceedsCapacity` (a static version-40 byte table per ECL, validated against the real generator in `lib/qr-appearance.test.ts`) is computed during render, gates the image-producing buttons, and shows the byte budget in the badge. The `try`/`catch` around `.update()` is only a net for unexpected library throws — without it, an overflow escapes the effect and takes down the tree, since there is no error boundary. The failure is keyed to a `payload|ecl` signature so it expires during render rather than being cleared by a second `setState`.

## Styling: Mantine v9, exclusively

The UI was migrated from shadcn to Mantine v9 (commit `994ad01`), and Tailwind was removed entirely afterwards. **There is no Tailwind, no `clsx`, no `tailwind-merge`, and no `cn()` helper — do not reintroduce them or write utility classes.** Style with Mantine components, its style props (`p`, `gap`, `c`, `ta`, `ff`, `mih`), `var(--mantine-*)` tokens, `styles`/`classNames` props, or CSS Modules.

[app/globals.css](app/globals.css) is now only a document-level base (html/body sizing, font smoothing) plus the `.qr-preview-stage` clamp. Mantine's own reset from `@mantine/core/styles.css` supplies colors, typography and normalization, so that import must stay **before** `./globals.css` in [app/layout.tsx](app/layout.tsx).

PostCSS runs `postcss-preset-mantine`, then `postcss-simple-vars` supplying the `$mantine-breakpoint-*` variables — Mantine mixins and breakpoint vars in CSS depend on that chain.

The Geist fonts reach the page through the Mantine theme, not a CSS framework: `createTheme` in `app/layout.tsx` points `fontFamily`, `fontFamilyMonospace` and `headings.fontFamily` at the `--font-geist-*` variables that `next/font` defines via the `<html>` className. Removing either half silently falls back to Mantine's system stack.

`app/layout.tsx` must also keep `mantineHtmlProps` on `<html>` and `<ColorSchemeScript defaultColorScheme="auto" />` in `<head>`, with the same `defaultColorScheme` on `MantineProvider`.

### Dark mode

The scheme follows the OS by default and the header toggle overrides it, persisted by Mantine in `localStorage`. Two rules keep it working:

- **Chrome colours come from semantic tokens**, never from a fixed value or a numbered shade: `var(--mantine-color-body)`, `--mantine-color-text`, `--mantine-color-default-border`, `--mantine-color-default-hover`. A `gray-1` surface or a literal `rgba(255,255,255,…)` is invisible in dark mode. The translucent sticky header uses `color-mix(in srgb, var(--mantine-color-body) 85%, transparent)` so it stays translucent while following the scheme. Colours that belong to the *QR itself* (`appearance.bgColor`, the transparency checkerboard) are content and stay as they are.
- **Never branch on the colour scheme during render.** `useComputedColorScheme` returns the stored value on the client's very first render — `getInitialValueInEffect` only defers the media query, not `localStorage` — so a JSX branch on it makes the client's first render disagree with the server and hydration fails, silently regenerating the whole tree. Render both variants and let CSS hide one (`mantine-light-hidden` / `mantine-dark-hidden`), as the header toggle does; the computed scheme is safe inside event handlers only. Verify with a stored `dark` value, not just a fresh profile: that is the only state where the mismatch shows up.

Accessibility conventions worth keeping: decorative icons use `ThemeIcon` (a `div`), never `ActionIcon` with `pointerEvents: "none"`, which leaves a focusable but inert button in the tab order. Every input needs an accessible name — a visible `label` where the design has room, `aria-label` where it does not (the contact form is placeholder-only by design, so its fields carry `aria-label`).

`next.config.ts` sets `optimizePackageImports` for `@mantine/core` and `@mantine/hooks`; add new large icon/component packages there rather than deep-importing.

## Conventions worth matching

- Path alias `@/*` maps to the repo root: `@/lib/...`, `@/components/...`.
- Every component under `components/qr-studio/` is `"use client"`, as is `app/page.tsx`.
- `lib/utils.ts` holds exactly two helpers: `downloadBlob` (anchor-click + delayed `revokeObjectURL`) and `slugify`. Reuse them for any new download path instead of re-rolling the anchor dance.
- Browser-API features degrade rather than throw: `handleCopyImage` reports through a Mantine notification when the clipboard refuses an image, and `handleShare` shares the PNG when `navigator.canShare` accepts files, falling back to the payload as text. An `AbortError` means the user dismissed the share sheet and is deliberately not reported. Use `notifications.show` for user-facing failures — never `alert()`.
- **Detect browser capabilities with `useSyncExternalStore`, not `typeof navigator`.** The share button uses it with a server snapshot of `false`, so the server and the client's first render agree and hydration holds; reading `navigator.share` straight in the JSX is the same defect as branching on the colour scheme during render (see Dark mode). The subscribe/snapshot callbacks live at module scope so their identity is stable.
- Responsive rules belong in [app/globals.css](app/globals.css), keyed to Mantine's breakpoints (`75em` is `lg`). An inline `<style>` in JSX gets hoisted by React 19 and drifts from the rest of the layout. The two page layouts live there as `.qr-single-grid` and `.qr-batch-grid`, both a fixed sidebar column plus `minmax(0, 1fr)` for the rest, collapsing to one column below `75em`. **Do not size these with `repeat(auto-fit, minmax(a, b))`** — that caps *every* track at `b`, so the batch preview panel was stuck at 380px and left 616px of the 1400px container unused.
- `scanabilityWarnings` in [lib/qr-appearance.ts](lib/qr-appearance.ts) is advisory only: it flags foreground/background contrast under 3:1 and a logo with error correction below Q, but never blocks an export. Keep it pure so it stays testable.
- Objects passed as props to `QrPreview` must be memoised. A fresh `{...appearance, size: 320}` literal per render changes the effect's dependencies and redraws every preview in the batch grid on each keystroke.
- `defaultDataFor` returns fully populated sample data (a real-looking vCard, a dated event) so the preview is never empty on load — keep that habit for new types.
