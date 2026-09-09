# QR Studio

A browser-based QR code generator: nine payload types, single or batch, with
custom colours, gradients, a centre logo, and PNG or ZIP export.

Everything runs in the browser. There is no backend, no account, no upload and
no telemetry — spreadsheets you import and codes you generate never leave the
machine.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build; also runs the TypeScript check |
| `npm start` | Serve a production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest, once |
| `npm run test:watch` | Vitest, watch mode |

## What it generates

| Type | Encoding |
| --- | --- |
| URL | the address, with `https://` added when no scheme is given |
| Text | raw text |
| Email | `mailto:` with subject and body |
| Phone / SMS | `tel:` or `smsto:` with a prefilled message |
| Wi-Fi | `WIFI:` — joins a network without typing the password |
| Location | `geo:` coordinates, with an optional label |
| Calendar | a `VEVENT` inside a `VCALENDAR` envelope |
| Person | vCard 3.0 contact card |
| Social | a profile link or handle |

Payload building lives in [lib/qr-payloads.ts](lib/qr-payloads.ts) and is covered
by tests that pin the exact wire format, because these formats break in ways that
are invisible until someone scans the code with a real phone.

## Batch mode

Pick a type, download the generated `.xlsx` template, fill it in, drop it on the
import zone, and export a ZIP of PNGs. Up to 500 rows per file, 10 MB per file.

- Column names are matched case-insensitively.
- Rows missing or malforming a required field are skipped and listed, rather than
  failing the whole import.
- An optional `filename` column names each PNG; duplicates get a numbered suffix
  so nothing is overwritten in the archive.
- Every code in a batch uses the current Appearance settings, which are editable
  from either tab — the batch tab shows them under a collapsible panel with a live
  sample of the first row.

## Appearance

Pixel and corner shapes, solid or gradient colours (linear or radial), a
transparent or solid background, margin, a centre logo with adjustable size
(drag an image in, or click to browse — up to 2 MB), a caption drawn beneath the
code, error correction level, and export resolution.

The same panel is available in both tabs and edits one shared set of settings.

It warns when a combination is likely to scan badly — pixels too close in
colour to the background, or a logo with error correction too low to recover the
modules it covers.

## Stack

Next.js 16 (App Router, React 19), Mantine v9 with `@mantine/dropzone` and
`@mantine/notifications`, `qr-code-styling`, JSZip and SheetJS. Vitest for tests.

`xlsx` is installed from a vendored archive rather than npm; see
[vendor/README.md](vendor/README.md) for why and how to update it.

## Project notes

[CLAUDE.md](CLAUDE.md) documents the architecture and the traps worth knowing
before changing the payload, rendering or batch code. [PLAN.md](PLAN.md) records
an audit of the codebase and the state of the fixes.
