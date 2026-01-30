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

  const container = document.createElement('div');
  container.id = 'selflyx-widget-container';
  const posStyle = POSITION === 'bottom-left' ? 'left:20px;right:auto;' : 'right:20px;left:auto;';
  container.style.cssText = `position:fixed;bottom:20px;${posStyle}z-index:999999;`;

  const iframe = document.createElement('iframe');
  iframe.title = 'Selflyx Widget';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
  iframe.style.cssText = 'width:360px;height:520px;border:none;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.2);';

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
  container.appendChild(iframe);
  document.body.appendChild(container);
})();
