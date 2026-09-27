import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

/**
 * Same-origin parking/charging status adapter.
 *
 * The browser never receives an upstream URL or credential.  With no
 * configured upstream this intentionally serves the QR-photo snapshot so the
 * UI remains useful during development while clearly reporting `live:false`.
 * A production deployment can set PARKING_STATUS_UPSTREAM_URL and keep any
 * bearer token in PARKING_STATUS_TOKEN on the server only.
 */

type PortStatus = 'available' | 'occupied';
type StatusItem = {
  deviceNumber: string;
  status: PortStatus;
  remainingSeconds: number;
};

const DEMO_DATA: StatusItem[] = [
  { deviceNumber: '120000032056', status: 'occupied', remainingSeconds: 1 * 3600 + 42 * 60 + 18 },
  { deviceNumber: '120000040680', status: 'occupied', remainingSeconds: 28 * 60 + 46 },
  { deviceNumber: '120000040145', status: 'available', remainingSeconds: 0 },
  { deviceNumber: '120000040056', status: 'available', remainingSeconds: 0 },
  { deviceNumber: '120000040770', status: 'available', remainingSeconds: 0 },
  { deviceNumber: '120000040323', status: 'occupied', remainingSeconds: 2 * 3600 + 7 * 60 + 11 },
  { deviceNumber: '120000040412', status: 'available', remainingSeconds: 0 },
  { deviceNumber: '120000039638', status: 'available', remainingSeconds: 0 },
  { deviceNumber: '120000039816', status: 'available', remainingSeconds: 0 },
  { deviceNumber: '120000041570', status: 'available', remainingSeconds: 0 },
];

const ALLOWED_DEVICES = new Set(DEMO_DATA.map((item) => item.deviceNumber));

function json(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

function isStatus(value: unknown): value is PortStatus {
  return ['available', 'free', 'idle', 'occupied', 'busy', 'charging', 'in_use'].includes(String(value).trim().toLowerCase());
}

function normalizeStatus(value: unknown): PortStatus {
  return ['occupied', 'busy', 'charging', 'in_use'].includes(String(value).trim().toLowerCase())
    ? 'occupied'
    : 'available';
}

function normalizeItems(value: unknown): StatusItem[] | null {
  if (!Array.isArray(value)) return null;
  const byDevice = new Map<string, StatusItem>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const raw = entry as Record<string, unknown>;
    const deviceNumber = String(raw.deviceNumber ?? raw.DeviceNumber ?? raw.id ?? '').trim();
    if (!ALLOWED_DEVICES.has(deviceNumber) || !isStatus(raw.status)) continue;
    const remaining = Number(raw.remainingSeconds ?? raw.remaining ?? 0);
    byDevice.set(deviceNumber, {
      deviceNumber,
      status: normalizeStatus(raw.status),
      remainingSeconds: Number.isFinite(remaining) && normalizeStatus(raw.status) === 'occupied'
        ? Math.max(0, Math.min(Math.round(remaining), 7 * 24 * 3600))
        : 0,
    });
  }
  // A partial upstream response must not make the UI look as if missing ports
  // are free.  Require a complete set and preserve the QR-photo order.
  if (byDevice.size !== ALLOWED_DEVICES.size) return null;
  return DEMO_DATA.map((demo) => byDevice.get(demo.deviceNumber)!);
}

function responsePayload(live: boolean, source: string, data: StatusItem[], updatedAt = new Date().toISOString()) {
  return { live, source, updatedAt, data };
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const text = await readFile(filePath, 'utf8');
  return JSON.parse(text) as unknown;
}

async function fetchUpstream(url: string, token?: string): Promise<unknown> {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported upstream protocol');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const result = await fetch(parsed, { headers, signal: controller.signal });
    if (!result.ok) throw new Error(`upstream status ${result.status}`);
    return await result.json() as unknown;
  } finally {
    clearTimeout(timer);
  }
}

async function handleStatus(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    json(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: '状态接口只支持 GET。' } });
    return;
  }

  const upstreamUrl = process.env.PARKING_STATUS_UPSTREAM_URL?.trim();
  const jsonFile = process.env.PARKING_STATUS_JSON_FILE?.trim();
  if (upstreamUrl || jsonFile) {
    try {
      const raw = upstreamUrl
        ? await fetchUpstream(upstreamUrl, process.env.PARKING_STATUS_TOKEN)
        : await readJsonFile(resolve(process.cwd(), jsonFile!));
      const container = raw && typeof raw === 'object' && !Array.isArray(raw)
        ? raw as Record<string, unknown>
        : { data: raw };
      const data = normalizeItems(container.data);
      if (data) {
        json(response, 200, responsePayload(true, 'upstream', data, typeof container.updatedAt === 'string' ? container.updatedAt : undefined));
        return;
      }
    } catch {
      // A failing upstream falls through to a clearly-labelled snapshot.  The
      // client can keep rendering instead of showing misleading empty slots.
    }
  }

  json(response, 200, responsePayload(false, 'photo-demo', DEMO_DATA));
}

export function parkingStatusPlugin(): Plugin {
  const middleware = (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (new URL(request.url ?? '/', 'http://127.0.0.1').pathname !== '/api/parking/status') {
      next();
      return;
    }
    void handleStatus(request, response);
  };

  return {
    name: 'csu-parking-status',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}
