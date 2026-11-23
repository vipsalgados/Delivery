/**
 * ==============================================================================
 * SALGADOS VIP - ACOMPANHAMENTO DE PEDIDOS & RADAR DO CLIENTE (v66.0)
 * ==============================================================================
 * Módulo para visualização ultra-rápida e em tempo real do status do pedido,
 * radar com mapa Leaflet do motoboy se aproximando, sincronização instantânea
 * via Supabase Realtime + BroadcastChannel e botão flutuante de retorno fácil.
 * ==============================================================================
 */

(function (window) {
  "use strict";

  const STORAGE_KEY_ACTIVE_ORDER = "salgados_vip_active_order_id";

  let _activeOrderId = null;
  let _activeOrder = null;
  let _orderRealtimeChannel = null;
  let _motoboySubscription = null;
  let _customerMap = null;
  let _customerMotoboyMarker = null;
  let _customerStoreMarker = null;
  let _customerDestMarker = null;
  let _customerRoutePolyline = null;
  let _hasFitRouteBounds = false;
  let _pollTimer = null;
  let _lastRouteCalcTime = 0;
  let _lastRouteCalcCoords = null;

  function getSupabase() {
    if (typeof window !== "undefined" && window.VIPDatabase && typeof window.VIPDatabase.getSupabaseClient === "function") {
      const client = window.VIPDatabase.getSupabaseClient();
      if (client) return client;
    }
    if (typeof window !== "undefined" && window._supabaseClient) {
      return window._supabaseClient;
    }
    return null;
  }

  // Cálculo geodésico Haversine (em metros)
  function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const VIPCustomerTracker = {
    /**
     * Normaliza os diferentes identificadores de status para as etapas visuais
     */
    normalizeStatus(st) {
      const s = String(st || "").toLowerCase().trim();
      if (s === "em_preparo" || s === "preparando" || s === "cozinha") return "preparando";
      if (s === "pronto" || s === "despachado" || s === "em_rota" || s === "saiu_para_entrega") return "pronto";
      if (s === "concluido" || s === "finalizado" || s === "entregue") return "finalizado";
      if (s === "cancelado") return "cancelado";
      return "novo";
    },

    /**
     * Padroniza o objeto de pedido do Supabase ou LocalStorage
     */
    normalizeOrderData(raw) {
      if (!raw) return null;
      const id = String(raw.id || raw.order_id || "");
      const normStatus = this.normalizeStatus(raw.status);

      return {
        ...raw,
        id,
        orderId: id,
        rawStatus: raw.status || "novo",
        status: normStatus,
        deliveryMan: raw.deliveryMan || raw.delivery_man || null,
        deliveryCoords: raw.deliveryCoords || raw.delivery_coords || null,
        customer: raw.customer || {},
        items: raw.items || [],
        totalAmount: Number(raw.totalAmount ?? raw.total_amount ?? raw.total ?? 0),
        subtotal: Number(raw.subtotal || 0),
        deliveryFee: Number(raw.deliveryFee ?? raw.delivery_fee ?? 0),
        paymentMethod: raw.paymentMethod || raw.payment_method || "Não informado",
        cashChangeFor: raw.cashChangeFor || raw.cash_change_for || null,
        fulfillment: raw.fulfillment || "Entrega",
        createdAt: Number(raw.createdAt || raw.created_at || Date.now())
      };
    },

    /**
     * Inicializa o rastreador no app do cliente
     */
    async init() {
      // 1. Recupera ID do pedido ativo salvo
      try {
        _activeOrderId = localStorage.getItem(STORAGE_KEY_ACTIVE_ORDER);
      } catch (e) {}

      // 2. Se não tem ID explícito, verifica se o último pedido ainda está em andamento
      if (!_activeOrderId && window.VIPDatabase && typeof window.VIPDatabase.getCustomerLastOrder === "function") {
        const last = window.VIPDatabase.getCustomerLastOrder();
        if (last && last.id && (Date.now() - (last.createdAt || 0) < 18 * 60 * 60 * 1000)) {
          _activeOrderId = String(last.id);
        }
      }

      // 3. Atualiza estado e interface com prioridade
      await this.refreshActiveOrder();

      // 4. Inicia escuta Realtime do Supabase no pedido ativo
      if (_activeOrderId) {
        this.subscribeActiveOrderRealtime(_activeOrderId);
      }

      // 5. Polling suave e rápido de atualização de status (a cada 2.5 segundos)
      if (_pollTimer) clearInterval(_pollTimer);
      _pollTimer = setInterval(() => {
        if (_activeOrderId) {
          this.refreshActiveOrder(false);
        }
      }, 2500);

      // 6. Escuta eventos customizados disparados por outras partes da aplicação
      window.addEventListener("vip_orders_updated", (evt) => {
        if (_activeOrderId && evt.detail && evt.detail.order) {
          const ord = evt.detail.order;
          if (String(ord.id) === String(_activeOrderId) || String(ord.orderId) === String(_activeOrderId)) {
            this.handleDirectOrderUpdate(ord);
          }
        }
      });

      window.addEventListener("vip_supabase_synced", () => {
        if (_activeOrderId) {
          this.refreshActiveOrder(false);
        }
      });

      // 7. Escuta mensagens locais via BroadcastChannel (comunicação inter-abas)
      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel("salgados_vip_bus");
          bc.addEventListener("message", (evt) => {
            if (evt.data && evt.data.type === "ORDER_UPDATED" && _activeOrderId) {
              const payload = evt.data.payload;
              if (payload && (String(payload.id) === String(_activeOrderId) || String(payload.orderId) === String(_activeOrderId))) {
                this.handleDirectOrderUpdate(payload);
              }
            }
          });
        }
      } catch (e) {}
    },

    /**
     * Inscreve canal Supabase Realtime dedicado para o pedido ativo do cliente
     */
    subscribeActiveOrderRealtime(orderId) {
      if (!orderId) return;
      const sb = getSupabase();
      if (!sb || typeof sb.channel !== "function") return;

      if (_orderRealtimeChannel) {
        try { sb.removeChannel(_orderRealtimeChannel); } catch (e) {}
        _orderRealtimeChannel = null;
      }

      try {
        const cleanId = String(orderId);
        _orderRealtimeChannel = sb.channel(`cust-order-${cleanId}-${Date.now()}`)
          .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `id=eq.${cleanId}`
          }, (payload) => {
            if (payload && payload.new) {
              this.handleDirectOrderUpdate(payload.new);
            }
          })
          .subscribe();
      } catch (e) {
        console.warn("[VIPCustomerTracker] Erro ao assinar realtime de pedidos:", e);
      }
    },

    /**
     * Manipula atualização direta de dados do pedido ativo recebida via Realtime ou Broadcast
     */
    handleDirectOrderUpdate(updatedRaw) {
      if (!updatedRaw) return;
      const prevStatus = _activeOrder?.status;
      const norm = this.normalizeOrderData(updatedRaw);

      // Preserva itens do pedido se a mensagem contiver apenas status
      if ((!norm.items || norm.items.length === 0) && _activeOrder?.items) {
        norm.items = _activeOrder.items;
      }
      if (!norm.customer?.name && _activeOrder?.customer?.name) {
        norm.customer = _activeOrder.customer;
      }

      _activeOrder = norm;

      // Atualiza no cache do banco local
      if (window.VIPDatabase && typeof window.VIPDatabase.updateOrder === "function") {
        try { window.VIPDatabase.updateOrder(norm); } catch (e) {}
      }

      this.renderFloatingButton();
      this.renderTrackingModalContent();

      // Se mudou para 'pronto' e é entrega, inicializa o mapa do radar imediatamente
      if (norm.status === "pronto" && norm.fulfillment === "Entrega") {
        const modal = document.getElementById("customer-track-modal");
        if (modal && modal.classList.contains("active")) {
          this.initOrUpdateRadarMap();
        }
      }
    },

    /**
     * Define um novo pedido ativo (chamado logo após finalizar a compra)
     * e abre o card de acompanhamento automaticamente
     */
    async setActiveOrder(orderId) {
      if (!orderId) return;
      _activeOrderId = String(orderId);
      _hasFitRouteBounds = false;
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_ORDER, _activeOrderId);
      } catch (e) {}

      this.subscribeActiveOrderRealtime(_activeOrderId);
      await this.refreshActiveOrder(true);
      this.openTrackingModal();
    },

    /**
     * Atualiza os dados do pedido ativo consultando imediatamente Supabase e banco local
     */
    async refreshActiveOrder(shouldOpenModalOnFirstLoad = false) {
      if (!_activeOrderId) {
        this.hideFloatingButton();
        return;
      }

      let order = null;

      // 1. Busca imediata em memória no VIPDatabase para resposta sem delay
      if (window.VIPDatabase && typeof window.VIPDatabase.getOrders === "function") {
        const orders = window.VIPDatabase.getOrders();
        const found = orders.find(o => String(o.id) === String(_activeOrderId) || String(o.orderId) === String(_activeOrderId));
        if (found) {
          order = this.normalizeOrderData(found);
        }
      }

      // 2. Consulta direta ao Supabase para garantir status 100% fresco da nuvem
      const sb = getSupabase();
      if (sb) {
        try {
          const { data, error } = await sb
            .from("orders")
            .select("*")
            .eq("id", _activeOrderId)
            .maybeSingle();

          if (!error && data) {
            order = this.normalizeOrderData(data);
            // Sincroniza de volta no banco local
            if (window.VIPDatabase && typeof window.VIPDatabase.updateOrder === "function") {
              try { window.VIPDatabase.updateOrder(order); } catch (e) {}
            }
          }
        } catch (e) {}
      }

      if (!order) {
        return;
      }

      // Se o pedido já foi finalizado há mais de 45 minutos ou cancelado, remove status ativo
      const isDelivered = (order.status === "finalizado");
      const isCancelled = (order.status === "cancelado");
      const orderAgeMs = Date.now() - (order.createdAt || 0);

      if (isCancelled || (isDelivered && orderAgeMs > 45 * 60 * 1000)) {
        this.clearActiveOrder();
        return;
      }

      _activeOrder = order;

      // Atualiza o botão flutuante e o modal
      this.renderFloatingButton();
      this.renderTrackingModalContent();

      if (shouldOpenModalOnFirstLoad) {
        this.openTrackingModal();
      }
    },

    /**
     * Limpa o pedido ativo
     */
    clearActiveOrder() {
      _activeOrderId = null;
      _activeOrder = null;
      _hasFitRouteBounds = false;
      try {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_ORDER);
      } catch (e) {}
      this.hideFloatingButton();
      this.closeTrackingModal();

      if (_orderRealtimeChannel) {
        const sb = getSupabase();
        if (sb) {
          try { sb.removeChannel(_orderRealtimeChannel); } catch (e) {}
        }
        _orderRealtimeChannel = null;
      }

      if (_motoboySubscription) {
        _motoboySubscription.unsubscribe();
        _motoboySubscription = null;
      }
    },

    /**
     * Renderiza o botão flutuante na tela do cliente
     */
    renderFloatingButton() {
      const btn = document.getElementById("floating-track-order-btn");
      if (!btn || !_activeOrder) return;

      const titleEl = document.getElementById("track-btn-title");
      const statusEl = document.getElementById("track-btn-status");

      let statusText = "Em andamento";
      let pulseColor = "#f59e0b";

      const curStatus = _activeOrder.status;

      if (curStatus === "novo") {
        statusText = "Recebido na Cozinha";
        pulseColor = "#38bdf8";
      } else if (curStatus === "preparando") {
        statusText = "Fritando seus Salgadinhos";
        pulseColor = "#f59e0b";
      } else if (curStatus === "pronto") {
        statusText = _activeOrder.fulfillment === "Entrega" ? "🛵 Motoboy a Caminho!" : "Pronto para Retirada!";
        pulseColor = "#10b981";
      } else if (curStatus === "finalizado") {
        statusText = "🎉 Pedido Entregue!";
        pulseColor = "#10b981";
      }

      if (titleEl) titleEl.textContent = `Pedido #${_activeOrder.id}`;
      if (statusEl) statusEl.textContent = `${statusText} • Toque p/ ver`;

      const pulseDot = btn.querySelector(".track-pulse-dot");
      if (pulseDot) pulseDot.style.backgroundColor = pulseColor;

      btn.style.display = "flex";
    },

    hideFloatingButton() {
      const btn = document.getElementById("floating-track-order-btn");
      if (btn) btn.style.display = "none";
    },

    /**
     * Abre o modal / card de acompanhamento
     */
    openTrackingModal() {
      const modal = document.getElementById("customer-track-modal");
      const backdrop = document.getElementById("customer-track-backdrop");
      if (!modal) return;

      this.renderTrackingModalContent();

      if (backdrop) {
        backdrop.style.display = "block";
        setTimeout(() => backdrop.classList.add("active"), 10);
      }

      modal.style.display = "flex";
      setTimeout(() => {
        modal.classList.add("active");
        if (_activeOrder && _activeOrder.status === "pronto" && _activeOrder.fulfillment === "Entrega") {
          this.initOrUpdateRadarMap();
        }
      }, 20);
    },

    /**
     * Fecha o modal (mantendo o botão flutuante acessível para retornar com 1 toque)
     */
    closeTrackingModal() {
      const modal = document.getElementById("customer-track-modal");
      const backdrop = document.getElementById("customer-track-backdrop");

      if (modal) {
        modal.classList.remove("active");
        setTimeout(() => {
          modal.style.display = "none";
        }, 300);
      }

      if (backdrop) {
        backdrop.classList.remove("active");
        setTimeout(() => {
          backdrop.style.display = "none";
        }, 300);
      }
    },

    /**
     * Renderiza o conteúdo do modal de acompanhamento
     */
    renderTrackingModalContent() {
      if (!_activeOrder) return;

      const order = _activeOrder;
      const titleId = document.getElementById("track-modal-order-id");
      if (titleId) titleId.textContent = `#${order.id}`;

      // Etapas do Stepper de Progresso
      const stNovo = document.getElementById("step-track-novo");
      const stPrep = document.getElementById("step-track-preparando");
      const stPronto = document.getElementById("step-track-pronto");
      const stEntregue = document.getElementById("step-track-entregue");

      const resetSteps = () => {
        [stNovo, stPrep, stPronto, stEntregue].forEach(el => {
          if (el) el.className = "track-step-item";
        });
      };
      resetSteps();

      const descBox = document.getElementById("track-status-description-box");
      const radarSection = document.getElementById("track-radar-section");
      const motoboyInfoCard = document.getElementById("track-motoboy-info-card");
      const curStatus = order.status;

      if (curStatus === "novo") {
        stNovo?.classList.add("current");
        if (descBox) {
          descBox.innerHTML = `
            <div class="track-desc-title"><i class="fa-solid fa-clipboard-check" style="color: #38bdf8;"></i> Pedido Recebido com Sucesso!</div>
            <p>Seu pedido já foi registrado no sistema da Salgados VIP e entrou na fila de atendimento da cozinha.</p>
          `;
        }
        if (radarSection) radarSection.style.display = "none";
        if (motoboyInfoCard) motoboyInfoCard.style.display = "none";
      } else if (curStatus === "preparando") {
        stNovo?.classList.add("completed");
        stPrep?.classList.add("current");
        if (descBox) {
          descBox.innerHTML = `
            <div class="track-desc-title"><i class="fa-solid fa-fire-burner" style="color: #f59e0b;"></i> Fritando seus Salgadinhos na Hora!</div>
            <p>Nossa equipe está preparando seus salgados quentinhos e crocantes com todo carinho e qualidade artesanal.</p>
          `;
        }
        if (radarSection) radarSection.style.display = "none";
        if (motoboyInfoCard) motoboyInfoCard.style.display = "none";
      } else if (curStatus === "pronto") {
        stNovo?.classList.add("completed");
        stPrep?.classList.add("completed");
        stPronto?.classList.add("current");

        if (order.fulfillment === "Entrega") {
          const mb = order.deliveryMan;
          const mbName = mb?.name || "Entregador VIP";
          const mbVehicle = mb?.vehicle || "Moto";
          if (descBox) {
            descBox.innerHTML = `
              <div class="track-desc-title"><i class="fa-solid fa-motorcycle" style="color: #10b981;"></i> Motoboy a Caminho da sua Residência!</div>
              <p>O entregador <strong>${mbName}</strong> (${mbVehicle}) já recolheu seu pedido quentinho e está em rota de entrega.</p>
            `;
          }

          if (motoboyInfoCard) {
            motoboyInfoCard.innerHTML = `
              <div class="track-mb-badge">
                <div class="mb-avatar-box"><i class="fa-solid fa-motorcycle"></i></div>
                <div class="mb-meta-info">
                  <strong>${mbName}</strong>
                  <span>${mbVehicle}</span>
                </div>
              </div>
              <div class="mb-eta-pill" id="customer-eta-pill">
                <i class="fa-solid fa-clock"></i> <span id="customer-eta-text">Calculando trajeto...</span>
              </div>
            `;
            motoboyInfoCard.style.display = "flex";
          }

          if (radarSection) radarSection.style.display = "block";
        } else {
          // Retirada no balcão
          if (descBox) {
            descBox.innerHTML = `
              <div class="track-desc-title"><i class="fa-solid fa-store" style="color: #10b981;"></i> Pedido Pronto para Retirada!</div>
              <p>Seus salgados estão prontos e embalados quentinhos aguardando você na nossa loja: <strong>Rua Isabel Pedrosa, 31, Da Luz, Nova Iguaçu</strong>.</p>
            `;
          }
          if (radarSection) radarSection.style.display = "none";
          if (motoboyInfoCard) motoboyInfoCard.style.display = "none";
        }
      } else if (curStatus === "finalizado") {
        stNovo?.classList.add("completed");
        stPrep?.classList.add("completed");
        stPronto?.classList.add("completed");
        stEntregue?.classList.add("completed");

        if (descBox) {
          descBox.innerHTML = `
            <div class="track-desc-title"><i class="fa-solid fa-champagne-glasses" style="color: #10b981;"></i> Pedido Entregue! Bom Apetite!</div>
            <p>Obrigado pela preferência! Esperamos que aprecie cada salgadinho feito com amor pela Salgados VIP.</p>
          `;
        }
        if (radarSection) radarSection.style.display = "none";
        if (motoboyInfoCard) motoboyInfoCard.style.display = "none";
      }

      // Resumo dos Itens do Pedido
      const itemsContainer = document.getElementById("track-modal-items-summary");
      if (itemsContainer && order.items) {
        itemsContainer.innerHTML = order.items.map(item => {
          let name = item.name || item.kitName || "Item";
          let qtd = item.quantity || 1;
          let price = (Number(item.finalPrice) || Number(item.price) || 0);
          return `<div class="track-order-item-row">
            <span>${qtd}x ${name}</span>
            <strong>R$ ${(price).toFixed(2).replace('.', ',')}</strong>
          </div>`;
        }).join("");
      }

      // Total e Pagamento
      const totalAmountEl = document.getElementById("track-modal-total-amount");
      if (totalAmountEl) {
        totalAmountEl.textContent = `R$ ${(Number(order.totalAmount) || 0).toFixed(2).replace('.', ',')}`;
      }

      const payMethodEl = document.getElementById("track-modal-payment-method");
      if (payMethodEl) {
        payMethodEl.textContent = order.paymentMethod || "Não informado";
      }

      // Botão de Contato com a Loja no WhatsApp
      const waLojaBtn = document.getElementById("track-modal-wa-loja-btn");
      if (waLojaBtn && window.VIPMotoboyTracker) {
        const msg = `Olá Salgados VIP! Gostaria de informações sobre o meu Pedido #${order.id}.`;
        waLojaBtn.href = window.VIPMotoboyTracker.buildStoreWhatsAppUrl(null, order.id, msg);
      }
    },

    /**
     * Inicializa ou atualiza o mini-mapa Leaflet com a moto em movimento
     */
    async initOrUpdateRadarMap() {
      const mapEl = document.getElementById("customer-mini-radar-map");
      if (!mapEl || !_activeOrder) return;

      const storeCoords = window.VIPMotoboyTracker?.STORE_COORDS || { lat: -22.75735, lng: -43.47254 };

      if (!_customerMap) {
        _customerMap = L.map("customer-mini-radar-map", {
          center: [storeCoords.lat, storeCoords.lng],
          zoom: 14,
          zoomControl: false,
          attributionControl: false
        });

        // Camada de mapa 100% gratuita OpenStreetMap sem exigir API Key
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap contributors"
        }).addTo(_customerMap);

        setTimeout(() => { if (_customerMap) _customerMap.invalidateSize(); }, 200);

        // Marcador da Cozinha
        const storeIcon = L.divIcon({
          className: "store-marker",
          html: `<div style="background: #b91c1c; color: #fff; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; border: 2px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.5);"><i class="fa-solid fa-store"></i></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });
        _customerStoreMarker = L.marker([storeCoords.lat, storeCoords.lng], { icon: storeIcon })
          .bindPopup("<strong>🏠 Cozinha Salgados VIP</strong>")
          .addTo(_customerMap);
      } else {
        setTimeout(() => _customerMap.invalidateSize(), 150);
      }

      // Geocodifica destino do cliente
      let destLat = _activeOrder.deliveryCoords?.lat;
      let destLng = _activeOrder.deliveryCoords?.lng;

      if ((!destLat || !destLng) && window.VIPMotoboyTracker && _activeOrder.customer?.address) {
        const geo = await window.VIPMotoboyTracker.geocodeAddress(_activeOrder.customer.address);
        if (geo) {
          destLat = geo.lat;
          destLng = geo.lng;
        }
      }

      if (!destLat || !destLng) {
        destLat = storeCoords.lat - 0.012;
        destLng = storeCoords.lng + 0.010;
      }

      if (!_customerDestMarker) {
        const destIcon = L.divIcon({
          className: "dest-marker",
          html: `<div style="background: #ef4444; color: #fff; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; border: 2px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.5);"><i class="fa-solid fa-house-chimney"></i></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30]
        });
        _customerDestMarker = L.marker([destLat, destLng], { icon: destIcon })
          .bindPopup("<strong>📍 Sua Casa</strong>")
          .addTo(_customerMap);
      } else {
        _customerDestMarker.setLatLng([destLat, destLng]);
      }

      // Conecta ao transmissor do motoboy usando subscribeOrderDeliveryLocation
      const motoboyId = _activeOrder.deliveryMan?.id || _activeOrder.delivery_man?.id;
      if (window.VIPMotoboyTracker) {
        if (_motoboySubscription) {
          _motoboySubscription.unsubscribe();
        }

        _motoboySubscription = window.VIPMotoboyTracker.subscribeOrderDeliveryLocation(_activeOrderId, motoboyId, (locData) => {
          if (!locData || !locData.latitude) return;
          this.updateCustomerMotoboyPosition(locData, { lat: destLat, lng: destLng });
        });
      }
    },

    /**
     * Atualiza a posição da moto no mapa do cliente com suavidade e sem travar a interface
     */
    async updateCustomerMotoboyPosition(locData, destCoords) {
      if (!_customerMap || !locData) return;

      const lat = locData.latitude;
      const lng = locData.longitude;
      const heading = locData.heading || 0;

      // 1. Move o marcador de moto instantaneamente
      const bikeHtml = `<div class="bike-icon-inner" style="transform: rotate(${heading}deg);"><i class="fa-solid fa-motorcycle"></i></div>`;

      if (!_customerMotoboyMarker) {
        const bikeIcon = L.divIcon({
          className: "motoboy-bike-marker",
          html: bikeHtml,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });
        _customerMotoboyMarker = L.marker([lat, lng], { icon: bikeIcon }).addTo(_customerMap);
        _customerMotoboyMarker.bindPopup(`<strong>🛵 Seu Pedido está a caminho!</strong>`);
      } else {
        _customerMotoboyMarker.setLatLng([lat, lng]);
        const iconEl = _customerMotoboyMarker.getElement();
        if (iconEl) {
          const inner = iconEl.querySelector(".bike-icon-inner");
          if (inner) inner.style.transform = `rotate(${heading}deg)`;
        }
      }

      // 2. Calcula ou atualiza o trajeto e ETA com desacoplamento inteligente
      const now = Date.now();
      const distFromLastCalc = _lastRouteCalcCoords ? haversineMeters(_lastRouteCalcCoords.lat, _lastRouteCalcCoords.lng, lat, lng) : 999;
      const shouldRecalcRoute = (!_customerRoutePolyline || (now - _lastRouteCalcTime > 12000) || distFromLastCalc > 80);

      if (window.VIPMotoboyTracker && destCoords && shouldRecalcRoute) {
        _lastRouteCalcTime = now;
        _lastRouteCalcCoords = { lat, lng };

        const waypoints = locData.route_waypoints || [];
        const routeData = await window.VIPMotoboyTracker.calculateRoute({ lat, lng }, destCoords, waypoints);

        if (routeData && routeData.coordinates && routeData.coordinates.length > 0) {
          if (_customerRoutePolyline) _customerMap.removeLayer(_customerRoutePolyline);

          _customerRoutePolyline = L.polyline(routeData.coordinates, {
            color: "#10b981",
            weight: 5,
            opacity: 0.9,
            dashArray: "8, 6"
          }).addTo(_customerMap);

          // Enquadra a rota no zoom apenas na primeira vez para não sacudir o mapa do cliente
          if (!_hasFitRouteBounds) {
            _customerMap.fitBounds(_customerRoutePolyline.getBounds(), { padding: [30, 30] });
            _hasFitRouteBounds = true;
          }

          const etaText = document.getElementById("customer-eta-text");
          if (etaText) {
            etaText.textContent = `Chegando em ~${routeData.durationMin} min (${routeData.distanceKm} km)`;
          }
        }
      } else if (destCoords && _lastRouteCalcCoords) {
        // Atualiza a estimativa de distância restante de forma linear sem requisição OSRM
        const remainingM = haversineMeters(lat, lng, destCoords.lat, destCoords.lng) * 1.25;
        const remainingKm = Math.round((remainingM / 1000) * 10) / 10;
        const estMin = Math.max(1, Math.round(remainingKm * 2.5));
        const etaText = document.getElementById("customer-eta-text");
        if (etaText && etaText.textContent.includes("Calculando")) {
          etaText.textContent = `Chegando em ~${estMin} min (${remainingKm} km)`;
        }
      }
    }
  };

  window.VIPCustomerTracker = VIPCustomerTracker;

  // Auto-inicialização quando o DOM estiver pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => VIPCustomerTracker.init());
  } else {
    VIPCustomerTracker.init();
  }

})(window);