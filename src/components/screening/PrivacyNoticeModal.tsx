import { ShieldCheck } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

export function PrivacyNoticeModal({ open, onAccept, onClose, redactName, redactContact }: { open: boolean; onAccept: () => void; onClose: () => void; redactName: boolean; redactContact: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Before you screen candidates"
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onAccept} icon={<ShieldCheck className="size-4" />}>I understand — continue</Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-ink-2">
        <p>Resumes contain personal information. Please confirm you understand how screening handles candidate data:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink">Data leaves this application only when you run a screening.</strong> The resume text and the job profile's criteria are sent to the Claude API
            (Anthropic) to generate the assessment. Candidate data is otherwise stored only in this application's database.
          </li>
          <li>
            <strong className="text-ink">Redaction:</strong> the candidate's name {redactName ? "is removed" : <em>is not removed</em>} and contact details (email, phone, links){" "}
            {redactContact ? "are removed" : <em>are not removed</em>} before sending. You can change this in Settings.
          </li>
          <li>
            <strong className="text-ink">AI assists — people decide.</strong> Claude compares the resume with your criteria and cites evidence. It can make mistakes. Review the evidence,
            verify flagged items, and make any decision yourself.
          </li>
          <li>
            <strong className="text-ink">Job-related criteria only.</strong> Screening never uses or infers protected characteristics such as age, race, religion, disability, gender or family status.
          </li>
          <li>Make sure screening candidates this way is consistent with your organisation's privacy notice and any local rules on automated processing.</li>
        </ul>
      </div>
    </Modal>
  );
}
