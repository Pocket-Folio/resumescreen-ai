import { useEffect, useState } from "react";
import { Save, UserCheck } from "lucide-react";
import { api, errorMessage } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import type { Candidate, HRDecision, ReviewStatus } from "../../../shared/types";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Field, Input, Select, Textarea } from "../ui/Form";
import { DECISION, REVIEW_STATUS } from "../../utils/labels";
import { formatDate } from "../../utils/format";
import { cn } from "../../utils/cn";

const REVIEWER_KEY = "rs.reviewerName";

export function HRReviewPanel({ candidate, onSaved }: { candidate: Candidate; onSaved: (c: Candidate) => void }) {
  const toast = useToast();
  const r = candidate.hrReview;
  const [reviewer, setReviewer] = useState(r?.reviewer ?? "");
  const [status, setStatus] = useState<ReviewStatus>(r?.status ?? "in_progress");
  const [notes, setNotes] = useState(r?.notes ?? "");
  const [questions, setQuestions] = useState(r?.followUpQuestions ?? "");
  const [verification, setVerification] = useState(r?.verificationRequired ?? "");
  const [decision, setDecision] = useState<HRDecision | null>(r?.decision ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!r?.reviewer) {
      try {
        setReviewer(localStorage.getItem(REVIEWER_KEY) ?? "");
      } catch {
        /* storage unavailable */
      }
    }
  }, [r?.reviewer]);

  const save = async () => {
    if (!reviewer.trim()) {
      setError("Enter the reviewer's name.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const updated = await api.candidates.saveReview(candidate.id, {
        reviewer: reviewer.trim(),
        status,
        notes,
        followUpQuestions: questions,
        verificationRequired: verification,
        decision,
      });
      try {
        localStorage.setItem(REVIEWER_KEY, reviewer.trim());
      } catch {
        /* storage unavailable */
      }
      onSaved(updated);
      toast.success("HR review saved");
    } catch (e) {
      toast.error("Could not save review", errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-[var(--indigo-bd)]">
      <CardHeader
        icon={<UserCheck className="size-4" />}
        title={
          <span className="flex flex-wrap items-center gap-2">
            HR review <Badge tone="indigo">Human-entered</Badge>
          </span>
        }
        description="Your review and decision are recorded separately from the AI assessment. The AI output never sets these fields."
        actions={r && <span className="text-xs text-ink-3">Last saved {formatDate(r.updatedAt, true)} by {r.reviewer}</span>}
      />
      <CardBody className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="HR reviewer" required htmlFor="rv-name" error={error}>
            <Input id="rv-name" value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name" autoComplete="name" />
          </Field>
          <Field label="Review status" htmlFor="rv-status">
            <Select id="rv-status" value={status} onChange={(e) => setStatus(e.target.value as ReviewStatus)}>
              {(Object.keys(REVIEW_STATUS) as ReviewStatus[]).map((k) => <option key={k} value={k}>{REVIEW_STATUS[k].label}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="HR notes" htmlFor="rv-notes">
          <Textarea id="rv-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Your observations after reviewing the resume and the evidence." />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Follow-up questions" htmlFor="rv-q">
            <Textarea id="rv-q" rows={3} value={questions} onChange={(e) => setQuestions(e.target.value)} />
          </Field>
          <Field label="Verification required" htmlFor="rv-v">
            <Textarea id="rv-v" rows={3} value={verification} onChange={(e) => setVerification(e.target.value)} placeholder="e.g. Confirm certification, references" />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">HR decision</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup">
            {(Object.keys(DECISION) as HRDecision[]).map((k) => (
              <label
                key={k}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                  decision === k ? "border-brand bg-brand-soft font-medium text-brand-ink" : "border-line hover:border-line-strong",
                )}
              >
                <input type="radio" name="decision" className="accent-[var(--brand)]" checked={decision === k} onChange={() => setDecision(k)} />
                {DECISION[k].label}
              </label>
            ))}
          </div>
          {decision && (
            <button type="button" className="mt-2 text-xs text-ink-3 underline" onClick={() => setDecision(null)}>Clear decision</button>
          )}
        </fieldset>
        <div className="flex justify-end">
          <Button variant="primary" loading={saving} onClick={save} icon={<Save className="size-4" />}>Save HR review</Button>
        </div>
      </CardBody>
    </Card>
  );
}
