import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

let reloadingForUpdate = false;
const hadController =
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  Boolean(navigator.serviceWorker.controller);

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloadingForUpdate) return;
    reloadingForUpdate = true;
    window.location.reload();
  });
}

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    const checkUpdate = () => {
      registration.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkUpdate();
      }
    });
    window.setInterval(checkUpdate, 15 * 60 * 1000);
  },
});

createRoot(document.getElementById('root')!).render(<App />);
