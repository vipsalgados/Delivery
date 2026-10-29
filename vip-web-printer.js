/**
 * ==============================================================================
 * SALGADOS VIP - MOTOR UNIVERSAL DE IMPRESSÃO TÉRMICA WEB (v46.0)
 * ==============================================================================
 * Suporte completo e independente para qualquer computador (PC 1, PC 2, etc.):
 * 1. WebUSB Direto (sem aplicativos ou programas externos, ESC/POS nativo)
 * 2. WebSerial Direto (portas COM / USB-Serial)
 * 3. Spooler Nativo do Windows (Porta 18181 quando ativo)
 * 4. Kiosk Silent Print nativo do navegador (window.print() sem janelas)
 * 5. Configuração isolada por computador (localStorage independente)
 */

(function() {
  const LOCAL_STORAGE_KEY = "vip_local_printer_device_target";
  const LOCAL_USB_DEVICE_KEY = "vip_local_paired_usb_printer";

  const VIPWebPrinter = {
    pairedUsbDevice: null,
    pairedSerialPort: null,
    isPrinting: false,

    // Inicialização ao carregar a página
    async init() {
      // 1. Tentar reconectar dispositivo WebUSB previamente autorizado neste navegador
      if (navigator.usb) {
        try {
          const devices = await navigator.usb.getDevices();
          if (devices && devices.length > 0) {
            this.pairedUsbDevice = devices[0];
            console.log("[VIPWebPrinter] Dispositivo USB reconectado automaticamente:", this.pairedUsbDevice.productName || "Impressora USB");
          }
        } catch (e) {
          console.warn("[VIPWebPrinter] Aviso ao reconectar WebUSB:", e);
        }
      }

      // 2. Tentar reconectar dispositivo WebSerial previamente autorizado
      if (navigator.serial) {
        try {
          const ports = await navigator.serial.getPorts();
          if (ports && ports.length > 0) {
            this.pairedSerialPort = ports[0];
            console.log("[VIPWebPrinter] Porta Serial reconectada automaticamente.");
          }
        } catch (e) {
          console.warn("[VIPWebPrinter] Aviso ao reconectar WebSerial:", e);
        }
      }

      this.updateUiStatus();
    },

    // Obtém o alvo de impressão configurado especificamente para este computador
    getLocalTarget() {
      return localStorage.getItem(LOCAL_STORAGE_KEY) || "windows_default";
    },

    // Salva o alvo de impressão para este computador (não sobrescreve outros computadores)
    setLocalTarget(target) {
      localStorage.setItem(LOCAL_STORAGE_KEY, target || "windows_default");
      this.updateUiStatus();
    },

    // Emparelhar impressora via WebUSB nativo
    async pairUsbDevice() {
      if (!navigator.usb) {
        alert("O seu navegador atual não suporta WebUSB. Recomendamos utilizar o Google Chrome ou Microsoft Edge atualizados.");
        return false;
      }

      try {
        // Abre seletor nativo do navegador para o usuário escolher a impressora USB
        const device = await navigator.usb.requestDevice({ filters: [] });
        if (!device) return false;

        this.pairedUsbDevice = device;
        localStorage.setItem(LOCAL_STORAGE_KEY, "webusb");
        localStorage.setItem(LOCAL_USB_DEVICE_KEY, JSON.stringify({
          vendorId: device.vendorId,
          productId: device.productId,
          productName: device.productName || "Impressora Térmica USB"
        }));

        this.updateUiStatus();
        alert(`✓ Impressora USB conectada com sucesso: ${device.productName || "Impressora Térmica USB"}!\n\nAgora os pedidos serão impressos automaticamente e direto na impressora sem abrir nenhuma janela.`);
        
        // Dispara teste de 2 linhas
        await this.printRawTestUsb();
        return true;
      } catch (err) {
        if (err.name !== "NotFoundError") {
          console.error("[VIPWebPrinter] Erro ao emparelhar USB:", err);
          alert("Não foi possível conectar ao dispositivo USB selecionado. Certifique-se de que ele não está bloqueado com exclusividade pelo driver do Windows, ou utilize o modo 'Impressora Padrão do Windows'.");
        }
        return false;
      }
    },

    // Emparelhar porta Serial / COM
    async pairSerialPort() {
      if (!navigator.serial) {
        alert("O seu navegador atual não suporta WebSerial. Utilize o Google Chrome ou Microsoft Edge.");
        return false;
      }

      try {
        const port = await navigator.serial.requestPort();
        if (!port) return false;

        this.pairedSerialPort = port;
        localStorage.setItem(LOCAL_STORAGE_KEY, "webserial");
        this.updateUiStatus();
        alert("✓ Porta Serial / COM conectada com sucesso!");
        return true;
      } catch (err) {
        if (err.name !== "NotFoundError") {
          console.error("[VIPWebPrinter] Erro ao emparelhar Serial:", err);
        }
        return false;
      }
    },

    // Desconectar dispositivo USB emparelhado
    async disconnectUsb() {
      if (this.pairedUsbDevice) {
        try {
          if (this.pairedUsbDevice.opened) {
            await this.pairedUsbDevice.close();
          }
        } catch (e) {}
        this.pairedUsbDevice = null;
      }
      localStorage.removeItem(LOCAL_USB_DEVICE_KEY);
      this.setLocalTarget("windows_default");
      this.updateUiStatus();
    },

    // Atualiza badges e textos na interface do Admin
    updateUiStatus() {
      const badge = document.getElementById("badge-print-agent-status");
      const targetSelect = document.getElementById("cfg-printer-target");
      const customNameInput = document.getElementById("cfg-printer-custom-name-box");
      const localTarget = this.getLocalTarget();

      if (targetSelect && localTarget) {
        targetSelect.value = localTarget;
      }

      if (customNameInput) {
        customNameInput.style.display = (localTarget === "custom") ? "block" : "none";
      }

      const statusBox = document.getElementById("vip-printer-device-status-text");
      if (statusBox) {
        if (localTarget === "webusb" && this.pairedUsbDevice) {
          statusBox.innerHTML = `<strong>Conectada (WebUSB):</strong> ${this.pairedUsbDevice.productName || "Impressora Térmica USB"} (Vendor: 0x${this.pairedUsbDevice.vendorId.toString(16)})`;
        } else if (localTarget === "webusb") {
          statusBox.innerHTML = `<em>Modo WebUSB selecionado (Nenhuma impressora USB conectada ainda. Clique em 'Conectar USB').</em>`;
        } else if (localTarget === "webserial") {
          statusBox.innerHTML = `<strong>Conectada (Porta Serial / COM):</strong> Pronta para envio direto ESC/POS.`;
        } else {
          statusBox.innerHTML = `<strong>Modo Sistema:</strong> Impressora padrão deste computador (Universal).`;
        }
      }

      if (badge) {
        badge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Impressão Universal Ativa`;
        badge.className = "badge-silent-active";
      }
    },

    // Gera comandos brutos ESC/POS para envio direto ao cabeçote térmico
    buildEscPosBytes(order, cfg, printerCfg) {
      const ESC = "\x1B";
      const GS = "\x1D";
      const paperWidth = parseInt(printerCfg.textColumns) || (printerCfg.paperWidth === "58mm" ? 30 : 40);

      const divider = "=".repeat(paperWidth) + "\n";
      const thinDivider = "-".repeat(paperWidth) + "\n";

      function padCenter(text) {
        const str = String(text || "").trim();
        if (str.length >= paperWidth) return str.substring(0, paperWidth) + "\n";
        const pad = Math.floor((paperWidth - str.length) / 2);
        return " ".repeat(pad) + str + "\n";
      }

      function padLine(left, right) {
        const l = String(left || "");
        const r = String(right || "");
        const space = paperWidth - l.length - r.length;
        if (space <= 0) return (l + " " + r).substring(0, paperWidth) + "\n";
        return l + " ".repeat(space) + r + "\n";
      }

      let cmd = "";
      // 1. Inicializa impressora
      cmd += ESC + "@";
      // 2. Alinhamento central e cabeçalho grande
      cmd += ESC + "a\x01"; // center
      cmd += ESC + "E\x01"; // bold
      cmd += GS + "!\x11";  // double size
      cmd += (cfg.name ? cfg.name.toUpperCase() : "SALGADOS VIP") + "\n";
      cmd += GS + "!\x00";  // normal size
      cmd += "DELIVERY & BALCAO - NOVA IGUACU\n";
      if (cfg.phone) cmd += "WhatsApp: " + cfg.phone + "\n";
      cmd += divider;

      // 3. Dados do Pedido
      const orderDateStr = new Date(order.createdAt).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
      });
      cmd += ESC + "a\x00"; // left align
      cmd += padLine(`PEDIDO #${order.id || order.orderId}`, orderDateStr);

      const custName = (order.customer?.name || "Cliente").substring(0, 18);
      const custPhone = order.customer?.phone || "";
      cmd += padLine("CLIENTE:", `${custName} ${custPhone}`.trim());

      const isDelivery = order.fulfillment === "Entrega" || order.customer?.fulfillment !== "Retirada";
      if (isDelivery) {
        const addr = order.customer?.address || "Endereco nao informado";
        cmd += `ENTREGA: ${addr.substring(0, paperWidth - 9)}\n`;
        if (order.customer?.reference) {
          cmd += `REF: ${order.customer.reference.substring(0, paperWidth - 5)}\n`;
        }
      } else {
        cmd += padLine("MODALIDADE:", "RETIRADA NO BALCAO");
      }

      if (order.timingType === "agendado" && order.scheduledDate) {
        cmd += divider;
        cmd += padCenter("[ PEDIDO AGENDADO ]");
        cmd += padLine("Data Entrega:", order.scheduledDate);
        cmd += padLine("Horario:", order.scheduledTime || "");
        cmd += divider;
      }

      // 4. Bebidas em Destaque
      const drinks = (typeof extractOrderDrinks === "function") ? extractOrderDrinks(order) : [];
      if (drinks.length > 0 && printerCfg.highlightDrinks !== false) {
        cmd += divider;
        cmd += padCenter("*** CONTEM BEBIDA GELADA ***");
        drinks.forEach(d => {
          cmd += padLine(`  ${d.quantity}x ${d.name}`, "");
        });
        cmd += divider;
      }

      // 5. Itens do Pedido
      cmd += thinDivider;
      cmd += padCenter("[ ITENS DO PEDIDO ]");
      (order.items || []).forEach(item => {
        const qty = item.quantity || 1;
        const name = (item.name || "Item").substring(0, paperWidth - 14);
        const price = (typeof formatBRL === "function") ? formatBRL(item.totalPrice || item.price || 0) : `R$ ${item.totalPrice || 0}`;
        cmd += ESC + "E\x01"; // bold
        cmd += padLine(`${qty}x ${name}`, price);
        cmd += ESC + "E\x00"; // normal

        if (item.selectedFlavor) cmd += `   Sabor: ${item.selectedFlavor}\n`;
        if (item.flavorDistribution) cmd += `   Distrib: ${item.flavorDistribution}\n`;
        if (item.notes) cmd += `   Obs: ${item.notes}\n`;
      });

      if (order.customer?.notes) {
        cmd += `OBS: ${order.customer.notes}\n`;
      }

      // 6. Totais e Pagamento
      cmd += thinDivider;
      if (order.deliveryFee && order.deliveryFee > 0) {
        const sub = (typeof formatBRL === "function") ? formatBRL(order.subtotalAmount || order.totalAmount || 0) : `R$ ${order.totalAmount || 0}`;
        const fee = (typeof formatBRL === "function") ? formatBRL(order.deliveryFee) : `R$ ${order.deliveryFee}`;
        cmd += padLine("Subtotal:", sub);
        cmd += padLine("Taxa Entrega:", fee);
      }
      const tot = (typeof formatBRL === "function") ? formatBRL(order.totalAmount || 0) : `R$ ${order.totalAmount || 0}`;
      cmd += ESC + "E\x01"; // bold
      cmd += padLine("TOTAL DO PEDIDO:", tot);
      cmd += ESC + "E\x00";

      const payMethod = order.paymentMethod || "A Definir";
      cmd += padLine("PAGAMENTO:", payMethod);
      if (order.changeFor) {
        const chg = (typeof formatBRL === "function") ? formatBRL(order.changeFor) : `R$ ${order.changeFor}`;
        cmd += padLine("Troco para:", chg);
      }

      // 7. Rodapé e Corte
      cmd += divider;
      cmd += padCenter("Obrigado pela preferencia!");
      cmd += padCenter(cfg.name || "Salgados VIP - Nova Iguacu");
      cmd += divider;

      // Avanço de 4 linhas e Guilhotina / Corte de Bobina
      cmd += "\n\n\n\n";
      cmd += GS + "V\x42\x03"; // Cut paper

      return new TextEncoder().encode(cmd);
    },

    // Enviar dados brutos via WebUSB
    async sendToUsb(dataBytes) {
      if (!this.pairedUsbDevice) {
        throw new Error("Nenhum dispositivo USB conectado.");
      }
      const device = this.pairedUsbDevice;

      if (!device.opened) {
        await device.open();
      }
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }
      
      // Interface de impressora padrão
      const ifaceNumber = 0;
      await device.claimInterface(ifaceNumber);

      // Localizar endpoint de saída (Bulk OUT)
      const iface = device.configuration.interfaces[ifaceNumber];
      const alt = iface.alternate;
      const endpoint = alt.endpoints.find(e => e.direction === "out");

      if (!endpoint) {
        throw new Error("Endpoint de escrita da impressora USB não encontrado.");
      }

      await device.transferOut(endpoint.endpointNumber, dataBytes);
      return true;
    },

    // Teste de impressão WebUSB
    async printRawTestUsb() {
      const ESC = "\x1B";
      const GS = "\x1D";
      let testCmd = ESC + "@" + ESC + "a\x01" + ESC + "E\x01" + "SALGADOS VIP - TESTE USB\n" + ESC + "E\x00";
      testCmd += "Impressora USB Conectada com Sucesso!\n" + new Date().toLocaleString("pt-BR") + "\n\n\n\n" + GS + "V\x42\x03";
      const bytes = new TextEncoder().encode(testCmd);
      await this.sendToUsb(bytes);
    },

    // Teste de impressão WebSerial
    async sendToSerial(dataBytes) {
      if (!this.pairedSerialPort) {
        throw new Error("Nenhuma porta Serial conectada.");
      }
      const port = this.pairedSerialPort;
      if (!port.readable) {
        await port.open({ baudRate: 9600 });
      }
      const writer = port.writable.getWriter();
      await writer.write(dataBytes);
      writer.releaseLock();
      return true;
    },

    // Teste imediato geral a partir da tela de configurações
    async testCurrentPrinter() {
      const orders = (typeof VIPDatabase !== "undefined" && VIPDatabase.getOrders) ? VIPDatabase.getOrders() : [];
      const sampleOrder = orders.length > 0 ? orders[0] : {
        id: "TESTE",
        createdAt: Date.now(),
        fulfillment: "Entrega",
        customer: { name: "Cliente de Teste", phone: "(21) 99999-9999", address: "Rua das Flores, 100 - Centro" },
        items: [{ quantity: 1, name: "Cento de Salgados Variados", price: 65, totalPrice: 65 }],
        totalAmount: 65,
        paymentMethod: "Pix"
      };

      await this.printOrderReceipt(sampleOrder.id || "TESTE", false, null, sampleOrder);
    },

    // ==========================================================================
    // FLUXO PRINCIPAL: EXECUÇÃO INTELIGENTE E UNIVERSAL DE IMPRESSÃO
    // ==========================================================================
    async printOrderReceipt(orderId, isAutoPrint = false, event = null, mockOrder = null) {
      if (this.isPrinting) return;
      this.isPrinting = true;

      try {
        const orders = (typeof VIPDatabase !== "undefined" && VIPDatabase.getOrders) ? VIPDatabase.getOrders() : [];
        const order = mockOrder || orders.find(o => o.id === orderId);
        if (!order) return;

        // Se já foi impresso e for disparo automático repetido, descarta
        if (isAutoPrint && (order.printed || order.printedAt)) {
          return;
        }

        const cfg = (typeof VIPDatabase !== "undefined" && VIPDatabase.getConfig) ? VIPDatabase.getConfig() : {};
        const printerCfg = (typeof VIPDatabase !== "undefined" && VIPDatabase.getPrinterConfig) ? VIPDatabase.getPrinterConfig() : {};
        const localTarget = this.getLocalTarget();
        const numCopies = printerCfg.copies || 1;

        // 1. TENTATIVA VIA WEBUSB DIRETO (Zero Programas, Zero Janelas, Ultra-Rápido)
        if (localTarget === "webusb" && this.pairedUsbDevice) {
          try {
            const escPosBytes = this.buildEscPosBytes(order, cfg, printerCfg);
            for (let c = 0; c < numCopies; c++) {
              await this.sendToUsb(escPosBytes);
            }
            if (typeof VIPDatabase !== "undefined") VIPDatabase.markOrderPrinted(orderId);
            if (typeof renderLiveOrders === "function") renderLiveOrders();
            console.log(`[VIPWebPrinter] Pedido #${order.id} impresso via WebUSB com sucesso.`);
            if (typeof showToastNotification === "function" && !isAutoPrint) {
              showToastNotification(`✓ Pedido #${order.id} impresso via USB!`);
            }
            return;
          } catch (usbErr) {
            console.warn("[VIPWebPrinter] WebUSB indisponível no momento, tentando fallback:", usbErr);
          }
        }

        // 2. TENTATIVA VIA WEBSERIAL (Porta COM / USB Serial)
        if (localTarget === "webserial" && this.pairedSerialPort) {
          try {
            const escPosBytes = this.buildEscPosBytes(order, cfg, printerCfg);
            for (let c = 0; c < numCopies; c++) {
              await this.sendToSerial(escPosBytes);
            }
            if (typeof VIPDatabase !== "undefined") VIPDatabase.markOrderPrinted(orderId);
            if (typeof renderLiveOrders === "function") renderLiveOrders();
            console.log(`[VIPWebPrinter] Pedido #${order.id} impresso via WebSerial.`);
            if (typeof showToastNotification === "function" && !isAutoPrint) {
              showToastNotification(`✓ Pedido #${order.id} impresso via Serial!`);
            }
            return;
          } catch (serialErr) {
            console.warn("[VIPWebPrinter] WebSerial indisponível, tentando fallback:", serialErr);
          }
        }

        // 3. TENTATIVA VIA SPOOLER LOCAL NATIVO DO WINDOWS (PORTA 18181, SE DISPONÍVEL NO PC)
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1000);
          const textReceipt = (typeof buildOrderTextReceipt === "function") ? buildOrderTextReceipt(order, cfg, printerCfg) : "";

          const response = await fetch("http://127.0.0.1:18181/print", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: order.id,
              receiptText: textReceipt,
              copies: numCopies,
              printerName: localTarget
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const resData = await response.json();
            if (resData.success) {
              if (typeof VIPDatabase !== "undefined") VIPDatabase.markOrderPrinted(orderId);
              if (typeof renderLiveOrders === "function") renderLiveOrders();
              console.log(`[VIPWebPrinter] Pedido #${order.id} impresso diretamente pelo serviço local.`);
              if (typeof showToastNotification === "function" && !isAutoPrint) {
                showToastNotification(`✓ Pedido #${order.id} impresso diretamente na impressora!`);
              }
              return;
            }
          }
        } catch (localSpoolerErr) {
          // PC não possui o spooler local ativo, prossegue para o motor do navegador
        }

        // 4. MOTOR UNIVERSAL DO NAVEGADOR (Padrão para qualquer computador, notebook ou tablet)
        // Renderiza o cupom térmico no HTML dedicado de 1 página
        const textReceipt = (typeof buildOrderTextReceipt === "function") ? buildOrderTextReceipt(order, cfg, printerCfg) : "";
        const receiptArea = document.getElementById("thermal-receipt-area");
        if (receiptArea) {
          const paperClass = printerCfg.paperWidth === "58mm" ? "paper-58mm" : "paper-80mm";
          receiptArea.className = `thermal-receipt-area ${paperClass}`;
          receiptArea.innerHTML = `
            <div class="receipt-copy" style="font-family:monospace; font-size:10pt; line-height:1.2; padding:2mm 0; max-width:76mm; margin:0 auto;">
              <pre style="margin:0; font-family:monospace; font-size:10pt; white-space:pre-wrap; word-break:break-word;">${textReceipt}</pre>
            </div>
          `;
        }

        if (typeof VIPDatabase !== "undefined") VIPDatabase.markOrderPrinted(orderId);
        if (typeof renderLiveOrders === "function") renderLiveOrders();

        // Disparo de impressão universal do navegador:
        // Se o navegador estiver com atalho Kiosk (--kiosk-printing) ou SilentPrintingEnabled no Windows,
        // ele imprime IMEDIATAMENTE e SILENCIOSAMENTE sem nenhuma janela ou confirmação.
        setTimeout(() => {
          try {
            window.print();
          } catch (pErr) {
            console.error("[VIPWebPrinter] Falha ao acionar window.print():", pErr);
          }
        }, 120);

      } finally {
        setTimeout(() => {
          this.isPrinting = false;
        }, 1500);
      }
    }
  };

  // Expor globalmente
  window.VIPWebPrinter = VIPWebPrinter;

  // Inicializar quando o DOM estiver pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => VIPWebPrinter.init());
  } else {
    VIPWebPrinter.init();
  }
})();
