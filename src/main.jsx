import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/chakra-petch/latin-400.css';
import '@fontsource/chakra-petch/latin-500.css';
import '@fontsource/chakra-petch/latin-600.css';
import '@fontsource/chakra-petch/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-600.css';
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
import './impeccable.css';
import './today-density.css';
import './site-chrome.css';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
