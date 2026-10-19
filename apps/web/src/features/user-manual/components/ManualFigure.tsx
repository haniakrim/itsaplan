'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { MANUAL_IMAGE_SIZE, type ManualImage } from '../content/sections';

export default function ManualFigure({ name }: { name: ManualImage }) {
  const t = useTranslations('manual');

  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-muted/30">
      <Image
        src={`/manual/${name}.jpg`}
        alt={t(`images.${name}`)}
        width={MANUAL_IMAGE_SIZE.width}
        height={MANUAL_IMAGE_SIZE.height}
        sizes="(min-width: 1280px) 56rem, (min-width: 1024px) 60vw, 100vw"
        loading="lazy"
        className="h-auto w-full"
      />
    </figure>
  );
}
