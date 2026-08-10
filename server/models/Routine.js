import mongoose from 'mongoose';

const routineSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, trim: true, required: true, maxlength: 120 },
  description: { type: String, trim: true, default: '' },
  type: { type: String, enum: ['BINARY', 'QUANTIFIABLE', 'TEMPORARY'], required: true },
  targetQuantity: { type: Number, min: 1, default: 1 },
  unit: { type: String, trim: true, default: 'times' },
  category: { type: String, enum: ['STUDY', 'HYGIENE', 'WORKOUT', 'HEALTH', 'PERSONAL', 'OTHER'], default: 'OTHER', index: true },
  frequency: { type: String, enum: ['DAILY', 'WEEKDAYS', 'WEEKENDS', 'CUSTOM', 'WEEKLY_TARGET'], default: 'DAILY' },
  scheduledDays: [{ type: Number, min: 0, max: 6 }],
  weeklyTarget: { type: Number, min: 1, max: 7, default: 3 },
  estimatedMinutes: { type: Number, min: 5, max: 480, default: 25 },
  preferredTime: { type: String, default: null },
  minimumTarget: { type: Number, min: 1, default: 1 },
  stretchTarget: { type: Number, min: 1, default: 1 },
  pausedUntil: { type: String, default: null },
  startDate: { type: String, required: true },
  endDate: { type: String, default: null },
  isTemporary: { type: Boolean, default: false },
  status: { type: String, enum: ['ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED'], default: 'ACTIVE', index: true }
}, { timestamps: true });

routineSchema.index({ userId: 1, status: 1, startDate: 1 });
export default mongoose.model('Routine', routineSchema);
