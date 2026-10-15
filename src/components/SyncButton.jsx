import { useEffect, useRef, useState } from 'react';
import { ArrowsClockwise, Check, WarningCircle } from '@phosphor-icons/react';

export default function SyncButton({ onSync, raised }) {
  const running = useRef(false);
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (state !== 'success') return;
    const timer = setTimeout(() => { setMessage(''); setState('idle'); }, 6000);
    return () => clearTimeout(timer);
  }, [state]);
  async function sync() {
    if (running.current) return;
    running.current = true;
    setState('syncing');
    setMessage('Getting the latest tasks, routines, mood, and overview…');
    try {
      await onSync();
      setState('success');
      setMessage(`Up to date at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Website edits save automatically.`);
    } catch (error) {
      setState('error');
      setMessage(error.message || 'Could not sync. Please try again.');
    } finally { running.current = false; }
  }
  const Glyph = state === 'success' ? Check : state === 'error' ? WarningCircle : ArrowsClockwise;
  const label = state === 'syncing' ? 'Syncing…' : state === 'success' ? 'Synced' : state === 'error' ? 'Retry sync' : 'Sync';
  return <div className={`workspace-sync ${raised ? 'is-raised' : ''}`}>
    {message && <p className={`sync-message ${state === 'error' ? 'is-error' : ''}`} role="status">{message}</p>}
    <button type="button" className="workspace-sync-button" onClick={sync} disabled={state === 'syncing'} aria-label={state === 'syncing' ? 'Syncing workspace' : 'Sync workspace'} title="Refresh tasks, routines, mood, and overview from your account">
      <Glyph size={20} weight="bold" aria-hidden="true"/><span>{label}</span>
    </button>
  </div>;
}
