import { CircleDashed } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectGroup } from '@/lib/api/endpoints/groups';
import GroupAvatar from './GroupAvatar';
import { Pill } from './Pill';
import PopoverPick from './PopoverPick';

export default function GroupSelect({
  groups,
  value,
  onChange,
  readOnly,
}: {
  groups: ProjectGroup[];
  value: number | null;
  onChange: (id: number | null) => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('issue.fieldSelects');
  const group = groups.find((g) => g.id === value);
  return (
    <PopoverPick
      readOnly={readOnly}
      trigger={
        <Pill active={!!group}>
          {group ? <GroupAvatar group={group} className="size-4" /> : <CircleDashed />}
          <span className="truncate">{group?.name ?? t('assigneeGroup')}</span>
        </Pill>
      }
      inputPlaceholder={t('changeGroup')}
      items={[
        {
          key: 'none',
          search: t('noGroup'),
          icon: <CircleDashed />,
          label: t('noGroup'),
          selected: value == null,
          onSelect: () => onChange(null),
        },
        ...groups.map((g) => ({
          key: String(g.id),
          search: g.name,
          icon: <GroupAvatar group={g} className="size-4" />,
          label: g.name,
          selected: g.id === value,
          onSelect: () => onChange(g.id),
        })),
      ]}
    />
  );
}
