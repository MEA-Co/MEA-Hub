import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';

import './globals.css';

const notoSansKr = Noto_Sans_KR({
  variable: '--font-noto-sans-kr',
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '700', '800', '900'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MEA Hub',
  description: 'MEA Hub',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={notoSansKr.className}>{children}</body>
    </html>
  );
}
