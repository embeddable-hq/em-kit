import type { ChartSpec } from '../../src';
import { BRAND } from '../config';

// The AI code samples shown on the landing page and in the AI chat example.
// Keep them correct against the real API (src/ChartFromSpec.tsx, src/spec.ts)
// and edit them here, not in the pages. The step-by-step samples for wiring a
// model live with their guide, in site/content/guides.ts.

const pkg = BRAND.packageName;

/** The chat example's wiring: a whole message component that renders the spec and sends each click back. */
export const aiChatWiringCode = `import { ChartFromSpec, intentToPrompt } from '${pkg}';
import type { ChartSpec } from '${pkg}';

type Props = {
  message: { text: string; spec?: ChartSpec };
  sendMessage: (text: string) => void;
};

export function AssistantMessage({ message, sendMessage }: Props) {
  return (
    <div className="bubble">
      <p>{message.text}</p>
      {message.spec && (
        <ChartFromSpec
          spec={message.spec}
          chrome="bare"
          height={260}
          onIntent={(intent) => sendMessage(intentToPrompt(intent))}
        />
      )}
    </div>
  );
}`;

/**
 * The landing page's sample: a chart spec exactly as a model returns it from
 * the render_chart tool. The page prints this string and renders the parsed
 * value, so what is shown is what is drawn.
 */
export const aiLandingSpecJson = `{
  "chart": "donut",
  "title": "Revenue by region",
  "dimension": { "name": "region", "title": "Region" },
  "measure": {
    "name": "revenue",
    "title": "Revenue",
    "format": { "prefix": "$" }
  },
  "rows": [
    { "region": "Americas", "revenue": 527972 },
    { "region": "Europe", "revenue": 391500 },
    { "region": "Asia Pacific", "revenue": 284310 },
    { "region": "Africa", "revenue": 94630 }
  ]
}`;

export const aiLandingSpec = JSON.parse(aiLandingSpecJson) as ChartSpec;
