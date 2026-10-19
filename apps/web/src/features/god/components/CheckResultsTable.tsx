import { useTranslations } from 'next-intl';
import type { CheckRow } from '@/lib/api/endpoints/god';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import CheckStatusLabel from './CheckStatusLabel';

export default function CheckResultsTable({ rows }: { rows: CheckRow[] }) {
  const t = useTranslations('god.integrationChecks');

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">{t('noRows')}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('step')}</TableHead>
          <TableHead>{t('result')}</TableHead>
          <TableHead>{t('details')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={`${row.name}-${index}`}>
            <TableCell className="font-mono text-xs">{row.name}</TableCell>
            <TableCell>
              <CheckStatusLabel status={row.status} />
            </TableCell>
            <TableCell className="text-xs break-words whitespace-normal text-muted-foreground">
              {row.detail}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
