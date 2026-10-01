/**
 * SMS fallback — architecture-ready, NOT connected to a telecom gateway.
 *
 * Future flow: feature phone → "SOS 5 2 1" → NTA-licensed SMS gateway →
 * POST /api/sms/inbound → parse → create SOS → operations dashboard.
 *
 * Format (case-insensitive, extra spaces allowed):
 *   SOS <people> [children] [elderly] [INJ] [TRAP|MED|RISE|WATER|SAFE] [free text…]
 * Examples:
 *   "SOS 5 2 1"            → 5 people, 2 children, 1 elderly
 *   "sos 3 0 1 inj med"    → injured, medical emergency
 *   "SOS 4 TRAP roof of blue house"
 */
import type { SosSituationKey } from "@/lib/risk-engine/sos-priority";

export type ParsedSms =
  | {
      ok: true;
      peopleCount: number;
      childrenCount: number;
      elderlyCount: number;
      injured: boolean;
      situation: SosSituationKey;
      description?: string;
    }
  | { ok: false; error: string };

const SITUATION_KEYWORDS: Record<string, SosSituationKey> = {
  TRAP: "trapped",
  TRAPPED: "trapped",
  MED: "medical",
  MEDICAL: "medical",
  RISE: "water_rising",
  RISING: "water_rising",
  WATER: "water_entering",
  SAFE: "safe_temporarily",
};

export const SMS_HELP =
  "JalSuraksha: send SOS <people> <children> <elderly>, e.g. SOS 5 2 1. Add INJ if injured, TRAP if trapped, MED for medical. In danger call 100.";

export function parseSosSms(text: string): ParsedSms {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens[0].toUpperCase() !== "SOS") {
    return { ok: false, error: "Message must start with SOS" };
  }

  const numbers: number[] = [];
  let i = 1;
  while (i < tokens.length && numbers.length < 3 && /^\d{1,3}$/.test(tokens[i])) {
    numbers.push(Number.parseInt(tokens[i], 10));
    i++;
  }

  let injured = false;
  let situation: SosSituationKey | null = null;
  const rest: string[] = [];
  for (; i < tokens.length; i++) {
    const t = tokens[i].toUpperCase();
    if (t === "INJ" || t === "INJURED") injured = true;
    else if (!situation && SITUATION_KEYWORDS[t]) situation = SITUATION_KEYWORDS[t];
    else rest.push(tokens[i]);
  }

  const [people = 1, children = 0, elderly = 0] = numbers;
  if (people < 1 || people > 200) return { ok: false, error: "People must be between 1 and 200" };
  if (children + elderly > people) return { ok: false, error: "Children + elderly cannot exceed people" };

  const description = rest.join(" ").slice(0, 1000) || undefined;
  return {
    ok: true,
    peopleCount: people,
    childrenCount: children,
    elderlyCount: elderly,
    injured,
    // An SMS SOS with no keyword is treated as "water rising" — the most
    // common reason to send one — and operators review it anyway.
    situation: situation ?? (description ? "other" : "water_rising"),
    description: description ? `[SMS] ${description}` : "[SMS] Sent via SMS fallback",
  };
}
