/**
 * Shared constants and pure helpers for the mail templates / communication page.
 * Placeholders are stored in project_email_templates.placeholders with braces
 * ("{{contact_name}}") - everything in the UI works on the bare key.
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EmailTemplate } from "@/lib/project/types";

export const ALL = "all";

/**
 * One definition for both communication UIs - the partner sheet writes the
 * same communications rows this page reads.
 */
export { COMMUNICATION_CHANNELS, COMMUNICATION_DIRECTIONS } from "@/lib/project/constants";

/** Placeholder tokens look like {{contact_name}}. */
const PLACEHOLDER_SOURCE = "\\{\\{\\s*([A-Za-z0-9_.-]+)\\s*\\}\\}";

/** Keys the composer fills from the selected data without user input. */
export const AUTO_PLACEHOLDER_HINTS: Record<string, string> = {
  contact_name: "Name des Ansprechpartners",
  contact_email: "E-Mail des Ansprechpartners",
  contact_role: "Funktion des Ansprechpartners",
  partner_name: "Name des Partnerunternehmens",
  partner_city: "Ort des Partnerunternehmens",
  sender_name: "Ihr Name aus dem Benutzerprofil",
  sender_email: "Ihre E-Mail-Adresse",
  original_date: "Heutiges Datum",
  today: "Heutiges Datum",
};

export function normalizePlaceholderKey(raw: string): string {
  return raw.replace(/[{}]/g, "").trim();
}

/**
 * Only keys matching the token pattern can ever be substituted in a text - a
 * declared "{{Menge in kg}}" would render an input that never replaces anything.
 */
export function isValidPlaceholderKey(key: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(key);
}

/** All placeholder keys occurring in the given texts, in order of appearance. */
export function extractPlaceholderKeys(...texts: (string | null | undefined)[]): string[] {
  const keys: string[] = [];
  texts.forEach((text) => {
    if (!text) return;
    const pattern = new RegExp(PLACEHOLDER_SOURCE, "g");
    let match = pattern.exec(text);
    while (match !== null) {
      const key = match[1];
      if (!keys.includes(key)) keys.push(key);
      match = pattern.exec(text);
    }
  });
  return keys;
}

/** Placeholders of a template: those used in the text plus the declared ones. */
export function templatePlaceholderKeys(
  template: Pick<EmailTemplate, "subject" | "body_md" | "placeholders">,
): string[] {
  const keys = extractPlaceholderKeys(template.subject, template.body_md);
  (template.placeholders ?? []).forEach((raw) => {
    const key = normalizePlaceholderKey(raw);
    /* Keys the token pattern cannot match would become inputs without effect. */
    if (key && isValidPlaceholderKey(key) && !keys.includes(key)) keys.push(key);
  });
  return keys;
}

/** Replaces every {{key}} that has a non-empty value; unknown tokens stay visible. */
export function applyPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(new RegExp(PLACEHOLDER_SOURCE, "g"), (token: string, key: string) => {
    const value = values[key];
    return value && value.trim() ? value : token;
  });
}

export function buildMailtoHref(email: string, subject: string, body: string): string {
  const params = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  /* "@" stays literal - a percent-encoded address trips up several mail clients. */
  const address = encodeURIComponent(email).replace(/%40/g, "@");
  return `mailto:${address}?${params}`;
}

/** Clipboard API with a textarea/execCommand fallback for non-secure contexts. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // falls through to the legacy path below
    }
  }
  if (typeof document === "undefined") return false;
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "true");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const copied = document.execCommand("copy");
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

/** Local calendar date as YYYY-MM-DD (date columns are timezone free). */
export function isoDateToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Value for an <input type="datetime-local"> in local time. */
export function localDateTimeInputValue(date: Date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function PlaceholderChips({
  keys,
  max,
  className,
}: {
  keys: string[];
  max?: number;
  className?: string;
}) {
  if (keys.length === 0) {
    return <span className="text-xs text-muted-foreground">Keine Platzhalter</span>;
  }
  const shown = max ? keys.slice(0, max) : keys;
  const rest = keys.length - shown.length;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {shown.map((key) => (
        <Badge key={key} variant="outline" className="font-mono text-[10px] font-normal">
          {`{{${key}}}`}
        </Badge>
      ))}
      {rest > 0 && (
        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
          +{rest}
        </Badge>
      )}
    </div>
  );
}
