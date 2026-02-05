/**
 * Modern toast notification utility with enhanced UI
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export function showToast(message: string, type: ToastType = 'info', duration: number = 3000) {
  // Remove existing toast
  const existing = document.getElementById('react-toast');
  if (existing) {
    existing.remove();
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.id = 'react-toast';

  // Modern gradient-based styling with glassmorphism effect
  const styles = {
    success: {
      bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.95) 100%)',
      border: '1px solid rgba(16, 185, 129, 0.3)',
      shadow: '0 20px 25px -5px rgba(16, 185, 129, 0.3), 0 10px 10px -5px rgba(16, 185, 129, 0.2), 0 0 20px rgba(16, 185, 129, 0.4)',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
    },
    error: {
      bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.95) 100%)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      shadow: '0 20px 25px -5px rgba(239, 68, 68, 0.3), 0 10px 10px -5px rgba(239, 68, 68, 0.2), 0 0 20px rgba(239, 68, 68, 0.4)',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
    },
    info: {
      bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(37, 99, 235, 0.95) 100%)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      shadow: '0 20px 25px -5px rgba(59, 130, 246, 0.3), 0 10px 10px -5px rgba(59, 130, 246, 0.2), 0 0 20px rgba(59, 130, 246, 0.4)',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    },
    warning: {
      bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.95) 0%, rgba(217, 119, 6, 0.95) 100%)',
      border: '1px solid rgba(245, 158, 11, 0.3)',
      shadow: '0 20px 25px -5px rgba(245, 158, 11, 0.3), 0 10px 10px -5px rgba(245, 158, 11, 0.2), 0 0 20px rgba(245, 158, 11, 0.4)',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
    },
  };

  const currentStyle = styles[type];

  toast.style.cssText = `
    position: fixed;
    top: 1.5rem;
    right: 1.5rem;
    z-index: 9999;
    max-width: 28rem;
    width: calc(100vw - 3rem);
    background: ${currentStyle.bg};
    border: ${currentStyle.border};
    border-radius: 1rem;
    padding: 1rem 1.25rem;
    box-shadow: ${currentStyle.shadow};
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    opacity: 0;
    transform: translateX(400px) scale(0.95);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  `;

  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.875rem;">
      <div style="flex-shrink: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
        ${currentStyle.icon}
      </div>
      <div style="flex: 1; min-width: 0;">
        <p style="margin: 0; font-size: 0.9375rem; font-weight: 600; line-height: 1.5; letter-spacing: -0.01em;">
          ${message}
        </p>
      </div>
      <button
        onclick="this.parentElement.parentElement.remove()"
        style="flex-shrink: 0; background: transparent; border: none; color: white; cursor: pointer; padding: 0.25rem; opacity: 0.7; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center;"
        onmouseover="this.style.opacity='1'"
        onmouseout="this.style.opacity='0.7'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `;

  document.body.appendChild(toast);

  // Animate in with smooth spring-like animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0) scale(1)';
    });
  });

  // Remove after duration with slide-out animation
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(400px) scale(0.95)';
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

















