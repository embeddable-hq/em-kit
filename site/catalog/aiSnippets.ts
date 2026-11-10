import { BRAND } from '../config';

// The one source of truth for the AI code samples shown on the landing page,
// the docs and the AI chat example. Keep these correct against
// the real API (src/ai/index.ts, src/ChartFromSpec.tsx) and edit them here, not
// in the pages.

const pkg = BRAND.packageName;

/** Step 1: hand the model the tool and the guidance (Anthropic Messages API). */
export const aiToolSetupCode = `import Anthropic from '@anthropic-ai/sdk';
import { renderChartTool, chartGuidance } from '${pkg}/ai';

const response = await new Anthropic().messages.create({
  model,                    // any tool-calling Claude model
  max_tokens: 4096,
  system: chartGuidance,    // which chart to pick, how to shape rows (or append to your prompt)
  tools: [renderChartTool], // the JSON Schema of every chart spec
  messages,
});`;

/** Step 2: pull the spec out of the tool call. */
export const aiParseCode = `import type { ChartSpec } from '${pkg}';

// the render_chart call; its input is already-parsed JSON
const call = response.content.find((block) => block.type === 'tool_use');
const spec = call?.input as ChartSpec;`;

/** Step 3: render the spec and listen for clicks. */
export const aiRenderCode = `import { ChartFromSpec, intentToPrompt } from '${pkg}';
import type { ChartSpec } from '${pkg}';

// spec: the input of the model's render_chart tool call
export function AssistantChart({ spec }: { spec: ChartSpec }) {
  return (
    <ChartFromSpec
      spec={spec}
      chrome="bare"   // 'card' | 'plain' | 'bare': bare fits a chat bubble
      height={260}
      onIntent={(intent) => sendMessage(intentToPrompt(intent))}
    />
  );
}`;

/** The short landing-page sample: the JSON the model returns, and the component that renders it. */
export const aiLandingCode = `// The model's render_chart tool call returns JSON…
{
  "chart": "donut",
  "title": "Revenue by region",
  "dimension": "region",
  "measure": { "name": "revenue", "format": { "prefix": "$" } },
  "rows": [{ "region": "Europe", "revenue": 391500 }, …]
}

// …and one component renders it, clicks included
<ChartFromSpec
  spec={toolInput}
  chrome="bare"
  onIntent={(intent) => sendMessage(intentToPrompt(intent))}
/>`;

/** The chat-demo wiring: the same render-and-listen call inline in a message bubble. */
export const aiChatWiringCode = `import { ChartFromSpec, intentToPrompt } from '${pkg}';

<ChartFromSpec
  spec={message.spec}
  chrome="bare"
  height={260}
  onIntent={(intent) => sendMessage(intentToPrompt(intent))}
/>`;
