import { CalendarBlank, ChartLineUp, CheckCircle, House, Moon, Repeat, Smiley, Sun, Target } from '@phosphor-icons/react';
export const workspaceNavigation = [
  ['Overview', House],
  ['Plan', Target],
  ['Today', CheckCircle],
  ['Routines', Repeat],
  ['Mood', Smiley],
  ['Calendar', CalendarBlank],
  ['Insights', ChartLineUp],
];

export function ThemeGlyph({ dark }) { return dark ? <Sun aria-hidden="true" size={19} weight="bold"/> : <Moon aria-hidden="true" size={19} weight="bold"/>; }
export function WorkspaceLinks({ active, onNavigate }) {
  return <nav className="workspace-links" aria-label="Tracker pages">{workspaceNavigation.map(([item, NavigationIcon]) => <button key={item} className={active === item ? 'selected' : ''} aria-current={active === item ? 'page' : undefined} onClick={() => onNavigate(item)}><NavigationIcon aria-hidden="true" size={17} weight="bold"/><span>{item}</span></button>)}</nav>;
}
