(function() {
  const script = document.currentScript;
  const API_BASE = script.getAttribute('data-api-base') || '';
  const CREATOR_ID = script.getAttribute('data-creator-id') || '';
  const COLOR = script.getAttribute('data-color') || '#2563eb';
  const POSITION = script.getAttribute('data-position') || 'bottom-right';
  const TITLE = script.getAttribute('data-title') || 'Chat with AI';
  const AVATAR_URL = script.getAttribute('data-avatar-url') || '';
  const VOICE_ENABLED = script.getAttribute('data-voice-enabled') === 'true';

  if (!API_BASE || !CREATOR_ID) {
    console.error('[Selflyx Widget] Missing data-api-base or data-creator-id');
    return;
  }

  // Create widget container
  const container = document.createElement('div');
  container.id = 'selflyx-widget-container';
  container.innerHTML = `
    <button id="selflyx-widget-btn" style="background:${COLOR}">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
    </button>
    <div id="selflyx-widget-panel" class="selflyx-hidden">
      <div id="selflyx-widget-header">
        ${AVATAR_URL ? `<img id="selflyx-widget-avatar" src="${AVATAR_URL}" alt="Avatar" />` : ''}
        <span>${TITLE}</span>
        <button id="selflyx-widget-close">&times;</button>
      </div>
      <div id="selflyx-widget-messages"></div>
      <div id="selflyx-widget-input-container">
        <input type="text" id="selflyx-widget-input" placeholder="Type a message..." />
        <button id="selflyx-widget-send" style="background:${COLOR}">Send</button>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  // Position
  const posStyle = POSITION === 'bottom-left' ? 'left:20px;right:auto;' : 'right:20px;left:auto;';
  container.style.cssText = `position:fixed;bottom:20px;${posStyle}z-index:999999;`;

  const btn = document.getElementById('selflyx-widget-btn');
  const panel = document.getElementById('selflyx-widget-panel');
  const closeBtn = document.getElementById('selflyx-widget-close');
  const input = document.getElementById('selflyx-widget-input');
  const sendBtn = document.getElementById('selflyx-widget-send');
  const messagesDiv = document.getElementById('selflyx-widget-messages');

  btn.onclick = () => {
    panel.classList.toggle('selflyx-hidden');
    btn.classList.toggle('selflyx-hidden');
    if (!panel.classList.contains('selflyx-hidden')) input.focus();
  };

  closeBtn.onclick = () => {
    panel.classList.add('selflyx-hidden');
    btn.classList.remove('selflyx-hidden');
  };

  function addMessage(text, isUser, audioUrl) {
    const msg = document.createElement('div');
    msg.className = isUser ? 'selflyx-msg selflyx-msg-user' : 'selflyx-msg selflyx-msg-bot';
    msg.textContent = text;
    messagesDiv.appendChild(msg);

    // Add audio player if voice is available
    if (audioUrl && !isUser) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = audioUrl;
      audio.style.cssText = 'width:100%;margin-top:8px;';
      msg.appendChild(audio);
      // Auto-play
      audio.play().catch(() => {});
    }

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMessage(text, true);

    try {
      const res = await fetch(`${API_BASE}/api/widget/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: CREATOR_ID,
          message: text,
          voiceEnabled: VOICE_ENABLED
        }),
      });
      const data = await res.json();
      if (data.reply) {
        addMessage(data.reply, false, data.audioUrl);
      } else {
        addMessage('Sorry, I could not respond.', false);
      }
    } catch (e) {
      addMessage('Error connecting to server.', false);
    }
  }

  sendBtn.onclick = sendMessage;
  input.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };
})();
