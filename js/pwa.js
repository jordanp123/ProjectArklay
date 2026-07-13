// Progressive-web-app glue: registers the service worker (which gives offline
// support), actively polls for a newer build, and — when one is ready — shows a
// non-blocking "Reload for update" toast so the user updates at a safe moment
// rather than having the page swapped out mid-circuit.
//
// Imported by app.js, so it is a same-origin module covered by the CSP's
// `script-src 'self'`. No inline styles: the toast is styled by .sw-toast in
// css/styles.css to satisfy `style-src 'self'` (no 'unsafe-inline').

// Guard: needs the API and a secure context (https or localhost). file:// etc.
// simply run online-only, with no error.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    // Was this page already under a worker's control when it loaded? If not,
    // the first controllerchange is just the initial claim on a brand-new
    // visit — NOT an update — so it must not trigger a reload. (Captured now,
    // before register() lets a first install activate and claim.)
    const hadController = !!navigator.serviceWorker.controller;

    // updateViaCache:'none' → always byte-check sw.js past the HTTP cache, so a
    // fixed build is noticed promptly (belt-and-suspenders with nginx no-cache).
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        // A worker may already be waiting from a previous visit.
        if (reg.waiting && navigator.serviceWorker.controller) {
          showUpdateToast(reg.waiting);
        }
        reg.addEventListener('updatefound', () => {
          const fresh = reg.installing;
          if (!fresh) return;
          fresh.addEventListener('statechange', () => {
            // "installed" + an existing controller ⇒ this is an UPDATE, not the
            // first install (first load is uncontrolled), so it's safe to offer.
            if (fresh.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateToast(fresh);
            }
          });
        });
      })
      .catch(() => { /* registration failed — the app still works while online */ });

    // Reload exactly once, when an ACCEPTED update takes control — but never on
    // the first-visit claim (hadController would be false then).
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !hadController) return;
      reloading = true;
      window.location.reload();
    });

    // A pinned app can stay open for days; poll for a newer build whenever it
    // returns to the foreground. This is the "always checking" the user asked
    // for; the browser also re-checks sw.js on every navigation.
    const poll = () => navigator.serviceWorker.getRegistration()
      .then((r) => r && r.update()).catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
    window.addEventListener('focus', poll);
  });
}

let toastEl = null;
function showUpdateToast(worker) {
  if (toastEl) return;                         // already showing
  const toast = document.createElement('div');
  toast.className = 'sw-toast';
  toast.setAttribute('role', 'status');

  const msg = document.createElement('span');
  msg.className = 'sw-toast-msg';
  msg.textContent = 'A newer version is available.';

  const reload = document.createElement('button');
  reload.type = 'button';
  reload.className = 'sw-toast-reload';
  reload.textContent = 'Reload';
  reload.addEventListener('click', () => {
    reload.disabled = true;
    // Tell the waiting worker to activate; controllerchange then reloads us.
    worker.postMessage({ type: 'SKIP_WAITING' });
  });

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'sw-toast-dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss');
  dismiss.textContent = '×';               // ×
  dismiss.addEventListener('click', () => {
    toast.remove();
    toastEl = null;
  });

  toast.append(msg, reload, dismiss);
  document.body.appendChild(toast);
  toastEl = toast;
  // Next frame → trigger the CSS slide-in transition.
  requestAnimationFrame(() => toast.classList.add('is-shown'));
}
