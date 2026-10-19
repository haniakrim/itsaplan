import { CircleCheck, CircleMinus, CircleX, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CheckStatus } from '@/lib/api/endpoints/god';

const ICONS = {
  PASS: CircleCheck,
  FAIL: CircleX,
  'MISSING-PERMISSION': ShieldAlert,
  SKIPPED: CircleMinus,
} satisfies Record<CheckStatus, typeof CircleCheck>;

export default function CheckStatusLabel({ status }: { status: CheckStatus }) {
  const t = useTranslations('god.integrationChecks.status');
  const Icon = ICONS[status];
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      <Icon className="size-4 shrink-0" />
      {t(status)}
    </span>
  );
}
