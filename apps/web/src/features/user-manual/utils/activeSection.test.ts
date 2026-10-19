import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { activeSectionId } from './activeSection';

const sections = [
  { id: 'a', top: -400 },
  { id: 'b', top: 20 },
  { id: 'c', top: 600 },
];

describe('activeSectionId', () => {
  it('picks the last section that has reached the offset', () => {
    assert.equal(activeSectionId(sections, 100), 'b');
    assert.equal(activeSectionId(sections, 700), 'c');
  });

  it('falls back to the first section before any has reached it', () => {
    assert.equal(activeSectionId([{ id: 'a', top: 300 }], 100), 'a');
  });

  it('returns nothing for an empty list', () => {
    assert.equal(activeSectionId([], 100), undefined);
  });
});
