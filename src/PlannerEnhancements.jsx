import { useEffect, useMemo, useRef, useState } from 'react';
import { api, localDateKey } from './api.js';

const defaultCapture = () => ({ title: '', itemType: 'TASK', scheduledDate: localDateKey(), allDay: true, startTime: '', deadline: '', estimatedMinutes: 30, priority: 'MEDIUM', reminderMinutes: '', recurrenceFrequency: 'NONE', recurrenceInterval: 1, recurrenceEndDate: '', recurrenceWeekdays: [], subtasks: '' });

export function QuickCapture({ token, dark, onChanged, notify }) {
  const [open, setOpen] = useState(false); const [form, setForm] = useState(defaultCapture); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const panelRef = useRef(null); const triggerRef = useRef(null); const savePending = useRef(false);
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; triggerRef.current?.focus(); };
  }, [open]);
  const close = () => { if (!savePending.current) setOpen(false); };
  const keyboard = event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const controls = [...panelRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')];
    const first = controls[0]; const last = controls.at(-1);
    if (!first) return event.preventDefault();
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const submit = async event => {
    event.preventDefault();
    if (savePending.current) return;
    setError('');
    if (!form.title.trim()) return setError('Give this item a clear title.');
    if (!form.allDay && form.itemType === 'EVENT' && form.deadline && form.deadline <= form.startTime) return setError('The end time must be after the start time.');
    savePending.current = true; setBusy(true);
    try {
      const payload = { ...form, reminderMinutes: form.reminderMinutes === '' ? null : Number(form.reminderMinutes), subtasks: form.subtasks.split('\n').map(value => value.trim()).filter(Boolean), recurrence: { frequency: form.recurrenceFrequency, interval: Number(form.recurrenceInterval || 1), endDate: form.recurrenceEndDate || null, weekdays: form.recurrenceWeekdays } };
      await api('/tasks', { token, method: 'POST', body: payload }); setForm(defaultCapture()); setOpen(false);
      notify(form.recurrenceFrequency === 'NONE' ? 'Added to your plan' : 'Recurring series added to your calendar');
      try { await onChanged(); } catch { notify('Your item was saved. Sync to refresh the list.'); }
    } catch (caught) { setError(caught.message); } finally { savePending.current = false; setBusy(false); }
  };
  const toggleDay = value => setForm(current => ({ ...current, recurrenceWeekdays: current.recurrenceWeekdays.includes(value) ? current.recurrenceWeekdays.filter(day => day !== value) : [...current.recurrenceWeekdays, value] }));
  return <><button ref={triggerRef} disabled={busy} className="quick-capture-button" onClick={() => { if (!form.title.trim()) setForm(current => ({ ...current, scheduledDate: localDateKey() })); setOpen(true); }} aria-label="Quick capture a task or event"><b>＋</b><span>Quick add</span></button>{open && <div className={`quick-capture-backdrop ${dark ? 'dark' : ''}`} onMouseDown={close}><form ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="quick-capture-title" onKeyDown={keyboard} className="quick-capture-panel" onSubmit={submit} onMouseDown={event => event.stopPropagation()}><header><div><p>QUICK CAPTURE</p><h2 id="quick-capture-title">Add to your plan.</h2></div><button type="button" disabled={busy} onClick={close} aria-label="Close quick capture">×</button></header><div className="capture-type"><button type="button" disabled={busy} className={form.itemType === 'TASK' ? 'selected' : ''} onClick={() => setForm({...form,itemType:'TASK'})}>Task</button><button type="button" disabled={busy} className={form.itemType === 'EVENT' ? 'selected' : ''} onClick={() => setForm({...form,itemType:'EVENT'})}>Event</button></div><label>What needs your attention?<input disabled={busy} autoFocus required maxLength="120" value={form.title} onChange={event => setForm({...form,title:event.target.value})} placeholder="e.g. Submit operating systems assignment"/></label><div className="capture-grid"><label>Date<input disabled={busy} type="date" required value={form.scheduledDate} onChange={event => setForm({...form,scheduledDate:event.target.value})}/></label><label>Repeat<select disabled={busy} value={form.recurrenceFrequency} onChange={event => setForm({...form,recurrenceFrequency:event.target.value})}><option value="NONE">Does not repeat</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option></select></label></div>{form.recurrenceFrequency !== 'NONE' && <div className="recurrence-box"><label>Every<input disabled={busy} type="number" required min="1" max="30" value={form.recurrenceInterval} onChange={event => setForm({...form,recurrenceInterval:event.target.value})}/><span>{form.recurrenceFrequency.toLowerCase().replace('daily','day').replace('weekly','week').replace('monthly','month')}(s)</span></label>{form.recurrenceFrequency === 'WEEKLY' && <div className="capture-weekdays">{[['S',0],['M',1],['T',2],['W',3],['T',4],['F',5],['S',6]].map(([label,value]) => <button type="button" disabled={busy} className={form.recurrenceWeekdays.includes(value) ? 'selected' : ''} aria-pressed={form.recurrenceWeekdays.includes(value)} aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][value]} onClick={() => toggleDay(value)} key={value}>{label}</button>)}</div>}<label>Repeat until <span>optional</span><input disabled={busy} type="date" min={form.scheduledDate} value={form.recurrenceEndDate} onChange={event => setForm({...form,recurrenceEndDate:event.target.value})}/></label></div>}<label className="capture-all-day"><input disabled={busy} type="checkbox" checked={form.allDay} onChange={event => setForm({...form,allDay:event.target.checked})}/><span>All day</span></label>{!form.allDay && <div className="capture-grid">{form.itemType === 'EVENT' && <label>Starts<input disabled={busy} type="time" required value={form.startTime} onChange={event => setForm({...form,startTime:event.target.value})}/></label>}<label>{form.itemType === 'EVENT' ? 'Ends' : 'Deadline'}<input disabled={busy} type="time" required={form.itemType === 'TASK'} value={form.deadline} onChange={event => setForm({...form,deadline:event.target.value})}/></label></div>}<div className="capture-grid"><label>Reminder<select disabled={busy} value={form.reminderMinutes} onChange={event => setForm({...form,reminderMinutes:event.target.value})}><option value="">No reminder</option><option value="0">{form.allDay ? 'On the day at 9:00 AM' : 'At start/deadline'}</option><option value="10">10 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select></label>{form.itemType === 'TASK' && <label>Estimate<input disabled={busy} type="number" required min="5" max="480" value={form.estimatedMinutes} onChange={event => setForm({...form,estimatedMinutes:event.target.value})}/></label>}</div>{form.itemType === 'TASK' && <label>Checklist <span>one step per line</span><textarea disabled={busy} value={form.subtasks} onChange={event => setForm({...form,subtasks:event.target.value})} placeholder={'Read requirements\nDraft solution\nReview and submit'}/></label>}{error && <p className="capture-error" role="alert">{error}</p>}<button className="capture-save" disabled={busy}>{busy ? 'Saving…' : 'Add to TRACKER →'}</button></form></div>}</>;
}

export function ReminderCenter({ tasks, dark, notify }) {
  const [open, setOpen] = useState(false); const [clock, setClock] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const upcoming = useMemo(() => tasks.filter(task => !['COMPLETED','SKIPPED','DROPPED','DELEGATED','ARCHIVED'].includes(task.status) && task.reminderMinutes !== null && task.reminderMinutes !== undefined).map(task => { const time = task.startTime || task.deadline || '09:00'; const at = new Date(`${task.scheduledDate}T${time}:00`).getTime(); return { ...task, at, remindAt: at - Number(task.reminderMinutes || 0) * 60000 }; }).filter(task => task.at >= clock - 3600000 && task.remindAt <= clock + 86400000).sort((a,b) => a.at-b.at), [tasks, clock]);
  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    upcoming.filter(task => task.remindAt <= clock && task.at >= clock - 60000).forEach(task => {
      const key = `tracker-reminded:${task._id}:${task.remindAt}`;
      try {
        if (sessionStorage.getItem(key)) return;
        new Notification(task.title, { body: `${task.itemType === 'EVENT' ? 'Event' : 'Task'} · ${task.startTime || task.deadline || 'all day'}` });
        sessionStorage.setItem(key, '1');
      } catch { /* In-page reminders remain available when system notifications are unsupported. */ }
    });
  }, [upcoming, clock]);
  const enable = async () => {
    if (!('Notification' in window)) return notify('This browser does not support notifications. Reminders are still available here.');
    try {
      const permission = await Notification.requestPermission();
      notify(permission === 'granted' ? 'Browser reminders enabled while TRACKER is open' : 'Reminders remain inside TRACKER');
    } catch { notify('Browser notifications are unavailable. Reminders are still available here.'); }
  };
  return <div className={`reminder-center reminder-inline ${dark ? 'dark' : ''}`}><button className="reminder-button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label="Open reminders"><span>Reminders</span>{upcoming.length > 0 && <b>{upcoming.length}</b>}</button>{open && <aside><header><div><p>REMINDERS</p><h3>Nothing important slips quietly.</h3></div><button onClick={() => setOpen(false)} aria-label="Close reminders">×</button></header>{upcoming.length ? upcoming.slice(0,8).map(task => <article key={task._id}><b>{task.title}</b><span>{new Date(task.at).toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</span></article>) : <p className="reminder-empty">No reminders in the next 24 hours.</p>}<button className="enable-reminders" onClick={enable}>Enable browser notifications</button></aside>}</div>;
}

