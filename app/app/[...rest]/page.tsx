import { notFound } from 'next/navigation';

// Unmatched routes would fall through to the root 404, outside the app frame.
// Naming the segment here makes notFound() resolve to the app's own boundary.
export default function AppUnknownRoute() {
  notFound();
}
