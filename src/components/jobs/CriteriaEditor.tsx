import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import type { CriterionCategory, Importance, ScreeningCriterion } from "../../../shared/types";
import { findSensitiveTerms } from "../../../shared/sensitiveTerms";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Form";
import { CATEGORY, IMPORTANCE } from "../../utils/labels";
import { clientId } from "../../utils/id";
import { EmptyState } from "../ui/States";

export function CriteriaEditor({ value, onChange }: { value: ScreeningCriterion[]; onChange: (v: ScreeningCriterion[]) => void }) {
  const update = (id: string, patch: Partial<ScreeningCriterion>) => onChange(value.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id: string) => onChange(value.filter((c) => c.id !== id));
  const add = () =>
    onChange([...value, { id: clientId("crit"), criterion: "", requirement: "", importance: "important", category: "skill" }]);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      {value.length === 0 ? (
        <EmptyState
          title="No screening criteria"
          description="Add criteria manually, or generate them from the qualifications above."
          action={<Button onClick={add} icon={<Plus className="size-4" />}>Add criterion</Button>}
          className="py-8"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base min-w-[860px]">
            <thead>
              <tr>
                <th className="w-8">#</th>
                <th>Criterion</th>
                <th>Requirement</th>
                <th className="w-36">Importance</th>
                <th className="w-40">Category</th>
                <th className="w-24"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {value.map((c, i) => {
                const sensitive = findSensitiveTerms(`${c.criterion} ${c.requirement}`);
                return (
                  <tr key={c.id}>
                    <td className="pt-5 text-xs text-ink-3">{i + 1}</td>
                    <td>
                      <Input
                        value={c.criterion}
                        onChange={(e) => update(c.id, { criterion: e.target.value })}
                        placeholder="e.g. Python"
                        aria-label={`Criterion ${i + 1} name`}
                        aria-invalid={!c.criterion.trim() || undefined}
                      />
                      {sensitive.length > 0 && (
                        <p className="mt-1.5 flex items-start gap-1 text-xs text-[var(--yellow-fg)]" role="alert">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                          May reference a protected characteristic ({sensitive.join(", ")}). Use job-related criteria only.
                        </p>
                      )}
                    </td>
                    <td>
                      <Input value={c.requirement} onChange={(e) => update(c.id, { requirement: e.target.value })} placeholder="e.g. 3+ years" aria-label={`Criterion ${i + 1} requirement`} />
                    </td>
                    <td>
                      <Select value={c.importance} onChange={(e) => update(c.id, { importance: e.target.value as Importance })} aria-label={`Criterion ${i + 1} importance`}>
                        {(Object.keys(IMPORTANCE) as Importance[]).map((k) => <option key={k} value={k}>{IMPORTANCE[k].label}</option>)}
                      </Select>
                    </td>
                    <td>
                      <Select value={c.category} onChange={(e) => update(c.id, { category: e.target.value as CriterionCategory })} aria-label={`Criterion ${i + 1} category`}>
                        {(Object.keys(CATEGORY) as CriterionCategory[]).map((k) => <option key={k} value={k}>{CATEGORY[k]}</option>)}
                      </Select>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</Button>
                        <Button size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Move down">↓</Button>
                        <Button size="sm" variant="danger-ghost" onClick={() => remove(c.id)} icon={<Trash2 className="size-3.5" />} aria-label={`Remove criterion ${i + 1}`} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3">
            <Button size="sm" onClick={add} icon={<Plus className="size-3.5" />}>Add criterion</Button>
          </div>
        </div>
      )}
    </div>
  );
}
