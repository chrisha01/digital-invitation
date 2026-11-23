import { ImageResponse } from 'next/og';
import { formatWhen } from '@/lib/dates';
import { getInvitation } from '@/lib/store';
import { clip, sharePalette, shareTitle } from '@/lib/share';

/**
 * The picture a link preview shows: the invitation's own title and colours, in
 * the same paper-and-ink palette as the card it links to.
 *
 * It is drawn rather than screenshotted. The card is DOM and CSS, so the only
 * ways to photograph it are a headless browser at request time or a stored
 * bitmap that goes stale on every edit. Re-drawing the words on the card's own
 * colours is instant, always current, and never shows a guest's name.
 */
export const alt = 'Invitation';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invitation = await getInvitation(id);

  if (!invitation) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f7f2e7',
            color: '#2b2a26',
            fontSize: 48,
          }}
        >
          Invitation not found
        </div>
      ),
      { ...size },
    );
  }

  const palette = sharePalette(invitation);
  const event = invitation.event;
  const title = shareTitle(invitation);
  const host = (event?.host ?? '').trim();
  const when = event?.startsAt ? formatWhen(event.startsAt) : '';
  const place = (event?.location ?? '').trim();
  const whenAndWhere = [when, clip(place, 60)].filter(Boolean).join('  ·  ');

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: 30,
          background: palette.background,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '56px 80px',
            border: `2px solid ${palette.accent}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              letterSpacing: 9,
              color: palette.ink,
              opacity: 0.66,
            }}
          >
            YOU ARE INVITED
          </div>

          <div
            style={{
              display: 'flex',
              marginTop: 36,
              maxWidth: 900,
              fontSize: title.length > 44 ? 58 : 76,
              lineHeight: 1.15,
              fontWeight: 600,
              textAlign: 'center',
              color: palette.ink,
            }}
          >
            {title}
          </div>

          <div
            style={{
              display: 'flex',
              width: 96,
              height: 2,
              margin: '40px 0 32px',
              background: palette.accent,
            }}
          />

          {host ? (
            <div
              style={{
                display: 'flex',
                fontSize: 30,
                color: palette.ink,
                opacity: 0.78,
              }}
            >
              Hosted by {host}
            </div>
          ) : null}

          {whenAndWhere ? (
            <div
              style={{
                display: 'flex',
                marginTop: host ? 18 : 0,
                fontSize: 26,
                color: palette.ink,
                opacity: 0.62,
              }}
            >
              {whenAndWhere}
            </div>
          ) : null}

          <div
            style={{
              display: 'flex',
              marginTop: 'auto',
              paddingTop: 36,
              fontSize: 20,
              letterSpacing: 4,
              color: palette.ink,
              opacity: 0.5,
            }}
          >
            GATHERLY
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
