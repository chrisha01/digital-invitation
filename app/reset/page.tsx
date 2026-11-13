import Link from 'next/link';
import BrandMark from '@/components/BrandMark';
import ResetForm from '@/components/ResetForm';
import { emailSetup } from '@/lib/email';

export const dynamic = 'force-dynamic';

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  // Whether this server can actually deliver a reset link; says nothing about
  // which addresses have accounts.
  const canEmail = Boolean(emailSetup().provider);

  return (
    <div className="auth-shell">
      <header className="home-nav auth-nav">
        <Link href="/" className="brand">
          <BrandMark />
        </Link>
      </header>
      <main className="auth-main">
        <ResetForm token={token} canEmail={canEmail} />
      </main>
    </div>
  );
}
