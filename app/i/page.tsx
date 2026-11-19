import { notFound } from 'next/navigation';

// A bare /i is a shared link that lost its invitation id, so there is nothing
// to show. notFound() resolves to the guest boundary above this segment.
export default function GuestMissingId() {
  notFound();
}
