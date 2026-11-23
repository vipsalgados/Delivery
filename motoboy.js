/**
 * ==============================================================================
 * SALGADOS VIP - CONTROLE & NAVEGAÇÃO DO MOTOBOY (v65.0)
 * ==============================================================================
 * App PWA do entregador com transmissão de GPS em tempo real,
 * cálculo de rotas automáticas via OSRM e ajuste manual de trajetos.
 * ==============================================================================
 */

(function () {
  "use strict";

  // Estado da aplicação do entregador
  let currentMotoboy = null;
  let currentOrder = null;
  let motoboyCoords = null;
  let destinationCoords = null;
  let currentRouteMode = "auto"; // "auto" | "manual"
  let manualWaypoints = [];
  let waypointMarkers = [];

  // Instâncias Leaflet
  let leafletMap = null;
  let motoboyMarker = null;
  let storeMarker = null;
  let destMarker = null;
  let routePolyline = null;

  // Parâmetros da URL
  const urlParams = new URLSearchParams(window.location.search);
  const paramMotoboyId = urlParams.get("id") || urlParams.get("motoboyId");
  const paramOrderId = urlParams.get("order") || urlParams.get("orderId");

  // ============================================================================
  // 1. INICIALIZAÇÃO
  // ============================================================================
  document.addEventListener("DOMContentLoaded", async () => {
    // 1. Inicializa banco Supabase
    if (window.VIPDatabase && typeof window.VIPDatabase.initSupabase === "function") {
      await window.VIPDatabase.initSupabase().catch(() => {});
    }

    // 2. Identifica o entregador
    await loadMotoboyProfile();

    // 3. Identifica o pedido ativo
    await loadActiveOrder();

    // 4. Inicializa o mapa Leaflet
    initLeafletMap();

    // 5. Inicia o transmissor de GPS
    startGpsTracking();
  });

  // ============================================================================
  // 2. CARREGAMENTO DO MOTOBOY & PEDIDO
  // ============================================================================
  async function loadMotoboyProfile() {
    let mb = null;

    if (paramMotoboyId && window.VIPDatabase && typeof window.VIPDatabase.getMotoboyById === "function") {
      mb = window.VIPDatabase.getMotoboyById(paramMotoboyId);
    }

    // Busca no Supabase se não estiver no cache local
    if (!mb && paramMotoboyId && window.VIPDatabase && typeof window.VIPDatabase.getSupabaseClient === "function") {
      const sb = window.VIPDatabase.getSupabaseClient();
      if (sb) {
        try {
          const { data } = await sb.from("delivery_men").select("*").eq("id", paramMotoboyId).maybeSingle();
          if (data) {
            mb = {
              id: data.id,
              name: data.name,
              phone: data.phone,
              vehicle: data.vehicle,
              defaultFee: Number(data.default_fee) || 7
            };
          }
        } catch (e) {}
      }
    }

    if (!mb) {
      mb = {
        id: paramMotoboyId || "mb-1",
        name: "Entregador VIP",
        phone: "(21) 98123-4567",
        vehicle: "Moto",
        defaultFee: 7.00
      };
    }

    currentMotoboy = mb;
    const profileLabel = document.getElementById("motoboy-profile-label");
    if (profileLabel) {
      profileLabel.textContent = `${mb.name} • ${mb.vehicle || 'Moto'}`;
    }
  }

  async function loadActiveOrder() {
    let order = null;

    // 1. Busca por ID informado na URL
    if (paramOrderId) {
      const orders = (window.VIPDatabase && typeof window.VIPDatabase.getOrders === "function")
        ? window.VIPDatabase.getOrders()
        : [];
      order = orders.find(o => String(o.id) === String(paramOrderId));

      // Se não achou localmente, consulta direto na tabela orders do Supabase
      if (!order && window.VIPDatabase && typeof window.VIPDatabase.getSupabaseClient === "function") {
        const sb = window.VIPDatabase.getSupabaseClient();
        if (sb) {
          try {
            const { data } = await sb.from("orders").select("*").eq("id", paramOrderId).maybeSingle();
            if (data) order = data;
          } catch (e) {}
        }
      }
    }

    // 2. Se não foi passado pedido na URL, busca a corrida mais recente despachada para este motoboy
    if (!order && currentMotoboy && window.VIPDatabase && typeof window.VIPDatabase.getOrders === "function") {
      const allOrders = window.VIPDatabase.getOrders();
      order = allOrders.find(o =>
        o.fulfillment === "Entrega" &&
        (o.status === "pronto" || o.status === "preparando") &&
        o.deliveryMan &&
        String(o.deliveryMan.id) === String(currentMotoboy.id)
      );
    }

    currentOrder = order;
    renderOrderView();
  }

  function renderOrderView() {
    const activeView = document.getElementById("active-order-view");
    const emptyView = document.getElementById("empty-state-view");

    if (!currentOrder || currentOrder.status === "finalizado" || currentOrder.status === "cancelado") {
      if (activeView) activeView.style.display = "none";
      if (emptyView) emptyView.style.display = "block";
      const waLojaEmpty = document.getElementById("link-wa-loja-empty");
      if (waLojaEmpty && window.VIPMotoboyTracker) {
        waLojaEmpty.href = window.VIPMotoboyTracker.buildStoreWhatsAppUrl(currentMotoboy?.name, null);
      }
      return;
    }

    if (activeView) activeView.style.display = "block";
    if (emptyView) emptyView.style.display = "none";

    // Tags do pedido
    const idTag = document.getElementById("order-id-tag");
    if (idTag) idTag.innerHTML = `<i class="fa-solid fa-box"></i> Pedido #${currentOrder.id}`;

    const feeVal = currentOrder.deliveryMan?.fee !== undefined
      ? Number(currentOrder.deliveryMan.fee)
      : (currentMotoboy?.defaultFee || 7.00);
    const feeBadge = document.getElementById("motoboy-fee-badge");
    if (feeBadge) feeBadge.textContent = `Sua Taxa: R$ ${feeVal.toFixed(2).replace('.', ',')}`;

    // Dados do Cliente
    const custName = document.getElementById("cust-name-display");
    if (custName) {
      custName.innerHTML = `<i class="fa-solid fa-user-circle" style="color: #38bdf8;"></i> ${currentOrder.customer?.name || 'Cliente VIP'}`;
    }

    const custAddr = document.getElementById("cust-address-display");
    if (custAddr) {
      custAddr.innerHTML = `<i class="fa-solid fa-location-dot"></i> <span>${currentOrder.customer?.address || 'Nova Iguaçu - RJ'}</span>`;
    }

    // Informação de Pagamento e Troco
    const custPay = document.getElementById("cust-payment-display");
    if (custPay) {
      let payText = `Pagamento: <strong>${currentOrder.paymentMethod || 'Dinheiro/Cartão'}</strong> • Total: <strong>R$ ${(Number(currentOrder.totalAmount) || 0).toFixed(2).replace('.', ',')}</strong>`;
      if (currentOrder.cashChangeFor) {
        payText += ` • <span style="color: #ef4444; font-weight: 800;">LEVAR TROCO PARA ${currentOrder.cashChangeFor}</span>`;
      }
      custPay.innerHTML = `<i class="fa-solid fa-money-bill-wave"></i> <span>${payText}</span>`;
    }

    // Links de Contato WhatsApp
    const waCliente = document.getElementById("link-wa-cliente");
    if (waCliente && window.VIPMotoboyTracker && currentOrder.customer?.phone) {
      waCliente.href = window.VIPMotoboyTracker.buildCustomerWhatsAppUrl(currentOrder.customer.phone, currentOrder.id, currentMotoboy?.name);
    }

    const waLoja = document.getElementById("link-wa-loja");
    if (waLoja && window.VIPMotoboyTracker) {
      waLoja.href = window.VIPMotoboyTracker.buildStoreWhatsAppUrl(currentMotoboy?.name, currentOrder.id);
    }
  }

  // ============================================================================
  // 3. MAPA LEAFLET & ROTA AUTOMÁTICA / MANUAL
  // ============================================================================
  function initLeafletMap() {
    const mapEl = document.getElementById("motoboy-live-map");
    if (!mapEl || leafletMap) return;

    const storeCoords = window.VIPMotoboyTracker?.STORE_COORDS || { lat: -22.75735, lng: -43.47254 };

    // Cria o mapa centrado na loja inicialmente
    leafletMap = L.map("motoboy-live-map", {
      center: [storeCoords.lat, storeCoords.lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false
    });

    // Camada de Tiles escura e de alto contraste
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19
    }).addTo(leafletMap);

    // Marcador da Loja (Base)
    const storeIcon = L.divIcon({
      className: "store-map-marker",
      html: `<div style="background: #b91c1c; color: #fff; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; border: 2px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.5);"><i class="fa-solid fa-store"></i></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
    storeMarker = L.marker([storeCoords.lat, storeCoords.lng], { icon: storeIcon })
      .bindPopup("<strong>🏠 Salgados VIP (Cozinha)</strong><br>Rua Isabel Pedrosa, 31")
      .addTo(leafletMap);

    // Listener de cliques para modo manual de rota
    leafletMap.on("click", onMapClickManualRoute);

    // Geocodifica e adiciona marcador do destino do cliente
    resolveDestinationCoords();
  }

  async function resolveDestinationCoords() {
    if (!currentOrder || !currentOrder.customer) return;

    const storeCoords = window.VIPMotoboyTracker?.STORE_COORDS || { lat: -22.75735, lng: -43.47254 };
    let destLat = null;
    let destLng = null;

    // 1. Tenta obter do pedido ou geocodificar
    if (currentOrder.deliveryCoords && currentOrder.deliveryCoords.lat) {
      destLat = currentOrder.deliveryCoords.lat;
      destLng = currentOrder.deliveryCoords.lng;
    } else if (window.VIPMotoboyTracker) {
      const geo = await window.VIPMotoboyTracker.geocodeAddress(currentOrder.customer.address);
      if (geo) {
        destLat = geo.lat;
        destLng = geo.lng;
      }
    }

    // Fallback se não conseguir geocodificar: usa raio de 2.5km próximo à loja
    if (!destLat || !destLng) {
      destLat = storeCoords.lat - 0.015;
      destLng = storeCoords.lng + 0.012;
    }

    destinationCoords = { lat: destLat, lng: destLng };

    // Atualiza links Waze e Google Maps
    updateExternalNavLinks(destLat, destLng, currentOrder.customer?.address);

    // Cria/atualiza marcador de destino
    if (leafletMap) {
      const destIcon = L.divIcon({
        className: "dest-map-marker",
        html: `<div style="background: #ef4444; color: #fff; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; border: 2px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.5);"><i class="fa-solid fa-location-dot"></i></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 34]
      });

      if (destMarker) leafletMap.removeLayer(destMarker);
      destMarker = L.marker([destLat, destLng], { icon: destIcon })
        .bindPopup(`<strong>📍 Destino do Pedido</strong><br>${currentOrder.customer?.address || ''}`)
        .addTo(leafletMap);

      // Traça rota automática inicial
      recalculateRoute();
    }
  }

  function updateExternalNavLinks(lat, lng, address) {
    if (!window.VIPMotoboyTracker) return;
    const links = window.VIPMotoboyTracker.buildNavigationLinks(lat, lng, address);

    const wazeEl = document.getElementById("link-waze");
    if (wazeEl) wazeEl.href = links.waze;

    const gmapsEl = document.getElementById("link-gmaps");
    if (gmapsEl) gmapsEl.href = links.googleMaps;
  }

  // ============================================================================
  // 4. CÁLCULO E ATUALIZAÇÃO DA ROTA (OSRM)
  // ============================================================================
  async function recalculateRoute() {
    if (!leafletMap || !destinationCoords || !window.VIPMotoboyTracker) return;

    const startCoords = motoboyCoords || window.VIPMotoboyTracker.STORE_COORDS;
    const waypoints = (currentRouteMode === "manual") ? manualWaypoints : [];

    const routeData = await window.VIPMotoboyTracker.calculateRoute(startCoords, destinationCoords, waypoints);
    if (!routeData || !routeData.coordinates || routeData.coordinates.length === 0) return;

    // Atualiza a linha azul da rota no Leaflet
    if (routePolyline) leafletMap.removeLayer(routePolyline);

    routePolyline = L.polyline(routeData.coordinates, {
      color: "#2563eb",
      weight: 6,
      opacity: 0.9,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(leafletMap);

    // Ajusta o zoom do mapa para caber toda a rota
    leafletMap.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });

    // Atualiza o crachá de ETA (tempo e km)
    const timeVal = document.getElementById("eta-time-val");
    if (timeVal) timeVal.textContent = `${routeData.durationMin} min`;

    const distVal = document.getElementById("eta-dist-val");
    if (distVal) distVal.textContent = `${routeData.distanceKm} km`;

    // Sincroniza waypoints com Supabase se estiver em modo manual
    if (currentRouteMode === "manual") {
      window.VIPMotoboyTracker.updateActiveWaypoints(manualWaypoints);
    }
  }

  // ============================================================================
  // 5. AJUSTE MANUAL DE ROTA (WAYPOINTS ARRASTÁVEIS)
  // ============================================================================
  window.setRouteMode = function (mode) {
    currentRouteMode = mode;
    const btnAuto = document.getElementById("btn-mode-auto");
    const btnManual = document.getElementById("btn-mode-manual");
    const hint = document.getElementById("manual-mode-hint");

    if (mode === "manual") {
      btnAuto?.classList.remove("active");
      btnManual?.classList.add("active");
      if (hint) hint.style.display = "flex";
    } else {
      btnManual?.classList.remove("active");
      btnAuto?.classList.add("active");
      if (hint) hint.style.display = "none";
      resetToAutoRoute();
    }
  };

  function onMapClickManualRoute(e) {
    if (currentRouteMode !== "manual") return;

    const newPt = {
      lat: Number(e.latlng.lat.toFixed(6)),
      lng: Number(e.latlng.lng.toFixed(6)),
      name: `Desvio ${manualWaypoints.length + 1}`
    };

    manualWaypoints.push(newPt);
    renderWaypointMarkers();
    recalculateRoute();
  }

  function renderWaypointMarkers() {
    // Limpa marcadores anteriores
    waypointMarkers.forEach(m => leafletMap.removeLayer(m));
    waypointMarkers = [];

    manualWaypoints.forEach((pt, index) => {
      const num = index + 1;
      const wpIcon = L.divIcon({
        className: "custom-wp-marker",
        html: `<div style="background: #f59e0b; color: #000; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; border: 2px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.5); cursor: grab;">${num}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([pt.lat, pt.lng], { icon: wpIcon, draggable: true }).addTo(leafletMap);

      // Ao arrastar o marcador, recalcula a rota em tempo real
      marker.on("dragend", (evt) => {
        const pos = evt.target.getLatLng();
        manualWaypoints[index].lat = Number(pos.lat.toFixed(6));
        manualWaypoints[index].lng = Number(pos.lng.toFixed(6));
        recalculateRoute();
      });

      // Ao clicar, opção para remover o ponto
      marker.on("click", () => {
        if (confirm(`Deseja remover o ponto de desvio ${num}?`)) {
          manualWaypoints.splice(index, 1);
          renderWaypointMarkers();
          recalculateRoute();
        }
      });

      waypointMarkers.push(marker);
    });
  }

  window.resetToAutoRoute = function () {
    manualWaypoints = [];
    renderWaypointMarkers();
    if (window.VIPMotoboyTracker) {
      window.VIPMotoboyTracker.updateActiveWaypoints([]);
    }
    recalculateRoute();
  };

  // ============================================================================
  // 6. TRANSMISSOR GPS EM TEMPO REAL
  // ============================================================================
  function startGpsTracking() {
    if (!window.VIPMotoboyTracker) return;

    const gpsPill = document.getElementById("gps-status-pill");
    const gpsText = document.getElementById("gps-status-text");

    window.VIPMotoboyTracker.startTransmitter({
      motoboyId: currentMotoboy.id,
      orderId: currentOrder?.id || null,
      motoboyName: currentMotoboy.name,
      phone: currentMotoboy.phone,
      destLat: destinationCoords?.lat,
      destLng: destinationCoords?.lng,
      destAddress: currentOrder?.customer?.address,
      onUpdate: (data) => {
        motoboyCoords = { lat: data.latitude, lng: data.longitude };

        // Atualiza status visual do GPS
        if (gpsPill) {
          gpsPill.className = "gps-status-pill";
          if (gpsText) {
            const speedText = data.speed > 0 ? ` • ${data.speed} km/h` : "";
            gpsText.textContent = `GPS Ativo${speedText}`;
          }
        }

        // Atualiza ou cria o marcador da moto no Leaflet com rotação de heading
        updateMotoboyMarker(data.latitude, data.longitude, data.heading);
      },
      onError: (err) => {
        if (gpsPill) {
          gpsPill.className = "gps-status-pill waiting";
          if (gpsText) gpsText.textContent = "Aguardando GPS...";
        }
      }
    });
  }

  function updateMotoboyMarker(lat, lng, heading) {
    if (!leafletMap) return;

    const rotDeg = heading || 0;
    const bikeHtml = `<div class="bike-icon-inner" style="transform: rotate(${rotDeg}deg);"><i class="fa-solid fa-motorcycle"></i></div>`;

    if (!motoboyMarker) {
      const bikeIcon = L.divIcon({
        className: "motoboy-bike-marker",
        html: bikeHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      motoboyMarker = L.marker([lat, lng], { icon: bikeIcon }).addTo(leafletMap);
      motoboyMarker.bindPopup(`<strong>🛵 ${currentMotoboy.name}</strong><br>Você está aqui`);
    } else {
      motoboyMarker.setLatLng([lat, lng]);
      const iconEl = motoboyMarker.getElement();
      if (iconEl) {
        const inner = iconEl.querySelector(".bike-icon-inner");
        if (inner) inner.style.transform = `rotate(${rotDeg}deg)`;
      }
    }
  }

  // ============================================================================
  // 7. CONFIRMAÇÃO DE ENTREGA REALIZADA
  // ============================================================================
  window.openFinishConfirmModal = function () {
    const modal = document.getElementById("confirm-modal-overlay");
    if (modal) modal.style.display = "flex";
  };

  window.closeFinishConfirmModal = function () {
    const modal = document.getElementById("confirm-modal-overlay");
    if (modal) modal.style.display = "none";
  };

  window.executeFinishDelivery = async function () {
    if (!currentOrder) return;

    const btn = document.getElementById("btn-confirm-delivery-action");
    if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Finalizando...`;

    const orderId = currentOrder.id;

    // 1. Atualiza status do pedido para 'finalizado' no banco de dados
    if (window.VIPDatabase && typeof window.VIPDatabase.updateOrderStatus === "function") {
      window.VIPDatabase.updateOrderStatus(orderId, "finalizado");
    }

    // 2. Encerra a transmissão do motoboy e libera o status
    if (window.VIPMotoboyTracker) {
      await window.VIPMotoboyTracker.stopTransmitter();
    }

    closeFinishConfirmModal();

    // 3. Atualiza a tela para o estado vazio
    currentOrder = null;
    renderOrderView();

    alert("🎉 Entrega confirmada com sucesso! Parabéns pelo atendimento com excelência!");
  };

})();
