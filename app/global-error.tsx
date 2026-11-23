'use client';

// The last resort: this boundary replaces the root layout, so it has to supply
// its own <html> and <body>, and the stylesheet the layout normally imports.
import './globals.css';
import SiteShell from '@/components/SiteShell';

export default function GlobalError() {
  return (
    <html lang="en">
      <head>
        {/* The layout normally provides both of these, and it is not here. */}
        <title>Gatherly — something went wrong</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <SiteShell>
          <section className="lost">
            <p className="hero-eyebrow">Something went wrong</p>
            <h1>We couldn’t get the page together.</h1>
            <p className="hero-sub">
              The whole app failed to load, which is never what we want on the day of the party.
              It’s usually temporary — try again in a moment.
            </p>
            <div className="hero-actions">
              {/* A reload asks the server for the page again; resetting here
                  would only re-render the data that already failed. */}
              <button
                type="button"
                className="btn btn-primary btn-large"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
              {/* A full page load, not a router push: the app has already failed
                  once, so ask the server for a fresh document. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a className="btn btn-ghost btn-large" href="/">
                Back to the front page
              </a>
            </div>
          </section>
        </SiteShell>
      </body>
    </html>
  );
}
