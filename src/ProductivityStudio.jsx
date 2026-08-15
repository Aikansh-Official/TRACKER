import { useEffect, useMemo, useState } from 'react';
import { api, localDateKey } from './api.js';

const weekdayOptions = [['M', 1], ['T', 2], ['W', 3], ['T', 4], ['F', 5], ['S', 6], ['S', 0]];
const emptyGoal = { title: '', description: '', lifeArea: 'STUDY', targetDate: '', milestones: '' };

const minutesLabel = minutes => minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ''}`.trim() : `${minutes}m`;
const sessionClock = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export default function ProductivityStudio({ token, dark, onNavigate, onTheme, notify }) {
  const [data, setData] = useState(null);
  const [review, setReview] = useState(null);
  const [section, setSection] = useState('Plan');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [distractions, setDistractions] = useState(0);
  const [focusNote, setFocusNote] = useState('');
  const [customFocus, setCustomFocus] = useState({ title: '', minutes: 25 });
  const [goalForm, setGoalForm] = useState(emptyGoal);
  const [reviewForm, setReviewForm] = useState({ wins: '', lessons: '', nextWeekFocus: '', rating: 3 });

  const load = async () => {
    try {
      const [overview, weekly] = await Promise.all([api('/productivity/overview', { token }), api('/productivity/weekly-review', { token })]);
      setData(overview);
      setReview(weekly);
      setReviewForm({ wins: weekly.review.wins || '', lessons: weekly.review.lessons || '', nextWeekFocus: weekly.review.nextWeekFocus || '', rating: weekly.review.rating || 3 });
      setDistractions(overview.focus.active?.distractions || 0);
      setFocusNote(overview.focus.active?.note || '');
    } catch (error) { notify(error.message); }
  };

  useEffect(() => { load(); }, [token]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const activeId = data?.focus?.active?._id;
    if (!activeId) return undefined;
    const timer = setTimeout(() => {
      api(`/productivity/focus/${activeId}`, { token, method: 'PATCH', body: { status: 'ACTIVE', distractions, note: focusNote } }).catch(() => {});
    }, 450);
    return () => clearTimeout(timer);
  }, [data?.focus?.active?._id, distractions, focusNote, token]);

  const priorities = data?.plan?.priorityIds || [];
  const priorityKey = item => `${item.type}:${item.id}`;
  const togglePriority = item => {
    const key = priorityKey(item);
    const next = priorities.includes(key) ? priorities.filter(value => value !== key) : priorities.length < 3 ? [...priorities, key] : priorities;
    setData(current => ({ ...current, plan: { ...current.plan, priorityIds: next } }));
  };

  const savePlan = async () => {
    setBusy(true);
    try {
      const payload = await api(`/productivity/plan/${data.today}`, { token, method: 'PUT', body: data.plan });
      setData(current => ({ ...current, plan: payload.plan }));
      notify('Today’s plan is saved to MongoDB');
    } catch (error) { notify(error.message); } finally { setBusy(false); }
  };

  const startFocus = async (item, minutes = item?.estimate || customFocus.minutes) => {
    setBusy(true);
    try {
      await api('/productivity/focus/start', { token, method: 'POST', body: { taskType: item?.type || 'GENERAL', taskId: item?.id || null, title: item?.title || customFocus.title || 'Deep work', plannedMinutes: Number(minutes || 25) } });
      setSection('Focus');
      await load();
      notify('Focus session started');
    } catch (error) { notify(error.message); } finally { setBusy(false); }
  };

  const finishFocus = async status => {
    setBusy(true);
    try {
      await api(`/productivity/focus/${data.focus.active._id}`, { token, method: 'PATCH', body: { status, distractions, note: focusNote } });
      await load();
      notify(status === 'ABANDONED' ? 'Session closed honestly' : 'Focus session saved');
    } catch (error) { notify(error.message); } finally { setBusy(false); }
  };

  const updateRoutine = async (routine, changes) => {
    try {
      await api(`/routines/${routine._id}`, { token, method: 'PATCH', body: changes });
      await load();
      notify(`${routine.title} schedule updated`);
    } catch (error) { notify(error.message); }
  };

  const resolveTask = async (item, outcome) => {
    if (outcome === 'DROPPED' && !window.confirm(`Intentionally drop “${item.title}”? This will preserve the outcome without counting it as a failure.`)) return;
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    try {
      await api(`/tasks/${item.id}/outcome`, { token, method: 'PATCH', body: { outcome, scheduledDate: outcome === 'RESCHEDULED' ? localDateKey(tomorrow) : undefined, delegatedTo: outcome === 'DELEGATED' ? 'Delegated' : undefined } });
      await load();
      notify(outcome === 'RESCHEDULED' ? 'Task moved to tomorrow' : `Task marked ${outcome.toLowerCase()}`);
    } catch (error) { notify(error.message); }
  };

  const createGoal = async event => {
    event.preventDefault(); setBusy(true);
    try {
      await api('/productivity/goals', { token, method: 'POST', body: { ...goalForm, targetDate: goalForm.targetDate || null, milestones: goalForm.milestones.split('\n').map(value => value.trim()).filter(Boolean) } });
      setGoalForm(emptyGoal); await load(); notify('Goal and milestones saved');
    } catch (error) { notify(error.message); } finally { setBusy(false); }
  };

  const toggleMilestone = async (goal, milestone) => {
    try { await api(`/productivity/goals/${goal._id}/milestones/${milestone._id}`, { token, method: 'PATCH', body: { done: !milestone.done } }); await load(); } catch (error) { notify(error.message); }
  };

  const saveReview = async event => {
    event.preventDefault(); setBusy(true);
    try { const payload = await api(`/productivity/weekly-review/${review.snapshot.weekStart}`, { token, method: 'PUT', body: reviewForm }); setReview(payload); notify('Weekly review saved'); } catch (error) { notify(error.message); } finally { setBusy(false); }
  };

  const exportData = async () => {
    try {
      const payload = await api('/productivity/export', { token });
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `tracker-export-${localDateKey()}.json`; anchor.click(); URL.revokeObjectURL(url);
      notify('Private TRACKER export prepared');
    } catch (error) { notify(error.message); }
  };

  const exportCalendar = async () => {
    try {
      const response = await fetch('/api/productivity/calendar.ics', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Calendar export could not be prepared.');
      const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `tracker-calendar-${localDateKey()}.ics`; anchor.click(); URL.revokeObjectURL(url); notify('Calendar file prepared for Google, Outlook, or Apple Calendar');
    } catch (error) { notify(error.message); }
  };

  const elapsedSeconds = useMemo(() => data?.focus?.active ? Math.max(0, Math.floor((now - new Date(data.focus.active.startedAt).getTime()) / 1000)) : 0, [data?.focus?.active, now]);
  if (!data || !review) return <main className={dark ? 'productivity-page dark' : 'productivity-page'}><p className="studio-loading">Preparing your private productivity studio…</p></main>;

  return <main className={dark ? 'productivity-page dark' : 'productivity-page'}>
    <nav className="studio-global-nav" aria-label="Tracker pages"><div>{['Overview', 'Plan', 'Today', 'Routines', 'Mood', 'Calendar', 'Insights'].map(item => <button key={item} className={item === 'Plan' ? 'selected' : ''} onClick={() => onNavigate(item)}>{item}</button>)}</div><button className="studio-theme" aria-label="Toggle theme" onClick={onTheme}>{dark ? 'Light mode' : 'Dark mode'}</button></nav>
    <header className="studio-hero">
      <div><p className="eyebrow">PRODUCTIVITY STUDIO · ACTIONABLE, NOT PERFORMATIVE</p><h1>Choose the work.<br/><span>Protect the attention.</span></h1><p>{data.energyGuidance}</p></div>
      <div className="studio-score"><span>TODAY’S LOAD</span><strong>{minutesLabel(data.workloadMinutes)}</strong><small>{data.items.filter(item => !item.done).length} open · {data.focus.todayMinutes} focused minutes</small></div>
    </header>
    <nav className="studio-tabs" aria-label="Productivity studio sections">{['Plan', 'Focus', 'Goals', 'Review'].map(item => <button key={item} className={section === item ? 'selected' : ''} onClick={() => setSection(item)}>{item}</button>)}<button className="export-button" onClick={exportCalendar}>Export calendar</button><button className="export-button" onClick={exportData}>Export data</button></nav>

    {section === 'Plan' && <section className="studio-section plan-section">
      <div className="plan-grid">
        <article className="studio-card daily-plan-card">
          <div className="studio-card-head"><div><p className="eyebrow">DAILY PLANNING RITUAL</p><h2>Three wins are enough.</h2></div><span>{priorities.length}/3 chosen</span></div>
          <label className="wide-label">The sentence that guides today<textarea value={data.plan.intention} onChange={event => setData(current => ({ ...current, plan: { ...current.plan, intention: event.target.value } }))} placeholder="If today goes well, what will be true?"/></label>
          <label className="wide-label">Make it automatic with an if–then plan<textarea value={data.plan.implementationIntention || ''} onChange={event => setData(current => ({ ...current, plan: { ...current.plan, implementationIntention: event.target.value } }))} placeholder="If it is 7 PM after dinner, then I will solve one DSA problem."/></label><label className="capacity-control">Capacity today<select value={data.plan.capacity} onChange={event => setData(current => ({ ...current, plan: { ...current.plan, capacity: event.target.value } }))}><option value="LOW">Low — protect the essential</option><option value="NORMAL">Steady — plan realistically</option><option value="HIGH">High — protect deep work</option></select></label>
          <div className="priority-list">{data.items.length ? data.items.map(item => <article key={priorityKey(item)} className={`${priorities.includes(priorityKey(item)) ? 'priority selected' : 'priority'} ${item.done ? 'done' : ''}`}><button aria-pressed={priorities.includes(priorityKey(item))} onClick={() => togglePriority(item)} disabled={!priorities.includes(priorityKey(item)) && priorities.length >= 3}><span>★</span><div><b>{item.title}</b><small>{item.type.toLowerCase()} · {minutesLabel(item.estimate)}{item.preferredTime ? ` · ${item.preferredTime}` : ''}</small></div></button>{item.type === 'TASK' && !item.done && <details><summary>Resolve</summary><div><button onClick={() => resolveTask(item, 'RESCHEDULED')}>Tomorrow</button><button onClick={() => resolveTask(item, 'DELEGATED')}>Delegate</button><button className="danger-text" onClick={() => resolveTask(item, 'DROPPED')}>Drop</button></div></details>}</article>) : <div className="studio-empty">Add a routine or task on Today, then return to choose your priorities.</div>}</div>
          <label className="wide-label">Shutdown note<textarea value={data.plan.shutdownNote} onChange={event => setData(current => ({ ...current, plan: { ...current.plan, shutdownNote: event.target.value } }))} placeholder="What can tomorrow-you safely pick up?"/></label>
          <button className="studio-primary" disabled={busy} onClick={savePlan}>Save today’s plan →</button>
        </article>
        <aside className="studio-side">
          <article className="studio-card energy-card"><p className="eyebrow">ENERGY-AWARE PLAN</p><h3>Work with your capacity.</h3><p>{data.energyGuidance}</p><button onClick={() => onNavigate('Mood')}>{data.mood ? 'Refine mood check-in' : 'Check in with your mood'} →</button></article>
          <article className="studio-card insight-stack"><p className="eyebrow">NEXT BEST ACTIONS</p>{data.suggestions.map(suggestion => <div key={suggestion.id} className={`actionable ${suggestion.tone}`}><b>{suggestion.title}</b><span>{suggestion.evidence}</span><small>{suggestion.action}</small></div>)}</article>
        </aside>
      </div>
      <article className="studio-card schedule-card"><div className="studio-card-head"><div><p className="eyebrow">FLEXIBLE ROUTINE SCHEDULES</p><h2>Consistency should match real life.</h2></div><button onClick={() => onNavigate('Routines')}>Routine library →</button></div><div className="schedule-list">{data.routines.map(routine => <article key={routine._id}><div><b>{routine.title}</b><small>{routine.category.toLowerCase()} · {routine.estimatedMinutes || 25} minutes</small></div><select aria-label={`Schedule for ${routine.title}`} value={routine.frequency} onChange={event => updateRoutine(routine, { frequency: event.target.value })}><option value="DAILY">Every day</option><option value="WEEKDAYS">Weekdays</option><option value="WEEKENDS">Weekends</option><option value="CUSTOM">Custom days</option><option value="WEEKLY_TARGET">Times per week</option></select>{routine.frequency === 'CUSTOM' && <div className="day-picker">{weekdayOptions.map(([label, value]) => <button key={value} className={routine.scheduledDays.includes(value) ? 'selected' : ''} aria-pressed={routine.scheduledDays.includes(value)} onClick={() => updateRoutine(routine, { scheduledDays: routine.scheduledDays.includes(value) ? routine.scheduledDays.filter(day => day !== value) : [...routine.scheduledDays, value] })}>{label}</button>)}</div>}{routine.frequency === 'WEEKLY_TARGET' && <label className="weekly-target">Target<input type="number" min="1" max="7" value={routine.weeklyTarget} onChange={event => updateRoutine(routine, { weeklyTarget: Number(event.target.value) })}/><span>/ week</span></label>}<label className="estimate-control">Estimate<input type="number" min="5" max="480" defaultValue={routine.estimatedMinutes || 25} onBlur={event => updateRoutine(routine, { estimatedMinutes: Number(event.target.value) })}/><span>min</span></label><button className="pause-button" onClick={() => updateRoutine(routine, { status: routine.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' })}>{routine.status === 'PAUSED' ? 'Resume' : 'Pause'}</button></article>)}</div></article>
    </section>}

    {section === 'Focus' && <section className="studio-section focus-section">
      {data.focus.active ? <article className="active-focus"><p className="eyebrow">FOCUS SESSION · SAVED ACROSS RELOADS</p><h2>{data.focus.active.title}</h2><strong>{sessionClock(elapsedSeconds)}</strong><span>planned {data.focus.active.plannedMinutes} minutes</span><div className="focus-progress"><i style={{ width: `${Math.min(100, elapsedSeconds / (data.focus.active.plannedMinutes * 60) * 100)}%` }}/></div><div className="distraction-control"><button onClick={() => setDistractions(value => Math.max(0, value - 1))}>−</button><b>{distractions}</b><span>distractions noticed</span><button onClick={() => setDistractions(value => value + 1)}>+</button></div><textarea value={focusNote} onChange={event => setFocusNote(event.target.value)} placeholder="What helped or interrupted your attention?"/><div className="focus-actions"><button disabled={busy} onClick={() => finishFocus('ABANDONED')}>Close honestly</button><button className="studio-primary" disabled={busy} onClick={() => finishFocus('COMPLETED')}>Complete session</button></div></article> : <><div className="focus-heading"><div><p className="eyebrow">FOCUS LAUNCHPAD</p><h2>Beginning is the feature.</h2></div><div><input value={customFocus.title} onChange={event => setCustomFocus({ ...customFocus, title: event.target.value })} placeholder="Custom focus session"/><input type="number" min="5" max="240" value={customFocus.minutes} onChange={event => setCustomFocus({ ...customFocus, minutes: event.target.value })}/><button className="studio-primary" disabled={!customFocus.title || busy} onClick={() => startFocus(null)}>Start</button></div></div><div className="focus-launch-grid">{data.items.filter(item => !item.done).map(item => <article key={priorityKey(item)}><span>{item.type}</span><h3>{item.title}</h3><p>{minutesLabel(item.estimate)} estimated{item.preferredTime ? ` · best around ${item.preferredTime}` : ''}</p><button onClick={() => startFocus(item)}>Start {item.estimate}m focus →</button></article>)}</div></>}
      <article className="studio-card estimate-truth"><p className="eyebrow">PLANNED × ACTUAL</p><h2>{data.estimateAccuracy.sessions ? `${data.estimateAccuracy.ratio}% of estimates` : 'Your calibration begins here.'}</h2><p>{data.estimateAccuracy.sessions ? `${data.estimateAccuracy.actualMinutes} actual minutes across ${data.estimateAccuracy.sessions} task-linked sessions, compared with ${data.estimateAccuracy.plannedMinutes} planned.` : 'Complete task-linked focus sessions to learn how long your work really takes.'}</p></article><article className="studio-card recent-focus"><div className="studio-card-head"><div><p className="eyebrow">RECENT FOCUS</p><h2>Attention you actually protected.</h2></div><strong>{data.focus.todayMinutes}m today</strong></div>{data.focus.recent.length ? data.focus.recent.map(session => <div key={session._id}><b>{session.title}</b><span>{session.durationMinutes} minutes · {session.distractions} distractions</span><small>{session.status.toLowerCase()}</small></div>) : <p className="studio-empty">Your first completed session will appear here.</p>}</article>
    </section>}

    {section === 'Goals' && <section className="studio-section goals-section"><form className="studio-card goal-form" onSubmit={createGoal}><p className="eyebrow">GOAL DECOMPOSITION</p><h2>Turn direction into next steps.</h2><label>Goal title<input required value={goalForm.title} onChange={event => setGoalForm({ ...goalForm, title: event.target.value })} placeholder="Prepare confidently for placements"/></label><label>Why it matters<textarea value={goalForm.description} onChange={event => setGoalForm({ ...goalForm, description: event.target.value })}/></label><div className="goal-form-row"><label>Life area<select value={goalForm.lifeArea} onChange={event => setGoalForm({ ...goalForm, lifeArea: event.target.value })}><option>STUDY</option><option>CAREER</option><option>HEALTH</option><option>FITNESS</option><option>PERSONAL</option><option>OTHER</option></select></label><label>Target date<input type="date" value={goalForm.targetDate} onChange={event => setGoalForm({ ...goalForm, targetDate: event.target.value })}/></label></div><label>Milestones <span>one per line</span><textarea required value={goalForm.milestones} onChange={event => setGoalForm({ ...goalForm, milestones: event.target.value })} placeholder={'Revise arrays\nSolve 20 interview problems\nComplete a mock interview'}/></label><button className="studio-primary" disabled={busy}>Create goal →</button></form><div className="goal-list">{data.goals.length ? data.goals.map(goal => <article className="studio-card goal-card" key={goal._id}><div className="goal-top"><span>{goal.lifeArea}</span><b>{goal.progress}%</b></div><h2>{goal.title}</h2><p>{goal.description || 'No description yet.'}</p><div className="goal-progress"><i style={{ width: `${goal.progress}%` }}/></div><div className="milestone-list">{goal.milestones.map(milestone => <button key={milestone._id} className={milestone.done ? 'done' : ''} onClick={() => toggleMilestone(goal, milestone)}><span>{milestone.done ? '✓' : '○'}</span>{milestone.title}</button>)}</div></article>) : <div className="studio-card studio-empty">Create one meaningful goal, then break it into finishable milestones.</div>}</div></section>}

    {section === 'Review' && <section className="studio-section review-section"><div className="review-metrics">{[['COMPLETION', `${review.snapshot.completionScore}%`], ['FOCUS', minutesLabel(review.snapshot.focusMinutes)], ['MOOD', review.snapshot.averageMood ? `${review.snapshot.averageMood}/5` : '—'], ['INTENTIONAL DROPS', review.snapshot.dropped]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><form className="studio-card review-form" onSubmit={saveReview}><div className="studio-card-head"><div><p className="eyebrow">WEEKLY REVIEW · {review.snapshot.weekStart} TO {review.snapshot.weekEnd}</p><h2>Turn evidence into a better week.</h2></div><label>Week rating<select value={reviewForm.rating} onChange={event => setReviewForm({ ...reviewForm, rating: Number(event.target.value) })}>{[1,2,3,4,5].map(value => <option key={value} value={value}>{value}/5</option>)}</select></label></div><label>What genuinely went well?<textarea value={reviewForm.wins} onChange={event => setReviewForm({ ...reviewForm, wins: event.target.value })} placeholder="Name progress, not perfection."/></label><label>What created friction?<textarea value={reviewForm.lessons} onChange={event => setReviewForm({ ...reviewForm, lessons: event.target.value })} placeholder="Overplanning, energy, environment, unclear tasks…"/></label><label>What deserves protection next week?<textarea value={reviewForm.nextWeekFocus} onChange={event => setReviewForm({ ...reviewForm, nextWeekFocus: event.target.value })} placeholder="One principle or priority for the next seven days."/></label><button className="studio-primary" disabled={busy}>Save weekly review →</button></form></section>}
  </main>;
}
