#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import queue
import sys
import threading
import urllib.error
import urllib.request
import ssl
from datetime import datetime, date
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent


def _load_dotenv() -> None:
    env_path = BASE_DIR / '.env'
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, value = line.partition('=')
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()

BLOCKED_PATHS = {
    '/server.py',
    '/analytics-data.json',
    '/requirements.txt',
    '/.env',
}
BLOCKED_PREFIXES = (
    '/.git',
    '/.idea',
    '/.vscode',
    '/.voice-env',
    '/.env',
)

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
REST_BASE = f'{SUPABASE_URL}/rest/v1/analytics?id=eq.1' if SUPABASE_URL else ''


def _ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    for bundle in ('/etc/ssl/cert.pem', '/usr/local/etc/openssl/cert.pem', '/opt/homebrew/etc/openssl@3/cert.pem'):
        try:
            ctx.load_verify_locations(bundle)
            return ctx
        except (FileNotFoundError, OSError):
            continue
    try:
        import certifi
        ctx.load_verify_locations(certifi.where())
        return ctx
    except Exception:
        pass
    # macOS 系统 Python 未配置 CA 证书时的兜底（仅本地开发）
    print('[ssl] CA 证书未找到，使用宽松校验。如需修复请运行 Python 安装目录下的 Install Certificates.command', file=sys.stderr)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


SSL_CTX = _ssl_context()


def local_day() -> str:
    return date.today().isoformat()


def _headers() -> dict[str, str]:
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    }


def _read_snapshot() -> dict | None:
    if not REST_BASE:
        return None
    req = urllib.request.Request(REST_BASE, headers=_headers())
    try:
        with urllib.request.urlopen(req, timeout=8, context=SSL_CTX) as resp:
            rows = json.loads(resp.read().decode('utf-8'))
            if rows:
                return rows[0]
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as e:
        print(f'[supabase] read failed: {e}', file=sys.stderr)
    return None


def _patch_snapshot(patch: dict) -> dict | None:
    if not REST_BASE:
        return None
    body = json.dumps(patch).encode('utf-8')
    req = urllib.request.Request(REST_BASE, data=body, headers=_headers(), method='PATCH')
    try:
        with urllib.request.urlopen(req, timeout=8, context=SSL_CTX) as resp:
            rows = json.loads(resp.read().decode('utf-8'))
            if rows:
                return rows[0]
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as e:
        print(f'[supabase] patch failed: {e}', file=sys.stderr)
    return None


def _normalize(snapshot: dict) -> dict:
    today = int(snapshot.get('today', 0) or 0)
    db_date = snapshot.get('date') or ''
    if db_date != local_day():
        today = 0
    return {
        'total': int(snapshot.get('total', 0) or 0),
        'today': today,
        'wechat': int(snapshot.get('wechat', 0) or 0),
        'copy': int(snapshot.get('copy', 0) or 0),
        'date': local_day(),
        'updatedAt': snapshot.get('updated_at') or datetime.now().astimezone().isoformat(timespec='seconds'),
    }


class SupabaseAnalyticsStore:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.subscribers: set[queue.Queue] = set()

    def snapshot(self) -> dict:
        snap = _read_snapshot()
        if snap is None:
            return {
                'total': 0, 'today': 0, 'wechat': 0, 'copy': 0,
                'date': local_day(),
                'updatedAt': datetime.now().astimezone().isoformat(timespec='seconds'),
            }
        normalized = _normalize(snap)
        if normalized['date'] != snap.get('date'):
            with self.lock:
                _patch_snapshot({'today': 0, 'date': normalized['date']})
        return normalized

    def increment(self, event: str) -> dict | None:
        with self.lock:
            snap = _read_snapshot()
            if snap is None:
                return None
            base = _normalize(snap)
            patch = {}
            if event == 'visit':
                patch = {'total': base['total'] + 1, 'today': base['today'] + 1}
            elif event in ('wechat', 'copy'):
                patch = {event: base[event] + 1}
            else:
                raise ValueError('unsupported analytics event')
            patch['updated_at'] = datetime.now().astimezone().isoformat(timespec='seconds')
            if base['date'] != snap.get('date'):
                patch['date'] = base['date']
                if event != 'visit':
                    patch['today'] = 0
            result = _patch_snapshot(patch)
            payload = _normalize(result) if result else None
        if payload:
            for subscriber in list(self.subscribers):
                try:
                    subscriber.put_nowait(payload)
                except queue.Full:
                    pass
        return payload

    def subscribe(self) -> queue.Queue:
        subscriber: queue.Queue = queue.Queue(maxsize=16)
        self.subscribers.add(subscriber)
        return subscriber

    def unsubscribe(self, subscriber: queue.Queue) -> None:
        self.subscribers.discard(subscriber)


STORE = SupabaseAnalyticsStore()


class ProfileRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def end_headers(self) -> None:
        if self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-store')
        elif self.path.split('?', 1)[0].endswith(('.html', '.js', '.css')):
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def translate_path(self, path: str) -> str:
        clean_path = urlparse(path).path
        if clean_path in BLOCKED_PATHS or clean_path.startswith(BLOCKED_PREFIXES):
            return str(BASE_DIR / '__not_found__')
        return super().translate_path(path)

    def send_json(self, payload: dict, status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        path = urllib.parse.urlparse(self.path).path
        if path == '/api/analytics':
            self.send_json(STORE.snapshot())
            return
        if path == '/api/analytics/stream':
            self.stream_analytics()
            return
        if path == '/':
            self.path = '/index.html'
        super().do_GET()

    def do_POST(self) -> None:
        path = urllib.parse.urlparse(self.path).path
        if path not in ('/api/analytics/visit', '/api/analytics/event'):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        try:
            length = min(int(self.headers.get('Content-Length', '0')), 4096)
            raw_body = self.rfile.read(length) if length else b'{}'
            payload = json.loads(raw_body.decode('utf-8') or '{}')
            event = 'visit' if path.endswith('/visit') else payload.get('event')
            snapshot = STORE.increment(event)
            if snapshot is None:
                self.send_json({'error': 'analytics backend unavailable'}, HTTPStatus.SERVICE_UNAVAILABLE)
                return
            self.send_json(snapshot)
        except ValueError:
            self.send_json({'error': 'invalid analytics event'}, HTTPStatus.BAD_REQUEST)
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json({'error': 'invalid analytics event'}, HTTPStatus.BAD_REQUEST)

    def stream_analytics(self) -> None:
        subscriber = STORE.subscribe()
        self.send_response(HTTPStatus.OK)
        self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Connection', 'keep-alive')
        self.end_headers()
        try:
            initial = json.dumps(STORE.snapshot(), ensure_ascii=False)
            self.wfile.write(f'data: {initial}\n\n'.encode('utf-8'))
            self.wfile.flush()
            tick = 0
            while True:
                try:
                    payload = subscriber.get(timeout=10)
                    message = json.dumps(payload, ensure_ascii=False)
                    self.wfile.write(f'data: {message}\n\n'.encode('utf-8'))
                except queue.Empty:
                    # 定期刷新以捕获外部写入
                    snap = STORE.snapshot()
                    self.wfile.write(f'data: {json.dumps(snap, ensure_ascii=False)}\n\n'.encode('utf-8'))
                self.wfile.flush()
                tick += 1
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            STORE.unsubscribe(subscriber)
            self.close_connection = True

    def log_message(self, fmt: str, *args) -> None:
        if self.path.startswith('/api/'):
            sys.stderr.write('[analytics] ' + fmt % args + '\n')
        else:
            super().log_message(fmt, *args)


class ProfileHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request, client_address) -> None:
        error = sys.exc_info()[1]
        if isinstance(error, (BrokenPipeError, ConnectionResetError)):
            return
        super().handle_error(request, client_address)


def main() -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        print('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set', file=sys.stderr)
        sys.exit(1)
    port = int(os.environ.get('PORT', sys.argv[1] if len(sys.argv) > 1 else '8769'))
    server = ProfileHTTPServer(('127.0.0.1', port), ProfileRequestHandler)
    print(f'YKY site running at http://localhost:{port}/index.html', flush=True)
    print(f'Analytics backend: Supabase ({SUPABASE_URL})', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
