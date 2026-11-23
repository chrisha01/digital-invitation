import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Loading from '@/components/Loading';
import { invitationForRequest } from '@/lib/invitation-cache';
import { shareDescription, shareTitle, siteUrl } from '@/lib/share';
import { GuestCard } from './guest-card';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * What the link says wherever it is pasted. Only what any guest may see is read
 * here — the same projection rules as the page itself: no guest list, no replies.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const invitation = await invitationForRequest(id);
  if (!invitation) return { title: 'Invitation not found' };

  const title = shareTitle(invitation);
  const description = shareDescription(invitation);
  // og:url has to be absolute, so it is only published when the origin is known.
  const base = siteUrl();
  const canonical = base ? new URL(`/i/${id}`, base).toString() : `/i/${id}`;

  return {
    title,
    description,
    alternates: { canonical: `/i/${id}` },
    openGraph: {
      type: 'website',
      siteName: 'Gatherly',
      url: base ? canonical : undefined,
      title,
      description,
    },
    // The generated picture is 1200×630, so ask for the wide card explicitly.
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ g?: string; t?: string }>;
}) {
  const { id } = await params;
  const { g, t } = await searchParams;
  // The card has to exist before anything streams, or a missing link would be
  // answered with a 200 shell instead of a real 404.
  const invitation = await invitationForRequest(id);
  if (!invitation) notFound();

  return (
    <Suspense fallback={<Loading />}>
      <GuestCard invitation={invitation} id={id} g={g} t={t} />
    </Suspense>
  );
}
