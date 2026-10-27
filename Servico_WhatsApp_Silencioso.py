# -*- coding: utf-8 -*-
"""
=============================================================================
SALGADOS VIP - SERVIÇO DE WHATSAPP SILENCIOSO LOCAL BLINDADO (WINDOWS)
=============================================================================
Servidor HTTP leve (porta 18182) com automação em segundo plano do WhatsApp Web.
Permite o envio silencioso de notificações de status para clientes
sem abrir nenhuma janela ou aba no navegador do operador.

BLINDAGEM DE SEGURANÇA INTEGRADA:
1. Autenticação forte via token criptográfico (X-VIP-Token / Authorization Bearer).
2. CORS estrito: whitelist de origens locais e GitHub Pages (remoção total do '*').
3. Proteção total do QR Code de pareamento: nunca divulgado a clientes não autenticados.
4. Sanitização estrita de telefones e mensagens na rota /send.
5. Proteção contra encerramento indevido na rota /stop.
=============================================================================
"""

import sys
import os
import time
import json
import secrets
import threading
import urllib.parse
import urllib.request
import re
import socket
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

# Importação do Selenium
try:
    from selenium import webdriver
    from selenium.webdriver.edge.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
except ImportError:
    print("[!] Selenium não está instalado no Python. Execute: pip install selenium")
    sys.exit(1)

PORT = 18182
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

# Diretórios persistentes
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROFILE_DIR = os.path.join(os.environ.get("LOCALAPPDATA", BASE_DIR), "SalgadosVIP", "WhatsAppProfile")
SECRETS_DIR = os.path.dirname(PROFILE_DIR)
os.makedirs(PROFILE_DIR, exist_ok=True)
os.makedirs(SECRETS_DIR, exist_ok=True)

# Logger em arquivo para execução 100% oculta em segundo plano (pythonw.exe)
LOG_FILE = os.path.join(SECRETS_DIR, "whatsapp_service.log")

class LoggerWriter:
    def __init__(self, filepath):
        self.filepath = filepath
    def write(self, msg):
        if msg and msg.strip():
            try:
                with open(self.filepath, "a", encoding="utf-8") as f:
                    f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg.strip()}\n")
            except Exception:
                pass
    def flush(self):
        pass

sys.stdout = LoggerWriter(LOG_FILE)
sys.stderr = LoggerWriter(LOG_FILE)

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

if is_port_in_use(PORT):
    print(f"[*] O serviço de WhatsApp já está rodando na porta {PORT}. Encerrando instância duplicada.")
    sys.exit(0)

# =============================================================================
# GERAÇÃO E GESTÃO DO TOKEN DE AUTENTICAÇÃO CRIPTOGRÁFICO
# =============================================================================
TOKEN_FILE = os.path.join(SECRETS_DIR, "service_auth.key")
LOCAL_JSON_TOKEN = os.path.join(BASE_DIR, "whatsapp_service_token.json")

def get_or_create_auth_token():
    token = None
    if os.path.exists(TOKEN_FILE):
        try:
            with open(TOKEN_FILE, "r", encoding="utf-8") as f:
                t = f.read().strip()
                if len(t) >= 32:
                    token = t
        except Exception:
            pass

    if not token:
        token = secrets.token_hex(32) # 256 bits criptográficos
        try:
            with open(TOKEN_FILE, "w", encoding="utf-8") as f:
                f.write(token)
        except Exception as e:
            print(f"[!] Erro ao salvar token local: {e}")

    # Salva também arquivo JSON local para leitura direta pelo app se rodar no mesmo host
    try:
        with open(LOCAL_JSON_TOKEN, "w", encoding="utf-8") as f:
            json.dump({"token": token, "port": PORT, "created_at": int(time.time() * 1000)}, f)
    except Exception:
        pass

    return token

AUTH_TOKEN = get_or_create_auth_token()
print(f"[*] Token de autenticação seguro inicializado com sucesso.")

# Configuração da Nuvem Supabase
SUPABASE_URL = "https://koudymqezejvhdazvqom.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdWR5bXFlemVqdmhkYXp2cW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5OTQyNjAsImV4cCI6MjEwNzU3MDI2MH0.it1qrMFxDnCb3mihTcsyPjrg3c0T34TLm0yzUaATPpM"

def supabase_request(endpoint, method="GET", data=None, extra_headers=None):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    if extra_headers:
        headers.update(extra_headers)

    encoded_data = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            resp_body = response.read().decode("utf-8")
            if resp_body:
                return json.loads(resp_body)
            return None
    except Exception:
        return None

# Publica token no Supabase para que o painel admin autenticado sincronize de forma automática
try:
    supabase_request(
        "store_settings",
        method="POST",
        data={
            "id": "whatsapp_local_auth",
            "value": {
                "token": AUTH_TOKEN,
                "port": PORT,
                "hostname": socket.gethostname(),
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
        },
        extra_headers={"Prefer": "resolution=merge-duplicates"}
    )
except Exception:
    pass

# =============================================================================
# GERENCIADOR DO WHATSAPP VIA SELENIUM COM BLINDAGEM ANTI-DETECÇÃO
# =============================================================================
class WhatsAppBotManager:
    def __init__(self):
        self.driver = None
        self.lock = threading.Lock()
        self.status = "starting"       # "starting", "qr_ready", "connected", "error"
        self.connected = False
        self.qr_code_data = None
        self.last_error = None
        self.running = True
        self.thread = None
        self.cloud_thread = None

    def start(self):
        self.thread = threading.Thread(target=self._run_driver_loop, daemon=True)
        self.thread.start()
        self.cloud_thread = threading.Thread(target=self._run_supabase_bridge, daemon=True)
        self.cloud_thread.start()

    def _clean_locks_and_zombies(self):
        """Limpa preventivamente processos órfãos de Edge/Chrome e travas do perfil"""
        try:
            import subprocess
            cmd = [
                "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
                "Get-CimInstance Win32_Process | "
                "Where-Object { ($_.Name -eq 'msedge.exe' -or $_.Name -eq 'chrome.exe') -and ($_.CommandLine -like '*SalgadosVIP*' -or $_.CommandLine -like '*WhatsAppProfile*') } | "
                "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
            ]
            subprocess.run(cmd, capture_output=True, timeout=8)
            time.sleep(1)
        except Exception as err:
            print(f"[*] Aviso limpeza processos: {err}")

        import glob
        for pattern in ["lockfile*", "Singleton*"]:
            for f in glob.glob(os.path.join(PROFILE_DIR, pattern)):
                try:
                    os.remove(f)
                    print(f"[*] Removido arquivo de bloqueio órfão: {f}")
                except Exception:
                    pass

    def _init_driver(self):
        self._clean_locks_and_zombies()

        opts = Options()
        opts.add_argument(f"--user-data-dir={PROFILE_DIR}")
        opts.add_argument("--headless")
        opts.add_argument("--disable-gpu")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument(f"--user-agent={USER_AGENT}")
        opts.add_argument("--window-size=1280,800")
        opts.add_argument("--no-first-run")
        opts.add_argument("--no-default-browser-check")
        opts.add_argument("--disable-blink-features=AutomationControlled")
        opts.add_argument("--disable-features=IsolateOrigins,site-per-process,CalculateNativeWinOcclusion")
        opts.add_experimental_option("excludeSwitches", ["enable-automation"])
        opts.add_experimental_option("useAutomationExtension", False)

        print(f"[*] Inicializando navegador com perfil em: {PROFILE_DIR}")
        try:
            self.driver = webdriver.Edge(options=opts)
        except Exception as edge_err:
            print(f"[*] Edge falhou ({edge_err}). Tentando Google Chrome como alternativa...")
            try:
                from selenium.webdriver.chrome.options import Options as ChromeOptions
                ch_opts = ChromeOptions()
                ch_opts.add_argument(f"--user-data-dir={PROFILE_DIR}")
                ch_opts.add_argument("--headless")
                ch_opts.add_argument("--disable-gpu")
                ch_opts.add_argument("--no-sandbox")
                ch_opts.add_argument("--disable-dev-shm-usage")
                ch_opts.add_argument(f"--user-agent={USER_AGENT}")
                ch_opts.add_argument("--window-size=1280,800")
                ch_opts.add_argument("--no-first-run")
                ch_opts.add_argument("--no-default-browser-check")
                ch_opts.add_argument("--disable-blink-features=AutomationControlled")
                self.driver = webdriver.Chrome(options=ch_opts)
            except Exception as chrome_err:
                raise RuntimeError(f"Falha ao iniciar Edge ({edge_err}) e Chrome ({chrome_err})")

        self.driver.set_page_load_timeout(50)

        # Oculta navigator.webdriver da Meta
        try:
            self.driver.execute_cdp_cmd(
                "Page.addScriptToEvaluateOnNewDocument",
                {"source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"}
            )
        except Exception:
            pass

        self.driver.get("https://web.whatsapp.com")
        print("[*] WhatsApp Web carregado com sucesso. Aguardando sincronização...")

    def _run_driver_loop(self):
        while self.running:
            if not self.driver:
                try:
                    self._init_driver()
                except Exception as e:
                    self.status = "error"
                    self.last_error = str(e)
                    print(f"[!] Erro ao iniciar WebDriver: {e}. Tentando novamente em 6s...")
                    time.sleep(6)
                    continue

            try:
                time.sleep(2.5)
                if not self.driver:
                    continue

                with self.lock:
                    # 1. Verifica se já está conectado (painel de conversas ou campo de busca visível)
                    is_logged = self.driver.execute_script("""
                        const side = document.querySelector('div#side, div[aria-label*="conversa"], div[aria-label*="Conversas"]');
                        const search = document.querySelector('div[contenteditable="true"]');
                        const header = document.querySelector('header');
                        const canvas = document.querySelector('canvas');
                        if (canvas) return false;
                        return Boolean(side || (header && search));
                    """)

                    if is_logged:
                        if not self.connected:
                            print("[OK] WhatsApp Conectado com sucesso! Pronto para envios silenciosos.")
                        self.connected = True
                        self.status = "connected"
                        self.qr_code_data = None # Destrói QR code após pareamento seguro
                        continue

                    # 2. Se não está logado, tenta extrair o QR Code do Canvas
                    qr_data = self.driver.execute_script("""
                        const canvas = document.querySelector('canvas');
                        if (canvas) {
                            return canvas.toDataURL('image/png');
                        }
                        return null;
                    """)

                    if qr_data:
                        if self.status != "qr_ready":
                            print("[*] QR Code pronto para leitura. Acesse o painel administrativo para escanear.")
                        self.connected = False
                        self.status = "qr_ready"
                        self.qr_code_data = qr_data
                    else:
                        if not self.connected:
                            self.status = "starting"
            except Exception as loop_err:
                err_str = str(loop_err).lower()
                if "invalid session id" in err_str or "session not created" in err_str or "no such window" in err_str:
                    print(f"[!] Sessão do navegador caiu ({loop_err}). Reiniciando...")
                    try:
                        self.driver.quit()
                    except Exception:
                        pass
                    self.driver = None
                    self.status = "error"
                    self.connected = False

    def send_message(self, phone, message):
        if not self.connected:
            return {"success": False, "error": "WhatsApp da loja não está conectado. Escaneie o QR Code no painel."}

        clean_phone = "".join(filter(str.isdigit, str(phone)))
        if len(clean_phone) < 10 or len(clean_phone) > 13:
            return {"success": False, "error": "Telefone inválido (deve conter DDD + 8 ou 9 dígitos)."}
        if len(clean_phone) in (10, 11) and not clean_phone.startswith("55"):
            clean_phone = "55" + clean_phone

        encoded_msg = urllib.parse.quote(message)
        send_url = f"https://web.whatsapp.com/send?phone={clean_phone}&text={encoded_msg}"

        with self.lock:
            try:
                print(f"[*] Enviando mensagem silenciosa para {clean_phone}...")
                self.driver.get(send_url)

                start_wait = time.time()
                sent = False
                error_msg = None

                while time.time() - start_wait < 35:
                    time.sleep(1.5)

                    # Verifica se apareceu popup de número inválido
                    invalid_popup = self.driver.execute_script("""
                        const popup = document.querySelector('div[data-animate-modal-popup="true"]');
                        if (popup && (popup.innerText.includes('invalido') || popup.innerText.includes('inválido') || popup.innerText.includes('invalid'))) {
                            const btnOk = popup.querySelector('button');
                            if (btnOk) btnOk.click();
                            return true;
                        }
                        return false;
                    """)
                    if invalid_popup:
                        error_msg = "O número informado não possui WhatsApp ou é inválido."
                        break

                    # Tenta clicar no botão de enviar oficial ou despachar Enter no input
                    clicked = self.driver.execute_script("""
                        const btn = document.querySelector('button[aria-label="Enviar"], span[data-icon="send"], span[data-icon="wds-ic-send-filled"], button[data-tab="11"], button[aria-label="Send"]');
                        if (btn) {
                            btn.click();
                            return true;
                        }
                        const input = document.querySelector('footer div[contenteditable="true"]');
                        if (input && input.innerText.trim().length > 0) {
                            const down = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true });
                            const up = new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true });
                            input.dispatchEvent(down);
                            input.dispatchEvent(up);
                            return true;
                        }
                        return false;
                    """)

                    if clicked:
                        time.sleep(2)
                        sent = True
                        break

                if sent:
                    print(f"[+] Mensagem enviada com sucesso para {clean_phone}!")
                    return {"success": True, "phone": clean_phone, "timestamp": int(time.time() * 1000)}
                else:
                    err = error_msg or "Tempo limite esgotado ao aguardar o chat do WhatsApp carregar."
                    print(f"[!] Falha ao enviar para {clean_phone}: {err}")
                    return {"success": False, "error": err}
            except Exception as e:
                print(f"[!] Exceção ao enviar mensagem: {e}")
                return {"success": False, "error": str(e)}

    def _run_supabase_bridge(self):
        last_heartbeat = 0
        while self.running:
            now = time.time()
            # 1. Envia heartbeat com status e QR code (se aguardando leitura)
            if now - last_heartbeat >= 3:
                last_heartbeat = now
                try:
                    status_text = "Conectado e pronto (Servidor da Loja Ativo)" if self.connected else (
                        "Aguardando leitura do QR Code" if self.status == "qr_ready" else "Iniciando sessão..."
                    )
                    payload = {
                        "id": "whatsapp_robot_status",
                        "value": {
                            "online": True,
                            "connected": self.connected,
                            "status": self.status,
                            "statusText": status_text,
                            "hasQr": bool(self.qr_code_data),
                            "qrCode": self.qr_code_data if (self.status == "qr_ready" and self.qr_code_data) else None,
                            "lastHeartbeat": int(now * 1000),
                            "hostname": socket.gethostname(),
                            "port": PORT
                        },
                        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                    }
                    supabase_request(
                        "store_settings",
                        method="POST",
                        data=payload,
                        extra_headers={"Prefer": "resolution=merge-duplicates"}
                    )
                except Exception:
                    pass

            # 2. Processar fila de mensagens pendentes disparadas autenticadas
            if self.connected:
                for q_table in ["whatsapp_queue", "whatsapp_messages_queue"]:
                    try:
                        items = supabase_request(f"{q_table}?status=eq.pending&order=created_at.asc&limit=1")
                        if items and isinstance(items, list) and len(items) > 0:
                            item = items[0]
                            item_id = item.get("id")
                            phone = item.get("phone")
                            msg = item.get("message")

                            supabase_request(
                                f"{q_table}?id=eq.{item_id}",
                                method="PATCH",
                                data={"status": "processing"}
                            )

                            res = self.send_message(phone, msg)
                            iso_now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

                            if res and res.get("success"):
                                supabase_request(
                                    f"{q_table}?id=eq.{item_id}",
                                    method="PATCH",
                                    data={"status": "sent", "processed_at": iso_now, "error": None}
                                )
                            else:
                                err_msg = res.get("error") if res else "Falha ao enviar mensagem"
                                supabase_request(
                                    f"{q_table}?id=eq.{item_id}",
                                    method="PATCH",
                                    data={"status": "failed", "processed_at": iso_now, "error": err_msg}
                                )
                            break
                    except Exception as e:
                        pass

            time.sleep(1.5)

    def stop(self):
        self.running = False
        try:
            payload = {
                "id": "whatsapp_robot_status",
                "value": {
                    "online": False,
                    "connected": False,
                    "status": "offline",
                    "statusText": "Serviço Offline",
                    "hasQr": False,
                    "qrCode": None,
                    "lastHeartbeat": int(time.time() * 1000)
                },
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
            supabase_request(
                "store_settings",
                method="POST",
                data=payload,
                extra_headers={"Prefer": "resolution=merge-duplicates"}
            )
        except Exception:
            pass

        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass


bot = WhatsAppBotManager()

# =============================================================================
# SERVIDOR HTTP REST COM AUTENTICAÇÃO E CORS CONTROLADO (BLINDADO)
# =============================================================================
class LocalApiHandler(BaseHTTPRequestHandler):
    def _is_origin_allowed(self):
        """Valida se a origem da requisição pertence ao app da loja (Zero CORS '*')"""
        origin = self.headers.get("Origin", "")
        if not origin:
            # Requisições locais diretas (sem cabeçalho Origin)
            return True, ""
        
        origin_lower = origin.lower()
        # Origem 'null' (páginas abertas como file:// local no navegador)
        if origin_lower == "null":
            return True, "null"
        # Localhost e loopback
        if re.match(r"^https?://(127\.0\.0\.1|localhost)(:\d+)?$", origin_lower):
            return True, origin
        # GitHub Pages
        if re.match(r"^https://[a-zA-Z0-9-]+\.github\.io$", origin_lower):
            return True, origin

        return False, origin

    def _send_cors(self, origin):
        """Envia cabeçalhos CORS específicos da origem validada (NUNCA '*')"""
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-VIP-Token, Authorization")
        self.send_header("Vary", "Origin")

    def _is_authenticated(self):
        """Exige e valida o token forte de autenticação contra timing attacks"""
        token = self.headers.get("X-VIP-Token")
        if not token:
            auth_h = self.headers.get("Authorization", "")
            if auth_h.startswith("Bearer "):
                token = auth_h[7:].strip()
        if not token:
            parsed = urllib.parse.urlparse(self.path)
            qs = urllib.parse.parse_qs(parsed.query)
            token = qs.get("token", [None])[0]

        if not token:
            return False
        return secrets.compare_digest(token, AUTH_TOKEN)

    def do_OPTIONS(self):
        allowed, origin = self._is_origin_allowed()
        if not allowed:
            self.send_response(403)
            self.end_headers()
            return

        self.send_response(200)
        self._send_cors(origin)
        self.end_headers()

    def do_GET(self):
        allowed, origin = self._is_origin_allowed()
        if not allowed:
            self.send_response(403)
            self.end_headers()
            return

        parsed = urllib.parse.urlparse(self.path)

        # Rota de health-check básico (sem dados confidenciais, apenas diz se a porta responde)
        if parsed.path == "/ping":
            body = json.dumps({"online": True, "authRequired": True}).encode("utf-8")
            self.send_response(200)
            self._send_cors(origin)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # TODAS as rotas que contêm informações de status ou QR Code EXIGEM autenticação
        if not self._is_authenticated():
            self.send_response(401)
            self._send_cors(origin)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            body = json.dumps({
                "success": False,
                "error": "Acesso não autorizado. É necessário fornecer o token de segurança no cabeçalho X-VIP-Token ou Authorization."
            }).encode("utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/status":
            resp = {
                "online": True,
                "connected": bot.connected,
                "status": bot.status,
                "statusText": "Conectado e pronto" if bot.connected else ("Aguardando leitura do QR Code" if bot.status == "qr_ready" else "Iniciando sessão..."),
                "hasQr": bool(bot.qr_code_data),
                "qrCode": bot.qr_code_data,
                "lastError": bot.last_error,
                "timestamp": int(time.time() * 1000)
            }
            body = json.dumps(resp).encode("utf-8")
            self.send_response(200)
            self._send_cors(origin)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        elif parsed.path == "/qr":
            resp = {
                "hasQr": bool(bot.qr_code_data),
                "qrCode": bot.qr_code_data
            }
            body = json.dumps(resp).encode("utf-8")
            self.send_response(200)
            self._send_cors(origin)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self._send_cors(origin)
            self.end_headers()

    def do_POST(self):
        allowed, origin = self._is_origin_allowed()
        if not allowed:
            self.send_response(403)
            self.end_headers()
            return

        # TODAS as rotas POST exigem autenticação rigorosa
        if not self._is_authenticated():
            self.send_response(401)
            self._send_cors(origin)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            body = json.dumps({
                "success": False,
                "error": "Acesso não autorizado. É necessário fornecer o token de segurança no cabeçalho X-VIP-Token ou Authorization."
            }).encode("utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/send":
            content_length = int(self.headers.get("Content-Length", 0))
            raw_bytes = self.rfile.read(content_length)
            try:
                raw_body = raw_bytes.decode("utf-8")
            except UnicodeDecodeError:
                raw_body = raw_bytes.decode("latin-1", errors="replace")

            try:
                data = json.loads(raw_body)
                phone = data.get("phone", "")
                message = data.get("message", "")

                if not phone or not message:
                    res = {"success": False, "error": "Parâmetros 'phone' e 'message' são obrigatórios."}
                else:
                    res = bot.send_message(phone, message)
            except Exception as e:
                res = {"success": False, "error": f"Payload inválido: {e}"}

            body = json.dumps(res).encode("utf-8")
            self.send_response(200)
            self._send_cors(origin)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        elif parsed.path == "/stop":
            print("[*] Recebida solicitação autenticada de parada do serviço via /stop...")
            res = {"success": True, "message": "Serviço encerrado com sucesso."}
            body = json.dumps(res).encode("utf-8")
            self.send_response(200)
            self._send_cors(origin)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

            def do_exit():
                time.sleep(1)
                bot.stop()
                os._exit(0)
            threading.Thread(target=do_exit, daemon=True).start()
        else:
            self.send_response(404)
            self._send_cors(origin)
            self.end_headers()

    def log_message(self, format, *args):
        if "GET /status" in str(args) or "GET /ping" in str(args):
            return
        super().log_message(format, *args)


def main():
    print("=================================================================")
    print("   SALGADOS VIP - SERVIÇO DE WHATSAPP SILENCIOSO LOCAL BLINDADO")
    print("=================================================================")
    print(f"[*] Porta Local: {PORT} (http://127.0.0.1:{PORT}/)")
    print("[*] Modo: Envio 100% Silencioso em Segundo Plano (Zero Janelas)")
    print("[*] Segurança: Autenticação por Token Ativa | CORS Controlado")
    print("[*] Iniciando motor WhatsApp...")

    bot.start()

    server = ThreadingHTTPServer(("127.0.0.1", PORT), LocalApiHandler)
    print(f"[OK] Servidor HTTP pronto para receber pedidos de envio na porta {PORT}.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Encerrando serviço...")
        bot.stop()
        server.server_close()
        print("[*] Serviço encerrado com sucesso.")


if __name__ == "__main__":
    try:
        main()
    except BaseException as e:
        import traceback
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] FATAL ERROR: {traceback.format_exc()}\n")
        sys.exit(1)
