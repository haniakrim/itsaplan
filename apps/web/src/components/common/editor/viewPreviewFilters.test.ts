import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProjectScaffold } from '@/lib/api/endpoints/projects';
import type { View } from '@/lib/api/endpoints/views';
import { viewPreviewFilters } from './viewPreviewFilters';

const project = {
  columns: [],
  issueTypes: [],
  labels: [],
  groups: [{ id: 7, name: 'Pharmacy' }],
  assignees: [{ userId: 'u1', name: 'Ann' }],
  customFields: [],
} as unknown as ProjectScaffold;

const view = (conditions: unknown[]) => ({ filters: { conditions } }) as unknown as View;

describe('viewPreviewFilters', () => {
  it('names the viewer-relative values by message key instead of their raw token', () => {
    const [assignedTo, assignee, group] = viewPreviewFilters(
      view([
        { field: 'assignedTo', op: 'is', values: ['meOrMyGroups'] },
        { field: 'assignee', op: 'is', values: ['me', 'u1'] },
        { field: 'assigneeGroup', op: 'is', values: ['mine', 7] },
      ]),
      project,
    );
    assert.deepEqual(assignedTo?.valueKeys, ['mine.meOrMyGroups']);
    assert.deepEqual(assignedTo?.values, []);
    assert.deepEqual(assignee?.valueKeys, ['mine.me']);
    assert.deepEqual(assignee?.values, ['Ann']);
    assert.deepEqual(group?.valueKeys, ['mine.myGroups']);
    assert.deepEqual(group?.values, ['Pharmacy']);
    assert.equal(group?.remainingValues, 0);
  });
});
