import { useEffect, useRef, useState } from 'react';
import { api, localDateKey } from '../api.js';
import { WeekPlanner } from '../WeekPlanner.jsx';
import SuggestionPanel from '../components/SuggestionPanel.jsx';
import { ReminderCenter } from '../PlannerEnhancements.jsx';
import TodayTasks from '../TodayTasks.jsx';
import ProductivityStudio from '../ProductivityStudio.jsx';
import '../planning.css';

const blankTask = date => ({ title: '', description: '', scheduledDate: date, taskType: 'ONE_TIME', target: 1, progress: 0, unit: 'questions', allDay: true, deadline: '', recurrence: { frequency: 'NONE' } });

export default function PlanningPage({ token, tasks, routines, todayTasks, loading, dark, onChanged, notify, onToggle, onIncrease, onDecrease, onNavigate, dailyScores = [] }) {
  const editorRef = useRef(null);
  const [date, setDate] = useState(localDateKey());
  const [view, setView] = useState('day');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => blankTask(localDateKey()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = tasks.filter(task => task.scheduledDate === date && !task.deletedAt && !['ARCHIVED', 'DROPPED', 'DELEGATED', 'SKIPPED'].includes(task.status));
  const shown = selected.filter(task => filter === 'all' || (filter === 'done') === (task.status === 'COMPLETED'));
  const scores = new Map(dailyScores.map(day => [day.date, day]));
  const month = date.slice(0, 7);
  const first = new Date(`${month}-01T00:00:00`);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();

  useEffect(() => {
    if (!editing) return;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; previousFocus?.focus(); };
  }, [editing]);
  function editorKeyboard(event) {
    if (event.key === 'Escape' && !busy) setEditing(null);
    if (event.key !== 'Tab') return;
    const controls = [...editorRef.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea,select')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  async function mutate(path, method, body, message) {
    setBusy(true); setError('');
    try { await api(path, { token, method, body }); await onChanged(); notify(message); return true; }
    catch (issue) { setError(issue.message); return false; }
    finally { setBusy(false); }
  }
  function edit(task) {
    setForm(task ? { ...blankTask(date), ...task, deadline: task.deadline || '' } : blankTask(date));
    setEditing(task?._id || 'new'); setError('');
  }
  async function save(event) {
    event.preventDefault();
    const body = { ...form, target: Number(form.target), progress: Number(form.progress), deadline: form.deadline || null };
    if (await mutate(editing === 'new' ? '/tasks' : `/tasks/${editing}`, editing === 'new' ? 'POST' : 'PATCH', body, 'Task saved')) {
      setDate(form.scheduledDate); setEditing(null);
    }
  }
  return <main className="workspace-page planning-page">
    <header className="workspace-heading"><div><p className="eyebrow">YOUR DAY, IN ONE PLACE</p><h1>Plan<span>.</span></h1><p>Choose a date. Add something achievable. Track your progress.</p></div><button className="day-add-button" onClick={() => edit(null)}>＋ Add task</button></header>
    <div className="planning-toolbar"><label>Planning date<input type="date" required value={date} onChange={event => event.target.value && setDate(event.target.value)}/></label><button onClick={() => setDate(localDateKey())}>Today</button><div className="task-filters">{['day', 'month', 'week'].map(value => <button key={value} aria-pressed={view === value} onClick={() => setView(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div></div>
    {error && <p role="alert" className="form-error">{error}</p>}
    {view === 'month' && <section className="planning-calendar" aria-label="Choose a day in the month"><h2>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2><div className="calendar-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{Array.from({length: first.getDay()}, (_, index) => <span key={`blank-${index}`}/>)}{Array.from({length: days}, (_, index) => {
      const key = `${month}-${String(index + 1).padStart(2, '0')}`;
      const count = tasks.filter(task => task.scheduledDate === key && !task.deletedAt && !['ARCHIVED','DROPPED','DELEGATED','SKIPPED'].includes(task.status)).length;
      return <button key={key} className={`calendar-day ${date === key ? 'selected' : ''}`} aria-pressed={date === key} aria-label={`${key}, ${count} tasks`} onClick={() => setDate(key)}><b>{index + 1}</b><small>{count ? `${count} tasks` : ''}</small>{scores.has(key) && <small>{scores.get(key).score}%</small>}</button>;
    })}</div></section>}
    {view === 'week' && <WeekPlanner selectedDate={date} onSelectDate={setDate} tasks={tasks} routines={routines} token={token} onChanged={onChanged} notify={notify}/>}
    <section aria-busy={loading || busy}><div className="planning-toolbar"><h2>{new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h2><div className="task-filters">{[['all','All'],['pending','To do'],['done','Done']].map(([value,label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
      {scores.has(date) && <p>{scores.get(date).score}% completion · {scores.get(date).planned} planned items</p>}
      {loading && <p role="status">Loading your saved tasks…</p>}
      {!loading && !shown.length && <p className="agenda-empty">No {filter === 'all' ? '' : filter === 'done' ? 'completed ' : 'pending '}tasks for this day.</p>}
      {shown.map(task => <article className={`planning-task ${task.status === 'COMPLETED' ? 'completed' : ''}`} key={task._id}>
        <button disabled={busy} aria-label={`${task.status === 'COMPLETED' ? 'Reopen' : 'Complete'} ${task.title}`} onClick={() => mutate(`/tasks/${task._id}/complete`, 'PATCH', { completed: task.status !== 'COMPLETED' }, 'Task updated')}>{task.status === 'COMPLETED' ? '✓' : '○'}</button>
        <div><h3>{task.title}</h3>{task.description && <p>{task.description}</p>}<small>{task.allDay ? 'All day' : task.deadline || task.startTime}{task.recurrence?.frequency && task.recurrence.frequency !== 'NONE' ? ` · ${task.recurrence.frequency.toLowerCase()}` : ''}</small>
          {task.taskType === 'MEASURABLE' && <div className="planning-progress"><progress value={task.progress} max={task.target} aria-label={`${task.title} progress`}/><span>{task.progress}/{task.target} {task.unit}</span><button disabled={busy || task.progress <= 0} aria-label={`Decrease ${task.title}`} onClick={() => mutate(`/tasks/${task._id}`, 'PATCH', { progress: Math.max(0, task.progress - 1) }, 'Progress saved')}>−</button><button disabled={busy || task.progress >= task.target} aria-label={`Increase ${task.title}`} onClick={() => mutate(`/tasks/${task._id}`, 'PATCH', { progress: Math.min(task.target, task.progress + 1) }, 'Progress saved')}>＋</button></div>}
          {task.subtasks?.map(step => <label key={step._id}><input type="checkbox" disabled={busy} checked={step.done} onChange={() => mutate(`/tasks/${task._id}/subtasks/${step._id}`, 'PATCH', { done: !step.done }, 'Checklist saved')}/>{step.title}</label>)}
        </div><button disabled={busy} onClick={() => edit(task)}>Edit</button><button disabled={busy} onClick={() => window.confirm(`Delete “${task.title}”?`) && mutate(`/tasks/${task._id}`, 'DELETE', undefined, 'Task deleted')}>Delete</button>
      </article>)}
    </section>
    {date === localDateKey() && todayTasks.some(task => task.kind !== 'special') && <section><h2>Today's routines</h2><TodayTasks tasks={todayTasks.filter(task => task.kind !== 'special')} loading={loading} onToggle={onToggle} onIncrease={onIncrease} onDecrease={onDecrease}/></section>}
    <SuggestionPanel token={token}/>
    <ReminderCenter tasks={tasks} dark={dark} notify={notify}/><details className="planning-extras"><summary>Focus, goals, and reflection</summary><ProductivityStudio token={token} dark={dark} onNavigate={onNavigate} notify={notify}/></details>
    {editing && <div className="modal-backdrop"><form ref={editorRef} className="modal planning-editor" role="dialog" aria-modal="true" aria-labelledby="task-editor-title" onSubmit={save} onKeyDown={editorKeyboard}><button type="button" className="close" disabled={busy} aria-label="Close task editor" onClick={() => setEditing(null)}>×</button><h2 id="task-editor-title">{editing === 'new' ? 'Add task' : 'Edit task'}</h2>
      <label>Title<input autoFocus required maxLength={120} value={form.title} onChange={event => setForm({...form,title:event.target.value})}/></label>
      <label>Item<select value={form.itemType || 'TASK'} onChange={event => setForm({...form,itemType:event.target.value})}><option value="TASK">Task</option><option value="EVENT">Event</option></select></label>
      <label>Details<textarea value={form.description} onChange={event => setForm({...form,description:event.target.value})}/></label>
      <label>Date<input required type="date" value={form.scheduledDate} onChange={event => setForm({...form,scheduledDate:event.target.value})}/></label>
      <label>Completion<select value={form.taskType} onChange={event => setForm({...form,taskType:event.target.value})}><option value="ONE_TIME">Check off when done</option><option value="MEASURABLE">Measure progress</option></select></label>
      {form.taskType === 'MEASURABLE' && <div className="form-grid"><label>Target<input required type="number" min="1" max="1000000" value={form.target} onChange={event => setForm({...form,target:event.target.value})}/></label><label>Unit<input required maxLength={40} value={form.unit} onChange={event => setForm({...form,unit:event.target.value})}/></label><label>Current progress<input required type="number" min="0" max={form.target} value={form.progress} onChange={event => setForm({...form,progress:event.target.value})}/></label></div>}
      <label>Deadline (optional)<input type="time" value={form.deadline} onChange={event => setForm({...form,deadline:event.target.value,allDay:!event.target.value})}/></label>
      {editing === 'new' && <label>Repeat<select value={form.recurrence.frequency} onChange={event => setForm({...form,recurrence:{frequency:event.target.value}})}>{['NONE','DAILY','WEEKLY','MONTHLY'].map(value => <option key={value}>{value}</option>)}</select></label>}
      <details><summary>Schedule and checklist options</summary>
        <label>Start time<input type="time" value={form.startTime || ''} onChange={event => setForm({...form,startTime:event.target.value || null,allDay:!event.target.value && !form.deadline})}/></label>
        <label>Reminder<select value={form.reminderMinutes ?? ''} onChange={event => setForm({...form,reminderMinutes:event.target.value === '' ? null : Number(event.target.value)})}><option value="">None</option><option value="0">At time</option><option value="10">10 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select></label>
        {editing === 'new' && form.recurrence.frequency !== 'NONE' && <label>Repeat until<input type="date" min={form.scheduledDate} value={form.recurrence.endDate || ''} onChange={event => setForm({...form,recurrence:{...form.recurrence,endDate:event.target.value}})}/></label>}
        <label>Checklist, one step per line<textarea value={(form.subtasks || []).map(step => typeof step === 'string' ? step : step.title).join('\n')} onChange={event => setForm({...form,subtasks:event.target.value.split('\n').map(title => (form.subtasks || []).find(step => step.title === title) || {title,done:false})})}/></label>
      </details>
      {error && <p role="alert">{error}</p>}<button className="create" disabled={busy}>{busy ? 'Saving…' : 'Save task'}</button>
    </form></div>}
  </main>;
}
