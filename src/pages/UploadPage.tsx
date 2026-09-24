import { useEffect, useRef, useState, type DragEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, CheckCircle2, ClipboardPaste, Eye, FileText, FileUp, Loader2, RotateCcw, Sparkles, Trash2, XCircle, FileSearch } from "lucide-react";
import { api, ApiError, errorMessage } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useToast } from "../context/ToastContext";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Field, Select } from "../components/ui/Form";
import { ScreeningStatusBadge } from "../components/StatusBadges";
import { ResumeTextModal } from "../components/candidates/ResumeTextModal";
import { ClaudeExtractDialog } from "../components/candidates/ClaudeExtractDialog";
import { formatBytes } from "../utils/format";
import { cn } from "../utils/cn";
import { clientId } from "../utils/id";
import type { Candidate } from "../../shared/types";

const ACCEPT = [".pdf", ".docx", ".txt", ".jpg", ".jpeg", ".png"];
const MAX_BYTES = 10 * 1024 * 1024;

type UploadStatus = "queued" | "uploading" | "done" | "rejected";
interface Item {
  key: string;
  file: File;
  /** Job profile chosen when the file was added (changing the select later doesn't reassign it). */
  jobId: string;
  status: UploadStatus;
  error?: string;
  candidate?: Candidate;
}

const ext = (name: string) => "." + (name.toLowerCase().split(".").pop() ?? "");

export function UploadPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [jobId, setJobId] = useState(params.get("job") ?? "");
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [viewing, setViewing] = useState<Candidate | null>(null);
  const [pasteFor, setPasteFor] = useState<Candidate | "new" | null>(null);
  const [claudeFor, setClaudeFor] = useState<Item | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const retryInputRef = useRef<HTMLInputElement>(null);
  const retryTarget = useRef<Item | null>(null);
  const jobs = useAsync(() => api.jobProfiles.list(), []);

  const patch = (key: string, p: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const addFiles = (files: FileList | File[]) => {
    const next: Item[] = [...files].map((file) => {
      const key = clientId("up");
      if (!ACCEPT.includes(ext(file.name)))
        return { key, file, jobId, status: "rejected", error: ext(file.name) === ".doc" ? "Older .doc files are not supported. Save as .docx or PDF." : "Unsupported file type. Use PDF, DOCX, TXT, JPG or PNG." };
      if (file.size > MAX_BYTES) return { key, file, jobId, status: "rejected", error: `File is larger than ${formatBytes(MAX_BYTES)}.` };
      if (file.size === 0) return { key, file, jobId, status: "rejected", error: "File is empty." };
      return { key, file, jobId, status: "queued" };
    });
    setItems((list) => [...list, ...next]);
  };

  // Upload queued files one at a time so each row shows its own progress.
  const busy = useRef(false);
  useEffect(() => {
    if (busy.current) return;
    const nextItem = items.find((i) => i.status === "queued");
    if (!nextItem) return;
    busy.current = true;
    patch(nextItem.key, { status: "uploading" });
    api.candidates
      .upload(nextItem.file, nextItem.jobId || null)
      .then((candidate) => patch(nextItem.key, { status: "done", candidate }))
      .catch((e: unknown) => patch(nextItem.key, { status: "rejected", error: errorMessage(e) }))
      .finally(() => {
        busy.current = false;
        setItems((l) => [...l]);
      });
  }, [items]);

  // Warn before leaving while files are still being uploaded or read.
  const pending = items.some((i) => i.status === "queued" || i.status === "uploading");
  useEffect(() => {
    if (!pending) return;
    const fn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [pending]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const retry = async (item: Item, file: File) => {
    if (!item.candidate) return;
    patch(item.key, { status: "uploading" });
    try {
      const candidate = await api.candidates.reextract(item.candidate.id, file);
      patch(item.key, { status: "done", candidate, file });
      toast.success("Text extracted", file.name);
    } catch (e) {
      patch(item.key, { status: "done" });
      toast.error("Extraction failed again", e instanceof ApiError ? e.message : undefined);
    }
  };

  const uploaded = items.filter((i) => i.candidate).map((i) => i.candidate!);
  const screenable = uploaded.filter((c) => c.resumeText.trim());
  const uploading = items.some((i) => i.status === "queued" || i.status === "uploading");

  return (
    <>
      <PageHeader
        eyebrow={<Link to="/candidates" className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink"><ArrowLeft className="size-3.5" /> Candidates</Link>}
        title="Upload resumes"
        description="Upload one or more resumes. Text is extracted on this server and is not sent anywhere until you run a screening."
        actions={
          <Button icon={<ClipboardPaste className="size-4" />} onClick={() => setPasteFor("new")}>Paste resume text</Button>
        }
      />

      <div className="space-y-6">
        <Card>
          <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,320px)_1fr]">
            <Field label="Assign to job profile" htmlFor="job" hint="Optional — you can also choose the profile when screening.">
              <Select id="job" value={jobId} onChange={(e) => setJobId(e.target.value)} disabled={jobs.loading}>
                <option value="">No job profile</option>
                {jobs.data?.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </Select>
            </Field>
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload resume files. Drag and drop files here or press Enter to browse."
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), inputRef.current?.click())}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                dragging ? "border-brand bg-brand-soft" : "border-line-strong hover:border-brand hover:bg-surface-2",
              )}
            >
              <FileUp className="mb-2 size-8 text-brand" aria-hidden />
              <p className="text-sm font-medium">Drag and drop resumes here, or <span className="text-brand-ink underline">browse files</span></p>
              <p className="mt-1 text-xs text-ink-3">PDF, DOCX, TXT, JPG or PNG · up to {formatBytes(MAX_BYTES)} each · multiple files allowed</p>
              <p className="mt-1 text-xs text-ink-3">Scanned PDFs and photos are read with OCR on this server.</p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT.join(",")}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        </Card>

        {items.length > 0 && (
          <Card>
            <CardHeader
              title="Uploaded files"
              description={uploading ? "Processing files…" : `${uploaded.length} candidate${uploaded.length === 1 ? "" : "s"} created`}
              actions={
                <Button
                  variant="primary"
                  icon={<FileSearch className="size-4" />}
                  disabled={uploading || screenable.length === 0}
                  onClick={() => navigate(`/screening?candidates=${screenable.map((c) => c.id).join(",")}${jobId ? `&job=${jobId}` : ""}`)}
                >
                  Screen {screenable.length || ""} candidate{screenable.length === 1 ? "" : "s"}
                </Button>
              }
            />
            <div className="overflow-x-auto">
              <table className="table-base min-w-[900px]">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Size</th>
                    <th>Type</th>
                    <th>Upload</th>
                    <th>Text extraction</th>
                    <th>Screening</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => {
                    const c = i.candidate;
                    const failed = c?.extraction.status === "failed";
                    return (
                      <tr key={i.key}>
                        <td>
                          <div className="flex items-center gap-2">
                            <FileText className="size-4 shrink-0 text-ink-3" aria-hidden />
                            <div className="min-w-0">
                              <div className="truncate font-medium">{i.file.name}</div>
                              {c && <Link to={`/candidates/${c.id}`} className="text-xs text-brand-ink hover:underline">{c.name}</Link>}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap text-ink-2">{formatBytes(i.file.size)}</td>
                        <td className="text-ink-2 uppercase">{ext(i.file.name).slice(1)}</td>
                        <td>
                          {i.status === "queued" && <Badge tone="gray">Queued</Badge>}
                          {i.status === "uploading" && <Badge tone="blue" icon={<Loader2 className="size-3 animate-spin" />}>Uploading & reading</Badge>}
                          {i.status === "done" && <Badge tone="green" icon={<CheckCircle2 className="size-3" />}>Uploaded</Badge>}
                          {i.status === "rejected" && <Badge tone="red" icon={<XCircle className="size-3" />}>Not uploaded</Badge>}
                          {i.status === "rejected" && i.error && <p className="mt-1 max-w-xs text-xs text-[var(--red-fg)]">{i.error}</p>}
                        </td>
                        <td>
                          {!c ? (
                            <span className="text-ink-3">—</span>
                          ) : failed ? (
                            <>
                              <Badge tone="red">Failed</Badge>
                              <p className="mt-1 max-w-xs text-xs text-[var(--red-fg)]">{c.extraction.error}</p>
                            </>
                          ) : (
                            <>
                              <Badge tone={c.extraction.method === "ocr" ? "yellow" : "green"}>
                                {c.extraction.status === "manual" ? "Manual text" : c.extraction.method === "ocr" ? "Extracted (OCR)" : c.extraction.method === "claude" ? "Read by Claude" : "Extracted"}
                              </Badge>
                              {c.extraction.warnings.map((w) => <p key={w} className="mt-1 max-w-xs text-xs text-[var(--yellow-fg)]">{w}</p>)}
                            </>
                          )}
                        </td>
                        <td>{c ? <ScreeningStatusBadge value={c.screeningStatus} /> : <span className="text-ink-3">—</span>}</td>
                        <td>
                          <div className="flex justify-end gap-1">
                            {c && !failed && <Button size="sm" variant="ghost" icon={<Eye className="size-3.5" />} onClick={() => setViewing(c)}>View text</Button>}
                            {c && (failed || c.extraction.method === "ocr") && /\.(pdf|jpe?g|png)$/i.test(i.file.name) && (
                              <Button size="sm" variant="ghost" icon={<Sparkles className="size-3.5" />} onClick={() => setClaudeFor(i)}>Read with Claude</Button>
                            )}
                            {c && failed && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  icon={<RotateCcw className="size-3.5" />}
                                  onClick={() => {
                                    retryTarget.current = i;
                                    retryInputRef.current?.click();
                                  }}
                                >
                                  Retry
                                </Button>
                                <Button size="sm" variant="ghost" icon={<ClipboardPaste className="size-3.5" />} onClick={() => setPasteFor(c)}>Paste text</Button>
                              </>
                            )}
                            {!c && i.status === "rejected" && (
                              <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => setItems((l) => l.filter((x) => x.key !== i.key))} aria-label="Remove from list" />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <input
              ref={retryInputRef}
              type="file"
              accept={ACCEPT.join(",")}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && retryTarget.current) void retry(retryTarget.current, f);
                e.target.value = "";
              }}
            />
          </Card>
        )}
      </div>

      {claudeFor?.candidate && (
        <ClaudeExtractDialog
          open
          onClose={() => setClaudeFor(null)}
          candidate={claudeFor.candidate}
          file={claudeFor.file}
          onDone={(c) => setItems((l) => l.map((x) => (x.candidate?.id === c.id ? { ...x, candidate: c } : x)))}
        />
      )}
      <ResumeTextModal open={Boolean(viewing)} onClose={() => setViewing(null)} title={`Extracted text — ${viewing?.name ?? ""}`} text={viewing?.resumeText ?? ""} description="Review the extracted text before screening. You can edit it from the candidate page." />
      <ResumeTextModal
        open={Boolean(pasteFor)}
        onClose={() => setPasteFor(null)}
        title={pasteFor === "new" ? "Add candidate from pasted text" : "Paste resume text"}
        description="Paste the resume's text content. It is stored in this application only."
        text=""
        editable
        askName={pasteFor === "new"}
        onSave={async (text, name) => {
          try {
            if (pasteFor === "new") {
              const c = await api.candidates.createFromText({ name, jobProfileId: jobId || null, resumeText: text });
              setItems((l) => [...l, { key: clientId("up"), file: new File([text], "Pasted text.txt", { type: "text/plain" }), jobId, status: "done", candidate: c }]);
              toast.success("Candidate added", c.name);
            } else if (pasteFor) {
              const c = await api.candidates.update(pasteFor.id, { resumeText: text });
              setItems((l) => l.map((i) => (i.candidate?.id === c.id ? { ...i, candidate: c } : i)));
              toast.success("Resume text saved");
            }
            setPasteFor(null);
          } catch (e) {
            toast.error("Could not save text", errorMessage(e));
          }
        }}
      />
    </>
  );
}
