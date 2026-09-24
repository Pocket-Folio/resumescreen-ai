import { useRef, useState } from "react";
import { FileUp, Info, Sparkles } from "lucide-react";
import { api, errorMessage, type JobDraft } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { useApp } from "../../context/AppContext";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Checkbox } from "../ui/Form";
import { ImportanceBadge } from "../StatusBadges";
import { CATEGORY } from "../../utils/labels";

/** "Upload job description" — extracts text from a PDF/DOCX/TXT/image on this server. */
export function UploadJobDescriptionButton({ onText, size = "sm", label = "Upload job description" }: { onText: (text: string) => void; size?: "sm" | "md"; label?: string }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button size={size} icon={<FileUp className="size-4" />} loading={busy} onClick={() => ref.current?.click()}>{label}</Button>
      <input
        ref={ref}
        type="file"
        accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            const r = await api.jobProfiles.extractDescription(f);
            onText(r.text);
            toast.success("Job description imported", r.method === "ocr" ? "Read with OCR — please check the text." : f.name);
            r.warnings.forEach((w) => toast.warning("Check the imported text", w));
          } catch (err) {
            toast.error("Could not read the job description", errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

/** "Draft criteria with Claude" — suggests qualifications + criteria from the description; HR picks what to apply. */
export function DraftCriteriaButton({ title, description, onApply }: { title: string; description: string; onApply: (draft: JobDraft, selected: JobDraft["criteria"]) => void }) {
  const toast = useToast();
  const { apiKey } = useApp();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<JobDraft | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const run = async () => {
    setBusy(true);
    try {
      const d = await api.jobProfiles.draft(title, description);
      setDraft(d);
      setPicked(new Set(d.criteria.map((_, i) => i)));
    } catch (e) {
      toast.error("Could not draft criteria", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        icon={<Sparkles className="size-4" />}
        loading={busy}
        disabled={!apiKey.configured || description.trim().length < 40}
        title={!apiKey.configured ? "Configure the Claude API key in Settings first" : description.trim().length < 40 ? "Add a job description first" : undefined}
        onClick={run}
      >
        {busy ? "Drafting…" : "Draft criteria with Claude"}
      </Button>
      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        size="xl"
        title="Suggested screening criteria"
        description="AI-generated from the job description. Choose which criteria to add; empty qualification fields will also be filled. Review everything before saving."
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                onApply(draft!, draft!.criteria.filter((_, i) => picked.has(i)));
                setDraft(null);
              }}
            >
              Add {picked.size} criteria
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            {draft.notes.length > 0 && (
              <div className="tone-yellow space-y-1 rounded-lg border p-3 text-sm">
                <div className="flex items-center gap-1.5 font-medium"><Info className="size-4" /> Notes for HR</div>
                <ul className="list-disc pl-5">{draft.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </div>
            )}
            <table className="table-base">
              <thead>
                <tr><th className="w-10" /><th>Criterion</th><th>Requirement</th><th>Importance</th><th>Category</th></tr>
              </thead>
              <tbody>
                {draft.criteria.map((c, i) => (
                  <tr key={i}>
                    <td>
                      <Checkbox
                        label={`Include ${c.criterion}`}
                        checked={picked.has(i)}
                        onChange={(v) =>
                          setPicked((s) => {
                            const n = new Set(s);
                            if (v) n.add(i);
                            else n.delete(i);
                            return n;
                          })
                        }
                      />
                    </td>
                    <td className="font-medium">{c.criterion}</td>
                    <td className="text-ink-2">{c.requirement}</td>
                    <td><ImportanceBadge value={c.importance} /></td>
                    <td className="text-ink-2">{CATEGORY[c.category]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </>
  );
}
