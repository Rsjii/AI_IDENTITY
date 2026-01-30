(function () {
  const params = new URLSearchParams(window.location.search);
  const API_BASE = params.get('apiBase') || '';
  const CREATOR_ID = params.get('creatorId') || '';
  const COLOR = params.get('color') || '#2563eb';
  const TITLE = params.get('title') || 'Chat with AI';
  const AVATAR_URL = params.get('avatarUrl') || '';
  const VOICE_ENABLED = params.get('voiceEnabled') === 'true';
  const WELCOME_MESSAGE = params.get('welcomeMessage') || 'Hey! Ask me anything!';
  const POPULAR_QUESTIONS = (params.get('popularQuestions') || '').split(',').filter(Boolean);
  const CREATOR_SLUG = params.get('creatorSlug') || '';

  if (!API_BASE || !CREATOR_ID) {
    console.error('[Selflyx Widget] Missing apiBase or creatorId');
    return;
  }

  const root = document.getElementById('selflyx-widget-root');
  if (!root) return;

  root.innerHTML = `
    <div id="selflyx-widget-panel">
      <div id="selflyx-widget-header">
        ${AVATAR_URL ? `<img id="selflyx-widget-avatar" src="${AVATAR_URL}" alt="Avatar" />` : ''}
        <span>${TITLE}</span>
      </div>
      <div id="selflyx-widget-messages"></div>
      <div id="selflyx-widget-popular" style="display:none;padding:8px 16px;"></div>
      <div id="selflyx-widget-input-container">
        <input type="text" id="selflyx-widget-input" placeholder="Type a message..." />
        <button id="selflyx-widget-send" style="background:${COLOR}">Send</button>
      </div>
    </div>
  `;

  const input = document.getElementById('selflyx-widget-input');
  const sendBtn = document.getElementById('selflyx-widget-send');
  const messagesDiv = document.getElementById('selflyx-widget-messages');
  const popularDiv = document.getElementById('selflyx-widget-popular');

  if (WELCOME_MESSAGE) {
    const welcomeMsg = document.createElement('div');
    welcomeMsg.className = 'selflyx-msg selflyx-msg-bot';
    welcomeMsg.textContent = WELCOME_MESSAGE;
    messagesDiv.appendChild(welcomeMsg);
  }

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
      qBtn.onmouseover = () => (qBtn.style.background = '#e5e7eb');
      qBtn.onmouseout = () => (qBtn.style.background = '#f3f4f6');
      qBtn.onclick = () => {
        input.value = q.trim();
        sendMessage();
        popularDiv.style.display = 'none';
      };
      popularDiv.appendChild(qBtn);
    });
  }

  function addMessage(text, isUser, audioUrl) {
    const msg = document.createElement('div');
    msg.className = isUser ? 'selflyx-msg selflyx-msg-user' : 'selflyx-msg selflyx-msg-bot';
    msg.textContent = text;
    messagesDiv.appendChild(msg);

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

    popularDiv.style.display = 'none';

    addTypingIndicator();

    try {
      const res = await fetch(`${API_BASE}/api/widget/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: CREATOR_ID,
          message: text,
          voiceEnabled: VOICE_ENABLED,
        }),
      });
      const data = await res.json();
      removeTypingIndicator();

      if (res.status === 402) {
        const upgradeUrl = data.upgradeUrl || `${API_BASE}/pricing`;
        addMessage(`The creator has reached their plan limit. Please visit ${upgradeUrl} to upgrade.`, false);
      } else if (data.requiresPayment) {
        const creatorSlug = CREATOR_SLUG || CREATOR_ID;
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
  input.onkeydown = (e) => {
    if (e.key === 'Enter') sendMessage();
  };
})();

