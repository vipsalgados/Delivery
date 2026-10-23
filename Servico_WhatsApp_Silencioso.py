# -*- coding: utf-8 -*-
"""
=============================================================================
SALGADOS VIP - SERVIÇO DE WHATSAPP SILENCIOSO LOCAL (WINDOWS)
=============================================================================
Servidor HTTP leve (porta 18182) com automação em segundo plano do WhatsApp Web.
Permite o envio silencioso de notificações de status para clientes
sem abrir nenhuma janela ou aba no navegador do operador.
=============================================================================
"""

import sys
import os
import time
import json
import threading
import urllib.parse
import urllib.request
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

import socket

PORT = 18182
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0"

# Diretório persistente de perfil para manter a sessão salva após o primeiro escaneamento
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROFILE_DIR = os.path.join(os.environ.get("LOCALAPPDATA", BASE_DIR), "SalgadosVIP", "WhatsAppProfile")
os.makedirs(PROFILE_DIR, exist_ok=True)

# Logger em arquivo para execução 100% oculta em segundo plano (pythonw.exe)
LOG_FILE = os.path.join(os.path.dirname(PROFILE_DIR), "whatsapp_service.log")

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

# Configuração da Nuvem Supabase para permitir acesso remoto por outros computadores/celulares
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

    def _init_driver(self):
        # Limpeza preventiva de processos fantasmas e lockfiles órfãos
        try:
            lockfile = os.path.join(PROFILE_DIR, "lockfile")
            if os.path.exists(lockfile):
                import subprocess
                subprocess.run(
                    'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name = \'msedge.exe\'\\" | Where-Object { $_.CommandLine -like \'*SalgadosVIP*\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"',
                    shell=True,
                    capture_output=True,
                    timeout=6
                )
                time.sleep(1)
                if os.path.exists(lockfile):
                    os.remove(lockfile)
        except Exception as err:
            print(f"[*] Aviso limpeza lockfile: {err}")

        opts = Options()
        opts.add_argument(f"--user-data-dir={PROFILE_DIR}")
        opts.add_argument("--headless=new")
        opts.add_argument("--disable-gpu")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument(f"--user-agent={USER_AGENT}")
        opts.add_argument("--window-size=1280,800")
        opts.add_argument("--no-first-run")
        opts.add_argument("--no-default-browser-check")
        opts.add_experimental_option("excludeSwitches", ["enable-automation"])
        opts.add_experimental_option("useAutomationExtension", False)

        print(f"[*] Inicializando navegador Edge com perfil em: {PROFILE_DIR}")
        self.driver = webdriver.Edge(options=opts)
        self.driver.set_page_load_timeout(60)
        self.driver.get("https://web.whatsapp.com")
        print("[*] WhatsApp Web carregado. Aguardando sincronização...")

    def _run_driver_loop(self):
        try:
            self._init_driver()
        except Exception as e:
            self.status = "error"
            self.last_error = str(e)
            print(f"[!] Erro ao iniciar WebDriver: {e}")
            return

        while self.running:
            try:
                time.sleep(3)
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
                            print("\n[OK] WhatsApp Conectado com sucesso! Pronto para envios silenciosos.\n")
                        self.connected = True
                        self.status = "connected"
                        self.qr_code_data = None
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
            except Exception as e:
                # Se a janela foi fechada ou houve erro temporário
                pass

    def send_message(self, phone, message):
        if not self.connected:
            return {"success": False, "error": "WhatsApp da loja não está conectado. Escaneie o QR Code no painel."}

        clean_phone = "".join(filter(str.isdigit, str(phone)))
        if len(clean_phone) in (10, 11) and not clean_phone.startswith("55"):
            clean_phone = "55" + clean_phone

        encoded_msg = urllib.parse.quote(message)
        send_url = f"https://web.whatsapp.com/send?phone={clean_phone}&text={encoded_msg}"

        with self.lock:
            try:
                print(f"[*] Enviando mensagem silenciosa para {clean_phone}...")
                self.driver.get(send_url)

                # Aguarda até o botão de envio ou aviso de número inválido aparecer
                start_wait = time.time()
                sent = False
                error_msg = None

                while time.time() - start_wait < 25:
                    time.sleep(1)

                    # Verifica se apareceu popup de número inválido
                    invalid_popup = self.driver.execute_script("""
                        const popup = document.querySelector('div[data-animate-modal-popup="true"]');
                        if (popup && popup.innerText.includes('invalido') || popup && popup.innerText.includes('inválido')) {
                            const btnOk = popup.querySelector('button');
                            if (btnOk) btnOk.click();
                            return true;
                        }
                        return false;
                    """)
                    if invalid_popup:
                        error_msg = "O número informado não possui WhatsApp ou é inválido."
                        break

                    # Tenta clicar no botão de enviar oficial
                    clicked = self.driver.execute_script("""
                        const btn = document.querySelector('button[aria-label="Enviar"], span[data-icon="send"]');
                        if (btn) {
                            btn.click();
                            return true;
                        }
                        // Fallback: pressionar Enter no campo de mensagem
                        const input = document.querySelector('footer div[contenteditable="true"]');
                        if (input && input.innerText.trim().length > 0) {
                            const event = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true });
                            input.dispatchEvent(event);
                            return true;
                        }
                        return false;
                    """)

                    if clicked:
                        time.sleep(2) # Aguarda confirmação do balão de envio
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
        print("[*] Ponte Supabase Nuvem iniciada: pronto para receber comandos de outros computadores e celulares.")
        last_heartbeat = 0
        while self.running:
            now = time.time()
            # 1. Enviar heartbeat e status atual para o Supabase a cada 4 segundos
            if now - last_heartbeat >= 4:
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
                            "qrCode": self.qr_code_data,
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

            # 2. Processar fila de mensagens pendentes disparadas por outros computadores/celulares
            if self.connected:
                try:
                    items = supabase_request("whatsapp_queue?status=eq.pending&order=created_at.asc&limit=1")
                    if items and isinstance(items, list) and len(items) > 0:
                        item = items[0]
                        item_id = item.get("id")
                        phone = item.get("phone")
                        msg = item.get("message")
                        origin = item.get("device_origin") or "Remoto"

                        print(f"[*] [Fila Nuvem] Mensagem recebida de dispositivo remoto ({origin}): {phone} (ID: {item_id})")

                        # Marca como 'processing'
                        supabase_request(
                            f"whatsapp_queue?id=eq.{item_id}",
                            method="PATCH",
                            data={"status": "processing"}
                        )

                        # Envia silenciosamente pelo WebDriver
                        res = self.send_message(phone, msg)
                        iso_now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

                        if res and res.get("success"):
                            print(f"[+] [Fila Nuvem] Mensagem enviada com sucesso para {phone}!")
                            supabase_request(
                                f"whatsapp_queue?id=eq.{item_id}",
                                method="PATCH",
                                data={
                                    "status": "sent",
                                    "processed_at": iso_now,
                                    "error": None
                                }
                            )
                        else:
                            err_msg = res.get("error") if res else "Falha ao enviar mensagem"
                            print(f"[!] [Fila Nuvem] Erro ao enviar para {phone}: {err_msg}")
                            supabase_request(
                                f"whatsapp_queue?id=eq.{item_id}",
                                method="PATCH",
                                data={
                                    "status": "failed",
                                    "processed_at": iso_now,
                                    "error": err_msg
                                }
                            )
                except Exception as e:
                    print(f"[*] Erro ao processar fila do Supabase: {e}")

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

class LocalApiHandler(BaseHTTPRequestHandler):
    def _send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
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
            self._send_cors()
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
            self._send_cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self._send_cors()
            self.end_headers()

    def do_POST(self):
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
            self._send_cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif parsed.path == "/stop":
            print("[*] Recebida solicitação de parada do serviço via /stop...")
            res = {"success": True, "message": "Serviço encerrado com sucesso."}
            body = json.dumps(res).encode("utf-8")
            self.send_response(200)
            self._send_cors()
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
            self._send_cors()
            self.end_headers()

    def log_message(self, format, *args):
        # Suprime logs de requisições GET para não poluir o terminal
        if "GET /status" in str(args):
            return
        super().log_message(format, *args)


def main():
    print("=================================================================")
    print("   SALGADOS VIP - SERVIÇO DE WHATSAPP SILENCIOSO LOCAL")
    print("=================================================================")
    print(f"[*] Porta Local: {PORT} (http://127.0.0.1:{PORT}/)")
    print("[*] Modo: Envio 100% Silencioso em Segundo Plano (Zero Janelas)")
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
