import { useState } from 'react';
import { Archive, AndroidLogo, Check, Clock, Info, List, MagnifyingGlass, SignOut, X } from '@phosphor-icons/react';
import { workspaceNavigation, ThemeGlyph } from './WorkspaceNavigation.jsx';

const pages = [...workspaceNavigation, ['Pending', Clock], ['Archive', Archive], ['About', Info]];
export default function WorkspaceShell({ children, active, onNavigate, dark, onTheme, onSignOut, user }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const go = page => { onNavigate(page); setOpen(false); setQuery(''); };
  const results = pages.filter(([name]) => name.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className={`workspace-shell ${dark ? 'dark' : ''}`} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); setQuery(''); } }}>
    <a className="workspace-skip" href="#workspace-content" onClick={event => { event.preventDefault(); document.getElementById('workspace-content')?.focus(); }}>Skip to content</a>
    <aside className={`workspace-sidebar ${open ? 'is-open' : ''}`} id="workspace-sidebar">
      <a className="workspace-logo" href="#Overview" onClick={() => go('Overview')}><span><Check size={20} weight="bold"/></span>TRACKER</a>
      <div className="workspace-label">Workspace</div><div className="workspace-personal"><span className="workspace-avatar">{user?.name?.slice(0,1)?.toUpperCase() || 'T'}</span><div><strong>Personal workspace</strong><small>Your space to make progress</small></div></div>
      <nav aria-label="Main navigation">{pages.map(([name, Glyph]) => <a key={name} href={`#${name}`} className={`${active === name ? 'is-active' : ''} ${name === 'About' ? 'nav-separated' : ''}`} aria-current={active === name ? 'page' : undefined} onClick={() => go(name)}><Glyph size={18}/><span>{name}</span></a>)}</nav>
      <a className="workspace-app-link" href="https://github.com/Aikansh-Official/TRACKER/releases/tag/android-v2.1.0" target="_blank" rel="noreferrer"><AndroidLogo size={19}/><span>Get the Android app<small>Take your progress with you ↗</small></span></a>
      <div className="workspace-account"><span className="workspace-avatar">{user?.name?.slice(0,1)?.toUpperCase() || 'T'}</span><span><strong>{user?.name || 'Your account'}</strong><small>Personal account</small></span><button onClick={onSignOut} aria-label="Sign out"><SignOut size={18}/></button></div>
    </aside>
    <div className="workspace-body"><header className="workspace-topbar"><button className="workspace-menu" onClick={() => setOpen(value => !value)} aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="workspace-sidebar">{open ? <X size={21}/> : <List size={21}/>}</button><div className="workspace-breadcrumb">Workspace <span>/</span> <strong>{active}</strong></div><div className="workspace-top-actions"><div className="workspace-search"><MagnifyingGlass size={17}/><input type="search" placeholder="Find a page…" aria-label="Find a page" value={query} onChange={event => setQuery(event.target.value)}/>{query.trim() && <div className="workspace-search-results">{results.length ? results.map(([name, Glyph]) => <a href={`#${name}`} onClick={() => go(name)} key={name}><Glyph size={16}/>{name}<span>↗</span></a>) : <p>No matching pages</p>}</div>}</div><button className="workspace-theme" onClick={onTheme} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}><ThemeGlyph dark={dark}/></button></div></header><div className="workspace-page-container" id="workspace-content" tabIndex={-1}>{children}</div></div>
  </div>;
}
