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
- [components/qr-studio/type-forms.tsx](components/qr-studio/type-forms.tsx): a `TypeForm` case and an entry in `TYPE_ORDER` (which drives both the sidebar and the batch type `Select`).
- [app/page.tsx](app/page.tsx): an entry in `TYPE_ICONS`.

Encoding conventions established in `buildQrPayload`: `mailto:` built by hand with `encodeURIComponent` (**never `URLSearchParams`** — it encodes spaces as `+`, which mail clients show literally), `tel:`/`smsto:`, `WIFI:` with `escapeWifi`, `geo:`, `VEVENT` inside a full `VCALENDAR` envelope, vCard 3.0. `ensureUrl` prepends `https://` only when no scheme is present.

Three escaping rules that are easy to get wrong:

- `escapeText` covers both vCard and iCalendar TEXT values (same rules in RFC 6350 §3.4 and RFC 5545 §3.3.11). Every free-text value must go through it — an unescaped newline produces an orphan line that invalidates the whole payload.
- Structured values (`N:`, `ORG:`) use `structured()`, which escapes each component and joins with raw `;`. Never escape the component separator itself.
- `buildQrPayload` **must stay pure** — it runs inside a `useMemo`, so a `Date.now()` or random UID would change the payload on every keystroke and redraw the QR endlessly. The calendar `UID` is a `stableHash` of the event fields and `DTSTAMP` is derived from the start date for exactly this reason.

Calendar times are deliberately *floating local* (`toVEventDate`, no `Z`, no TZID). Excel date cells arrive as `Date` objects (`cellDates: true`) and go through `toDateTimeLocal`, which rounds to the minute — the Excel float renders 18:00 as 17:59:59.999.

### Batch mode

[components/qr-studio/batch-mode.tsx](components/qr-studio/batch-mode.tsx) is a three-step flow: download an `.xlsx` template → import a filled sheet → export a ZIP of PNGs. It shares the same appearance object as single mode, so a batch always renders with whatever the Appearance panel currently shows.

- Only the **first sheet** is read, and only the **first 500 rows** (hard cap for performance; rows beyond that are dropped with a warning).
- `rowToFormData` returns `null` for a row missing its required fields; those rows are counted as invalid and skipped rather than failing the import. Error messages report `r.index + 2` to match the spreadsheet's 1-based row numbering with a header row.
- An optional `filename` column overrides the derived name (`labelForRow` → `slugify`).
- ZIP export renders rows sequentially and reports progress through a string state; it is `await`-per-row on purpose to keep the tab responsive.

### Rendering and export

`qr-code-styling` is used two different ways from [components/qr-studio/qr-preview.tsx](components/qr-studio/qr-preview.tsx):

- **Preview**: `type: "svg"`, one long-lived `QRCodeStyling` instance kept in a ref and mutated via `.update()` on each change — never re-instantiated, or the DOM node is orphaned.
- **Export**: a throwaway `type: "canvas"` instance and `getRawData("png")`. The `as unknown as` casts in `renderQrPngBlob` are **unnecessary** — `DrawType` is `"canvas" | "svg"` and `getRawData` is declared in `QRCodeStyling.d.ts`. Drop them when you next touch that file.

The library sizes its SVG to the *export* resolution (`appearance.size`, default 640). The `.qr-preview-stage` rule at the bottom of [app/globals.css](app/globals.css) clamps it to the container — without it the preview overflows the layout horizontally.

## Styling: Mantine v9, exclusively

The UI was migrated from shadcn to Mantine v9 (commit `994ad01`), and Tailwind was removed entirely afterwards. **There is no Tailwind, no `clsx`, no `tailwind-merge`, and no `cn()` helper — do not reintroduce them or write utility classes.** Style with Mantine components, its style props (`p`, `gap`, `c`, `ta`, `ff`, `mih`), `var(--mantine-*)` tokens, `styles`/`classNames` props, or CSS Modules.

[app/globals.css](app/globals.css) is now only a document-level base (html/body sizing, font smoothing) plus the `.qr-preview-stage` clamp. Mantine's own reset from `@mantine/core/styles.css` supplies colors, typography and normalization, so that import must stay **before** `./globals.css` in [app/layout.tsx](app/layout.tsx).

PostCSS runs `postcss-preset-mantine`, then `postcss-simple-vars` supplying the `$mantine-breakpoint-*` variables — Mantine mixins and breakpoint vars in CSS depend on that chain.

The Geist fonts reach the page through the Mantine theme, not a CSS framework: `createTheme` in `app/layout.tsx` points `fontFamily`, `fontFamilyMonospace` and `headings.fontFamily` at the `--font-geist-*` variables that `next/font` defines via the `<html>` className. Removing either half silently falls back to Mantine's system stack.

`app/layout.tsx` must also keep `mantineHtmlProps` on `<html>` and `<ColorSchemeScript />` in `<head>`. Note the app has no color-scheme toggle and the header hardcodes a light background, so dark mode is not actually wired up.

`next.config.ts` sets `optimizePackageImports` for `@mantine/core` and `@mantine/hooks`; add new large icon/component packages there rather than deep-importing.

## Conventions worth matching

- Path alias `@/*` maps to the repo root: `@/lib/...`, `@/components/...`.
- Every component under `components/qr-studio/` is `"use client"`, as is `app/page.tsx`.
- `lib/utils.ts` holds exactly two helpers: `downloadBlob` (anchor-click + delayed `revokeObjectURL`) and `slugify`. Reuse them for any new download path instead of re-rolling the anchor dance.
- Browser-API features degrade rather than throw: `handleCopyImage` falls back to an alert, `handleShare` falls back to `navigator.share` with text and then to copying raw text.
- `defaultDataFor` returns fully populated sample data (a real-looking vCard, a dated event) so the preview is never empty on load — keep that habit for new types.
