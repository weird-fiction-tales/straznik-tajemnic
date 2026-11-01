import { notFound } from 'next/navigation';
import { DesktopWindowFixture } from './view';

export const dynamic = 'force-dynamic';

/** Development-only renders of production components with inert action callbacks. */
export default async function DesktopWindowAuditPage({
  params,
}: {
  params: Promise<{ surface: string }>;
}) {
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.ENABLE_DESKTOP_WINDOW_AUDIT !== '1'
  ) {
    notFound();
  }
  const { surface } = await params;
  return <DesktopWindowFixture surface={surface} />;
}
