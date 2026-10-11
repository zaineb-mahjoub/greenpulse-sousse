export function showNotification(message, type = 'info') {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;

  const colors = {
    success: { bg: '#E8F5E9', color: '#2E7D32', border: '#43A047' },
    error:   { bg: '#FFEBEE', color: '#C62828', border: '#E53935' },
    info:    { bg: '#E3F2FD', color: '#0D47A1', border: '#1976D2' }
  };
  const c = colors[type] || colors.info;

  Object.assign(toast.style, {
    position: 'fixed',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%) translateY(-100px)',
    background: c.bg,
    color: c.color,
    border: `1.5px solid ${c.border}`,
    borderRadius: '12px',
    padding: '13px 22px',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
    fontWeight: '500',
    zIndex: '99999',
    maxWidth: '360px',
    width: '90%',
    textAlign: 'center',
    transition: 'transform 0.3s ease',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)'
  });

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });
  });

  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(-100px)';
    setTimeout(() => toast.remove(), 320);
  }, 3200);
}
