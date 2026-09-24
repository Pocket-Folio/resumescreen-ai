import { ExternalLink, Mail, MapPin, Phone, UserRound } from "lucide-react";
import type { Candidate, ScreeningRecord } from "../../../shared/types";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { AIBadge } from "../StatusBadges";

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-ink-3 [&_svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-ink-3">{label}</div>
        <div className="text-sm break-words text-ink">{value || <span className="text-ink-3">Not found in resume</span>}</div>
      </div>
    </div>
  );
}

const href = (u: string) => (/^https?:\/\//.test(u) ? u : `https://${u}`);

export function CandidateInfoCard({ candidate, latest }: { candidate: Candidate; latest: ScreeningRecord | null }) {
  return (
    <Card>
      <CardHeader title="Candidate information" description="Extracted locally from the resume text. Edit if anything is wrong." />
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <Row icon={<UserRound />} label="Name" value={candidate.name} />
        <Row icon={<Mail />} label="Email" value={candidate.email && <a className="text-brand-ink hover:underline" href={`mailto:${candidate.email}`}>{candidate.email}</a>} />
        <Row icon={<Phone />} label="Phone" value={candidate.phone} />
        <Row icon={<MapPin />} label="Location" value={candidate.location} />
        <Row
          icon={<ExternalLink />}
          label="LinkedIn / portfolio"
          value={
            candidate.links.length > 0 && (
              <ul className="space-y-0.5">
                {candidate.links.map((l) => (
                  <li key={l}><a href={href(l)} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-ink hover:underline">{l}</a></li>
                ))}
              </ul>
            )
          }
        />
        <Row icon={<UserRound />} label="Current / most recent role" value={latest?.result.candidateProfile.currentRole} />
      </CardBody>
    </Card>
  );
}

export function ResumeProfileSections({ record }: { record: ScreeningRecord }) {
  const p = record.result.candidateProfile;
  const skillGroups: [string, string[]][] = [
    ["Technical skills", p.skills.technical],
    ["Soft skills", p.skills.soft],
    ["Tools & platforms", p.skills.tools],
    ["Languages", p.skills.languages],
    ["Certifications", p.skills.certifications],
  ];
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Resume summary" actions={<AIBadge label="AI-generated" />} />
        <CardBody><p className="text-sm leading-relaxed text-ink-2">{record.result.candidateSummary}</p></CardBody>
      </Card>
      <Card>
        <CardHeader title="Professional experience" description="As stated in the resume." actions={<AIBadge label="AI-extracted" />} />
        <CardBody>
          {p.experience.length === 0 ? (
            <p className="text-sm text-ink-3">No experience entries were identified.</p>
          ) : (
            <ol className="relative space-y-5 border-l border-line pl-5">
              {p.experience.map((x, i) => (
                <li key={i} className="relative">
                  <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-surface bg-brand" aria-hidden />
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="font-medium">{x.position} <span className="font-normal text-ink-3">· {x.company}</span></div>
                    <div className="text-xs text-ink-3">
                      {x.startDate ?? "?"} – {x.endDate ?? "?"}
                      {x.duration && <span> · {x.duration}</span>}
                    </div>
                  </div>
                  {x.responsibilities.length > 0 && (
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-ink-2">
                      {x.responsibilities.map((r, j) => <li key={j}>{r}</li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Education" actions={<AIBadge label="AI-extracted" />} />
          <CardBody>
            {p.education.length === 0 ? (
              <p className="text-sm text-ink-3">No education entries were identified.</p>
            ) : (
              <ul className="space-y-3">
                {p.education.map((e, i) => (
                  <li key={i}>
                    <div className="font-medium">{e.institution}</div>
                    <div className="text-sm text-ink-2">{[e.degree, e.field].filter(Boolean).join(", ") || "Degree not stated"}</div>
                    <div className="text-xs text-ink-3">{e.dates ?? "Dates not stated"}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Skills" actions={<AIBadge label="AI-extracted" />} />
          <CardBody className="space-y-3">
            {skillGroups.map(([label, items]) => (
              <div key={label}>
                <div className="mb-1 text-xs font-medium text-ink-3">{label}</div>
                {items.length ? (
                  <div className="flex flex-wrap gap-1.5">{items.map((s) => <Badge key={s} tone="gray">{s}</Badge>)}</div>
                ) : (
                  <p className="text-sm text-ink-3">None listed</p>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
