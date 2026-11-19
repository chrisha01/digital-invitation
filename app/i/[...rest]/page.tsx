import { notFound } from 'next/navigation';

// A shared link with extra path left on the end matched nothing, so it fell
// through to the marketing 404. Matching the segment here makes notFound()
// resolve to the guest's own "invitation isn't available" page.
export default function GuestUnknownRoute() {
  notFound();
}
