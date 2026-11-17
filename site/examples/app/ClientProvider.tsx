'use client';

import type { ReactNode } from 'react';
import { ChartsProvider } from '../../../src';

// Render this from app/layout.tsx. Files that render charts start with
// 'use client' too. The fixed locale makes the server format numbers as the
// browser will; use the reader's locale from the request if you have it.
export function ClientProvider({ children }: { children: ReactNode }) {
  return <ChartsProvider theme={{ formatter: { locale: 'en-US' } }}>{children}</ChartsProvider>;
}
