import { useTranslations } from 'next-intl';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsSection from '@/components/common/page/SettingsSection';

export default function GodMicrosoft365Reuse() {
  const t = useTranslations('god.microsoft365');
  const uses = ['reuseEmail', 'reuseStorage', 'reuseAgents'] as const;

  return (
    <SettingsSection title={t('reuse')} description={t('reuseHint')}>
      <SettingsCard className="p-4">
        <ul className="list-disc space-y-1 ps-5 text-sm">
          {uses.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </SettingsCard>
    </SettingsSection>
  );
}
