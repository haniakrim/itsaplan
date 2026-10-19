'use client';

import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import AppLogo from '@/components/common/AppLogo';
import UserManual from '@/features/user-manual/UserManual';
import ReleaseCheck from '@/features/whats-new/components/ReleaseCheck';
import ReleaseHistory from '@/features/whats-new/components/ReleaseHistory';
import { useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { useAppVersionQuery, useUpdateStatusQuery } from '@/services/updates.service';

// The product mark at the bottom of both sidebars, with the running version under
// it. Collapses to the mark alone when the sidebar is in icon mode. It opens the
// user manual for everyone.
//
// The instance owner also sees whether a newer release is published and reaches the
// release notes from the manual — they are the one who upgrades the instance, so
// the check is theirs alone (GET /god/updates).
export default function SidebarBrandFooter() {
  const t = useTranslations('manual');
  const { data: session } = useSession();
  // The session store can already be filled by the time React hydrates, while the
  // server rendered without it. Reading it only after mount keeps the server and
  // the first client render identical.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isGod = mounted && session?.user.role === 'god';

  const { data: appVersion } = useAppVersionQuery();
  const { data: status } = useUpdateStatusQuery(isGod);
  const [view, setView] = useState<'manual' | 'releases' | null>(null);

  const version = appVersion?.version ?? status?.currentVersion;
  // The version to offer, or null when the running one is the newest known.
  const newerVersion = status?.updateAvailable ? status.latestVersion : null;

  const layout =
    'flex w-full flex-wrap items-center gap-2.5 px-2 pt-2 pb-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0';

  const content = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/10 ring-1 ring-sidebar-primary/25">
        <AppLogo className="size-7 text-sidebar-primary" />
      </span>
      <div className="grid text-start leading-none group-data-[collapsible=icon]:hidden">
        <span className="text-base font-semibold tracking-tight whitespace-nowrap text-sidebar-foreground">
          One Health
        </span>
        {newerVersion ? (
          <span className="mt-1 flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-primary uppercase">
            {/* A pulsing ring around the dot, so the update is noticed in a footer
                nobody looks at. */}
            <span className="relative flex size-1.5" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            {`v${newerVersion} available`}
          </span>
        ) : (
          <span className="mt-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            {version ? `v${version}` : 'Self-hosted'}
          </span>
        )}
      </div>
      {/* Says what the button opens: the manual, for everyone. Its own row, so the
          name beside the mark keeps one line. */}
      <span className="flex basis-full items-center justify-center gap-1.5 rounded-md border border-sidebar-primary/25 bg-sidebar-primary/10 px-1.5 py-1 text-[11px] font-medium text-sidebar-primary group-data-[collapsible=icon]:hidden">
        <BookOpen className="size-3.5" aria-hidden />
        {t('title')}
      </span>
    </>
  );

  return (
    <>
      <button
        type="button"
        aria-label={t('open')}
        className={cn(layout, 'rounded-md hover:bg-sidebar-accent')}
        onClick={() => setView('manual')}
      >
        {content}
      </button>
      {view === 'manual' && (
        <UserManual
          onClose={() => setView(null)}
          aside={status && <ReleaseCheck status={status} />}
          navFooter={
            status && (
              <button
                type="button"
                onClick={() => setView('releases')}
                className="text-muted-foreground hover:text-foreground"
              >
                {t('releaseHistory')}
              </button>
            )
          }
        />
      )}
      {view === 'releases' && status && (
        <ReleaseHistory status={status} onClose={() => setView('manual')} />
      )}
    </>
  );
}
