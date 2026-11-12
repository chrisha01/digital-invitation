import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import BrandMark from '@/components/BrandMark';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await currentUser();
  if (user) redirect('/');

  const { next } = await searchParams;
  // Only same-site paths, so a link cannot bounce someone to another host.
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  return (
    <div className="auth-shell">
      <header className="home-nav auth-nav">
        <Link href="/" className="brand">
          <BrandMark />
        </Link>
      </header>
      <main className="auth-main">
        <AuthForm next={target} />
      </main>
    </div>
  );
}
