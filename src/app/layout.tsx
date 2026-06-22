import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Jost, Playfair_Display } from 'next/font/google';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-jost',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Logia Teófilo Leal N° 115 — Recorrido Institucional',
  description:
    'Respetable Logia Simbólica Teófilo Leal N° 115, Oriente de Barquisimeto. Sabiduría, Fuerza y Belleza.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${cormorant.variable} ${jost.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  );
}
