import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './theme-overrides.css';
import './insights.css';
import './pages.css';
import './analytics-charts.css';
import './gold-graph-theme.css';
import './product-refresh.css';
import './productivity.css';
import './celebration.css';
import './planner-enhancements.css';
import './recovery.css';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
