import { DM_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';

const mono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });
const sans = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans', display: 'swap' });

export const metadata = {
  title: { default: 'Relational Quest', template: '%s · Relational Quest' },
  description: 'Aprenda álgebra relacional e normalização de bancos de dados jogando.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f6f1e8',
};

// Applies the saved (or system) theme before the first paint, so there is no flash.
const themeScript = `try{var t=localStorage.getItem('relational-quest-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'#121c1f':'#f6f1e8');}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${mono.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
