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

  const runCapture = async () => {
    if (capture.disabled) return;
    capture.disabled = true;
    show('正在读取当前标签页…');
    const result = await runtimeCall({ type: 'CSU_CAPTURE_ACTIVE' });
    capture.disabled = false;
    if (!result.ok) show(result.error || '抓取失败。', true);
    else if (result.downloaded) show(`已下载 ${result.downloadFilename || '课表 CSV'}，共 ${result.courseCount || 0} 门课程。`);
    else show(`已抓取 ${result.courseCount || result.payload?.courses?.length || 0} 门课程，但 CSV 下载失败${result.downloadError ? `：${result.downloadError}` : ''}。`, true);
    await refreshLatest();
  };

  capture.addEventListener('click', () => void runCapture());

  clear.addEventListener('click', async () => {
    const result = await runtimeCall({ type: 'CSU_CLEAR_LATEST' });
    if (!result.ok) { show(result.error || '清除失败。', true); return; }
    show('已清除扩展缓存。');
    await refreshLatest();
  });

  // Opening the toolbar popup is the single user gesture: immediately run
  // the capture/download flow. The button remains available as an explicit
  // retry if the CSU page was still loading.
  void (async () => {
    await refreshLatest();
    await runCapture();
  })();
})();
