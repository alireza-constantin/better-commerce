import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: 'Better Commerce Reference Storefront',
  description: 'Executable reference for Better Commerce storefront integration.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
