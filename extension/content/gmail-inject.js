const BTN_ID = "im-btn";

// Debug logging
function log(...args) {
  console.log("[Identity Mirror]", ...args);
}

function extractThreadText(maxMessages = 3) {
  const bodies = Array.from(document.querySelectorAll("div.a3s"));
  const cleaned = bodies
    .map((el) => (el.innerText || "").trim())
    .filter(Boolean)
    .map((t) => (t.length > 4000 ? t.slice(0, 4000) + "\n[TRUNCATED]" : t));
  return cleaned.slice(-maxMessages).join("\n\n---\n\n");
}

function findComposeBox(root = document) {
  // Try multiple selectors for Gmail compose box
  const selectors = [
    'div[role="textbox"][aria-label*="Message"]',
    'div[role="textbox"][aria-label*="Compose"]',
    'div[role="textbox"]',
    'div[contenteditable="true"][aria-label*="Message"]',
    'div[contenteditable="true"][aria-label*="Compose"]'
  ];

  for (const selector of selectors) {
    const boxes = root.querySelectorAll(selector);
    for (const b of boxes) {
      const r = b.getBoundingClientRect();
      if (r.width > 50 && r.height > 30 && r.top > 0) {
        log("Found compose box:", selector);
        return b;
      }
    }
  }
  log("Compose box not found");
  return null;
}

function findToolbarNear(box) {
  if (!box) return null;
  
  // Try multiple strategies to find toolbar
  let el = box;
  
  // Strategy 1: Look for toolbar in parent chain
  for (let i = 0; i < 10 && el; i++) {
    const toolbar = el.querySelector('div[role="toolbar"]');
    if (toolbar) {
      log("Found toolbar (strategy 1)");
      return toolbar;
    }
    el = el.parentElement;
  }
  
  // Strategy 2: Look for button container near compose box
  el = box;
  for (let i = 0; i < 10 && el; i++) {
    // Gmail's send button container
    const sendContainer = el.querySelector('div[role="button"][aria-label*="Send"]')?.parentElement;
    if (sendContainer) {
      log("Found toolbar (strategy 2 - send button parent)");
      return sendContainer;
    }
    
    // Alternative: find any div with buttons
    const withButtons = el.querySelector('div:has(button), div:has([role="button"])');
    if (withButtons && withButtons.querySelectorAll('button, [role="button"]').length >= 2) {
      log("Found toolbar (strategy 2 - button container)");
      return withButtons;
    }
    
    el = el.parentElement;
  }
  
  // Strategy 3: Create our own container if nothing found
  log("No toolbar found, will create container");
  return null;
}

async function getConfig() {
  const { apiBase, token } = await chrome.storage.local.get(["apiBase", "token"]);
  // ✅ CHANGE: Default to production URL (update with your actual domain)
  return { apiBase: apiBase || "https://api.yourdomain.com", token: token || "" };
}

async function callMirror(context, incomingMessage) {
  const { apiBase, token } = await getConfig();
  if (!token) throw new Error("No token set. Open extension popup and paste token.");

  let res;
  try {
    res = await fetch(`${apiBase}/api/ext/mirror`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ context, incomingMessage }),
      // ✅ ADD: Timeout handling
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });
  } catch (fetchError) {
    // ✅ Network/timeout errors
    if (fetchError.name === 'TimeoutError' || fetchError.name === 'AbortError') {
      throw new Error("Request timed out. Please check your connection and try again.");
    }
    if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError')) {
      throw new Error("Network error. Please check your internet connection.");
    }
    throw fetchError;
  }

  const json = await res.json().catch(() => ({}));
  
  if (!res.ok) {
    // ✅ Specific error messages
    if (res.status === 401) {
      throw new Error("Token expired or invalid. Please update your token in extension popup.");
    }
    if (res.status === 404) {
      throw new Error("Identity not found. Please create your identity on the website first.");
    }
    if (res.status === 429) {
      throw new Error("Daily quota exceeded. Try again tomorrow or upgrade your plan.");
    }
    if (res.status === 500 || res.status === 502 || res.status === 503) {
      throw new Error("Server error. Please try again in a few moments.");
    }
    throw new Error(json.error || `HTTP ${res.status}: ${json.message || 'Unknown error'}`);
  }
  
  return json;
}

async function callTrust(mirrorRunId, event) {
  const { apiBase, token } = await getConfig();
  const res = await fetch(`${apiBase}/api/ext/trust/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ mirrorRunId, event })
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

function openModal({ decision, decisionReason, reply, mirrorRunId, validatorStatus, validatorViolations = [], onInsert, onClose }) {
  const backdrop = document.createElement("div");
  backdrop.id = "im-modal-backdrop";

  const modal = document.createElement("div");
  modal.id = "im-modal";

  // Show validator warning if failed
  const hasValidatorWarning = validatorStatus === 'fail' && validatorViolations.length > 0;
  const validatorWarningHtml = hasValidatorWarning 
    ? `<div id="im-modal-validator-warning">
         <strong>⚠️ Validation Warning:</strong> This reply may violate some identity rules:
         <ul>
           ${validatorViolations.map(v => `<li>${v}</li>`).join('')}
         </ul>
         <small>Please review before sending.</small>
       </div>`
    : '';

  modal.innerHTML = `
    <div id="im-modal-header">
      <h3>Identity Mirror</h3>
      <button id="im-modal-close-btn">×</button>
    </div>
    <div id="im-modal-body">
      <div id="im-modal-decision">
        <strong>Decision:</strong> ${decision || "reply"}${decisionReason ? ` — ${decisionReason}` : ""}
        ${validatorStatus === 'pass' ? ' <span style="color: #48bb78; font-size: 12px;">✓ Validated</span>' : ''}
      </div>
      ${validatorWarningHtml}
      <textarea id="im-reply" placeholder="Your AI-generated reply will appear here..."></textarea>
    </div>
    <div id="im-modal-footer">
      <button id="im-insert">💬 Insert Reply</button>
      <button id="im-like">👍 This is me</button>
      <button id="im-dislike">👎 Not me</button>
      <button id="im-close">Close</button>
    </div>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const ta = modal.querySelector("#im-reply");
  ta.value = reply || "";

  modal.querySelector("#im-insert").onclick = () => {
    onInsert(ta.value);
    modal.classList.add("success");
    setTimeout(() => onClose(), 300);
  };
  
  modal.querySelector("#im-modal-close-btn").onclick = () => onClose();
  modal.querySelector("#im-close").onclick = () => onClose();

  if (mirrorRunId) {
    modal.querySelector("#im-like").onclick = async () => {
      try {
        await callTrust(mirrorRunId, "confirm_yes");
        modal.querySelector("#im-like").textContent = "✓ Saved!";
        modal.querySelector("#im-like").style.background = "#48bb78";
        setTimeout(() => {
          modal.querySelector("#im-like").textContent = "👍 This is me";
          modal.querySelector("#im-like").style.background = "";
        }, 2000);
      } catch (e) {
        alert(e.message || String(e));
      }
    };

    modal.querySelector("#im-dislike").onclick = async () => {
      try {
        await callTrust(mirrorRunId, "confirm_no");
        modal.querySelector("#im-dislike").textContent = "✓ Saved!";
        modal.querySelector("#im-dislike").style.background = "#f56565";
        setTimeout(() => {
          modal.querySelector("#im-dislike").textContent = "👎 Not me";
          modal.querySelector("#im-dislike").style.background = "";
        }, 2000);
      } catch (e) {
        alert(e.message || String(e));
      }
    };
  } else {
    modal.querySelector("#im-like").style.display = "none";
    modal.querySelector("#im-dislike").style.display = "none";
  }

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) onClose();
  });

  // Focus textarea
  setTimeout(() => ta.focus(), 100);
}

function insertTextIntoCompose(box, text) {
  box.focus();
  box.textContent = text;
  const ev = new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: text });
  box.dispatchEvent(ev);
}

function ensureButton() {
  const box = findComposeBox();
  if (!box) {
    // Only log occasionally to avoid spam
    if (Math.random() < 0.01) log("Waiting for compose box...");
    return;
  }

  let toolbar = findToolbarNear(box);
  
  // If no toolbar found, create our own container
  if (!toolbar) {
    // Try to find a parent container to attach to
    let parent = box;
    for (let i = 0; i < 5 && parent; i++) {
      if (parent.style && parent.offsetHeight > 100) {
        toolbar = parent;
        break;
      }
      parent = parent.parentElement;
    }
    
    if (!toolbar) {
      log("Could not find or create toolbar container");
      return;
    }
  }

  if (toolbar.querySelector(`#${BTN_ID}`)) {
    return; // Already exists
  }

  log("Creating Mirror button");

  const btn = document.createElement("button");
  btn.id = BTN_ID;
  btn.type = "button";
  btn.style.cssText = `
    margin-left: 8px;
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
  `;

  btn.innerHTML = `✨ Mirror`;

  btn.onmouseenter = () => {
    btn.style.transform = "translateY(-2px)";
    btn.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.4)";
  };

  btn.onmouseleave = () => {
    btn.style.transform = "translateY(0)";
    btn.style.boxShadow = "0 2px 8px rgba(102, 126, 234, 0.3)";
  };

  btn.onclick = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    const oldText = btn.textContent;
    btn.textContent = "Loading…";
    btn.disabled = true;

    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        const incoming = extractThreadText(3);
        if (!incoming || !incoming.trim()) {
          alert("Couldn't extract the thread. Please open an email thread and try again.");
          btn.textContent = oldText;
          btn.disabled = false;
          return;
        }

        log("Calling mirror API... (attempt " + (retries + 1) + ")");
        const result = await callMirror("email", incoming.trim());
        log("Mirror response:", result);

        openModal({
          decision: result.decision,
          decisionReason: result.decisionReason,
          reply: result.reply,
          mirrorRunId: result.mirrorRunId,
          validatorStatus: result.validatorStatus,
          validatorViolations: result.validatorViolations || [],
          onInsert: (text) => {
            insertTextIntoCompose(box, text);
            document.getElementById("im-modal-backdrop")?.remove();
          },
          onClose: () => document.getElementById("im-modal-backdrop")?.remove()
        });
        
        // ✅ Success - break retry loop
        btn.textContent = oldText;
        btn.disabled = false;
        return;
        
      } catch (e) {
        log("Error (attempt " + (retries + 1) + "):", e);
        
        // ✅ Don't retry for certain errors
        const isNonRetryable = 
          e.message.includes("Token expired") ||
          e.message.includes("Identity not found") ||
          e.message.includes("quota exceeded") ||
          e.message.includes("Couldn't extract");
        
        if (isNonRetryable || retries >= maxRetries) {
          // ✅ Show user-friendly error
          const errorMsg = e.message || String(e);
          alert(`Error: ${errorMsg}`);
          btn.textContent = oldText;
          btn.disabled = false;
          return;
        }
        
        // ✅ Retry with exponential backoff
        retries++;
        await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // 1s, 2s delay
      }
    }
  };

  toolbar.appendChild(btn);
  log("Mirror button added successfully");
}

// Initialize
log("Content script loaded");

const obs = new MutationObserver(() => {
  ensureButton();
});

obs.observe(document.documentElement, { 
  childList: true, 
  subtree: true,
  attributes: false
});

// Run immediately
ensureButton();

// Also retry every 2 seconds as fallback
setInterval(() => {
  if (!document.querySelector(`#${BTN_ID}`)) {
    ensureButton();
  }
}, 2000);