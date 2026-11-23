/**
 * ==============================================================================
 * SALGADOS VIP - ACOMPANHAMENTO DE PEDIDOS & RADAR DO CLIENTE (v65.0)
 * ==============================================================================
 * Módulo para visualização intuitiva e em tempo real do status do pedido,
 * radar com mapa Leaflet do motoboy se aproximando, e botão flutuante de
 * fácil retorno à tela de acompanhamento caso o cliente feche o card.
 * ==============================================================================
 */

(function (window) {
  "use strict";

  const STORAGE_KEY_ACTIVE_ORDER = "salgados_vip_active_order_id";

  let _activeOrderId = null;
  let _activeOrder = null;
  let _motoboySubscription = null;
  let _customerMap = null;
  let _customerMotoboyMarker = null;
  let _customerStoreMarker = null;
  let _customerDestMarker = null;
  let _customerRoutePolyline = null;
  let _pollTimer = null;

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

  const VIPCustomerTracker = {
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
          _activeOrderId = last.id;
        }
      }

      // 3. Atualiza estado e interface
      await this.refreshActiveOrder();

      // 4. Polling suave de atualização de status (a cada 6 segundos)
      if (_pollTimer) clearInterval(_pollTimer);
      _pollTimer = setInterval(() => {
        if (_activeOrderId) {
          this.refreshActiveOrder(false);
        }
      }, 6000);

      // 5. Escuta evento de sincronização do Supabase
      window.addEventListener("vip_supabase_synced", () => {
        if (_activeOrderId) {
          this.refreshActiveOrder(false);
        }
      });
    },

    /**
     * Define um novo pedido ativo (chamado logo após finalizar a compra)
     * e abre o card de acompanhamento automaticamente
     */
    async setActiveOrder(orderId) {
      if (!orderId) return;
      _activeOrderId = String(orderId);
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_ORDER, _activeOrderId);
      } catch (e) {}

      await this.refreshActiveOrder(true);
      this.openTrackingModal();
    },

    /**
     * Atualiza os dados do pedido ativo do banco local ou Supabase
     */
    async refreshActiveOrder(shouldOpenModalOnFirstLoad = false) {
      if (!_activeOrderId) {
        this.hideFloatingButton();
        return;
      }

      let order = null;

      // 1. Busca em memória no VIPDatabase
      if (window.VIPDatabase && typeof window.VIPDatabase.getOrders === "function") {
        const orders = window.VIPDatabase.getOrders();
        order = orders.find(o => String(o.id) === String(_activeOrderId));
      }

      // 2. Se não encontrou, busca no Supabase
      if (!order) {
        const sb = getSupabase();
        if (sb) {
          try {
            const { data } = await sb.from("orders").select("*").eq("id", _activeOrderId).maybeSingle();
            if (data) order = data;
          } catch (e) {}
        }
      }

      if (!order) {
        return;
      }

      // Se o pedido já foi finalizado há mais de 30 minutos ou cancelado, remove status ativo
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
      try {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_ORDER);
      } catch (e) {}
      this.hideFloatingButton();
      this.closeTrackingModal();
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

      if (_activeOrder.status === "novo") {
        statusText = "Recebido na Cozinha";
        pulseColor = "#38bdf8";
      } else if (_activeOrder.status === "preparando") {
        statusText = "Fritando seus Salgadinhos";
        pulseColor = "#f59e0b";
      } else if (_activeOrder.status === "pronto") {
        statusText = _activeOrder.fulfillment === "Entrega" ? "🛵 Motoboy a Caminho!" : "Pronto para Retirada!";
        pulseColor = "#10b981";
      } else if (_activeOrder.status === "finalizado") {
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

      if (order.status === "novo") {
        stNovo?.classList.add("current");
        if (descBox) {
          descBox.innerHTML = `
            <div class="track-desc-title"><i class="fa-solid fa-clipboard-check" style="color: #38bdf8;"></i> Pedido Recebido com Sucesso!</div>
            <p>Seu pedido já foi registrado no sistema da Salgados VIP e entrou na fila de atendimento da cozinha.</p>
          `;
        }
        if (radarSection) radarSection.style.display = "none";
        if (motoboyInfoCard) motoboyInfoCard.style.display = "none";
      } else if (order.status === "preparando") {
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
      } else if (order.status === "pronto") {
        stNovo?.classList.add("completed");
        stPrep?.classList.add("completed");
        stPronto?.classList.add("current");

        if (order.fulfillment === "Entrega") {
          const mbName = order.deliveryMan?.name || "Entregador VIP";
          const mbVehicle = order.deliveryMan?.vehicle || "Moto";
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
      } else if (order.status === "finalizado") {
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

        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          maxZoom: 19
        }).addTo(_customerMap);

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

      // Conecta ao transmissor do motoboy
      const motoboyId = _activeOrder.deliveryMan?.id;
      if (motoboyId && window.VIPMotoboyTracker) {
        if (_motoboySubscription) {
          _motoboySubscription.unsubscribe();
        }

        _motoboySubscription = window.VIPMotoboyTracker.subscribeMotoboyLocation(motoboyId, (locData) => {
          if (!locData || !locData.latitude) return;
          this.updateCustomerMotoboyPosition(locData, { lat: destLat, lng: destLng });
        });
      }
    },

    /**
     * Atualiza a posição da moto no mapa do cliente e traça a rota
     */
    async updateCustomerMotoboyPosition(locData, destCoords) {
      if (!_customerMap || !locData) return;

      const lat = locData.latitude;
      const lng = locData.longitude;
      const heading = locData.heading || 0;

      // Marcador de Moto
      const bikeHtml = `<div class="bike-icon-inner" style="transform: rotate(${heading}deg);"><i class="fa-solid fa-motorcycle"></i></div>`;

      if (!_customerMotoboyMarker) {
        const bikeIcon = L.divIcon({
          className: "motoboy-bike-marker",
          html: bikeHtml,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
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

      // Calcula trajeto até a residência do cliente
      if (window.VIPMotoboyTracker && destCoords) {
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

          _customerMap.fitBounds(_customerRoutePolyline.getBounds(), { padding: [30, 30] });

          const etaText = document.getElementById("customer-eta-text");
          if (etaText) {
            etaText.textContent = `Chegando em ~${routeData.durationMin} min (${routeData.distanceKm} km)`;
          }
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
