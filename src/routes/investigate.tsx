import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, FileText, Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AGENTS, analyse, type Result } from "@/lib/investigation";
import { DEMO_AD } from "@/lib/data";
import { FindingItem, PageHeader, SafetyIndicator, SimulatedTag } from "@/components/sr/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/investigate")({
  head: () => ({
    meta: [
      { title: "Investigate a job offer — SafeRata" },
      { name: "description", content: "Paste a job advert or contract and see evidence-backed risk findings before you pay or sign." },
      { property: "og:title", content: "Investigate a job offer — SafeRata" },
      { property: "og:description", content: "Six specialist agents check visa, fees, licence and contract language." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Investigate,
});

type Phase = "idle" | "running" | "done";

function Investigate() {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [stamps, setStamps] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const start = () => {
    if (text.trim().length < 40) { setError("Paste at least a few sentences of the advert or contract."); return; }
    setError("");
    const r = analyse(text);
    setResult(r); setPhase("running"); setStep(0); setStamps([]);
    let i = 0;
    timer.current = window.setInterval(() => {
      i++;
      setStamps((s) => [...s, new Date().toLocaleTimeString("en-GB")]);
      setStep(i);
      if (i >= AGENTS.length) { clearInterval(timer.current!); setPhase("done"); }
    }, 650);
  };
  const reset = () => { setPhase("idle"); setResult(null); setStep(0); };

  const verdictCopy = {
    low: "No serious issues found in the text provided.",
    moderate: "Some concerns. Get answers before you continue.",
    high: "Serious risks. Do not pay until each is resolved.",
    critical: "Do not pay or sign. Multiple critical risks.",
  };

  const report = result ? `SafeRata report (simulated)\nRisk: ${result.risk} · Confidence: ${result.confidence}%\n\nFindings:\n${result.findings.map((f) => `- [${f.kind}] ${f.title}${f.excerpt ? ` — "${f.excerpt}"` : ""}`).join("\n")}\n\nOriginal text:\n${text}` : "";

  return (
    <div>
      <PageHeader eyebrow="Trust investigation" title={<>Check an offer<br />before you pay.</>}>
        <SimulatedTag>Backend not connected · simulated agents</SimulatedTag>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <label htmlFor="ad" className="eyebrow">Job advertisement or contract text</label>
          <textarea id="ad" value={text} onChange={(e) => setText(e.target.value)} disabled={phase === "running"} rows={10} placeholder="Paste the WhatsApp message, Facebook post or contract clause you received…" className="mt-2 w-full resize-y rounded-xl border border-input bg-card p-4 font-mono text-sm leading-relaxed shadow-card outline-none focus:border-primary" />
          {error && <p className="mt-2 text-sm font-medium text-risk" role="alert">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={start} disabled={phase === "running"} className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-deep disabled:opacity-60">
              {phase === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Investigate offer
            </button>
            <button onClick={() => setText(DEMO_AD)} disabled={phase === "running"} className="h-11 rounded-md border border-border bg-card px-4 text-sm font-semibold">Use sample offer</button>
            {phase === "done" && <button onClick={reset} className="inline-flex h-11 items-center gap-1.5 px-3 text-sm font-semibold text-muted-foreground"><RotateCcw className="h-4 w-4" /> New</button>}
          </div>
        </div>

        <ol className="relative rounded-xl border border-border bg-card p-5 shadow-card" aria-live="polite">
          <p className="eyebrow mb-4">Agent activity</p>
          {AGENTS.map((a, i) => {
            const st = phase === "idle" ? "wait" : i < step ? "done" : i === step && phase === "running" ? "run" : "wait";
            return (
              <li key={a.id} className="relative grid grid-cols-[28px_1fr] gap-3 pb-4 last:pb-0">
                {i < AGENTS.length - 1 && <span className={cn("absolute left-[13px] top-7 h-[calc(100%-20px)] w-px", st === "done" ? "bg-primary" : "bg-border")} />}
                <span className={cn("z-10 grid h-7 w-7 place-items-center rounded-md border text-xs", st === "done" ? "border-primary bg-primary text-primary-foreground" : st === "run" ? "border-primary text-primary" : "border-border text-muted-foreground")}>
                  {st === "done" ? <Check className="h-3.5 w-3.5" /> : st === "run" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : i + 1}
                </span>
                <div>
                  <p className="flex items-baseline justify-between gap-2 text-sm font-semibold">{a.name}{stamps[i] && <span className="font-mono text-[10px] font-normal text-muted-foreground">{stamps[i]} · simulated</span>}</p>
                  <p className="text-xs text-muted-foreground">{st === "done" && result ? result.logs[a.id] : a.desc}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {phase === "done" && result && (
        <div className="mt-10 space-y-8 rise-in">
          <section className={cn("grid gap-6 rounded-2xl p-7 md:grid-cols-[1fr_auto]", result.risk === "low" ? "bg-safe-soft" : result.risk === "moderate" ? "bg-caution-soft" : "bg-ink text-ink-foreground")}>
            <div>
              <p className="eyebrow">Verdict</p>
              <h2 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">{verdictCopy[result.risk]}</h2>
            </div>
            <dl className="flex gap-8">
              <div><dt className="eyebrow">Risk</dt><dd className="mt-2"><SafetyIndicator risk={result.risk} /></dd></div>
              <div><dt className="eyebrow">Confidence</dt><dd className="mt-1 font-display text-3xl font-bold">{result.confidence}%</dd></div>
            </dl>
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <section>
              <h3 className="mb-2 text-lg font-bold">Findings <span className="font-mono text-sm font-normal text-muted-foreground">{result.findings.length}</span></h3>
              {result.findings.length ? <ul className="rounded-xl border border-border bg-card px-4">{result.findings.map((f, i) => <FindingItem key={f.id} f={f} defaultOpen={i === 0} />)}</ul> : <p className="text-sm text-muted-foreground">No rule-based findings. That is not proof the offer is safe.</p>}
            </section>
            <section className="space-y-6">
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-bold">Extracted evidence</h3>
                <dl className="mt-3 divide-y divide-border text-sm">
                  {result.extracted.map((e) => <div key={e.label} className="flex justify-between gap-3 py-2"><dt className="text-muted-foreground">{e.label}</dt><dd className={cn("text-right font-mono text-xs", !e.value && "text-muted-foreground")}>{e.value ?? "Unavailable"}</dd></div>)}
                </dl>
              </div>
              {result.followUps.length > 0 && (
                <div className="rounded-xl border border-caution/60 bg-caution-soft p-5">
                  <h3 className="font-bold">Missing information</h3>
                  <ul className="mt-2 space-y-1.5 text-sm">{result.followUps.map((q) => <li key={q}>— {q}</li>)}</ul>
                </div>
              )}
            </section>
          </div>

          <section className="grid gap-6 border-t border-border pt-8 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-bold">Ask before paying or signing</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">{result.questions.map((q) => <li key={q}>{q}</li>)}</ol>
            </div>
            <div>
              <h3 className="text-lg font-bold">Next steps</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Check the agency licence with the Sri Lanka Bureau of Foreign Employment.</li>
                <li>Never hand over your passport or pay cash without a receipt.</li>
                <li>Keep screenshots of every message.</li>
              </ul>
              <button onClick={() => { navigator.clipboard?.writeText(report); toast.success("Report draft copied", { description: "Submission to authorities is not connected in this prototype." }); }} className="mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold">
                <FileText className="h-4 w-4" /> Draft report <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
