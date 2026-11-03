/**
 * ==============================================================================
 * SALGADOS VIP - MÓDULO UNIVERSAL E ISOLADO DE WHATSAPP (VIPWhatsApp)
 * Versão: 48.0 (Bkp 48) - Infraestrutura 100% Autônoma e Desacoplada
 * ==============================================================================
 * Este arquivo encapsula e blinda TODA a lógica de WhatsApp do sistema:
 * 1. Normalização e Validação Robusta de Telefones (BR / DDI 55 / DDD 21 / Local).
 * 2. Geração Infalível de Links WhatsApp (wa.me e api.whatsapp.com com fallback).
 * 3. Disparador Universal Blindado contra Bloqueadores de Pop-up (Mobile & Desktop).
 * 4. Modelos e Templates Oficiais de Notificações de Status do Pedido.
 * 5. Adaptador de Envio Silencioso Local (Porta 18182) com Fallback Imediato.
 * 6. Interface de UI e Modais Isolados com Alta Camada de Exibição (z-index seguro).
 * ==============================================================================
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.VIPWhatsApp = factory();
    // Compatibilidade reversa universal para não quebrar chamadas antigas
    root.VIPWhatsAppNotifier = root.VIPWhatsApp.Notifier;
    root.VIPWhatsAppGateway = root.VIPWhatsApp.Gateway;
  }
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  // Configuração Padrão do Salgados VIP
  const DEFAULT_STORE_DDD = "21";
  const DEFAULT_STORE_PHONE = "5521986758102";
  const DEFAULT_STORE_NAME = "Salgados VIP - Nova Iguaçu";
  const DEFAULT_STORE_ADDRESS = "Rua Isabel Pedrosa, 31, Da Luz, Nova Iguaçu - RJ";

  // ============================================================================
  // 1. MOTOR DE NORMALIZAÇÃO E VALIDAÇÃO DE TELEFONES
  // ============================================================================
  const PhoneEngine = {
    /**
     * Limpa e normaliza qualquer formato de telefone brasileiro para o formato internacional:
     * 55 + DDD (2 dígitos) + Número (8 ou 9 dígitos) -> ex: "5521986758102"
     * Resolve:
     * - (21) 98675-8102
     * - 21986758102
     * - 5521986758102 (NUNCA duplica para 5555...)
     * - 021986758102 (remove zeros iniciais de operadoras)
     * - 98675-8102 (local de 8 ou 9 dígitos -> adiciona automaticamente DDD 21 e DDI 55)
     */
    normalize(phone, defaultDDD = DEFAULT_STORE_DDD) {
      if (!phone) return "";
      let digits = String(phone).replace(/\D/g, "");
      if (!digits) return "";

      // Remove zeros à esquerda (ex: 021... -> 21...)
      while (digits.startsWith("0") && digits.length > 9) {
        digits = digits.substring(1);
      }

      // Se já tem DDI 55 completo (12 ou 13 dígitos)
      if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
        return digits;
      }

      // Se possui DDD + Número sem DDI (10 ou 11 dígitos, ex: 21986758102)
      if (digits.length === 10 || digits.length === 11) {
        return "55" + digits;
      }

      // Se possui apenas o número local sem DDD (8 ou 9 dígitos, ex: 986758102)
      if (digits.length === 8 || digits.length === 9) {
        const ddd = String(defaultDDD).replace(/\D/g, "") || DEFAULT_STORE_DDD;
        return "55" + ddd + digits;
      }

      // Se já tem 55 mas comprimento estranho ou formato internacional livre
      if (digits.startsWith("55") && digits.length > 13) {
        return digits.substring(0, 13);
      }

      return digits;
    },

    /**
     * Formata para exibição visual elegante: (21) 98675-8102 ou (21) 3456-7890
     */
    formatDisplay(phone, defaultDDD = DEFAULT_STORE_DDD) {
      if (!phone) return "";
      let norm = this.normalize(phone, defaultDDD);
      if (!norm) return String(phone);

      // Remove o DDI 55 para formatar
      let national = norm.startsWith("55") ? norm.substring(2) : norm;

      if (national.length === 11) {
        return `(${national.substring(0, 2)}) ${national.substring(2, 7)}-${national.substring(7)}`;
      } else if (national.length === 10) {
        return `(${national.substring(0, 2)}) ${national.substring(2, 6)}-${national.substring(6)}`;
      }
      return phone;
    },

    /**
     * Valida se o número possui o padrão mínimo exigido para envio de WhatsApp no Brasil
     */
    isValid(phone, defaultDDD = DEFAULT_STORE_DDD) {
      const norm = this.normalize(phone, defaultDDD);
      // DDI 55 (2) + DDD (2) + Número (8 ou 9) = 12 ou 13 dígitos
      return norm.length === 12 || norm.length === 13;
    }
  };

  // ============================================================================
  // 2. GERADOR UNIVERSAL DE LINKS DO WHATSAPP (wa.me & api.whatsapp.com)
  // ============================================================================
  const LinkGenerator = {
    /**
     * Gera URL codificada com segurança contra caracteres especiais, quebras de linha e emojis
     */
    buildUrl(phone, text = "", options = {}) {
      const defaultDDD = options.defaultDDD || DEFAULT_STORE_DDD;
      const cleanPhone = PhoneEngine.normalize(phone, defaultDDD);
      const safeText = String(text || "").trim();
      const encodedText = safeText ? encodeURIComponent(safeText) : "";

      // Se temos o telefone do destinatário
      if (cleanPhone) {
        // Modo preferencial primário: wa.me
        if (options.preferApi) {
          return `https://api.whatsapp.com/send?phone=${cleanPhone}${encodedText ? `&text=${encodedText}` : ""}`;
        }
        return `https://wa.me/${cleanPhone}${encodedText ? `?text=${encodedText}` : ""}`;
      }

      // Se não temos telefone (ex: compartilhamento público de texto ou fechamento de caixa)
      return `https://api.whatsapp.com/send?text=${encodedText}`;
    },

    /**
     * Gera link direto para o WhatsApp da Loja (usado no cardápio / checkout)
     */
    buildStoreOrderUrl(msg, storeConfig = {}) {
      const rawStorePhone = storeConfig.whatsappNumber || storeConfig.phone || DEFAULT_STORE_PHONE;
      const cleanStorePhone = PhoneEngine.normalize(rawStorePhone);
      return this.buildUrl(cleanStorePhone || DEFAULT_STORE_PHONE, msg);
    },

    /**
     * Gera link direto para o cliente do pedido
     */
    buildCustomerUrl(order, text = "") {
      const phone = order?.customer?.phone || order?.phone || "";
      return this.buildUrl(phone, text);
    },

    /**
     * Gera link direto para o motoboy escalado
     */
    buildMotoboyUrl(motoboy, text = "") {
      const phone = motoboy?.phone || "";
      return this.buildUrl(phone, text);
    }
  };

  // ============================================================================
  // 3. DISPARADOR UNIVERSAL CONTRA BLOQUEADORES DE POP-UP (POPUP BLOCKER SHIELD)
  // ============================================================================
  const Dispatcher = {
    /**
     * Detecta se o dispositivo é mobile (celular/tablet)
     */
    isMobile() {
      if (typeof navigator === "undefined") return false;
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    /**
     * Abre com máxima confiabilidade a URL do WhatsApp:
     * - Tenta window.open em nova aba.
     * - Se o navegador bloquear pop-up (comum em navegadores móveis e após chamadas assíncronas):
     *   exibe instantaneamente um banner flutuante interativo de 1 clique ou redireciona sem perdas.
     */
    open(url, options = {}) {
      if (!url) return false;

      const title = options.title || "Continuar para o WhatsApp";
      const autoRedirectOnMobile = options.autoRedirectOnMobile !== false;

      // 1. Em dispositivos móveis, window.location.href é o método mais confiável para acionar o App Nativo
      if (this.isMobile() && autoRedirectOnMobile) {
        try {
          window.location.href = url;
          return true;
        } catch (e) {
          // Fallback para clique
        }
      }

      // 2. No desktop ou tentativa padrão, tenta abrir nova aba
      let newWin = null;
      try {
        newWin = window.open(url, "_blank", "noopener,noreferrer");
      } catch (err) {
        newWin = null;
      }

      // 3. Se a janela abriu normalmente, sucesso!
      if (newWin && !newWin.closed && typeof newWin.closed !== "undefined") {
        return true;
      }

      // 4. Se o pop-up foi bloqueado, cria elemento temporário e simula clique direto
      try {
        const linkEl = document.createElement("a");
        linkEl.href = url;
        linkEl.target = "_blank";
        linkEl.rel = "noopener noreferrer";
        linkEl.style.display = "none";
        document.body.appendChild(linkEl);
        linkEl.click();
        setTimeout(() => linkEl.remove(), 1000);
      } catch (clickErr) {}

      // 5. Exibe banner de contingência de 1 clique caso o navegador seja extremamente restritivo
      this.showBlockedPopupBanner(url, title);
      return false;
    },

    /**
     * Banner discreto e profissional garantido caso o navegador bloqueie abertura automática
     */
    showBlockedPopupBanner(url, title) {
      if (typeof document === "undefined") return;

      let banner = document.getElementById("vip-wa-blocked-pill");
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "vip-wa-blocked-pill";
        banner.style.cssText = [
          "position: fixed",
          "bottom: 24px",
          "right: 24px",
          "background: #0f172a",
          "color: #ffffff",
          "padding: 14px 20px",
          "border-radius: 12px",
          "box-shadow: 0 10px 30px rgba(0,0,0,0.35)",
          "z-index: 999999",
          "display: flex",
          "align-items: center",
          "gap: 12px",
          "border: 2px solid #25D366",
          "font-family: inherit",
          "animation: vipWaSlideUp 0.3s ease"
        ].join(";");
        document.body.appendChild(banner);
      }

      banner.innerHTML = `
        <i class="fa-brands fa-whatsapp" style="color: #25D366; font-size: 1.6rem;"></i>
        <div style="flex: 1;">
          <div style="font-weight: 800; font-size: 0.9rem; color: #fff;">Pronto para enviar no WhatsApp!</div>
          <div style="font-size: 0.78rem; color: #94a3b8;">Clique no botão verde para abrir a conversa:</div>
        </div>
        <a href="${url}" target="_blank" rel="noopener noreferrer" style="background: #25D366; color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;" onclick="this.parentElement.remove()">
          Abrir WhatsApp <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
        <button type="button" onclick="this.parentElement.remove()" style="background: none; border: none; color: #64748b; font-size: 1.1rem; cursor: pointer; padding: 4px;">&times;</button>
      `;

      // Auto remove após 15 segundos
      setTimeout(() => {
        if (banner && banner.parentElement) banner.remove();
      }, 15000);
    }
  };

  // ============================================================================
  // 4. MOTOR DE MENSAGENS E TEMPLATES OFICIAIS
  // ============================================================================
  const TemplateEngine = {
    formatCurrency(val) {
      try {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);
      } catch (e) {
        return `R$ ${(val || 0).toFixed(2).replace(".", ",")}`;
      }
    },

    formatItemsSummary(items) {
      if (!items || !items.length) return "1x Pedido";
      const parts = items.map(item => {
        if (item.type === "kit") {
          return `1x ${item.kitName || "Kit de Salgados"}`;
        } else if (item.type === "combo") {
          return `1x ${item.name || "Combo"}`;
        }
        return `${item.quantity || 1}x ${item.name || "Item"}`;
      });
      return parts.join(", ");
    },

    /**
     * Gera todos os templates de atualização de status do pedido
     */
    getTemplates(order, storeConfig = {}) {
      if (!order) return {};
      const storeName = storeConfig.name || DEFAULT_STORE_NAME;
      const storeAddress = storeConfig.address || storeConfig.pickupAddress || DEFAULT_STORE_ADDRESS;
      const custName = (order.customer?.name || "Cliente").trim();
      const orderId = order.id || order.orderId;
      const isDelivery = order.fulfillment === "Entrega";
      const totalFormatted = (typeof formatBRL === "function")
        ? formatBRL(order.totalAmount || 0)
        : this.formatCurrency(order.totalAmount || 0);
      const itemsSummary = this.formatItemsSummary(order.items);

      let timingStr = "⚡ Preparar Agora (Imediato)";
      if (order.timingType === "agendado") {
        timingStr = `📅 Agendado para: ${order.scheduledDateTimeFormatted || (order.scheduledDate + " às " + order.scheduledTime)}`;
      }

      const destInfo = isDelivery
        ? `🛵 *Entrega em:* ${order.customer?.address || "Endereço cadastrado"}`
        : `🏪 *Retirada no Balcão:* ${storeAddress}`;

      const paymentInfo = `${order.paymentMethod || "A combinar"}${order.cashChangeFor ? ` (Troco para ${order.cashChangeFor})` : ""}`;

      return {
        confirmado: {
          id: "confirmado",
          label: "Confirmado",
          badge: "🟡 Confirmar Pedido",
          icon: "fa-circle-check",
          color: "#f59e0b",
          text: `Olá, *${custName}*! Tudo bem? 😊\n\n` +
                `Confirmamos o recebimento do seu *Pedido #${orderId}* no *${storeName}*! 🥟✨\n\n` +
                `📋 *Itens:* ${itemsSummary}\n` +
                `💵 *Total:* ${totalFormatted} (${paymentInfo})\n` +
                `${destInfo}\n` +
                `⏱️ *Previsão:* ${timingStr}\n\n` +
                `Seu pedido já foi registrado e encaminhado para a produção. Qualquer dúvida estamos à disposição por aqui! 💛`
        },
        em_preparo: {
          id: "em_preparo",
          label: "Na Cozinha",
          badge: "👨‍🍳 Em Preparo",
          icon: "fa-fire-burner",
          color: "#3b82f6",
          text: `Olá, *${custName}*! 👨‍🍳🔥\n\n` +
                `Passando para avisar que o seu *Pedido #${orderId}* já está na cozinha sendo preparado com todo carinho!\n\n` +
                `Nossos salgados são fritos na hora para chegarem bem quentinhos e crocantes. 🥟✨\n\n` +
                `Assim que estiver pronto, te avisamos de imediato!`
        },
        saiu_entrega: {
          id: "saiu_entrega",
          label: "Saiu p/ Entrega",
          badge: "🛵 Saiu p/ Entrega",
          icon: "fa-motorcycle",
          color: "#10b981",
          text: `Olá, *${custName}*! 🛵💨\n\n` +
                `Boas notícias! O seu *Pedido #${orderId}* acabou de sair para entrega com o nosso motoboy!\n\n` +
                `📍 *Endereço de Entrega:* ${order.customer?.address || "Seu endereço cadastrado"}\n` +
                `💵 *Valor a Pagar:* ${totalFormatted}\n` +
                `💳 *Forma de Pagamento:* ${paymentInfo}\n\n` +
                `Por favor, fique atento(a) ao interfone, portão ou campainha. Seus salgados estão a caminho quentinhos! Bom apetite! 🥟😋`
        },
        pronto_retirada: {
          id: "pronto_retirada",
          label: "Pronto p/ Retirada",
          badge: "🏪 Pronto no Balcão",
          icon: "fa-store",
          color: "#10b981",
          text: `Olá, *${custName}*! 🏪✨\n\n` +
                `O seu *Pedido #${orderId}* já está PRONTINHO e quentinho aguardando sua retirada aqui no balcão do *${storeName}*!\n\n` +
                `📍 *Endereço de Retirada:* ${storeAddress}\n` +
                `💵 *Valor Total:* ${totalFormatted} (${paymentInfo})\n\n` +
                `Pode vir retirar quando quiser, estamos prontos para te entregar! 😊🥟`
        },
        concluido: {
          id: "concluido",
          label: "Agradecimento",
          badge: "❤️ Concluído / Agradecimento",
          icon: "fa-heart",
          color: "#ec4899",
          text: `Olá, *${custName}*! ❤️\n\n` +
                `Seu *Pedido #${orderId}* foi finalizado! Esperamos de verdade que você e seus convidados tenham adorado os salgados! 🥟✨\n\n` +
                `Muito obrigado pela preferência e confiança no *${storeName}*.\n` +
                `Se puder, nos conte o que achou ou envie uma foto do seu lanche! Sua opinião nos ajuda muito. 🌟\n\n` +
                `Conte sempre com a gente e tenha um momento maravilhoso! 🎉`
        },
        cancelado: {
          id: "cancelado",
          label: "Cancelado",
          badge: "❌ Cancelado",
          icon: "fa-ban",
          color: "#ef4444",
          text: `Olá, *${custName}*.\n\n` +
                `Informamos que o seu *Pedido #${orderId}* no *${storeName}* precisou ser cancelado em nosso sistema.\n\n` +
                `Caso tenha alguma dúvida, precise de estorno ou queira realizar um novo pedido, por favor nos responda por aqui.`
        }
      };
    },

    getSuggestedTemplateKey(order) {
      if (!order) return "confirmado";
      if (order.status === "novo") return "confirmado";
      if (order.status === "em_preparo") return "em_preparo";
      if (order.status === "pronto") {
        return order.fulfillment === "Retirada" ? "pronto_retirada" : "saiu_entrega";
      }
      if (order.status === "concluido") return "concluido";
      if (order.status === "cancelado") return "cancelado";
      return "confirmado";
    }
  };

  // ============================================================================
  // 5. ADAPTADOR DO ROBÔ SILENCIOSO LOCAL (PORTA 18182) & NUVEM
  // ============================================================================
  const GatewayAdapter = {
    ENDPOINT_LOCAL: "http://127.0.0.1:18182",
    localAuthToken: "",
    lastStatus: null,
    isChecking: false,
    lastCheckTime: 0,
    CHECK_CACHE_MS: 15000, // Cache de 15s para evitar travar eventos de clique

    async getLocalAuthToken() {
      if (this.localAuthToken) return this.localAuthToken;
      try {
        const saved = localStorage.getItem("salgados_vip_wa_local_token");
        if (saved) {
          this.localAuthToken = saved;
          return saved;
        }
      } catch (e) {}

      // Tenta arquivo local whatsapp_service_token.json
      try {
        const r = await fetch("whatsapp_service_token.json", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (j && j.token) {
            this.localAuthToken = j.token;
            try { localStorage.setItem("salgados_vip_wa_local_token", j.token); } catch(e){}
            return j.token;
          }
        }
      } catch (e) {}

      return "";
    },

    async checkStatus(force = false) {
      const now = Date.now();
      if (!force && this.lastStatus && (now - this.lastCheckTime < this.CHECK_CACHE_MS)) {
        return this.lastStatus;
      }

      if (this.isChecking) return this.lastStatus;
      this.isChecking = true;

      try {
        const token = await this.getLocalAuthToken();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200); // Timeout rápido de 1.2s
        const headers = { "Content-Type": "application/json" };
        if (token) headers["X-VIP-Token"] = token;

        const res = await fetch(`${this.ENDPOINT_LOCAL}/status`, {
          headers,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          this.lastStatus = { ...data, online: true, mode: "local" };
          this.lastCheckTime = Date.now();
          return this.lastStatus;
        }
      } catch (err) {
        // Robô local desligado
      } finally {
        this.isChecking = false;
      }

      this.lastStatus = {
        online: false,
        connected: false,
        status: "offline",
        statusText: "Robô silencioso desligado",
        mode: "offline"
      };
      this.lastCheckTime = Date.now();
      return this.lastStatus;
    },

    async sendMessage(phone, message, orderId, templateKey) {
      const cleanPhone = PhoneEngine.normalize(phone);
      if (!cleanPhone) {
        return { success: false, error: "Telefone inválido" };
      }

      // 1. Tenta envio direto pelo robô silencioso se estiver operante
      try {
        const token = await this.getLocalAuthToken();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const headers = { "Content-Type": "application/json" };
        if (token) headers["X-VIP-Token"] = token;

        const res = await fetch(`${this.ENDPOINT_LOCAL}/send`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            phone: cleanPhone,
            message: message,
            orderId: orderId,
            template: templateKey
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            return { success: true, mode: "silent_local" };
          }
        }
      } catch (e) {
        // Falha no robô local
      }

      // 2. Fallback de envio via Nuvem Supabase Queue (se houver robô na loja ouvindo a fila)
      try {
        const sb = typeof getSupabaseClient === "function" ? getSupabaseClient() : null;
        if (sb) {
          const { error } = await sb.from("whatsapp_queue").insert([{
            phone: cleanPhone,
            message: message,
            order_id: orderId,
            template: templateKey,
            status: "pending",
            created_at: new Date().toISOString()
          }]);
          if (!error) {
            return { success: true, mode: "cloud_queue" };
          }
        }
      } catch (sbErr) {}

      return { success: false, error: "Robô silencioso indisponível" };
    }
  };

  // ============================================================================
  // 6. CONTROLADOR DE INTERFACE E MODAIS ISOLADOS (UI SHIELD)
  // ============================================================================
  const UIEngine = {
    activeOrderId: null,
    activeTemplateKey: "confirmado",

    openModal(orderId, preferredTemplateKey = null) {
      this.activeOrderId = orderId;
      const orders = (typeof VIPDatabase !== "undefined" && VIPDatabase.getOrders) ? VIPDatabase.getOrders() : [];
      const order = orders.find(o => String(o.id) === String(orderId) || String(o.orderId) === String(orderId));
      if (!order) return;

      const storeCfg = (typeof VIPDatabase !== "undefined" && VIPDatabase.getConfig) ? VIPDatabase.getConfig() : {};
      this.activeTemplateKey = preferredTemplateKey || TemplateEngine.getSuggestedTemplateKey(order);

      // Preenche os campos do modal de notificação
      const titleEl = document.getElementById("wa-notify-title");
      if (titleEl) titleEl.textContent = "Notificar Cliente via WhatsApp";

      const subTitleEl = document.getElementById("wa-notify-subtitle");
      if (subTitleEl) {
        subTitleEl.textContent = `Pedido #${order.id} • ${order.customer?.name || "Cliente"} (${order.fulfillment === "Entrega" ? "Entrega" : "Retirada"})`;
      }

      const custNameEl = document.getElementById("wa-notify-customer-name");
      if (custNameEl) custNameEl.textContent = order.customer?.name || "Cliente";

      const phoneInput = document.getElementById("wa-notify-customer-phone");
      if (phoneInput) {
        const rawPhone = order.customer?.phone || "";
        phoneInput.value = PhoneEngine.formatDisplay(rawPhone) || rawPhone;
      }

      // Renderiza os chips de templates
      this.renderChips(order, storeCfg);

      // Atualiza o texto editável no textarea
      this.updateTextarea(order, storeCfg);

      // Atualiza badge de histórico de envio
      const historyBox = document.getElementById("wa-notify-history-box");
      const historyText = document.getElementById("wa-notify-history-text");
      if (order.lastWhatsAppSent && historyBox && historyText) {
        const sentTime = new Date(order.lastWhatsAppSent.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const tmplName = (order.lastWhatsAppSent.template || "notificação").replace("_", " ").toUpperCase();
        historyBox.style.display = "flex";
        historyText.innerHTML = `Último aviso enviado: <strong>${tmplName}</strong> às <strong>${sentTime}</strong>.`;
      } else if (historyBox) {
        historyBox.style.display = "none";
      }

      // Exibe modal com garantia absoluta de visibilidade e z-index superior
      const backdrop = document.getElementById("modal-whatsapp-notify-backdrop");
      const modal = document.getElementById("modal-whatsapp-notify");
      if (backdrop) {
        backdrop.style.display = "block";
        backdrop.style.visibility = "visible";
        backdrop.style.opacity = "1";
        backdrop.style.zIndex = "2100";
        backdrop.classList.add("active");
      }
      if (modal) {
        modal.style.display = "block";
        modal.style.visibility = "visible";
        modal.style.opacity = "1";
        modal.style.zIndex = "2101";
        modal.classList.add("active");
      }
    },

    closeModal() {
      this.activeOrderId = null;
      const backdrop = document.getElementById("modal-whatsapp-notify-backdrop");
      const modal = document.getElementById("modal-whatsapp-notify");
      if (backdrop) {
        backdrop.classList.remove("active");
        backdrop.style.display = "none";
        backdrop.style.visibility = "hidden";
      }
      if (modal) {
        modal.classList.remove("active");
        modal.style.display = "none";
        modal.style.visibility = "hidden";
      }
    },

    renderChips(order, storeCfg) {
      const container = document.getElementById("wa-template-chips");
      if (!container) return;

      const templates = TemplateEngine.getTemplates(order, storeCfg);
      const isDelivery = order.fulfillment === "Entrega";
      const templateKeys = ["confirmado", "em_preparo", isDelivery ? "saiu_entrega" : "pronto_retirada", "concluido", "cancelado"];

      container.innerHTML = templateKeys.map(key => {
        const t = templates[key];
        if (!t) return "";
        const isActive = (key === this.activeTemplateKey);
        return `
          <button type="button" class="wa-chip ${isActive ? "active" : ""}" onclick="VIPWhatsApp.selectTemplate('${key}')">
            <i class="fa-solid ${t.icon}"></i> ${t.label}
          </button>
        `;
      }).join("");
    },

    selectTemplate(templateKey) {
      this.activeTemplateKey = templateKey;
      const orders = (typeof VIPDatabase !== "undefined" && VIPDatabase.getOrders) ? VIPDatabase.getOrders() : [];
      const order = orders.find(o => String(o.id) === String(this.activeOrderId) || String(o.orderId) === String(this.activeOrderId));
      const storeCfg = (typeof VIPDatabase !== "undefined" && VIPDatabase.getConfig) ? VIPDatabase.getConfig() : {};
      if (order) {
        this.renderChips(order, storeCfg);
        this.updateTextarea(order, storeCfg);
      }
    },

    updateTextarea(order, storeCfg) {
      const textarea = document.getElementById("wa-notify-message-text");
      const charCountEl = document.getElementById("wa-message-char-count");
      if (!textarea) return;

      const templates = TemplateEngine.getTemplates(order, storeCfg);
      const tmpl = templates[this.activeTemplateKey] || templates["confirmado"];
      const text = tmpl ? tmpl.text : "";

      textarea.value = text;
      if (charCountEl) {
        charCountEl.textContent = `${text.length} caracteres`;
      }
    },

    async triggerSend() {
      const orderId = this.activeOrderId;
      const orders = (typeof VIPDatabase !== "undefined" && VIPDatabase.getOrders) ? VIPDatabase.getOrders() : [];
      const order = orders.find(o => String(o.id) === String(orderId) || String(o.orderId) === String(orderId));
      if (!order) return;

      const phoneInput = document.getElementById("wa-notify-customer-phone");
      const textarea = document.getElementById("wa-notify-message-text");
      const rawPhone = phoneInput ? phoneInput.value : (order.customer?.phone || "");
      const cleanPhone = PhoneEngine.normalize(rawPhone);
      const message = textarea ? textarea.value : "";

      if (!PhoneEngine.isValid(cleanPhone)) {
        alert("Por favor, digite um número de WhatsApp válido (DDD + número com 8 ou 9 dígitos).");
        if (phoneInput) phoneInput.focus();
        return;
      }

      const btnSend = document.getElementById("btn-send-wa-message");
      const origHtml = btnSend ? btnSend.innerHTML : "";

      // 1. Tenta envio silencioso se o robô estiver conectado
      const status = await GatewayAdapter.checkStatus();
      if (status && status.connected) {
        try {
          if (btnSend) {
            btnSend.disabled = true;
            btnSend.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando em 2º plano...';
          }
          const res = await GatewayAdapter.sendMessage(cleanPhone, message, orderId, this.activeTemplateKey);
          if (res && res.success) {
            if (typeof VIPDatabase !== "undefined" && VIPDatabase.recordOrderWhatsAppNotification) {
              VIPDatabase.recordOrderWhatsAppNotification(orderId, this.activeTemplateKey, message);
            }
            this.closeModal();
            if (typeof renderLiveOrders === "function") renderLiveOrders();
            if (typeof showToastNotification === "function") {
              showToastNotification(`✓ Mensagem enviada silenciosamente para ${order.customer?.name || "o cliente"}!`);
            }
            return;
          }
        } catch (err) {
          console.info("[VIPWhatsApp] Falha silenciosa, acionando WhatsApp Web...", err);
        } finally {
          if (btnSend) {
            btnSend.disabled = false;
            btnSend.innerHTML = origHtml;
          }
        }
      }

      // 2. Fallback direto universal wa.me
      const waUrl = LinkGenerator.buildUrl(cleanPhone, message);
      if (!waUrl) {
        alert("Erro ao formatar o link do WhatsApp.");
        return;
      }

      if (typeof VIPDatabase !== "undefined" && VIPDatabase.recordOrderWhatsAppNotification) {
        VIPDatabase.recordOrderWhatsAppNotification(orderId, this.activeTemplateKey, message);
      }

      this.closeModal();
      Dispatcher.open(waUrl, { title: "Notificar Cliente" });
      if (typeof renderLiveOrders === "function") renderLiveOrders();
      if (typeof showToastNotification === "function") {
        showToastNotification(`WhatsApp aberto para ${order.customer?.name || "o cliente"}!`);
      }
    },

    async quickSend(orderId, templateKey) {
      const orders = (typeof VIPDatabase !== "undefined" && VIPDatabase.getOrders) ? VIPDatabase.getOrders() : [];
      const order = orders.find(o => String(o.id) === String(orderId) || String(o.orderId) === String(orderId));
      if (!order) return;

      const rawPhone = order.customer?.phone || "";
      const cleanPhone = PhoneEngine.normalize(rawPhone);

      if (!PhoneEngine.isValid(cleanPhone)) {
        this.openModal(orderId, templateKey);
        return;
      }

      const storeCfg = (typeof VIPDatabase !== "undefined" && VIPDatabase.getConfig) ? VIPDatabase.getConfig() : {};
      const templates = TemplateEngine.getTemplates(order, storeCfg);
      const tmpl = templates[templateKey] || templates["confirmado"];

      // 1. Tenta envio silencioso se o robô estiver conectado
      const status = await GatewayAdapter.checkStatus();
      if (status && status.connected) {
        try {
          if (typeof showToastNotification === "function") {
            showToastNotification(`Enviando "${tmpl.label}" em 2º plano...`);
          }
          const res = await GatewayAdapter.sendMessage(cleanPhone, tmpl.text, orderId, templateKey);
          if (res && res.success) {
            if (typeof VIPDatabase !== "undefined" && VIPDatabase.recordOrderWhatsAppNotification) {
              VIPDatabase.recordOrderWhatsAppNotification(orderId, templateKey, tmpl.text);
            }
            if (typeof renderLiveOrders === "function") renderLiveOrders();
            if (typeof showToastNotification === "function") {
              showToastNotification(`✓ Mensagem "${tmpl.label}" enviada com sucesso!`);
            }
            return;
          }
        } catch (e) {}
      }

      // 2. Fallback direto wa.me
      const waUrl = LinkGenerator.buildUrl(cleanPhone, tmpl.text);
      if (waUrl) {
        if (typeof VIPDatabase !== "undefined" && VIPDatabase.recordOrderWhatsAppNotification) {
          VIPDatabase.recordOrderWhatsAppNotification(orderId, templateKey, tmpl.text);
        }
        Dispatcher.open(waUrl, { title: `Enviar ${tmpl.label}` });
        if (typeof renderLiveOrders === "function") renderLiveOrders();
      }
    }
  };

  // ============================================================================
  // OBJETO PÚBLICO PRINCIPAL - TOTALMENTE ISOLADO
  // ============================================================================
  const VIPWhatsApp = {
    version: "48.0",
    Phone: PhoneEngine,
    Link: LinkGenerator,
    Dispatcher: Dispatcher,
    Templates: TemplateEngine,
    Gateway: GatewayAdapter,
    UI: UIEngine,

    // Métodos diretos de alta conveniência:
    normalizePhone: (p, ddd) => PhoneEngine.normalize(p, ddd),
    formatPhoneDisplay: (p, ddd) => PhoneEngine.formatDisplay(p, ddd),
    isValidPhone: (p, ddd) => PhoneEngine.isValid(p, ddd),
    buildUrl: (phone, text, opt) => LinkGenerator.buildUrl(phone, text, opt),
    open: (url, opt) => Dispatcher.open(url, opt),
    getTemplates: (order, cfg) => TemplateEngine.getTemplates(order, cfg),
    getSuggestedTemplateKey: (order) => TemplateEngine.getSuggestedTemplateKey(order),
    openModal: (orderId, tmplKey) => UIEngine.openModal(orderId, tmplKey),
    closeModal: () => UIEngine.closeModal(),
    selectTemplate: (tmplKey) => UIEngine.selectTemplate(tmplKey),
    triggerSend: () => UIEngine.triggerSend(),
    quickSend: (orderId, tmplKey) => UIEngine.quickSend(orderId, tmplKey),

    // Interface de compatibilidade com VIPWhatsAppNotifier clássico
    Notifier: {
      normalizePhone: (p) => PhoneEngine.normalize(p),
      formatPhoneDisplay: (p) => PhoneEngine.formatDisplay(p),
      isValidPhone: (p) => PhoneEngine.isValid(p),
      buildWhatsAppUrl: (p, t) => LinkGenerator.buildUrl(p, t),
      getTemplates: (o, c) => TemplateEngine.getTemplates(o, c),
      getSuggestedTemplateKey: (o) => TemplateEngine.getSuggestedTemplateKey(o),
      formatItemsSummary: (i) => TemplateEngine.formatItemsSummary(i),
      formatCurrency: (v) => TemplateEngine.formatCurrency(v)
    }
  };

  return VIPWhatsApp;
});
