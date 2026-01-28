/**
 * Simple toast notification utility for React
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
  
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
  };

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  };

  toast.className = `fixed top-4 right-4 z-50 max-w-sm w-[90vw] sm:w-auto px-4 py-3 rounded-xl shadow-2xl text-white ${colors[type]} transition-all duration-300 transform opacity-0 translate-y-2`;
  toast.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-xl">${icons[type]}</span>
      <span class="font-semibold">${message}</span>
    </div>
  `;

  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // Remove after duration
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

