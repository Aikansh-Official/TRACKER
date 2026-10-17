import { useEffect, useRef, useState } from 'react';
import { Archive, AndroidLogo, Check, Clock, Info, List, MagnifyingGlass, SignOut, X } from '@phosphor-icons/react';
import { workspaceNavigation, ThemeGlyph } from './WorkspaceNavigation.jsx';

const pages = [...workspaceNavigation, ['Pending', Clock], ['Archive', Archive], ['About', Info]];
export default function WorkspaceShell({ children, active, onNavigate, dark, onTheme, onSignOut, user }) {
  const sidebar = useRef(null);
  const menuButton = useRef(null);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width:850px)').matches);
  const [open, setOpen] = useState(false);
  useEffect(() => { const query = window.matchMedia('(max-width:850px)'); const update = () => setMobile(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  useEffect(() => {
    if (!open || !mobile) return;
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    sidebar.current?.querySelector('button,a')?.focus();
    return () => { document.body.style.overflow = previous; menuButton.current?.focus(); };
  }, [open, mobile]);
  const [query, setQuery] = useState('');
  const go = page => { onNavigate(page); setOpen(false); setQuery(''); };
  const results = pages.filter(([name]) => name.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className={`workspace-shell ${dark ? 'dark' : ''}`} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); setQuery(''); } }}>
    <a className="workspace-skip" href="#workspace-content" onClick={event => { event.preventDefault(); document.getElementById('workspace-content')?.focus(); }}>Skip to content</a>
    {open && mobile && <button className="workspace-nav-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)}/>}
    <aside ref={sidebar} role={mobile && open ? 'dialog' : undefined} aria-modal={mobile && open ? true : undefined} aria-label="Workspace navigation" onKeyDown={event => { if (event.key !== 'Tab' || !mobile || !open) return; const controls = [...sidebar.current.querySelectorAll('a,button')].filter(node => node.getClientRects().length); const first = controls[0]; const last = controls.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }} className={`workspace-sidebar ${open ? 'is-open' : ''}`} id="workspace-sidebar">
      <button className="workspace-nav-close" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={20}/></button>
      <a className="workspace-logo" href="#Overview" onClick={() => go('Overview')}><span><Check size={20} weight="bold"/></span>TRACKER</a>
      <div className="workspace-label">Workspace</div><div className="workspace-personal"><span className="workspace-avatar">{user?.name?.slice(0,1)?.toUpperCase() || 'T'}</span><div><strong>Personal workspace</strong><small>Your space to make progress</small></div></div>
      <nav aria-label="Main navigation">{pages.map(([name, Glyph]) => <a key={name} href={`#${name}`} className={`${active === name ? 'is-active' : ''} ${name === 'About' ? 'nav-separated' : ''}`} aria-current={active === name ? 'page' : undefined} onClick={() => go(name)}><Glyph size={18}/><span>{name}</span></a>)}</nav>
      <a className="workspace-app-link" href="https://github.com/Aikansh-Official/TRACKER/releases/tag/android-v2.1.1" target="_blank" rel="noreferrer"><AndroidLogo size={19}/><span>Get the Android app<small>Take your progress with you ↗</small></span></a>
      <div className="workspace-account"><span className="workspace-avatar">{user?.name?.slice(0,1)?.toUpperCase() || 'T'}</span><span><strong>{user?.name || 'Your account'}</strong><small>Personal account</small></span><button onClick={onSignOut} aria-label="Sign out"><SignOut size={18}/></button></div>
    </aside>
    <div className="workspace-body" inert={mobile && open ? true : undefined}><header className="workspace-topbar"><button ref={menuButton} className="workspace-menu" onClick={() => setOpen(value => !value)} aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="workspace-sidebar">{open ? <X size={21}/> : <List size={21}/>}</button><div className="workspace-breadcrumb">Workspace <span>/</span> <strong>{active}</strong></div><div className="workspace-top-actions"><div className="workspace-search"><MagnifyingGlass size={17}/><input type="search" placeholder="Find a page…" aria-label="Find a page" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && results.length) { event.preventDefault(); go(results[0][0]); } }}/>{query.trim() && <div className="workspace-search-results">{results.length ? results.map(([name, Glyph]) => <a href={`#${name}`} onClick={() => go(name)} key={name}><Glyph size={16}/>{name}<span>↗</span></a>) : <p>No matching pages</p>}</div>}</div><button className="workspace-theme" onClick={onTheme} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}><ThemeGlyph dark={dark}/></button></div></header><div className="workspace-page-container" id="workspace-content" tabIndex={-1}>{children}</div></div>
  </div>;
}
