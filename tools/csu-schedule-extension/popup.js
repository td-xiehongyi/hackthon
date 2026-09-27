(() => {
  'use strict';
  const capture = document.getElementById('capture');
  const clear = document.getElementById('clear');
  const status = document.getElementById('status');
  const latest = document.getElementById('latest');

  const show = (message, error = false) => {
    status.textContent = message;
    status.classList.toggle('error', error);
  };

  const runtimeCall = (message) => new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      const runtimeError = chrome.runtime.lastError;
      resolve(runtimeError ? { ok: false, error: runtimeError.message } : (response || { ok: false, error: '扩展没有返回结果。' }));
    });
  });

  const refreshLatest = async () => {
    const result = await runtimeCall({ type: 'CSU_GET_LATEST' });
    if (!result.ok) { latest.textContent = result.error; return; }
    const payload = result.payload;
    latest.textContent = payload ? `${payload.courses?.length || 0} 门课程 · ${payload.capturedAt || '刚刚'}` : '尚未抓取课表';
  };

  capture.addEventListener('click', async () => {
    capture.disabled = true;
    show('正在读取当前标签页…');
    const result = await runtimeCall({ type: 'CSU_CAPTURE_ACTIVE' });
    capture.disabled = false;
    if (!result.ok) show(result.error || '抓取失败。', true);
    else show(`已抓取 ${result.courseCount || result.payload?.courses?.length || 0} 门课程。回到课表页面确认导入。`);
    await refreshLatest();
  });

  clear.addEventListener('click', async () => {
    const result = await runtimeCall({ type: 'CSU_CLEAR_LATEST' });
    if (!result.ok) { show(result.error || '清除失败。', true); return; }
    show('已清除扩展缓存。');
    await refreshLatest();
  });

  void refreshLatest();
})();
