import { useState } from 'react';
import { AndroidLogo, DownloadSimple } from '@phosphor-icons/react';
const key = 'tracker-download-dismissed-v1';
export default function AndroidDownloadBanner({ href }) {
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(key) === 'yes'; } catch { return false; } });
  if (dismissed) return null;
  function dismiss() { setDismissed(true); try { localStorage.setItem(key, 'yes'); } catch { /* Still dismiss for this view when storage is unavailable. */ } }
  return <div className="android-banner-wrap"><a className="android-download-banner" href={href} target="_blank" rel="noreferrer"><AndroidLogo aria-hidden="true" size={19}/><strong>Get the Android app</strong><span>Native Android · offline planning</span><DownloadSimple aria-hidden="true" size={18}/></a><button className="android-banner-close" aria-label="Dismiss Android download information" onClick={dismiss}>×</button></div>;
}
