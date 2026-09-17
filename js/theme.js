export function initTheme() {
  const button = document.querySelector('.theme-toggle');
  const system = matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem('theme'); } catch { /* Storage can be disabled in private browsers. */ }
  if (!['light', 'dark'].includes(preference)) preference = null;
  const render = () => {
    const theme = preference || (system.matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    button.textContent = theme === 'dark' ? '☀' : '☾';
    button.setAttribute('aria-label', theme === 'dark' ? '切换为浅色主题' : '切换为深色主题');
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#181b18' : '#faf9f6';
  };
  render();
  button.hidden = false;
  system.addEventListener('change', render);
  button.addEventListener('click', () => {
    preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', preference); } catch { /* Theme switching still works without persistence. */ }
    render();
  });
}
