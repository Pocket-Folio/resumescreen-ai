import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, ListPlus, Save } from "lucide-react";
import { api, errorMessage } from "../api/client";
import { useToast } from "../context/ToastContext";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Field, Input, Select, Textarea } from "../components/ui/Form";
import { ErrorState, PageSkeleton } from "../components/ui/States";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { CriteriaEditor } from "../components/jobs/CriteriaEditor";
import { DraftCriteriaButton, UploadJobDescriptionButton } from "../components/jobs/JobDescriptionTools";
import type { JobDraft } from "../api/client";
import { DemoBadge } from "../components/StatusBadges";
import { EMPLOYMENT_TYPE } from "../utils/labels";
import { clientId } from "../utils/id";
import { findSensitiveTerms } from "../../shared/sensitiveTerms";
import type { CriterionCategory, EmploymentType, Importance, JobProfile, JobProfileInput, ScreeningCriterion } from "../../shared/types";

const EMPTY: JobProfileInput = {
  title: "",
  department: "",
  location: "",
  employmentType: "full_time",
  description: "",
  required: { education: "", certifications: "", skills: "", technicalSkills: "", yearsExperience: "", industryExperience: "", languages: "" },
  preferred: { education: "", skills: "", certifications: "", experience: "", industryExperience: "" },
  criteria: [],
  screeningInstructions: "",
  status: "active",
};

const toInput = (p: JobProfile): JobProfileInput => ({
  title: p.title,
  department: p.department,
  location: p.location,
  employmentType: p.employmentType,
  description: p.description,
  required: p.required,
  preferred: p.preferred,
  criteria: p.criteria,
  screeningInstructions: p.screeningInstructions,
  status: p.status,
});

const splitList = (s: string) => s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

/** Deterministically turns qualification fields into criteria rows (no AI involved). */
function criteriaFromQualifications(f: JobProfileInput): ScreeningCriterion[] {
  const out: ScreeningCriterion[] = [];
  const mk = (criterion: string, requirement: string, importance: Importance, category: CriterionCategory) =>
    out.push({ id: clientId("crit"), criterion, requirement, importance, category });
  const r = f.required;
  const p = f.preferred;
  splitList(r.technicalSkills).forEach((s) => mk(s, "Required technical skill", "required", "technical_skill"));
  splitList(r.skills).forEach((s) => mk(s, "Required skill", "required", "skill"));
  if (r.yearsExperience.trim()) mk("Years of experience", r.yearsExperience.trim(), "required", "experience");
  if (r.education.trim()) mk("Education", r.education.trim(), "required", "education");
  splitList(r.certifications).forEach((s) => mk(s, "Required certification", "required", "certification"));
  if (r.industryExperience.trim()) mk("Industry experience", r.industryExperience.trim(), "required", "industry");
  if (r.languages.trim()) mk("Languages", r.languages.trim(), "required", "language");
  splitList(p.skills).forEach((s) => mk(s, "Preferred skill", "preferred", "skill"));
  if (p.experience.trim()) mk("Preferred experience", p.experience.trim(), "preferred", "experience");
  if (p.education.trim()) mk("Preferred education", p.education.trim(), "preferred", "education");
  splitList(p.certifications).forEach((s) => mk(s, "Preferred certification", "preferred", "certification"));
  if (p.industryExperience.trim()) mk("Preferred industry experience", p.industryExperience.trim(), "preferred", "industry");
  return out;
}

export function JobProfileEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState<JobProfileInput>(EMPTY);
  const [original, setOriginal] = useState<JobProfile | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmSensitive, setConfirmSensitive] = useState<string[] | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.jobProfiles
      .get(id)
      .then((p) => {
        setOriginal(p);
        setForm(toInput(p));
      })
      .catch((e) => setLoadError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [id]);

  const set = <K extends keyof JobProfileInput>(k: K, v: JobProfileInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setReq = (k: keyof JobProfileInput["required"], v: string) => setForm((f) => ({ ...f, required: { ...f.required, [k]: v } }));
  const setPref = (k: keyof JobProfileInput["preferred"], v: string) => setForm((f) => ({ ...f, preferred: { ...f.preferred, [k]: v } }));

  const generate = () => {
    const existing = new Set(form.criteria.map((c) => c.criterion.trim().toLowerCase()));
    const fresh = criteriaFromQualifications(form).filter((c) => !existing.has(c.criterion.toLowerCase()));
    if (fresh.length === 0) {
      toast.info("No new criteria to add", "Fill in the qualification fields first, or all of them are already criteria.");
      return;
    }
    set("criteria", [...form.criteria, ...fresh]);
    toast.success(`${fresh.length} criteria added`, "Review importance and wording before saving.");
  };

  const applyDraft = (d: JobDraft, picked: JobDraft["criteria"]) => {
    setForm((f) => {
      // Only fill qualification fields that are still empty.
      const fill = <T extends object>(cur: T, sug: T): T =>
        Object.fromEntries(
          Object.entries(cur).map(([k, v]) => [k, String(v).trim() ? v : ((sug as Record<string, string>)[k] ?? "")]),
        ) as T;
      const existing = new Set(f.criteria.map((c) => c.criterion.trim().toLowerCase()));
      const fresh = picked.filter((c) => !existing.has(c.criterion.trim().toLowerCase())).map((c) => ({ ...c, id: clientId("crit") }));
      return {
        ...f,
        department: f.department || d.department || "",
        location: f.location || d.location || "",
        employmentType: d.employmentType && !original ? d.employmentType : f.employmentType,
        required: fill(f.required, d.required),
        preferred: fill(f.preferred, d.preferred),
        criteria: [...f.criteria, ...fresh],
      };
    });
    toast.success(`${picked.length} criteria added`, "AI-suggested — review wording and importance, then save.");
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Job title is required.";
    if (form.criteria.length === 0) e.criteria = "Add at least one screening criterion.";
    if (form.criteria.some((c) => !c.criterion.trim())) e.criteria = "Every criterion needs a name.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async (skipSensitiveCheck = false) => {
    if (!validate()) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    const sensitive = [...new Set(form.criteria.flatMap((c) => findSensitiveTerms(`${c.criterion} ${c.requirement}`)))];
    if (sensitive.length && !skipSensitiveCheck) {
      setConfirmSensitive(sensitive);
      return;
    }
    setSaving(true);
    try {
      const saved = isNew ? await api.jobProfiles.create(form) : await api.jobProfiles.update(id!, form);
      toast.success(isNew ? "Job profile created" : "Job profile saved");
      if (isNew) navigate(`/job-profiles/${saved.id}`, { replace: true });
      else {
        setOriginal(saved);
        setForm(toInput(saved));
      }
    } catch (e) {
      toast.error("Could not save job profile", errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void save();
  };

  if (loading) return <PageSkeleton />;
  if (loadError) return <ErrorState title="Job profile could not be loaded" message={loadError} />;

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        eyebrow={
          <Link to="/job-profiles" className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
            <ArrowLeft className="size-3.5" /> Job profiles
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            {isNew ? "New job profile" : form.title || "Untitled profile"}
            {original?.isDemo && <DemoBadge />}
          </span>
        }
        description="Define what the position requires. Screening compares each resume against the criteria below."
        actions={
          <>
            {!isNew && <Link to={`/screening?job=${id}`}><Button>Screen candidates</Button></Link>}
            <Button type="submit" variant="primary" loading={saving} icon={<Save className="size-4" />}>Save profile</Button>
          </>
        }
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Basic information" />
          <CardBody className="grid gap-4 md:grid-cols-2">
            <Field label="Job title" required htmlFor="title" error={errors.title}>
              <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Senior Backend Engineer" />
            </Field>
            <Field label="Department" htmlFor="dept">
              <Input id="dept" value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. Engineering" />
            </Field>
            <Field label="Location" htmlFor="loc">
              <Input id="loc" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Remote (US)" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Employment type" htmlFor="emp">
                <Select id="emp" value={form.employmentType} onChange={(e) => set("employmentType", e.target.value as EmploymentType)}>
                  {(Object.keys(EMPLOYMENT_TYPE) as EmploymentType[]).map((k) => <option key={k} value={k}>{EMPLOYMENT_TYPE[k]}</option>)}
                </Select>
              </Field>
              <Field label="Status" htmlFor="status">
                <Select id="status" value={form.status} onChange={(e) => set("status", e.target.value as "active" | "archived")}>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </Select>
              </Field>
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <label htmlFor="desc" className="block text-sm font-medium text-ink">Job description</label>
                  <p className="text-xs text-ink-3">Sent to Claude with every screening. Upload a JD file or paste it here.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <UploadJobDescriptionButton
                    onText={(text) => {
                      set("description", text);
                      if (!form.title.trim()) {
                        const first = text.split("\n").map((l) => l.trim()).find((l) => l.length > 3 && l.length < 80);
                        if (first) set("title", first);
                      }
                    }}
                  />
                  <DraftCriteriaButton title={form.title} description={form.description} onApply={applyDraft} />
                </div>
              </div>
              <Textarea id="desc" rows={8} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Responsibilities, requirements, team context and what success looks like." />
            </div>
          </CardBody>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Required qualifications" description="Separate multiple items with commas." />
            <CardBody className="grid gap-4">
              <Field label="Required education" htmlFor="r-edu"><Input id="r-edu" value={form.required.education} onChange={(e) => setReq("education", e.target.value)} placeholder="e.g. Bachelor's degree in Finance" /></Field>
              <Field label="Required certifications" htmlFor="r-cert"><Input id="r-cert" value={form.required.certifications} onChange={(e) => setReq("certifications", e.target.value)} placeholder="e.g. CPA" /></Field>
              <Field label="Required skills" htmlFor="r-skills"><Input id="r-skills" value={form.required.skills} onChange={(e) => setReq("skills", e.target.value)} placeholder="e.g. Stakeholder management, reporting" /></Field>
              <Field label="Required technical skills" htmlFor="r-tech"><Input id="r-tech" value={form.required.technicalSkills} onChange={(e) => setReq("technicalSkills", e.target.value)} placeholder="e.g. Python, SQL" /></Field>
              <Field label="Required years of experience" htmlFor="r-years"><Input id="r-years" value={form.required.yearsExperience} onChange={(e) => setReq("yearsExperience", e.target.value)} placeholder="e.g. 5+ years in software engineering" /></Field>
              <Field label="Required industry experience" htmlFor="r-ind"><Input id="r-ind" value={form.required.industryExperience} onChange={(e) => setReq("industryExperience", e.target.value)} placeholder="e.g. Healthcare" /></Field>
              <Field label="Required languages" htmlFor="r-lang" hint="Describe the proficiency needed for the job (e.g. “Professional working proficiency in Spanish”), not a native language."><Input id="r-lang" value={form.required.languages} onChange={(e) => setReq("languages", e.target.value)} /></Field>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Preferred qualifications" description="Nice-to-have qualifications." />
            <CardBody className="grid gap-4">
              <Field label="Preferred education" htmlFor="p-edu"><Input id="p-edu" value={form.preferred.education} onChange={(e) => setPref("education", e.target.value)} /></Field>
              <Field label="Preferred skills" htmlFor="p-skills"><Input id="p-skills" value={form.preferred.skills} onChange={(e) => setPref("skills", e.target.value)} /></Field>
              <Field label="Preferred certifications" htmlFor="p-cert"><Input id="p-cert" value={form.preferred.certifications} onChange={(e) => setPref("certifications", e.target.value)} /></Field>
              <Field label="Preferred experience" htmlFor="p-exp"><Input id="p-exp" value={form.preferred.experience} onChange={(e) => setPref("experience", e.target.value)} /></Field>
              <Field label="Preferred industry experience" htmlFor="p-ind"><Input id="p-ind" value={form.preferred.industryExperience} onChange={(e) => setPref("industryExperience", e.target.value)} /></Field>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Screening criteria"
            description="Each criterion is assessed individually with evidence from the resume. Required criteria carry the most weight in the overall alignment label."
            actions={<Button size="sm" onClick={generate} icon={<ListPlus className="size-4" />}>Generate from qualifications</Button>}
          />
          {errors.criteria && <p className="px-5 pt-3 text-sm text-danger" role="alert">{errors.criteria}</p>}
          <CriteriaEditor value={form.criteria} onChange={(v) => set("criteria", v)} />
        </Card>

        <Card>
          <CardHeader title="Screening instructions" description="Optional job-specific guidance for the screening model (e.g. how to treat equivalent experience). Fairness and privacy rules always apply." />
          <CardBody>
            <Textarea rows={3} value={form.screeningInstructions} onChange={(e) => set("screeningInstructions", e.target.value)} aria-label="Screening instructions" placeholder="e.g. Treat 3+ years of relevant practical experience as equivalent to a degree." />
          </CardBody>
        </Card>

        <div className="flex justify-end gap-2">
          <Link to="/job-profiles"><Button>Cancel</Button></Link>
          <Button type="submit" variant="primary" loading={saving} icon={<Save className="size-4" />}>Save profile</Button>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmSensitive)}
        title="Review criteria wording"
        confirmLabel="Save anyway"
        message={
          <>
            Some criteria may reference protected characteristics (<strong>{confirmSensitive?.join(", ")}</strong>). Screening must use job-related criteria
            only; the screening model will not assess criteria that depend on protected characteristics. Please rephrase them in job-related terms
            if possible.
          </>
        }
        onClose={() => setConfirmSensitive(null)}
        onConfirm={async () => {
          setConfirmSensitive(null);
          await save(true);
        }}
      />
    </form>
  );
}
