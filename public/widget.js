(function () {
  'use strict';
  const script = document.currentScript;
  const botId = script && script.dataset.botId;
  if (!botId || document.querySelector('[data-aiden-widget],[data-helio-widget]')) return;
  const base = new URL(script.src).origin;
  const frame = document.createElement('iframe');
  frame.dataset.aidenWidget = 'true';
  frame.title = 'Customer support chat';
  frame.allow = 'clipboard-write';
  frame.src = `${base}/widget/frame?botId=${encodeURIComponent(botId)}`;
  Object.assign(frame.style, { position: 'fixed', zIndex: '2147483000', border: '0', background: 'transparent', width: '92px', height: '92px', bottom: '12px', right: '12px', colorScheme: 'normal' });
  frame.addEventListener('load', () => frame.contentWindow.postMessage({ type: 'aiden:init' }, base));
  window.addEventListener('message', event => {
    if (event.origin !== base || event.source !== frame.contentWindow || !['aiden:resize', 'helio:resize'].includes(event.data?.type)) return;
    const open = event.data.open;
    frame.style.width = open ? 'min(400px, calc(100vw - 20px))' : '92px';
    frame.style.height = open ? 'min(680px, calc(100vh - 20px))' : '92px';
    frame.style.left = event.data.position === 'bottom-left' ? '10px' : 'auto';
    frame.style.right = event.data.position === 'bottom-left' ? 'auto' : '10px';
  });
  document.body.appendChild(frame);
})();
