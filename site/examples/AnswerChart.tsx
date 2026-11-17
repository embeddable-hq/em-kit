import { useState } from 'react';
import { ChartFromSpec, intentToPrompt } from '../../src';
import type { ChartSpec } from '../../src';

// What the model's render_chart call contains: plain JSON.
const spec: ChartSpec = {
  chart: 'bar',
  title: 'Signups by channel',
  dimension: { name: 'channel', title: 'Channel' },
  measures: [{ name: 'signups', title: 'Signups' }],
  rows: [
    { channel: 'Organic search', signups: 1840 },
    { channel: 'Paid search', signups: 1210 },
    { channel: 'Referral', signups: 760 },
    { channel: 'Partner', signups: 430 },
  ],
};

export function AnswerChart() {
  const [followUp, setFollowUp] = useState('Click a bar to see the follow-up it produces.');

  return (
    <div>
      <ChartFromSpec
        spec={spec}
        chrome="plain"
        height={300}
        onIntent={(intent) => setFollowUp(intentToPrompt(intent))}
      />
      <p>{followUp}</p>
    </div>
  );
}
