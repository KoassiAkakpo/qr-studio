"use client";

import {
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title,
  Grid,
} from "@mantine/core";
import { isLikelyEmail, type QrFormData } from "@/lib/qr-payloads";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Stack gap="sm">
      <Title order={5}>{title}</Title>
      {children}
    </Stack>
  );
}

/**
 * Rangée de champs. La grille `.qr-field-grid` répartit les champs sur autant de
 * colonnes que la largeur permet : la colonne du formulaire fait près de 950px,
 * un champ par ligne y serait illisible.
 */
function Fields({ children }: { children: React.ReactNode }) {
  return <div className="qr-field-grid">{children}</div>;
}

/** Champ qui occupe toute la rangée, quel que soit le nombre de colonnes. */
function Wide({ children }: { children: React.ReactNode }) {
  return <div className="qr-field-wide">{children}</div>;
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
          <Fields>
            <Wide>
              <TextInput
                label="URL"
                placeholder="https://example.com"
                value={data.url}
                onChange={(e) => set({ url: e.currentTarget.value })}
              />
            </Wide>
          </Fields>
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
            rows={4}
            placeholder="Type anything…"
            value={data.text}
            onChange={(e) => set({ text: e.currentTarget.value })}
          />
          <Text size="xs" c="dimmed">
            {data.text.length} characters
          </Text>
        </Section>
      );
    case "email":
      return (
        <Section title="Email details">
          <Grid gap="sm">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="To"
                placeholder="name@example.com"
                value={data.to}
                onChange={(e) => set({ to: e.currentTarget.value })}
                error={
                  data.to.trim() && !isLikelyEmail(data.to) ?
                    "Doesn't look like an email address"
                  : undefined
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Subject"
                placeholder="Subject"
                value={data.subject}
                onChange={(e) => set({ subject: e.currentTarget.value })}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <Textarea
                label="Body"
                rows={4}
                placeholder="Message body"
                value={data.body}
                onChange={(e) => set({ body: e.currentTarget.value })}
              />
            </Grid.Col>
          </Grid>
        </Section>
      );
    case "phone":
      return (
        <Section title="Phone / SMS">
          <Grid gap="sm">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Action"
                value={data.kind}
                onChange={(v) => v && set({ kind: v })}
                data={[
                  { value: "tel", label: "Call (tel:)" },
                  { value: "sms", label: "SMS (smsto:)" },
                ]}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Phone number"
                placeholder="+1-555-010-2030"
                value={data.number}
                onChange={(e) => set({ number: e.currentTarget.value })}
              />
            </Grid.Col>
            {data.kind === "sms" && (
              <Grid.Col span={12}>
                <Textarea
                  label="Prefilled message"
                  rows={3}
                  placeholder="Hello!"
                  value={data.message}
                  onChange={(e) => set({ message: e.currentTarget.value })}
                />
              </Grid.Col>
            )}
          </Grid>
        </Section>
      );
    case "wifi":
      return (
        <Section title="Wi-Fi network">
          <Fields>
            <TextInput
              label="Network name (SSID)"
              placeholder="My-WiFi"
              value={data.ssid}
              onChange={(e) => set({ ssid: e.currentTarget.value })}
            />
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
              <TextInput
                label="Password"
                placeholder="Password"
                value={data.password}
                onChange={(e) => set({ password: e.currentTarget.value })}
              />
            )}
          </Fields>
          <Switch
            label="Hidden network"
            checked={data.hidden}
            onChange={(e) => set({ hidden: e.currentTarget.checked })}
          />
        </Section>
      );
    case "location":
      return (
        <Section title="Location">
          <Fields>
            <TextInput
              label="Latitude"
              placeholder="40.7128"
              value={data.latitude}
              onChange={(e) => set({ latitude: e.currentTarget.value })}
            />
            <TextInput
              label="Longitude"
              placeholder="-74.0060"
              value={data.longitude}
              onChange={(e) => set({ longitude: e.currentTarget.value })}
            />
            <TextInput
              label="Label / query (optional)"
              placeholder="New York"
              value={data.query}
              onChange={(e) => set({ query: e.currentTarget.value })}
            />
          </Fields>
        </Section>
      );
    case "calendar":
      return (
        <Section title="Calendar event">
          <Grid gap="sm">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Title"
                value={data.title}
                onChange={(e) => set({ title: e.currentTarget.value })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Location"
                value={data.location}
                onChange={(e) => set({ location: e.currentTarget.value })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Start"
                type="datetime-local"
                value={data.start}
                onChange={(e) => set({ start: e.currentTarget.value })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="End"
                type="datetime-local"
                value={data.end}
                onChange={(e) => set({ end: e.currentTarget.value })}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <Textarea
                label="Description"
                rows={3}
                value={data.description}
                onChange={(e) => set({ description: e.currentTarget.value })}
              />
            </Grid.Col>
          </Grid>
        </Section>
      );
    case "person":
      return (
        <Stack gap="lg">
          <Section title="Titles">
            <Grid gap="sm">
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  aria-label="First name"
                  placeholder="First name"
                  value={data.firstName}
                  onChange={(e) => set({ firstName: e.currentTarget.value })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  aria-label="Last name"
                  placeholder="Last name"
                  value={data.lastName}
                  onChange={(e) => set({ lastName: e.currentTarget.value })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  aria-label="Title (e.g. Dr.)"
                  placeholder="Title (e.g. Dr.)"
                  value={data.title}
                  onChange={(e) => set({ title: e.currentTarget.value })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  aria-label="Nickname"
                  placeholder="Nickname"
                  value={data.nickname}
                  onChange={(e) => set({ nickname: e.currentTarget.value })}
                />
              </Grid.Col>
            </Grid>
          </Section>
          <Section title="Work">
            <Fields>
              <TextInput
                aria-label="Company"
                placeholder="Company"
                value={data.organization}
                onChange={(e) => set({ organization: e.currentTarget.value })}
              />
              <TextInput
                aria-label="Job title"
                placeholder="Job title"
                value={data.jobTitle}
                onChange={(e) => set({ jobTitle: e.currentTarget.value })}
              />
              <TextInput
                aria-label="Department"
                placeholder="Department"
                value={data.department}
                onChange={(e) => set({ department: e.currentTarget.value })}
              />
            </Fields>
          </Section>
          <Section title="Phone numbers">
            <Fields>
              <TextInput
                aria-label="Work phone"
                placeholder="Work phone"
                value={data.phoneWork}
                onChange={(e) => set({ phoneWork: e.currentTarget.value })}
              />
              <TextInput
                aria-label="Mobile phone"
                placeholder="Mobile phone"
                value={data.phoneMobile}
                onChange={(e) => set({ phoneMobile: e.currentTarget.value })}
              />
              <TextInput
                aria-label="Other phone"
                placeholder="Other phone"
                value={data.phoneOther}
                onChange={(e) => set({ phoneOther: e.currentTarget.value })}
              />
            </Fields>
          </Section>
          <Section title="Contact">
            <Fields>
              <TextInput
                aria-label="Email"
                placeholder="Email"
                value={data.email}
                onChange={(e) => set({ email: e.currentTarget.value })}
                error={
                  data.email.trim() && !isLikelyEmail(data.email) ?
                    "Doesn't look like an email address"
                  : undefined
                }
              />
              <TextInput
                aria-label="Website"
                placeholder="Website"
                value={data.website}
                onChange={(e) => set({ website: e.currentTarget.value })}
              />
              <TextInput
                aria-label="Address"
                placeholder="Address"
                value={data.address}
                onChange={(e) => set({ address: e.currentTarget.value })}
              />
              <Wide>
                <Textarea
                  rows={2}
                  aria-label="Notes"
                  placeholder="Notes"
                  value={data.note}
                  onChange={(e) => set({ note: e.currentTarget.value })}
                />
              </Wide>
            </Fields>
          </Section>
        </Stack>
      );
    case "social":
      return (
        <Section title="Social profile">
          <Fields>
            <Select
              label="Network"
              value={data.network}
              onChange={(v) => v && set({ network: v })}
              data={[
                "X (Twitter)",
                "Instagram",
                "Facebook",
                "LinkedIn",
                "YouTube",
                "TikTok",
                "WhatsApp",
                "Telegram",
                "GitHub",
                "Custom",
              ]}
            />
            <TextInput
              label="Handle"
              placeholder="@username"
              value={data.handle}
              onChange={(e) => set({ handle: e.currentTarget.value })}
            />
            <TextInput
              label="Profile URL"
              placeholder="https://…"
              value={data.url}
              onChange={(e) => set({ url: e.currentTarget.value })}
            />
          </Fields>
        </Section>
      );
  }
}
