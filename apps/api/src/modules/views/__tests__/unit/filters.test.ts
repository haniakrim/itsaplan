import { describe, it, expect } from 'bun:test';
import type { IssueRow } from '#modules/issues/service';
import type { ColumnRow } from '#modules/columns/service';
import { applyFilters, type FilterViewer } from '../../filters';

// The view filter engine resolves the values that stand for "me" against the viewer, so
// one saved view lists different issues for different people.

function row(id: number, assigneeUserId: string | null, assigneeGroupId: number | null): IssueRow {
  return { id, assigneeUserId, assigneeGroupId } as IssueRow;
}

const issues = [
  row(1, 'ann', null),
  row(2, 'bob', 10),
  row(3, null, 10),
  row(4, null, 20),
  row(5, null, null),
];
const columns: ColumnRow[] = [];
const ann: FilterViewer = { userId: 'ann', groupIds: [10] };
const cat: FilterViewer = { userId: 'cat', groupIds: [20] };
const stranger: FilterViewer = { userId: 'zed', groupIds: [] };

function ids(field: string, op: string, values: (string | number | null)[], viewer?: FilterViewer) {
  return applyFilters(issues, { conditions: [{ field, op, values }] }, columns, viewer).map(
    (i) => i.id,
  );
}

describe('view filters for the viewer', () => {
  it('assignee "me" matches the issues assigned to the viewer', () => {
    expect(ids('assignee', 'is', ['me'], ann)).toEqual([1]);
    expect(ids('assignee', 'is', ['me'], cat)).toEqual([]);
  });

  it('assignee "me" combines with named people', () => {
    expect(ids('assignee', 'is', ['me', 'bob'], ann)).toEqual([1, 2]);
  });

  it('assignee is_not "me" excludes the viewer issues', () => {
    expect(ids('assignee', 'is_not', ['me'], ann)).toEqual([2, 3, 4, 5]);
  });

  it('assigneeGroup "mine" matches the groups the viewer belongs to', () => {
    expect(ids('assigneeGroup', 'is', ['mine'], ann)).toEqual([2, 3]);
    expect(ids('assigneeGroup', 'is', ['mine'], cat)).toEqual([4]);
    expect(ids('assigneeGroup', 'is', ['mine'], stranger)).toEqual([]);
  });

  it('assignedTo meOrMyGroups matches the viewer or one of their groups, per viewer', () => {
    expect(ids('assignedTo', 'is', ['meOrMyGroups'], ann)).toEqual([1, 2, 3]);
    expect(ids('assignedTo', 'is', ['meOrMyGroups'], cat)).toEqual([4]);
    expect(ids('assignedTo', 'is', ['meOrMyGroups'], stranger)).toEqual([]);
  });

  it('assignedTo me leaves group-assigned issues out', () => {
    expect(ids('assignedTo', 'is', ['me'], ann)).toEqual([1]);
  });

  it('matches nothing without a viewer, such as on a public share', () => {
    expect(ids('assignee', 'is', ['me'])).toEqual([]);
    expect(ids('assigneeGroup', 'is', ['mine'])).toEqual([]);
    expect(ids('assignedTo', 'is', ['meOrMyGroups'])).toEqual([]);
  });

  it('keeps matching assignee ids and group ids as before', () => {
    expect(ids('assignee', 'is', ['bob'], ann)).toEqual([2]);
    expect(ids('assigneeGroup', 'is', [20], ann)).toEqual([4]);
  });
});
