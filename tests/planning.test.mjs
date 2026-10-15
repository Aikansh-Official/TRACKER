import test from 'node:test';
import assert from 'node:assert/strict';
import { validDate, measurement } from '../server/services/taskValidation.js';
import { rankRecords } from '../server/services/suggestions.js';
test('real dates and safe measurable progress', () => {
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-02-29'), false);
  assert.throws(() => measurement({ target: -1 }));
  assert.throws(() => measurement({ target: 1.5 }));
  assert.throws(() => measurement({ progress: Infinity }));
  assert.equal(measurement({ progress: 2 }, { taskType: 'MEASURABLE', target: 5, unit: 'questions' }).progress, 2);
});
test('retrieval ranks relevant excerpts and bounds the result', () => {
  const records = Array.from({length: 15}, (_, index) => ({ id: String(index), text: index === 5 ? 'practice graph questions' : 'water', date: '2026-10-15' }));
  const result = rankRecords(records, 'graph questions');
  assert.equal(result.length, 8); assert.equal(result[0].id, '5');
});
