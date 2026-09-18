import { useRef, useState } from 'react';

export default function TodayTasks({ tasks, loading, onToggle, onIncrease, onDecrease }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState([]);
  const locks = useRef(new Set());
  const active = tasks.filter(task => !task.done && !task.skipped);
  const shown = tasks.filter(task => task.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
    (filter === 'all' || (filter === 'active' ? !task.done && !task.skipped : task.done)));

  async function update(id, action) {
    if (locks.current.has(id)) return;
    locks.current.add(id);
    setBusy([...locks.current]);
    try { await action(id); }
    finally { locks.current.delete(id); setBusy([...locks.current]); }
  }

  return <div className="task-list" aria-busy={loading}>
    <div className="task-tools">
      <label className="task-search">Find an intention<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your tasks…" /></label>
      <div className="task-filters" aria-label="Filter tasks">
        {[['all', 'All'], ['active', 'To do'], ['done', 'Done']].map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
      </div>
    </div>
    <div className="list-title"><span>TO DO <b>{active.length}</b></span><span>{tasks.filter(task => task.done).length} finished · {tasks.filter(task => task.skipped).length} resting</span></div>
    {!tasks.length && <div className="inline-empty" role="status"><b>{loading ? 'Loading your day…' : 'Your day is still unwritten.'}</b><span>{loading ? 'Fetching your saved intentions.' : 'Add one meaningful intention, then give it your attention.'}</span></div>}
    {!!tasks.length && !shown.length && <div className="inline-empty" role="status"><b>{filter === 'active' && !query ? 'Everything is taken care of.' : 'No matching intentions.'}</b><button type="button" onClick={() => { setQuery(''); setFilter('all'); }}>Show all tasks</button></div>}
    {shown.map(task => <article className={`task-card ${task.done ? 'done' : ''} ${task.skipped ? 'skipped' : ''} ${task.kind === 'temporary' ? 'temporary' : ''}`} key={task.id} aria-busy={busy.includes(task.id)}>
      <button className={`check ${task.done ? 'checked' : ''}`} disabled={busy.includes(task.id) || task.skipped} onClick={() => update(task.id, onToggle)} aria-label={`Mark ${task.title} ${task.done ? 'not done' : 'done'}`}>{task.done && '✓'}</button>
      <div className={`task-icon ${task.color}`} aria-hidden="true">{task.icon}</div>
      <div className="task-info"><h3>{task.title}{task.kind === 'temporary' && <span className="tag">TEMPORARY</span>}</h3><p>{busy.includes(task.id) ? 'Saving…' : task.note}</p>{task.kind === 'quantity' && <div className="quantity-progress" role="progressbar" aria-label={`${task.title} progress`} aria-valuemin={0} aria-valuemax={task.target} aria-valuenow={task.value}><i style={{ width: `${Math.min(100, task.value / task.target * 100)}%` }}/><span>{task.value}/{task.target}</span></div>}</div>
      {task.kind === 'quantity' && !task.skipped && <div className="count-controls"><button className="count-button subtract" aria-label={`Decrease ${task.title}`} disabled={busy.includes(task.id) || task.value <= 0} onClick={() => update(task.id, onDecrease)}>− 1</button><button className="count-button" aria-label={`Increase ${task.title}`} disabled={busy.includes(task.id) || task.value >= task.target} onClick={() => update(task.id, onIncrease)}>+ 1</button></div>}
    </article>)}
  </div>;
}
