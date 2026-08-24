import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

const specialTaskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, trim: true, required: true, maxlength: 120 },
  description: { type: String, trim: true, default: '' },
  itemType: { type: String, enum: ['TASK', 'EVENT'], default: 'TASK', index: true },
  originalDate: { type: String, required: true },
  scheduledDate: { type: String, required: true, index: true },
  allDay: { type: Boolean, default: false },
  startTime: { type: String, default: null },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
  deadline: { type: String, default: null },
  estimatedMinutes: { type: Number, min: 5, max: 480, default: 30 },
  preferredTime: { type: String, default: null },
  reminderMinutes: { type: Number, min: 0, max: 10080, default: null },
  recurrence: {
    frequency: { type: String, enum: ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'], default: 'NONE' },
    interval: { type: Number, min: 1, max: 30, default: 1 },
    weekdays: [{ type: Number, min: 0, max: 6 }],
    endDate: { type: String, default: null }
  },
  seriesId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  occurrenceDate: { type: String, default: null },
  subtasks: [{
    title: { type: String, trim: true, maxlength: 160, required: true },
    done: { type: Boolean, default: false },
    completedAt: { type: Date, default: null }
  }],
  status: { type: String, enum: ['SCHEDULED', 'TODAY', 'PENDING', 'COMPLETED', 'SKIPPED', 'DROPPED', 'DELEGATED', 'ARCHIVED'], default: 'TODAY', index: true },
  outcome: { type: String, enum: ['COMPLETED', 'RESCHEDULED', 'SKIPPED', 'DROPPED', 'DELEGATED', null], default: null },
  outcomeNote: { type: String, trim: true, maxlength: 400, default: '' },
  skipReason: { type: String, trim: true, maxlength: 180, default: '' },
  delegatedTo: { type: String, trim: true, maxlength: 120, default: '' },
  completedAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  syncId: { type: String, required: true, default: randomUUID, immutable: true },
  revision: { type: Number, required: true, default: 1, min: 1 },
  syncUpdatedAt: { type: Date, required: true, default: Date.now },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

specialTaskSchema.index({ userId: 1, status: 1, scheduledDate: 1 });
specialTaskSchema.index({ userId: 1, seriesId: 1, occurrenceDate: 1 }, { sparse: true });
specialTaskSchema.index({ userId: 1, syncId: 1 }, { unique: true });
export default mongoose.model('SpecialTask', specialTaskSchema);
