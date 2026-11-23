import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { INVITATION_LIST_TAG, getInvitation, listInvitations } from './store';
import type { InvitationSummary } from './types';

/**
 * The signed-in dashboard's list, kept in Next's data cache.
 *
 * The page is `force-dynamic` because it depends on who is signed in, so before
 * this every visit re-ran the summary query against Postgres even though the
 * list only changes when somebody saves, replies or checks a guest in. The
 * arguments to the cached function are part of its key, so each owner has their
 * own entry and one person's list can never be served to another.
 *
 * Every write to an invitation clears the tag from lib/store.ts, so the next view
 * after a change re-queries. `revalidate` is only a safety net for writes that
 * bypass the app (db:import, psql).
 */
const CACHE_SECONDS = 300;

export const cachedInvitations = unstable_cache(
  async (ownerId: string): Promise<InvitationSummary[]> => listInvitations(ownerId),
  ['invitation-list'],
  { tags: [INVITATION_LIST_TAG], revalidate: CACHE_SECONDS },
);

/**
 * One document read per request.
 *
 * A guest page needs the same invitation twice — once for its link preview and
 * once to render the card — and before this each half queued its own query.
 * React's cache is scoped to the request, so the two callers share one read and
 * a later visitor is never handed a stale document.
 */
export const invitationForRequest = cache(getInvitation);
