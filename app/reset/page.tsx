import Link from 'next/link';
import BrandMark from '@/components/BrandMark';
import ResetForm from '@/components/ResetForm';

export const dynamic = 'force-dynamic';

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="auth-shell">
      <header className="home-nav auth-nav">
        <Link href="/" className="brand">
          <BrandMark />
        </Link>
      </header>
      <main className="auth-main">
        <ResetForm token={token} />
      </main>
    </div>
  );
}
