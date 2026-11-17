'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignOutButton({ next = '/' }: { next?: string }) {
  const router = useRouter();
  return (
    <button
      className="btn btn-ghost btn-small"
      onClick={async () => {
        await fetch('/api/auth/signout', { method: 'POST' });
        router.replace(next);
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
