"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { QrAppearance } from "@/lib/qr-appearance";

export function AppearancePanel({
  value,
  onChange,
}: {
  value: QrAppearance;
  onChange: (v: QrAppearance) => void;
}) {
  const set = (patch: Partial<QrAppearance>) => onChange({ ...value, ...patch });

  const handleLogo = (file: File | undefined) => {
    if (!file) {
      set({ logoDataUrl: "" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set({ logoDataUrl: String(reader.result ?? "") });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Shape</p>
        <div className="space-y-2">
          <Label className="text-[13px]">Pixel style</Label>
          <Select value={value.dotsType} onValueChange={(v) => set({ dotsType: v as QrAppearance["dotsType"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="square">Square</SelectItem>
              <SelectItem value="rounded">Rounded</SelectItem>
              <SelectItem value="dots">Dots</SelectItem>
              <SelectItem value="classy">Classy</SelectItem>
              <SelectItem value="classy-rounded">Classy rounded</SelectItem>
              <SelectItem value="extra-rounded">Extra rounded</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-[13px]">Corners</Label>
            <Select value={value.cornersSquareType} onValueChange={(v) => set({ cornersSquareType: v as QrAppearance["cornersSquareType"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="square">Square</SelectItem>
                <SelectItem value="dot">Dot</SelectItem>
                <SelectItem value="extra-rounded">Rounded</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[13px]">Corner dots</Label>
            <Select value={value.cornersDotType} onValueChange={(v) => set({ cornersDotType: v as QrAppearance["cornersDotType"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="square">Square</SelectItem>
                <SelectItem value="dot">Dot</SelectItem>
                <SelectItem value="extra-rounded">Rounded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[13px]">Margin</Label>
            <span className="text-xs text-muted-foreground">{value.margin}px</span>
          </div>
          <Slider value={[value.margin]} min={0} max={40} step={1} onValueChange={([v]) => set({ margin: v })} />
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Color</p>
        <div className="space-y-2">
          <Label className="text-[13px]">Pixel color</Label>
          <Select value={value.dotsColorMode} onValueChange={(v) => set({ dotsColorMode: v as "solid" | "gradient" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">Solid</SelectItem>
              <SelectItem value="gradient">Linear gradient</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <input type="color" value={value.dotsColor} onChange={(e) => set({ dotsColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded-md border" />
          {value.dotsColorMode === "gradient" && (
            <>
              <input type="color" value={value.gradientColor2} onChange={(e) => set({ gradientColor2: e.target.value })} className="h-9 w-12 cursor-pointer rounded-md border" />
              <div className="flex items-center gap-1">
                <Input type="number" value={value.gradientRotation} onChange={(e) => set({ gradientRotation: Number(e.target.value) || 0 })} className="w-20" />
                <span className="text-xs text-muted-foreground">°</span>
              </div>
            </>
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-[13px]">Background</Label>
          <Select value={value.bgColorMode} onValueChange={(v) => set({ bgColorMode: v as "solid" | "transparent" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">Solid</SelectItem>
              <SelectItem value="transparent">Transparent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {value.bgColorMode === "solid" && (
          <input type="color" value={value.bgColor} onChange={(e) => set({ bgColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded-md border" />
        )}
      </div>

      <div className="space-y-3 border-t pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Logo & frame</p>
        <div className="space-y-2">
          <Label className="text-[13px]">Center logo (PNG/JPG)</Label>
          <Input type="file" accept="image/*" onChange={(e) => handleLogo(e.target.files?.[0])} />
          {value.logoDataUrl && (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value.logoDataUrl} alt="logo" className="h-10 w-10 rounded-md border object-contain" />
              <button className="text-xs text-destructive underline" onClick={() => set({ logoDataUrl: "" })}>Remove</button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
          <Label className="text-[13px]">Caption under QR</Label>
          <Switch checked={value.showFrameText} onCheckedChange={(v) => set({ showFrameText: v })} />
        </div>
        {value.showFrameText && (
          <Input value={value.frameText} onChange={(e) => set({ frameText: e.target.value })} placeholder="Scan for…" />
        )}
      </div>

      <div className="space-y-3 border-t pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Quality</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-[13px]">Error correction</Label>
            <Select value={value.ecl} onValueChange={(v) => set({ ecl: v as QrAppearance["ecl"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="L">L — Low</SelectItem>
                <SelectItem value="M">M — Medium</SelectItem>
                <SelectItem value="Q">Q — Quartile</SelectItem>
                <SelectItem value="H">H — High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[13px]">Export size (px)</Label>
            <Select value={String(value.size)} onValueChange={(v) => set({ size: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="512">512</SelectItem>
                <SelectItem value="640">640</SelectItem>
                <SelectItem value="1024">1024</SelectItem>
                <SelectItem value="2048">2048</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
