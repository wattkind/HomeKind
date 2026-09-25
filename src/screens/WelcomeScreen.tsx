import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { BrandMark, Wordmark } from '../components/Wordmark';
import { markFirstRunDone } from '../hooks/firstRun';

export function WelcomeScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Welcome · HomeKind';
  }, []);

  return (
    <main className="welcome" id="main">
      <BrandMark size={112} />
      <h1 className="welcome__title">
        <Wordmark />
      </h1>
      <ul className="welcome__lines">
        <li>Keep track of the things in your home, their manuals, receipts and warranties.</li>
        <li>Everything stays on this phone. There is no account and nothing is sent anywhere.</li>
        <li>Backups are your job. Make one from Settings and keep it somewhere safe.</li>
      </ul>
      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={() => {
          markFirstRunDone();
          navigate('/', { replace: true });
        }}
      >
        Get started
      </button>
    </main>
  );
}
