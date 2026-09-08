export type QrType =
  | "url"
  | "text"
  | "email"
  | "phone"
  | "wifi"
  | "location"
  | "calendar"
  | "person"
  | "social";

export type PhoneKind = "tel" | "sms";

export interface EmailData {
  to: string;
  subject: string;
  body: string;
}

export interface PhoneData {
  kind: PhoneKind;
  number: string;
  message: string;
}

export interface WifiData {
  ssid: string;
  password: string;
  encryption: "WPA" | "WEP" | "nopass";
  hidden: boolean;
}

export interface LocationData {
  latitude: string;
  longitude: string;
  query: string;
}

export interface CalendarData {
  title: string;
  location: string;
  description: string;
  start: string; // datetime-local value
  end: string;
}

export interface PersonData {
  firstName: string;
  lastName: string;
  title: string;
  nickname: string;
  organization: string;
  jobTitle: string;
  department: string;
  phoneWork: string;
  phoneMobile: string;
  phoneOther: string;
  email: string;
  website: string;
  address: string;
  note: string;
}

export interface SocialData {
  network: string;
  handle: string;
  url: string;
}

export interface UrlData {
  url: string;
}

export interface TextData {
  text: string;
}

export type QrFormData =
  | ({ type: "url" } & UrlData)
  | ({ type: "text" } & TextData)
  | ({ type: "email" } & EmailData)
  | ({ type: "phone" } & PhoneData)
  | ({ type: "wifi" } & WifiData)
  | ({ type: "location" } & LocationData)
  | ({ type: "calendar" } & CalendarData)
  | ({ type: "person" } & PersonData)
  | ({ type: "social" } & SocialData);

export const QR_TYPE_META: Record<
  QrType,
  { label: string; placeholder: string; hint: string }
> = {
  url: {
    label: "URL",
    placeholder: "https://example.com",
    hint: "Opens a website when scanned.",
  },
  text: {
    label: "Text",
    placeholder: "Plain text",
    hint: "Any plain text up to ~2,900 chars.",
  },
  email: {
    label: "Email",
    placeholder: "name@example.com",
    hint: "Opens the mail app with prefilled fields.",
  },
  phone: {
    label: "Phone / SMS",
    placeholder: "+1-555-010-2030",
    hint: "Starts a call or a prefilled SMS.",
  },
  wifi: {
    label: "Wi-Fi",
    placeholder: "Network name (SSID)",
    hint: "Joins a Wi-Fi network without typing the password.",
  },
  location: {
    label: "Location",
    placeholder: "Latitude / Longitude",
    hint: "Opens the coordinates in Maps.",
  },
  calendar: {
    label: "Calendar",
    placeholder: "Event title",
    hint: "Adds an event to the calendar (VEVENT).",
  },
  person: {
    label: "Person",
    placeholder: "Contact card (vCard)",
    hint: "Saves a contact via vCard 3.0.",
  },
  social: {
    label: "Social",
    placeholder: "@handle or profile URL",
    hint: "Links to a social profile.",
  },
};

function escapeVCard(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function escapeWifi(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/:/g, "\\:");
}

function toVEventDate(input: string): string | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  // Floating local time: YYYYMMDDTHHMMSS
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `T${p(d.getHours())}${p(d.getMinutes())}00`
  );
}

function ensureUrl(u: string) {
  const t = u.trim();
  if (!t) return "";
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t)) return t;
  return `https://${t}`;
}

export function defaultDataFor(type: QrType): QrFormData {
  switch (type) {
    case "url":
      return { type, url: "https://example.com" };
    case "text":
      return { type, text: "Scan me with your camera" };
    case "email":
      return { type, to: "hello@example.com", subject: "Hello", body: "Hi there," };
    case "phone":
      return { type, kind: "tel", number: "+1-555-010-2030", message: "Hello!" };
    case "wifi":
      return { type, ssid: "My-WiFi", password: "secret123", encryption: "WPA", hidden: false };
    case "location":
      return { type, latitude: "40.7128", longitude: "-74.0060", query: "New York" };
    case "calendar":
      return {
        type,
        title: "Product Launch",
        location: "Main Hall",
        description: "Join us for the launch event.",
        start: "2026-10-01T18:00",
        end: "2026-10-01T20:00",
      };
    case "person":
      return {
        type,
        firstName: "Emily",
        lastName: "Turner",
        title: "",
        nickname: "",
        organization: "Tunabelly Software",
        jobTitle: "Lead UX Designer",
        department: "",
        phoneWork: "1-555-987-6543",
        phoneMobile: "1-555-654-3210",
        phoneOther: "",
        email: "em.turner@tunabelly.com",
        website: "",
        address: "",
        note: "",
      };
    case "social":
      return { type, network: "X (Twitter)", handle: "@example", url: "https://x.com/example" };
  }
}

export function buildQrPayload(data: QrFormData): string {
  switch (data.type) {
    case "url":
      return ensureUrl(data.url) || "https://example.com";
    case "text":
      return data.text || "";
    case "email": {
      const to = data.to.trim();
      const params = new URLSearchParams();
      if (data.subject.trim()) params.set("subject", data.subject.trim());
      if (data.body) params.set("body", data.body);
      const q = params.toString();
      return `mailto:${to}${q ? `?${q}` : ""}`;
    }
    case "phone": {
      const num = data.number.trim();
      if (data.kind === "sms") {
        const body = data.message.trim();
        if (!num && !body) return "sms:";
        // smsto: is most widely supported
        return body ? `smsto:${num}:${body}` : `sms:${num}`;
      }
      return `tel:${num}`;
    }
    case "wifi": {
      const enc = data.encryption;
      const hidden = data.hidden ? "true" : "false";
      if (enc === "nopass") {
        return `WIFI:T:nopass;S:${escapeWifi(data.ssid)};H:${hidden};;`;
      }
      return `WIFI:T:${enc};S:${escapeWifi(data.ssid)};P:${escapeWifi(data.password)};H:${hidden};;`;
    }
    case "location": {
      const lat = data.latitude.trim();
      const lng = data.longitude.trim();
      const q = data.query.trim();
      if (q) return `geo:${lat},${lng}?q=${encodeURIComponent(q)}`;
      return `geo:${lat},${lng}`;
    }
    case "calendar": {
      const start = toVEventDate(data.start) ?? "";
      const end = toVEventDate(data.end) ?? "";
      const lines = [
        "BEGIN:VEVENT",
        `SUMMARY:${data.title}`,
        start ? `DTSTART:${start}` : "",
        end ? `DTEND:${end}` : "",
        data.location ? `LOCATION:${data.location}` : "",
        data.description ? `DESCRIPTION:${data.description}` : "",
        "END:VEVENT",
      ].filter(Boolean);
      return lines.join("\n");
    }
    case "person": {
      const n = `${escapeVCard(data.lastName)};${escapeVCard(data.firstName)};;;`;
      const fn = `${data.firstName} ${data.lastName}`.trim() || "Contact";
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${n}`,
        `FN:${escapeVCard(fn)}`,
        data.nickname ? `NICKNAME:${escapeVCard(data.nickname)}` : "",
        data.title ? `TITLE:${escapeVCard(data.title)}` : "",
        data.organization ? `ORG:${escapeVCard(data.organization)}` : "",
        data.jobTitle ? `TITLE:${escapeVCard(data.jobTitle)}` : "",
        data.department ? `NOTE:Dept: ${escapeVCard(data.department)}` : "",
        data.phoneWork ? `TEL;TYPE=WORK,VOICE:${escapeVCard(data.phoneWork)}` : "",
        data.phoneMobile ? `TEL;TYPE=CELL,VOICE:${escapeVCard(data.phoneMobile)}` : "",
        data.phoneOther ? `TEL;TYPE=VOICE:${escapeVCard(data.phoneOther)}` : "",
        data.email ? `EMAIL;TYPE=PREF,INTERNET:${escapeVCard(data.email)}` : "",
        data.website ? `URL:${escapeVCard(data.website)}` : "",
        data.address ? `ADR;TYPE=WORK:;;${escapeVCard(data.address)};;;;` : "",
        data.note ? `NOTE:${escapeVCard(data.note)}` : "",
        "END:VCARD",
      ].filter(Boolean);
      return lines.join("\n");
    }
    case "social": {
      if (data.url.trim()) return ensureUrl(data.url.trim());
      return data.handle.trim();
    }
  }
}

/* ---------- Batch / Excel helpers ---------- */

export function templateHeadersFor(type: QrType): string[] {
  switch (type) {
    case "url":
      return ["url", "filename"];
    case "text":
      return ["text", "filename"];
    case "email":
      return ["to", "subject", "body", "filename"];
    case "phone":
      return ["kind", "number", "message", "filename"];
    case "wifi":
      return ["ssid", "password", "encryption", "hidden", "filename"];
    case "location":
      return ["latitude", "longitude", "query", "filename"];
    case "calendar":
      return ["title", "location", "description", "start", "end", "filename"];
    case "person":
      return [
        "firstName",
        "lastName",
        "organization",
        "jobTitle",
        "phoneWork",
        "phoneMobile",
        "email",
        "website",
        "filename",
      ];
    case "social":
      return ["network", "handle", "url", "filename"];
  }
}

export function templateRowFor(type: QrType): Record<string, string> {
  const d = defaultDataFor(type) as unknown as Record<string, string>;
  const headers = templateHeadersFor(type);
  const row: Record<string, string> = {};
  for (const h of headers) {
    if (h === "filename") {
      row[h] = "";
    } else if (typeof d[h] === "boolean") {
      row[h] = d[h] ? "true" : "false";
    } else {
      row[h] = String(d[h] ?? "");
    }
  }
  return row;
}

export function rowToFormData(
  type: QrType,
  row: Record<string, unknown>
): QrFormData | null {
  const s = (k: string) => String(row[k] ?? "").trim();
  try {
    switch (type) {
      case "url":
        if (!s("url")) return null;
        return { type, url: s("url") };
      case "text":
        if (!s("text")) return null;
        return { type, text: s("text") };
      case "email":
        if (!s("to")) return null;
        return { type, to: s("to"), subject: s("subject"), body: s("body") };
      case "phone": {
        if (!s("number")) return null;
        const kind: PhoneKind = s("kind").toLowerCase().startsWith("sms") ? "sms" : "tel";
        return { type, kind, number: s("number"), message: s("message") };
      }
      case "wifi": {
        if (!s("ssid")) return null;
        const encRaw = s("encryption").toUpperCase();
        const encryption: WifiData["encryption"] =
          encRaw.includes("WEP") ? "WEP" : encRaw.includes("NOPASS") || encRaw === "NONE" ? "nopass" : "WPA";
        return {
          type,
          ssid: s("ssid"),
          password: s("password"),
          encryption,
          hidden: ["true", "yes", "1"].includes(s("hidden").toLowerCase()),
        };
      }
      case "location":
        if (!s("latitude") || !s("longitude")) return null;
        return { type, latitude: s("latitude"), longitude: s("longitude"), query: s("query") };
      case "calendar":
        if (!s("title")) return null;
        return {
          type,
          title: s("title"),
          location: s("location"),
          description: s("description"),
          start: s("start"),
          end: s("end"),
        };
      case "person":
        if (!s("firstName") && !s("lastName") && !s("email") && !s("phoneMobile")) return null;
        return {
          type,
          firstName: s("firstName"),
          lastName: s("lastName"),
          title: s("title"),
          nickname: s("nickname"),
          organization: s("organization"),
          jobTitle: s("jobTitle"),
          department: s("department"),
          phoneWork: s("phoneWork"),
          phoneMobile: s("phoneMobile"),
          phoneOther: s("phoneOther"),
          email: s("email"),
          website: s("website"),
          address: s("address"),
          note: s("note"),
        };
      case "social": {
        if (!s("url") && !s("handle")) return null;
        return { type, network: s("network") || "Custom", handle: s("handle"), url: s("url") };
      }
    }
  } catch {
    return null;
  }
}

export function labelForRow(type: QrType, data: QrFormData, index: number): string {
  const r = data as unknown as Record<string, string>;
  const pick =
    r.filename ||
    r.url ||
    r.text ||
    r.to ||
    r.number ||
    r.ssid ||
    `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() ||
    r.title ||
    r.handle ||
    `${r.latitude},${r.longitude}`;
  const base = (pick || `${type}-${index + 1}`).slice(0, 60);
  return base;
}
