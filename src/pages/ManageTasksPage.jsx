import { useRef, useState } from 'react';
import { Check, ArrowCounterClockwise, CalendarBlank } from '@phosphor-icons/react';
import { localDateKey } from '../api.js';

const formatDate = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date';
const closedStatuses = ['ARCHIVED', 'DROPPED', 'SKIPPED', 'DELEGATED'];

export default function ManageTasksPage({ mode, tasks, routines, loading, error, onRetry, onTaskAction, onRestore, onNavigate }) {
  const pending = mode === 'Pending';
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState([]);
  const locks = useRef(new Set());
  const [issue, setIssue] = useState('');
  const [rescheduling, setRescheduling] = useState(null);
  const [date, setDate] = useState(localDateKey());
  const [undo, setUndo] = useState(null);
  const items = pending
    ? tasks.filter(task => !task.deletedAt && (task.status === 'PENDING' || (['TODAY', 'SCHEDULED'].includes(task.status) && task.scheduledDate < localDateKey()))).map(task => ({ ...task, recordType: 'Task' }))
    : [...routines.filter(routine => ['ARCHIVED', 'EXPIRED'].includes(routine.status)).map(routine => ({ ...routine, recordType: 'Routine' })), ...tasks.filter(task => !task.deletedAt && closedStatuses.includes(task.status)).map(task => ({ ...task, recordType: 'Task' }))];
  const shown = items.filter(item => `${item.title} ${item.description || ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a, b) => (a.scheduledDate || a.endDate || '').localeCompare(b.scheduledDate || b.endDate || '') || a.title.localeCompare(b.title));

  async function act(item, action, value) {
    if (locks.current.has(item._id)) return;
    locks.current.add(item._id); setBusy([...locks.current]); setIssue('');
    try {
      if (action === 'restore-routine') await onRestore(item._id);
      else await onTaskAction(item, action, value);
      setRescheduling(null);
      if (action === 'complete') setUndo(item);
      else if (action === 'reopen') setUndo(null);
    } catch (failure) { setIssue(failure.message || 'Could not save the change. Please retry.'); }
    finally { locks.current.delete(item._id); setBusy([...locks.current]); }
  }

  return <main className="workspace-page managed-workspace">
    <header className="workspace-heading"><div><p className="eyebrow">{pending ? 'FINISH OR REPLAN' : 'SAVED FOR LATER'}</p><h1>{mode}<span>.</span></h1><p>{pending ? 'Already done? Complete it here. Need more time? Choose another day.' : 'Restore archived work, or review routines that have ended.'}</p></div></header>
    <div className="manage-toolbar"><label>Search {pending ? 'pending work' : 'archive'}<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by title or details…"/></label><span>{items.length} {items.length === 1 ? 'item' : 'items'}</span></div>
    {undo && <div className="manage-feedback" role="status"><span>Completed “{undo.title}”. Its planned date is unchanged.</span><button disabled={busy.includes(undo._id)} onClick={() => act(undo, 'reopen')}><ArrowCounterClockwise size={16} aria-hidden="true"/>Undo completion</button><button aria-label="Dismiss completion message" onClick={() => setUndo(null)}>×</button></div>}
    {(issue || error) && <div className="manage-feedback is-error" role="alert"><span>{issue || error}</span>{error && <button onClick={onRetry}>Retry loading</button>}</div>}
    {loading && !items.length ? <p role="status">Loading your saved work…</p> : !error && <>
      {shown.length > 0 ? <section className="managed-list" aria-label={mode}>{shown.map(item => {
        const saving = busy.includes(item._id);
        const expired = item.recordType === 'Routine' && item.isTemporary && item.endDate < localDateKey();
        return <article key={`${item.recordType}-${item._id}`} aria-busy={saving}>
          <div className="managed-item-copy"><div className="managed-meta"><span>{item.recordType}</span>{item.priority && <span>{item.priority.toLowerCase()} priority</span>}{!pending && <span>{item.status.toLowerCase()}</span>}</div><h2>{item.title}</h2>{item.description && <p>{item.description}</p>}<small>{item.scheduledDate ? `Planned for ${formatDate(item.scheduledDate)}` : item.endDate ? `Ended ${formatDate(item.endDate)}` : 'Routine history is preserved'}</small>{item.taskType === 'MEASURABLE' && <p className="managed-progress">{item.progress}/{item.target} {item.unit}</p>}</div>
          <div className="managed-actions">
            {pending && <button className="manage-primary" disabled={saving} onClick={() => act(item, 'complete')}><Check size={17} aria-hidden="true"/>Mark done</button>}
            {item.recordType === 'Task' && <button disabled={saving} onClick={() => { setRescheduling(item._id); setDate(localDateKey()); }}><CalendarBlank size={17} aria-hidden="true"/>{pending ? 'Reschedule' : 'Restore to plan'}</button>}
            {pending && <button className="manage-quiet" disabled={saving} onClick={() => window.confirm(`Move “${item.title}” to Archive as no longer needed? You can restore it later.`) && act(item, 'drop')}>No longer needed</button>}
            {item.recordType === 'Routine' && !expired && <button disabled={saving} onClick={() => act(item, 'restore-routine')}>Restore routine</button>}
            {expired && <span className="managed-ended">This routine's end date has passed.</span>}
          </div>
          {rescheduling === item._id && <form className="manage-reschedule" onSubmit={event => { event.preventDefault(); act(item, 'reschedule', date); }}><label>New planned date for {item.title}<input autoFocus type="date" required value={date} onChange={event => setDate(event.target.value)}/></label><button className="manage-primary" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save date'}</button><button disabled={saving} type="button" onClick={() => setRescheduling(null)}>Cancel</button></form>}
        </article>;
      })}</section> : <section className="managed-empty"><h2>{query ? 'No matching items' : pending ? 'You’re all caught up' : 'Your archive is empty'}</h2><p>{query ? 'Try another search or clear the filter.' : pending ? 'Unfinished tasks from earlier days will appear here.' : 'Archived routines and work you set aside will appear here.'}</p><button onClick={() => query ? setQuery('') : onNavigate(pending ? 'Plan' : 'Routines')}>{query ? 'Clear search' : pending ? 'Open Plan' : 'View routines'}</button></section>}
    </>}
  </main>;
}
