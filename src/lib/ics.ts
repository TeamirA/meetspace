/** Minimal RFC 5545 calendar file for a single meeting. */
export interface IcsEvent {
  uid: string;
  title: string;
  description?: string;
  start: Date;
  durationMinutes: number;
  url: string;
  now?: Date;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatIcsDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets must be folded with CRLF + space. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildIcs(e: IcsEvent): string {
  const end = new Date(e.start.getTime() + e.durationMinutes * 60_000);
  const description = [e.description, `Join: ${e.url}`].filter(Boolean).join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Meetspace//Meetings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(e.uid)}`,
    `DTSTAMP:${formatIcsDate(e.now ?? new Date())}`,
    `DTSTART:${formatIcsDate(e.start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(e.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `URL:${e.url}`,
    `LOCATION:${escapeIcsText(e.url)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT10M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(e.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
