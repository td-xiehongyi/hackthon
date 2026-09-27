import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import App from './app/App';
import BackgroundMusic from './app/BackgroundMusic';
import './app/styles.css';

/**
 * 开发测试场景只在开发模式下可用（/?scene=dev-playground）。
 * 生产构建中 import.meta.env.DEV 为 false，懒加载分支被移除，不会成为正式入口。
 */
const DevPlayground = import.meta.env.DEV ? lazy(() => import('./game/dev/DevPlayground')) : null;
const wantsPlayground = new URLSearchParams(window.location.search).get('scene') === 'dev-playground';

createRoot(document.getElementById('root')!).render(
  DevPlayground && wantsPlayground ? (
    <Suspense fallback={null}><DevPlayground /></Suspense>
  ) : (
    <BackgroundMusic><App /></BackgroundMusic>
  ),
);
