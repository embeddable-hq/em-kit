import type { ReactNode } from 'react';
import { ChartsProvider } from '../../src';

const theme = {
  fonts: {
    google: [], // no request to Google Fonts
    custom: [
      {
        family: 'Inter',
        src: '/fonts/inter-variable.woff2',
        descriptors: { weight: '100 900' },
      },
    ],
  },
};

export function SelfHostedFont({ children }: { children: ReactNode }) {
  return <ChartsProvider theme={theme}>{children}</ChartsProvider>;
}
