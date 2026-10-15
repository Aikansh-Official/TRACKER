import { randomUUID } from 'node:crypto';
import SpecialTask from '../models/SpecialTask.js';

// Add missing synchronization metadata without rewriting existing task content.
// Conditional updates also make this safe if two servers start together.
export async function migrateTaskSync() {
  const defaults = { revision: 1, deletedAt: null, lastMutationId: null };
  for (const [field, value] of Object.entries(defaults)) {
    await SpecialTask.collection.updateMany({ [field]: { $exists: false } }, { $set: { [field]: value } });
  }
  const cursor = SpecialTask.collection.find({ $or: [{ syncId: { $exists: false } }, { syncUpdatedAt: { $exists: false } }] });
  for await (const task of cursor) {
    if (!task.syncId) await SpecialTask.collection.updateOne({ _id: task._id, syncId: { $exists: false } }, { $set: { syncId: randomUUID() } });
    if (!task.syncUpdatedAt) await SpecialTask.collection.updateOne({ _id: task._id, syncUpdatedAt: { $exists: false } }, { $set: { syncUpdatedAt: task.updatedAt || new Date() } });
  }
}
