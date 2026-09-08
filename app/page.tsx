"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  Check,
  Copy,
  Download,
  Link2,
  LayoutGrid,
  Mail,
  MapPin,
  Phone,
  QrCode,
  Share2,
  Share,
  Type,
  User,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn, downloadBlob } from "@/lib/utils";
import {
  buildQrPayload,
  defaultDataFor,
  QR_TYPE_META,
  type QrFormData,
  type QrType,
} from "@/lib/qr-payloads";
import { DEFAULT_APPEARANCE, type QrAppearance } from "@/lib/qr-appearance";
import { TypeForm, TYPE_ORDER } from "@/components/qr-studio/type-forms";
import { QrPreview, renderQrPngBlob } from "@/components/qr-studio/qr-preview";
import { AppearancePanel } from "@/components/qr-studio/appearance-panel";
import { BatchMode } from "@/components/qr-studio/batch-mode";

const TYPE_ICONS: Record<QrType, React.ReactNode> = {
  calendar: <Calendar />,
  email: <Mail />,
  location: <MapPin />,
  person: <User />,
  phone: <Phone />,
  social: <Share2 />,
  text: <Type />,
  url: <Link2 />,
  wifi: <Wifi />,
};

export default function Home() {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [type, setType] = useState<QrType>("person");
  const [formData, setFormData] = useState<QrFormData>(() => defaultDataFor("person"));
  const [appearance, setAppearance] = useState<QrAppearance>(DEFAULT_APPEARANCE);
  const [previewTab, setPreviewTab] = useState<"qr" | "raw">("qr");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const payload = useMemo(() => buildQrPayload(formData), [formData]);

  const switchType = (t: QrType) => {
    setType(t);
    setFormData(defaultDataFor(t));
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const blob = await renderQrPngBlob(payload, appearance);
      const base =
        formData.type === "person"
          ? `${(formData.firstName || "").trim()}-${(formData.lastName || "").trim()}`.replace(/^-|-$/g, "") || "contact"
          : payload.slice(0, 30);
      downloadBlob(blob, `qr-${type}-${base.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "code"}.png`);
    } finally {
      setBusy(false);
    }
  };

  const handleCopyImage = async () => {
    try {
      const blob = await renderQrPngBlob(payload, appearance);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("Copy image not supported in this browser — use Download PNG instead.");
    }
  };

  const handleCopyRaw = async () => {
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleShare = async () => {
    try {
      const blob = await renderQrPngBlob(payload, appearance);
      const file = new File([blob], "qr-code.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "QR Code" });
      } else if (navigator.share) {
        await navigator.share({ text: payload, title: "QR Code" });
      } else {
        handleCopyRaw();
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-4 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <QrCode className="h-5 w-5" />
            </span>
            <span>QR Studio</span>
            <Badge variant="secondary" className="hidden sm:inline-flex">9 types · single + batch</Badge>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "batch")}>
              <TabsList>
                <TabsTrigger value="single">Single</TabsTrigger>
                <TabsTrigger value="batch" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Multiple Codes</TabsTrigger>
              </TabsList>
            </Tabs>
            {mode === "single" && (
              <>
                <Button variant="outline" size="sm" onClick={handleCopyRaw}>
                  {copied ? <Check /> : <Copy />} Copy raw
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopyImage}>
                  {copied ? <Check /> : <Copy />} Copy PNG
                </Button>
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share /> Share
                </Button>
                <Button size="sm" onClick={handleDownload} disabled={busy || !payload}>
                  <Download /> {busy ? "Rendering…" : "Export PNG"}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">
        {mode === "batch" ? (
          <BatchMode type={type} onTypeChange={switchType} appearance={appearance} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,420px)]">
            {/* Sidebar */}
            <nav className="h-fit rounded-xl border bg-card p-2 shadow-sm lg:sticky lg:top-[76px]">
              {TYPE_ORDER.map((t) => (
                <button
                  key={t}
                  onClick={() => switchType(t)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent",
                    type === t ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
                  )}
                >
                  <span className="[&_svg]:h-4 [&_svg]:w-4">{TYPE_ICONS[t]}</span>
                  {QR_TYPE_META[t].label}
                </button>
              ))}
            </nav>

            {/* Form */}
            <Card className="h-fit">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg capitalize">{QR_TYPE_META[type].label}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{QR_TYPE_META[type].hint}</p>
                </div>
                <Badge variant={payload ? "default" : "destructive"}>
                  {payload ? `${payload.length} chars` : "empty"}
                </Badge>
              </CardHeader>
              <CardContent>
                <TypeForm data={formData} onChange={setFormData} />
              </CardContent>
            </Card>

            {/* Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as "qr" | "raw")}>
                  <TabsList>
                    <TabsTrigger value="qr">QR Code</TabsTrigger>
                    <TabsTrigger value="raw">Raw Code</TabsTrigger>
                  </TabsList>
                </Tabs>
                {payload && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </div>

              {previewTab === "qr" ? (
                <QrPreview payload={payload} appearance={appearance} />
              ) : (
                <Card>
                  <CardContent className="pt-5">
                    <Textarea readOnly rows={12} value={payload} className="font-mono text-xs" />
                    <Button variant="outline" size="sm" className="mt-3 w-full" onClick={handleCopyRaw}>
                      <Copy /> Copy raw payload
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500 text-white">✣</span>
                    Appearance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AppearancePanel value={appearance} onChange={setAppearance} />
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        QR Studio · encodings: URL, Text, Email (mailto:), Phone/SMS (tel:/smsto:), Wi-Fi (WIFI:), Location (geo:), Calendar (VEVENT), Person (vCard 3.0), Social links · PNG export
      </footer>
    </div>
  );
}
