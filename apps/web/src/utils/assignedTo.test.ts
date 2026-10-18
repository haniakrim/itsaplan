import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Issue } from '@/lib/api/endpoints/issues';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { applyFilters, filterViewer, type FilterSet } from './filters';
import { defaultsFromFilters } from './project';
import { describeEffect, effectFieldKeys } from './actions';
import type { EffectText } from '@/hooks/useEffectText';

const project = (userId: string) =>
  ({
    columns: [],
    viewer: { userId },
    groups: [
      { id: 1, projectId: 1, name: 'Pharmacy', color: '#112233', position: 1, memberIds: ['ann'] },
      { id: 2, projectId: 1, name: 'Nursing', color: '#445566', position: 2, memberIds: ['cat'] },
    ],
  }) as unknown as ProjectDetail;

const issue = (id: number, assigneeUserId: string | null, assigneeGroupId: number | null) =>
  ({ id, assigneeUserId, assigneeGroupId, columnId: 1 }) as unknown as Issue;

const issues = [
  issue(1, 'ann', null),
  issue(2, 'bob', 1),
  issue(3, null, 1),
  issue(4, null, 2),
  issue(5, null, null),
];

const where = (field: string, ...values: (string | number | null)[]): FilterSet => ({
  conditions: [{ id: 'c', field, op: 'is', values }],
});

const ids = (userId: string, filters: FilterSet) =>
  applyFilters(issues, filters, project(userId)).map((i) => i.id);

describe('filters for the viewer', () => {
  it('collects the groups the viewer belongs to', () => {
    assert.deepEqual(filterViewer(project('ann')), { userId: 'ann', groupIds: [1] });
    assert.deepEqual(filterViewer(project('zed')), { userId: 'zed', groupIds: [] });
  });

  it('assignee "me" lists the viewer issues, per viewer', () => {
    assert.deepEqual(ids('ann', where('assignee', 'me')), [1]);
    assert.deepEqual(ids('cat', where('assignee', 'me')), []);
  });

  it('assigneeGroup "mine" lists the issues of the viewer groups', () => {
    assert.deepEqual(ids('ann', where('assigneeGroup', 'mine')), [2, 3]);
    assert.deepEqual(ids('cat', where('assigneeGroup', 'mine')), [4]);
  });

  it('assignedTo "meOrMyGroups" lists the viewer issues and their groups', () => {
    assert.deepEqual(ids('ann', where('assignedTo', 'meOrMyGroups')), [1, 2, 3]);
    assert.deepEqual(ids('cat', where('assignedTo', 'meOrMyGroups')), [4]);
    assert.deepEqual(ids('zed', where('assignedTo', 'meOrMyGroups')), []);
  });

  it('assignedTo "me" leaves group issues out', () => {
    assert.deepEqual(ids('ann', where('assignedTo', 'me')), [1]);
  });

  it('is_not "me" keeps everything else', () => {
    const filters: FilterSet = {
      conditions: [{ id: 'c', field: 'assignedTo', op: 'is_not', values: ['me'] }],
    };
    assert.deepEqual(ids('ann', filters), [2, 3, 4, 5]);
  });
});

describe('new issue defaults from a "me" filter', () => {
  const planned = { cycles: [], initiatives: [], viewerUserId: 'ann' };

  it('assigns the viewer', () => {
    assert.deepEqual(defaultsFromFilters(where('assignee', 'me'), planned), {
      assigneeUserId: 'ann',
    });
    assert.deepEqual(defaultsFromFilters(where('assignedTo', 'me'), planned), {
      assigneeUserId: 'ann',
    });
  });

  it('assigns nobody for "me or my groups"', () => {
    assert.deepEqual(defaultsFromFilters(where('assignedTo', 'meOrMyGroups'), planned), {});
  });
});

describe('action effect with an assignee group', () => {
  const text = {
    field: (key: string) => key,
    noAssignee: 'none',
    noAssigneeGroup: 'no group',
  } as unknown as EffectText;

  it('lists the field among the set keys and names the group', () => {
    const effect = { assigneeGroupId: 2 };
    assert.deepEqual(effectFieldKeys(effect), ['assigneeGroupId']);
    assert.deepEqual(describeEffect(effect, { ...project('ann'), assignees: [] }, text), [
      { key: 'assigneeGroupId', text: 'assigneeGroupId → Nursing' },
    ]);
  });

  it('reads null as clearing the group', () => {
    assert.deepEqual(
      describeEffect({ assigneeGroupId: null }, { ...project('ann'), assignees: [] }, text),
      [{ key: 'assigneeGroupId', text: 'assigneeGroupId → no group' }],
    );
  });
});
