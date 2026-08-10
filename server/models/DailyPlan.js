import mongoose from 'mongoose';

const dailyPlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true, index: true },
  intention: { type: String, trim: true, maxlength: 300, default: '' },
  capacity: { type: String, enum: ['LOW', 'NORMAL', 'HIGH'], default: 'NORMAL' },
  priorityIds: [{ type: String, trim: true }],
  shutdownNote: { type: String, trim: true, maxlength: 600, default: '' }
}, { timestamps: true });

dailyPlanSchema.index({ userId: 1, date: 1 }, { unique: true });
export default mongoose.model('DailyPlan', dailyPlanSchema);
