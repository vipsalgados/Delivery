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
  // 1. AUTENTICAÇÃO DO MOTOBOY (LOGIN = NOME, SENHA = PLACA DA MOTO)
  // ============================================================================
  function getMotoboyAuthSession() {
    try {
      const raw = sessionStorage.getItem("vip_motoboy_auth") || localStorage.getItem("vip_motoboy_auth");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.id) return parsed;
      }
    } catch (e) {}
    return null;
  }

  function showLoginView() {
    const loginOverlay = document.getElementById("motoboy-login-view");
    const mainView = document.getElementById("motoboy-main-view");
    const navTabs = document.getElementById("motoboy-nav-tabs");
    const gpsBar = document.getElementById("gps-action-bar");
    const gpsPill = document.getElementById("gps-status-pill");
    const logoutBtn = document.getElementById("btn-motoboy-logout");
    const profileLabel = document.getElementById("motoboy-profile-label");

    if (loginOverlay) loginOverlay.style.display = "flex";
    if (mainView) mainView.style.display = "none";
    if (navTabs) navTabs.style.display = "none";
    if (gpsBar) gpsBar.style.display = "none";
    if (gpsPill) gpsPill.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (profileLabel) profileLabel.textContent = "Acesso do Entregador";

    // Pré-preenche o nome se houver parâmetro na URL
    const nameInput = document.getElementById("mb-login-name");
    const passInput = document.getElementById("mb-login-pass");

    if (nameInput && !nameInput.value) {
      if (paramMotoboyId && window.VIPDatabase && typeof window.VIPDatabase.getMotoboyById === "function") {
        const mb = window.VIPDatabase.getMotoboyById(paramMotoboyId);
        if (mb && mb.name) nameInput.value = mb.name;
      }
    }

    setTimeout(() => {
      if (nameInput && !nameInput.value) nameInput.focus();
      else if (passInput) passInput.focus();
    }, 200);
  }

  window.handleMotoboyLoginSubmit = async function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const nameInput = document.getElementById("mb-login-name");
    const passInput = document.getElementById("mb-login-pass");
    const errBox = document.getElementById("mb-login-error");
    const errText = document.getElementById("mb-login-error-text");
    const submitBtn = document.getElementById("btn-login-submit");

    const nameVal = nameInput ? nameInput.value.trim() : "";
    const passVal = passInput ? passInput.value.trim() : "";

    if (!nameVal || !passVal) {
      if (errBox) errBox.style.display = "flex";
      if (errText) errText.textContent = "Por favor, digite seu nome e a placa da sua moto.";
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verificando...`;
    }
    if (errBox) errBox.style.display = "none";

    try {
      let authRes = null;
      if (window.VIPDeliveryMenDB && typeof window.VIPDeliveryMenDB.authenticateCloud === "function") {
        authRes = await window.VIPDeliveryMenDB.authenticateCloud(nameVal, passVal);
      } else if (window.VIPDeliveryMenDB && typeof window.VIPDeliveryMenDB.authenticate === "function") {
        authRes = window.VIPDeliveryMenDB.authenticate(nameVal, passVal);
      }

      if (authRes && authRes.success && authRes.motoboy) {
        const mb = authRes.motoboy;
        try {
          const sessionObj = {
            id: mb.id,
            name: mb.name,
            phone: mb.phone,
            vehicle: mb.vehicle,
            plate: mb.plate || "",
            dailyRate: mb.dailyRate,
            defaultFee: mb.defaultFee,
            workDays: mb.workDays,
            pixKey: mb.pixKey,
            pixType: mb.pixType,
            active: mb.active,
            loggedAt: Date.now()
          };
          localStorage.setItem("vip_motoboy_auth", JSON.stringify(sessionObj));
          sessionStorage.setItem("vip_motoboy_auth", JSON.stringify(sessionObj));
          localStorage.setItem("vip_active_motoboy_id", mb.id);
        } catch (err) {}

        await startMotoboyApp(mb);
      } else {
        if (errBox) errBox.style.display = "flex";
        if (errText) errText.textContent = authRes?.message || "Nome ou placa da moto incorretos. Verifique com a loja.";
      }
    } catch (err) {
      console.error("Erro na autenticação do motoboy:", err);
      if (errBox) errBox.style.display = "flex";
      if (errText) errText.textContent = "Erro ao autenticar. Verifique sua conexão com a internet.";
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Entrar no Meu Perfil`;
      }
    }
  };

  window.handleMotoboyLogout = function () {
    if (!confirm("Deseja sair do seu perfil de entregador?")) return;

    if (window.VIPMotoboyTracker) {
      window.VIPMotoboyTracker.stopTransmitter().catch(() => {});
    }

    try {
      localStorage.removeItem("vip_motoboy_auth");
      sessionStorage.removeItem("vip_motoboy_auth");
      localStorage.removeItem("vip_active_motoboy_id");
    } catch (e) {}

    currentMotoboy = null;
    showLoginView();
  };

  // ============================================================================
  // 2. INICIALIZAÇÃO DA APLICAÇÃO LOGADA
  // ============================================================================
  document.addEventListener("DOMContentLoaded", async () => {
    // 1. Inicializa bancos e sincroniza entregadores
    if (window.VIPDatabase && typeof window.VIPDatabase.initSupabase === "function") {
      await window.VIPDatabase.initSupabase().catch(() => {});
    }
    if (window.VIPDeliveryMenDB && typeof window.VIPDeliveryMenDB.syncFromCloud === "function") {
      await window.VIPDeliveryMenDB.syncFromCloud().catch(() => {});
    }

    // 2. Checagem de sessão de autenticação
    const authSession = getMotoboyAuthSession();
    if (!authSession) {
      showLoginView();
      return;
    }

    // 3. Inicializa o painel do entregador autenticado
    await startMotoboyApp(authSession);
  });

  async function startMotoboyApp(authMb) {
    currentMotoboy = authMb;

    // Atualiza com dados mais frescos do banco se disponíveis
    if (window.VIPDeliveryMenDB && typeof window.VIPDeliveryMenDB.getById === "function") {
      const fresh = window.VIPDeliveryMenDB.getById(authMb.id);
      if (fresh) currentMotoboy = fresh;
    }

    // Mostra elementos visuais do app
    const loginOverlay = document.getElementById("motoboy-login-view");
    const mainView = document.getElementById("motoboy-main-view");
    const navTabs = document.getElementById("motoboy-nav-tabs");
    const gpsBar = document.getElementById("gps-action-bar");
    const gpsPill = document.getElementById("gps-status-pill");
    const logoutBtn = document.getElementById("btn-motoboy-logout");
    const profileLabel = document.getElementById("motoboy-profile-label");

    if (loginOverlay) loginOverlay.style.display = "none";
    if (mainView) mainView.style.display = "block";
    if (navTabs) navTabs.style.display = "flex";
    if (gpsBar) gpsBar.style.display = "flex";
    if (gpsPill) gpsPill.style.display = "flex";
    if (logoutBtn) logoutBtn.style.display = "inline-flex";

    if (profileLabel) {
      const plateText = currentMotoboy.plate ? ` • [${currentMotoboy.plate}]` : "";
      profileLabel.textContent = `${currentMotoboy.name}${plateText}`;
    }

    // Identifica o pedido ativo
    await loadActiveOrder();

    // Inicializa o mapa Leaflet
    await initLeafletMap();

    // Inicia o transmissor de GPS
    startGpsTracking();

    // Renderiza o card do motoboy em modo somente leitura
    renderMotoboyProfileCard();
  }

  // Alternador de Abas (Entregas vs Meu Perfil / Card)
  window.switchMotoboyTab = function (tabName) {
    const btnDeliveries = document.getElementById("tab-btn-deliveries");
    const btnProfile = document.getElementById("tab-btn-profile");
    const paneDeliveries = document.getElementById("pane-tab-deliveries");
    const paneProfile = document.getElementById("pane-tab-profile");
    const gpsBar = document.getElementById("gps-action-bar");

    if (tabName === "profile") {
      btnDeliveries?.classList.remove("active");
      btnProfile?.classList.add("active");
      if (paneDeliveries) paneDeliveries.style.display = "none";
      if (paneProfile) paneProfile.style.display = "block";
      if (gpsBar) gpsBar.style.display = "none";
      renderMotoboyProfileCard();
    } else {
      btnProfile?.classList.remove("active");
      btnDeliveries?.classList.add("active");
      if (paneProfile) paneProfile.style.display = "none";
      if (paneDeliveries) paneDeliveries.style.display = "block";
      if (gpsBar) gpsBar.style.display = "flex";
      if (leafletMap) {
        setTimeout(() => leafletMap.invalidateSize(), 150);
      }
    }
  };

  function normalizeOrder(raw) {
    if (!raw) return null;
    return {
      ...raw,
      id: String(raw.id || raw.order_id || ""),
      orderId: String(raw.order_id || raw.id || ""),
      deliveryMan: raw.deliveryMan || raw.delivery_man || null,
      deliveryCoords: raw.deliveryCoords || raw.delivery_coords || null,
      customer: raw.customer || {},
      paymentMethod: raw.paymentMethod || raw.payment_method || "Não informado",
      cashChangeFor: raw.cashChangeFor || raw.cash_change_for || null,
      totalAmount: Number(raw.totalAmount ?? raw.total_amount ?? 0),
      status: String(raw.status || "pronto").toLowerCase()
    };
  }

  // ============================================================================
  // 2. CARREGAMENTO DO MOTOBOY & PEDIDO
  // ============================================================================
  async function loadMotoboyProfile() {
    let mb = null;
    const effectiveMbId = paramMotoboyId || localStorage.getItem("vip_active_motoboy_id");

    if (effectiveMbId && window.VIPDatabase && typeof window.VIPDatabase.getMotoboyById === "function") {
      mb = window.VIPDatabase.getMotoboyById(effectiveMbId);
    }

    // Busca no Supabase se não estiver no cache local
    if (!mb && effectiveMbId && window.VIPDatabase && typeof window.VIPDatabase.getSupabaseClient === "function") {
      const sb = window.VIPDatabase.getSupabaseClient();
      if (sb) {
        try {
          const { data } = await sb.from("delivery_men").select("*").eq("id", effectiveMbId).maybeSingle();
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

    // Se ainda não identificou, busca o primeiro motoboy cadastrado no sistema (ex: Jonathas)
    if (!mb && window.VIPDatabase && typeof window.VIPDatabase.getMotoboys === "function") {
      const allMb = window.VIPDatabase.getMotoboys();
      if (Array.isArray(allMb) && allMb.length > 0) {
        mb = allMb[0];
      }
    }

    if (!mb && window.VIPDatabase && typeof window.VIPDatabase.getSupabaseClient === "function") {
      const sb = window.VIPDatabase.getSupabaseClient();
      if (sb) {
        try {
          const { data } = await sb.from("delivery_men").select("*").order("created_at", { ascending: true }).limit(1).maybeSingle();
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
        id: "mb-1795449221667",
        name: "Jonathas",
        phone: "21986758102",
        vehicle: "Fluo",
        defaultFee: 6.00
      };
    }

    currentMotoboy = mb;
    try {
      localStorage.setItem("vip_active_motoboy_id", mb.id);
    } catch (e) {}

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
            if (data) order = normalizeOrder(data);
          } catch (e) {}
        }
      }
    }

    // 2. Se não foi passado pedido na URL, busca a corrida mais recente despachada para este motoboy
    if (!order && currentMotoboy && window.VIPDatabase && typeof window.VIPDatabase.getOrders === "function") {
      const allOrders = window.VIPDatabase.getOrders();
      order = allOrders.find(o =>
        o.fulfillment === "Entrega" &&
        (o.status === "pronto" || o.status === "preparando" || o.status === "em_preparo") &&
        (o.deliveryMan || o.delivery_man) &&
        String((o.deliveryMan?.id || o.delivery_man?.id)) === String(currentMotoboy.id)
      );
      if (order) order = normalizeOrder(order);
    }

    currentOrder = order ? normalizeOrder(order) : null;
    renderOrderView();
  }

  function renderOrderView() {
    const activeView = document.getElementById("active-order-view");
    const emptyView = document.getElementById("empty-state-view");

    const isEnded = !currentOrder ||
      currentOrder.status === "finalizado" ||
      currentOrder.status === "concluido" ||
      currentOrder.status === "cancelado";

    if (isEnded) {
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
  async function initLeafletMap() {
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

    // Camada de mapa 100% gratuita OpenStreetMap (sem exigência de API Key e sem custos)
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors"
    }).addTo(leafletMap);

    setTimeout(() => { if (leafletMap) leafletMap.invalidateSize(); }, 250);

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
    await resolveDestinationCoords();
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

    // Sincroniza destino na sessão ativa do transmissor
    if (window.VIPMotoboyTracker && typeof window.VIPMotoboyTracker.updateSessionDestination === "function") {
      window.VIPMotoboyTracker.updateSessionDestination(destinationCoords, currentOrder.customer?.address);
    }

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
    if (!window.VIPMotoboyTracker || !currentMotoboy) return;

    const gpsPill = document.getElementById("gps-status-pill");
    const gpsText = document.getElementById("gps-status-text");
    const actionBar = document.getElementById("gps-action-bar");
    const actionTitle = document.getElementById("gps-action-title");
    const actionSub = document.getElementById("gps-action-sub");
    const btnTrigger = document.getElementById("btn-gps-trigger");
    const iconEl = document.getElementById("gps-action-icon");

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

        // Atualiza status visual do GPS no header
        if (gpsPill) {
          gpsPill.className = "gps-status-pill";
          if (gpsText) {
            const speedText = data.speed > 0 ? ` • ${data.speed} km/h` : "";
            gpsText.textContent = `GPS Ativo${speedText}`;
          }
        }

        // Atualiza barra de controle do GPS
        if (actionBar) actionBar.classList.add("active");
        if (actionTitle) actionTitle.textContent = "GPS Transmitindo em Tempo Real";
        if (actionSub) {
          const spd = data.speed || 0;
          actionSub.textContent = `Sinal exato transmitido para a loja e cliente (${spd} km/h)`;
        }
        if (btnTrigger) {
          btnTrigger.classList.add("success");
          btnTrigger.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Atualizar Local`;
        }
        if (iconEl) iconEl.style.color = "#10b981";

        // Atualiza ou cria o marcador da moto no Leaflet com rotação de heading
        updateMotoboyMarker(data.latitude, data.longitude, data.heading);

        // Se estiver longe da rota, recalcula
        if (currentRouteMode === "auto" && destinationCoords) {
          recalculateRoute();
        }
      },
      onError: (err) => {
        if (gpsPill) {
          gpsPill.className = "gps-status-pill waiting";
          if (gpsText) gpsText.textContent = "Aguardando GPS...";
        }
        if (actionTitle) actionTitle.textContent = "Toque para Ativar GPS";
        if (actionSub) actionSub.textContent = "Permissão necessária no navegador para o radar da loja.";
        if (btnTrigger) {
          btnTrigger.classList.remove("success");
          btnTrigger.innerHTML = `<i class="fa-solid fa-location-arrow"></i> Ativar GPS`;
        }
      }
    });
  }

  window.handleManualGpsActivation = function() {
    if (!navigator.geolocation) {
      alert("Seu navegador ou dispositivo não possui suporte a GPS.");
      return;
    }

    const btnTrigger = document.getElementById("btn-gps-trigger");
    if (btnTrigger) btnTrigger.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Obtendo GPS...`;

    // Chamada explícita disparada por clique do motoboy (satisfaz políticas de permissão do navegador)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        startGpsTracking();
      },
      (err) => {
        console.warn("Aviso na ativação manual do GPS:", err);
        alert("Atenção: Por favor, permita o acesso à localização neste site para que seu radar funcione em tempo real com a loja.");
        startGpsTracking();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

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

    // 1. Atualiza status do pedido para 'concluido' no banco de dados e nuvem
    if (window.VIPDatabase && typeof window.VIPDatabase.updateOrderStatus === "function") {
      window.VIPDatabase.updateOrderStatus(orderId, "concluido");
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

  // ============================================================================
  // 8. CARD DO PERFIL DO MOTOBOY (100% SOMENTE LEITURA / VISUALIZAÇÃO)
  // ============================================================================
  function renderMotoboyProfileCard() {
    const container = document.getElementById("motoboy-profile-card-content");
    if (!container || !currentMotoboy) return;

    const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const currentDayIdx = new Date().getDay();
    const workDays = Array.isArray(currentMotoboy.workDays) && currentMotoboy.workDays.length > 0
      ? currentMotoboy.workDays
      : [0, 1, 2, 3, 4, 5, 6];

    // Corridas de hoje
    const orders = (window.VIPDatabase && typeof window.VIPDatabase.getOrders === "function")
      ? window.VIPDatabase.getOrders()
      : [];

    const todayStr = (function () {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();

    const todayRuns = orders.filter(o => {
      if (!o.createdAt || o.status === "cancelado") return false;
      const d = new Date(o.createdAt);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (dStr !== todayStr) return false;
      const mbId = o.deliveryMan?.id || o.delivery_man?.id;
      return mbId && String(mbId) === String(currentMotoboy.id);
    });

    let totalFees = 0;
    let totalCashCollected = 0;

    todayRuns.forEach(o => {
      const fee = Number(o.deliveryMan?.fee !== undefined ? o.deliveryMan.fee : (currentMotoboy.defaultFee || 7));
      totalFees += fee;
      const pay = String(o.paymentMethod || o.payment_method || "").toLowerCase();
      if (pay.includes("dinheiro") || pay.includes("especie") || pay.includes("espécie")) {
        totalCashCollected += Number(o.totalAmount || o.total_amount || 0);
      }
    });

    // Escala de dias da semana
    const workDaysHtml = [0, 1, 2, 3, 4, 5, 6].map(idx => {
      const isScheduled = workDays.includes(idx);
      const isToday = idx === currentDayIdx;
      let cls = "mb-day-chip";
      if (isScheduled) cls += " active";
      if (isToday) cls += " today";
      return `<span class="${cls}" title="${WEEKDAYS[idx]}: ${isScheduled ? 'Escalado p/ Entregas' : 'Folga'}">${WEEKDAYS[idx]}</span>`;
    }).join("");

    // Lista de corridas de hoje
    const runsListHtml = todayRuns.length === 0
      ? `<div style="text-align: center; padding: 18px 10px; color: #94a3b8; font-size: 0.8rem; font-style: italic;">Nenhuma corrida finalizada por você hoje ainda.</div>`
      : todayRuns.map(r => {
          const timeStr = r.createdAt ? new Date(r.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--";
          const feeVal = Number(r.deliveryMan?.fee !== undefined ? r.deliveryMan.fee : (currentMotoboy.defaultFee || 7));
          const isDone = (r.status === "concluido" || r.status === "finalizado");
          const statusBadge = isDone
            ? `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.7rem;">Entregue</span>`
            : `<span style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.7rem;">Em rota</span>`;

          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 0.82rem;">
              <div>
                <div style="font-weight: 700; color: #fff;">Pedido #${r.id} • ${timeStr}</div>
                <div style="color: #94a3b8; font-size: 0.72rem; margin-top: 2px;">${r.customer?.name || 'Cliente'} • ${r.paymentMethod || 'Pagamento'}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 800; color: #10b981;">+ R$ ${feeVal.toFixed(2).replace('.', ',')}</div>
                ${statusBadge}
              </div>
            </div>
          `;
        }).join("");

    const waLojaUrl = window.VIPMotoboyTracker
      ? window.VIPMotoboyTracker.buildStoreWhatsAppUrl(currentMotoboy.name, null, `Olá Salgados VIP! Aqui é o entregador ${currentMotoboy.name}.`)
      : `https://wa.me/5521986758102`;

    container.innerHTML = `
      <!-- Cabeçalho do Card -->
      <div class="mb-profile-header">
        <div class="mb-profile-avatar-wrap">
          <div class="mb-profile-avatar-icon">
            <i class="fa-solid fa-motorcycle"></i>
          </div>
          <div>
            <div class="mb-profile-name">${currentMotoboy.name}</div>
            <div class="mb-profile-vehicle">
              <i class="fa-solid fa-gauge-high"></i> ${currentMotoboy.vehicle || "Moto"}
            </div>
            <span class="mb-plate-badge" title="Sua placa e senha de acesso">
              <i class="fa-solid fa-key"></i> Placa / Senha: <strong>${currentMotoboy.plate || 'FLUO123'}</strong>
            </span>
          </div>
        </div>
        <div style="text-align: right;">
          <span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 10px; border-radius: 20px; font-size: 0.74rem; font-weight: 700;">
            ${currentMotoboy.active !== false ? '🟢 Conectado' : '⏸️ Em Pausa'}
          </span>
        </div>
      </div>

      <!-- Resumo Financeiro de Hoje (KPIs) -->
      <div class="mb-kpi-grid">
        <div class="mb-kpi-box">
          <span class="mb-kpi-val" style="color: #38bdf8;">${todayRuns.length}</span>
          <span class="mb-kpi-lbl">Corridas Hoje</span>
        </div>
        <div class="mb-kpi-box">
          <span class="mb-kpi-val" style="color: #10b981;">R$ ${totalFees.toFixed(2).replace('.', ',')}</span>
          <span class="mb-kpi-lbl">Taxas a Receber</span>
        </div>
        <div class="mb-kpi-box">
          <span class="mb-kpi-val" style="color: #f59e0b;">R$ ${totalCashCollected.toFixed(2).replace('.', ',')}</span>
          <span class="mb-kpi-lbl">Dinheiro em Mãos</span>
        </div>
      </div>

      <!-- Detalhes do Perfil Cadastrado -->
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 10px; padding: 12px; margin-bottom: 14px;">
        <div class="mb-detail-row">
          <span class="mb-detail-lbl"><i class="fa-solid fa-money-bill-transfer"></i> Diária Fixa Acordada:</span>
          <span class="mb-detail-val" style="color: #38bdf8;">R$ ${(Number(currentMotoboy.dailyRate) || 0).toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="mb-detail-row">
          <span class="mb-detail-lbl"><i class="fa-solid fa-tag"></i> Taxa Padrão por Corrida:</span>
          <span class="mb-detail-val" style="color: #10b981;">R$ ${(Number(currentMotoboy.defaultFee) || 7).toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="mb-detail-row">
          <span class="mb-detail-lbl"><i class="fa-solid fa-phone"></i> Telefone / WhatsApp:</span>
          <span class="mb-detail-val">${currentMotoboy.phone || 'Não informado'}</span>
        </div>
        <div class="mb-detail-row" style="flex-direction: column; align-items: flex-start; gap: 4px;">
          <span class="mb-detail-lbl"><i class="fa-solid fa-calendar-days"></i> Escala Semanal de Trabalho:</span>
          <div class="mb-workdays-row">${workDaysHtml}</div>
        </div>
      </div>

      <!-- Chave PIX Cadastrada -->
      ${currentMotoboy.pixKey ? `
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 10px; padding: 12px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-size: 0.72rem; color: #6ee7b7; font-weight: 700;">Chave PIX Cadastrada (${currentMotoboy.pixType || 'PIX'}):</div>
            <div style="font-size: 0.95rem; font-weight: 800; color: #fff; margin-top: 2px;">${currentMotoboy.pixKey}</div>
          </div>
          <button type="button" onclick="copyMotoboyPixKey('${currentMotoboy.pixKey}')" style="background: #10b981; color: #fff; border: none; border-radius: 6px; padding: 6px 12px; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
            <i class="fa-solid fa-copy"></i> Copiar
          </button>
        </div>
      ` : `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--card-border); border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; font-size: 0.8rem; color: #94a3b8;">
          <i class="fa-solid fa-info-circle"></i> Nenhuma chave PIX cadastrada. Informe à loja para receber seus repasses.
        </div>
      `}

      <!-- Extrato Detalhado de Corridas Hoje -->
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 10px; padding: 14px; margin-bottom: 14px;">
        <h4 style="font-size: 0.9rem; font-weight: 800; color: #fff; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
          <span><i class="fa-solid fa-receipt" style="color: #f59e0b;"></i> Corridas Realizadas Hoje</span>
          <span style="font-size: 0.72rem; color: #94a3b8;">${todayRuns.length} entrega(s)</span>
        </h4>
        <div style="display: flex; flex-direction: column;">
          ${runsListHtml}
        </div>
      </div>

      <!-- Botão de Contato com a Loja -->
      <div style="text-align: center; margin-top: 6px;">
        <a href="${waLojaUrl}" target="_blank" class="btn-contact" style="display: inline-flex; width: 100%; justify-content: center; padding: 12px; font-size: 0.88rem;">
          <i class="fa-brands fa-whatsapp" style="color: #25d366; font-size: 1.1rem;"></i> Falar com a Gerência da Loja
        </a>
      </div>
    `;
  }

  window.copyMotoboyPixKey = function (key) {
    if (!key) return;
    navigator.clipboard.writeText(key).then(() => {
      alert("Chave PIX copiada para a área de transferência!");
    }).catch(() => {
      prompt("Copie sua chave PIX abaixo:", key);
    });
  };

})();
