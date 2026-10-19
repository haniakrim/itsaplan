import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Button } from '@/components/ui/button';
import type { GodFileStorageForm } from '../../hooks/useGodFileStorageForm';
import CheckResultsTable from '../CheckResultsTable';

export default function GodFileStorageTest({ form }: { form: GodFileStorageForm }) {
  const t = useTranslations('god.fileStorage');

  async function run() {
    try {
      const result = await form.test();
      if (result.ok) toast.success(t('testPassed'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <SettingsSection title={t('testTitle')} description={t('testHint')}>
      <SettingsCard className="space-y-4 p-4">
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void run()}
            disabled={form.testing || form.saving}
          >
            {form.testing ? t('testing') : t('test')}
          </Button>
        </div>
        {form.testResult ? <CheckResultsTable rows={form.testResult.steps} /> : null}
      </SettingsCard>
    </SettingsSection>
  );
}
