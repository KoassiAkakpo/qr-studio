"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { QrFormData, QrType } from "@/lib/qr-payloads";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function TypeForm({
  data,
  onChange,
}: {
  data: QrFormData;
  onChange: (d: QrFormData) => void;
}) {
  const set = (patch: Record<string, unknown>) =>
    onChange({ ...data, ...patch } as QrFormData);

  switch (data.type) {
    case "url":
      return (
        <Section title="Website address">
          <Field label="URL">
            <Input
              placeholder="https://example.com"
              value={data.url}
              onChange={(e) => set({ url: e.target.value })}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            Include https:// for best compatibility.
          </p>
        </Section>
      );
    case "text":
      return (
        <Section title="Plain text">
          <Field label="Text content">
            <Textarea
              rows={5}
              placeholder="Type anything…"
              value={data.text}
              onChange={(e) => set({ text: e.target.value })}
            />
          </Field>
          <p className="text-xs text-muted-foreground">{data.text.length} characters</p>
        </Section>
      );
    case "email":
      return (
        <Section title="Email details">
          <Field label="To">
            <Input placeholder="name@example.com" value={data.to} onChange={(e) => set({ to: e.target.value })} />
          </Field>
          <Field label="Subject">
            <Input placeholder="Subject" value={data.subject} onChange={(e) => set({ subject: e.target.value })} />
          </Field>
          <Field label="Body">
            <Textarea rows={4} placeholder="Message body" value={data.body} onChange={(e) => set({ body: e.target.value })} />
          </Field>
        </Section>
      );
    case "phone":
      return (
        <Section title="Phone / SMS">
          <Field label="Action">
            <Select value={data.kind} onValueChange={(v) => set({ kind: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tel">Call (tel:)</SelectItem>
                <SelectItem value="sms">SMS (smsto:)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Phone number">
            <Input placeholder="+1-555-010-2030" value={data.number} onChange={(e) => set({ number: e.target.value })} />
          </Field>
          {data.kind === "sms" && (
            <Field label="Prefilled message">
              <Textarea rows={3} placeholder="Hello!" value={data.message} onChange={(e) => set({ message: e.target.value })} />
            </Field>
          )}
        </Section>
      );
    case "wifi":
      return (
        <Section title="Wi-Fi network">
          <Field label="Network name (SSID)">
            <Input placeholder="My-WiFi" value={data.ssid} onChange={(e) => set({ ssid: e.target.value })} />
          </Field>
          <Field label="Security">
            <Select value={data.encryption} onValueChange={(v) => set({ encryption: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="WPA">WPA / WPA2</SelectItem>
                <SelectItem value="WEP">WEP</SelectItem>
                <SelectItem value="nopass">No password</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {data.encryption !== "nopass" && (
            <Field label="Password">
              <Input placeholder="Password" value={data.password} onChange={(e) => set({ password: e.target.value })} />
            </Field>
          )}
          <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
            <Label className="text-[13px]">Hidden network</Label>
            <Switch checked={data.hidden} onCheckedChange={(v) => set({ hidden: v })} />
          </div>
        </Section>
      );
    case "location":
      return (
        <Section title="Location">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude">
              <Input placeholder="40.7128" value={data.latitude} onChange={(e) => set({ latitude: e.target.value })} />
            </Field>
            <Field label="Longitude">
              <Input placeholder="-74.0060" value={data.longitude} onChange={(e) => set({ longitude: e.target.value })} />
            </Field>
          </div>
          <Field label="Label / query (optional)">
            <Input placeholder="New York" value={data.query} onChange={(e) => set({ query: e.target.value })} />
          </Field>
        </Section>
      );
    case "calendar":
      return (
        <Section title="Calendar event">
          <Field label="Title">
            <Input value={data.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <Input type="datetime-local" value={data.start} onChange={(e) => set({ start: e.target.value })} />
            </Field>
            <Field label="End">
              <Input type="datetime-local" value={data.end} onChange={(e) => set({ end: e.target.value })} />
            </Field>
          </div>
          <Field label="Location">
            <Input value={data.location} onChange={(e) => set({ location: e.target.value })} />
          </Field>
          <Field label="Description">
            <Textarea rows={3} value={data.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
        </Section>
      );
    case "person":
      return (
        <div className="space-y-6">
          <Section title="Titles">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="First name" value={data.firstName} onChange={(e) => set({ firstName: e.target.value })} />
              <Input placeholder="Last name" value={data.lastName} onChange={(e) => set({ lastName: e.target.value })} />
            </div>
            <Input placeholder="Title (e.g. Dr.)" value={data.title} onChange={(e) => set({ title: e.target.value })} />
            <Input placeholder="Nickname" value={data.nickname} onChange={(e) => set({ nickname: e.target.value })} />
          </Section>
          <Section title="Work">
            <Input placeholder="Company" value={data.organization} onChange={(e) => set({ organization: e.target.value })} />
            <Input placeholder="Job title" value={data.jobTitle} onChange={(e) => set({ jobTitle: e.target.value })} />
            <Input placeholder="Department" value={data.department} onChange={(e) => set({ department: e.target.value })} />
          </Section>
          <Section title="Phone numbers">
            <Input placeholder="Work phone" value={data.phoneWork} onChange={(e) => set({ phoneWork: e.target.value })} />
            <Input placeholder="Mobile phone" value={data.phoneMobile} onChange={(e) => set({ phoneMobile: e.target.value })} />
            <Input placeholder="Other phone" value={data.phoneOther} onChange={(e) => set({ phoneOther: e.target.value })} />
          </Section>
          <Section title="Contact">
            <Input placeholder="Email" value={data.email} onChange={(e) => set({ email: e.target.value })} />
            <Input placeholder="Website" value={data.website} onChange={(e) => set({ website: e.target.value })} />
            <Input placeholder="Address" value={data.address} onChange={(e) => set({ address: e.target.value })} />
            <Textarea rows={2} placeholder="Notes" value={data.note} onChange={(e) => set({ note: e.target.value })} />
          </Section>
        </div>
      );
    case "social":
      return (
        <Section title="Social profile">
          <Field label="Network">
            <Select value={data.network} onValueChange={(v) => set({ network: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["X (Twitter)", "Instagram", "Facebook", "LinkedIn", "YouTube", "TikTok", "WhatsApp", "Telegram", "GitHub", "Custom"].map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Handle">
            <Input placeholder="@username" value={data.handle} onChange={(e) => set({ handle: e.target.value })} />
          </Field>
          <Field label="Profile URL">
            <Input placeholder="https://…" value={data.url} onChange={(e) => set({ url: e.target.value })} />
          </Field>
        </Section>
      );
  }
}

export const TYPE_ORDER: QrType[] = [
  "calendar",
  "email",
  "location",
  "person",
  "phone",
  "social",
  "text",
  "url",
  "wifi",
];
