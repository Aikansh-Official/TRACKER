import { useRef, useState } from 'react';
import { localDateKey } from '../api.js';

const schedule = routine => routine.frequency === 'CUSTOM' ? (routine.scheduledDays || []).map(day => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(', ') : routine.frequency === 'WEEKLY_TARGET' ? `${routine.weeklyTarget} times per week` : ({ DAILY: 'Every day', WEEKDAYS: 'Weekdays', WEEKENDS: 'Weekends' }[routine.frequency] || 'Every day');

export default function RoutineLibrary({ routines, todayTasks, loading, error, onRetry, onAdd, onArchive }) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState([]);
  const locks = useRef(new Set());
  const [issue, setIssue] = useState('');
  const active = routines.filter(routine => routine.status === 'ACTIVE');
  const shown = active.filter(routine => routine.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  async function archive(routine) {
    if (locks.current.has(routine._id)) return;
    locks.current.add(routine._id); setBusy([...locks.current]); setIssue('');
    try { await onArchive(routine._id); } catch (error) { setIssue(error.message); }
    finally { locks.current.delete(routine._id); setBusy([...locks.current]); }
  }
  return <main className="workspace-page managed-workspace"><header className="workspace-heading"><div><p className="eyebrow">ROUTINE LIBRARY</p><h1>Your routines<span>.</span></h1><p>All active routines, including those scheduled for another day.</p></div><button className="add-button" onClick={onAdd}>＋ Add routine</button></header><div className="manage-toolbar"><label>Find a routine<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search routines…"/></label><span>{active.length} active</span></div>{(error || issue) && <div className="manage-feedback is-error" role="alert">{issue || error}{error && <button onClick={onRetry}>Retry loading</button>}</div>}{loading && !active.length ? <p role="status">Loading your routines…</p> : !error && <section className="managed-list">{shown.map(routine => {
    const record = todayTasks.find(task => task.id === routine._id);
    const paused = routine.pausedUntil && routine.pausedUntil >= localDateKey();
    const state = paused ? `Paused until ${routine.pausedUntil}` : routine.startDate > localDateKey() ? `Starts ${routine.startDate}` : record?.skipped ? 'Resting today' : record?.done ? 'Done today' : record ? 'Due today' : 'Not due today';
    return <article key={routine._id}><div className="managed-item-copy"><div className="managed-meta"><span>{schedule(routine)}</span><span>{state}</span></div><h2>{routine.title}</h2>{routine.description && <p>{routine.description}</p>}<small>{routine.type === 'QUANTIFIABLE' ? `${routine.targetQuantity} ${routine.unit} per scheduled day` : 'Check off when complete'}{routine.isTemporary ? ` · Ends ${routine.endDate}` : ''}</small></div><div className="managed-actions"><button disabled={busy.includes(routine._id)} onClick={() => window.confirm(`Archive “${routine.title}”? Its history stays saved and you can restore it from Archive.`) && archive(routine)}>{busy.includes(routine._id) ? 'Archiving…' : 'Archive'}</button></div></article>;
  })}{!shown.length && <div className="managed-empty"><h2>{query ? 'No matching routines' : 'Build your first routine'}</h2><p>{query ? 'Try another search.' : 'Choose something small you want to repeat.'}</p><button onClick={() => query ? setQuery('') : onAdd()}>{query ? 'Clear search' : 'Add routine'}</button></div>}</section>}</main>;
}
