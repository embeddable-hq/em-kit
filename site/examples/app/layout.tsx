import type { ReactNode } from 'react';
import { ClientProvider } from './ClientProvider';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientProvider>{children}</ClientProvider>
      </body>
    </html>
  );
}
