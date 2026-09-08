import { describe, it, expect } from "vitest";
import {
  buildQrPayload,
  defaultDataFor,
  rowToFormData,
  templateHeadersFor,
  type QrType,
} from "./qr-payloads";

const ALL_TYPES: QrType[] = [
  "url",
  "text",
  "email",
  "phone",
  "wifi",
  "location",
  "calendar",
  "person",
  "social",
];

/** Extrait la valeur d'une propriété d'un payload ligne-par-ligne (vCard / iCalendar). */
function lines(payload: string) {
  return payload.split("\n");
}
function propLines(payload: string, name: string) {
  return lines(payload).filter((l) => l.startsWith(`${name}:`) || l.startsWith(`${name};`));
}

describe("buildQrPayload — invariants transverses", () => {
  it("produit un payload non vide pour chaque type avec ses valeurs par défaut", () => {
    for (const type of ALL_TYPES) {
      expect(buildQrPayload(defaultDataFor(type)), type).not.toBe("");
    }
  });

  it("est pure : deux appels successifs donnent le même résultat", () => {
    // Garde-fou contre un Date.now() / UID aléatoire : la fonction est appelée
    // dans un useMemo et un payload instable ferait re-render le QR sans cesse.
    for (const type of ALL_TYPES) {
      const data = defaultDataFor(type);
      expect(buildQrPayload(data), type).toBe(buildQrPayload(data));
    }
  });
});

describe("url", () => {
  it("préfixe https:// quand aucun schéma n'est présent", () => {
    expect(buildQrPayload({ type: "url", url: "example.com" })).toBe("https://example.com");
  });

  it("préserve un schéma existant", () => {
    expect(buildQrPayload({ type: "url", url: "http://example.com" })).toBe("http://example.com");
    expect(buildQrPayload({ type: "url", url: "ftp://files.example.com" })).toBe(
      "ftp://files.example.com"
    );
  });
});

describe("email", () => {
  it("encode les espaces en %20 et non en + (les clients mail lisent + littéralement)", () => {
    const out = buildQrPayload({
      type: "email",
      to: "a@b.c",
      subject: "Hello there",
      body: "Hi there",
    });
    expect(out).toContain("subject=Hello%20there");
    expect(out).toContain("body=Hi%20there");
    expect(out).not.toContain("+");
  });

  it("encode les retours ligne et les caractères réservés du corps", () => {
    const out = buildQrPayload({
      type: "email",
      to: "a@b.c",
      subject: "",
      body: "Ligne 1\nLigne 2 & fin",
    });
    expect(out).toContain("%0A");
    expect(out).toContain("%26");
  });

  it("omet la query quand sujet et corps sont vides", () => {
    expect(buildQrPayload({ type: "email", to: "a@b.c", subject: "", body: "" })).toBe(
      "mailto:a@b.c"
    );
  });
});

describe("phone", () => {
  it("génère tel: pour un appel", () => {
    expect(buildQrPayload({ type: "phone", kind: "tel", number: "+33612345678", message: "" })).toBe(
      "tel:+33612345678"
    );
  });

  it("génère smsto:numéro:message quand un message est fourni", () => {
    expect(
      buildQrPayload({ type: "phone", kind: "sms", number: "+33612345678", message: "Salut" })
    ).toBe("smsto:+33612345678:Salut");
  });

  it("retombe sur sms: sans message", () => {
    expect(buildQrPayload({ type: "phone", kind: "sms", number: "+33612345678", message: "" })).toBe(
      "sms:+33612345678"
    );
  });
});

describe("wifi", () => {
  it("échappe tous les caractères réservés de la spec WIFI:, guillemet inclus", () => {
    const out = buildQrPayload({
      type: "wifi",
      ssid: 'My"Net;A,B:C\\D',
      password: 'pa"ss',
      encryption: "WPA",
      hidden: false,
    });
    // Chaque caractère réservé doit être précédé d'un backslash.
    expect(out).toContain('S:My\\"Net\\;A\\,B\\:C\\\\D');
    expect(out).toContain('P:pa\\"ss');
  });

  it("omet le mot de passe pour un réseau ouvert", () => {
    const out = buildQrPayload({
      type: "wifi",
      ssid: "Open",
      password: "ignore",
      encryption: "nopass",
      hidden: false,
    });
    expect(out).toContain("T:nopass");
    expect(out).not.toContain("ignore");
  });
});

describe("location", () => {
  it("génère geo:lat,lng", () => {
    expect(
      buildQrPayload({ type: "location", latitude: "48.85", longitude: "2.35", query: "" })
    ).toBe("geo:48.85,2.35");
  });

  it("ajoute la query encodée", () => {
    expect(
      buildQrPayload({ type: "location", latitude: "48.85", longitude: "2.35", query: "Tour Eiffel" })
    ).toBe("geo:48.85,2.35?q=Tour%20Eiffel");
  });
});

describe("calendar", () => {
  const evt = {
    type: "calendar" as const,
    title: "Launch, v2",
    location: "Hall A; B",
    description: "Venez\nnombreux, svp",
    start: "2026-10-01T18:00",
    end: "2026-10-01T20:00",
  };

  it("enveloppe l'événement dans un VCALENDAR complet (RFC 5545)", () => {
    const out = buildQrPayload(evt);
    const l = lines(out);
    expect(l[0]).toBe("BEGIN:VCALENDAR");
    expect(l).toContain("VERSION:2.0");
    expect(l.some((x) => x.startsWith("PRODID:"))).toBe(true);
    expect(l).toContain("BEGIN:VEVENT");
    expect(l).toContain("END:VEVENT");
    expect(l[l.length - 1]).toBe("END:VCALENDAR");
  });

  it("échappe les retours ligne, virgules et points-virgules des valeurs texte", () => {
    const out = buildQrPayload(evt);
    // Aucune ligne ne doit être orpheline : toutes commencent par un nom de propriété
    // ou BEGIN/END.
    for (const line of lines(out)) {
      expect(line, `ligne orpheline: ${line}`).toMatch(/^[A-Z-]+[;:]/);
    }
    expect(out).toContain("DESCRIPTION:Venez\\nnombreux\\, svp");
    expect(out).toContain("SUMMARY:Launch\\, v2");
    expect(out).toContain("LOCATION:Hall A\\; B");
  });

  it("émet des dates en temps local flottant", () => {
    const out = buildQrPayload(evt);
    expect(out).toContain("DTSTART:20261001T180000");
    expect(out).toContain("DTEND:20261001T200000");
  });

  it("émet un UID unique et déterministe", () => {
    const out = buildQrPayload(evt);
    const uids = propLines(out, "UID");
    expect(uids).toHaveLength(1);
    expect(buildQrPayload(evt)).toBe(out); // stable
    const autre = buildQrPayload({ ...evt, title: "Autre" });
    expect(propLines(autre, "UID")[0]).not.toBe(uids[0]); // différencié par le contenu
  });

  it("omet les dates invalides sans casser le payload", () => {
    const out = buildQrPayload({ ...evt, start: "", end: "pas-une-date" });
    expect(propLines(out, "DTSTART")).toHaveLength(0);
    expect(propLines(out, "DTEND")).toHaveLength(0);
    expect(lines(out)[0]).toBe("BEGIN:VCALENDAR");
  });
});

describe("person (vCard 3.0)", () => {
  const p = {
    type: "person" as const,
    firstName: "Emily",
    lastName: "Turner",
    title: "Dr.",
    nickname: "Em",
    organization: "Acme",
    jobTitle: "Lead UX",
    department: "Design",
    phoneWork: "1-555-1",
    phoneMobile: "1-555-2",
    phoneOther: "1-555-3",
    email: "em@acme.com",
    website: "https://acme.com",
    address: "1 rue de la Paix",
    note: "Rencontre à Paris",
  };

  it("n'émet qu'un seul TITLE, celui du poste", () => {
    const out = buildQrPayload(p);
    const titles = propLines(out, "TITLE");
    expect(titles).toHaveLength(1);
    expect(titles[0]).toBe("TITLE:Lead UX");
  });

  it("place la civilité dans le 4e composant de N (prefix)", () => {
    const out = buildQrPayload(p);
    expect(propLines(out, "N")[0]).toBe("N:Turner;Emily;;Dr.;");
  });

  it("place le département dans le 2e composant de ORG, sans écraser la note", () => {
    const out = buildQrPayload(p);
    expect(propLines(out, "ORG")[0]).toBe("ORG:Acme;Design");
    const notes = propLines(out, "NOTE");
    expect(notes).toHaveLength(1);
    expect(notes[0]).toBe("NOTE:Rencontre à Paris");
  });

  it("omet ORG entièrement sans organisation ni département", () => {
    const out = buildQrPayload({ ...p, organization: "", department: "" });
    expect(propLines(out, "ORG")).toHaveLength(0);
  });

  it("échappe les caractères réservés à l'intérieur d'un composant", () => {
    const out = buildQrPayload({ ...p, organization: "Acme, Inc.", department: "" });
    expect(propLines(out, "ORG")[0]).toBe("ORG:Acme\\, Inc.");
  });

  it("conserve la structure vCard et les coordonnées", () => {
    const out = buildQrPayload(p);
    const l = lines(out);
    expect(l[0]).toBe("BEGIN:VCARD");
    expect(l[1]).toBe("VERSION:3.0");
    expect(l[l.length - 1]).toBe("END:VCARD");
    expect(out).toContain("FN:Emily Turner");
    expect(out).toContain("NICKNAME:Em");
    expect(propLines(out, "TEL")).toHaveLength(3);
    expect(out).toContain("EMAIL;TYPE=PREF,INTERNET:em@acme.com");
  });
});

describe("social", () => {
  it("privilégie l'URL et la normalise", () => {
    expect(
      buildQrPayload({ type: "social", network: "X", handle: "@a", url: "x.com/a" })
    ).toBe("https://x.com/a");
  });

  it("retombe sur le handle sans URL", () => {
    expect(buildQrPayload({ type: "social", network: "X", handle: "@a", url: "" })).toBe("@a");
  });
});

describe("rowToFormData", () => {
  it("accepte une ligne conforme au template pour chaque type", () => {
    for (const type of ALL_TYPES) {
      const headers = templateHeadersFor(type);
      const row: Record<string, unknown> = {};
      const defaults = defaultDataFor(type) as unknown as Record<string, unknown>;
      for (const h of headers) if (h !== "filename") row[h] = defaults[h] ?? "x";
      expect(rowToFormData(type, row), type).not.toBeNull();
    }
  });

  it("rejette une ligne vide", () => {
    for (const type of ALL_TYPES) {
      expect(rowToFormData(type, {}), type).toBeNull();
    }
  });

  it("tolère la casse des noms de colonnes", () => {
    expect(rowToFormData("url", { URL: "example.com" })).not.toBeNull();
    expect(rowToFormData("person", { FirstName: "Emily" })).not.toBeNull();
  });

  it("normalise l'encryption Wi-Fi depuis un libellé libre", () => {
    expect(rowToFormData("wifi", { ssid: "N", encryption: "wep" })).toMatchObject({
      encryption: "WEP",
    });
    expect(rowToFormData("wifi", { ssid: "N", encryption: "None" })).toMatchObject({
      encryption: "nopass",
    });
    expect(rowToFormData("wifi", { ssid: "N", encryption: "" })).toMatchObject({
      encryption: "WPA",
    });
  });

  it("accepte les cellules date Excel converties en objets Date", () => {
    // xlsx avec cellDates:true renvoie des Date ; le flottant Excel donne
    // 17:59:59.999 pour 18:00, d'où l'arrondi à la minute attendu.
    const row = {
      title: "Launch",
      start: new Date(2026, 9, 1, 17, 59, 59, 999),
      end: new Date(2026, 9, 1, 20, 0, 0, 0),
    };
    const data = rowToFormData("calendar", row);
    expect(data).not.toBeNull();
    const out = buildQrPayload(data!);
    expect(out).toContain("DTSTART:20261001T180000");
    expect(out).toContain("DTEND:20261001T200000");
  });

  it("rejette des coordonnées non numériques", () => {
    expect(rowToFormData("location", { latitude: "abc", longitude: "def" })).toBeNull();
    expect(rowToFormData("location", { latitude: "48.85", longitude: "2.35" })).not.toBeNull();
  });
});
