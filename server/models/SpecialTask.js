import mongoose from 'mongoose';

const specialTaskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, trim: true, required: true, maxlength: 120 },
  description: { type: String, trim: true, default: '' },
  originalDate: { type: String, required: true },
  scheduledDate: { type: String, required: true, index: true },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
  deadline: { type: String, default: null },
  estimatedMinutes: { type: Number, min: 5, max: 480, default: 30 },
  preferredTime: { type: String, default: null },
  status: { type: String, enum: ['TODAY', 'PENDING', 'COMPLETED', 'DROPPED', 'DELEGATED', 'ARCHIVED'], default: 'TODAY', index: true },
  outcome: { type: String, enum: ['COMPLETED', 'RESCHEDULED', 'DROPPED', 'DELEGATED', null], default: null },
  outcomeNote: { type: String, trim: true, maxlength: 400, default: '' },
  delegatedTo: { type: String, trim: true, maxlength: 120, default: '' },
  completedAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null }
}, { timestamps: true });

specialTaskSchema.index({ userId: 1, status: 1, scheduledDate: 1 });
export default mongoose.model('SpecialTask', specialTaskSchema);
