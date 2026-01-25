async function getStored() {
  const { apiBase, token } = await chrome.storage.local.get(["apiBase", "token"]);
  return { apiBase: apiBase || "http://localhost:3000", token: token || "" };
}

async function setStored(apiBase, token) {
  await chrome.storage.local.set({ apiBase, token });
}

document.addEventListener("DOMContentLoaded", async () => {
  const apiBaseEl = document.getElementById("apiBase");
  const tokenEl = document.getElementById("token");
  const statusEl = document.getElementById("status");
  const pingResultEl = document.getElementById("pingResult");

  const stored = await getStored();
  apiBaseEl.value = stored.apiBase;
  tokenEl.value = stored.token;

  document.getElementById("save").addEventListener("click", async () => {
    const base = apiBaseEl.value.trim();
    const token = tokenEl.value.trim();

    // Validate API base URL (allow localhost for dev, or your production domain)
    const allowedPatterns = [
      /^http:\/\/localhost:\d+$/,
      /^https:\/\/yourdomain\.com$/,
      /^https:\/\/.*\.yourdomain\.com$/  // Allow subdomains
    ];

    const isValid = allowedPatterns.some(pattern => pattern.test(base));

    if (!isValid) {
      statusEl.textContent = "Invalid API Base URL. Allowed: localhost or yourdomain.com";
      statusEl.className = "small err";
      return;
    }

    await setStored(base, token);
    statusEl.textContent = "Saved.";
    statusEl.className = "small ok";
  });

  document.getElementById("ping").addEventListener("click", async () => {
    pingResultEl.textContent = "Testing…";
    pingResultEl.className = "small";

    try {
      const { apiBase, token } = await getStored();
      const res = await fetch(`${apiBase}/api/ext/identity/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

      pingResultEl.textContent = json.identity
        ? `Connected: ${json.identity.displayName} (${json.identity.primaryUse || "identity"})`
        : "Connected, but no identity found.";
      pingResultEl.className = "small ok";
    } catch (e) {
      pingResultEl.textContent = `Failed: ${e.message || String(e)}`;
      pingResultEl.className = "small err";
    }
  });
});

