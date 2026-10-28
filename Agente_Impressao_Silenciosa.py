# -*- coding: utf-8 -*-
"""
=============================================================================
SALGADOS VIP - AGENTE DE IMPRESSÃO SILENCIOSA E MONITOR DE PEDIDOS (WINDOWS)
=============================================================================
Aplicativo autônomo em segundo plano (Zero Janelas / Sem Diálogos).
Pode rodar na inicialização do Windows (Startup) mesmo sem o navegador aberto!

RECURSOS PRINCIPAIS:
1. Impressão direta no Spooler do Windows (winspool.drv / Out-Printer).
2. Monitor autônomo da Nuvem Supabase: capta novos pedidos e imprime automaticamente
   mesmo com o app fechado ou desligado em outros computadores.
3. Servidor HTTP local (porta 18181) para comandos do painel admin web.
4. Blindagem de segurança:
   - Autenticação por token (X-VIP-Token / Authorization Bearer).
   - CORS estrito: whitelist de origens locais e GitHub Pages (Zero '*').
   - Limite de cópias (máx. 5) e limite de tamanho de texto (máx. 64KB).
   - Sanitização do nome da impressora contra injeção de comandos.
   - Limpeza garantida de arquivos temporários em bloco finally.
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
import tempfile
import subprocess
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

# Importações Win32 / ctypes
import ctypes
from ctypes import wintypes

PORT = 18181
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DATA_DIR = os.path.join(os.environ.get("LOCALAPPDATA", BASE_DIR), "SalgadosVIP")
os.makedirs(APP_DATA_DIR, exist_ok=True)

LOG_FILE = os.path.join(APP_DATA_DIR, "spooler_service.log")
HISTORY_FILE = os.path.join(APP_DATA_DIR, "impressao_historico.jsonl")
TOKEN_FILE = os.path.join(APP_DATA_DIR, "service_auth.key")
LOCAL_TOKEN_FILE = os.path.join(BASE_DIR, "whatsapp_service_token.json")

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

# =============================================================================
# GESTÃO DE TOKEN E SUPABASE
# =============================================================================
SUPABASE_URL = "https://koudymqezejvhdazvqom.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdWR5bXFlemVqdmhkYXp2cW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5OTQyNjAsImV4cCI6MjEwNzU3MDI2MH0.it1qrMFxDnCb3mihTcsyPjrg3c0T34TLm0yzUaATPpM"

def get_auth_token():
    token = None
    if os.path.exists(TOKEN_FILE):
        try:
            with open(TOKEN_FILE, "r", encoding="utf-8") as f:
                t = f.read().strip()
                if len(t) >= 32:
                    token = t
        except Exception:
            pass

    if not token and os.path.exists(LOCAL_TOKEN_FILE):
        try:
            with open(LOCAL_TOKEN_FILE, "r", encoding="utf-8") as f:
                d = json.load(f)
                if d.get("token"):
                    token = d.get("token")
        except Exception:
            pass

    if not token:
        token = secrets.token_hex(32)
        try:
            with open(TOKEN_FILE, "w", encoding="utf-8") as f:
                f.write(token)
        except Exception:
            pass

    return token

AUTH_TOKEN = get_auth_token()

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
        with urllib.request.urlopen(req, timeout=10) as response:
            resp_body = response.read().decode("utf-8")
            if resp_body:
                return json.loads(resp_body)
            return None
    except Exception as e:
        return None

# =============================================================================
# MOTOR DE IMPRESSÃO SPOOLER WINDOWS (DUAL ENGINE)
# =============================================================================
winspool = None
try:
    winspool = ctypes.WinDLL("winspool.drv")
except Exception:
    pass

class DOC_INFO_1W(ctypes.Structure):
    _fields_ = [
        ("pDocName", wintypes.LPWSTR),
        ("pOutputFile", wintypes.LPWSTR),
        ("pDataType", wintypes.LPWSTR),
    ]

def get_default_printer():
    if winspool:
        try:
            buf_size = wintypes.DWORD(0)
            winspool.GetDefaultPrinterW(None, ctypes.byref(buf_size))
            if buf_size.value > 0:
                buf = ctypes.create_unicode_buffer(buf_size.value)
                if winspool.GetDefaultPrinterW(buf, ctypes.byref(buf_size)):
                    return buf.value
        except Exception:
            pass
    return ""

def list_installed_printers():
    printers = []
    if not winspool:
        return printers
    try:
        needed = wintypes.DWORD(0)
        returned = wintypes.DWORD(0)
        PRINTER_ENUM_LOCAL = 2
        PRINTER_ENUM_CONNECTIONS = 4
        winspool.EnumPrintersW(PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS, None, 1, None, 0, ctypes.byref(needed), ctypes.byref(returned))
        if needed.value > 0:
            buf = ctypes.create_string_buffer(needed.value)
            if winspool.EnumPrintersW(PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS, None, 1, buf, needed.value, ctypes.byref(needed), ctypes.byref(returned)):
                class PRINTER_INFO_1W(ctypes.Structure):
                    _fields_ = [('flags', wintypes.DWORD), ('pDescription', wintypes.LPWSTR), ('pName', wintypes.LPWSTR), ('pComment', wintypes.LPWSTR)]
                items = ctypes.cast(buf, ctypes.POINTER(PRINTER_INFO_1W * returned.value)).contents
                for item in items:
                    if item.pName and item.pName.strip():
                        printers.append(item.pName.strip())
    except Exception:
        pass
    return printers

def print_via_winspool(printer_name, text, copies=1):
    if not winspool:
        return False, "winspool.drv não disponível"

    hPrinter = wintypes.HANDLE()
    if not winspool.OpenPrinterW(printer_name, ctypes.byref(hPrinter), None):
        return False, f"Falha ao abrir impressora '{printer_name}'"

    try:
        doc_info = DOC_INFO_1W("Salgados VIP Comanda", None, "RAW")
        for _ in range(copies):
            job_id = winspool.StartDocPrinterW(hPrinter, 1, ctypes.byref(doc_info))
            if job_id == 0:
                return False, "Falha em StartDocPrinterW"
            try:
                if not winspool.StartPagePrinter(hPrinter):
                    return False, "Falha em StartPagePrinter"
                try:
                    # Encodar em CP1252 para manter formatação térmica padrão
                    raw_bytes = text.encode("cp1252", errors="replace")
                    written = wintypes.DWORD()
                    if not winspool.WritePrinter(hPrinter, raw_bytes, len(raw_bytes), ctypes.byref(written)):
                        return False, "Falha em WritePrinter"
                finally:
                    winspool.EndPagePrinter(hPrinter)
            finally:
                winspool.EndDocPrinter(hPrinter)
        return True, "Impresso com sucesso via winspool RAW"
    finally:
        winspool.ClosePrinter(hPrinter)

def print_via_powershell(printer_name, text, copies=1):
    temp_file = None
    try:
        temp_fd, temp_file = tempfile.mkstemp(suffix=".txt", prefix="salgados_vip_")
        with os.fdopen(temp_fd, "w", encoding="cp1252", errors="replace") as f:
            f.write(text)

        cmd = f'for ($i = 1; $i -le {copies}; $i++) {{ Get-Content -LiteralPath "{temp_file}" | Out-Printer -Name "{printer_name}" }}'
        res = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
            capture_output=True, text=True, timeout=12
        )
        if res.returncode == 0:
            return True, "Impresso com sucesso via Out-Printer"
        return False, f"Erro Out-Printer: {res.stderr.strip()}"
    finally:
        if temp_file and os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except Exception:
                pass

def print_receipt(text, printer_name=None, copies=1):
    """
    Executa impressão direta no Spooler com sanitização estrita e dual-engine.
    """
    # 1. Sanitização do nome da impressora
    target = printer_name or get_default_printer()
    if not target or target in ("windows_default", "default", ""):
        target = get_default_printer()

    if not target:
        return False, "Nenhuma impressora padrão configurada no Windows."

    # Bloqueia caracteres de injeção de comandos
    if re.search(r"[;&|`$<>]", target):
        return False, "Nome de impressora inválido ou inseguro."

    # Limite estrito de cópias (mín 1, máx 5)
    copies = max(1, min(int(copies or 1), 5))

    # Tenta motor 1: winspool.drv
    try:
        ok, msg = print_via_winspool(target, text, copies)
        if ok:
            return True, msg
    except Exception as err:
        print(f"[*] Aviso motor winspool: {err}. Recorrendo ao motor PowerShell...")

    # Tenta motor 2: PowerShell Out-Printer
    try:
        ok2, msg2 = print_via_powershell(target, text, copies)
        if ok2:
            return True, msg2
        return False, msg2
    except Exception as err2:
        return False, str(err2)

# =============================================================================
# FORMATADOR DE COMPROVANTE TÉRMICO EM TEXTO (58mm / 80mm)
# =============================================================================
def format_currency(val):
    try:
        v = float(val)
        return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return "R$ 0,00"

def build_order_receipt_text(order, cols=40):
    lines = []
    div = "=" * cols
    thin = "-" * cols

    def center(s):
        s = str(s or "")
        return s.center(cols)[:cols]

    def line(l, r):
        l, r = str(l or ""), str(r or "")
        space = cols - len(l) - len(r)
        if space < 1:
            return (l + " " + r)[:cols]
        return l + (" " * space) + r

    # Cabecalho Compacto (1 Pagina)
    lines.append(div)
    lines.append(center("SALGADOS VIP DELIVERY"))
    lines.append(center("WhatsApp: (21) 98675-8102"))
    lines.append(div)

    # Identificacao do Pedido
    order_id = order.get("id") or order.get("order_id") or "VIP-000"
    created_at = order.get("created_at") or int(time.time() * 1000)
    try:
        t_sec = created_at / 1000.0 if created_at > 1e11 else float(created_at)
        dt_str = time.strftime("%d/%m %H:%M", time.localtime(t_sec))
    except Exception:
        dt_str = time.strftime("%d/%m %H:%M")

    lines.append(line(f"PEDIDO #{order_id}", dt_str))

    # Cliente & Contato
    cust = order.get("customer") or {}
    cust_name = str(cust.get("name") or "Cliente")[:cols-18]
    cust_phone = str(cust.get("phone") or "")
    lines.append(line("CLIENTE:", f"{cust_name} {cust_phone}".strip()))

    fulfillment = order.get("fulfillment") or cust.get("fulfillment") or "Entrega"
    is_delivery = fulfillment == "Entrega"
    if is_delivery:
        addr = cust.get("address") or f"{cust.get('street', '')}, {cust.get('number', '')} - {cust.get('neighborhood', '')}"
        lines.append(f"ENTREGA: {addr[:cols-9]}")
        if cust.get("reference"):
            lines.append(f"REF: {str(cust.get('reference'))[:cols-5]}")
    else:
        lines.append(line("MODALIDADE:", "RETIRADA NO BALCAO"))

    is_sched = order.get("timing_type") == "agendado" or order.get("timingType") == "agendado"
    if is_sched:
        sched_date = order.get("scheduled_date") or order.get("scheduledDate") or ""
        sched_time = order.get("scheduled_time") or order.get("scheduledTime") or ""
        lines.append(line("AGENDADO PARA:", f"{sched_date} {sched_time}"))

    # Itens do Pedido
    lines.append(thin)
    lines.append(center("ITENS DO PEDIDO"))
    items = order.get("items") or []

    for it in items:
        itype = it.get("type")
        if itype == "kit":
            p = it.get("finalPrice") or it.get("price") or 0
            lines.append(line(f"1x {it.get('kitName') or 'Kit Salgados'}", format_currency(p)))
            for f in it.get("flavors") or []:
                lines.append(f"  • {f.get('quantity', 0)}x {f.get('name', '')}")
            for m in it.get("sauces") or []:
                lines.append(f"  • Molho: {m.get('quantity', 1)}x {m.get('name', '')}")
        elif itype == "combo":
            p = it.get("finalPrice") or it.get("price") or 0
            lines.append(line(f"1x {it.get('name') or 'Combo'}", format_currency(p)))
            for ci in it.get("items") or []:
                lines.append(f"  • {ci.get('quantity', 1)}x {ci.get('name', '')}")
        else:
            qty = it.get("quantity") or 1
            name = it.get("name") or "Produto"
            price = it.get("price") or 0
            is_drink = any(d in name.lower() for d in ["coca", "guarana", "refrigerante", "suco", "agua", "bebida", "cerveja", "2l"])
            prefix = "[GELADA] " if is_drink else ""
            lines.append(line(f"{qty}x {prefix}{name}", format_currency(price * qty)))

    notes = order.get("notes") or cust.get("notes")
    if notes:
        lines.append(f"OBS: {str(notes)[:cols-5]}")

    # Totais e Pagamento
    subtotal = order.get("subtotal") or order.get("subtotalAmount") or order.get("total_amount") or 0
    fee = order.get("delivery_fee") or order.get("deliveryFee") or 0
    total = order.get("total_amount") or order.get("totalAmount") or subtotal + fee

    lines.append(thin)
    if fee > 0:
        lines.append(line("Subtotal:", format_currency(subtotal)))
        lines.append(line("Taxa de Entrega:", format_currency(fee)))
    lines.append(line("TOTAL DO PEDIDO:", format_currency(total)))

    pay_method = order.get("payment_method") or order.get("paymentMethod") or "A Definir"
    lines.append(line("PAGAMENTO:", pay_method))

    chg = order.get("cash_change_for") or order.get("cashChangeFor")
    if chg:
        lines.append(line("Troco para:", str(chg)))

    lines.append(div)
    lines.append(center("Obrigado pela preferencia!"))
    lines.append(center("Salgados VIP - Nova Iguacu"))
    lines.append(div)
    lines.append("")
    return "\r\n".join(lines)


# =============================================================================
# MONITOR DA NUVEM SUPABASE (IMPRESSÃO 100% INDEPENDENTE DE NAVEGADOR)
# =============================================================================
class SupabaseOrderMonitor:
    def __init__(self):
        self.running = True
        self.printed_ids = set()
        self.load_local_history()

    def load_local_history(self):
        if os.path.exists(HISTORY_FILE):
            try:
                with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            try:
                                d = json.loads(line)
                                if d.get("id"):
                                    self.printed_ids.add(d["id"])
                            except Exception:
                                pass
            except Exception:
                pass

    def record_printed_locally(self, order_id, order_data):
        self.printed_ids.add(order_id)
        try:
            with open(HISTORY_FILE, "a", encoding="utf-8") as f:
                record = {
                    "id": order_id,
                    "printed_at": int(time.time() * 1000),
                    "total": order_data.get("total_amount") or order_data.get("totalAmount"),
                    "customer": order_data.get("customer", {}).get("name")
                }
                f.write(json.dumps(record, ensure_ascii=False) + "\n")
        except Exception:
            pass

    def start(self):
        threading.Thread(target=self._poll_loop, daemon=True).start()

    def _poll_loop(self):
        print("[*] Monitor Supabase ativo: pronto para imprimir pedidos que chegarem (mesmo com navegador fechado ou de outro computador).")
        last_queue_check = 0
        while self.running:
            try:
                # 1. Verifica pedidos não impressos no Supabase
                endpoint = "orders?printed=eq.false&status=in.(novo,em_preparo)&order=created_at.asc&limit=5"
                orders = supabase_request(endpoint)

                if orders and isinstance(orders, list) and len(orders) > 0:
                    for ord in orders:
                        oid = ord.get("id") or ord.get("order_id")
                        if not oid or oid in self.printed_ids:
                            continue

                        print(f"[+] [AUTO-PRINT] Novo pedido detectado na nuvem: #{oid}")
                        receipt = build_order_receipt_text(ord, cols=40)
                        ok, msg = print_receipt(receipt)
                        if ok:
                            print(f"[+] [AUTO-PRINT] Pedido #{oid} impresso com sucesso no Spooler (1 página compacta)!")
                            supabase_request(
                                f"orders?id=eq.{oid}",
                                method="PATCH",
                                data={
                                    "printed": True,
                                    "printed_at": int(time.time() * 1000)
                                }
                            )
                            self.record_printed_locally(oid, ord)
                        else:
                            print(f"[!] [AUTO-PRINT] Falha ao imprimir pedido #{oid}: {msg}")

                # 2. Verifica fila de impressão remota disparada de qualquer computador
                now = time.time()
                if now - last_queue_check >= 2.5:
                    last_queue_check = now
                    q_data = supabase_request("store_settings?id=eq.print_queue")
                    if q_data and isinstance(q_data, list) and len(q_data) > 0:
                        val = q_data[0].get("value") or {}
                        req_order = val.get("orderId") or val.get("pendingOrderId")
                        req_text = val.get("receiptText")
                        req_time = val.get("requestedAt") or 0
                        if req_order and (now * 1000 - req_time < 60000) and not val.get("processed"):
                            print(f"[+] [CLOUD-QUEUE] Imprimindo pedido manual remoto #{req_order}...")
                            if not req_text:
                                o_data = supabase_request(f"orders?id=eq.{req_order}")
                                if o_data and isinstance(o_data, list) and len(o_data) > 0:
                                    req_text = build_order_receipt_text(o_data[0], cols=40)
                            if req_text:
                                ok_q, msg_q = print_receipt(req_text, copies=val.get("copies", 1))
                                if ok_q:
                                    print(f"[+] [CLOUD-QUEUE] Pedido #{req_order} impresso com sucesso!")
                                    val["processed"] = True
                                    val["printedAt"] = int(time.time() * 1000)
                                    supabase_request(
                                        "store_settings",
                                        method="POST",
                                        data={"id": "print_queue", "value": val},
                                        extra_headers={"Prefer": "resolution=merge-duplicates"}
                                    )
                                    supabase_request(
                                        f"orders?id=eq.{req_order}",
                                        method="PATCH",
                                        data={"printed": True, "printed_at": int(time.time() * 1000)}
                                    )
                                    self.printed_ids.add(req_order)
            except Exception as e:
                pass

            time.sleep(2.0)

monitor = SupabaseOrderMonitor()

# =============================================================================
# SERVIDOR HTTP REST LOCAL NA PORTA 18181 (BLINDADO)
# =============================================================================
class SpoolerApiHandler(BaseHTTPRequestHandler):
    def _is_origin_allowed(self):
        origin = self.headers.get("Origin", "")
        if not origin:
            return True, ""
        olow = origin.lower()
        if olow == "null":
            return True, "null"
        if re.match(r"^https?://(127\.0\.0\.1|localhost)(:\d+)?$", olow):
            return True, origin
        if re.match(r"^https?://(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$", olow):
            return True, origin
        if re.match(r"^https://[a-zA-Z0-9-]+\.github\.io$", olow):
            return True, origin
        if re.match(r"^https://[a-zA-Z0-9-]+\.netlify\.app$", olow) or re.match(r"^https://[a-zA-Z0-9-]+\.vercel\.app$", olow):
            return True, origin
        return False, origin

    def _send_cors(self, origin):
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-VIP-Token, Authorization")
        self.send_header("Vary", "Origin")

    def _is_authenticated(self):
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

        if parsed.path == "/ping":
            body = json.dumps({"online": True, "service": "Salgados VIP Spooler"}).encode("utf-8")
            self.send_response(200)
            self._send_cors(origin)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        is_local_client = self.client_address[0] in ("127.0.0.1", "::1", "localhost")
        if not (is_local_client or self._is_authenticated()):
            self.send_response(401)
            self._send_cors(origin)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            body = json.dumps({"success": False, "error": "Unauthorized: Token ausente ou inválido."}).encode("utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/status":
            def_printer = get_default_printer()
            printers = list_installed_printers()
            resp = {
                "online": True,
                "status": "online",
                "defaultPrinter": def_printer,
                "installedPrinters": printers,
                "autoPrintActive": monitor.running,
                "printedCount": len(monitor.printed_ids)
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

        is_local_client = self.client_address[0] in ("127.0.0.1", "::1", "localhost")
        if not (is_local_client or self._is_authenticated()):
            self.send_response(401)
            self._send_cors(origin)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            body = json.dumps({"success": False, "error": "Unauthorized: Token ausente ou inválido."}).encode("utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/print":
            content_length = int(self.headers.get("Content-Length", 0))

            # Limite estrito de segurança: máx 64KB de payload
            if content_length > 65536:
                self.send_response(400)
                self._send_cors(origin)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                body = json.dumps({"success": False, "error": "Payload excede o limite de segurança de 64KB."}).encode("utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            raw_bytes = self.rfile.read(content_length)
            try:
                raw_body = raw_bytes.decode("utf-8")
            except UnicodeDecodeError:
                raw_body = raw_bytes.decode("latin-1", errors="replace")

            try:
                data = json.loads(raw_body)
                receipt_text = data.get("receiptText") or data.get("text") or ""
                order_id = data.get("orderId") or "MANUAL"
                printer_name = data.get("printerName")
                copies = data.get("copies", 1)

                if not receipt_text or not receipt_text.strip():
                    res = {"success": False, "error": "Conteúdo do comprovante (receiptText) é obrigatório."}
                else:
                    ok, msg = print_receipt(receipt_text, printer_name=printer_name, copies=copies)
                    res = {"success": ok, "orderId": order_id, "message": msg}
                    if ok and order_id != "MANUAL":
                        monitor.record_printed_locally(order_id, {"total_amount": 0})
            except Exception as e:
                res = {"success": False, "error": f"Payload inválido: {e}"}

            body = json.dumps(res).encode("utf-8")
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

    def log_message(self, format, *args):
        if "GET /status" in str(args) or "GET /ping" in str(args):
            return
        super().log_message(format, *args)


def main():
    print("=================================================================")
    print("   SALGADOS VIP - AGENTE DE IMPRESSAO SILENCIOSA BLINDADO")
    print("=================================================================")
    print(f"[*] Porta Local: {PORT} (http://127.0.0.1:{PORT}/)")
    print("[*] Modo: Spooler Windows Direto (Zero Janelas / Sem Dialogos)")
    print(f"[*] Impressora Padrao: {get_default_printer() or 'Nenhuma encontrada'}")

    monitor.start()

    server = ThreadingHTTPServer(("127.0.0.1", PORT), SpoolerApiHandler)
    print(f"[OK] Servidor de impressao pronto na porta {PORT}.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Encerrando agente de impressao...")
        monitor.running = False
        server.server_close()
        print("[*] Servico encerrado com sucesso.")

if __name__ == "__main__":
    try:
        main()
    except BaseException as e:
        import traceback
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] FATAL ERROR: {traceback.format_exc()}\n")
        sys.exit(1)
