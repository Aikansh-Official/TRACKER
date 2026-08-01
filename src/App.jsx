import { useEffect, useMemo, useState } from 'react';

// During development Vite proxies this relative URL to the Express server.
// A hosted deployment can set VITE_API_URL to its deployed API address.
const API_URL = import.meta.env.VITE_API_URL || '/api';
async function api(path, { token, method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  } catch {
    throw new Error('TRACKER cannot reach its backend. Please run npm run dev:full and keep that terminal open.');
  }
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.message || 'Could not save your changes.');
  return payload;
}

const initialTasks = [];

function Icon({ children, className = '' }) { return <span className={`icon ${className}`}>{children}</span>; }
function Circle({ value }) { return <div className="progress-ring" style={{ '--progress': `${value * 3.6}deg` }}><div><strong>{value}%</strong><span>complete</span></div></div>; }

export default function App() {
  const [tasks, setTasks] = useState(initialTasks);
  const [token, setToken] = useState(() => localStorage.getItem('tracker-token') || '');
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('tracker-user') || 'null'));
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const [now, setNow] = useState(new Date());
  const [dark, setDark] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [notice, setNotice] = useState('');
  const [nav, setNav] = useState('Overview');
  const [form, setForm] = useState({ title: '', type: 'routine', target: '', category: 'OTHER' });

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 2600); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (token) loadDashboard(); }, [token]);
  useEffect(() => { if (token && (nav === 'Insights' || nav === 'Calendar')) loadInsights(); }, [token, nav]);
  const percent = useMemo(() => tasks.length ? Math.round(tasks.reduce((total, task) => total + (task.kind === 'quantity' ? task.value / task.target : task.done ? 1 : 0), 0) / tasks.length * 100) : 0, [tasks]);
  const completed = tasks.filter(t => t.done || (t.kind === 'quantity' && t.value >= t.target)).length;
  const formattedDate = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  async function loadDashboard() {
    setLoading(true);
    try {
      const dashboard = await api('/dashboard', { token });
      const routineTasks = dashboard.records.map(record => ({ id: record.routineId._id, title: record.routineId.title, note: record.routineId.type === 'QUANTIFIABLE' ? `${record.completedQuantity} of ${record.target} ${record.routineId.unit}` : record.routineId.isTemporary ? `Until ${record.routineId.endDate}` : 'Daily routine', kind: record.routineId.type === 'QUANTIFIABLE' ? 'quantity' : record.routineId.isTemporary ? 'temporary' : 'routine', value: record.completedQuantity, target: record.target, done: record.completed, icon: record.routineId.type === 'QUANTIFIABLE' ? '◉' : record.routineId.isTemporary ? '⌁' : '◒', color: record.routineId.type === 'QUANTIFIABLE' ? 'blue' : record.routineId.isTemporary ? 'mint' : 'violet' }));
      const specialTasks = dashboard.specialTasks.map(task => ({ id: task._id, title: task.title, note: task.deadline ? `Due · ${task.deadline}` : `${task.priority.toLowerCase()} priority`, kind: 'special', done: task.status === 'COMPLETED', icon: '✦', color: 'coral' }));
      setTasks([...routineTasks, ...specialTasks]); setPendingCount(dashboard.pendingCount); setUser(dashboard.user); localStorage.setItem('tracker-user', JSON.stringify(dashboard.user));
    } catch (error) { setNotice(error.message); } finally { setLoading(false); }
  }
  async function loadInsights() {
    setInsightsLoading(true); setInsightsError('');
    try { setInsights(await api('/analytics/overview', { token })); } catch (error) { setInsightsError(error.message); setNotice(error.message); } finally { setInsightsLoading(false); }
  }
  const toggle = async (id) => {
    const task = tasks.find(item => item.id === id); if (!task) return;
    try {
      if (task.kind === 'special') await api(`/tasks/${id}/complete`, { token, method: 'PATCH', body: { completed: !task.done } });
      else await api(`/routines/${id}/progress`, { token, method: 'PATCH', body: task.kind === 'quantity' ? { completedQuantity: task.done ? 0 : task.target } : { completed: !task.done } });
      await loadDashboard(); setNotice(`${task.title} updated`);
    } catch (error) { setNotice(error.message); }
  };
  const increase = async (id) => {
    const task = tasks.find(item => item.id === id); if (!task) return;
    try { await api(`/routines/${id}/progress`, { token, method: 'PATCH', body: { completedQuantity: Math.min(task.target, task.value + 1) } }); await loadDashboard(); setNotice(`${task.title} progress saved`); } catch (error) { setNotice(error.message); }
  };
  const decrease = async (id) => {
    const task = tasks.find(item => item.id === id); if (!task || task.value <= 0) return;
    try { await api(`/routines/${id}/progress`, { token, method: 'PATCH', body: { completedQuantity: Math.max(0, task.value - 1) } }); await loadDashboard(); setNotice(`${task.title} progress saved`); } catch (error) { setNotice(error.message); }
  };
  const createTask = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    try {
      if (form.type === 'special') await api('/tasks', { token, method: 'POST', body: { title: form.title } });
      else await api('/routines', { token, method: 'POST', body: { title: form.title, type: form.type === 'quantity' ? 'QUANTIFIABLE' : form.type === 'temporary' ? 'TEMPORARY' : 'BINARY', category: form.category, targetQuantity: Number(form.target || 1), startDate: new Date().toISOString().slice(0, 10), ...(form.type === 'temporary' ? { endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) } : {}) } });
      setForm({ title: '', type: 'routine', target: '', category: 'OTHER' }); setShowModal(false); await loadDashboard(); if (nav === 'Insights') await loadInsights(); setNotice('Saved to MongoDB');
    } catch (error) { setNotice(error.message); }
  };

  const finishAuthentication = ({ token: newToken, user: newUser }) => { localStorage.setItem('tracker-token', newToken); localStorage.setItem('tracker-user', JSON.stringify(newUser)); setUser(newUser); setToken(newToken); };
  if (!token) return <AuthScreen onAuthenticated={finishAuthentication} />;
  if (nav === 'Overview') return <OverviewPage tasks={tasks} percent={percent} pendingCount={pendingCount} dark={dark} onNavigate={setNav} />;
  if (nav === 'Insights') return <InsightsPage data={insights} loading={insightsLoading} error={insightsError} dark={dark} onBack={() => setNav('Today')} onTheme={() => setDark(!dark)} onNavigate={setNav} />;
  if (nav === 'Routines') return <RoutinesPage tasks={tasks} dark={dark} onBack={() => setNav('Today')} onAdd={() => { setNav('Today'); setShowModal(true); }} />;
  if (nav === 'Calendar') return <CalendarPage data={insights} loading={insightsLoading} error={insightsError} dark={dark} onBack={() => setNav('Today')} />;

  return <main className={dark ? 'app dark' : 'app'}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">✦</span><span>TRACKER</span></div>
      <div className="workspace"><span className="avatar">{user?.name?.slice(0, 2).toUpperCase() || 'ME'}</span><div><b>{user?.name || 'My'}'s space</b><small>Personal</small></div><span className="chevron">⌄</span></div>
      <nav>{['Overview', 'Today', 'Routines', 'Calendar', 'Insights'].map((item, index) => <button key={item} className={nav === item ? 'nav-item active' : 'nav-item'} onClick={() => setNav(item)}><Icon>{['◫', '◷', '◌', '□', '◔'][index]}</Icon>{item}{item === 'Today' && <em>{tasks.length}</em>}</button>)}</nav>
      <div className="nav-section"><span>MANAGE</span><button className="nav-item"><Icon>⊞</Icon>Pending <em className="warm">{pendingCount}</em></button><button className="nav-item"><Icon>♙</Icon>Archive</button></div>
      <div className="sidebar-foot"><div className="mini-card"><span className="tiny-orb">◉</span><div><b>7 day streak</b><small>You're on fire!</small></div><span>↗</span></div><button className="profile" onClick={() => { localStorage.removeItem('tracker-token'); localStorage.removeItem('tracker-user'); setToken(''); }}><span className="avatar portrait">{user?.name?.slice(0, 1).toUpperCase()}</span><span><b>{user?.name}</b><small>Sign out</small></span><Icon>•••</Icon></button></div>
    </aside>
    <section className="content">
      <header><div className="crumb"><span>{nav}</span><strong>/</strong><b>Today</b></div><div className="head-actions"><button aria-label="Toggle theme" className="round-button" onClick={() => setDark(!dark)}>{dark ? '☀' : '☾'}</button><button className="round-button">⌕</button><button className="round-button bell">♧<i /></button></div></header>
      <div className="hero"><div><p className="eyebrow">{formattedDate}</p><h1>Make today count<span>.</span></h1><p className="subtitle">Small promises, kept consistently, become your story.</p></div><div className="live-time"><span className="pulse" />{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<small>LIVE</small></div></div>
      <section className="dashboard-grid">
        <article className="score-card"><div className="card-heading"><span>DAILY SCORE</span><button>•••</button></div><div className="score-content"><Circle value={percent}/><div className="score-copy"><p>{tasks.length ? 'Today’s progress is saved.' : 'Add your first routine to begin.'}</p><b>{completed} of {tasks.length} complete</b><div className="mini-progress"><i style={{ width: `${percent}%` }}/></div><small>Calculated from today’s saved tasks only.</small></div></div></article>
        <article className="focus-card"><div><p className="eyebrow">TODAY'S MOMENTUM</p><h2>{completed} / {tasks.length}</h2><span>saved items completed today</span></div><div className="focus-art"><i/><i/><i/><b>✦</b></div><button onClick={() => setNav('Insights')}>Open insights <span>→</span></button></article>
      </section>
      <section className="today-header"><div><p className="eyebrow">YOUR DAY {loading && '· SAVING'}</p><h2>Today’s rhythm</h2></div><button className="add-button" onClick={() => setShowModal(true)}><b>＋</b> Add routine</button></section>
      <section className="task-layout"><div className="task-list"><div className="list-title"><span>IN PROGRESS <b>{tasks.filter(t => !t.done).length}</b></span><button>⌄</button></div>{tasks.map(task => <article className={`task-card ${task.done ? 'done' : ''} ${task.kind === 'temporary' ? 'temporary' : ''}`} key={task.id}><button className={`check ${task.done ? 'checked' : ''}`} onClick={() => toggle(task.id)} aria-label={`Mark ${task.title} done`}>{task.done && '✓'}</button><div className={`task-icon ${task.color}`}><Icon>{task.icon}</Icon></div><div className="task-info"><h3>{task.title}{task.kind === 'temporary' && <span className="tag">TEMPORARY</span>}</h3><p>{task.note}</p>{task.kind === 'quantity' && <div className="quantity-progress"><i style={{width: `${task.value / task.target * 100}%`}}/><span>{task.value}/{task.target}</span></div>}</div>{task.kind === 'quantity' ? <div className="count-controls"><button className="count-button subtract" onClick={() => decrease(task.id)} disabled={task.value <= 0}>− 1</button><button className="count-button" onClick={() => increase(task.id)} disabled={task.value >= task.target}>+ 1</button></div> : <button className="more">•••</button>}</article>)}</div>
        <aside className="right-rail"><article className="streak-card real-data-card"><div className="flame">◌</div><div><p className="eyebrow">HISTORY</p><h3>Real <span>data only</span></h3><p>Your streaks and trends appear after you complete routines on different days.</p></div><button className="insight-link" onClick={() => setNav('Insights')}>View progress →</button></article></aside>
      </section>
    </section>
    {notice && <div className="toast"><span>✓</span>{notice}</div>}
    {showModal && <div className="modal-backdrop" onMouseDown={() => setShowModal(false)}><form className="modal" onSubmit={createTask} onMouseDown={e => e.stopPropagation()}><button type="button" className="close" onClick={() => setShowModal(false)}>×</button><p className="eyebrow">NEW INTENTION</p><h2>Add to your rhythm</h2><label>What will you do?<input autoFocus value={form.title} onChange={e => setForm({...form, title:e.target.value})} placeholder="e.g. Practice guitar" /></label><label>Type<select value={form.type} onChange={e => setForm({...form, type:e.target.value})}><option value="routine">Daily routine</option><option value="quantity">Quantifiable habit</option><option value="temporary">Temporary goal</option><option value="special">Special task for today</option></select></label>{form.type !== 'special' && <label>Category<select value={form.category} onChange={e => setForm({...form, category:e.target.value})}><option value="STUDY">Study</option><option value="HYGIENE">Hygiene</option><option value="WORKOUT">Workout</option><option value="HEALTH">Health</option><option value="PERSONAL">Personal</option><option value="OTHER">Other</option></select></label>}{form.type === 'quantity' && <label>Daily target<input type="number" min="1" value={form.target} onChange={e => setForm({...form, target:e.target.value})} placeholder="e.g. 20" /></label>}<button className="create" type="submit">{form.type === 'special' ? 'Create task' : 'Create routine'} <span>→</span></button></form></div>}
  </main>;
}

function WorkspaceLinks({ active, onNavigate }) {
  return <nav className="workspace-links" aria-label="Tracker pages">{['Overview', 'Today', 'Routines', 'Calendar', 'Insights'].map(item => <button key={item} className={active === item ? 'selected' : ''} onClick={() => onNavigate(item)}>{item}</button>)}</nav>;
}

function OverviewPage({ tasks, percent, pendingCount, dark, onNavigate }) {
  const routines = tasks.filter(task => task.kind !== 'special'); const special = tasks.filter(task => task.kind === 'special');
  return <main className={dark ? 'workspace-page dark' : 'workspace-page'}><WorkspaceLinks active="Overview" onNavigate={onNavigate}/><header className="workspace-heading"><div><p className="eyebrow">TRACKER OVERVIEW</p><h1>Your real progress<span>.</span></h1><p>Everything below comes from today’s saved records.</p></div><button className="add-button" onClick={() => onNavigate('Today')}>Open today →</button></header><section className="overview-metrics"><article><span>DAILY SCORE</span><strong>{percent}%</strong><small>{tasks.length} planned item{tasks.length === 1 ? '' : 's'} today</small></article><article><span>ROUTINES</span><strong>{routines.filter(task => task.done).length} / {routines.length}</strong><small>completed routine records</small></article><article><span>SPECIAL TASKS</span><strong>{special.filter(task => task.done).length} / {special.length}</strong><small>completed for today</small></article><article><span>PENDING</span><strong>{pendingCount}</strong><small>tasks waiting to be rescheduled</small></article></section><section className="overview-actions"><button onClick={() => onNavigate('Today')}><b>Today</b><span>Check off, add, or update today’s routines →</span></button><button onClick={() => onNavigate('Routines')}><b>Routines</b><span>See every active routine and its category →</span></button><button onClick={() => onNavigate('Calendar')}><b>Calendar</b><span>Review real completion scores by date →</span></button><button onClick={() => onNavigate('Insights')}><b>Insights</b><span>Explore consistency since day one →</span></button></section></main>;
}

function RoutinesPage({ tasks, dark, onBack, onAdd }) {
  const routines = tasks.filter(task => task.kind !== 'special');
  return <main className={dark ? 'workspace-page dark' : 'workspace-page'}><header className="workspace-heading"><div><button className="back-button" onClick={onBack}>← Today</button><p className="eyebrow page-eyebrow">ROUTINE LIBRARY</p><h1>Your active routines<span>.</span></h1><p>Progress shown is saved for today, not sample data.</p></div><button className="add-button" onClick={onAdd}>＋ Add routine</button></header>{routines.length ? <section className="routine-library">{routines.map(task => <article key={task.id}><div className={`task-icon ${task.color}`}><Icon>{task.icon}</Icon></div><div><h2>{task.title}</h2><p>{task.note}</p>{task.kind === 'quantity' && <div className="library-progress"><i style={{ width: `${task.target ? task.value / task.target * 100 : 0}%` }}/></div>}</div><span className={task.done ? 'routine-state done' : 'routine-state'}>{task.done ? 'Complete' : 'In progress'}</span></article>)}</section> : <section className="analytics-empty"><span>＋</span><p className="eyebrow">NO ROUTINES</p><h2>Start with one promise to yourself.</h2><p>Create a routine and TRACKER will begin its daily record.</p><button className="add-button" onClick={onAdd}>Add routine</button></section>}</main>;
}

function CalendarPage({ data, loading, error, dark, onBack }) {
  const now = new Date(); const year = now.getFullYear(); const month = now.getMonth(); const firstWeekday = new Date(year, month, 1).getDay(); const days = new Date(year, month + 1, 0).getDate();
  const scores = new Map((data?.daily || []).map(day => [day.date, day])); const keyFor = day => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return <main className={dark ? 'workspace-page dark' : 'workspace-page'}><header className="workspace-heading"><div><button className="back-button" onClick={onBack}>← Today</button><p className="eyebrow page-eyebrow">COMPLETION CALENDAR</p><h1>{now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}<span>.</span></h1><p>Each coloured date is calculated from saved routine and task records.</p></div></header>{loading && <p className="insight-loading">Loading saved completion history…</p>}{!loading && error && <section className="analytics-empty"><span>!</span><p className="eyebrow">CALENDAR UNAVAILABLE</p><h2>{error}</h2><button className="add-button" onClick={onBack}>Back to Today</button></section>}{!loading && !error && <section className="calendar-panel"><div className="calendar-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{Array.from({ length: firstWeekday }, (_, index) => <i key={`blank-${index}`}/>) }{Array.from({ length: days }, (_, index) => { const day = index + 1; const record = scores.get(keyFor(day)); const score = record?.score; return <button key={day} className={score === undefined ? 'calendar-day' : score === 100 ? 'calendar-day full' : score >= 60 ? 'calendar-day strong' : score > 0 ? 'calendar-day partial' : 'calendar-day missed'}><b>{day}</b>{score !== undefined && <small>{score}%</small>}</button>; })}</div><div className="calendar-key"><span>No saved record</span><i className="missed"/> <span>0%</span><i className="partial"/> <span>1–59%</span><i className="strong"/> <span>60–99%</span><i className="full"/> <span>100%</span></div></section>}</main>;
}

function MonthlyTrendChart({ monthly }) {
  const values = monthly.slice(-12); const width = 760; const height = 240; const pad = { top: 20, right: 24, bottom: 37, left: 28 }; const max = Math.max(...values.map(item => item.planned), 1); const step = (width - pad.left - pad.right) / Math.max(values.length, 1); const bar = Math.min(26, step * .28);
  const line = values.map((item, index) => `${index ? 'L' : 'M'} ${pad.left + step * index + step / 2} ${height - pad.bottom - item.score / 100 * (height - pad.top - pad.bottom)}`).join(' ');
  return <svg className="reference-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly planned and completed habit actions with completion score line"><defs><linearGradient id="tracker-month-line" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#7164d8"/><stop offset="1" stopColor="#aa9bed"/></linearGradient></defs>{[0,50,100].map(value => <line key={value} x1={pad.left} x2={width-pad.right} y1={height-pad.bottom-value/100*(height-pad.top-pad.bottom)} y2={height-pad.bottom-value/100*(height-pad.top-pad.bottom)} className="chart-grid"/>)}{values.map((item,index) => { const x = pad.left + step * index + step / 2; const plannedHeight = item.planned / max * (height-pad.top-pad.bottom); const completeHeight = item.completed / max * (height-pad.top-pad.bottom); return <g key={item.month}><rect x={x-bar-3} y={height-pad.bottom-plannedHeight} width={bar} height={plannedHeight} rx="4" className="bar-planned"><title>{`${item.month}: ${item.planned} planned actions`}</title></rect><rect x={x+3} y={height-pad.bottom-completeHeight} width={bar} height={completeHeight} rx="4" className="bar-complete"><title>{`${item.month}: ${item.completed} completed actions`}</title></rect><text x={x} y={height-11} textAnchor="middle">{new Date(`${item.month}-01T00:00:00`).toLocaleDateString('en-US',{month:'short'})}</text></g>; })}<path d={line} className="chart-line month-line"/><g className="chart-legend"><circle cx="20" cy="13" r="4" className="bar-planned"/><text x="29" y="17">Planned</text><circle cx="95" cy="13" r="4" className="bar-complete"/><text x="104" y="17">Completed</text><line x1="182" x2="196" y1="13" y2="13" className="chart-line month-line"/><text x="202" y="17">Score</text></g></svg>;
}

function CategoryComparisonChart({ series }) {
  const values = series.slice(0, 4); const width = 760; const height = 240; const inset = 30; const days = Math.max(...values.map(item => item.points.length), 1); const palette = ['#7164d8','#5da6c4','#df8a68','#69a979'];
  const pathFor = points => { let started = false; return points.map((point, index) => { if (point.score === null) { started = false; return ''; } const x = inset + index * ((width-inset*2)/Math.max(days-1,1)); const y = height-inset-point.score/100*(height-inset*2); const command = started ? 'L' : 'M'; started = true; return `${command}${x} ${y}`; }).join(' '); };
  return <svg className="reference-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Category completion comparison over time">{[0,50,100].map(value => <line key={value} x1={inset} x2={width-inset} y1={height-inset-value/100*(height-inset*2)} y2={height-inset-value/100*(height-inset*2)} className="chart-grid"/>)}{values.map((item,index) => <path key={item.category} d={pathFor(item.points.slice(-30))} fill="none" stroke={palette[index]} strokeWidth="3" strokeLinecap="round"><title>{item.category}</title></path>)}<g className="chart-legend">{values.map((item,index) => <g key={item.category} transform={`translate(${index*130}, 0)`}><circle cx="18" cy="13" r="4" fill={palette[index]}/><text x="27" y="17">{item.category.toLowerCase()}</text></g>)}</g></svg>;
}

function VarianceChart({ variance }) {
  const values = variance.slice(-28); const width = 760; const height = 230; const pad = 28; const max = Math.max(...values.map(item => Math.abs(item.value)), 1); const center = height / 2; const step = (width-pad*2)/Math.max(values.length,1); const barWidth = Math.max(3,step*.6);
  return <svg className="reference-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily completion variance against personal average"><line x1={pad} x2={width-pad} y1={center} y2={center} className="variance-zero"/>{values.map((item,index) => { const size = Math.abs(item.value)/max*(height/2-pad); const x = pad+step*index+(step-barWidth)/2; const positive = item.value >= 0; return <rect key={item.date} x={x} y={positive ? center-size : center} width={barWidth} height={size} rx="3" className={positive?'variance-positive':'variance-negative'}><title>{`${item.date}: ${item.value > 0 ? '+' : ''}${item.value} points vs average`}</title></rect>; })}<text x={pad} y={center-7}>Above average</text><text x={pad} y={center+15}>Below average</text></svg>;
}

function InsightsPage({ data, loading, error, dark, onBack, onTheme, onNavigate }) {
  const daily = data?.daily || [];
  const plotted = daily.slice(-60);
  const chartWidth = 860; const chartHeight = 245; const inset = 30;
  const points = plotted.map((day, index) => ({ x: inset + index * ((chartWidth - inset * 2) / Math.max(plotted.length - 1, 1)), y: chartHeight - inset - day.score / 100 * (chartHeight - inset * 2), ...day }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = points.length ? `${line} L ${points.at(-1).x} ${chartHeight - inset} L ${points[0].x} ${chartHeight - inset} Z` : '';
  const labelDate = value => new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return <main className={dark ? 'insights-page analytics-gold dark' : 'insights-page analytics-gold'}>
    <header className="insights-header"><button className="back-button" onClick={onBack}>← Today</button><div><p className="eyebrow">TRACKER ANALYTICS</p><h1>Consistency, clearly seen<span>.</span></h1></div><button className="round-button" aria-label="Toggle theme" onClick={onTheme}>{dark ? '☀' : '☾'}</button></header>
    {loading && <p className="insight-loading">Loading the records saved in MongoDB…</p>}
    {!loading && error && <section className="analytics-empty"><span>!</span><p className="eyebrow">ANALYTICS UNAVAILABLE</p><h2>The saved-history service could not be reached.</h2><p>{error}</p><button className="add-button" onClick={onBack}>Back to Today</button></section>}
    {!loading && !error && data?.empty && <section className="analytics-empty"><span>◌</span><p className="eyebrow">NO HISTORY YET</p><h2>Your first chart starts with your first completed routine.</h2><p>TRACKER will calculate this page from daily records only—never from sample data.</p><button className="add-button" onClick={onBack}>Add a routine</button></section>}
    {!loading && data && !data.empty && <><section className="insight-stats"><article><span>AVERAGE COMPLETION</span><strong>{data.summary.average}%</strong><small>across {data.summary.activeDays} active days</small></article><article><span>CURRENT STREAK</span><strong>{data.summary.currentStreak}<b> days</b></strong><small>fully completed days in a row</small></article><article><span>BEST STREAK</span><strong>{data.summary.bestStreak}<b> days</b></strong><small>your longest completed run</small></article></section>
      <section className="reference-grid"><article className="reference-card"><div className="chart-top"><div><p className="eyebrow">MONTHLY COMPLETION TREND</p><h2>Planned versus completed</h2></div><span>All saved months</span></div><MonthlyTrendChart monthly={data.monthly}/></article><article className="reference-card"><div className="chart-top"><div><p className="eyebrow">CATEGORY COMPARISON</p><h2>Habit areas over time</h2></div><span>Last 30 records</span></div><CategoryComparisonChart series={data.categorySeries}/></article></section>
      <section className="line-chart-section"><div className="chart-top"><div><p className="eyebrow">DAY-BY-DAY CONSISTENCY</p><h2>Your completion arc</h2></div><span>Since {labelDate(daily[0].date)}</span></div><svg className="consistency-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Daily completion percentage since tracking began"><defs><linearGradient id="tracker-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#7164d8" stopOpacity=".38"/><stop offset="100%" stopColor="#7164d8" stopOpacity="0"/></linearGradient></defs>{[0,25,50,75,100].map(value => <g key={value}><line x1={inset} x2={chartWidth-inset} y1={chartHeight-inset-value/100*(chartHeight-inset*2)} y2={chartHeight-inset-value/100*(chartHeight-inset*2)} className="chart-grid"/><text x="0" y={chartHeight-inset-value/100*(chartHeight-inset*2)+4}>{value}%</text></g>)}<path d={area} fill="url(#tracker-area)"/><path d={line} className="chart-line"/>{points.filter((_, index) => index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 5) === 0).map(point => <g key={point.date}><circle cx={point.x} cy={point.y} r="4" className="chart-dot"><title>{`${labelDate(point.date)}: ${point.score}%`}</title></circle><text x={point.x} y={chartHeight-6} textAnchor="middle">{labelDate(point.date)}</text></g>)}</svg></section>
      <section className="insight-grid"><article className="category-panel"><p className="eyebrow">ROUTINE KPIS</p><h2>Where your consistency lives</h2>{data.categories.map(item => <div className="category-row" key={item.category}><div><b>{item.category.toLowerCase()}</b><small>{item.routines} routine{item.routines === 1 ? '' : 's'}</small></div><div className="category-bar"><i style={{ width: `${item.score}%` }}/></div><strong>{item.score}%</strong></div>)}</article><article className="heatmap-panel"><p className="eyebrow">RECENT ACTIVITY</p><h2>Your commitment map</h2><div className="heatmap" aria-label="Last 84 days of completion history">{data.heatmap.map(day => <span key={day.date} className={!day.active ? 'heat-none' : day.score === 100 ? 'heat-full' : day.score >= 60 ? 'heat-high' : day.score > 0 ? 'heat-some' : 'heat-empty'} title={`${labelDate(day.date)}: ${day.active ? `${day.score}%` : 'No routines planned'}`}/>)}</div><div className="heat-legend"><span>Less</span><i className="heat-none"/><i className="heat-some"/><i className="heat-high"/><i className="heat-full"/><span>More</span></div></article></section>
      <section className="variance-card"><div className="chart-top"><div><p className="eyebrow">DAILY VARIANCE</p><h2>Above or below your own average</h2></div><span>Last 42 active days</span></div><VarianceChart variance={data.variance}/></section>
      <section className="habit-table"><div className="chart-top"><div><p className="eyebrow">HABIT LIBRARY</p><h2>Each routine, since day one</h2></div><span>{data.routines.length} tracked</span></div><div className="habit-table-head"><span>Routine</span><span>Area</span><span>Completion</span><span>Recorded days</span></div>{data.routines.map(routine => <div className="habit-table-row" key={routine.id}><b>{routine.title}</b><span className="habit-category">{routine.category}</span><span><i className="table-bar"><em style={{ width: `${routine.score}%` }}/></i>{routine.score}%</span><span>{routine.days}</span></div>)}</section>
    </>}
  </main>;
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('register'); const [form, setForm] = useState({ name: '', email: '', password: '' }); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async event => { event.preventDefault(); setBusy(true); setError(''); try { onAuthenticated(await api(`/auth/${mode}`, { method: 'POST', body: mode === 'register' ? form : { email: form.email, password: form.password } })); } catch (issue) { setError(issue.message); } finally { setBusy(false); } };
  return <main className="auth-page"><section className="auth-copy"><div className="brand"><span className="brand-mark">✦</span><span>TRACKER</span></div><p className="eyebrow">YOUR PERSONAL RHYTHM</p><h1>Build a life you<br/>want to repeat<span>.</span></h1><p>Every intention, completion, and progress update is securely saved to your private MongoDB account.</p><div className="auth-track"><i/><i/><i/><b>✦</b></div></section><form className="auth-card" onSubmit={submit}><p className="eyebrow">WELCOME TO TRACKER</p><h2>{mode === 'register' ? 'Start your journey' : 'Welcome back'}</h2><p className="auth-sub">{mode === 'register' ? 'Create an account to save your routines.' : 'Sign in to continue your rhythm.'}</p>{mode === 'register' && <label>Name<input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Your name" /></label>}<label>Email<input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="you@example.com" /></label><label>Password<input required minLength="8" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="At least 8 characters" /></label>{error && <p className="auth-error">{error}</p>}<button className="create" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create my account →' : 'Sign in →'}</button><p className="switch-auth">{mode === 'register' ? 'Already have an account?' : 'New to TRACKER?'} <button type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>{mode === 'register' ? 'Sign in' : 'Create one'}</button></p></form></main>;
}
