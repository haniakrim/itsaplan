'use client';

import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import type { UpdateStatus } from '@/lib/api/endpoints/updates';
import { Button } from '@/components/ui/button';
import { useCheckForUpdates } from '@/services/updates.service';
import { formatDateTime } from '@/utils/dates';
import { cn } from '@/lib/utils';

export default function ReleaseCheck({ status }: { status: UpdateStatus }) {
  const t = useTranslations('updates');
  const check = useCheckForUpdates();

  return (
    <div className="flex items-center justify-between gap-3">
      <Button variant="outline" size="sm" onClick={() => check.mutate()} disabled={check.isPending}>
        <RefreshCw className={cn('size-4', check.isPending && 'animate-spin')} />
        {t(check.isPending ? 'checking' : 'check')}
      </Button>
      {status.checkedAt && (
        <p className="text-end text-xs text-muted-foreground">
          {t('lastChecked')}
          <br />
          {formatDateTime(status.checkedAt)}
        </p>
      )}
    </div>
  );
}
