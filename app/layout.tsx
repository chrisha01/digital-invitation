import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gatherly — online invitations, properly dressed',
  applicationName: 'Gatherly',
  description:
    'Design a card, line the envelope, set the type, and collect RSVPs with a guest page of your own.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..700&family=Caveat:wght@400..700&family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700&family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&family=Great+Vibes&family=Inter:wght@300..700&family=Jost:ital,wght@0,300..700;1,300..700&family=Libre+Baskerville:ital@0;1&family=Playfair+Display:ital,wght@0,400..800;1,400..800&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
