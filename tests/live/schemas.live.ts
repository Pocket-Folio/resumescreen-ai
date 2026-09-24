/**
 * Live check that the Claude API accepts every structured-output schema the app sends.
 * Costs a negligible amount (max_tokens: 1). Run after changing a schema or model:
 *   ANTHROPIC_API_KEY=sk-ant-... npm run test:live
 * (Falls back to the key saved in DATA_DIR/secrets.json.)
 */
import Anthropic from "@anthropic-ai/sdk";
import { getApiKey, getWorkspaceId } from "../../server/config";
import { assessmentOutputFormat, profileOutputFormat } from "../../server/services/claude/schemas";
import { MODEL_OPTIONS } from "../../shared/types";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { jobDraftSchema } from "../../server/services/claude/draftJobProfile";

const key = getApiKey().key;
if (!key) {
  console.error("No API key configured.");
  process.exit(1);
}
const ws = getWorkspaceId().id;
const client = new Anthropic({ apiKey: key, maxRetries: 1, ...(ws ? { defaultHeaders: { "anthropic-workspace-id": ws } } : {}) });
const formats = {
  profile: profileOutputFormat,
  assessment: assessmentOutputFormat,
  jobDraft: { type: "json_schema" as const, schema: zodOutputFormat(jobDraftSchema).schema },
};
let failed = 0;
for (const m of MODEL_OPTIONS) {
  for (const [name, format] of Object.entries(formats)) {
    try {
      await client.messages.create({ model: m.id, max_tokens: 1, output_config: { format }, messages: [{ role: "user", content: "hi" }] });
      console.log(`ok    ${m.id.padEnd(18)} ${name}`);
    } catch (e) {
      failed++;
      console.log(`FAIL  ${m.id.padEnd(18)} ${name}: ${(e as Error).message.slice(0, 160)}`);
    }
  }
}
process.exit(failed ? 1 : 0);
