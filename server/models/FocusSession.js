import mongoose from 'mongoose';

const focusSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  taskType: { type: String, enum: ['ROUTINE', 'TASK', 'GENERAL'], default: 'GENERAL' },
  taskId: { type: String, default: null },
  title: { type: String, trim: true, required: true, maxlength: 120 },
  plannedMinutes: { type: Number, min: 5, max: 240, default: 25 },
  startedAt: { type: Date, required: true, default: Date.now },
  endedAt: { type: Date, default: null },
  durationMinutes: { type: Number, min: 0, default: 0 },
  distractions: { type: Number, min: 0, max: 999, default: 0 },
  status: { type: String, enum: ['ACTIVE', 'COMPLETED', 'ABANDONED'], default: 'ACTIVE', index: true },
  note: { type: String, trim: true, maxlength: 500, default: '' }
}, { timestamps: true });

focusSessionSchema.index({ userId: 1, status: 1, startedAt: -1 });
export default mongoose.model('FocusSession', focusSessionSchema);
