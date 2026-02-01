// frontend/src/public/embed.js
(function () {
  const script = document.currentScript;
  const API_BASE = script.getAttribute('data-api-base') || '';
  const CREATOR_ID = script.getAttribute('data-creator-id') || '';
  const COLOR = script.getAttribute('data-color') || '#2563eb';
  const POSITION = script.getAttribute('data-position') || 'bottom-right';
  const TITLE = script.getAttribute('data-title') || 'Chat with AI';
  const AVATAR_URL = script.getAttribute('data-avatar-url') || '';
  const VOICE_ENABLED = script.getAttribute('data-voice-enabled') === 'true';
  const WELCOME_MESSAGE = script.getAttribute('data-welcome-message') || 'Hey! Ask me anything!';
  const POPULAR_QUESTIONS = script.getAttribute('data-popular-questions') || '';
  const CREATOR_SLUG = script.getAttribute('data-creator-slug') || '';

  if (!API_BASE || !CREATOR_ID) {
    console.error('[Selflyx Widget] Missing data-api-base or data-creator-id');
    return;
  }

  let isOpen = false;
  const container = document.createElement('div');
  container.id = 'selflyx-widget-container';
  const posStyle = POSITION === 'bottom-left' ? 'left:20px;right:auto;' : 'right:20px;left:auto;';
  container.style.cssText = `position:fixed;bottom:20px;${posStyle}z-index:999999;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;`;

  // Floating button
  const button = document.createElement('button');
  button.id = 'selflyx-widget-btn';
  button.innerHTML = AVATAR_URL 
    ? `<img src="${AVATAR_URL}" alt="${TITLE}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`
    : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
  button.style.cssText = `
    width:60px;height:60px;border-radius:50%;border:none;background:${COLOR};
    color:#fff;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.3);
    display:flex;align-items:center;justify-content:center;transition:all 0.3s;
    position:relative;
  `;
  button.onmouseover = () => button.style.transform = 'scale(1.1)';
  button.onmouseout = () => button.style.transform = 'scale(1)';

  // Chat panel (iframe)
  const iframe = document.createElement('iframe');
  iframe.id = 'selflyx-widget-panel';
  iframe.title = TITLE;
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
  iframe.style.cssText = `
    width:380px;height:600px;max-width:calc(100vw - 40px);max-height:calc(100vh - 100px);
    border:none;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);
    display:none;position:fixed;bottom:90px;${posStyle};
    transition:all 0.3s cubic-bezier(0.4,0,0.2,1);
  `;

  const srcParams = new URLSearchParams({
    apiBase: API_BASE,
    creatorId: CREATOR_ID,
    color: COLOR,
    title: TITLE,
    avatarUrl: AVATAR_URL,
    voiceEnabled: VOICE_ENABLED ? 'true' : 'false',
    welcomeMessage: WELCOME_MESSAGE,
    popularQuestions: POPULAR_QUESTIONS,
    creatorSlug: CREATOR_SLUG,
  });
  iframe.src = `${API_BASE}/embed.html?${srcParams.toString()}`;

  // Toggle function
  function toggleWidget() {
    isOpen = !isOpen;
    if (isOpen) {
      iframe.style.display = 'block';
      iframe.style.opacity = '0';
      iframe.style.transform = 'translateY(20px) scale(0.95)';
      setTimeout(() => {
        iframe.style.opacity = '1';
        iframe.style.transform = 'translateY(0) scale(1)';
      }, 10);
      button.style.transform = 'scale(0.9)';
    } else {
      iframe.style.opacity = '0';
      iframe.style.transform = 'translateY(20px) scale(0.95)';
      setTimeout(() => {
        iframe.style.display = 'none';
        button.style.transform = 'scale(1)';
      }, 300);
    }
  }

  button.onclick = toggleWidget;

  // Close on outside click (optional)
  document.addEventListener('click', (e) => {
    if (isOpen && !container.contains(e.target) && !iframe.contains(e.target)) {
      toggleWidget();
    }
  });

  container.appendChild(button);
  document.body.appendChild(container);
  document.body.appendChild(iframe);

  // Mobile responsive
  if (window.innerWidth <= 480) {
    iframe.style.width = '100vw';
    iframe.style.height = '100vh';
    iframe.style.maxWidth = '100vw';
    iframe.style.maxHeight = '100vh';
    iframe.style.bottom = '0';
    iframe.style.borderRadius = '0';
    if (POSITION === 'bottom-left') {
      iframe.style.left = '0';
      iframe.style.right = 'auto';
    } else {
      iframe.style.right = '0';
      iframe.style.left = 'auto';
    }
  }
})();