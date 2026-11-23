/**
 * ==============================================================================
 * SALGADOS VIP - MÓDULO DE RASTREAMENTO & ROTAS DO MOTOBOY EM TEMPO REAL (v65.0)
 * ==============================================================================
 * Gerenciador centralizado de localização GPS, rotas automáticas OSRM,
 * alteração manual de trajetos e sincronização em tempo real via Supabase Realtime
 * e BroadcastChannel para Motoboy, Loja (ADM) e Cliente.
 * ==============================================================================
 */

(function (window) {
  "use strict";

  const BROADCAST_CHANNEL_NAME = "salgados_vip_bus";
  const DEFAULT_STORE_COORDS = { lat: -22.75735, lng: -43.47254 };
  const DEFAULT_STORE_ADDRESS = "Rua Isabel Pedrosa, 31, Da Luz, Nova Iguaçu - RJ";
  const DEFAULT_STORE_PHONE = "5521986758102";

  // Cache em memória de rotas e geocodificação
  const _routeCache = new Map();
  const _geocodeCache = new Map();

  // Helper para obter o cliente Supabase globalmente
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

  // Helper para Broadcast local
  function broadcastMessage(type, payload) {
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        bc.postMessage({ type, payload, timestamp: Date.now() });
        setTimeout(() => bc.close(), 100);
      }
    } catch (e) {}
  }

  // Cálculo geodésico Haversine (em km)
  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Cálculo do ângulo / rumo (bearing em graus 0-360) entre duas coordenadas GPS
  function calculateBearing(lat1, lon1, lat2, lon2) {
    const toRad = deg => deg * Math.PI / 180;
    const toDeg = rad => rad * 180 / Math.PI;

    const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
              Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
    const bearing = toDeg(Math.atan2(y, x));
    return (bearing + 360) % 360;
  }

  // Objeto Central VIPMotoboyTracker
  const VIPMotoboyTracker = {
    STORE_COORDS: DEFAULT_STORE_COORDS,
    STORE_ADDRESS: DEFAULT_STORE_ADDRESS,
    STORE_PHONE: DEFAULT_STORE_PHONE,

    // ==========================================================================
    // 1. TRANSMISSOR GPS (EXECUTADO NO APP DO MOTOBOY)
    // ==========================================================================
    _watchId: null,
    _lastPublishedLat: null,
    _lastPublishedLng: null,
    _lastPublishedTime: 0,
    _currentHeading: 0,
    _activeTrackingSession: null,

    /**
     * Inicia a transmissão da posição GPS do entregador
     * @param {Object} opts { motoboyId, orderId, motoboyName, phone, destLat, destLng, destAddress, waypoints, onUpdate, onError }
     */
    startTransmitter(opts) {
      if (!navigator.geolocation) {
        if (opts.onError) opts.onError(new Error("Geolocalização não suportada neste dispositivo."));
        return false;
      }

      this.stopTransmitter();
      this._activeTrackingSession = { ...opts, waypoints: opts.waypoints || [] };

      const minIntervalMs = 5000; // Throttle de 5 segundos
      const minDistanceMeters = 8; // Mínimo de 8 metros de deslocamento

      const handlePosition = async (pos) => {
        const coords = pos.coords;
        const lat = Number(coords.latitude.toFixed(6));
        const lng = Number(coords.longitude.toFixed(6));
        const now = Date.now();

        // Calcula rumo (heading) se o dispositivo não fornecer nativamente
        let heading = coords.heading;
        if (heading === null || isNaN(heading) || heading < 0) {
          if (this._lastPublishedLat !== null && this._lastPublishedLng !== null) {
            const dist = haversineDistance(this._lastPublishedLat, this._lastPublishedLng, lat, lng) * 1000;
            if (dist > 3) {
              heading = calculateBearing(this._lastPublishedLat, this._lastPublishedLng, lat, lng);
              this._currentHeading = heading;
            } else {
              heading = this._currentHeading || 0;
            }
          } else {
            heading = 0;
          }
        } else {
          this._currentHeading = heading;
        }

        // Velocidade (em km/h)
        let speedKmH = 0;
        if (coords.speed !== null && !isNaN(coords.speed) && coords.speed > 0) {
          speedKmH = Math.round(coords.speed * 3.6);
        }

        // Verifica throttle de tempo e distância para poupar bateria e dados
        const timeDiff = now - this._lastPublishedTime;
        let distDiff = 999;
        if (this._lastPublishedLat !== null && this._lastPublishedLng !== null) {
          distDiff = haversineDistance(this._lastPublishedLat, this._lastPublishedLng, lat, lng) * 1000;
        }

        // Publica imediatamente se passou o tempo mínimo e houve movimento, ou se é a 1ª vez
        if (this._lastPublishedTime === 0 || (timeDiff >= minIntervalMs && (distDiff >= minDistanceMeters || timeDiff >= 15000))) {
          this._lastPublishedLat = lat;
          this._lastPublishedLng = lng;
          this._lastPublishedTime = now;

          const payload = {
            motoboy_id: opts.motoboyId,
            order_id: opts.orderId || null,
            motoboy_name: opts.motoboyName || "Entregador",
            phone: opts.phone || "",
            latitude: lat,
            longitude: lng,
            heading: Math.round(heading),
            speed: speedKmH,
            accuracy: Math.round(coords.accuracy || 0),
            route_waypoints: this._activeTrackingSession?.waypoints || [],
            destination_lat: opts.destLat || null,
            destination_lng: opts.destLng || null,
            destination_address: opts.destAddress || null,
            status: opts.orderId ? "em_rota" : "disponivel",
            active: true,
            last_ping: now,
            updated_at: new Date().toISOString()
          };

          // 1. Grava no Supabase Nuvem
          const sb = getSupabase();
          if (sb) {
            try {
              await sb.from("motoboy_locations").upsert(payload, { onConflict: "motoboy_id" });
            } catch (err) {
              console.warn("[VIPMotoboyTracker] Falha no upsert da localização no Supabase:", err);
            }
          }

          // 2. Transmite via BroadcastChannel para abas locais
          broadcastMessage("MOTOBOY_LOCATION_UPDATE", payload);

          // 3. Salva no LocalStorage para persistência instantânea
          try {
            localStorage.setItem(`salgados_vip_motoboy_loc_${opts.motoboyId}`, JSON.stringify(payload));
          } catch (e) {}

          if (opts.onUpdate) {
            opts.onUpdate(payload);
          }
        }
      };

      const handleError = (err) => {
        console.warn("[VIPMotoboyTracker] Erro ao obter GPS:", err.message);
        if (opts.onError) opts.onError(err);
      };

      const geoOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000
      };

      // Watch contínuo
      this._watchId = navigator.geolocation.watchPosition(handlePosition, handleError, geoOptions);

      // Leitura imediata para não esperar o primeiro ciclo
      navigator.geolocation.getCurrentPosition(handlePosition, handleError, geoOptions);

      return true;
    },

    /**
     * Atualiza os waypoints da rota do motoboy ativo
     */
    async updateActiveWaypoints(waypoints) {
      if (!this._activeTrackingSession) return;
      this._activeTrackingSession.waypoints = waypoints || [];

      const motoboyId = this._activeTrackingSession.motoboyId;
      const sb = getSupabase();
      if (sb && motoboyId) {
        try {
          await sb.from("motoboy_locations").update({
            route_waypoints: this._activeTrackingSession.waypoints,
            updated_at: new Date().toISOString()
          }).eq("motoboy_id", motoboyId);
        } catch (e) {}
      }
    },

    /**
     * Encerra a transmissão do motoboy e marca como disponível
     */
    async stopTransmitter() {
      if (this._watchId !== null) {
        navigator.geolocation.clearWatch(this._watchId);
        this._watchId = null;
      }

      if (this._activeTrackingSession) {
        const motoboyId = this._activeTrackingSession.motoboyId;
        const sb = getSupabase();
        if (sb && motoboyId) {
          try {
            await sb.from("motoboy_locations").update({
              status: "disponivel",
              order_id: null,
              active: false,
              updated_at: new Date().toISOString()
            }).eq("motoboy_id", motoboyId);
          } catch (e) {}
        }
        this._activeTrackingSession = null;
      }

      this._lastPublishedLat = null;
      this._lastPublishedLng = null;
      this._lastPublishedTime = 0;
    },

    // ==========================================================================
    // 2. MOTOR DE ROTA AUTOMÁTICA & MANUAL (OSRM / OPENSTREETMAP)
    // ==========================================================================
    /**
     * Calcula o trajeto por ruas reais usando OSRM
     * @param {Object} startCoords { lat, lng }
     * @param {Object} endCoords { lat, lng }
     * @param {Array} waypoints Array opcional de waypoints intermediários [{ lat, lng }]
     * @returns {Promise<Object>} { coordinates: [[lat, lng], ...], distanceKm, durationMin, summary }
     */
    async calculateRoute(startCoords, endCoords, waypoints = []) {
      if (!startCoords || !endCoords) return null;

      const cacheKey = `${startCoords.lat},${startCoords.lng}|${waypoints.map(w => `${w.lat},${w.lng}`).join(';')}|${endCoords.lat},${endCoords.lng}`;
      if (_routeCache.has(cacheKey)) {
        return _routeCache.get(cacheKey);
      }

      // Monta todos os pontos na ordem: Início -> Waypoints Intermediários -> Destino
      const allPoints = [startCoords, ...waypoints, endCoords];
      const coordsString = allPoints.map(p => `${p.lng},${p.lat}`).join(";");

      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson&steps=false`;
        const resp = await fetch(osrmUrl, { method: "GET" });

        if (resp.ok) {
          const data = await resp.json();
          if (data.code === "Ok" && data.routes && data.routes.length > 0) {
            const r = data.routes[0];
            const distanceKm = Math.round((r.distance / 1000) * 10) / 10;
            const durationMin = Math.max(1, Math.round(r.duration / 60));
            // OSRM retorna GeoJSON [lng, lat], convertemos para Leaflet [lat, lng]
            const coordinates = r.geometry.coordinates.map(c => [c[1], c[0]]);

            const result = {
              coordinates,
              distanceKm,
              durationMin,
              waypoints: waypoints || [],
              source: "osrm"
            };

            _routeCache.set(cacheKey, result);
            return result;
          }
        }
      } catch (e) {
        console.warn("[VIPMotoboyTracker] Falha no cálculo OSRM, gerando rota interpolada:", e);
      }

      // Fallback em caso de indisponibilidade do OSRM: interpolação direta com fator de via 1.28x
      let totalDist = 0;
      const polyline = [];
      for (let i = 0; i < allPoints.length - 1; i++) {
        const p1 = allPoints[i];
        const p2 = allPoints[i + 1];
        totalDist += haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
        polyline.push([p1.lat, p1.lng]);
      }
      polyline.push([endCoords.lat, endCoords.lng]);

      const distanceKm = Math.round(totalDist * 1.28 * 10) / 10;
      const durationMin = Math.max(2, Math.round(distanceKm * 2.5)); // Média de 25 km/h

      const fallbackResult = {
        coordinates: polyline,
        distanceKm,
        durationMin,
        waypoints: waypoints || [],
        source: "fallback_haversine"
      };

      _routeCache.set(cacheKey, fallbackResult);
      return fallbackResult;
    },

    /**
     * Geocodifica um endereço em Nova Iguaçu via Nominatim com cache
     */
    async geocodeAddress(addressText) {
      if (!addressText || typeof addressText !== "string") return null;

      const normAddr = addressText.trim().toLowerCase();
      if (_geocodeCache.has(normAddr)) {
        return _geocodeCache.get(normAddr);
      }

      // Adiciona o contexto do município de Nova Iguaçu se ausente
      let query = addressText.trim();
      if (!query.toLowerCase().includes("nova iguaçu") && !query.toLowerCase().includes("nova iguacu")) {
        query += ", Nova Iguaçu, RJ, Brasil";
      }

      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=br`;
        const resp = await fetch(url, { headers: { "Accept": "application/json" } });
        if (resp.ok) {
          const list = await resp.json();
          if (list && list.length > 0) {
            const item = list[0];
            const coords = {
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              displayName: item.display_name
            };
            _geocodeCache.set(normAddr, coords);
            return coords;
          }
        }
      } catch (e) {
        console.warn("[VIPMotoboyTracker] Erro ao geocodificar endereço:", e);
      }

      return null;
    },

    // ==========================================================================
    // 3. SUBSCRIÇÃO EM TEMPO REAL (CLIENTE E ADM)
    // ==========================================================================
    /**
     * Escuta a localização de um motoboy específico em tempo real
     * @param {string} motoboyId ID do motoboy
     * @param {Function} callback Função chamada com { latitude, longitude, heading, speed, waypoints, ... }
     * @returns {Object} { unsubscribe() }
     */
    subscribeMotoboyLocation(motoboyId, callback) {
      if (!motoboyId || typeof callback !== "function") {
        return { unsubscribe: () => {} };
      }

      let isCleanedUp = false;
      let pollInterval = null;
      let realtimeChannel = null;

      // 1. Busca imediata inicial no Supabase / LocalStorage
      const fetchLatest = async () => {
        if (isCleanedUp) return;
        const sb = getSupabase();
        if (sb) {
          try {
            const { data, error } = await sb
              .from("motoboy_locations")
              .select("*")
              .eq("motoboy_id", motoboyId)
              .maybeSingle();

            if (!error && data && !isCleanedUp) {
              callback(data);
              return;
            }
          } catch (e) {}
        }

        // Fallback localstorage
        try {
          const cached = localStorage.getItem(`salgados_vip_motoboy_loc_${motoboyId}`);
          if (cached && !isCleanedUp) {
            callback(JSON.parse(cached));
          }
        } catch (e) {}
      };

      fetchLatest();

      // 2. Supabase Realtime Listener (Reativo Instantâneo)
      const sb = getSupabase();
      if (sb && typeof sb.channel === "function") {
        const channelName = `motoboy-loc-${motoboyId}-${Date.now()}`;
        realtimeChannel = sb.channel(channelName)
          .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "motoboy_locations",
            filter: `motoboy_id=eq.${motoboyId}`
          }, (payload) => {
            if (isCleanedUp) return;
            if (payload && payload.new) {
              callback(payload.new);
            }
          })
          .subscribe();
      }

      // 3. BroadcastChannel para abas no mesmo navegador/dispositivo
      const handleBroadcast = (evt) => {
        if (isCleanedUp) return;
        if (evt.data && evt.data.type === "MOTOBOY_LOCATION_UPDATE") {
          const data = evt.data.payload;
          if (data && data.motoboy_id === motoboyId) {
            callback(data);
          }
        }
      };

      let bc = null;
      try {
        if (typeof BroadcastChannel !== "undefined") {
          bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
          bc.addEventListener("message", handleBroadcast);
        }
      } catch (e) {}

      // 4. Polling Suave de Fallback (a cada 6 segundos)
      pollInterval = setInterval(fetchLatest, 6000);

      return {
        unsubscribe: () => {
          isCleanedUp = true;
          if (pollInterval) clearInterval(pollInterval);
          if (bc) {
            bc.removeEventListener("message", handleBroadcast);
            bc.close();
          }
          if (realtimeChannel && sb) {
            sb.removeChannel(realtimeChannel);
          }
        }
      };
    },

    /**
     * Escuta todos os motoboys para o Radar da Loja (ADM)
     */
    subscribeAllMotoboys(callback) {
      if (typeof callback !== "function") {
        return { unsubscribe: () => {} };
      }

      let isCleanedUp = false;
      let pollInterval = null;
      let realtimeChannel = null;

      const fetchAll = async () => {
        if (isCleanedUp) return;
        const sb = getSupabase();
        if (sb) {
          try {
            const { data, error } = await sb
              .from("motoboy_locations")
              .select("*")
              .eq("active", true);

            if (!error && Array.isArray(data) && !isCleanedUp) {
              callback(data);
            }
          } catch (e) {}
        }
      };

      fetchAll();

      const sb = getSupabase();
      if (sb && typeof sb.channel === "function") {
        const channelName = `adm-fleet-radar-${Date.now()}`;
        realtimeChannel = sb.channel(channelName)
          .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "motoboy_locations"
          }, () => {
            if (!isCleanedUp) fetchAll();
          })
          .subscribe();
      }

      const handleBroadcast = (evt) => {
        if (isCleanedUp) return;
        if (evt.data && evt.data.type === "MOTOBOY_LOCATION_UPDATE") {
          fetchAll();
        }
      };

      let bc = null;
      try {
        if (typeof BroadcastChannel !== "undefined") {
          bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
          bc.addEventListener("message", handleBroadcast);
        }
      } catch (e) {}

      pollInterval = setInterval(fetchAll, 7000);

      return {
        unsubscribe: () => {
          isCleanedUp = true;
          if (pollInterval) clearInterval(pollInterval);
          if (bc) {
            bc.removeEventListener("message", handleBroadcast);
            bc.close();
          }
          if (realtimeChannel && sb) {
            sb.removeChannel(realtimeChannel);
          }
        }
      };
    },

    // ==========================================================================
    // 4. ATALHOS & INTEGRAÇÕES DE CONTATO WHATSAPP
    // ==========================================================================
    /**
     * Gera URL de contato direto do WhatsApp da Loja com o Motoboy
     */
    buildMotoboyWhatsAppUrl(motoboyPhone, orderId, customText) {
      const cleanPhone = String(motoboyPhone || "").replace(/\D/g, "");
      const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
      const defaultMsg = orderId
        ? `Olá! Estou acompanhando a corrida do Pedido #${orderId} no Radar Salgados VIP. Como está o trajeto?`
        : `Olá! Mensagem da loja Salgados VIP sobre suas corridas de hoje.`;
      const msg = customText || defaultMsg;
      return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
    },

    /**
     * Gera URL de contato direto do Motoboy com a Loja
     */
    buildStoreWhatsAppUrl(motoboyName, orderId, customText) {
      const defaultMsg = `Olá Salgados VIP! Aqui é o entregador ${motoboyName || ''}. ` +
        (orderId ? `Referente ao Pedido #${orderId}: ` : ``);
      const msg = customText || defaultMsg;
      return `https://wa.me/${DEFAULT_STORE_PHONE}?text=${encodeURIComponent(msg)}`;
    },

    /**
     * Gera URL de contato do Motoboy com o Cliente
     */
    buildCustomerWhatsAppUrl(customerPhone, orderId, motoboyName) {
      const cleanPhone = String(customerPhone || "").replace(/\D/g, "");
      const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
      const msg = `Olá! Sou o entregador ${motoboyName || 'da Salgados VIP'}. ` +
        `Estou a caminho da sua residência com o seu Pedido #${orderId || ''}! 🥟🚀`;
      return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
    },

    /**
     * Gera deep links para Waze e Google Maps
     */
    buildNavigationLinks(destLat, destLng, destAddress) {
      const lat = encodeURIComponent(destLat || "");
      const lng = encodeURIComponent(destLng || "");
      const addr = encodeURIComponent(destAddress || "");

      return {
        waze: (destLat && destLng)
          ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
          : `https://waze.com/ul?q=${addr}&navigate=yes`,
        googleMaps: (destLat && destLng)
          ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
          : `https://www.google.com/maps/dir/?api=1&destination=${addr}`
      };
    }
  };

  window.VIPMotoboyTracker = VIPMotoboyTracker;
})(window);
