async function getStored() {
  const { apiBase, token } = await chrome.storage.local.get(["apiBase", "token"]);
  // ✅ CHANGE: Default to production URL (update with your actual domain)
  return { apiBase: apiBase || "https://api.yourdomain.com", token: token || "" };
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

  // ✅ NEW: Check connection status on load
  async function checkConnectionStatus() {
    const statusDiv = document.getElementById("connection-status");
    const statusInfo = document.getElementById("status-info");
    const disconnectBtn = document.getElementById("disconnect-btn");
    
    if (!stored.token) {
      if (statusDiv) statusDiv.style.display = "none";
      return;
    }
    
    if (statusDiv) statusDiv.style.display = "block";
    if (statusInfo) {
      statusInfo.textContent = "Checking connection...";
      statusInfo.className = "small";
    }
    
    try {
      const res = await fetch(`${stored.apiBase}/api/ext/identity/active`, {
        headers: { Authorization: `Bearer ${stored.token}` }
      });
      const json = await res.json().catch(() => ({}));
      
      if (res.ok && json.identity) {
        if (statusInfo) {
          statusInfo.textContent = `✓ Connected: ${json.identity.displayName || 'Identity'}`;
          statusInfo.className = "small ok";
        }
        if (disconnectBtn) disconnectBtn.style.display = "block";
      } else if (res.ok) {
        if (statusInfo) {
          statusInfo.textContent = "✓ Connected (no identity found)";
          statusInfo.className = "small ok";
        }
        if (disconnectBtn) disconnectBtn.style.display = "block";
      } else {
        if (statusInfo) {
          statusInfo.textContent = "✗ Token invalid or expired";
          statusInfo.className = "small err";
        }
        if (disconnectBtn) disconnectBtn.style.display = "none";
      }
    } catch (e) {
      if (statusInfo) {
        statusInfo.textContent = `✗ Connection failed: ${e.message || 'Unknown error'}`;
        statusInfo.className = "small err";
      }
      if (disconnectBtn) disconnectBtn.style.display = "none";
    }
  }
  
  // ✅ Disconnect button handler
  const disconnectBtn = document.getElementById("disconnect-btn");
  if (disconnectBtn) {
    disconnectBtn.addEventListener("click", async () => {
      if (confirm("Disconnect and clear token?")) {
        await chrome.storage.local.remove(["token"]);
        tokenEl.value = "";
        checkConnectionStatus();
      }
    });
  }
  
  // ✅ Check status on load
  checkConnectionStatus();

  document.getElementById("save").addEventListener("click", async () => {
    const base = apiBaseEl.value.trim();
    const token = tokenEl.value.trim();

    // ✅ CHANGE: Update allowed patterns to include production domain
    const allowedPatterns = [
      /^http:\/\/localhost:\d+$/,                    // Localhost for dev
      /^https:\/\/api\.yourdomain\.com$/,            // Production API
      /^https:\/\/.*\.yourdomain\.com$/,             // Subdomains
      /^https:\/\/yourdomain\.com$/,                 // Root domain
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

