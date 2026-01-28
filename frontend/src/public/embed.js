(function() {
  const script = document.currentScript;
  const API_BASE = script.getAttribute('data-api-base') || '';
  const CREATOR_ID = script.getAttribute('data-creator-id') || '';
  const COLOR = script.getAttribute('data-color') || '#2563eb';
  const POSITION = script.getAttribute('data-position') || 'bottom-right';
  const TITLE = script.getAttribute('data-title') || 'Chat with AI';
  const AVATAR_URL = script.getAttribute('data-avatar-url') || '';
  const VOICE_ENABLED = script.getAttribute('data-voice-enabled') === 'true';
  const WELCOME_MESSAGE = script.getAttribute('data-welcome-message') || 'Hey! Ask me anything!';
  const POPULAR_QUESTIONS = (script.getAttribute('data-popular-questions') || '').split(',').filter(Boolean);

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
      <div id="selflyx-widget-popular" style="display:none;padding:8px 16px;"></div>
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
  const popularDiv = document.getElementById('selflyx-widget-popular');

  // Add welcome message
  if (WELCOME_MESSAGE) {
    const welcomeMsg = document.createElement('div');
    welcomeMsg.className = 'selflyx-msg selflyx-msg-bot';
    welcomeMsg.textContent = WELCOME_MESSAGE;
    messagesDiv.appendChild(welcomeMsg);
  }

  // Add popular questions
  if (POPULAR_QUESTIONS.length > 0) {
    popularDiv.style.display = 'flex';
    popularDiv.style.flexWrap = 'wrap';
    popularDiv.style.gap = '8px';
    POPULAR_QUESTIONS.forEach(q => {
      const qBtn = document.createElement('button');
      qBtn.className = 'selflyx-question-btn';
      qBtn.textContent = q.trim();
      qBtn.style.cssText = `
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.2s;
      `;
      qBtn.onmouseover = () => qBtn.style.background = '#e5e7eb';
      qBtn.onmouseout = () => qBtn.style.background = '#f3f4f6';
      qBtn.onclick = () => {
        input.value = q.trim();
        sendMessage();
        popularDiv.style.display = 'none';
      };
      popularDiv.appendChild(qBtn);
    });
  }

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
      audio.play().catch(() => {});
    }

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function addTypingIndicator() {
    const typing = document.createElement('div');
    typing.id = 'selflyx-typing';
    typing.className = 'selflyx-msg selflyx-msg-bot';
    typing.innerHTML = '<span class="selflyx-typing-dot"></span><span class="selflyx-typing-dot"></span><span class="selflyx-typing-dot"></span>';
    typing.style.cssText = 'display:flex;gap:4px;padding:12px 16px;';
    messagesDiv.appendChild(typing);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return typing;
  }

  function removeTypingIndicator() {
    const typing = document.getElementById('selflyx-typing');
    if (typing) typing.remove();
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMessage(text, true);

    // Hide popular questions after first message
    popularDiv.style.display = 'none';

    const typing = addTypingIndicator();

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
      removeTypingIndicator();

      if (res.status === 402) {
        // Creator plan limit reached
        const upgradeUrl = data.upgradeUrl || `${API_BASE}/pricing`;
        addMessage(`The creator has reached their plan limit. Please visit ${upgradeUrl} to upgrade.`, false);
      } else if (data.requiresPayment) {
        // Show payment prompt with proper link
        const creatorSlug = script.getAttribute('data-creator-slug') || CREATOR_ID;
        addMessage(`This is a premium feature. Click here to unlock: ${API_BASE}/chat/${creatorSlug}?upgrade=1`, false);
      } else if (data.reply) {
        addMessage(data.reply, false, data.audioUrl);
      } else {
        addMessage('Sorry, I could not respond.', false);
      }
    } catch (e) {
      removeTypingIndicator();
      addMessage('Error connecting to server.', false);
    }
  }

  sendBtn.onclick = sendMessage;
  input.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };

  // Add typing indicator styles
  const style = document.createElement('style');
  style.textContent = `
    .selflyx-typing-dot {
      width: 8px;
      height: 8px;
      background: #9ca3af;
      border-radius: 50%;
      animation: selflyx-bounce 1.4s infinite ease-in-out;
    }
    .selflyx-typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .selflyx-typing-dot:nth-child(2) { animation-delay: -0.16s; }
    @keyframes selflyx-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
})();
