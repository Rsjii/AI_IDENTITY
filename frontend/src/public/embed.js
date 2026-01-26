(function () {
  const s = document.currentScript;
  const apiBase = (s && s.dataset && s.dataset.apiBase) ? s.dataset.apiBase : '';
  const creatorId = (s && s.dataset && s.dataset.creatorId) ? s.dataset.creatorId : '';

  const color = (s && s.dataset && s.dataset.color) ? s.dataset.color : '#2563eb';
  const position = (s && s.dataset && s.dataset.position) ? s.dataset.position : 'bottom-right';
  const title = (s && s.dataset && s.dataset.title) ? s.dataset.title : 'Selflyx';
  const avatarUrl = (s && s.dataset && s.dataset.avatarUrl) ? s.dataset.avatarUrl : '';

  if (!creatorId) {
    console.error('[Selflyx Widget] Missing data-creator-id');
    return;
  }

  const btn = document.createElement('button');
  btn.id = 'selflyx-widget-btn';
  btn.textContent = 'Chat';
  btn.style.background = color;
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'selflyx-widget-panel';

  const headHtml = avatarUrl
    ? `<div id="selflyx-widget-head"><img id="selflyx-widget-avatar" src="${avatarUrl}" alt="" />${title}</div>`
    : `<div id="selflyx-widget-head">${title}</div>`;

  panel.innerHTML = `
    ${headHtml}
    <div id="selflyx-widget-body"></div>
    <div id="selflyx-widget-input">
      <input id="selflyx-in" placeholder="Type a message…" />
      <button id="selflyx-send">Send</button>
    </div>
  `;
  document.body.appendChild(panel);

  // Positioning
  const isLeft = position === 'bottom-left';
  btn.style.left = isLeft ? '18px' : '';
  btn.style.right = isLeft ? '' : '18px';
  panel.style.left = isLeft ? '18px' : '';
  panel.style.right = isLeft ? '' : '18px';

  const body = panel.querySelector('#selflyx-widget-body');
  const input = panel.querySelector('#selflyx-in');
  const send = panel.querySelector('#selflyx-send');

  function addMsg(cls, txt) {
    const div = document.createElement('div');
    div.className = `selflyx-msg ${cls}`;
    div.textContent = txt;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  async function sendMsg() {
    const text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    addMsg('selflyx-me', `You: ${text}`);

    try {
      const r = await fetch(`${apiBase}/api/widget/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, message: text }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Request failed');
      addMsg('selflyx-ai', `AI: ${data.reply || ''}`);
    } catch (e) {
      addMsg('selflyx-ai', `AI: (error) ${e.message || e}`);
    }
  }

  btn.addEventListener('click', () => {
    const open = panel.style.display === 'block';
    panel.style.display = open ? 'none' : 'block';
  });

  send.addEventListener('click', sendMsg);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMsg(); });
})();
