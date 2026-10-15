import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { isTradeMeUrl } from '@/utils/trademe';
import './App.css';

type Status = 'checking' | 'attached' | 'detached' | 'error';

const messages: Record<Status, { title: string; detail: string }> = {
  checking: { title: 'Checking connection...', detail: 'Checking the active tab.' },
  attached: { title: 'Attached to Trade Me', detail: 'The active tab is on trademe.co.nz.' },
  detached: {
    title: 'Not attached to Trade Me',
    detail: 'Open Trade Me in this tab to get started.',
  },
  error: {
    title: 'Unable to check connection',
    detail: 'Close and reopen this popup to try again.',
  },
};

function App() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let cancelled = false;

    async function checkActiveTab() {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (!cancelled) setStatus(isTradeMeUrl(tab?.url) ? 'attached' : 'detached');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    void checkActiveTab();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <h1>Trade Me Plus</h1>
      <section className={`status status--${status}`} role='status' aria-live='polite'>
        <span className='status-dot' aria-hidden='true' />
        <div>
          <h2>{messages[status].title}</h2>
          <p>{messages[status].detail}</p>
        </div>
      </section>
    </main>
  );
}

export default App;
