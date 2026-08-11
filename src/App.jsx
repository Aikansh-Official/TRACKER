import { useEffect, useMemo, useState } from 'react';
import ProductivityStudio from './ProductivityStudio.jsx';
import { api, localDateKey } from './api.js';

const initialTasks = [];
const pageNames = ['Overview', 'Plan', 'Today', 'Routines', 'Mood', 'Calendar', 'Insights', 'Pending', 'Archive'];
const isTaskComplete = task => task.done || (task.kind === 'quantity' && task.value >= task.target);

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
  const [moodData, setMoodData] = useState(null);
  const [moodEntry, setMoodEntry] = useState(null);
  const [moodLoading, setMoodLoading] = useState(false);
  const [allRoutines, setAllRoutines] = useState([]);
  const [allSpecialTasks, setAllSpecialTasks] = useState([]);
  const [now, setNow] = useState(new Date());
  const [dark, setDark] = useState(() => localStorage.getItem('tracker-theme') === 'dark');
  const [showModal, setShowModal] = useState(false);
  const [notice, setNotice] = useState('');
  const [celebration, setCelebration] = useState(null);
  const [nav, setNav] = useState(() => { const saved = window.location.hash.slice(1); return pageNames.includes(saved) ? saved : 'Overview'; });
  const [form, setForm] = useState({ title: '', description: '', type: 'routine', target: '', unit: 'times', category: 'OTHER', endDate: '', priority: 'MEDIUM', deadline: '', frequency: 'DAILY', scheduledDays: [], weeklyTarget: 3, estimate: 25, preferredTime: '', minimumTarget: 1, stretchTarget: '' });
  const [formError, setFormError] = useState('');

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 2600); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    if (!celebration) return undefined;
    const timer = setTimeout(() => setCelebration(null), celebration.kind === 'day' ? 5200 : 2400);
    return () => clearTimeout(timer);
  }, [celebration]);
  useEffect(() => { if (token) { loadDashboard(); loadLibrary(); loadInsights(); loadMood(); } }, [token]);
  useEffect(() => { if (token && (nav === 'Insights' || nav === 'Calendar')) loadInsights(); }, [token, nav]);
  useEffect(() => { if (token && nav === 'Mood') loadMood(); }, [token, nav]);
  useEffect(() => { window.location.hash = nav; }, [nav]);
  useEffect(() => { const syncPage = () => { const page = window.location.hash.slice(1); if (pageNames.includes(page)) setNav(page); }; window.addEventListener('hashchange', syncPage); return () => window.removeEventListener('hashchange', syncPage); }, []);
  useEffect(() => { localStorage.setItem('tracker-theme', dark ? 'dark' : 'light'); document.documentElement.style.colorScheme = dark ? 'dark' : 'light'; }, [dark]);
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); }, [nav]);
  useEffect(() => {
    if (!showModal) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = event => { if (event.key === 'Escape') setShowModal(false); };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', closeOnEscape); };
  }, [showModal]);
  const percent = useMemo(() => tasks.length ? Math.round(tasks.reduce((total, task) => total + (task.kind === 'quantity' ? task.value / task.target : task.done ? 1 : 0), 0) / tasks.length * 100) : 0, [tasks]);
  const completed = tasks.filter(isTaskComplete).length;
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
  async function loadLibrary() {
    try {
      const [routinePayload, taskPayload] = await Promise.all([api('/routines', { token }), api('/tasks', { token })]);
      setAllRoutines(routinePayload.routines); setAllSpecialTasks(taskPayload.tasks);
    } catch (error) { setNotice(error.message); }
  }
  async function loadInsights() {
    setInsightsLoading(true); setInsightsError('');
    try { setInsights(await api('/analytics/overview', { token })); } catch (error) { setInsightsError(error.message); setNotice(error.message); } finally { setInsightsLoading(false); }
  }
  async function loadMood() {
    setMoodLoading(true);
    try {
      const today = localDateKey();
      const [analytics, current] = await Promise.all([api('/moods/analytics/overview', { token }), api(`/moods?from=${today}&to=${today}`, { token })]);
      setMoodData(analytics); setMoodEntry(current.entries[0] || null);
    } catch (error) { setNotice(error.message); } finally { setMoodLoading(false); }
  }
  const toggle = async (id) => {
    const task = tasks.find(item => item.id === id); if (!task) return;
    const completing = !isTaskComplete(task);
    const completesDay = completing && tasks.length > 0 && tasks.filter(item => !isTaskComplete(item)).length === 1;
    try {
      if (task.kind === 'special') await api(`/tasks/${id}/complete`, { token, method: 'PATCH', body: { completed: !task.done } });
      else await api(`/routines/${id}/progress`, { token, method: 'PATCH', body: task.kind === 'quantity' ? { completedQuantity: task.done ? 0 : task.target } : { completed: !task.done } });
      await loadDashboard();
      if (completing) setCelebration({ id: Date.now(), kind: completesDay ? 'day' : 'task', title: task.title });
      setNotice(`${task.title} updated`);
    } catch (error) { setNotice(error.message); }
  };
  const increase = async (id) => {
    const task = tasks.find(item => item.id === id); if (!task) return;
    const completing = task.value < task.target && task.value + 1 >= task.target;
    const completesDay = completing && tasks.length > 0 && tasks.filter(item => !isTaskComplete(item)).length === 1;
    try { await api(`/routines/${id}/progress`, { token, method: 'PATCH', body: { completedQuantity: Math.min(task.target, task.value + 1) } }); await loadDashboard(); if (completing) setCelebration({ id: Date.now(), kind: completesDay ? 'day' : 'task', title: task.title }); setNotice(`${task.title} progress saved`); } catch (error) { setNotice(error.message); }
  };
  const decrease = async (id) => {
    const task = tasks.find(item => item.id === id); if (!task || task.value <= 0) return;
    try { await api(`/routines/${id}/progress`, { token, method: 'PATCH', body: { completedQuantity: Math.max(0, task.value - 1) } }); await loadDashboard(); setNotice(`${task.title} progress saved`); } catch (error) { setNotice(error.message); }
  };
  const createTask = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!form.title.trim()) { setFormError('Give this intention a clear name.'); return; }
    if (form.type === 'quantity' && Number(form.target) < 1) { setFormError('Choose a daily target of at least 1.'); return; }
    if (form.type === 'temporary' && !form.endDate) { setFormError('Choose when this temporary goal should end.'); return; }
    try {
      if (form.type === 'special') await api('/tasks', { token, method: 'POST', body: { title: form.title, description: form.description, priority: form.priority, deadline: form.deadline || null, estimatedMinutes: Number(form.estimate || 30), preferredTime: form.preferredTime || null } });
      else await api('/routines', { token, method: 'POST', body: { title: form.title, description: form.description, type: form.type === 'quantity' ? 'QUANTIFIABLE' : form.type === 'temporary' ? 'TEMPORARY' : 'BINARY', category: form.category, targetQuantity: Number(form.target || 1), unit: form.unit || 'times', frequency: form.frequency, scheduledDays: form.scheduledDays, weeklyTarget: Number(form.weeklyTarget || 3), estimatedMinutes: Number(form.estimate || 25), preferredTime: form.preferredTime || null, minimumTarget: Number(form.minimumTarget || 1), stretchTarget: Number(form.stretchTarget || form.target || 1), startDate: localDateKey(), ...(form.type === 'temporary' ? { endDate: form.endDate } : {}) } });
      setForm({ title: '', description: '', type: 'routine', target: '', unit: 'times', category: 'OTHER', endDate: '', priority: 'MEDIUM', deadline: '', frequency: 'DAILY', scheduledDays: [], weeklyTarget: 3, estimate: 25, preferredTime: '', minimumTarget: 1, stretchTarget: '' }); setShowModal(false); await Promise.all([loadDashboard(), loadLibrary()]); if (nav === 'Insights') await loadInsights(); setNotice('Saved to MongoDB');
    } catch (error) { setNotice(error.message); }
  };

  const archiveRoutine = async id => { try { await api(`/routines/${id}/archive`, { token, method: 'POST' }); await Promise.all([loadDashboard(), loadLibrary(), loadInsights()]); setNotice('Routine archived'); } catch (error) { setNotice(error.message); } };
  const restoreRoutine = async id => { try { await api(`/routines/${id}/restore`, { token, method: 'POST' }); await Promise.all([loadDashboard(), loadLibrary(), loadInsights()]); setNotice('Routine restored to your active rhythm'); } catch (error) { setNotice(error.message); } };
  const movePendingToToday = async id => { try { await api('/tasks/move-to-today', { token, method: 'PATCH', body: { ids: [id] } }); await Promise.all([loadDashboard(), loadLibrary()]); setNotice('Task moved to Today'); } catch (error) { setNotice(error.message); } };
  const saveMood = async values => { try { await api(`/moods/${localDateKey()}`, { token, method: 'PUT', body: values }); await loadMood(); setNotice('Mood check-in saved to MongoDB'); return true; } catch (error) { setNotice(error.message); return false; } };

  const finishAuthentication = ({ token: newToken, user: newUser }) => { localStorage.setItem('tracker-token', newToken); localStorage.setItem('tracker-user', JSON.stringify(newUser)); setUser(newUser); setToken(newToken); setNav('Overview'); };
  if (!token) return <AuthScreen onAuthenticated={finishAuthentication} />;
  const openComposer = () => { setFormError(''); setShowModal(true); };
  const signOut = () => {
    localStorage.removeItem('tracker-token');
    localStorage.removeItem('tracker-user');
    setUser(null);
    setToken('');
    window.history.replaceState(null, '', window.location.pathname);
    window.location.reload();
  };
  const modal = showModal && <RoutineComposer form={form} setForm={setForm} error={formError} dark={dark} onSubmit={createTask} onClose={() => setShowModal(false)} />;
  const overlays = page => <>{page}<MobileDock active={nav} onNavigate={setNav}/>{notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}{modal}</>;
  if (nav === 'Overview') return overlays(<OverviewPage tasks={tasks} percent={percent} pendingCount={pendingCount} archivedCount={allRoutines.filter(routine => routine.status === 'ARCHIVED').length} moodData={moodData} dark={dark} onNavigate={setNav} onTheme={() => setDark(value => !value)} onSignOut={signOut} />);
  if (nav === 'Plan') return overlays(<ProductivityStudio token={token} dark={dark} onNavigate={setNav} onTheme={() => setDark(value => !value)} notify={setNotice} />);
  if (nav === 'Insights') return overlays(<InsightsPage data={insights} loading={insightsLoading} error={insightsError} dark={dark} onBack={() => setNav('Today')} onTheme={() => setDark(value => !value)} onNavigate={setNav} />);
  if (nav === 'Routines') return overlays(<RoutinesPage tasks={tasks} dark={dark} onNavigate={setNav} onAdd={openComposer} onArchive={archiveRoutine} />);
  if (nav === 'Calendar') return overlays(<CalendarPage data={insights} loading={insightsLoading} error={insightsError} dark={dark} onNavigate={setNav} />);
  if (nav === 'Mood') return overlays(<MoodPage entry={moodEntry} data={moodData} loading={moodLoading} dark={dark} onNavigate={setNav} onSave={saveMood} />);
  if (nav === 'Pending') return overlays(<ManagePage mode="Pending" routines={allRoutines} tasks={allSpecialTasks} dark={dark} onNavigate={setNav} onMove={movePendingToToday} />);
  if (nav === 'Archive') return overlays(<ManagePage mode="Archive" routines={allRoutines} tasks={allSpecialTasks} dark={dark} onNavigate={setNav} onRestore={restoreRoutine} />);

  return <main className={dark ? 'app dark' : 'app'}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">✦</span><span>TRACKER</span></div>
      <div className="workspace"><span className="avatar">{user?.name?.slice(0, 2).toUpperCase() || 'ME'}</span><div><b>{user?.name || 'My'}'s space</b><small>Personal</small></div><span className="chevron">⌄</span></div>
      <nav>{['Overview', 'Plan', 'Today', 'Routines', 'Mood', 'Calendar', 'Insights'].map((item, index) => <button key={item} className={nav === item ? 'nav-item active' : 'nav-item'} onClick={() => setNav(item)}><Icon>{['◫', '✦', '◷', '◌', '☺', '□', '◔'][index]}</Icon>{item}{item === 'Today' && <em>{tasks.length}</em>}</button>)}</nav>
      <div className="nav-section"><span>MANAGE</span><button className="nav-item" onClick={() => setNav('Pending')}><Icon>⊞</Icon>Pending <em className="warm">{pendingCount}</em></button><button className="nav-item" onClick={() => setNav('Archive')}><Icon>♙</Icon>Archive</button></div>
      <div className="sidebar-foot"><button className="mini-card" onClick={() => setNav('Insights')}><span className="tiny-orb">◉</span><div><b>{insights?.summary?.currentStreak || 0} day streak</b><small>{insights?.summary?.activeDays ? 'Calculated from saved history' : 'Your history begins today'}</small></div><span>↗</span></button><button className="profile" onClick={signOut}><span className="avatar portrait">{user?.name?.slice(0, 1).toUpperCase()}</span><span><b>{user?.name}</b><small>Sign out</small></span><Icon>•••</Icon></button></div>
    </aside>
    <section className="content">
      <WorkspaceLinks active="Today" onNavigate={setNav} mobileOnly />
      <header><div className="crumb"><span>Daily workspace</span><strong>/</strong><b>Today</b></div><div className="head-actions"><button className="mood-shortcut" onClick={() => setNav('Mood')}>How are you feeling?</button><button aria-label="Toggle theme" className="round-button" onClick={() => setDark(value => !value)}>{dark ? '☀' : '☾'}</button></div></header>
      <div className="hero"><div><p className="eyebrow">{formattedDate}</p><h1>Make today count<span>.</span></h1><p className="subtitle">Small promises, kept consistently, become your story.</p></div><div className="live-time"><span className="pulse" />{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<small>LIVE</small></div></div>
      <section className="dashboard-grid">
        <article className="score-card"><div className="card-heading"><span>DAILY SCORE</span><span className="live-source">LIVE DATA</span></div><div className="score-content"><Circle value={percent}/><div className="score-copy"><p>{tasks.length ? 'Today’s progress is saved.' : 'Add your first routine to begin.'}</p><b>{completed} of {tasks.length} complete</b><div className="mini-progress"><i style={{ width: `${percent}%` }}/></div><small>Calculated from today’s saved tasks only.</small></div></div></article>
        <article className="focus-card"><div><p className="eyebrow">TODAY'S MOMENTUM</p><h2>{completed} / {tasks.length}</h2><span>saved items completed today</span></div><div className="focus-art"><i/><i/><i/><b>✦</b></div><button onClick={() => setNav('Insights')}>Open insights <span>→</span></button></article>
      </section>
      <section className="today-header"><div><p className="eyebrow">YOUR DAY {loading && '· SAVING'}</p><h2>Today’s rhythm</h2></div><button className="add-button" onClick={openComposer}><b>＋</b> Add intention</button></section>
      <section className="task-layout"><div className="task-list"><div className="list-title"><span>IN PROGRESS <b>{tasks.filter(t => !t.done).length}</b></span><span>{completed} finished</span></div>{tasks.length === 0 && <div className="inline-empty"><b>Your day is still unwritten.</b><span>Add one meaningful intention, then give it your attention.</span></div>}{tasks.map(task => <article className={`task-card ${task.done ? 'done' : ''} ${task.kind === 'temporary' ? 'temporary' : ''}`} key={task.id}><button className={`check ${task.done ? 'checked' : ''}`} onClick={() => toggle(task.id)} aria-label={`Mark ${task.title} ${task.done ? 'not done' : 'done'}`}>{task.done && '✓'}</button><div className={`task-icon ${task.color}`}><Icon>{task.icon}</Icon></div><div className="task-info"><h3>{task.title}{task.kind === 'temporary' && <span className="tag">TEMPORARY</span>}</h3><p>{task.note}</p>{task.kind === 'quantity' && <div className="quantity-progress"><i style={{width: `${task.value / task.target * 100}%`}}/><span>{task.value}/{task.target}</span></div>}</div>{task.kind === 'quantity' && <div className="count-controls"><button className="count-button subtract" onClick={() => decrease(task.id)} disabled={task.value <= 0}>− 1</button><button className="count-button" onClick={() => increase(task.id)} disabled={task.value >= task.target}>+ 1</button></div>}</article>)}</div>
        <aside className="right-rail"><article className="streak-card real-data-card"><div className="flame">◌</div><div><p className="eyebrow">HISTORY</p><h3>Real <span>data only</span></h3><p>Your streaks and trends appear after you complete routines on different days.</p></div><button className="insight-link" onClick={() => setNav('Insights')}>View progress →</button></article></aside>
      </section>
    </section>
    <MobileDock active="Today" onNavigate={setNav}/>
    {celebration && <Celebration key={celebration.id} celebration={celebration}/>}
    {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    {modal}
  </main>;
}

function Celebration({ celebration }) {
  const isDay = celebration.kind === 'day';
  const pieces = useMemo(() => Array.from({ length: isDay ? 72 : 28 }, (_, index) => ({
    id: index,
    x: (index * 37 + 11) % 100,
    delay: (index % 12) * 45,
    duration: 1450 + (index % 7) * 170,
    rotate: (index * 47) % 360,
    color: ['gold', 'cream', 'coral', 'violet', 'mint'][index % 5]
  })), [isDay]);
  return <div className={`celebration ${isDay ? 'day-celebration' : 'task-celebration'}`} role="status" aria-live="polite" aria-label={isDay ? 'All tasks complete. Day complete.' : `${celebration.title} complete.`}>
    <div className="celebration-shade"/>
    <div className="firework firework-one"><i/><i/><i/><i/><i/><i/><i/><i/></div>
    <div className="firework firework-two"><i/><i/><i/><i/><i/><i/><i/><i/></div>
    {isDay && <div className="firework firework-three"><i/><i/><i/><i/><i/><i/><i/><i/></div>}
    <div className="confetti-field" aria-hidden="true">{pieces.map(piece => <i key={piece.id} className={`confetti-piece ${piece.color}`} style={{ '--x': `${piece.x}vw`, '--delay': `${piece.delay}ms`, '--duration': `${piece.duration}ms`, '--rotate': `${piece.rotate}deg` }}/>)}</div>
    <div className="celebration-message"><span>{isDay ? '✦ DAY COMPLETE ✦' : '✓ COMPLETE'}</span><h2>{isDay ? 'You kept every promise today.' : celebration.title}</h2><p>{isDay ? 'Pause for a second. This is what consistency feels like.' : 'One meaningful step is now part of your story.'}</p></div>
  </div>;
}

function WorkspaceLinks({ active, onNavigate, mobileOnly = false }) {
  return <nav className={`workspace-links ${mobileOnly ? 'mobile-links' : ''}`} aria-label="Tracker pages">{['Overview', 'Plan', 'Today', 'Routines', 'Mood', 'Calendar', 'Insights'].map(item => <button key={item} className={active === item ? 'selected' : ''} onClick={() => onNavigate(item)}>{item}</button>)}</nav>;
}

function MobileDock({ active, onNavigate }) {
  return <nav className="mobile-dock" aria-label="Mobile tracker pages">{[['Overview','⌂'],['Plan','✦'],['Today','✓'],['Routines','◌'],['Mood','☺'],['Calendar','□'],['Insights','↗']].map(([item, icon]) => <button key={item} className={active === item ? 'selected' : ''} onClick={() => onNavigate(item)}><span>{icon}</span>{item}</button>)}</nav>;
}

function OverviewPage({ tasks, percent, pendingCount, archivedCount, moodData, dark, onNavigate, onTheme, onSignOut }) {
  const routines = tasks.filter(task => task.kind !== 'special'); const special = tasks.filter(task => task.kind === 'special');
  const todayMood = moodData?.entries?.find(item => item.date === localDateKey());
  return <main className={dark ? 'workspace-page dark' : 'workspace-page'}><WorkspaceLinks active="Overview" onNavigate={onNavigate}/><div className="page-utilities"><button aria-label="Toggle theme" className="round-button" onClick={onTheme}>{dark ? '☀' : '☾'}</button><button className="quiet-button" onClick={onSignOut}>Sign out</button></div><header className="workspace-heading overview-hero"><div><p className="eyebrow">TRACKER OVERVIEW · LIVE FROM MONGODB</p><h1>Your day, without the noise<span>.</span></h1><p>Priorities, wellbeing, and progress in one honest workspace.</p></div><button className="add-button" onClick={() => onNavigate('Today')}>Open today →</button></header><section className="overview-metrics"><article><span>DAILY SCORE</span><strong>{percent}%</strong><small>{tasks.length} planned item{tasks.length === 1 ? '' : 's'} today</small></article><article><span>ROUTINES</span><strong>{routines.filter(task => task.done).length} / {routines.length}</strong><small>completed routine records</small></article><article><span>MOOD</span><strong>{todayMood ? `${todayMood.mood}/5` : '—'}</strong><small>{todayMood ? 'today’s saved check-in' : 'check in when you are ready'}</small></article><article><span>PENDING</span><strong>{pendingCount}</strong><small>tasks waiting to be rescheduled</small></article></section><section className="overview-actions"><button onClick={() => onNavigate('Today')}><b>Today</b><span>Check off, add, or update today’s intentions →</span></button><button onClick={() => onNavigate('Mood')}><b>Mood studio</b><span>Track energy, stress, focus, sleep, and emotions →</span></button><button onClick={() => onNavigate('Routines')}><b>Routines</b><span>Review the habits shaping your day →</span></button><button onClick={() => onNavigate('Calendar')}><b>Calendar</b><span>Inspect real completion scores by date →</span></button><button onClick={() => onNavigate('Insights')}><b>Insights</b><span>Explore consistency since day one →</span></button><button onClick={() => onNavigate('Pending')}><b>Pending</b><span>Reschedule work that slipped through the day →</span></button><button onClick={() => onNavigate('Archive')}><b>Archive</b><span>{archivedCount ? `${archivedCount} saved routine${archivedCount === 1 ? '' : 's'} · restore whenever you need →` : 'Keep retired routines without losing their history →'}</span></button></section></main>;
}

function RoutinesPage({ tasks, dark, onNavigate, onAdd, onArchive }) {
  const routines = tasks.filter(task => task.kind !== 'special');
  return <main className={dark ? 'workspace-page dark' : 'workspace-page'}><WorkspaceLinks active="Routines" onNavigate={onNavigate}/><header className="workspace-heading"><div><p className="eyebrow">ROUTINE LIBRARY</p><h1>Your active routines<span>.</span></h1><p>Progress shown is saved for today, not sample data.</p></div><button className="add-button" onClick={onAdd}>＋ Add intention</button></header>{routines.length ? <section className="routine-library">{routines.map(task => <article key={task.id}><div className={`task-icon ${task.color}`}><Icon>{task.icon}</Icon></div><div><h2>{task.title}</h2><p>{task.note}</p>{task.kind === 'quantity' && <div className="library-progress"><i style={{ width: `${task.target ? task.value / task.target * 100 : 0}%` }}/></div>}</div><span className={task.done ? 'routine-state done' : 'routine-state'}>{task.done ? 'Complete today' : 'In progress'}</span><button className="routine-action" onClick={() => onArchive(task.id)} aria-label={`Archive ${task.title}`}>Archive</button></article>)}</section> : <section className="analytics-empty"><span>＋</span><p className="eyebrow">NO ROUTINES</p><h2>Start with one promise to yourself.</h2><p>Create a routine and TRACKER will begin its daily record.</p><button className="add-button" onClick={onAdd}>Add routine</button></section>}</main>;
}

function CalendarPage({ data, loading, error, dark, onNavigate }) {
  const [selectedDate, setSelectedDate] = useState(localDateKey());
  const [viewDate, setViewDate] = useState(() => new Date());
  const today = new Date();
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const scores = new Map((data?.daily || []).map(day => [day.date, day]));
  const keyFor = day => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const selected = scores.get(selectedDate);
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const changeMonth = amount => {
    const next = new Date(year, month + amount, 1);
    setViewDate(next);
    setSelectedDate(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`);
  };
  return <main className={dark ? 'workspace-page dark' : 'workspace-page'}><WorkspaceLinks active="Calendar" onNavigate={onNavigate}/><header className="workspace-heading calendar-heading"><div><p className="eyebrow">COMPLETION CALENDAR</p><h1>{viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}<span>.</span></h1><p>Select a day to inspect exactly what was recorded.</p></div><div className="calendar-month-nav"><button aria-label="Previous month" onClick={() => changeMonth(-1)}>←</button><button onClick={() => { setViewDate(new Date()); setSelectedDate(localDateKey()); }} disabled={isCurrentMonth}>Today</button><button aria-label="Next month" onClick={() => changeMonth(1)} disabled={isCurrentMonth}>→</button></div></header>{loading && <p className="insight-loading">Loading saved completion history…</p>}{!loading && error && <section className="analytics-empty"><span>!</span><p className="eyebrow">CALENDAR UNAVAILABLE</p><h2>{error}</h2><button className="add-button" onClick={() => onNavigate('Today')}>Back to Today</button></section>}{!loading && !error && <section className="calendar-layout"><div className="calendar-panel"><div className="calendar-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{Array.from({ length: firstWeekday }, (_, index) => <i key={`blank-${index}`}/>) }{Array.from({ length: days }, (_, index) => { const day = index + 1; const date = keyFor(day); const record = scores.get(date); const score = record?.score; return <button key={day} aria-label={`${new Date(`${date}T00:00:00`).toLocaleDateString('en-US',{month:'long',day:'numeric'})}${score === undefined ? ', no saved record' : `, ${score}% complete`}`} aria-pressed={selectedDate === date} onClick={() => setSelectedDate(date)} className={`${score === undefined ? 'calendar-day' : score === 100 ? 'calendar-day full' : score >= 60 ? 'calendar-day strong' : score > 0 ? 'calendar-day partial' : 'calendar-day missed'} ${selectedDate === date ? 'selected' : ''}`}><b>{day}</b>{score !== undefined && <small>{score}%</small>}</button>; })}</div><div className="calendar-key"><span>No saved record</span><i className="missed"/> <span>0%</span><i className="partial"/> <span>1–59%</span><i className="strong"/> <span>60–99%</span><i className="full"/> <span>100%</span></div></div><aside className="day-detail"><p className="eyebrow">SELECTED DAY</p><h2>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</h2>{selected ? <><strong>{selected.score}%</strong><span>completion score</span><dl><div><dt>Planned</dt><dd>{selected.planned}</dd></div><div><dt>Routine records</dt><dd>{selected.routines}</dd></div><div><dt>Special tasks</dt><dd>{selected.tasks}</dd></div></dl></> : <div className="day-empty">No routine or task record was saved for this date.</div>}</aside></section>}</main>;
}

function RoutineComposer({ form, setForm, error, dark, onSubmit, onClose }) {
  return <div className={`modal-backdrop ${dark ? 'dark' : ''}`} onMouseDown={onClose}><form className="modal intention-modal" onSubmit={onSubmit} onMouseDown={event => event.stopPropagation()}><button type="button" className="close" aria-label="Close intention form" onClick={onClose}>×</button><p className="eyebrow">NEW INTENTION</p><h2>Add to your rhythm</h2><p className="modal-intro">Make it specific enough that tonight-you will know whether it happened.</p><label>What will you do?<input required autoFocus value={form.title} onChange={event => setForm({...form, title:event.target.value})} placeholder="e.g. Review algorithms for 45 minutes" /></label><label>What does success look like? <span>optional</span><textarea value={form.description} onChange={event => setForm({...form, description:event.target.value})} placeholder="A short note for your future self" /></label><div className="form-grid"><label>Type<select value={form.type} onChange={event => setForm({...form, type:event.target.value})}><option value="routine">Daily routine</option><option value="quantity">Quantifiable habit</option><option value="temporary">Temporary goal</option><option value="special">One-off task for today</option></select></label>{form.type !== 'special' && <label>Life area<select value={form.category} onChange={event => setForm({...form, category:event.target.value})}><option value="STUDY">Study</option><option value="HYGIENE">Hygiene</option><option value="WORKOUT">Workout</option><option value="HEALTH">Health</option><option value="PERSONAL">Personal</option><option value="OTHER">Other</option></select></label>}</div>{form.type === 'quantity' && <div className="form-grid"><label>Daily target<input type="number" min="1" required value={form.target} onChange={event => setForm({...form, target:event.target.value})} placeholder="8" /></label><label>Unit<input value={form.unit} onChange={event => setForm({...form, unit:event.target.value})} placeholder="glasses, pages, minutes" /></label></div>}{form.type === 'temporary' && <label>Goal end date<input type="date" min={localDateKey()} required value={form.endDate} onChange={event => setForm({...form, endDate:event.target.value})}/></label>}{form.type === 'special' && <div className="form-grid"><label>Priority<select value={form.priority} onChange={event => setForm({...form, priority:event.target.value})}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></label><label>Deadline <span>optional</span><input type="time" value={form.deadline} onChange={event => setForm({...form, deadline:event.target.value})}/></label></div>}{error && <p className="form-error" role="alert">{error}</p>}<button className="create" type="submit">{form.type === 'special' ? 'Create today’s task' : 'Create routine'} <span>→</span></button></form></div>;
}

const moodChoices = [
  { value: 1, face: '◠', label: 'Rough' }, { value: 2, face: '⌢', label: 'Low' }, { value: 3, face: '—', label: 'Steady' }, { value: 4, face: '⌣', label: 'Good' }, { value: 5, face: '◡', label: 'Great' }
];
const emotionChoices = ['CALM','MOTIVATED','HAPPY','GRATEFUL','ANXIOUS','TIRED','OVERWHELMED','SAD','ANGRY','LONELY'];
const factorChoices = ['STUDY','WORK','HEALTH','RELATIONSHIPS','FINANCES','WEATHER','SLEEP','EXERCISE','SOCIAL','OTHER'];

function MoodTrendChart({ entries }) {
  const values = entries.slice(-30); const width = 820; const height = 260; const pad = { left: 36, right: 20, top: 24, bottom: 38 }; const step = (width - pad.left - pad.right) / Math.max(values.length - 1, 1); const y = value => pad.top + (5 - value) / 4 * (height - pad.top - pad.bottom);
  const path = field => values.map((entry, index) => `${index ? 'L' : 'M'} ${pad.left + index * step} ${y(entry[field])}`).join(' ');
  return <svg className="mood-trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Mood, energy, stress, and focus ratings over saved check-in days">{[1,2,3,4,5].map(value => <g key={value}><line x1={pad.left} x2={width-pad.right} y1={y(value)} y2={y(value)} className="mood-grid"/><text x="8" y={y(value)+4}>{value}</text></g>)}<path d={path('mood')} className="mood-line mood-series"/><path d={path('energy')} className="mood-line energy-series"/><path d={path('stress')} className="mood-line stress-series" strokeDasharray="7 6"/><path d={path('focus')} className="mood-line focus-series" strokeDasharray="2 5"/>{values.map((entry,index) => <g key={entry.date}><circle cx={pad.left+index*step} cy={y(entry.mood)} r="4" className="mood-dot"><title>{`${entry.date}: mood ${entry.mood}, energy ${entry.energy}, stress ${entry.stress}, focus ${entry.focus}`}</title></circle>{(index === 0 || index === values.length-1 || index % Math.ceil(values.length/5) === 0) && <text x={pad.left+index*step} y={height-12} textAnchor="middle">{new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</text>}</g>)}</svg>;
}

function correlationCopy(value, sampleSize, direction) {
  if (sampleSize < 3 || value === null) return `Save ${Math.max(0, 3 - sampleSize)} more comparable check-in${3 - sampleSize === 1 ? '' : 's'} to begin this analysis.`;
  const strength = Math.abs(value) >= .65 ? 'strong' : Math.abs(value) >= .35 ? 'moderate' : 'weak';
  const relationship = value > .08 ? 'moves with' : value < -.08 ? 'moves opposite to' : 'has little linear relationship with';
  return `${direction} ${relationship} routine completion (${strength}, r = ${value}).`;
}

function MoodPage({ entry, data, loading, dark, onNavigate, onSave }) {
  const [checkIn, setCheckIn] = useState({ mood: 3, energy: 3, stress: 3, focus: 3, sleepHours: 7, emotions: [], factors: [], note: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (entry) setCheckIn({ mood: entry.mood, energy: entry.energy, stress: entry.stress, focus: entry.focus, sleepHours: entry.sleepHours, emotions: entry.emotions || [], factors: entry.factors || [], note: entry.note || '' }); }, [entry]);
  const toggleChip = (field, value) => setCheckIn(current => ({ ...current, [field]: current[field].includes(value) ? current[field].filter(item => item !== value) : current[field].length < 5 ? [...current[field], value] : current[field] }));
  const submit = async event => { event.preventDefault(); setSaving(true); try { await onSave(checkIn); } finally { setSaving(false); } };
  const entries = data?.entries || []; const distributionMax = Math.max(...(data?.distribution || []).map(item => item.count), 1); const correlations = data?.correlations;
  return <main className={dark ? 'mood-page dark' : 'mood-page'}><WorkspaceLinks active="Mood" onNavigate={onNavigate}/><header className="mood-heading"><div><p className="eyebrow">MOOD STUDIO · PRIVATE DAILY CHECK-IN</p><h1>Notice the weather<br/>inside you<span>.</span></h1><p>Your mood is not a score to win. It is context—saved beside the work you did.</p></div><div className="mood-orbit" aria-hidden="true"><i/><i/><span>{moodChoices.find(choice => choice.value === checkIn.mood)?.face}</span></div></header><section className="mood-layout"><form className="checkin-card" onSubmit={submit}><div className="section-heading"><div><p className="eyebrow">TODAY</p><h2>{entry ? 'Refine today’s check-in' : 'How does today feel?'}</h2></div><span>{entry ? 'Saved · editable' : 'Not saved yet'}</span></div><div className="mood-choices" role="radiogroup" aria-label="Overall mood">{moodChoices.map(choice => <button type="button" role="radio" aria-checked={checkIn.mood === choice.value} className={checkIn.mood === choice.value ? 'selected' : ''} key={choice.value} onClick={() => setCheckIn({...checkIn, mood:choice.value})}><b>{choice.face}</b><span>{choice.label}</span><small>{choice.value}/5</small></button>)}</div><div className="metric-sliders">{[['energy','Energy'],['stress','Stress'],['focus','Focus']].map(([field,label]) => <label key={field}><span>{label}<b>{checkIn[field]}/5</b></span><input type="range" min="1" max="5" step="1" value={checkIn[field]} onInput={event => { const value = Number(event.currentTarget.value); setCheckIn(current => ({...current,[field]:value})); }}/><small><i>Low</i><i>High</i></small></label>)}<label><span>Sleep last night<b>{checkIn.sleepHours}h</b></span><input type="range" min="0" max="12" step="0.5" value={checkIn.sleepHours} onInput={event => { const value = Number(event.currentTarget.value); setCheckIn(current => ({...current,sleepHours:value})); }}/><small><i>0h</i><i>12h</i></small></label></div><fieldset><legend>Emotions present <span>choose up to five</span></legend><div className="chip-grid">{emotionChoices.map(value => <button type="button" className={checkIn.emotions.includes(value) ? 'selected' : ''} aria-pressed={checkIn.emotions.includes(value)} key={value} onClick={() => toggleChip('emotions',value)}>{value.toLowerCase()}</button>)}</div></fieldset><fieldset><legend>What influenced today? <span>choose up to five</span></legend><div className="chip-grid factors">{factorChoices.map(value => <button type="button" className={checkIn.factors.includes(value) ? 'selected' : ''} aria-pressed={checkIn.factors.includes(value)} key={value} onClick={() => toggleChip('factors',value)}>{value.toLowerCase()}</button>)}</div></fieldset><label className="reflection-label">A sentence for future you <span>{checkIn.note.length}/600</span><textarea maxLength="600" value={checkIn.note} onChange={event => setCheckIn({...checkIn,note:event.target.value})} placeholder="What felt heavy, meaningful, or unexpectedly good?" /></label><button className="save-mood" disabled={saving}>{saving ? 'Saving…' : entry ? 'Update today’s check-in' : 'Save today’s check-in'} <span>→</span></button></form><aside className="mood-summary"><article><p className="eyebrow">YOUR BASELINE</p><strong>{data?.summary?.mood || '—'}</strong><span>average mood / 5</span><div>{data?.summary ? `${data.summary.days} honest check-in${data.summary.days === 1 ? '' : 's'}` : 'Your pattern begins with the first save'}</div></article><article><p className="eyebrow">MIND × MOMENTUM</p><h3>Context, not causation.</h3><p>{correlationCopy(correlations?.moodCompletion, correlations?.sampleSize || 0, 'Mood')}</p><p>{correlationCopy(correlations?.stressCompletion, correlations?.sampleSize || 0, 'Stress')}</p></article></aside></section>{loading && <p className="insight-loading">Loading your private mood history…</p>}{!loading && data && !data.empty && <section className="mood-analytics"><div className="chart-top"><div><p className="eyebrow">WELLBEING TREND</p><h2>Mood, energy, stress, and focus</h2><small>Daily 1–5 ratings · solid gold is mood · gray is energy · dashed is stress · dotted is focus</small></div><span>{entries.length} saved day{entries.length === 1 ? '' : 's'}</span></div>{entries.length >= 2 ? <MoodTrendChart entries={entries}/> : <div className="sparse-chart"><b>One point is a check-in, not yet a trend.</b><span>Return tomorrow and this card will become a real timeline.</span></div>}<div className="mood-chart-grid"><article><p className="eyebrow">MOOD DISTRIBUTION</p><h3>How your days have felt</h3><div className="distribution-bars">{data.distribution.map(item => <div key={item.value}><span>{moodChoices.find(choice => choice.value === item.value)?.label}</span><i><em style={{width:`${item.count/distributionMax*100}%`}}/></i><b>{item.count}</b></div>)}</div></article><article><p className="eyebrow">WEEKDAY PROFILE</p><h3>Average mood by weekday</h3><div className="weekday-bars">{data.weekdays.map(day => <div key={day.label}><span>{day.label}</span><i style={{height:`${day.mood ? day.mood/5*100 : 4}%`}}/><small>{day.mood ?? '—'}</small></div>)}</div></article><article><p className="eyebrow">EMOTIONAL VOCABULARY</p><h3>Most frequent feelings</h3>{data.emotions.length ? <div className="emotion-rank">{data.emotions.slice(0,6).map(item => <div key={item.emotion}><span>{item.emotion.toLowerCase()}</span><b>{item.count}</b></div>)}</div> : <p className="muted-copy">Choose emotion tags in a check-in to build this view.</p>}</article></div><div className="mood-history"><div className="chart-top"><div><p className="eyebrow">RECENT REFLECTIONS</p><h2>The days behind the data</h2></div></div>{entries.slice(-7).reverse().map(item => <article key={item.date}><time>{new Date(`${item.date}T00:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</time><b>{moodChoices.find(choice => choice.value === item.mood)?.label}</b><span>Mood {item.mood} · Energy {item.energy} · Stress {item.stress} · Focus {item.focus}</span><p>{item.note || 'No note saved.'}</p></article>)}</div></section>}</main>;
}

function ManagePage({ mode, routines, tasks, dark, onNavigate, onMove, onRestore }) {
  const isPending = mode === 'Pending'; const items = isPending ? tasks.filter(task => task.status === 'PENDING') : [...routines.filter(routine => routine.status === 'ARCHIVED').map(routine => ({...routine, recordType:'Routine'})), ...tasks.filter(task => task.status === 'ARCHIVED').map(task => ({...task, recordType:'Task'}))];
  return <main className={dark ? 'workspace-page dark' : 'workspace-page'}><WorkspaceLinks active="" onNavigate={onNavigate}/><header className="workspace-heading"><div><p className="eyebrow">{isPending ? 'RESCHEDULE WITH INTENTION' : 'QUIET STORAGE'}</p><h1>{mode}<span>.</span></h1><p>{isPending ? 'Tasks that missed their original day stay here until you decide what happens next.' : 'Archived work remains in MongoDB without cluttering your active day.'}</p></div></header>{items.length ? <section className="manage-list">{items.map(item => <article key={item._id}><div><span>{item.recordType || item.priority?.toLowerCase() || 'task'}</span><h2>{item.title}</h2><p>{item.description || (item.scheduledDate ? `Originally planned for ${item.scheduledDate}` : 'Archived routine')}</p></div><div className="manage-actions">{isPending && <button className="add-button" onClick={() => onMove(item._id)}>Move to Today</button>}{!isPending && item.recordType === 'Routine' && <button className="add-button" onClick={() => onRestore(item._id)}>Restore routine</button>}</div></article>)}</section> : <section className="analytics-empty compact-empty"><span>✓</span><p className="eyebrow">ALL CLEAR</p><h2>{isPending ? 'Nothing is waiting for you.' : 'Your archive is empty.'}</h2><p>{isPending ? 'Anything unfinished from an earlier day will appear here automatically.' : 'Archive routines when they no longer belong in your active rhythm.'}</p><button className="add-button" onClick={() => onNavigate(isPending ? 'Today' : 'Routines')}>{isPending ? 'Back to Today' : 'View routines'}</button></section>}</main>;
}

function MonthlyTrendChart({ monthly }) {
  const values = monthly.slice(-12); const width = 760; const height = 240; const pad = { top: 20, right: 24, bottom: 37, left: 28 }; const max = Math.max(...values.map(item => item.planned), 1); const step = (width - pad.left - pad.right) / Math.max(values.length, 1); const bar = Math.min(26, step * .28);
  const line = values.map((item, index) => `${index ? 'L' : 'M'} ${pad.left + step * index + step / 2} ${height - pad.bottom - item.score / 100 * (height - pad.top - pad.bottom)}`).join(' ');
  return <svg className="reference-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly planned and completed habit actions with completion score line"><defs><linearGradient id="tracker-month-line" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#7164d8"/><stop offset="1" stopColor="#aa9bed"/></linearGradient></defs>{[0,50,100].map(value => <line key={value} x1={pad.left} x2={width-pad.right} y1={height-pad.bottom-value/100*(height-pad.top-pad.bottom)} y2={height-pad.bottom-value/100*(height-pad.top-pad.bottom)} className="chart-grid"/>)}{values.map((item,index) => { const x = pad.left + step * index + step / 2; const plannedHeight = item.planned / max * (height-pad.top-pad.bottom); const completeHeight = item.completed / max * (height-pad.top-pad.bottom); return <g key={item.month}><rect x={x-bar-3} y={height-pad.bottom-plannedHeight} width={bar} height={plannedHeight} rx="4" className="bar-planned"><title>{`${item.month}: ${item.planned} planned actions`}</title></rect><rect x={x+3} y={height-pad.bottom-completeHeight} width={bar} height={completeHeight} rx="4" className="bar-complete"><title>{`${item.month}: ${item.completed} completed actions`}</title></rect><text x={x} y={height-11} textAnchor="middle">{new Date(`${item.month}-01T00:00:00`).toLocaleDateString('en-US',{month:'short'})}</text></g>; })}<path d={line} className="chart-line month-line"/><g className="chart-legend"><circle cx="20" cy="13" r="4" className="bar-planned"/><text x="29" y="17">Planned</text><circle cx="95" cy="13" r="4" className="bar-complete"/><text x="104" y="17">Completed</text><line x1="182" x2="196" y1="13" y2="13" className="chart-line month-line"/><text x="202" y="17">Score</text></g></svg>;
}

function CategoryComparisonChart({ series }) {
  const values = series.slice(0, 4); const width = 760; const height = 240; const inset = 30; const days = Math.max(...values.map(item => item.points.length), 1); const palette = ['#b8892e','#5f5c56','#d4b260','#98938a'];
  const pathFor = points => { let started = false; return points.map((point, index) => { if (point.score === null) { started = false; return ''; } const x = inset + index * ((width-inset*2)/Math.max(days-1,1)); const y = height-inset-point.score/100*(height-inset*2); const command = started ? 'L' : 'M'; started = true; return `${command}${x} ${y}`; }).join(' '); };
  return <svg className="reference-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Category completion comparison over time">{[0,50,100].map(value => <line key={value} x1={inset} x2={width-inset} y1={height-inset-value/100*(height-inset*2)} y2={height-inset-value/100*(height-inset*2)} className="chart-grid"/>)}{values.map((item,index) => <g key={item.category}><path d={pathFor(item.points.slice(-30))} fill="none" stroke={palette[index]} strokeWidth="3" strokeLinecap="round"><title>{item.category}</title></path>{item.points.slice(-30).map((point, pointIndex) => point.score === null ? null : <circle key={point.date} cx={inset + pointIndex * ((width-inset*2)/Math.max(days-1,1))} cy={height-inset-point.score/100*(height-inset*2)} r="4" fill={palette[index]}><title>{`${item.category} ${point.date}: ${point.score}%`}</title></circle>)}</g>)}<g className="chart-legend">{values.map((item,index) => <g key={item.category} transform={`translate(${index*130}, 0)`}><circle cx="18" cy="13" r="4" fill={palette[index]}/><text x="27" y="17">{item.category.toLowerCase()}</text></g>)}</g></svg>;
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
    <WorkspaceLinks active="Insights" onNavigate={onNavigate}/><header className="insights-header"><button className="back-button" onClick={onBack}>← Today</button><div><p className="eyebrow">TRACKER ANALYTICS · SAVED HISTORY ONLY</p><h1>Consistency, clearly seen<span>.</span></h1></div><button className="round-button" aria-label="Toggle theme" onClick={onTheme}>{dark ? '☀' : '☾'}</button></header>
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
  return <main className="auth-page"><section className="auth-copy"><div className="brand"><span className="brand-mark">✦</span><span>TRACKER</span></div><p className="eyebrow">YOUR PERSONAL RHYTHM</p><h1>Build a life you<br/>want to repeat<span>.</span></h1><p>Every intention, completion, and progress update is securely saved to your private MongoDB account.</p><div className="auth-track"><i/><i/><i/><b>✦</b></div></section><form className="auth-card" onSubmit={submit}><p className="eyebrow">WELCOME TO TRACKER</p><h2>{mode === 'register' ? 'Start your journey' : 'Welcome back'}</h2><p className="auth-sub">{mode === 'register' ? 'Create an account to save your routines.' : 'Sign in to continue your rhythm.'}</p>{mode === 'register' && <label>Name<input required autoComplete="name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Your name" /></label>}<label>Email<input required type="email" autoComplete="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="you@example.com" /></label><label>Password<input required minLength="8" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="At least 8 characters" /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="create" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create my account →' : 'Sign in →'}</button><p className="switch-auth">{mode === 'register' ? 'Already have an account?' : 'New to TRACKER?'} <button type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>{mode === 'register' ? 'Sign in' : 'Create one'}</button></p></form></main>;
}
