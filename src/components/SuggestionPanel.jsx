import { useState } from 'react';
import { api } from '../api.js';

export default function SuggestionPanel({ token }) {
  const [consent, setConsent] = useState(false);
  const [query, setQuery] = useState('Suggest a manageable plan for today.');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function suggest(event) {
    event.preventDefault(); setBusy(true); setError(''); setResult(null);
    try { setResult(await api('/suggestions', { token, method: 'POST', body: { consent, query } })); }
    catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }
  return <details className="planning-extras"><summary>Optional AI planning suggestion</summary><form onSubmit={suggest} className="suggestion-form">
    <p>Searches your last 30 days of tasks, completed focus sessions, and weekly reflections. Up to eight relevant excerpts are sent to OpenAI only when you request a suggestion. Suggestions never change your tasks.</p>
    <label><input type="checkbox" checked={consent} onChange={event => { setConsent(event.target.checked); setResult(null); }}/>I agree to share those selected excerpts for this suggestion.</label>
    <label>What would help?<textarea required maxLength={500} value={query} onChange={event => setQuery(event.target.value)}/></label><button disabled={!consent || busy}>{busy ? 'Preparing suggestion…' : 'Suggest a plan'}</button>
  </form>{error && <p role="alert">{error}</p>}{result && <div role="status"><p style={{whiteSpace:'pre-wrap'}}>{result.suggestion || result.message}</p><h3>Retrieved sources</h3>{result.sources.map(source => <details key={source.id}><summary>{source.title} · {source.date.slice(0,10)}</summary><p>{source.text}</p><small>{source.id}</small></details>)}<p>Review the advice, then use Add task or Edit to apply only what you choose.</p></div>}</details>;
}
