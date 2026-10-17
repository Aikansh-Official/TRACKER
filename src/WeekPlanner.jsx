import { useRef, useState } from 'react';
import { api, localDateKey } from './api.js';
import { routineScheduledOn, shiftPlanningDate, visiblePlanningTask } from './planningModel.js';

const mondayFor = date => { const day = new Date(`${date}T12:00:00`).getDay(); return shiftPlanningDate(date, -(day === 0 ? 6 : day - 1)); };
const dayLabel = date => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

export function WeekPlanner({ tasks, routines, token, onChanged, notify, selectedDate, onSelectDate }) {
  const [fallbackDate, setFallbackDate] = useState(localDateKey());
  const [moving, setMoving] = useState(null);
  const [moveDate, setMoveDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const moveLock = useRef(false);
  const currentDate = selectedDate || fallbackDate;
  const weekStart = mondayFor(currentDate);
  const days = Array.from({ length: 7 }, (_, index) => shiftPlanningDate(weekStart, index));
  const selectDate = date => { setFallbackDate(date); onSelectDate?.(date); };

  async function move(taskId, scheduledDate) {
    const task = tasks.find(item => item._id === taskId);
    if (!task || !scheduledDate || scheduledDate === task.scheduledDate || moveLock.current) return;
    moveLock.current = true; setBusy(true); setError('');
    try {
      await api(`/tasks/${taskId}`, { token, method: 'PATCH', body: { scheduledDate } });
      setMoving(null); selectDate(scheduledDate);
      try { await onChanged(); notify(`Moved to ${dayLabel(scheduledDate)}`); }
      catch { notify('Task moved. Use Sync to reload your saved changes.'); }
    } catch (issue) { setError(issue.message); }
    finally { moveLock.current = false; setBusy(false); }
  }

  return <section className="week-planner" aria-label="Week calendar" aria-busy={busy}>
    <header><button onClick={() => selectDate(shiftPlanningDate(currentDate, -7))}>← Previous week</button><div><p>WEEK AT A GLANCE</p><h2 aria-live="polite">{new Date(`${weekStart}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {new Date(`${days[6]}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</h2></div><button onClick={() => selectDate(shiftPlanningDate(currentDate, 7))}>Next week →</button></header>
    <p className="planning-hint">Choose a day to update its tasks below. Use Move to reschedule a task, or drag it to another day.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="week-columns">{days.map(date => {
      const dayTasks = tasks.filter(task => task.scheduledDate === date && visiblePlanningTask(task));
      const dayRoutines = routines.filter(routine => routineScheduledOn(routine, date));
      return <article key={date} className={`${date === localDateKey() ? 'today' : ''} ${date === currentDate ? 'selected' : ''}`} onDragOver={event => { if (event.dataTransfer.types.includes('text/task-id')) event.preventDefault(); }} onDrop={event => { event.preventDefault(); move(event.dataTransfer.getData('text/task-id'), date); }}>
        <h3><button className="week-day-select" aria-label={`Show ${dayLabel(date)}`} aria-pressed={date === currentDate} aria-current={date === localDateKey() ? 'date' : undefined} onClick={() => selectDate(date)}><span>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span><b>{Number(date.slice(-2))}</b></button></h3>
        {dayTasks.map(task => <div draggable={!busy} onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/task-id', task._id); }} className={`week-block ${(task.itemType || 'TASK').toLowerCase()} ${task.status === 'COMPLETED' ? 'done' : ''}`} key={task._id}>
          <span>{task.allDay ? 'ALL DAY' : task.startTime || task.deadline || 'FLEXIBLE'}</span><b>{task.title}</b><small>{task.status === 'COMPLETED' ? 'Completed' : task.taskType === 'MEASURABLE' ? `${task.progress}/${task.target} ${task.unit}` : `${task.estimatedMinutes || 30} min`}</small>
          {moving === task._id ? <form className="week-move-form" onSubmit={event => { event.preventDefault(); move(task._id, moveDate); }}><label>Move to<input type="date" required value={moveDate} aria-label={`New date for ${task.title}`} disabled={busy} onChange={event => setMoveDate(event.target.value)}/></label><div><button disabled={busy || moveDate === task.scheduledDate}>{busy ? 'Moving…' : 'Save'}</button><button type="button" disabled={busy} onClick={() => setMoving(null)}>Cancel</button></div></form> : <button className="week-move-button" disabled={busy} aria-label={`Move ${task.title}`} onClick={() => { setMoving(task._id); setMoveDate(task.scheduledDate); setError(''); }}>Move</button>}
        </div>)}
        {dayRoutines.map(routine => <div className="week-block routine" key={routine._id}><span>{routine.preferredTime || 'ROUTINE'}</span><b>{routine.title}</b><small>{routine.estimatedMinutes || 25} min routine</small></div>)}
        {!dayTasks.length && !dayRoutines.length && <p className="week-open">Nothing planned</p>}
      </article>;
    })}</div>
  </section>;
}
