export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function measurement(input, current = {}) {
  const taskType = input.taskType ?? current.taskType ?? 'ONE_TIME';
  const target = Number(input.target ?? current.target ?? 1);
  const progress = Number(input.progress ?? current.progress ?? 0);
  const unit = String(input.unit ?? current.unit ?? 'times').trim();
  if (!['ONE_TIME', 'MEASURABLE'].includes(taskType)) throw Object.assign(new Error('Choose a valid task type.'), { status: 400 });
  if (!Number.isInteger(target) || target <= 0 || target > 1000000 || !Number.isInteger(progress) || progress < 0 || progress > target || !unit || unit.length > 40) {
    throw Object.assign(new Error('Use a positive target, progress between zero and target, and a short unit.'), { status: 400 });
  }
  return { taskType, target, progress, unit };
}
