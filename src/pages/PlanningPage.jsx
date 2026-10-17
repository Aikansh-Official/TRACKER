import { useEffect, useRef, useState } from 'react';
import { api, localDateKey } from '../api.js';
import { WeekPlanner } from '../WeekPlanner.jsx';
import SuggestionPanel from '../components/SuggestionPanel.jsx';
import { ReminderCenter } from '../PlannerEnhancements.jsx';
import TodayTasks from '../TodayTasks.jsx';
import ProductivityStudio from '../ProductivityStudio.jsx';
import { planningTaskPayload, routineScheduledOn, shiftPlanningDate, visiblePlanningTask } from '../planningModel.js';
import '../planning.css';

const blankTask = date => ({ title: '', description: '', itemType: 'TASK', scheduledDate: date, taskType: 'ONE_TIME', target: 1, progress: 0, unit: 'questions', allDay: true, startTime: '', deadline: '', priority: 'MEDIUM', estimatedMinutes: 30, reminderMinutes: null, subtasks: [], recurrence: { frequency: 'NONE' } });
const formatDate = date => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

export default function PlanningPage({ token, tasks, routines, todayTasks, loading, loadError, onRetry, dark, onChanged, notify, onToggle, onIncrease, onDecrease, onSkip, onNavigate, dailyScores = [], createRequest = 0, onCreateHandled }) {
  const editorRef = useRef(null);
  const returnFocusRef = useRef(null);
  const savingRef = useRef(false);
  const [date, setDate] = useState(localDateKey());
  const [view, setView] = useState('day');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => blankTask(localDateKey()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const activeTasks = tasks.filter(visiblePlanningTask);
  const selected = activeTasks.filter(task => task.scheduledDate === date);
  const shown = selected.filter(task => filter === 'all' || (filter === 'done') === (task.status === 'COMPLETED'));
  const selectedRoutines = routines.filter(routine => routineScheduledOn(routine, date));
  const scores = new Map(dailyScores.map(day => [day.date, day]));
  const counts = new Map();
  for (const task of activeTasks) counts.set(task.scheduledDate, (counts.get(task.scheduledDate) || 0) + 1);
  const month = date.slice(0, 7);
  const first = new Date(`${month}-01T12:00:00`);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();

  useEffect(() => {
    if (!createRequest) return;
    const today = localDateKey();
    setDate(today); setForm(blankTask(today)); setEditing('new'); setError('');
    onCreateHandled?.();
  }, [createRequest, onCreateHandled]);
  useEffect(() => {
    if (!editing) return;
    const previousFocus = returnFocusRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; previousFocus?.focus(); };
  }, [editing]);
  useEffect(() => { if (editing && error) editorRef.current?.querySelector('[role="alert"]')?.focus(); }, [editing, error]);

  function editorKeyboard(event) {
    if (event.key === 'Escape' && !busy) { event.preventDefault(); setEditing(null); }
    if (event.key !== 'Tab') return;
    const controls = [...editorRef.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary')].filter(control => control.getClientRects().length && !control.closest('fieldset:disabled'));
    if (!controls.length) { event.preventDefault(); return; }
    const firstControl = controls[0], lastControl = controls.at(-1);
    if (event.shiftKey && (document.activeElement === firstControl || !controls.includes(document.activeElement))) { event.preventDefault(); lastControl?.focus(); }
    else if (!event.shiftKey && document.activeElement === lastControl) { event.preventDefault(); firstControl?.focus(); }
  }
  async function mutate(path, method, body, message) {
    if (savingRef.current) return false;
    savingRef.current = true; setBusy(true); setError('');
    try {
      await api(path, { token, method, body });
      try { await onChanged(); notify(message); }
      catch { notify(`${message}. Refresh could not finish; use Sync to reload your saved changes.`); }
      return true;
    } catch (issue) { setError(issue.message); return false; }
    finally { savingRef.current = false; setBusy(false); }
  }
  function edit(task) {
    returnFocusRef.current = document.activeElement;
    setForm(task ? { ...blankTask(date), ...task, startTime: task.startTime || '', deadline: task.deadline || '' } : blankTask(date));
    setEditing(task?._id || 'new'); setError('');
  }
  async function save(event) {
    event.preventDefault();
    let body;
    try { body = planningTaskPayload(form, { creating: editing === 'new' }); }
    catch (issue) { setError(issue.message); return; }
    const recurring = editing === 'new' && form.recurrence.frequency !== 'NONE';
    if (await mutate(editing === 'new' ? '/tasks' : `/tasks/${editing}`, editing === 'new' ? 'POST' : 'PATCH', body, recurring ? 'Recurring tasks saved' : 'Task saved')) {
      setDate(body.scheduledDate); setFilter('all'); setEditing(null);
    }
  }

  return <main className="workspace-page planning-page">
    <header className="workspace-heading"><div><p className="eyebrow">YOUR DAY, IN ONE PLACE</p><h1>Plan<span>.</span></h1><p>Choose a date. Add something achievable. Track your progress.</p></div><button className="day-add-button" disabled={busy} onClick={() => edit(null)}>＋ Add task</button></header>
    <div className="planning-toolbar"><div className="planning-date-controls"><button aria-label="Previous day" onClick={() => setDate(shiftPlanningDate(date, -1))}>←</button><label>Planning date<input type="date" required value={date} onChange={event => event.target.value && setDate(event.target.value)}/></label><button aria-label="Next day" onClick={() => setDate(shiftPlanningDate(date, 1))}>→</button></div><button onClick={() => setDate(localDateKey())}>Today</button><div className="task-filters" role="group" aria-label="Calendar view">{['day', 'week', 'month'].map(value => <button key={value} aria-pressed={view === value} onClick={() => setView(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div></div>
    {loadError && <div role="alert" className="form-error"><p>{loadError}</p><button onClick={onRetry} disabled={loading}>{loading ? 'Loading…' : 'Try again'}</button></div>}
    {!editing && error && <p role="alert" className="form-error">{error}</p>}
    {view === 'month' && <section className="planning-calendar" aria-label="Choose a day in the month"><header className="planning-month-heading"><button aria-label="Previous month" onClick={() => setDate(shiftPlanningDate(date, -1, 'month'))}>←</button><h2 aria-live="polite">{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2><button aria-label="Next month" onClick={() => setDate(shiftPlanningDate(date, 1, 'month'))}>→</button></header><div className="calendar-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{Array.from({length: first.getDay()}, (_, index) => <span key={`blank-${index}`}/>)}{Array.from({length: days}, (_, index) => {
      const key = `${month}-${String(index + 1).padStart(2, '0')}`;
      const count = counts.get(key) || 0;
      return <button key={key} className={`calendar-day ${date === key ? 'selected' : ''}`} aria-pressed={date === key} aria-current={key === localDateKey() ? 'date' : undefined} aria-label={`${formatDate(key)}, ${count} ${count === 1 ? 'task' : 'tasks'}`} onClick={() => setDate(key)}><b>{index + 1}</b><small>{count ? `${count} ${count === 1 ? 'task' : 'tasks'}` : ''}</small>{scores.has(key) && <small aria-label={`${scores.get(key).score}% completion`}>{scores.get(key).score}%</small>}</button>;
    })}</div></section>}
    {view === 'week' && <WeekPlanner selectedDate={date} onSelectDate={setDate} tasks={tasks} routines={routines} token={token} onChanged={onChanged} notify={notify}/>}
    <section aria-busy={loading || busy} aria-labelledby="planning-day-heading"><div className="planning-toolbar"><h2 id="planning-day-heading">{formatDate(date)}</h2><div className="task-filters" role="group" aria-label="Filter tasks">{[['all','All'],['pending','To do'],['done','Done']].map(([value,label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label} <span>{value === 'all' ? selected.length : selected.filter(task => (value === 'done') === (task.status === 'COMPLETED')).length}</span></button>)}</div></div>
      {scores.has(date) && <p>{scores.get(date).score}% completion · {scores.get(date).planned} planned items</p>}
      {loading && <p role="status">Loading your saved tasks…</p>}
      {!loading && !loadError && !shown.length && <div className="planning-empty"><p>No {filter === 'all' ? '' : filter === 'done' ? 'completed ' : 'pending '}tasks for this day.</p>{selected.length ? <button onClick={() => setFilter('all')}>Show all tasks</button> : <button onClick={() => edit(null)}>Add a task for this date</button>}</div>}
      {shown.map(task => <article className={`planning-task ${task.status === 'COMPLETED' ? 'completed' : ''}`} key={task._id}>
        <button className="planning-complete" disabled={busy} aria-label={`${task.status === 'COMPLETED' ? 'Reopen' : 'Complete'} ${task.title}`} onClick={() => mutate(`/tasks/${task._id}/complete`, 'PATCH', { completed: task.status !== 'COMPLETED' }, task.status === 'COMPLETED' ? 'Task reopened' : 'Task completed')}>{task.status === 'COMPLETED' ? '✓' : '○'}</button>
        <div><h3>{task.title}</h3>{task.description && <p>{task.description}</p>}<small>{task.itemType === 'EVENT' ? 'Event · ' : ''}{task.allDay ? 'All day' : [task.startTime && `Starts ${task.startTime}`, task.deadline && `${task.itemType === 'EVENT' ? 'Ends' : 'Due'} ${task.deadline}`].filter(Boolean).join(' · ') || 'Flexible time'}{task.recurrence?.frequency && task.recurrence.frequency !== 'NONE' ? ` · Repeats ${task.recurrence.frequency.toLowerCase()}` : ''}</small>
          {task.taskType === 'MEASURABLE' && <div className="planning-progress"><progress value={task.progress} max={task.target} aria-label={`${task.title} progress`}/><span>{task.progress}/{task.target} {task.unit}</span><button disabled={busy || task.progress <= 0} aria-label={`Decrease ${task.title}`} onClick={() => mutate(`/tasks/${task._id}`, 'PATCH', { progress: Math.max(0, task.progress - 1) }, 'Progress saved')}>−</button><button disabled={busy || task.progress >= task.target} aria-label={`Increase ${task.title}`} onClick={() => mutate(`/tasks/${task._id}`, 'PATCH', { progress: Math.min(task.target, task.progress + 1) }, 'Progress saved')}>＋</button></div>}
          {task.subtasks?.map(step => <label className="planning-checklist-step" key={step._id}><input type="checkbox" disabled={busy} checked={step.done} onChange={() => mutate(`/tasks/${task._id}/subtasks/${step._id}`, 'PATCH', { done: !step.done }, 'Checklist saved')}/>{step.title}</label>)}
        </div><button disabled={busy} aria-label={`Edit ${task.title}`} onClick={() => edit(task)}>Edit</button><button disabled={busy} aria-label={`Delete ${task.title}`} onClick={() => window.confirm(`Delete “${task.title}”${task.recurrence?.frequency && task.recurrence.frequency !== 'NONE' ? ' for this date only' : ''}?`) && mutate(`/tasks/${task._id}`, 'DELETE', undefined, 'Task deleted')}>Delete</button>
      </article>)}
    </section>
    {date === localDateKey() && todayTasks.some(task => task.kind !== 'special') && <section className="planning-routines"><h2>Today's routines</h2><TodayTasks tasks={todayTasks.filter(task => task.kind !== 'special')} loading={loading} onToggle={onToggle} onIncrease={onIncrease} onDecrease={onDecrease} onSkip={onSkip}/></section>}
    {date !== localDateKey() && selectedRoutines.length > 0 && <section className="planning-routines"><h2>Scheduled routines</h2><p>These routines are scheduled for this date. Daily progress controls are available for today.</p><ul>{selectedRoutines.map(routine => <li key={routine._id}><strong>{routine.title}</strong>{routine.preferredTime && <span>{routine.preferredTime}</span>}</li>)}</ul><button onClick={() => onNavigate('Routines')}>Manage routines</button></section>}
    <SuggestionPanel token={token}/>
    <ReminderCenter tasks={tasks} dark={dark} notify={notify}/><details className="planning-extras"><summary>Focus, goals, and reflection</summary><ProductivityStudio token={token} dark={dark} onNavigate={onNavigate} notify={notify}/></details>
    {editing && <div className="modal-backdrop"><form ref={editorRef} className="modal planning-editor" role="dialog" aria-modal="true" aria-labelledby="task-editor-title" onSubmit={save} onKeyDown={editorKeyboard}><button type="button" className="close" disabled={busy} aria-label="Close task editor" onClick={() => setEditing(null)}>×</button><h2 id="task-editor-title">{editing === 'new' ? 'Add task' : 'Edit task'}</h2>
      {editing !== 'new' && form.recurrence.frequency !== 'NONE' && <p className="planning-hint">Changes apply to this occurrence only. Other dates in the series stay as planned.</p>}
      <fieldset disabled={busy} className="planning-editor-fields">
        <label>Title<input autoFocus required maxLength={120} value={form.title} onChange={event => setForm({...form,title:event.target.value})}/></label>
        <div className="form-grid"><label>Item<select value={form.itemType} onChange={event => setForm({...form,itemType:event.target.value})}><option value="TASK">Task</option><option value="EVENT">Event</option></select></label><label>Priority<select value={form.priority} onChange={event => setForm({...form,priority:event.target.value})}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></label></div>
        <label>Details<textarea value={form.description} onChange={event => setForm({...form,description:event.target.value})}/></label>
        <label>Date<input required type="date" value={form.scheduledDate} onChange={event => setForm({...form,scheduledDate:event.target.value})}/></label>
        <label>Completion<select value={form.taskType} onChange={event => setForm({...form,taskType:event.target.value})}><option value="ONE_TIME">Check off when done</option><option value="MEASURABLE">Measure progress</option></select></label>
        {form.taskType === 'MEASURABLE' && <div className="form-grid"><label>Target<input required type="number" min="1" max="1000000" step="1" value={form.target} onChange={event => setForm({...form,target:event.target.value})}/></label><label>Unit<input required maxLength={40} value={form.unit} onChange={event => setForm({...form,unit:event.target.value})}/></label><label>Current progress<input required type="number" min="0" max={form.target} step="1" value={form.progress} onChange={event => setForm({...form,progress:event.target.value})}/></label></div>}
        <label className="planning-all-day"><input type="checkbox" checked={form.allDay} onChange={event => setForm({...form,allDay:event.target.checked})}/>All day / no specific time</label>
        {!form.allDay && <div className="form-grid"><label>Start time<input type="time" value={form.startTime} onChange={event => setForm({...form,startTime:event.target.value})}/></label><label>{form.itemType === 'EVENT' ? 'End time (optional)' : 'Deadline (optional)'}<input type="time" value={form.deadline} onChange={event => setForm({...form,deadline:event.target.value})}/></label></div>}
        {editing === 'new' && <label>Repeat<select value={form.recurrence.frequency} onChange={event => setForm({...form,recurrence:{frequency:event.target.value}})}>{[['NONE','Does not repeat'],['DAILY','Every day'],['WEEKLY','Every week'],['MONTHLY','Every month']].map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label>}
        {editing === 'new' && form.recurrence.frequency !== 'NONE' && <><label>Repeat until (optional)<input type="date" min={form.scheduledDate} value={form.recurrence.endDate || ''} onChange={event => setForm({...form,recurrence:{...form.recurrence,endDate:event.target.value}})}/></label><p className="planning-hint">Creates up to 120 occurrences within the next year, or through the end date you choose.</p></>}
        <details><summary>Reminder, estimate, and checklist</summary>
          <label>Reminder<select value={form.reminderMinutes ?? ''} onChange={event => setForm({...form,reminderMinutes:event.target.value === '' ? null : Number(event.target.value)})}><option value="">None</option><option value="0">At start / deadline</option><option value="10">10 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select></label>
          {form.allDay && form.reminderMinutes !== null && <p className="planning-hint">For all-day tasks, reminders use 9:00 AM on the chosen date.</p>}
          <label>Estimated minutes<input type="number" min="5" max="480" step="1" required value={form.estimatedMinutes} onChange={event => setForm({...form,estimatedMinutes:event.target.value})}/></label>
          <label>Checklist, one step per line<textarea value={(form.subtasks || []).map(step => step.title).join('\n')} onChange={event => setForm({...form,subtasks:event.target.value.split('\n').map((title, index) => ({ ...((form.subtasks || []).find(step => step.title === title) || form.subtasks?.[index] || {done:false}), title }))})}/></label>
        </details>
      </fieldset>
      {error && <p role="alert" tabIndex="-1" className="form-error">{error}</p>}<div className="planning-editor-actions"><button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button><button className="create" disabled={busy}>{busy ? 'Saving…' : 'Save task'}</button></div>
    </form></div>}
  </main>;
}
