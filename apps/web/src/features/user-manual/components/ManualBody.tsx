'use client';

import { useTranslations } from 'next-intl';
import { MANUAL_STEPS, type ManualSection } from '../content/sections';
import ManualFigure from './ManualFigure';

export default function ManualBody({ section }: { section: ManualSection }) {
  const t = useTranslations('manual');

  return (
    <div className="flex flex-col gap-6">
      <ul className="max-w-[68ch] list-disc space-y-2 ps-5 text-sm leading-relaxed marker:text-muted-foreground">
        {MANUAL_STEPS.map((step) => (
          <li key={step}>{t(`sections.${section.id}.step${step}`)}</li>
        ))}
      </ul>
      {section.images.map((name) => (
        <ManualFigure key={name} name={name} />
      ))}
    </div>
  );
}
