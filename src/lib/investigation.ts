/**
 * SIMULATED investigation engine. No backend is connected: the agents below run
 * deterministic rules in the browser and every event is labelled "Simulated".
 * Replace `runInvestigation` with a call to the real backend once its interface
 * is confirmed.
 */
import type { Finding, RiskLevel } from "./data";

export const AGENTS = [
  { id: "extract", name: "Extraction", desc: "Reads salary, visa, fees, employer and licence details" },
  { id: "official", name: "Official verification", desc: "Checks licence against the (simulated) registry" },
  { id: "contract", name: "Contract analysis", desc: "Flags risky clauses and quotes exact language" },
  { id: "graph", name: "Graph investigation", desc: "Looks for links to known agencies and listings" },
  { id: "critic", name: "Independent critique", desc: "Challenges findings and lowers weak claims" },
  { id: "advice", name: "Advice", desc: "Drafts questions and next steps" },
] as const;

export interface Extracted { label: string; value: string | null }
export interface Result {
  extracted: Extracted[];
  findings: Finding[];
  followUps: string[];
  questions: string[];
  risk: RiskLevel;
  confidence: number;
  logs: Record<string, string>;
}

function quote(text: string, re: RegExp) {
  const m = text.match(re);
  if (!m || m.index === undefined) return undefined;
  const start = Math.max(0, text.lastIndexOf(".", m.index) + 1);
  const endDot = text.indexOf(".", m.index + m[0].length);
  return text.slice(start, endDot === -1 ? undefined : endDot).trim();
}

export function analyse(text: string): Result {
  const t = text;
  const salary = t.match(/(QAR|SAR|AED|MYR|JPY|KWD|LKR|USD)\s?[\d,]+/i)?.[0] ?? null;
  const fee = t.match(/(pay|fee)[^.]{0,30}?(LKR|Rs\.?)\s?[\d,]+/i)?.[0] ?? null;
  const licence = t.match(/licen[cs]e\s*(no\.?|number)?\s*[:#]?\s*([A-Z0-9-]{4,})/i)?.[2] ?? null;
  const visa = /tourist visa|visit visa/i.test(t) ? "Tourist / visit visa" : /work permit|employment visa|work visa|SSW/i.test(t) ? "Employment visa" : null;
  const employer = t.match(/(?:employer|company)\s*[:\-]\s*([A-Z][\w &]+)/)?.[1] ?? null;

  const findings: Finding[] = [];
  const add = (f: Omit<Finding, "id">) => findings.push({ ...f, id: `x${findings.length}` });

  if (/tourist visa|visit visa/i.test(t))
    add({ severity: "critical", kind: "confirmed", title: "Tourist or visit visa proposed for work", excerpt: quote(t, /tourist visa|visit visa/i), why: "Working on a tourist visa is unlawful in most destinations and removes labour protection. 'Conversion on arrival' is generally not possible.", source: "SafeRata analysis" });
  if (/passport/i.test(t) && /(hand|held|keep|submit|surrender)/i.test(t))
    add({ severity: "high", kind: "confirmed", title: "Passport retention", excerpt: quote(t, /passport/i), why: "You have the right to keep your passport. Retention makes it harder to leave an abusive situation.", source: "SafeRata analysis" });
  if (fee) {
    const amt = Number(fee.replace(/[^\d]/g, ""));
    add({ severity: amt >= 300000 ? "critical" : amt >= 100000 ? "high" : "moderate", kind: "confirmed", title: "Upfront payment requested", excerpt: quote(t, /(pay|fee)/i), why: "Upfront fees, especially in cash or before a contract is signed, are linked to debt bondage. Ask who receives the money and request a receipt.", source: "SafeRata analysis" });
  }
  if (/urgent|limited seats|act now|today only/i.test(t))
    add({ severity: "moderate", kind: "suspected", title: "Pressure tactics", excerpt: quote(t, /urgent|limited seats|act now|today only/i), why: "Artificial urgency discourages you from checking details.", source: "SafeRata analysis" });
  if (/whatsapp only|telegram only/i.test(t))
    add({ severity: "moderate", kind: "suspected", title: "Contact restricted to messaging apps", excerpt: quote(t, /whatsapp only|telegram only/i), why: "Licensed agencies normally have a registered office you can visit.", source: "SafeRata analysis" });
  if (/sole discretion|without notice/i.test(t))
    add({ severity: "high", kind: "confirmed", title: "Unilateral change clause", excerpt: quote(t, /sole discretion|without notice/i), why: "Lets the employer change your duties or location without agreement.", source: "SafeRata analysis" });
  if (!licence)
    add({ severity: "moderate", kind: "unavailable", title: "No licence number found", why: "Without a licence number we cannot check the agency against any registry.", source: "Not available" });
  if (/\b(4,?[5-9]\d{2}|[5-9],?\d{3})\b/.test(salary ?? "") && /MYR/i.test(salary ?? "") && /no experience/i.test(t))
    add({ severity: "high", kind: "suspected", title: "Salary unusually high for an entry-level role", excerpt: quote(t, /salary|earn/i), why: "Pay far above market rates is commonly used as bait.", source: "SafeRata analysis" });

  const followUps: string[] = [];
  if (!licence) followUps.push("What is the agency's licence number?");
  if (!visa) followUps.push("Which visa category will be issued, and who applies for it?");
  if (!salary) followUps.push("What is the exact monthly basic salary and currency?");
  if (!employer) followUps.push("What is the employer's registered name and address?");
  if (!fee) followUps.push("Will you be asked to pay any fee? If so, how much, to whom, and with what receipt?");

  const score = findings.reduce((s, f) => s + ({ low: 0, moderate: 1, high: 2, critical: 4 }[f.severity] * (f.kind === "suspected" ? 0.6 : f.kind === "unavailable" ? 0.4 : 1)), 0);
  const risk: RiskLevel = score >= 5 ? "critical" : score >= 3 ? "high" : score >= 1 ? "moderate" : "low";
  const confidence = Math.max(25, Math.min(90, 40 + (5 - followUps.length) * 10));

  return {
    extracted: [
      { label: "Salary", value: salary },
      { label: "Visa", value: visa },
      { label: "Fee requested", value: fee },
      { label: "Licence", value: licence },
      { label: "Employer", value: employer },
    ],
    findings,
    followUps,
    questions: [
      "Can I see the full employment contract before paying anything?",
      "Is the contract registered with the Sri Lanka Bureau of Foreign Employment?",
      "Who pays for the visa, flight and medical?",
      "Will I keep my passport at all times?",
      "Can I speak to a worker you placed with this employer?",
    ],
    risk,
    confidence,
    logs: {
      extract: `Identified ${[salary, visa, fee, licence, employer].filter(Boolean).length} of 5 key fields.`,
      official: licence ? `Licence ${licence} — simulated registry lookup returned no match in demo data.` : "Skipped — no licence number present.",
      contract: `${findings.filter((f) => f.kind === "confirmed").length} clause-level findings with exact quotes.`,
      graph: /bluewave/i.test(t) ? "Name matches 1 listing in SafeRata demo data (BlueWave Global Careers)." : "No links found in demo data.",
      critic: `Downgraded ${findings.filter((f) => f.kind === "suspected").length} findings to 'suspected' — pattern-based, not confirmed.`,
      advice: `Prepared ${followUps.length} follow-up questions and 5 pre-payment checks.`,
    },
  };
}
