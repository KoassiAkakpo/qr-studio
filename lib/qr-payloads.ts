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
    hint: "Plain text. The byte budget depends on the error correction level.",
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

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Ordre d'affichage des types, dérivé des métadonnées plutôt que recopié.
 * Ajouter un type à `QrType` le fait apparaître ici automatiquement.
 */
export const TYPE_ORDER = (Object.keys(QR_TYPE_META) as QrType[]).sort();

/**
 * Échappe une valeur TEXT vCard / iCalendar. Les deux specs partagent les mêmes
 * règles (RFC 6350 §3.4, RFC 5545 §3.3.11) : backslash, point-virgule, virgule et
 * retours ligne. Un retour ligne littéral casserait le payload en produisant une
 * ligne orpheline que les parseurs rejettent.
 */
function escapeText(v: string) {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Assemble une valeur structurée (`N:`, `ORG:`) : chaque composant est échappé
 * séparément, puis joint par des `;` bruts qui restent des séparateurs.
 */
function structured(...components: string[]) {
  return components.map(escapeText).join(";");
}

function escapeWifi(v: string) {
  // La spec WIFI: réserve \ ; , : et le guillemet.
  return v.replace(/([\\;,:"])/g, "\\$1");
}

/** Hash déterministe (djb2) — sert à dériver un UID stable depuis le contenu. */
function stableHash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Temps local flottant : YYYYMMDDTHHMMSS (sans suffixe Z, sans TZID). */
function toVEventDate(input: string): string | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return (
    `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}${pad2(d.getMinutes())}00`
  );
}

/** Horodatage UTC iCalendar : YYYYMMDDTHHMMSSZ. */
function toIcsUtc(input: string): string | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`;
}

/**
 * Contrôle de forme d'une adresse e-mail, volontairement permissif : le but est
 * d'attraper les vraies fautes de saisie (adresse tronquée, espace, domaine sans
 * point) sans rejeter des adresses valides mais inhabituelles.
 */
export function isLikelyEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
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
      // Pas d'URLSearchParams ici : il encode l'espace en "+", que les clients
      // mail affichent littéralement dans un mailto. encodeURIComponent donne %20.
      const params: string[] = [];
      if (data.subject.trim()) params.push(`subject=${encodeURIComponent(data.subject.trim())}`);
      if (data.body) params.push(`body=${encodeURIComponent(data.body)}`);
      return `mailto:${to}${params.length ? `?${params.join("&")}` : ""}`;
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
      const start = toVEventDate(data.start);
      const end = toVEventDate(data.end);
      // UID et DTSTAMP sont dérivés du contenu, jamais de Date.now() :
      // buildQrPayload est appelée dans un useMemo et doit rester pure, sinon le
      // payload changerait à chaque render et le QR se redessinerait sans fin.
      const uid = stableHash(
        JSON.stringify([data.title, data.location, data.description, data.start, data.end])
      );
      const dtstamp = toIcsUtc(data.start);
      const event = [
        "BEGIN:VEVENT",
        `UID:${uid}@qr-studio`,
        dtstamp ? `DTSTAMP:${dtstamp}` : "",
        `SUMMARY:${escapeText(data.title)}`,
        start ? `DTSTART:${start}` : "",
        end ? `DTEND:${end}` : "",
        data.location ? `LOCATION:${escapeText(data.location)}` : "",
        data.description ? `DESCRIPTION:${escapeText(data.description)}` : "",
        "END:VEVENT",
      ].filter(Boolean);
      // L'enveloppe VCALENDAR est requise par la RFC 5545 ; un VEVENT nu est mal
      // géré par une partie des appareils.
      return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//QR Studio//EN",
        ...event,
        "END:VCALENDAR",
      ].join("\n");
    }
    case "person": {
      const fn = `${data.firstName} ${data.lastName}`.trim() || "Contact";
      // N: family;given;additional;prefix;suffix — la civilité ("Dr.") est un
      // prefix, pas un TITLE : TITLE est réservé au poste occupé.
      const n = structured(data.lastName, data.firstName, "", data.title, "");
      // ORG: organization;department — le département est le 2e composant, pas
      // une NOTE, sinon il écrase la note de l'utilisateur.
      const org = data.department
        ? structured(data.organization, data.department)
        : escapeText(data.organization);
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${n}`,
        `FN:${escapeText(fn)}`,
        data.nickname ? `NICKNAME:${escapeText(data.nickname)}` : "",
        data.organization || data.department ? `ORG:${org}` : "",
        data.jobTitle ? `TITLE:${escapeText(data.jobTitle)}` : "",
        data.phoneWork ? `TEL;TYPE=WORK,VOICE:${escapeText(data.phoneWork)}` : "",
        data.phoneMobile ? `TEL;TYPE=CELL,VOICE:${escapeText(data.phoneMobile)}` : "",
        data.phoneOther ? `TEL;TYPE=VOICE:${escapeText(data.phoneOther)}` : "",
        data.email ? `EMAIL;TYPE=PREF,INTERNET:${escapeText(data.email)}` : "",
        data.website ? `URL:${escapeText(data.website)}` : "",
        data.address ? `ADR;TYPE=WORK:;;${escapeText(data.address)};;;;` : "",
        data.note ? `NOTE:${escapeText(data.note)}` : "",
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
      // Doit couvrir tout ce que rowToFormData lit, sinon ces colonnes sont
      // inatteignables depuis un import. L'invariant est testé.
      return [
        "firstName",
        "lastName",
        "title",
        "nickname",
        "organization",
        "jobTitle",
        "department",
        "phoneWork",
        "phoneMobile",
        "phoneOther",
        "email",
        "website",
        "address",
        "note",
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

/**
 * Normalise une cellule date/heure en valeur `datetime-local`.
 *
 * Avec `cellDates: true`, xlsx renvoie un objet Date, mais le flottant Excel
 * introduit une dérive (18:00 arrive en 17:59:59.999) que la troncature des
 * secondes transformerait en 17:59 — d'où l'arrondi à la minute.
 */
function toDateTimeLocal(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const d = new Date(Math.round(value.getTime() / 60_000) * 60_000);
    return (
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
      `T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    );
  }
  return String(value ?? "").trim();
}

export function rowToFormData(
  type: QrType,
  row: Record<string, unknown>
): QrFormData | null {
  // Les en-têtes sont saisis à la main dans Excel : on tolère la casse, sinon
  // "FirstName" rendrait la ligne invalide en silence.
  const byLowerKey = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) byLowerKey.set(k.trim().toLowerCase(), v);
  const raw = (k: string) => byLowerKey.get(k.toLowerCase());
  const s = (k: string) => String(raw(k) ?? "").trim();
  try {
    switch (type) {
      case "url":
        if (!s("url")) return null;
        return { type, url: s("url") };
      case "text":
        if (!s("text")) return null;
        return { type, text: s("text") };
      case "email":
        // Une adresse malformée produirait un mailto: silencieusement inutilisable.
        if (!isLikelyEmail(s("to"))) return null;
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
      case "location": {
        const latitude = s("latitude");
        const longitude = s("longitude");
        if (!latitude || !longitude) return null;
        // Sans ce contrôle une coordonnée textuelle produit un geo:abc,def muet.
        if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return null;
        return { type, latitude, longitude, query: s("query") };
      }
      case "calendar":
        if (!s("title")) return null;
        return {
          type,
          title: s("title"),
          location: s("location"),
          description: s("description"),
          start: toDateTimeLocal(raw("start")),
          end: toDateTimeLocal(raw("end")),
        };
      case "person":
        // Une adresse malformée ne suffit pas à identifier un contact ; un nom
        // ou un mobile, si.
        if (
          !s("firstName") &&
          !s("lastName") &&
          !isLikelyEmail(s("email")) &&
          !s("phoneMobile")
        )
          return null;
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
  // Le nom de fichier explicite vient de la colonne du tableur, pas d'ici :
  // QrFormData n'a pas de champ `filename`. C'est batch-mode qui l'applique.
  const r = data as unknown as Record<string, string>;
  const pick =
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
