/**
 * ==============================================================================
 * VIP LIVE ORDERS - SUBSISTEMA AUTÔNOMO DE GESTÃO DE PEDIDOS AO VIVO & KANBAN
 * Salgados VIP Delivery & Cozinha - v51.0 (Bkp 49)
 * 
 * Módulo 100% isolado, autônomo e blindado.
 * Garante que cliques em pedidos NUNCA façam o card sumir, protege o modal
 * contra fechamentos fantasmas, persiste pedidos operados no sessionStorage
 * e blinda a renderização contra falhas em outros módulos do painel.
 * ==============================================================================
 */

(function (window, document) {
  "use strict";

  function getDB() {
    if (typeof window !== "undefined" && window.VIPDatabase) return window.VIPDatabase;
    if (typeof VIPDatabase !== "undefined") return VIPDatabase;
    return null;
  }

  const SESSION_OPERATED_KEY = "vip_live_orders_operated_ids";
  const DATE_FILTER_KEY = "vip_live_orders_date_filter";

  // Helper local de formatação de moeda
  function formatMoney(val) {
    if (typeof window.formatBRL === "function") {
      return window.formatBRL(val);
    }
    const num = Number(val) || 0;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  // Helper local de escape HTML
  function safeEscape(str) {
    if (typeof str !== "string") return String(str ?? "");
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ============================================================================
  // 1. GERENCIADOR DE ESTADO & PERSISTÊNCIA EM SESSÃO
  // ============================================================================
  const State = {
    currentDateFilter: "hoje", // "hoje" ou "todos"
    onlyDelayed: false,
    searchTerm: "",
    activeModalOrderId: null,
    isModalOpen: false,
    knownOrderIds: new Set(),
    isRendering: false,
    _renderScheduled: false,
    _lastSyncTime: 0,

    init() {
      try {
        const savedFilter = localStorage.getItem(DATE_FILTER_KEY);
        if (savedFilter === "todos" || savedFilter === "hoje") {
          this.currentDateFilter = savedFilter;
        }
      } catch (e) {}
    },

    getOperatedIds() {
      try {
        const raw = sessionStorage.getItem(SESSION_OPERATED_KEY);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) return new Set(arr.map(String));
        }
      } catch (e) {}
      return new Set();
    },

    registerOperatedId(orderId) {
      if (!orderId) return;
      const strId = String(orderId);
      const set = this.getOperatedIds();
      set.add(strId);
      try {
        sessionStorage.setItem(SESSION_OPERATED_KEY, JSON.stringify(Array.from(set)));
      } catch (e) {}
      if (window._sessionOperatedOrderIds) {
        window._sessionOperatedOrderIds.add(strId);
      }
    }
  };

  State.init();

  // ============================================================================
  // 2. REGRAS DE FILTRO & PROTEÇÃO CONTRA SUMIÇO DE PEDIDOS
  // ============================================================================
  const FilterEngine = {
    // Validação à prova de balas se o pedido pertence à visão de hoje
    isOrderFromToday(order) {
      if (!order) return false;

      // 1. REGRA ABSOLUTA DE COZINHA: Pedidos ativos NUNCA podem sumir do Kanban!
      const st = String(order.status || "").toLowerCase();
      if (st === "novo" || st === "em_preparo" || st === "pronto") {
        return true;
      }

      // 2. Pedidos que foram clicados ou operados nesta sessão do navegador
      const sid = String(order.id || order.orderId || "");
      if (State.getOperatedIds().has(sid)) {
        return true;
      }

      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const d = now.getDate();

      const isSameDate = (val) => {
        if (!val) return false;
        let dateObj = null;
        if (typeof val === "number") {
          dateObj = new Date(val);
        } else if (typeof val === "string") {
          // Trata timestamp numérico em string ou formato ISO
          const asNum = Number(val);
          if (!isNaN(asNum) && asNum > 1000000000) {
            dateObj = new Date(asNum);
          } else {
            dateObj = new Date(val);
          }
        }
        if (!dateObj || isNaN(dateObj.getTime())) return false;
        return (
          dateObj.getFullYear() === y &&
          dateObj.getMonth() === m &&
          dateObj.getDate() === d
        );
      };

      // 3. Pedidos agendados para a data de hoje
      if (order.timingType === "agendado" && order.scheduledDate) {
        const todayISO = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (String(order.scheduledDate).startsWith(todayISO)) return true;
      }

      // 4. Criação, atualização ou impressão hoje
      if (isSameDate(order.createdAt)) return true;
      if (isSameDate(order.updatedAt)) return true;
      if (isSameDate(order.printedAt)) return true;

      // 5. Histórico de etapas do pedido
      if (Array.isArray(order.history)) {
        for (const h of order.history) {
          if (isSameDate(h.time || h.timestamp)) return true;
        }
      }

      // 6. Se o pedido não tiver timestamps explícitos, mantém visível por segurança
      if (!order.createdAt && !order.scheduledDate && !order.updatedAt) {
        return true;
      }

      return false;
    },

    // Cálculo seguro de atraso e cronômetro (com proteção contra NaN)
    getOrderTiming(order) {
      let targetPrep = 35;
      try {
        if (getDB() && typeof getDB().getPrinterConfig === "function") {
          const cfg = getDB().getPrinterConfig();
          targetPrep = Number(cfg.targetPrepTimeMinutes) || 35;
        }
      } catch (e) {}

      const now = Date.now();
      let createdTs = Date.now();
      if (typeof order.createdAt === "number") {
        createdTs = order.createdAt;
      } else if (order.createdAt) {
        const parsed = Number(order.createdAt);
        createdTs = !isNaN(parsed) && parsed > 1000000000 ? parsed : new Date(order.createdAt).getTime();
        if (isNaN(createdTs)) createdTs = now;
      }

      const elapsedMinutes = Math.max(0, Math.floor((now - createdTs) / 60000));
      const isFinalized = order.status === "pronto" || order.status === "concluido" || order.status === "cancelado";

      const isScheduled = order.timingType === "agendado" && order.scheduledDate && order.scheduledTime;
      let scheduledTs = null;
      let isScheduledFuture = false;

      if (isScheduled) {
        try {
          scheduledTs = new Date(`${order.scheduledDate}T${order.scheduledTime}:00`).getTime();
          if (!isNaN(scheduledTs) && now < scheduledTs) {
            isScheduledFuture = true;
          }
        } catch (e) {}
      }

      let isDelayed = false;
      let delayMinutes = 0;

      if (!isFinalized) {
        if (isScheduled && scheduledTs && !isNaN(scheduledTs)) {
          if (now > scheduledTs) {
            delayMinutes = Math.floor((now - scheduledTs) / 60000);
            if (delayMinutes > 0) isDelayed = true;
          }
        } else {
          if (elapsedMinutes > targetPrep) {
            isDelayed = true;
            delayMinutes = elapsedMinutes - targetPrep;
          }
        }
      }

      let timerText = "";
      if (isScheduled) {
        if (isScheduledFuture) {
          timerText = `📅 Agendado (${order.scheduledTime || ""})`;
        } else {
          timerText = `📅 Agendado (Passou ${delayMinutes}m)`;
        }
      } else {
        timerText = `${elapsedMinutes} min`;
      }

      return {
        elapsedMinutes,
        targetPrepTime: targetPrep,
        isDelayed,
        delayMinutes,
        timerText,
        isScheduled,
        isScheduledFuture
      };
    },

    // Extração resiliente de bebidas do pedido
    extractOrderDrinks(order) {
      const drinks = [];
      if (!order) return drinks;

      let items = order.items;
      if (typeof items === "string") {
        try { items = JSON.parse(items); } catch (e) { items = []; }
      }
      if (!Array.isArray(items)) return drinks;

      const isDrinkName = (name) => {
        if (!name) return false;
        const n = String(name).toLowerCase();
        return (
          n.includes("coca") ||
          n.includes("guaran") ||
          n.includes("fanta") ||
          n.includes("refrigerante") ||
          n.includes("suco") ||
          n.includes("bebida") ||
          n.includes("h2oh") ||
          n.includes("cerveja") ||
          n.includes("água") ||
          n.includes("agua") ||
          n.includes("mate") ||
          n.includes("ice")
        );
      };

      items.forEach((item) => {
        if (!item) return;
        if (item.type === "product" || isDrinkName(item.name)) {
          if (isDrinkName(item.name)) {
            drinks.push({
              name: item.name || "Bebida",
              quantity: Number(item.quantity) || 1,
              source: "Avulso"
            });
          }
        } else if (item.type === "combo") {
          const comboSubitems = Array.isArray(item.items) ? item.items : [];
          comboSubitems.forEach((ci) => {
            if (isDrinkName(ci.name)) {
              drinks.push({
                name: ci.name,
                quantity: Number(ci.quantity) || 1,
                source: item.name || "Combo"
              });
            }
          });
        }
      });

      return drinks;
    },

    // Informações financeiras de motoboy / cobrança
    getPaymentInfo(order) {
      const method = String(order.paymentMethod || "Não informado").trim();
      const total = Number(order.totalAmount || order.subtotal || 0);
      const isDelivery = order.fulfillment === "Entrega";
      const roleTitle = isDelivery ? "MOTOBOY / ENTREGA" : "BALCÃO / ATENDIMENTO";

      const lower = method.toLowerCase();
      let paymentType = "outro";
      let instruction = "";
      let badgeText = method;
      let changeAlert = "";

      if (lower.includes("dinheiro")) {
        paymentType = "dinheiro";
        badgeText = "💵 DINHEIRO (RECEBER NO ATO)";
        if (order.cashChangeFor) {
          const cleaned = String(order.cashChangeFor).replace(/[^\d.,]/g, "").replace(",", ".");
          const changeVal = parseFloat(cleaned);
          if (!isNaN(changeVal) && changeVal > total) {
            const toGive = changeVal - total;
            changeAlert = `
              <div class="receipt-change-highlight" style="background:#fef2f2; border:1px solid #f87171; border-radius:8px; padding:8px; margin-top:6px;">
                <div style="color:#b91c1c; font-weight:800; font-size:0.85rem;">⚠️ LEVAR TROCO NA CARTEIRA</div>
                <div style="font-size:0.82rem; color:#475569;">Troco solicitado para: <strong>${formatMoney(changeVal)}</strong></div>
                <div style="font-size:0.9rem; color:#dc2626; font-weight:700;">DEVOLVER DE TROCO: <strong>${formatMoney(toGive)}</strong></div>
              </div>
            `;
          } else {
            changeAlert = `
              <div class="receipt-change-highlight" style="background:#fffbeb; border:1px solid #fcd34d; border-radius:8px; padding:8px; margin-top:6px;">
                <div style="color:#b45309; font-weight:800; font-size:0.85rem;">⚠️ LEVAR TROCO</div>
                <div style="font-size:0.82rem; color:#475569;">Troco solicitado para: <strong>${safeEscape(order.cashChangeFor)}</strong></div>
              </div>
            `;
          }
        } else {
          changeAlert = `
            <div style="font-size:0.8rem; color:#059669; font-weight:600; margin-top:4px;">
              ✓ Pagamento sem solicitação de troco (valor exato)
            </div>
          `;
        }
        instruction = `RECEBER DO CLIENTE: <strong>${formatMoney(total)}</strong> EM ESPÉCIE`;
      } else if (lower.includes("cart") || lower.includes("crédito") || lower.includes("débito")) {
        paymentType = "cartao";
        badgeText = "💳 CARTÃO (LEVAR MÁQUINA)";
        instruction = `>>> ⚠️ LEVAR MÁQUINA DE CARTÃO! <<<<br>PASSAR NA MÁQUINA: <strong>${formatMoney(total)}</strong>`;
      } else if (lower.includes("pix")) {
        paymentType = "pix";
        badgeText = "⚡ PIX";
        instruction = `>>> ⚠️ CONFERIR PIX: Conferir comprovante ou receber no ato: <strong>${formatMoney(total)}</strong>`;
      } else {
        instruction = `RECEBER DO CLIENTE: <strong>${formatMoney(total)}</strong> (${safeEscape(method)})`;
      }

      return {
        roleTitle,
        paymentType,
        badgeText,
        instruction,
        changeAlert,
        totalFormatted: formatMoney(total)
      };
    }
  };

  // ============================================================================
  // 3. RENDERIZADOR DO QUADRO KANBAN (4 COLUNAS EM UMA TELA)
  // ============================================================================
  const Kanban = {
    render() {
      const colNovo = document.getElementById("kanban-cards-novo");
      const colPrep = document.getElementById("kanban-cards-em_preparo");
      const colReady = document.getElementById("kanban-cards-pronto");
      const colDone = document.getElementById("kanban-cards-concluido");
      const emptyState = document.getElementById("orders-empty-state");

      if (!colNovo || !colPrep || !colReady || !colDone) return;

      let orders = [];
      try {
        if (getDB() && typeof getDB().getOrders === "function") {
          orders = getDB().getOrders() || [];
        }
      } catch (e) {
        orders = [];
      }

      // Separação Hoje vs Todos
      const todayOrders = orders.filter(FilterEngine.isOrderFromToday);
      const countToday = todayOrders.length;
      const countAll = orders.length;

      const elCountToday = document.getElementById("count-orders-today");
      const elCountAll = document.getElementById("count-orders-all");
      if (elCountToday) elCountToday.textContent = countToday;
      if (elCountAll) elCountAll.textContent = countAll;

      const elTodayStr = document.getElementById("current-today-str");
      if (elTodayStr) elTodayStr.textContent = new Date().toLocaleDateString("pt-BR");

      // Lista Ativa com base no Filtro Selecionado
      let activeList = State.currentDateFilter === "hoje" ? todayOrders : orders;

      // Filtro de Atrasados
      if (State.onlyDelayed) {
        activeList = activeList.filter((o) => FilterEngine.getOrderTiming(o).isDelayed);
      }

      // Filtro de Busca
      if (State.searchTerm) {
        const term = State.searchTerm.toLowerCase();
        activeList = activeList.filter((order) => {
          const searchStr = `${order.id || ""} ${order.customer?.name || ""} ${order.customer?.phone || ""} ${order.customer?.address || ""} ${order.paymentMethod || ""} ${order.scheduledDate || ""} ${order.scheduledTime || ""}`.toLowerCase();
          return searchStr.includes(term);
        });
      }

      // Contadores e métricas
      let countNovo = 0;
      let countPrep = 0;
      let countReady = 0;
      let countDone = 0;
      let countDelayed = 0;
      let activeRevenue = 0;

      activeList.forEach((order) => {
        const timing = FilterEngine.getOrderTiming(order);
        if (order.status === "novo") countNovo++;
        else if (order.status === "em_preparo") countPrep++;
        else if (order.status === "pronto") countReady++;
        else if (order.status === "concluido") countDone++;

        if (timing.isDelayed && order.status !== "concluido" && order.status !== "cancelado") {
          countDelayed++;
        }
        if (order.status !== "cancelado") {
          activeRevenue += Number(order.totalAmount || 0);
        }
      });

      // Atualizar contadores das colunas
      const elKCountNovo = document.getElementById("kcount-novo");
      const elKCountPrep = document.getElementById("kcount-em_preparo");
      const elKCountReady = document.getElementById("kcount-pronto");
      const elKCountDone = document.getElementById("kcount-concluido");
      if (elKCountNovo) elKCountNovo.textContent = countNovo;
      if (elKCountPrep) elKCountPrep.textContent = countPrep;
      if (elKCountReady) elKCountReady.textContent = countReady;
      if (elKCountDone) elKCountDone.textContent = countDone;

      // Atualizar métricas do topo
      const elMetricNew = document.getElementById("metric-count-new");
      const elMetricPrep = document.getElementById("metric-count-prep");
      const elMetricReady = document.getElementById("metric-count-ready");
      const elMetricDone = document.getElementById("metric-count-done");
      const elMetricDelay = document.getElementById("metric-count-delay");
      const elMetricRevenue = document.getElementById("metric-revenue-today");
      const elCountDelayedPill = document.getElementById("count-orders-delayed");

      if (elMetricNew) elMetricNew.textContent = countNovo;
      if (elMetricPrep) elMetricPrep.textContent = countPrep;
      if (elMetricReady) elMetricReady.textContent = countReady;
      if (elMetricDone) elMetricDone.textContent = countDone;
      if (elMetricDelay) elMetricDelay.textContent = countDelayed;
      if (elCountDelayedPill) elCountDelayedPill.textContent = countDelayed;
      if (elMetricRevenue) elMetricRevenue.textContent = formatMoney(activeRevenue);

      // Efeito pulsante de atraso
      const delayCard = document.querySelector(".metric-delay");
      if (delayCard) {
        if (countDelayed > 0) delayCard.classList.add("has-delays");
        else delayCard.classList.remove("has-delays");
      }

      // Badge no menu lateral
      const navBadge = document.getElementById("nav-orders-count");
      if (navBadge) {
        const activeCount = countNovo + countPrep;
        navBadge.textContent = activeCount;
        navBadge.style.display = activeCount > 0 ? "inline-flex" : "none";
      }

      // Limpar colunas com segurança
      colNovo.innerHTML = "";
      colPrep.innerHTML = "";
      colReady.innerHTML = "";
      colDone.innerHTML = "";

      // Ordenação: atrasados primeiro, depois mais recentes
      const sortedOrders = [...activeList].sort((a, b) => {
        const tA = FilterEngine.getOrderTiming(a);
        const tB = FilterEngine.getOrderTiming(b);
        if (tA.isDelayed && !tB.isDelayed) return -1;
        if (!tA.isDelayed && tB.isDelayed) return 1;
        const tsA = Number(a.createdAt) || 0;
        const tsB = Number(b.createdAt) || 0;
        return tsB - tsA;
      });

      let hasInNovo = false;
      let hasInPrep = false;
      let hasInReady = false;
      let hasInDone = false;

      sortedOrders.forEach((order) => {
        const cardEl = Kanban.buildCardElement(order);
        if (order.status === "novo") {
          colNovo.appendChild(cardEl);
          hasInNovo = true;
        } else if (order.status === "em_preparo") {
          colPrep.appendChild(cardEl);
          hasInPrep = true;
        } else if (order.status === "pronto") {
          colReady.appendChild(cardEl);
          hasInReady = true;
        } else {
          colDone.appendChild(cardEl);
          hasInDone = true;
        }
      });

      // Estados vazios por coluna
      if (!hasInNovo) colNovo.innerHTML = `<div class="kanban-col-empty"><i class="fa-solid fa-circle-check"></i><span>Sem novos pedidos aguardando</span></div>`;
      if (!hasInPrep) colPrep.innerHTML = `<div class="kanban-col-empty"><i class="fa-solid fa-fire-burner"></i><span>Nenhum pedido em preparo</span></div>`;
      if (!hasInReady) colReady.innerHTML = `<div class="kanban-col-empty"><i class="fa-solid fa-truck-fast"></i><span>Nenhum pedido pronto / em entrega</span></div>`;
      if (!hasInDone) colDone.innerHTML = `<div class="kanban-col-empty"><i class="fa-solid fa-circle-check"></i><span>Nenhum pedido finalizado hoje</span></div>`;

      // Estado vazio geral
      if (emptyState) {
        if (activeList.length === 0) {
          emptyState.style.display = "block";
          const titleEl = document.getElementById("empty-state-title");
          const descEl = document.getElementById("empty-state-desc");
          if (State.onlyDelayed) {
            if (titleEl) titleEl.textContent = "Nenhum pedido em atraso no momento";
            if (descEl) descEl.innerHTML = `Todos os pedidos estão dentro do prazo.<br><button type="button" class="btn-outline-admin" onclick="VIPLiveOrders.toggleDelayFilter()" style="margin-top:8px; font-size:0.8rem; padding:4px 10px; cursor:pointer;"><i class="fa-solid fa-eye"></i> Ver todos os pedidos</button>`;
          } else if (State.currentDateFilter === "hoje") {
            if (titleEl) titleEl.textContent = `Nenhum pedido registrado hoje (${new Date().toLocaleDateString("pt-BR")})`;
            if (descEl) descEl.textContent = `Assim que novos pedidos forem realizados, eles aparecerão na coluna "Recebidos" automaticamente.`;
          } else {
            if (titleEl) titleEl.textContent = "Nenhum pedido encontrado";
            if (descEl) descEl.textContent = "Verifique os termos da busca ou clique em 'Pedidos de Hoje'.";
          }
        } else {
          emptyState.style.display = "none";
        }
      }
    },

    // Construção do Card com Proteção Total de Clique
    buildCardElement(order) {
      const timing = FilterEngine.getOrderTiming(order);
      const card = document.createElement("div");
      card.className = `kanban-card ${timing.isDelayed ? "is-delayed" : ""}`;
      card.id = `order-card-${order.id}`;
      card.setAttribute("data-order-id", order.id);
      card.draggable = true;
      card.style.cursor = "pointer";

      // Blindagem do clique contra cancelamento por micro-movimento do mouse (drag)
      let isDragging = false;
      card.addEventListener("dragstart", (e) => {
        isDragging = true;
        VIPLiveOrders.onKanbanDragStart(e, order.id);
      });
      card.addEventListener("dragend", (e) => {
        isDragging = false;
        VIPLiveOrders.onKanbanDragEnd(e);
      });

      card.addEventListener("click", (e) => {
        if (isDragging) {
          isDragging = false;
          return;
        }
        // Se o clique foi em um botão de ação, link ou motoboy, deixa o elemento interno cuidar
        if (e.target.closest("button") || e.target.closest("a") || e.target.closest(".kanban-motoboy-badge")) {
          return;
        }
        e.stopPropagation();
        VIPLiveOrders.openModal(order.id, e);
      });

      // Badges de Atendimento
      const isDelivery = order.fulfillment === "Entrega";
      const fulfillmentBadge = isDelivery
        ? `<span class="kanban-tag-delivery" title="Entrega em domicílio"><i class="fa-solid fa-motorcycle"></i> Entrega${order.deliveryDistanceKm ? ` (${order.deliveryDistanceKm.toFixed(1)}km)` : ""}</span>`
        : `<span class="kanban-tag-pickup" title="Retirada no balcão"><i class="fa-solid fa-store"></i> Balcão</span>`;

      // Bebidas
      const drinks = FilterEngine.extractOrderDrinks(order);
      const totalDrinks = drinks.reduce((acc, d) => acc + (d.quantity || 1), 0);
      const drinkTag = totalDrinks > 0
        ? `<span class="kanban-tag-drink" title="Contém ${totalDrinks} bebida(s) gelada(s)!"><i class="fa-solid fa-bottle-water"></i> Bebida (${totalDrinks})</span>`
        : "";

      // Agendamento
      const schedTag = order.timingType === "agendado"
        ? `<span class="kanban-tag-sched" title="Pedido agendado"><i class="fa-solid fa-calendar-days"></i> ${safeEscape(order.scheduledDateTimeFormatted || (order.scheduledDate + " " + (order.scheduledTime || "")))}</span>`
        : "";

      // WhatsApp tag
      let waSentHtml = "";
      if (order.lastWhatsAppSent) {
        const sentTime = new Date(order.lastWhatsAppSent.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        waSentHtml = `<span class="card-wa-sent-tag" title="Último aviso WhatsApp enviado às ${sentTime}"><i class="fa-brands fa-whatsapp"></i> ${sentTime}</span>`;
      }

      // Tag de atraso
      const delayBadgeHtml = timing.isDelayed
        ? `<span class="badge-delay-pill"><i class="fa-solid fa-triangle-exclamation"></i> +${timing.delayMinutes}m</span>`
        : "";

      // Itens resumidos
      let items = order.items;
      if (typeof items === "string") {
        try { items = JSON.parse(items); } catch (e) { items = []; }
      }
      if (!Array.isArray(items)) items = [];

      let itemsSummaryHtml = "";
      items.forEach((item) => {
        if (!item) return;
        if (item.type === "kit") {
          const flv = Array.isArray(item.flavors) ? item.flavors.map((f) => `${f.quantity}x ${f.name}`).join(", ") : "";
          itemsSummaryHtml += `<div class="order-item-line"><span>📦 <strong>${safeEscape(item.kitName || "Kit Salgados")}</strong> <small>(${safeEscape(flv)})</small></span></div>`;
        } else if (item.type === "combo") {
          itemsSummaryHtml += `<div class="order-item-line"><span>🔥 <strong>${safeEscape(item.name || "Combo")}</strong></span></div>`;
        } else {
          itemsSummaryHtml += `<div class="order-item-line"><span>🥤 <strong>${item.quantity || 1}x ${safeEscape(item.name || "Item")}</strong></span></div>`;
        }
      });

      // Forma de pagamento
      const payInfo = FilterEngine.getPaymentInfo(order);
      let paySummary = order.paymentMethod || "Não informado";
      if (order.cashChangeFor) {
        paySummary += ` (Troco: ${safeEscape(order.cashChangeFor)})`;
      }

      // Botão de Promoção na Base do Card
      let promotionHtml = "";
      if (order.status === "novo") {
        promotionHtml = `
          <button type="button" class="btn-kanban-promote btn-promote-prep" onclick="VIPLiveOrders.advanceStatus('${order.id}', event)" title="Iniciar preparo do pedido">
            <i class="fa-solid fa-play"></i> Iniciar preparo
          </button>
        `;
      } else if (order.status === "em_preparo") {
        promotionHtml = `
          <button type="button" class="btn-kanban-promote btn-promote-ready" onclick="VIPLiveOrders.advanceStatus('${order.id}', event)" title="Pronto para entrega ou retirada">
            <i class="fa-solid fa-truck-fast"></i> Pronto / Despachar
          </button>
        `;
      } else if (order.status === "pronto") {
        promotionHtml = `
          <button type="button" class="btn-kanban-promote btn-promote-dispatch" onclick="VIPLiveOrders.advanceStatus('${order.id}', event)" title="Marcar como entregue">
            <i class="fa-solid fa-circle-check"></i> Entregue
          </button>
        `;
      } else {
        promotionHtml = `
          <div class="kanban-done-footer">
            <span class="badge-done-today"><i class="fa-solid fa-circle-check"></i> Concluído</span>
            <button type="button" class="btn-kanban-undo" onclick="VIPLiveOrders.revertStatus('${order.id}', event)" title="Desfazer e retornar para etapa anterior">
              <i class="fa-solid fa-rotate-left"></i> Desfazer
            </button>
          </div>
        `;
      }

      // Tag de Entregador (Motoboy)
      let motoboyTagHtml = "";
      if (isDelivery) {
        if (order.deliveryMan) {
          const cleanPhone = window.VIPWhatsApp && typeof window.VIPWhatsApp.Phone.normalize === "function"
            ? window.VIPWhatsApp.Phone.normalize(order.deliveryMan.phone)
            : (order.deliveryMan.phone || "").replace(/\D/g, "");
          const waLink = cleanPhone && window.VIPWhatsApp && typeof window.VIPWhatsApp.buildUrl === "function"
            ? window.VIPWhatsApp.buildUrl(cleanPhone)
            : `https://wa.me/${cleanPhone}`;
          motoboyTagHtml = `
            <div class="kanban-motoboy-badge" onclick="event.stopPropagation(); if (typeof window.openDispatchMotoboyModal === 'function') window.openDispatchMotoboyModal('${order.id}');" title="Clique para trocar o motoboy">
              <i class="fa-solid fa-motorcycle"></i>
              <span>${safeEscape(order.deliveryMan.name)} (R$ ${(Number(order.deliveryMan.fee) || 7).toFixed(2).replace(".", ",")})</span>
              ${cleanPhone ? `<a href="${waLink}" target="_blank" onclick="event.stopPropagation()" title="Falar com o entregador no WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>` : ""}
            </div>
          `;
        } else if (order.status === "pronto" || order.status === "em_preparo") {
          motoboyTagHtml = `
            <button type="button" class="kanban-assign-motoboy-btn" onclick="event.stopPropagation(); if (typeof window.openDispatchMotoboyModal === 'function') window.openDispatchMotoboyModal('${order.id}');" title="Atribuir motoboy a esta entrega">
              <i class="fa-solid fa-motorcycle"></i> + Motoboy
            </button>
          `;
        }
      } else if (order.status === "pronto") {
        motoboyTagHtml = `<span class="kanban-pickup-tag"><i class="fa-solid fa-store"></i> Balcão (Pronto)</span>`;
      }

      card.innerHTML = `
        <div class="kanban-card-top">
          <div class="kanban-card-id-block">
            <span class="kanban-card-number">#${order.id}</span>
            <span class="kanban-card-customer" title="${safeEscape(order.customer?.name || "Cliente")}">${safeEscape(order.customer?.name || "Cliente")}</span>
          </div>
          ${fulfillmentBadge}
        </div>

        <div class="kanban-card-tags">
          ${drinkTag}
          ${schedTag}
          ${motoboyTagHtml}
        </div>

        <div class="kanban-card-timebar">
          <span class="kanban-card-elapsed ${timing.isDelayed ? "is-delayed" : ""}" data-order-elapsed-id="${order.id}">
            ${timing.timerText}
          </span>
          <div style="display:flex; align-items:center; gap:5px;">
            <span class="card-delay-slot">${delayBadgeHtml}</span>
            ${waSentHtml}
          </div>
        </div>

        <div class="kanban-card-items" title="Clique para ver os detalhes completos do pedido">
          ${itemsSummaryHtml || '<span style="color:#94a3b8; font-style:italic;">Sem itens listados</span>'}
        </div>

        <div class="kanban-card-footer">
          <div>
            <div class="kanban-card-price">${formatMoney(order.totalAmount || 0)}</div>
            <span class="kanban-card-pay-badge" title="${safeEscape(paySummary)}">${safeEscape(paySummary)}</span>
          </div>
          <div class="kanban-quick-actions">
            <button type="button" class="btn-kanban-icon" onclick="VIPLiveOrders.printOrder('${order.id}', event)" title="Imprimir Comanda Térmica">
              <i class="fa-solid fa-print"></i>
            </button>
            <button type="button" class="btn-kanban-icon btn-wa-icon ${order.lastWhatsAppSent ? "has-sent" : ""}" onclick="VIPLiveOrders.openWhatsApp('${order.id}', event)" title="Notificar cliente via WhatsApp">
              <i class="fa-brands fa-whatsapp"></i>
            </button>
            <button type="button" class="btn-kanban-icon" onclick="VIPLiveOrders.openModal('${order.id}', event)" title="Ver Detalhes do Pedido">
              <i class="fa-solid fa-eye"></i>
            </button>
          </div>
        </div>

        ${promotionHtml}
      `;

      return card;
    }
  };

  // ============================================================================
  // 4. MODAL DE DETALHES COMPLETOS (BLINDAGEM TOTAL E Z-INDEX 2050)
  // ============================================================================
  const Modal = {
    open(orderId, event) {
      if (event) {
        if (typeof event.stopPropagation === "function") event.stopPropagation();
        if (typeof event.preventDefault === "function") event.preventDefault();
      }

      State.registerOperatedId(orderId);
      State.activeModalOrderId = orderId;
      State.isModalOpen = true;

      let orders = [];
      try {
        if (getDB() && typeof getDB().getOrders === "function") {
          orders = getDB().getOrders();
        }
      } catch (e) {}

      const order = orders.find((o) => String(o.id) === String(orderId) || String(o.orderId) === String(orderId));
      if (!order) {
        console.warn("[VIPLiveOrders.Modal] Pedido não encontrado no banco:", orderId);
        return;
      }

      try {
        this.renderContent(order);

        const backdropEl = document.getElementById("modal-order-backdrop");
        const modalEl = document.getElementById("modal-order");

        if (backdropEl) {
          backdropEl.style.cssText = "display: block !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; z-index: 2049 !important;";
          backdropEl.classList.add("active");
          // Proteção: backdrop só fecha se clicado nele mesmo, nunca se o clique for dentro do modal
          backdropEl.onclick = (e) => {
            if (e.target === backdropEl) {
              VIPLiveOrders.closeModal();
            }
          };
        }

        if (modalEl) {
          modalEl.style.cssText = "display: flex !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; z-index: 2050 !important; transform: translate(-50%, -50%) scale(1) !important;";
          modalEl.classList.add("active");
        }
      } catch (err) {
        console.error("[VIPLiveOrders.Modal] Erro ao renderizar modal do pedido:", err);
      }
    },

    close() {
      State.activeModalOrderId = null;
      State.isModalOpen = false;

      const backdropEl = document.getElementById("modal-order-backdrop");
      const modalEl = document.getElementById("modal-order");

      if (backdropEl) {
        backdropEl.classList.remove("active");
        backdropEl.style.cssText = "display: none !important; opacity: 0 !important; pointer-events: none !important;";
      }
      if (modalEl) {
        modalEl.classList.remove("active");
        modalEl.style.cssText = "display: none !important; opacity: 0 !important; pointer-events: none !important;";
      }
    },

    renderContent(order) {
      const timing = FilterEngine.getOrderTiming(order);

      // Título e Status no Cabeçalho
      const titleEl = document.getElementById("modal-order-title");
      if (titleEl) titleEl.textContent = `Pedido #${order.id}`;

      const statusBadge = document.getElementById("modal-order-status-badge");
      if (statusBadge) {
        statusBadge.className = `badge-status-order status-${order.status}`;
        const statusNames = {
          novo: "Recebidos",
          em_preparo: "Empreparo",
          pronto: "Em entrega / Pronto p/ Retirar",
          concluido: "Finalizado",
          cancelado: "Cancelado"
        };
        statusBadge.textContent = statusNames[order.status] || order.status;
      }

      const delayBadge = document.getElementById("modal-order-delay-badge");
      if (delayBadge) {
        if (timing.isDelayed) {
          delayBadge.style.display = "inline-flex";
          delayBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ATRASADO (+${timing.delayMinutes} min)`;
        } else {
          delayBadge.style.display = "none";
        }
      }

      // Detalhamento de Data
      let orderDateStr = "";
      try {
        const d = (typeof order.createdAt === "number") ? new Date(order.createdAt) : new Date(String(order.createdAt));
        orderDateStr = !isNaN(d.getTime())
          ? d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
          : "Data não registrada";
      } catch (e) {
        orderDateStr = "Data não registrada";
      }

      // Link do WhatsApp
      const rawPhone = order.customer?.phone || "";
      const waText = `Olá ${order.customer?.name || ""}! Aqui é do Salgados VIP Nova Iguaçu referente ao seu Pedido #${order.id}.`;
      let waLink = null;
      if (window.VIPWhatsApp && typeof window.VIPWhatsApp.buildUrl === "function") {
        if (window.VIPWhatsApp.Phone.isValid(rawPhone)) {
          waLink = window.VIPWhatsApp.buildUrl(rawPhone, waText);
        }
      } else if (rawPhone) {
        waLink = `https://wa.me/${rawPhone.replace(/\D/g, "")}?text=${encodeURIComponent(waText)}`;
      }

      // Itens Breakdown
      let items = order.items;
      if (typeof items === "string") {
        try { items = JSON.parse(items); } catch (e) { items = []; }
      }
      if (!Array.isArray(items)) items = [];

      let itemsBreakdownHtml = "";
      items.forEach((item) => {
        if (!item) return;
        if (item.type === "kit") {
          let flavorListHtml = "";
          const flavors = Array.isArray(item.flavors) ? item.flavors : [];
          flavors.forEach((f) => {
            flavorListHtml += `<li><strong>${f.quantity}x</strong> ${safeEscape(f.name)}</li>`;
          });

          let extraCostHtml = "";
          if (item.flavorExtraCost && Number(item.flavorExtraCost) > 0) {
            extraCostHtml = `<div style="font-size:0.8rem; color:#b45309; margin-top:4px;"><strong>+ ${formatMoney(item.flavorExtraCost)}</strong> (Adicional por sabores nobres)</div>`;
          }

          let saucesHtml = "";
          if (Array.isArray(item.sauces) && item.sauces.length > 0) {
            const sauceItems = item.sauces.map((s) => `${s.quantity}x ${s.name} (+${formatMoney(s.subtotal)})`).join(", ");
            saucesHtml = `<div style="font-size:0.8rem; color:#475569; margin-top:4px;">🥫 <strong>Molhos inclusos:</strong> ${safeEscape(sauceItems)}</div>`;
          }

          itemsBreakdownHtml += `
            <div class="order-item-box">
              <div class="order-item-head">
                <span>📦 ${safeEscape(item.kitName || "Kit de Salgados")}</span>
                <span>${formatMoney(item.finalPrice || 0)}</span>
              </div>
              <ul class="order-flavor-sublist">${flavorListHtml}</ul>
              ${extraCostHtml}
              ${saucesHtml}
            </div>
          `;
        } else if (item.type === "combo") {
          let comboItemsHtml = "";
          const cItems = Array.isArray(item.items) ? item.items : [];
          cItems.forEach((ci) => {
            comboItemsHtml += `<li><strong>${ci.quantity}x</strong> ${safeEscape(ci.name)}</li>`;
          });

          itemsBreakdownHtml += `
            <div class="order-item-box" style="border-left: 3px solid #f59e0b;">
              <div class="order-item-head">
                <span>🔥 ${safeEscape(item.name || "Combo Promocional")} <small style="background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; font-size:0.75rem;">${item.discountPercent || 15}% OFF</small></span>
                <span>${formatMoney(item.finalPrice || 0)}</span>
              </div>
              <div style="font-size:0.78rem; color:#059669; font-weight:700; margin-bottom:4px;">
                💰 Cliente economizou ${formatMoney(item.savings || 0)} (Preço avulso: ${formatMoney(item.regularPrice || 0)})
              </div>
              <ul class="order-flavor-sublist">${comboItemsHtml}</ul>
            </div>
          `;
        } else {
          itemsBreakdownHtml += `
            <div class="order-item-box">
              <div class="order-item-head">
                <span>🥤 ${item.quantity || 1}x ${safeEscape(item.name || "Item Avulso")}</span>
                <span>${formatMoney((item.price || 0) * (item.quantity || 1))}</span>
              </div>
            </div>
          `;
        }
      });

      // Observações
      const notesHtml = order.notes ? `
        <div class="order-notes-box">
          <strong><i class="fa-solid fa-comment-dots"></i> Observações do Cliente:</strong>
          <p style="margin: 0;">${safeEscape(order.notes)}</p>
        </div>
      ` : "";

      // Alerta de Bebidas Geladas
      const drinks = FilterEngine.extractOrderDrinks(order);
      const drinkBannerHtml = drinks.length > 0 ? `
        <div class="modal-drink-warning-box">
          <i class="fa-solid fa-bottle-water" style="font-size:1.6rem;"></i>
          <div>
            <strong>⚠️ ATENÇÃO: NÃO ESQUECER A BEBIDA!</strong><br>
            Este pedido contém <strong>${drinks.reduce((a, b) => a + b.quantity, 0)} bebida(s) gelada(s)</strong>:
            <strong>${drinks.map((d) => `${d.quantity}x ${d.name}`).join(", ")}</strong>. Retirar da geladeira antes do despacho!
          </div>
        </div>
      ` : "";

      // Informações de Cobrança
      const payInfo = FilterEngine.getPaymentInfo(order);
      const paymentAlertHtml = `
        <div class="modal-payment-alert-box is-${payInfo.paymentType}">
          <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 4px;">
            🛵 COBRANÇA (${payInfo.roleTitle}): ${payInfo.badgeText}
          </div>
          <div>Total a receber: <strong>${formatMoney(order.totalAmount || 0)}</strong></div>
          <div style="margin-top: 3px;">${payInfo.instruction}</div>
          ${payInfo.changeAlert}
        </div>
      `;

      // Painel Rápido de WhatsApp
      const waSentBadge = order.lastWhatsAppSent
        ? `<span class="card-wa-sent-tag" style="font-size:0.75rem;"><i class="fa-brands fa-whatsapp"></i> Avisado (${new Date(order.lastWhatsAppSent.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})</span>`
        : "";

      const isDeliveryOrder = order.fulfillment === "Entrega";
      const waPanelHtml = `
        <div class="order-whatsapp-quick-panel">
          <div class="wa-panel-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <i class="fa-brands fa-whatsapp" style="color: #25D366; font-size: 1.3rem;"></i>
              <div>
                <strong style="color: #0f172a; font-size: 0.88rem;">Notificar Cliente no WhatsApp</strong>
                <div style="font-size: 0.75rem; color: #64748b;">Disparo rápido de status em tempo real</div>
              </div>
            </div>
            ${waSentBadge}
          </div>
          <div class="wa-panel-buttons">
            <button type="button" class="btn-wa-action" onclick="VIPLiveOrders.sendWhatsAppStatus('${order.id}', 'confirmado')" title="Avisar confirmação">
              🟡 Confirmado
            </button>
            <button type="button" class="btn-wa-action" onclick="VIPLiveOrders.sendWhatsAppStatus('${order.id}', 'em_preparo')" title="Avisar que está na cozinha">
              👨‍🍳 Na Cozinha
            </button>
            ${isDeliveryOrder ? `
              <button type="button" class="btn-wa-action highlight-ready" onclick="VIPLiveOrders.sendWhatsAppStatus('${order.id}', 'saiu_entrega')" title="Avisar que saiu com motoboy">
                🛵 Saiu p/ Entrega
              </button>
            ` : `
              <button type="button" class="btn-wa-action highlight-ready" onclick="VIPLiveOrders.sendWhatsAppStatus('${order.id}', 'pronto_retirada')" title="Avisar pronto no balcão">
                🏪 Pronto no Balcão
              </button>
            `}
            <button type="button" class="btn-wa-action" onclick="VIPLiveOrders.sendWhatsAppStatus('${order.id}', 'concluido')" title="Enviar agradecimento">
              ❤️ Agradecimento
            </button>
            <button type="button" class="btn-wa-action btn-wa-more" onclick="VIPLiveOrders.openWhatsAppModalEdit('${order.id}')" title="Editar mensagem antes de enviar">
              <i class="fa-solid fa-pen-to-square"></i> Editar Mensagem
            </button>
          </div>
        </div>
      `;

      // Montagem do Corpo
      const contentEl = document.getElementById("modal-order-content");
      if (contentEl) {
        contentEl.innerHTML = `
          <!-- Grade de Informações Gerais -->
          <div class="order-detail-grid">
            <div class="order-detail-card">
              <h4><i class="fa-solid fa-user"></i> Dados do Cliente</h4>
              <div class="order-info-row">
                <span>Nome:</span>
                <strong>${safeEscape(order.customer?.name || "Não informado")}</strong>
              </div>
              <div class="order-info-row">
                <span>Telefone:</span>
                <span>
                  ${safeEscape(order.customer?.phone || "Não informado")}
                  ${waLink ? `<a href="${waLink}" target="_blank" class="order-phone-link" style="margin-left: 6px;"><i class="fa-brands fa-whatsapp"></i> Chamar</a>` : ""}
                </span>
              </div>
              <div class="order-info-row">
                <span>Modalidade:</span>
                <strong>${order.fulfillment === "Entrega" ? "🛵 Entrega a Domicílio" : "🏪 Retirada no Local"}</strong>
              </div>
              <div class="order-info-row" style="flex-direction:column; gap:2px; margin-top:4px;">
                <span>${order.fulfillment === "Entrega" ? "Endereço de Entrega:" : "Ponto de Retirada:"}</span>
                <strong style="color:#0f172a; font-size:0.84rem;">
                  ${order.fulfillment === "Entrega" ? safeEscape(order.customer?.address || "Endereço não informado") : "Rua Isabel Pedrosa, 31, Da Luz, Nova Iguaçu - RJ"}
                </strong>
                ${order.fulfillment === "Entrega" && order.deliveryDistanceKm ? `
                  <span style="font-size:0.8rem; color:#0369a1; font-weight:600; margin-top:2px;">
                    <i class="fa-solid fa-route"></i> Distância: <strong>${order.deliveryDistanceKm.toFixed(1)} km</strong> da loja ${order.customer?.neighborhood ? `(${safeEscape(order.customer.neighborhood)})` : ""}
                  </span>
                ` : ""}
              </div>
            </div>

            <div class="order-detail-card">
              <h4><i class="fa-solid fa-clock"></i> Tempo & Cronologia</h4>
              <div class="order-info-row">
                <span>Realizado em:</span>
                <strong>${orderDateStr}</strong>
              </div>
              ${order.timingType === "agendado" ? `
                <div class="order-info-row" style="background:#f5f3ff; border:1px solid #ddd6fe; padding:6px 10px; border-radius:8px; color:#5b21b6; margin: 4px 0;">
                  <span><i class="fa-solid fa-calendar-check"></i> Previsão:</span>
                  <strong>📅 AGENDADO: ${safeEscape(order.scheduledDateTimeFormatted || (order.scheduledDate + " às " + order.scheduledTime))}</strong>
                </div>
              ` : `
                <div class="order-info-row">
                  <span>Previsão:</span>
                  <strong>⚡ Preparar Agora (Imediato)</strong>
                </div>
              `}
              <div class="order-info-row">
                <span>Tempo Decorrido:</span>
                <strong>${timing.elapsedMinutes} minutos</strong>
              </div>
              <div class="order-info-row">
                <span>Tempo Alvo:</span>
                <span>${timing.targetPrepTime} minutos</span>
              </div>
              <div class="order-info-row">
                <span>Status do Preparo:</span>
                <strong style="color: ${timing.isDelayed ? "#dc2626" : "#059669"};">
                  ${timing.isDelayed ? `⚠️ ATRASADO (+${timing.delayMinutes} min)` : "✓ No Prazo Regular"}
                </strong>
              </div>
              <div class="order-info-row">
                <span>Comanda Impressa:</span>
                <strong>${order.printedAt ? "Sim (" + new Date(order.printedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + ")" : "Ainda não impressa"}</strong>
              </div>
            </div>
          </div>

          ${waPanelHtml}
          ${drinkBannerHtml}

          <!-- Lista de Itens do Pedido -->
          <div class="order-items-breakdown">
            <h4><i class="fa-solid fa-boxes-stacked"></i> Composição dos Itens do Pedido</h4>
            ${itemsBreakdownHtml}
          </div>

          ${notesHtml}

          <!-- Resumo Financeiro -->
          <div class="order-financial-summary">
            <div class="fin-row">
              <span>Subtotal dos Itens:</span>
              <span>${formatMoney(order.subtotal || order.totalAmount || 0)}</span>
            </div>
            <div class="fin-row">
              <span>Taxa de Entrega${order.deliveryDistanceKm ? ` (${order.deliveryDistanceKm.toFixed(1)} km)` : ""}:</span>
              <span>${order.deliveryFee && Number(order.deliveryFee) > 0 ? formatMoney(order.deliveryFee) : "Grátis / Retirada"}</span>
            </div>
            <div class="fin-row">
              <span>Forma de Pagamento:</span>
              <strong>${safeEscape(order.paymentMethod || "Não informado")}</strong>
            </div>
            ${order.pixCode ? `
              <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 8px 10px; margin: 8px 0; font-size: 0.82rem;">
                <div style="color: #166534; font-weight: 800; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                  <i class="fa-brands fa-pix" style="color: #16a34a;"></i> Código Pix Copia e Cola:
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <input type="text" readonly value="${safeEscape(order.pixCode)}" style="flex: 1; font-family: monospace; font-size: 0.76rem; padding: 4px 8px; border: 1px solid #86efac; border-radius: 6px; background: #fff;" onclick="this.select()">
                  <button type="button" class="btn-outline-admin" onclick="navigator.clipboard.writeText('${safeEscape(order.pixCode)}'); alert('Código Pix copiado!');" style="padding: 4px 8px; font-size: 0.75rem; white-space: nowrap;">
                    <i class="fa-solid fa-copy"></i> Copiar
                  </button>
                </div>
              </div>
            ` : ""}
            ${order.cashChangeFor ? `
              <div class="fin-row" style="color:#b45309; font-weight:700;">
                <span>Troco solicitado para:</span>
                <span>${safeEscape(order.cashChangeFor)}</span>
              </div>
            ` : ""}
            <div class="fin-row fin-total">
              <span>Total a Cobrar:</span>
              <span style="color:#10b981;">${formatMoney(order.totalAmount || 0)}</span>
            </div>
          </div>

          ${paymentAlertHtml}
        `;
      }

      // Botões de Troca de Status no Rodapé
      const statusBtnsContainer = document.getElementById("modal-order-status-btns");
      if (statusBtnsContainer) {
        const statuses = [
          { key: "novo", label: "🟡 Recebidos" },
          { key: "em_preparo", label: "🔵 Empreparo" },
          { key: "pronto", label: "🟢 Em entrega / Pronto p/ Retirar" },
          { key: "concluido", label: "⚪ Finalizado" },
          { key: "cancelado", label: "🔴 Cancelado" }
        ];

        statusBtnsContainer.innerHTML = statuses.map((s) => `
          <button type="button" class="btn-status-pill ${order.status === s.key ? "active" : ""}" onclick="VIPLiveOrders.setStatus('${order.id}', '${s.key}')">
            ${s.label}
          </button>
        `).join("");
      }

      // Botão de Impressão
      const btnPrint = document.getElementById("btn-modal-print-order");
      if (btnPrint) {
        btnPrint.onclick = (e) => {
          VIPLiveOrders.printOrder(order.id, e);
        };
      }
    }
  };

  // ============================================================================
  // 5. SUBSISTEMA PRINCIPAL - EXPORTAÇÕES E OPERAÇÕES PÚBLICAS
  // ============================================================================
  const VIPLiveOrders = {
    VERSION: "v51.0 (Bkp 49)",

    // Inicialização do módulo
    init() {
      // Registrar atalho de tecla Escape para fechar modal
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && State.isModalOpen) {
          this.closeModal();
        }
      });

      // Escuta eventos de atualização em tempo real
      window.addEventListener("vip_orders_updated", () => {
        this.scheduleDebouncedRender();
      });
      window.addEventListener("vip_order_received", () => {
        this.scheduleDebouncedRender();
      });
      window.addEventListener("vip_supabase_synced", () => {
        this.scheduleDebouncedRender();
      });

      // Cronômetro suave a cada 15s sem recriar os cards
      setInterval(() => {
        this.updateTimersOnly();
      }, 15000);
    },

    // Renderização agendada com debounce
    scheduleDebouncedRender() {
      if (State._renderScheduled) return;
      State._renderScheduled = true;
      requestAnimationFrame(() => {
        State._renderScheduled = false;
        this.render();
      });
    },

    // Renderização principal do Kanban
    render() {
      try {
        Kanban.render();
        // Se o modal estiver aberto, atualiza seu conteúdo sem fechar ou piscar
        if (State.isModalOpen && State.activeModalOrderId) {
          const orders = window.VIPDatabase ? getDB().getOrders() : [];
          const cur = orders.find((o) => String(o.id) === String(State.activeModalOrderId) || String(o.orderId) === String(State.activeModalOrderId));
          if (cur) {
            Modal.renderContent(cur);
          }
        }
      } catch (err) {
        console.error("[VIPLiveOrders] Erro na renderização do Kanban:", err);
      }
    },

    // Atualização leve de timers sem desmontar cards
    updateTimersOnly() {
      const timerEls = document.querySelectorAll("[data-order-elapsed-id]");
      if (timerEls.length === 0) return;

      const orders = window.VIPDatabase ? getDB().getOrders() : [];
      const orderMap = new Map(orders.map((o) => [String(o.id), o]));

      timerEls.forEach((el) => {
        const id = el.dataset.orderElapsedId;
        const ord = orderMap.get(String(id));
        if (!ord) return;

        const timing = FilterEngine.getOrderTiming(ord);
        el.textContent = timing.timerText;

        const cardEl = document.getElementById(`order-card-${id}`);
        if (cardEl) {
          if (timing.isDelayed) {
            cardEl.classList.add("is-delayed");
            const slot = cardEl.querySelector(".card-delay-slot");
            if (slot) {
              slot.innerHTML = `<span class="badge-delay-pill"><i class="fa-solid fa-triangle-exclamation"></i> +${timing.delayMinutes}m</span>`;
            }
          } else {
            cardEl.classList.remove("is-delayed");
            const slot = cardEl.querySelector(".card-delay-slot");
            if (slot) slot.innerHTML = "";
          }
        }
      });
    },

    // Abrir Modal de Detalhes
    openModal(orderId, event) {
      Modal.open(orderId, event);
    },

    // Fechar Modal de Detalhes
    closeModal() {
      Modal.close();
    },

    // Alteração de Status com Sincronização e Preservação
    async setStatus(orderId, newStatus) {
      State.registerOperatedId(orderId);
      if (getDB() && typeof getDB().updateOrderStatus === "function") {
        getDB().updateOrderStatus(orderId, newStatus);
      }
      this.render();
      if (State.activeModalOrderId === orderId && State.isModalOpen) {
        Modal.open(orderId);
      }
    },

    // Avanço Rápido de Status (Pelo Card)
    async advanceStatus(orderId, event) {
      if (event) {
        if (typeof event.stopPropagation === "function") event.stopPropagation();
        if (typeof event.preventDefault === "function") event.preventDefault();
      }
      State.registerOperatedId(orderId);

      const orders = window.VIPDatabase ? getDB().getOrders() : [];
      const order = orders.find((o) => String(o.id) === String(orderId) || String(o.orderId) === String(orderId));
      if (!order) return;

      let nextStatus = "em_preparo";
      if (order.status === "novo") {
        nextStatus = "em_preparo";
      } else if (order.status === "em_preparo") {
        if (order.fulfillment === "Entrega" && !order.deliveryMan) {
          if (typeof window.openDispatchMotoboyModal === "function") {
            window.openDispatchMotoboyModal(orderId);
            return;
          }
        }
        nextStatus = "pronto";
      } else if (order.status === "pronto") {
        nextStatus = "concluido";
      }

      await this.setStatus(orderId, nextStatus);

      // Sugestão opcional de WhatsApp
      const statusNames = {
        novo: "Recebidos",
        em_preparo: "Empreparo",
        pronto: "Em entrega / Pronto p/ Retirar",
        concluido: "Finalizado"
      };

      if (typeof window.showToastNotification === "function") {
        window.showToastNotification(`Pedido #${order.id} avançado para "${statusNames[nextStatus] || nextStatus}"!`);
      }
    },

    // Reversão de Status (Desfazer)
    async revertStatus(orderId, event) {
      if (event) {
        if (typeof event.stopPropagation === "function") event.stopPropagation();
        if (typeof event.preventDefault === "function") event.preventDefault();
      }
      State.registerOperatedId(orderId);

      const orders = window.VIPDatabase ? getDB().getOrders() : [];
      const order = orders.find((o) => String(o.id) === String(orderId) || String(o.orderId) === String(orderId));
      if (!order) return;

      let prevStatus = "novo";
      if (order.status === "concluido") prevStatus = "pronto";
      else if (order.status === "pronto") prevStatus = "em_preparo";
      else if (order.status === "em_preparo") prevStatus = "novo";

      await this.setStatus(orderId, prevStatus);
      if (typeof window.showToastNotification === "function") {
        window.showToastNotification(`Pedido #${order.id} revertido para "${prevStatus}"!`);
      }
    },

    // Filtros de Data ("hoje" ou "todos")
    setDateFilter(filter) {
      State.currentDateFilter = filter === "todos" ? "todos" : "hoje";
      try {
        localStorage.setItem(DATE_FILTER_KEY, State.currentDateFilter);
      } catch (e) {}

      const pillToday = document.getElementById("pill-date-today");
      const pillAll = document.getElementById("pill-date-all");
      const infoLabel = document.getElementById("kanban-date-info-label");

      if (pillToday) pillToday.classList.toggle("active", State.currentDateFilter === "hoje");
      if (pillAll) pillAll.classList.toggle("active", State.currentDateFilter === "todos");

      if (infoLabel) {
        if (State.currentDateFilter === "hoje") {
          infoLabel.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #059669;"></i> Exibindo apenas pedidos de hoje (${new Date().toLocaleDateString("pt-BR")})`;
        } else {
          infoLabel.innerHTML = `<i class="fa-solid fa-clock-rotate-left" style="color: #0284c7;"></i> Exibindo histórico completo (Todos os dias)`;
        }
      }

      this.render();
    },

    // Alternar filtro de Atrasados
    toggleDelayFilter() {
      State.onlyDelayed = !State.onlyDelayed;
      const pillDelay = document.getElementById("pill-filter-delay");
      if (pillDelay) {
        pillDelay.classList.toggle("active", State.onlyDelayed);
      }
      this.render();
    },

    // Busca em Tempo Real
    onSearch() {
      const input = document.getElementById("order-search-input");
      State.searchTerm = input ? input.value.trim() : "";
      this.render();
    },

    // Scroll para coluna específica no Kanban
    scrollTo(stage) {
      const col = document.querySelector(`.kanban-col[data-stage="${stage}"]`);
      if (col) {
        col.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        col.style.transition = "box-shadow 0.3s ease";
        col.style.boxShadow = "0 0 0 3px #f59e0b";
        setTimeout(() => { col.style.boxShadow = ""; }, 1200);
      }
    },

    // Simulação de Pedido Teste
    simulate() {
      const sampleNames = ["Juliana Rocha", "Marcelo Rezende", "Carla Mendonça", "Felipe Vasconcellos"];
      const randomName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
      const sampleOrder = {
        customer: {
          name: randomName,
          phone: "(21) 98765-4321",
          address: "Av. Abílio Augusto Távora, 1200, Apto 302, Luz - Nova Iguaçu"
        },
        fulfillment: "Entrega",
        items: [
          {
            type: "kit",
            kitId: "k50",
            kitName: "Kit 50 Salgadinhos",
            finalPrice: 67.90,
            flavors: [
              { name: "Coxinha", quantity: 20 },
              { name: "Bolinha de queijo com orégano", quantity: 10 },
              { name: "Kibe", quantity: 10 },
              { name: "Croquete de bacalhau", quantity: 10 }
            ],
            flavorExtraCost: 3.00,
            sauces: [{ name: "Maionese de Alho da Casa", quantity: 1, subtotal: 4.50 }]
          },
          {
            type: "product",
            id: "prod-sim-coca",
            name: "Coca-Cola 2L",
            price: 12.00,
            quantity: 1
          }
        ],
        subtotal: 84.40,
        deliveryFee: 5.00,
        totalAmount: 89.40,
        paymentMethod: "Pix",
        notes: "Tocar o interfone 302 e entregar bem quentinho!",
        status: "novo",
        printedAt: null
      };

      if (getDB() && typeof getDB().addOrder === "function") {
        const created = getDB().addOrder(sampleOrder);
        State.registerOperatedId(created.id);
        this.render();
        if (typeof window.playNewOrderChime === "function") window.playNewOrderChime();
        if (typeof window.showToastNotification === "function") {
          window.showToastNotification(`Novo pedido #${created.id} simulado com sucesso!`);
        }
      }
    },

    // Impressão da comanda
    printOrder(orderId, event) {
      if (event) {
        if (typeof event.stopPropagation === "function") event.stopPropagation();
        if (typeof event.preventDefault === "function") event.preventDefault();
      }
      if (typeof window.printOrderReceipt === "function") {
        window.printOrderReceipt(orderId, false);
      }
    },

    // Disparo rápido de WhatsApp
    async sendWhatsAppStatus(orderId, templateKey) {
      State.registerOperatedId(orderId);
      if (window.VIPWhatsApp && typeof window.VIPWhatsApp.quickSend === "function") {
        return await window.VIPWhatsApp.quickSend(orderId, templateKey);
      } else if (typeof window.quickSendWhatsAppStatus === "function") {
        return await window.quickSendWhatsAppStatus(orderId, templateKey);
      }
    },

    // Abrir Modal de WhatsApp
    openWhatsApp(orderId, event) {
      if (event) {
        if (typeof event.stopPropagation === "function") event.stopPropagation();
        if (typeof event.preventDefault === "function") event.preventDefault();
      }
      if (window.VIPWhatsApp && typeof window.VIPWhatsApp.UI.openModal === "function") {
        window.VIPWhatsApp.UI.openModal(orderId);
      } else if (typeof window.openWhatsAppNotifyModal === "function") {
        window.openWhatsAppNotifyModal(orderId, event);
      }
    },

    openWhatsAppModalEdit(orderId) {
      if (window.VIPWhatsApp && typeof window.VIPWhatsApp.UI.openModal === "function") {
        window.VIPWhatsApp.UI.openModal(orderId);
      } else if (typeof window.openWhatsAppNotifyModal === "function") {
        window.openWhatsAppNotifyModal(orderId);
      }
    },

    // Drag and Drop
    onKanbanDragStart(event, orderId) {
      if (event && event.dataTransfer) {
        event.dataTransfer.setData("text/plain", orderId);
        event.dataTransfer.effectAllowed = "move";
      }
      const el = document.getElementById(`order-card-${orderId}`);
      if (el) el.classList.add("dragging");
    },

    onKanbanDragEnd(event) {
      document.querySelectorAll(".kanban-card.dragging").forEach((c) => c.classList.remove("dragging"));
      document.querySelectorAll(".kanban-col.drag-over").forEach((col) => col.classList.remove("drag-over"));
    },

    onKanbanDragOver(event) {
      if (event) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      }
      const col = event.currentTarget;
      if (col && !col.classList.contains("drag-over")) {
        col.classList.add("drag-over");
      }
    },

    onKanbanDragLeave(event) {
      const col = event.currentTarget;
      if (col && !col.contains(event.relatedTarget)) {
        col.classList.remove("drag-over");
      }
    },

    onKanbanDrop(event, targetStage) {
      if (event) event.preventDefault();
      const col = event.currentTarget;
      if (col) col.classList.remove("drag-over");

      const orderId = event.dataTransfer ? event.dataTransfer.getData("text/plain") : null;
      if (!orderId) return;

      const validStages = ["novo", "em_preparo", "pronto", "concluido"];
      if (validStages.includes(targetStage)) {
        this.setStatus(orderId, targetStage);
      }
    }
  };

  // ============================================================================
  // 6. EXPORTAÇÕES GLOBAIS COM TOTAL RETROCOMPATIBILIDADE
  // ============================================================================
  window.VIPLiveOrders = VIPLiveOrders;

  // Retrocompatibilidade para o HTML e scripts antigos
  window.renderLiveOrders = function () {
    VIPLiveOrders.render();
  };
  window.debouncedRenderLiveOrders = function () {
    VIPLiveOrders.scheduleDebouncedRender();
  };
  window.openOrderDetails = function (orderId, event) {
    VIPLiveOrders.openModal(orderId, event);
  };
  window.closeOrderModal = function () {
    VIPLiveOrders.closeModal();
  };
  window.setOrderStatus = function (orderId, newStatus) {
    return VIPLiveOrders.setStatus(orderId, newStatus);
  };
  window.advanceOrderStatus = function (orderId, event) {
    return VIPLiveOrders.advanceStatus(orderId, event);
  };
  window.revertOrderStatus = function (orderId, event) {
    return VIPLiveOrders.revertStatus(orderId, event);
  };
  window.setOrdersDateFilter = function (filter) {
    VIPLiveOrders.setDateFilter(filter);
  };
  window.toggleOnlyDelayedFilter = function () {
    VIPLiveOrders.toggleDelayFilter();
  };
  window.onOrderSearchChange = function () {
    VIPLiveOrders.onSearch();
  };
  window.simulateNewOrder = function () {
    VIPLiveOrders.simulate();
  };
  window.scrollKanbanTo = function (stage) {
    VIPLiveOrders.scrollTo(stage);
  };
  window.onKanbanDragStart = function (event, orderId) {
    VIPLiveOrders.onKanbanDragStart(event, orderId);
  };
  window.onKanbanDragEnd = function (event) {
    VIPLiveOrders.onKanbanDragEnd(event);
  };
  window.onKanbanDragOver = function (event) {
    VIPLiveOrders.onKanbanDragOver(event);
  };
  window.onKanbanDragLeave = function (event) {
    VIPLiveOrders.onKanbanDragLeave(event);
  };
  window.onKanbanDrop = function (event, targetStage) {
    VIPLiveOrders.onKanbanDrop(event, targetStage);
  };
  window.getOrderTiming = function (order) {
    return FilterEngine.getOrderTiming(order);
  };
  window.isOrderFromToday = function (order) {
    return FilterEngine.isOrderFromToday(order);
  };

  // Inicialização no DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => VIPLiveOrders.init());
  } else {
    VIPLiveOrders.init();
  }
})(window, document);
