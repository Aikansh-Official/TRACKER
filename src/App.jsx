import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  AndroidLogo,
  DownloadSimple,
  EnvelopeSimple,
  GithubLogo,
  LinkedinLogo,
} from '@phosphor-icons/react';
const OverviewInsights = lazy(() => import('./components/OverviewInsights.jsx'));
const MoodPage = lazy(() => import('./MoodPage.jsx'));
import { QuickCapture } from './PlannerEnhancements.jsx';
import { api, clearApiCache, localDateKey } from './api.js';
import AndroidDownloadBanner from './components/AndroidDownloadBanner.jsx';
import SyncButton from './components/SyncButton.jsx';
import ManageTasksPage from './pages/ManageTasksPage.jsx';
import RoutineLibrary from './pages/RoutineLibrary.jsx';
import PlanningPage from './pages/PlanningPage.jsx';
import WorkspaceShell from './WorkspaceShell.jsx';
import OverviewDashboard from './OverviewDashboard.jsx';

const initialTasks = [];
const projectUrl = 'https://github.com/Aikansh-Official/TRACKER';
const androidReleaseTag = 'android-v2.1.1';
const androidDownloadsUrl = `${projectUrl}/releases/tag/${androidReleaseTag}`;
const legacyAndroidUrl = `${projectUrl}/releases/tag/android-v1.0.0`;
const kotlinApkUrl = `${projectUrl}/releases/download/${androidReleaseTag}/TRACKER-Kotlin-release.apk`;
const normalizePage = page => ['Today', 'Calendar'].includes(page) ? 'Plan' : page === 'Insights' ? 'Overview' : page;
const pageNames = ['Overview', 'Plan', 'Today', 'Routines', 'Mood', 'Calendar', 'Insights', 'Pending', 'Archive', 'About'];
const isTaskComplete = task => task.done || (task.kind === 'quantity' && task.value >= task.target);
const storedValue = (key, fallback = '') => {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
};
const storedUser = () => {
  try {
    const value = localStorage.getItem('tracker-user');
    return value ? JSON.parse(value) : null;
  } catch {
    try { localStorage.removeItem('tracker-user'); } catch { /* storage may be unavailable in a restricted browser context */ }
    return null;
  }
};
const newRoutineForm = () => ({ clientId: crypto.randomUUID(), title: '', description: '', type: 'routine', target: '', unit: 'times', category: 'OTHER', endDate: '', frequency: 'DAILY', scheduledDays: [], weeklyTarget: 3, estimate: 25, preferredTime: '', minimumTarget: 1, stretchTarget: '' });


export default function App() {
  const [tasks, setTasks] = useState(initialTasks);
  const [token, setToken] = useState(() => storedValue('tracker-token'));
  const sessionToken = useRef(token);
  sessionToken.current = token;
  const readVersions = useRef({ dashboard: 0, library: 0, insights: 0, mood: 0 });
  const mutationLocks = useRef(new Set());
  const [user, setUser] = useState(storedUser);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState('');
  const [composerBusy, setComposerBusy] = useState(false);
  const composerLock = useRef(false);
  const composerTrigger = useRef(null);
  const [planCreateRequest, setPlanCreateRequest] = useState(0);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const [moodData, setMoodData] = useState(null);
  const [moodEntry, setMoodEntry] = useState(null);
  const [moodLoading, setMoodLoading] = useState(false);
  const [allRoutines, setAllRoutines] = useState([]);
  const [allSpecialTasks, setAllSpecialTasks] = useState([]);
  const [now, setNow] = useState(new Date());
  const [dark, setDark] = useState(() => storedValue('tracker-theme', 'dark') === 'dark');
  const [showModal, setShowModal] = useState(false);
  const [notice, setNotice] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [celebration, setCelebration] = useState(null);
  const [nav, setNav] = useState(() => { const saved = window.location.hash.slice(1); return pageNames.includes(saved) ? normalizePage(saved) : 'Plan'; });
  const [form, setForm] = useState(newRoutineForm);
  const [formError, setFormError] = useState('');
  useEffect(() => {
    clearApiCache();
    Object.keys(readVersions.current).forEach(key => { readVersions.current[key] += 1; });
    setTasks([]); setAllRoutines([]); setAllSpecialTasks([]); setPendingCount(0);
    setInsights(null); setMoodData(null); setMoodEntry(null);
    setDashboardError(''); setLibraryError(''); setInsightsError('');
  }, [token]);

  useEffect(() => {
    // The UI displays minutes, not seconds. Catch up immediately after sleep.
    const update = () => setNow(current => {
      const next = new Date();
      return Math.floor(current.getTime() / 60000) === Math.floor(next.getTime() / 60000) ? current : next;
    });
    const timer = setInterval(update, 10000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 2600); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    if (!celebration) return undefined;
    const timer = setTimeout(() => setCelebration(null), celebration.kind === 'day' ? 3200 : 1500);
    return () => clearTimeout(timer);
  }, [celebration]);
  const todayKey = localDateKey(now);
  useEffect(() => { if (token) { loadDashboard(); loadLibrary(); } }, [token, todayKey]);
  useEffect(() => { if (token && (nav === 'Overview' || nav === 'Plan')) loadInsights(); }, [token, nav]);
  useEffect(() => { if (token && (nav === 'Mood' || nav === 'Overview')) loadMood(); }, [token, nav, todayKey]);
  useEffect(() => {
    if (!token) return;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      clearApiCache();
      loadDashboard();
      loadLibrary();
      if (nav === 'Overview' || nav === 'Plan') loadInsights();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    const timer = setInterval(refresh, 30000);
    return () => { document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refresh); clearInterval(timer); };
  }, [token, nav]);
  useEffect(() => {
    if (token) window.location.hash = nav;
    else if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  }, [nav, token]);
  useEffect(() => { const syncPage = () => { const page = window.location.hash.slice(1); if (pageNames.includes(page)) setNav(normalizePage(page)); }; window.addEventListener('hashchange', syncPage); return () => window.removeEventListener('hashchange', syncPage); }, []);
  useEffect(() => {
    localStorage.setItem('tracker-theme', dark ? 'dark' : 'light');
    // Authentication is intentionally a light surface even when the signed-in workspace remembers dark mode.
    document.documentElement.style.colorScheme = token && dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', token && dark ? '#171816' : '#efeee9');
  }, [dark, token]);
  useEffect(() => {
    const expireSession = event => {
      sessionToken.current = '';
      localStorage.removeItem('tracker-token');
      localStorage.removeItem('tracker-user');
      setUser(null);
      setToken('');
      setAuthMessage('Your session expired. Please sign in again.');
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    };
    window.addEventListener('tracker:session-expired', expireSession);
    return () => window.removeEventListener('tracker:session-expired', expireSession);
  }, []);
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); }, [nav]);
  const scoredTasks = useMemo(() => tasks.filter(task => !task.skipped), [tasks]);
  const percent = useMemo(() => scoredTasks.length ? Math.round(scoredTasks.reduce((total, task) => total + (task.kind === 'quantity' || task.measured ? Math.min(1, task.value / Math.max(1,task.target)) : task.done ? 1 : 0), 0) / scoredTasks.length * 100) : 0, [scoredTasks]);

  function beginRead(key) {
    const version = ++readVersions.current[key];
    const requestedToken = token;
    return () => Boolean(requestedToken) && sessionToken.current === requestedToken && readVersions.current[key] === version;
  }

  async function loadDashboard() {
    if (!token) return null;
    const isCurrent = beginRead('dashboard');
    setLoading(true); setDashboardError('');
    try {
      const dashboard = await api('/dashboard', { token });
      if (!isCurrent()) return null;
      const routineTasks = dashboard.records.map(record => ({ id: record.routineId._id, title: record.routineId.title, note: record.skipped ? `Rest day · ${record.skipReason || 'intentionally skipped'}` : record.routineId.type === 'QUANTIFIABLE' ? `${record.completedQuantity} of ${record.target} ${record.routineId.unit}` : record.routineId.isTemporary ? `Until ${record.routineId.endDate}` : 'Daily routine', kind: record.routineId.type === 'QUANTIFIABLE' ? 'quantity' : record.routineId.isTemporary ? 'temporary' : 'routine', value: record.completedQuantity, target: record.target, done: record.completed, skipped: record.skipped, icon: record.skipped ? '☕' : record.routineId.type === 'QUANTIFIABLE' ? '◉' : record.routineId.isTemporary ? '⌁' : '◒', color: record.routineId.type === 'QUANTIFIABLE' ? 'blue' : record.routineId.isTemporary ? 'mint' : 'violet' }));
      const specialTasks = dashboard.specialTasks.map(task => ({ id: task._id, title: task.title, note: task.allDay ? `All-day ${task.itemType === 'EVENT' ? 'event' : 'task'}` : task.itemType === 'EVENT' && task.startTime ? `${task.startTime}${task.deadline ? `-${task.deadline}` : ''} · event` : task.deadline ? `Due · ${task.deadline}` : `${task.priority.toLowerCase()} priority`, kind: 'special', measured: task.taskType === 'MEASURABLE', value: task.progress || 0, target: task.target || 1, done: task.status === 'COMPLETED', icon: task.itemType === 'EVENT' ? '◆' : '✦', color: 'coral' }));
      setTasks([...routineTasks, ...specialTasks]); setPendingCount(dashboard.pendingCount); setUser(dashboard.user);
      try { localStorage.setItem('tracker-user', JSON.stringify(dashboard.user)); } catch { /* The loaded workspace remains usable without browser storage. */ }
      return true;
    } catch (error) { if (!isCurrent()) return null; setDashboardError(error.message); return false; } finally { if (isCurrent()) setLoading(false); }
  }
  async function loadLibrary() {
    if (!token) return null;
    const isCurrent = beginRead('library');
    setLibraryLoading(true); setLibraryError('');
    try {
      const [routinePayload, taskPayload] = await Promise.all([api('/routines', { token }), api('/tasks', { token })]);
      if (!isCurrent()) return null;
      setAllRoutines(routinePayload.routines); setAllSpecialTasks(taskPayload.tasks); return true;
    } catch (error) { if (!isCurrent()) return null; setLibraryError(error.message); return false; } finally { if (isCurrent()) setLibraryLoading(false); }
  }
  async function loadInsights() {
    if (!token) return null;
    const isCurrent = beginRead('insights');
    setInsightsLoading(true); setInsightsError('');
    try { const result = await api('/analytics/overview', { token }); if (!isCurrent()) return null; setInsights(result); return true; } catch (error) { if (!isCurrent()) return null; setInsightsError(error.message); return false; } finally { if (isCurrent()) setInsightsLoading(false); }
  }
  async function loadMood() {
    if (!token) return null;
    const isCurrent = beginRead('mood');
    setMoodLoading(true);
    try {
      const today = localDateKey();
      const [analytics, current] = await Promise.all([api('/moods/analytics/overview', { token }), api(`/moods?from=${today}&to=${today}`, { token })]);
      if (!isCurrent()) return null;
      setMoodData(analytics); setMoodEntry(current.entries[0] || null); return true;
    } catch (error) { if (!isCurrent()) return null; setNotice(error.message); return false; } finally { if (isCurrent()) setMoodLoading(false); }
  }
  const toggle = async (id) => {
    const task = tasks.find(item => item.id === id); if (!task) return;
    if (mutationLocks.current.has(id)) return;
    mutationLocks.current.add(id);
    const completing = !isTaskComplete(task);
    const completesDay = completing && scoredTasks.length > 0 && scoredTasks.filter(item => !isTaskComplete(item)).length === 1;
    try {
      if (task.kind === 'special') await api(`/tasks/${id}/complete`, { token, method: 'PATCH', body: { completed: !task.done } });
      else await api(`/routines/${id}/progress`, { token, method: 'PATCH', body: task.kind === 'quantity' ? { completedQuantity: task.done ? 0 : task.target } : { completed: !task.done } });
      const refreshed = await refreshAfterSave(`${task.title} updated`);
      if (completing && refreshed) setCelebration({ id: Date.now(), kind: completesDay ? 'day' : 'task', title: task.title });
    } catch (error) { setNotice(error.message); } finally { mutationLocks.current.delete(id); }
  };
  const increase = async (id) => {
    const task = tasks.find(item => item.id === id); if (!task) return;
    if (mutationLocks.current.has(id)) return;
    mutationLocks.current.add(id);
    const completing = task.value < task.target && task.value + 1 >= task.target;
    const completesDay = completing && scoredTasks.length > 0 && scoredTasks.filter(item => !isTaskComplete(item)).length === 1;
    try { await api(`/routines/${id}/progress`, { token, method: 'PATCH', body: { completedQuantity: Math.min(task.target, task.value + 1) } }); const refreshed = await refreshAfterSave(`${task.title} progress saved`); if (completing && refreshed) setCelebration({ id: Date.now(), kind: completesDay ? 'day' : 'task', title: task.title }); } catch (error) { setNotice(error.message); } finally { mutationLocks.current.delete(id); }
  };
  const decrease = async (id) => {
    const task = tasks.find(item => item.id === id); if (!task || task.value <= 0) return;
    if (mutationLocks.current.has(id)) return;
    mutationLocks.current.add(id);
    try { await api(`/routines/${id}/progress`, { token, method: 'PATCH', body: { completedQuantity: Math.max(0, task.value - 1) } }); await refreshAfterSave(`${task.title} progress saved`); } catch (error) { setNotice(error.message); } finally { mutationLocks.current.delete(id); }
  };
  const createTask = async (event) => {
    event.preventDefault();
    if (composerLock.current) return;
    setFormError('');
    if (!form.title.trim()) { setFormError('Give this intention a clear name.'); return; }
    if (form.type === 'quantity' && (!Number.isInteger(Number(form.target)) || Number(form.target) < 1 || !form.unit.trim())) { setFormError('Choose a whole-number target of at least 1 and a unit.'); return; }
    if (form.type === 'temporary' && (!form.endDate || form.endDate < localDateKey())) { setFormError('Choose an end date on or after today.'); return; }
    if (form.frequency === 'CUSTOM' && !form.scheduledDays.length) { setFormError('Choose at least one day for this routine.'); return; }
    if (form.frequency === 'WEEKLY_TARGET' && (!Number.isInteger(Number(form.weeklyTarget)) || Number(form.weeklyTarget) < 1 || Number(form.weeklyTarget) > 7)) { setFormError('Choose a weekly target from 1 to 7 days.'); return; }
    composerLock.current = true; setComposerBusy(true);
    try {
      await api('/routines', { token, method: 'POST', body: { clientId: form.clientId, title: form.title.trim(), description: form.description, type: form.type === 'quantity' ? 'QUANTIFIABLE' : form.type === 'temporary' ? 'TEMPORARY' : 'BINARY', category: form.category, targetQuantity: Number(form.target || 1), unit: form.unit.trim() || 'times', frequency: form.frequency, scheduledDays: form.frequency === 'CUSTOM' ? form.scheduledDays : [], weeklyTarget: Number(form.weeklyTarget || 3), estimatedMinutes: Number(form.estimate || 25), preferredTime: form.preferredTime || null, minimumTarget: Number(form.minimumTarget || 1), stretchTarget: Number(form.stretchTarget || form.target || 1), startDate: localDateKey(), ...(form.type === 'temporary' ? { endDate: form.endDate } : {}) } });
      setForm(newRoutineForm()); setShowModal(false); await refreshAfterSave('Routine created');
    } catch (error) { setFormError(error.message); } finally { composerLock.current = false; setComposerBusy(false); }
  };

  const archiveRoutine = async id => { await api(`/routines/${id}/archive`, { token, method: 'POST' }); await refreshAfterSave('Routine archived. Restore it from Archive whenever you need it'); };
  const restoreRoutine = async id => { await api(`/routines/${id}/restore`, { token, method: 'POST' }); await refreshAfterSave('Routine restored'); };
  const taskAction = async (task, action, value) => {
    if (action === 'complete') await api(`/tasks/${task._id}/complete`, { token, method: 'PATCH', body: { completed: true } });
    else if (action === 'reopen') await api(`/tasks/${task._id}/complete`, { token, method: 'PATCH', body: { completed: false } });
    else await api(`/tasks/${task._id}/outcome`, { token, method: 'PATCH', body: action === 'drop' ? { outcome: 'DROPPED' } : { outcome: 'RESCHEDULED', scheduledDate: value } });
    await refreshAfterSave(action === 'complete' ? 'Task completed' : action === 'reopen' ? 'Completion undone' : action === 'drop' ? 'Task moved to Archive' : 'Task rescheduled');
  };
  const skipRoutine = async task => { try { await api(`/routines/${task.id}/skip`, { token, method: 'PATCH', body: { skipped: !task.skipped, reason: task.skipped ? '' : 'Intentional recovery day' } }); await refreshAfterSave(task.skipped ? 'Routine restored for today' : 'Rest day saved'); } catch (error) { setNotice(error.message); } };
  const saveMood = async values => { try { await api(`/moods/${localDateKey()}`, { token, method: 'PUT', body: values }); const refreshed = await loadMood(); setNotice(refreshed === false ? 'Mood check-in saved. Use Sync to reload your saved check-in.' : 'Mood check-in saved'); return true; } catch (error) { setNotice(error.message); return false; } };
  async function refreshCalendar() {
    const results = await Promise.all([loadDashboard(), loadLibrary(), loadInsights()]);
    if (results.some(result => result === false)) throw new Error('Some views could not refresh. Use Sync to reload your saved changes.');
  }
  async function refreshAfterSave(message) {
    try { await refreshCalendar(); setNotice(message); return true; }
    catch { setNotice(`${message}. Use Sync to reload your saved changes.`); return false; }
  }

  const syncWorkspace = async () => {
    clearApiCache();
    const results = await Promise.all([loadDashboard(), loadLibrary(), loadInsights(), loadMood()]);
    if (results.some(result => result === false)) throw new Error('Some data could not sync. Check your connection and retry.');
  };

  const finishAuthentication = ({ token: newToken, user: newUser }) => { localStorage.setItem('tracker-token', newToken); localStorage.setItem('tracker-user', JSON.stringify(newUser)); setAuthMessage(''); setUser(newUser); setToken(newToken); setNav('Plan'); };
  if (!token) return <SiteFrame><AuthScreen onAuthenticated={finishAuthentication} initialError={authMessage} initialMode={authMessage ? 'login' : 'register'} /></SiteFrame>;
  const openComposer = () => { setFormError(''); setShowModal(true); };
  const openTaskEditor = () => { setPlanCreateRequest(Date.now()); setNav('Plan'); };
  const signOut = () => {
    localStorage.removeItem('tracker-token');
    localStorage.removeItem('tracker-user');
    setUser(null);
    setToken('');
    window.history.replaceState(null, '', window.location.pathname);
    window.location.reload();
  };
  const modal = showModal && <RoutineComposer form={form} setForm={setForm} error={formError} busy={composerBusy} dark={dark} onSubmit={createTask} onClose={() => !composerLock.current && setShowModal(false)} />;
  const overlays = page => <WorkspaceShell active={nav} onNavigate={page => setNav(normalizePage(page))} dark={dark} onTheme={() => setDark(value => !value)} onSignOut={signOut} user={user}><SiteFrame dark={dark} showFooter={false}><Suspense fallback={<main className="page-loading" role="status">Opening {nav.toLowerCase()}…</main>}>{page}</Suspense>{nav !== 'Plan' && nav !== 'Today' && nav !== 'About' && <QuickCapture token={token} dark={dark} onChanged={refreshCalendar} notify={setNotice}/>}{nav !== 'About' && <SyncButton onSync={syncWorkspace} raised={nav !== 'Plan'}/>}{celebration && <Celebration key={celebration.id} celebration={celebration}/>} {notice && <div className="toast" role="status">{notice}</div>}{modal}</SiteFrame></WorkspaceShell>;
  if (nav === 'About') return overlays(<main className="workspace-page"><header className="workspace-heading"><div><h1>About TRACKER</h1></div></header><SiteFooter/></main>);
  if (nav === 'Overview') return overlays(<OverviewDashboard tasks={tasks} percent={percent} pendingCount={pendingCount} insights={insights} loading={insightsLoading} error={insightsError} user={user} tasksLoading={loading} tasksError={dashboardError} onRetryTasks={loadDashboard} onToggle={toggle} onNavigate={page => setNav(normalizePage(page))} onAdd={openTaskEditor} onRetry={loadInsights}><Suspense fallback={<p role="status">Loading insights…</p>}><OverviewInsights data={insights} loading={insightsLoading} error={insightsError} dark={dark} onBack={openComposer} onRetry={loadInsights}/></Suspense></OverviewDashboard>);
  if (nav === 'Plan' || nav === 'Today') return overlays(<PlanningPage createRequest={planCreateRequest} onCreateHandled={() => setPlanCreateRequest(0)} onSkip={skipRoutine} dailyScores={insights?.daily || []} token={token} tasks={allSpecialTasks} routines={allRoutines} todayTasks={tasks} loading={libraryLoading} loadError={libraryError} onRetry={loadLibrary} dark={dark} onChanged={refreshCalendar} notify={setNotice} onToggle={toggle} onIncrease={increase} onDecrease={decrease} onNavigate={page => setNav(normalizePage(page))}/>);
  if (nav === 'Routines') return overlays(<RoutineLibrary routines={allRoutines} todayTasks={tasks} loading={libraryLoading} error={libraryError} onRetry={loadLibrary} onAdd={openComposer} onArchive={archiveRoutine}/>);
  if (nav === 'Mood') return overlays(<MoodPage entry={moodEntry} data={moodData} loading={moodLoading} dark={dark} onNavigate={page => setNav(normalizePage(page))} onSave={saveMood} />);
  if (nav === 'Pending' || nav === 'Archive') return overlays(<ManageTasksPage key={nav} mode={nav} routines={allRoutines} tasks={allSpecialTasks} loading={libraryLoading} error={libraryError} onRetry={loadLibrary} onNavigate={page => setNav(normalizePage(page))} onTaskAction={taskAction} onRestore={restoreRoutine}/>);

  return null;

}



function SiteFooter() {
  return <footer className="site-footer"><div className="site-footer-inner"><section className="site-footer-about" aria-labelledby="footer-about"><div className="site-footer-brand"><span className="brand-mark">✦</span><strong>TRACKER</strong></div><h2 id="footer-about">About and support</h2><p>TRACKER is a productivity workspace created by Aikansh Katiyar. Open-source contributions are welcome.</p><a className="footer-contribute" href={`${projectUrl}/issues`} target="_blank" rel="noreferrer"><GithubLogo aria-hidden="true" size={18} weight="bold"/>Contribute or request support</a></section><section className="site-footer-links" aria-labelledby="footer-connect"><h2 id="footer-connect">Developer</h2><a href="https://www.linkedin.com/in/aikansh-katiyar-975663305/" target="_blank" rel="noreferrer"><LinkedinLogo aria-hidden="true" size={18} weight="bold"/>LinkedIn</a><a href="mailto:aikanshkatiyar@gmail.com"><EnvelopeSimple aria-hidden="true" size={18} weight="bold"/>aikanshkatiyar@gmail.com</a><a href="https://github.com/Aikansh-Official" target="_blank" rel="noreferrer"><GithubLogo aria-hidden="true" size={18} weight="bold"/>GitHub</a></section><section className="site-footer-downloads" aria-labelledby="footer-downloads"><h2 id="footer-downloads">Android downloads</h2><p>Plan offline and sync with your website account.</p><a href={kotlinApkUrl}><AndroidLogo aria-hidden="true" size={18} weight="fill"/><span><strong>Download Android app</strong><small>Kotlin · version 2.1.1</small></span><DownloadSimple aria-hidden="true" size={18} weight="bold"/></a><a href={legacyAndroidUrl}>Older releases (legacy sync)</a></section></div><div className="site-footer-bottom"><span>© {new Date().getFullYear()} Aikansh Katiyar</span><a href={projectUrl} target="_blank" rel="noreferrer">View source on GitHub</a></div></footer>;
}

function SiteFrame({ children, dark = false, showFooter = true }) {
  return <div className={dark ? 'site-frame dark' : 'site-frame'}><AndroidDownloadBanner href={androidDownloadsUrl}/>{children}{showFooter && <SiteFooter/>}</div>;
}

function Celebration({ celebration }) {
  const isDay = celebration.kind === 'day';
  const pieces = useMemo(() => Array.from({ length: isDay ? 72 : 28 }, (_, index) => ({
    id: index,
    x: (index * 37 + 11) % 100,
    delay: (index % 12) * (isDay ? 35 : 12),
    duration: isDay ? 1500 + (index % 7) * 170 : 850 + (index % 7) * 70,
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


function RoutineComposer({ form, setForm, error, busy, dark, onSubmit, onClose }) {
  return <div className={`modal-backdrop ${dark ? 'dark' : ''}`} onMouseDown={onClose}><form className="modal intention-modal" role="dialog" aria-modal="true" aria-labelledby="routine-composer-title" onSubmit={onSubmit} onMouseDown={event => event.stopPropagation()}><button type="button" className="close" aria-label="Close intention form" onClick={onClose}>×</button><p className="eyebrow">NEW INTENTION</p><h2 id="routine-composer-title">Add to your rhythm</h2><p className="modal-intro">Make it specific enough that tonight-you will know whether it happened.</p><label>What will you do?<input required autoFocus value={form.title} onChange={event => setForm({...form, title:event.target.value})} placeholder="e.g. Review algorithms for 45 minutes" /></label><label>What does success look like? <span>optional</span><textarea value={form.description} onChange={event => setForm({...form, description:event.target.value})} placeholder="A short note for your future self" /></label><div className="form-grid"><label>Type<select value={form.type} onChange={event => setForm({...form, type:event.target.value})}><option value="routine">Daily routine</option><option value="quantity">Quantifiable habit</option><option value="temporary">Temporary goal</option><option value="special">One-off task for today</option></select></label>{form.type !== 'special' && <label>Life area<select value={form.category} onChange={event => setForm({...form, category:event.target.value})}><option value="STUDY">Study</option><option value="HYGIENE">Hygiene</option><option value="WORKOUT">Workout</option><option value="HEALTH">Health</option><option value="PERSONAL">Personal</option><option value="OTHER">Other</option></select></label>}</div>{form.type === 'quantity' && <div className="form-grid"><label>Daily target<input type="number" min="1" required value={form.target} onChange={event => setForm({...form, target:event.target.value})} placeholder="8" /></label><label>Unit<input value={form.unit} onChange={event => setForm({...form, unit:event.target.value})} placeholder="glasses, pages, minutes" /></label></div>}{form.type === 'temporary' && <label>Goal end date<input type="date" min={localDateKey()} required value={form.endDate} onChange={event => setForm({...form, endDate:event.target.value})}/></label>}{form.type === 'special' && <div className="form-grid"><label>Priority<select value={form.priority} onChange={event => setForm({...form, priority:event.target.value})}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></label><label>Deadline <span>optional</span><input type="time" value={form.deadline} onChange={event => setForm({...form, deadline:event.target.value})}/></label></div>}{error && <p className="form-error" role="alert">{error}</p>}<button className="create" disabled={busy} type="submit">{busy ? 'Saving…' : form.type === 'special' ? 'Create today’s task' : 'Create routine'} <span>→</span></button></form></div>;
}


function AuthScreen({ onAuthenticated, initialError = '', initialMode = 'register' }) {
  const [mode, setMode] = useState(initialMode); const [form, setForm] = useState({ name: '', email: '', password: '' }); const [error, setError] = useState(initialError); const [busy, setBusy] = useState(false);
  const submit = async event => { event.preventDefault(); setBusy(true); setError(''); try { onAuthenticated(await api(`/auth/${mode}`, { method: 'POST', body: mode === 'register' ? form : { email: form.email, password: form.password } })); } catch (issue) { setError(issue.message); } finally { setBusy(false); } };
  return <main className="auth-page"><section className="auth-copy"><div className="brand"><span className="brand-mark">✦</span><span>TRACKER</span></div><p className="eyebrow">YOUR PERSONAL RHYTHM</p><h1>Build a life you<br/>want to repeat<span>.</span></h1><p>Plan your day, track your progress, and pick up where you left off on any device.</p><div className="auth-track"><i/><i/><i/><b>✦</b></div></section><form className="auth-card" onSubmit={submit}><p className="eyebrow">WELCOME TO TRACKER</p><h2>{mode === 'register' ? 'Start your journey' : 'Welcome back'}</h2><p className="auth-sub">{mode === 'register' ? 'Create an account to save your routines.' : 'Sign in to continue your rhythm.'}</p>{mode === 'register' && <label>Name<input required autoComplete="name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Your name" /></label>}<label>Email<input required type="email" autoComplete="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="you@example.com" /></label><label>Password<input required minLength="8" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="At least 8 characters" /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="create" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create my account →' : 'Sign in →'}</button><p className="switch-auth">{mode === 'register' ? 'Already have an account?' : 'New to TRACKER?'} <button type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>{mode === 'register' ? 'Sign in' : 'Create one'}</button></p></form></main>;
}
