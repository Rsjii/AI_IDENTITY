(function () {
  'use strict';

  function safeString(x) {
    try { return typeof x === 'string' ? x : JSON.stringify(x); } catch { return String(x); }
  }

  function showToast(message, type) {
    if (window.UI && typeof window.UI.showToast === 'function') {
      window.UI.showToast(message, type || 'error');
      return;
    }
    // fallback
    console.error('[UI Toast Missing]', message);
    alert(message);
  }

  window.AppError = {
    notify(err, fallbackMsg) {
      const msg = err && err.message ? err.message : (fallbackMsg || 'Something went wrong.');
      showToast(msg, 'error');
    },

    async parseJsonSafe(res) {
      try {
        return await res.json();
      } catch {
        return null;
      }
    },

    async fetchJson(url, opts) {
      const res = await fetch(url, opts);
      const data = await window.AppError.parseJsonSafe(res);

      if (!res.ok) {
        const msg =
          (data && (data.error || data.message)) ||
          `Request failed (${res.status})`;
        const e = new Error(msg);
        e.status = res.status;
        e.data = data;
        throw e;
      }

      return data;
    },
  };
})();
















