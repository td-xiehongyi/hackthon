(() => {
  'use strict';
  const capture = document.getElementById('capture');
  const clear = document.getElementById('clear');
  const status = document.getElementById('status');
  const latest = document.getElementById('latest');
  const setupHint = document.getElementById('setup-hint');
  const extensionRuntime = globalThis.chrome?.runtime;
  const hasExtensionRuntime = Boolean(extensionRuntime?.id && typeof extensionRuntime.sendMessage === 'function');
  const RUNTIME_TIMEOUT_MS = 10_000;
  let busy = false;

  const show = (message, error = false) => {
    status.textContent = message;
    status.classList.toggle('error', error);
    status.setAttribute('role', error ? 'alert' : 'status');
    status.setAttribute('aria-live', error ? 'assertive' : 'polite');
  };

  const runtimeCall = (message) => new Promise((resolve) => {
    if (!hasExtensionRuntime) {
      resolve({ ok: false, error: '请从 Chrome/Edge 工具栏打开扩展，不要直接打开 popup.html。' });
      return;
    }

    let settled = false;
    const finish = (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(response);
    };
    const timeout = setTimeout(() => finish({
      ok: false,
      error: '扩展后台 10 秒内没有响应。请到 chrome://extensions 重新加载扩展，再刷新 CSU 课表页。',
    }), RUNTIME_TIMEOUT_MS);

    try {
      extensionRuntime.sendMessage(message, (response) => {
        const runtimeError = extensionRuntime.lastError;
        finish(runtimeError
          ? { ok: false, error: runtimeError.message }
          : (response || { ok: false, error: '扩展没有返回结果。' }));
      });
    } catch (error) {
      finish({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  const refreshLatest = async () => {
    const result = await runtimeCall({ type: 'CSU_GET_LATEST' });
    if (!result.ok) { latest.textContent = result.error; return; }
    const payload = result.payload;
    latest.textContent = payload ? `${payload.courses?.length || 0} 门课程 · ${payload.capturedAt || '刚刚'}` : '尚未抓取课表';
  };

  const runCapture = async () => {
    if (busy || !hasExtensionRuntime) return;
    busy = true;
    capture.disabled = true;
    clear.disabled = true;
    capture.setAttribute('aria-busy', 'true');
    show('正在读取当前标签页…');
    try {
      const result = await runtimeCall({ type: 'CSU_CAPTURE_ACTIVE' });
      if (!result.ok) show(result.error || '抓取失败。', true);
      else if (result.downloaded) show(`已下载 ${result.downloadFilename || '课表 CSV'}，共 ${result.courseCount || 0} 门课程。`);
      else show(`已抓取 ${result.courseCount || result.payload?.courses?.length || 0} 门课程，但 CSV 下载失败${result.downloadError ? `：${result.downloadError}` : ''}。`, true);
      await refreshLatest();
    } catch (error) {
      show(error instanceof Error ? error.message : String(error), true);
    } finally {
      busy = false;
      capture.disabled = false;
      clear.disabled = false;
      capture.setAttribute('aria-busy', 'false');
    }
  };

  capture.addEventListener('click', () => void runCapture());

  clear.addEventListener('click', async () => {
    if (busy || !hasExtensionRuntime) return;
    busy = true;
    clear.disabled = true;
    capture.disabled = true;
    try {
      const result = await runtimeCall({ type: 'CSU_CLEAR_LATEST' });
      if (!result.ok) { show(result.error || '清除失败。', true); return; }
      show('已清除扩展缓存。');
      await refreshLatest();
    } catch (error) {
      show(error instanceof Error ? error.message : String(error), true);
    } finally {
      busy = false;
      clear.disabled = false;
      capture.disabled = false;
    }
  });

  if (!hasExtensionRuntime) {
    // popup.html is also a source file in the unpacked extension directory.
    // Opening it via file:// does not create an extension context, so there
    // is no service worker to answer runtime.sendMessage calls.
    if (setupHint) setupHint.hidden = false;
    capture.disabled = true;
    clear.disabled = true;
    show('请从 Chrome/Edge 工具栏打开扩展，不要直接打开 popup.html。', true);
  } else {
    // Opening the toolbar popup is the single user gesture: immediately run
    // the capture/download flow. The button remains available as an explicit
    // retry if the CSU page was still loading.
    void (async () => {
      try {
        await refreshLatest();
        await runCapture();
      } catch (error) {
        show(error instanceof Error ? error.message : String(error), true);
      }
    })();
  }
})();
