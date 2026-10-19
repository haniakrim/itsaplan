'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import TakeoverScreen, { type TakeoverSection } from '@/components/common/page/TakeoverScreen';
import ManualBody from './components/ManualBody';
import { MANUAL_SECTIONS } from './content/sections';
import { useActiveSection } from './hooks/useActiveSection';

const SECTION_IDS = MANUAL_SECTIONS.map((section) => section.id);

// The in-app guide for every signed-in user. `aside` and `navFooter` are for what
// only the instance owner has next to it, such as the release history.
export default function UserManual({
  onClose,
  aside,
  navFooter,
}: {
  onClose: () => void;
  aside?: ReactNode;
  navFooter?: ReactNode;
}) {
  const t = useTranslations('manual');
  const tCommon = useTranslations('common');
  const active = useActiveSection(SECTION_IDS);

  const sections: TakeoverSection[] = MANUAL_SECTIONS.map((section) => ({
    id: section.id,
    title: t(`sections.${section.id}.title`),
    description: t(`sections.${section.id}.intro`),
    body: <ManualBody section={section} />,
  }));

  return (
    <TakeoverScreen
      eyebrow={t('eyebrow')}
      title={t('title')}
      sections={sections}
      activeId={active}
      aside={aside}
      navFooter={navFooter}
      actionLabel={tCommon('close')}
      onAction={onClose}
      onEscape={onClose}
    />
  );
}
