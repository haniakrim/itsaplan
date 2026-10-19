import { useTranslations } from 'next-intl';
import type { IntegrationCheckResult } from '@/lib/api/endpoints/god';
import { summarize } from '../../utils/checkStatus';
import CheckResultsTable from '../CheckResultsTable';

export default function GodCheckRunResult({ result }: { result: IntegrationCheckResult }) {
  const t = useTranslations('god.integrationChecks');
  const counts = summarize(result.rows);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium" role="status">
        {result.ok ? t('allPassed') : t('someFailed')}
        {' · '}
        {t('summary', counts)}
      </p>
      <CheckResultsTable rows={result.rows} />
    </div>
  );
}
