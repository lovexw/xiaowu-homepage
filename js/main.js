import { initTheme } from './theme.js';

initTheme();
const filters = document.querySelector('.filters');
const cards = [...document.querySelectorAll('.project-card')];
filters.hidden = false;
filters.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  for (const filter of filters.querySelectorAll('button')) filter.setAttribute('aria-pressed', String(filter === button));
  let count = 0;
  for (const card of cards) {
    card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter;
    if (!card.hidden) count++;
  }
  document.querySelector('.project-count').textContent = `展示 ${count} 个项目`;
});

let qrPromise;
function loadQr() {
  if (!qrPromise) qrPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/public/vendor/qrcode.min.js';
    script.onload = resolve;
    script.onerror = () => { script.remove(); qrPromise = null; reject(new Error('QR unavailable')); };
    document.head.append(script);
  });
  return qrPromise;
}

async function renderQr() {
  const container = document.querySelector('#btc-qr');
  if (container.querySelector('img')) return;
  container.textContent = '正在生成二维码…';
  try {
    await loadQr();
    const qr = window.qrcode(0, 'M');
    qr.addData(`bitcoin:${container.dataset.address}`);
    qr.make();
    container.innerHTML = qr.createImgTag(5, 20, '比特币地址二维码');
  } catch {
    container.textContent = '二维码暂时不可用，请复制下方完整地址。';
  }
}

for (const trigger of document.querySelectorAll('[data-dialog]')) {
  trigger.addEventListener('click', () => {
    const dialog = document.getElementById(trigger.dataset.dialog);
    dialog.showModal();
    if (dialog.id === 'btc-dialog') renderQr();
  });
}
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
}

let toastTimer;
for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = '已复制 ✓';
      const toast = document.querySelector('.toast');
      toast.textContent = '复制成功';
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.hidden = true; }, 2500);
    } catch {
      button.textContent = '复制失败，请长按上方文字手动复制';
    }
  });
}
