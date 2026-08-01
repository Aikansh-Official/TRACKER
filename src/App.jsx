import { useEffect, useMemo, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
async function api(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API_URL}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.message || 'Could not save your changes.');
  return payload;
}

const initialTasks = [
  { id: 1, title: 'Morning movement', note: '20 minute flow', kind: 'routine', done: true, icon: '◒', color: 'violet' },
  { id: 2, title: 'Read 20 pages', note: 'Deep Work', kind: 'routine', done: false, icon: '▤', color: 'amber' },
  { id: 3, title: 'Drink water', note: '6 of 8 glasses', kind: 'quantity', value: 6, target: 8, done: false, icon: '◉', color: 'blue' },
  { id: 4, title: 'Build the landing page', note: 'Due today · 5:00 PM', kind: 'special', done: false, icon: '✦', color: 'coral' },
  { id: 5, title: 'Learn Spanish', note: 'Day 12 of 30 · 18 days left', kind: 'temporary', done: true, icon: '⌁', color: 'mint' }
];

function Icon({ children, className = '' }) { return <span className={`icon ${className}`}>{children}</span>; }
function Circle({ value }) { return <div className="progress-ring" style={{ '--progress': `${value * 3.6}deg` }}><div><strong>{value}%</strong><span>complete</span></div></div>; }

export default function App() {
  const [tasks, setTasks] = useState(initialTasks);
  const [token, setToken] = useState(() => localStorage.getItem('orbit-token') || '');
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('orbit-user') || 'null'));
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());
  const [dark, setDark] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [notice, setNotice] = useState('');
  const [nav, setNav] = useState('Overview');
  const [form, setForm] = useState({ title: '', type: 'routine', target: '' });

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 2600); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (token) loadDashboard(); }, [token]);
  const percent = useMemo(() => Math.round(tasks.reduce((total, task) => total + (task.kind === 'quantity' ? task.value / task.target : task.done ? 1 : 0), 0) / tasks.length * 100), [tasks]);
  const completed = tasks.filter(t => t.done || (t.kind === 'quantity' && t.value >= t.target)).length;
  const formattedDate = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  async function loadDashboard() {
    setLoading(true);
    try {
      const dashboard = await api('/dashboard', { token });
      const routineTasks = dashboard.records.map(record => ({ id: record.routineId._id, title: record.routineId.title, note: record.routineId.type === 'QUANTIFIABLE' ? `${record.completedQuantity} of ${record.target} ${record.routineId.unit}` : record.routineId.isTemporary ? `Until ${record.routineId.endDate}` : 'Daily routine', kind: record.routineId.type === 'QUANTIFIABLE' ? 'quantity' : record.routineId.isTemporary ? 'temporary' : 'routine', value: record.completedQuantity, target: record.target, done: record.completed, icon: record.routineId.type === 'QUANTIFIABLE' ? '◉' : record.routineId.isTemporary ? '⌁' : '◒', color: record.routineId.type === 'QUANTIFIABLE' ? 'blue' : record.routineId.isTemporary ? 'mint' : 'violet' }));
      const specialTasks = dashboard.specialTasks.map(task => ({ id: task._id, title: task.title, note: task.deadline ? `Due · ${task.deadline}` : `${task.priority.toLowerCase()} priority`, kind: 'special', done: task.status === 'COMPLETED', icon: '✦', color: 'coral' }));
      setTasks([...routineTasks, ...specialTasks]); setPendingCount(dashboard.pendingCount); setUser(dashboard.user); localStorage.setItem('orbit-user', JSON.stringify(dashboard.user));
    } catch (error) { setNotice(error.message); } finally { setLoading(false); }
  }
  const toggle = async (id) => {
    const task = tasks.find(item => item.id === id); if (!task) return;
    try {
      if (task.kind === 'special') await api(`/tasks/${id}/complete`, { token, method: 'PATCH', body: { completed: !task.done } });
      else await api(`/routines/${id}/progress`, { token, method: 'PATCH', body: task.kind === 'quantity' ? { completedQuantity: task.done ? 0 : task.value } : { completed: !task.done } });
      await loadDashboard(); setNotice(`${task.title} updated`);
    } catch (error) { setNotice(error.message); }
  };
  const increase = async (id) => {
    const task = tasks.find(item => item.id === id); if (!task) return;
    try { await api(`/routines/${id}/progress`, { token, method: 'PATCH', body: { completedQuantity: Math.min(task.target, task.value + 1) } }); await loadDashboard(); setNotice(`${task.title} progress saved`); } catch (error) { setNotice(error.message); }
  };
  const createTask = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    try {
      if (form.type === 'special') await api('/tasks', { token, method: 'POST', body: { title: form.title } });
      else await api('/routines', { token, method: 'POST', body: { title: form.title, type: form.type === 'quantity' ? 'QUANTIFIABLE' : form.type === 'temporary' ? 'TEMPORARY' : 'BINARY', targetQuantity: Number(form.target || 1), startDate: new Date().toISOString().slice(0, 10), ...(form.type === 'temporary' ? { endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) } : {}) } });
      setForm({ title: '', type: 'routine', target: '' }); setShowModal(false); await loadDashboard(); setNotice('Saved to MongoDB');
    } catch (error) { setNotice(error.message); }
  };

  const finishAuthentication = ({ token: newToken, user: newUser }) => { localStorage.setItem('orbit-token', newToken); localStorage.setItem('orbit-user', JSON.stringify(newUser)); setUser(newUser); setToken(newToken); };
  if (!token) return <AuthScreen onAuthenticated={finishAuthentication} />;

  return <main className={dark ? 'app dark' : 'app'}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">✦</span><span>orbit</span></div>
      <div className="workspace"><span className="avatar">{user?.name?.slice(0, 2).toUpperCase() || 'ME'}</span><div><b>{user?.name || 'My'}'s space</b><small>Personal</small></div><span className="chevron">⌄</span></div>
      <nav>{['Overview', 'Today', 'Routines', 'Calendar', 'Insights'].map((item, index) => <button key={item} className={nav === item ? 'nav-item active' : 'nav-item'} onClick={() => setNav(item)}><Icon>{['◫', '◷', '◌', '□', '◔'][index]}</Icon>{item}{item === 'Today' && <em>{tasks.length}</em>}</button>)}</nav>
      <div className="nav-section"><span>MANAGE</span><button className="nav-item"><Icon>⊞</Icon>Pending <em className="warm">{pendingCount}</em></button><button className="nav-item"><Icon>♙</Icon>Archive</button></div>
      <div className="sidebar-foot"><div className="mini-card"><span className="tiny-orb">◉</span><div><b>7 day streak</b><small>You're on fire!</small></div><span>↗</span></div><button className="profile" onClick={() => { localStorage.removeItem('orbit-token'); localStorage.removeItem('orbit-user'); setToken(''); }}><span className="avatar portrait">{user?.name?.slice(0, 1).toUpperCase()}</span><span><b>{user?.name}</b><small>Sign out</small></span><Icon>•••</Icon></button></div>
    </aside>
    <section className="content">
      <header><div className="crumb"><span>{nav}</span><strong>/</strong><b>Today</b></div><div className="head-actions"><button aria-label="Toggle theme" className="round-button" onClick={() => setDark(!dark)}>{dark ? '☀' : '☾'}</button><button className="round-button">⌕</button><button className="round-button bell">♧<i /></button></div></header>
      <div className="hero"><div><p className="eyebrow">{formattedDate}</p><h1>Make today count<span>.</span></h1><p className="subtitle">Small promises, kept consistently, become your story.</p></div><div className="live-time"><span className="pulse" />{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<small>LIVE</small></div></div>
      <section className="dashboard-grid">
        <article className="score-card"><div className="card-heading"><span>DAILY SCORE</span><button>•••</button></div><div className="score-content"><Circle value={percent}/><div className="score-copy"><p>You're doing beautifully.</p><b>{completed} of {tasks.length} complete</b><div className="mini-progress"><i style={{ width: `${percent}%` }}/></div><small>+12% from yesterday <span>↑</span></small></div></div><div className="sparkline"><span>MON</span><i style={{height:'26%'}}/><i style={{height:'45%'}}/><i style={{height:'34%'}}/><i style={{height:'65%'}}/><i className="today" style={{height:`${Math.max(percent, 30)}%`}}/><i style={{height:'22%'}}/><i style={{height:'19%'}}/></div></article>
        <article className="focus-card"><div><p className="eyebrow">FOCUS BLOCK</p><h2>2h 14m</h2><span>of meaningful time today</span></div><div className="focus-art"><i/><i/><i/><b>✦</b></div><button onClick={() => setNotice('Focus session started — you’ve got this!')}>Start focus <span>→</span></button></article>
      </section>
      <section className="today-header"><div><p className="eyebrow">YOUR DAY {loading && '· SAVING'}</p><h2>Today’s rhythm</h2></div><button className="add-button" onClick={() => setShowModal(true)}><b>＋</b> Add routine</button></section>
      <section className="task-layout"><div className="task-list"><div className="list-title"><span>IN PROGRESS <b>{tasks.filter(t => !t.done).length}</b></span><button>⌄</button></div>{tasks.map(task => <article className={`task-card ${task.done ? 'done' : ''} ${task.kind === 'temporary' ? 'temporary' : ''}`} key={task.id}><button className={`check ${task.done ? 'checked' : ''}`} onClick={() => toggle(task.id)} aria-label={`Mark ${task.title} done`}>{task.done && '✓'}</button><div className={`task-icon ${task.color}`}><Icon>{task.icon}</Icon></div><div className="task-info"><h3>{task.title}{task.kind === 'temporary' && <span className="tag">TEMPORARY</span>}</h3><p>{task.note}</p>{task.kind === 'quantity' && <div className="quantity-progress"><i style={{width: `${task.value / task.target * 100}%`}}/><span>{task.value}/{task.target}</span></div>}</div>{task.kind === 'quantity' ? <button className="count-button" onClick={() => increase(task.id)}>+ 1</button> : <button className="more">•••</button>}</article>)}</div>
        <aside className="right-rail"><article className="streak-card"><div className="flame">♨</div><div><p className="eyebrow">CURRENT STREAK</p><h3>7 <span>days</span></h3><p>One more day to beat your best.</p></div><div className="days">{['M','T','W','T','F','S','S'].map((d, i) => <span key={i} className={i < 5 ? 'filled' : ''}>{i === 4 ? '✓' : d}</span>)}</div></article><article className="up-next"><div className="card-heading"><span>UP NEXT</span><button>View all</button></div><div><time>5:00<br/><small>PM</small></time><i/><p><b>Evening walk</b><small>30 min · Health</small></p></div><div><time>8:30<br/><small>PM</small></time><i/><p><b>Reflect & plan</b><small>10 min · Personal</small></p></div></article></aside>
      </section>
    </section>
    {notice && <div className="toast"><span>✓</span>{notice}</div>}
    {showModal && <div className="modal-backdrop" onMouseDown={() => setShowModal(false)}><form className="modal" onSubmit={createTask} onMouseDown={e => e.stopPropagation()}><button type="button" className="close" onClick={() => setShowModal(false)}>×</button><p className="eyebrow">NEW INTENTION</p><h2>Add to your rhythm</h2><label>What will you do?<input autoFocus value={form.title} onChange={e => setForm({...form, title:e.target.value})} placeholder="e.g. Practice guitar" /></label><label>Type<select value={form.type} onChange={e => setForm({...form, type:e.target.value})}><option value="routine">Daily routine</option><option value="quantity">Quantifiable habit</option><option value="temporary">Temporary goal</option><option value="special">Special task for today</option></select></label>{form.type === 'quantity' && <label>Daily target<input type="number" min="1" value={form.target} onChange={e => setForm({...form, target:e.target.value})} placeholder="e.g. 20" /></label>}<button className="create" type="submit">{form.type === 'special' ? 'Create task' : 'Create routine'} <span>→</span></button></form></div>}
  </main>;
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('register'); const [form, setForm] = useState({ name: '', email: '', password: '' }); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async event => { event.preventDefault(); setBusy(true); setError(''); try { onAuthenticated(await api(`/auth/${mode}`, { method: 'POST', body: mode === 'register' ? form : { email: form.email, password: form.password } })); } catch (issue) { setError(issue.message); } finally { setBusy(false); } };
  return <main className="auth-page"><section className="auth-copy"><div className="brand"><span className="brand-mark">✦</span><span>orbit</span></div><p className="eyebrow">YOUR PERSONAL RHYTHM</p><h1>Build a life you<br/>want to repeat<span>.</span></h1><p>Every intention, completion, and progress update is securely saved to your private MongoDB account.</p><div className="auth-orbit"><i/><i/><i/><b>✦</b></div></section><form className="auth-card" onSubmit={submit}><p className="eyebrow">WELCOME TO ORBIT</p><h2>{mode === 'register' ? 'Start your journey' : 'Welcome back'}</h2><p className="auth-sub">{mode === 'register' ? 'Create an account to save your routines.' : 'Sign in to continue your rhythm.'}</p>{mode === 'register' && <label>Name<input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Your name" /></label>}<label>Email<input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="you@example.com" /></label><label>Password<input required minLength="8" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="At least 8 characters" /></label>{error && <p className="auth-error">{error}</p>}<button className="create" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create my account →' : 'Sign in →'}</button><p className="switch-auth">{mode === 'register' ? 'Already have an account?' : 'New to Orbit?'} <button type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>{mode === 'register' ? 'Sign in' : 'Create one'}</button></p></form></main>;
}
