"use client";

import { Select, Stack, Switch, Text, TextInput, Textarea, Title } from "@mantine/core";
import type { QrFormData, QrType } from "@/lib/qr-payloads";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap="sm">
      <Title order={5}>{title}</Title>
      <Stack gap="sm">{children}</Stack>
    </Stack>
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
          <TextInput
            label="URL"
            placeholder="https://example.com"
            value={data.url}
            onChange={(e) => set({ url: e.currentTarget.value })}
          />
          <Text size="xs" c="dimmed">
            Include https:// for best compatibility.
          </Text>
        </Section>
      );
    case "text":
      return (
        <Section title="Plain text">
          <Textarea
            label="Text content"
            rows={5}
            placeholder="Type anything…"
            value={data.text}
            onChange={(e) => set({ text: e.currentTarget.value })}
          />
          <Text size="xs" c="dimmed">{data.text.length} characters</Text>
        </Section>
      );
    case "email":
      return (
        <Section title="Email details">
          <TextInput label="To" placeholder="name@example.com" value={data.to} onChange={(e) => set({ to: e.currentTarget.value })} />
          <TextInput label="Subject" placeholder="Subject" value={data.subject} onChange={(e) => set({ subject: e.currentTarget.value })} />
          <Textarea label="Body" rows={4} placeholder="Message body" value={data.body} onChange={(e) => set({ body: e.currentTarget.value })} />
        </Section>
      );
    case "phone":
      return (
        <Section title="Phone / SMS">
          <Select
            label="Action"
            value={data.kind}
            onChange={(v) => v && set({ kind: v })}
            data={[
              { value: "tel", label: "Call (tel:)" },
              { value: "sms", label: "SMS (smsto:)" },
            ]}
          />
          <TextInput label="Phone number" placeholder="+1-555-010-2030" value={data.number} onChange={(e) => set({ number: e.currentTarget.value })} />
          {data.kind === "sms" && (
            <Textarea label="Prefilled message" rows={3} placeholder="Hello!" value={data.message} onChange={(e) => set({ message: e.currentTarget.value })} />
          )}
        </Section>
      );
    case "wifi":
      return (
        <Section title="Wi-Fi network">
          <TextInput label="Network name (SSID)" placeholder="My-WiFi" value={data.ssid} onChange={(e) => set({ ssid: e.currentTarget.value })} />
          <Select
            label="Security"
            value={data.encryption}
            onChange={(v) => v && set({ encryption: v })}
            data={[
              { value: "WPA", label: "WPA / WPA2" },
              { value: "WEP", label: "WEP" },
              { value: "nopass", label: "No password" },
            ]}
          />
          {data.encryption !== "nopass" && (
            <TextInput label="Password" placeholder="Password" value={data.password} onChange={(e) => set({ password: e.currentTarget.value })} />
          )}
          <Switch label="Hidden network" checked={data.hidden} onChange={(e) => set({ hidden: e.currentTarget.checked })} />
        </Section>
      );
    case "location":
      return (
        <Section title="Location">
          <Stack gap="sm" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <TextInput label="Latitude" placeholder="40.7128" value={data.latitude} onChange={(e) => set({ latitude: e.currentTarget.value })} />
            <TextInput label="Longitude" placeholder="-74.0060" value={data.longitude} onChange={(e) => set({ longitude: e.currentTarget.value })} />
          </Stack>
          <TextInput label="Label / query (optional)" placeholder="New York" value={data.query} onChange={(e) => set({ query: e.currentTarget.value })} />
        </Section>
      );
    case "calendar":
      return (
        <Section title="Calendar event">
          <TextInput label="Title" value={data.title} onChange={(e) => set({ title: e.currentTarget.value })} />
          <Stack gap="sm" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <TextInput label="Start" type="datetime-local" value={data.start} onChange={(e) => set({ start: e.currentTarget.value })} />
            <TextInput label="End" type="datetime-local" value={data.end} onChange={(e) => set({ end: e.currentTarget.value })} />
          </Stack>
          <TextInput label="Location" value={data.location} onChange={(e) => set({ location: e.currentTarget.value })} />
          <Textarea label="Description" rows={3} value={data.description} onChange={(e) => set({ description: e.currentTarget.value })} />
        </Section>
      );
    case "person":
      return (
        <Stack gap="lg">
          <Section title="Titles">
            <Stack gap="sm" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <TextInput placeholder="First name" value={data.firstName} onChange={(e) => set({ firstName: e.currentTarget.value })} />
              <TextInput placeholder="Last name" value={data.lastName} onChange={(e) => set({ lastName: e.currentTarget.value })} />
            </Stack>
            <TextInput placeholder="Title (e.g. Dr.)" value={data.title} onChange={(e) => set({ title: e.currentTarget.value })} />
            <TextInput placeholder="Nickname" value={data.nickname} onChange={(e) => set({ nickname: e.currentTarget.value })} />
          </Section>
          <Section title="Work">
            <TextInput placeholder="Company" value={data.organization} onChange={(e) => set({ organization: e.currentTarget.value })} />
            <TextInput placeholder="Job title" value={data.jobTitle} onChange={(e) => set({ jobTitle: e.currentTarget.value })} />
            <TextInput placeholder="Department" value={data.department} onChange={(e) => set({ department: e.currentTarget.value })} />
          </Section>
          <Section title="Phone numbers">
            <TextInput placeholder="Work phone" value={data.phoneWork} onChange={(e) => set({ phoneWork: e.currentTarget.value })} />
            <TextInput placeholder="Mobile phone" value={data.phoneMobile} onChange={(e) => set({ phoneMobile: e.currentTarget.value })} />
            <TextInput placeholder="Other phone" value={data.phoneOther} onChange={(e) => set({ phoneOther: e.currentTarget.value })} />
          </Section>
          <Section title="Contact">
            <TextInput placeholder="Email" value={data.email} onChange={(e) => set({ email: e.currentTarget.value })} />
            <TextInput placeholder="Website" value={data.website} onChange={(e) => set({ website: e.currentTarget.value })} />
            <TextInput placeholder="Address" value={data.address} onChange={(e) => set({ address: e.currentTarget.value })} />
            <Textarea rows={2} placeholder="Notes" value={data.note} onChange={(e) => set({ note: e.currentTarget.value })} />
          </Section>
        </Stack>
      );
    case "social":
      return (
        <Section title="Social profile">
          <Select
            label="Network"
            value={data.network}
            onChange={(v) => v && set({ network: v })}
            data={["X (Twitter)", "Instagram", "Facebook", "LinkedIn", "YouTube", "TikTok", "WhatsApp", "Telegram", "GitHub", "Custom"]}
          />
          <TextInput label="Handle" placeholder="@username" value={data.handle} onChange={(e) => set({ handle: e.currentTarget.value })} />
          <TextInput label="Profile URL" placeholder="https://…" value={data.url} onChange={(e) => set({ url: e.currentTarget.value })} />
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
