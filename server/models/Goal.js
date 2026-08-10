import mongoose from 'mongoose';

const milestoneSchema = new mongoose.Schema({
  title: { type: String, trim: true, required: true, maxlength: 160 },
  done: { type: Boolean, default: false },
  completedAt: { type: Date, default: null }
});

const goalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, trim: true, required: true, maxlength: 140 },
  description: { type: String, trim: true, maxlength: 800, default: '' },
  lifeArea: { type: String, enum: ['STUDY', 'CAREER', 'HEALTH', 'FITNESS', 'PERSONAL', 'OTHER'], default: 'PERSONAL' },
  targetDate: { type: String, default: null },
  status: { type: String, enum: ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'], default: 'ACTIVE', index: true },
  milestones: { type: [milestoneSchema], default: [] }
}, { timestamps: true });

goalSchema.index({ userId: 1, status: 1, createdAt: -1 });
export default mongoose.model('Goal', goalSchema);
