/**
 * ==============================================================================
 * SALGADOS VIP - BANCO DE DADOS INDEPENDENTE DE ENTREGADORES (MOTOBOYS)
 * Módulo 100% Isolado: window.VIPDeliveryMenDB / window.VIPMotoboysDB (v64.0)
 * ==============================================================================
 * Este módulo opera de forma autônoma e desacoplada do catálogo de produtos,
 * pedidos e configurações gerais da loja. Possui persistência própria em 3 camadas:
 *  1. LocalStorage Primário Isolado ('salgados_vip_delivery_men_v64') com migração automática;
 *  2. Tabela Dedicada no PostgreSQL Supabase ('delivery_men') com RLS ativo;
 *  3. Espelhamento Redundante em 'store_settings' ('delivery_men') p/ máxima segurança;
 *  4. Sincronização em Tempo Real via Supabase Realtime & BroadcastChannel entre abas;
 *  5. Backup snapshot automático local antes de qualquer alteração estrutural.
 * ==============================================================================
 */

(function (window) {
  "use strict";

  const STORAGE_KEY_PRIMARY = "salgados_vip_delivery_men_v64";
  const STORAGE_KEY_LEGACY = "salgados_vip_motoboys";
  const STORAGE_KEY_BACKUP = "salgados_vip_delivery_men_backup";
  const BROADCAST_CHANNEL_NAME = "salgados_vip_bus";

  // Entregadores padrão de fábrica (usados exclusivamente se o banco estiver 100% vazio)
  const INITIAL_DEFAULT_MOTOBOYS = [
    {
      id: "mb-1",
      name: "Carlos Henrique",
      phone: "(21) 98123-4567",
      vehicle: "Honda CG 160 (Placa: BRA2E19)",
      feeType: "fixed",
      dailyRate: 50.00,
      defaultFee: 7.00,
      workDays: [1, 2, 3, 4, 5, 6], // Segunda a Sábado
      pixKey: "carlos.motoboy@email.com",
      pixType: "E-mail",
      active: true,
      notes: "Disponível no turno da noite (Seg a Sáb)",
      createdAt: 1731500000000,
      updatedAt: 1731500000000
    },
    {
      id: "mb-2",
      name: "Marcos Paulo",
      phone: "(21) 97654-3210",
      vehicle: "Yamaha Fazer 250 (Placa: VIP8A44)",
      feeType: "fixed",
      dailyRate: 60.00,
      defaultFee: 8.00,
      workDays: [5, 6, 0], // Sexta, Sábado e Domingo
      pixKey: "21976543210",
      pixType: "Telefone",
      active: true,
      notes: "Finais de semana e horários de pico (Sex, Sáb e Dom)",
      createdAt: 1731700000000,
      updatedAt: 1731700000000
    }
  ];

  let _cachedList = null;
  let _isCloudSyncing = false;
  let _cloudSubscribed = false;

  // Helper para obter o cliente Supabase disponível globalmente
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

  // Sanitização e normalização segura de um objeto de entregador
  function normalizeMotoboy(raw) {
    if (!raw || typeof raw !== "object") return null;

    let workDays = raw.work_days || raw.workDays;
    if (typeof workDays === "string") {
      try { workDays = JSON.parse(workDays); } catch(e) { workDays = [0, 1, 2, 3, 4, 5, 6]; }
    }
    if (!Array.isArray(workDays) || workDays.length === 0) {
      workDays = [0, 1, 2, 3, 4, 5, 6];
    }
    workDays = workDays.map(Number).filter(n => !isNaN(n) && n >= 0 && n <= 6);

    const dailyRate = raw.daily_rate !== undefined ? Number(raw.daily_rate) : (Number(raw.dailyRate) || 0);
    const defaultFee = raw.default_fee !== undefined ? Number(raw.default_fee) : (Number(raw.defaultFee) || 7);

    // Extrai placa do veículo caso não esteja explicitamente informada
    let plate = String(raw.plate || "").trim();
    if (!plate && raw.vehicle) {
      const matchParen = raw.vehicle.match(/placa[:\s]*([A-Z0-9-]+)/i);
      if (matchParen && matchParen[1]) {
        plate = matchParen[1].trim();
      }
    }

    return {
      id: String(raw.id || `mb-${Date.now()}`),
      name: String(raw.name || "Entregador").trim(),
      phone: String(raw.phone || "").trim(),
      vehicle: String(raw.vehicle || "").trim(),
      plate: plate.toUpperCase(),
      feeType: String(raw.fee_type || raw.feeType || "fixed"),
      dailyRate: isNaN(dailyRate) ? 0 : dailyRate,
      defaultFee: isNaN(defaultFee) ? 7 : defaultFee,
      workDays: workDays,
      pixKey: String(raw.pix_key || raw.pixKey || "").trim(),
      pixType: String(raw.pix_type || raw.pixType || "Telefone").trim(),
      active: raw.active !== false,
      notes: String(raw.notes || "").trim(),
      createdAt: Number(raw.created_at || raw.createdAt) || Date.now(),
      updatedAt: Number(raw.updated_at || raw.updatedAt) || Date.now()
    };
  }

  // Notifica todas as abas e ouvinte local sobre alterações na base de entregadores
  function dispatchUpdateEvents(source = "local") {
    // 1. Evento nativo na janela atual
    window.dispatchEvent(new CustomEvent("vip_delivery_men_updated", {
      detail: { count: _cachedList ? _cachedList.length : 0, source }
    }));

    // 2. BroadcastChannel para sincronizar outras abas sem reload
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        bc.postMessage({ type: "DELIVERY_MEN_UPDATED", timestamp: Date.now(), source });
        bc.close();
      } catch (e) {}
    }
  }

  // ============================================================================
  // MOTOR PRINCIPAL DO BANCO INDEPENDENTE
  // ============================================================================
  const VIPDeliveryMenDB = {
    version: "v64.0 (Bkp 64)",

    // Carregamento local com migração automática transparente
    loadLocal() {
      try {
        // Tenta primeiro a chave primária v64
        const rawPrimary = localStorage.getItem(STORAGE_KEY_PRIMARY);
        if (rawPrimary) {
          const parsed = JSON.parse(rawPrimary);
          if (Array.isArray(parsed) && parsed.length > 0) {
            _cachedList = parsed.map(normalizeMotoboy).filter(Boolean);
            return _cachedList;
          }
        }

        // Migração suave da chave legada 'salgados_vip_motoboys' se existir
        const rawLegacy = localStorage.getItem(STORAGE_KEY_LEGACY);
        if (rawLegacy) {
          const parsedLegacy = JSON.parse(rawLegacy);
          if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
            console.info("[VIPDeliveryMenDB] Migrando entregadores da base legada com sucesso...");
            _cachedList = parsedLegacy.map(normalizeMotoboy).filter(Boolean);
            this.saveLocal(_cachedList, false);
            return _cachedList;
          }
        }

        // Se realmente não houver nenhum registro, inicializa com a lista padrão
        _cachedList = INITIAL_DEFAULT_MOTOBOYS.map(normalizeMotoboy);
        this.saveLocal(_cachedList, false);
        return _cachedList;
      } catch (err) {
        console.error("[VIPDeliveryMenDB] Erro ao carregar dados locais:", err);
        _cachedList = INITIAL_DEFAULT_MOTOBOYS.map(normalizeMotoboy);
        return _cachedList;
      }
    },

    // Grava localmente com espelhamento e backup snapshot
    saveLocal(list, emitEvent = true) {
      if (!Array.isArray(list)) return;
      _cachedList = list.map(normalizeMotoboy).filter(Boolean);

      try {
        const jsonStr = JSON.stringify(_cachedList);
        // Cria snapshot de segurança antes de gravar
        const prev = localStorage.getItem(STORAGE_KEY_PRIMARY);
        if (prev) {
          localStorage.setItem(STORAGE_KEY_BACKUP, prev);
        }

        localStorage.setItem(STORAGE_KEY_PRIMARY, jsonStr);
        // Espelhamento na chave legada para manter compatibilidade absoluta com scripts legados
        localStorage.setItem(STORAGE_KEY_LEGACY, jsonStr);
      } catch (e) {
        console.warn("[VIPDeliveryMenDB] Falha ao gravar no LocalStorage:", e);
      }

      if (emitEvent) {
        dispatchUpdateEvents("local");
      }
    },

    // Consulta todos os entregadores
    getAll(filter = "all") {
      if (!_cachedList) {
        this.loadLocal();
      }
      const list = [...(_cachedList || [])];
      if (filter === "active") return list.filter(m => m.active);
      if (filter === "paused") return list.filter(m => !m.active);
      return list;
    },

    // Consulta por ID
    getById(id) {
      const list = this.getAll();
      return list.find(m => String(m.id) === String(id)) || null;
    },

    // Consulta entregadores escalados para o dia de hoje (0=Dom, 1=Seg, ..., 6=Sáb)
    getForDayOfWeek(dayIndex, onlyActive = true) {
      const list = this.getAll();
      const targetDay = Number(dayIndex);
      return list.filter(m => {
        if (onlyActive && !m.active) return false;
        if (!Array.isArray(m.workDays) || m.workDays.length === 0) return true;
        return m.workDays.includes(targetDay);
      });
    },

    // Adiciona novo entregador com persistência imediata local + nuvem
    async add(data) {
      const list = this.getAll();
      const newId = `mb-${Date.now()}`;
      const normalized = normalizeMotoboy({
        ...data,
        id: newId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      list.push(normalized);
      this.saveLocal(list);

      // Envia de forma autônoma para a nuvem Supabase
      this.pushSingleToCloud(normalized).catch(() => {});
      this.backupToStoreSettings(list).catch(() => {});

      return normalized;
    },

    // Atualiza entregador existente
    async update(id, data) {
      const list = this.getAll();
      const idx = list.findIndex(m => String(m.id) === String(id));
      if (idx === -1) return null;

      const updated = normalizeMotoboy({
        ...list[idx],
        ...data,
        id: list[idx].id,
        createdAt: list[idx].createdAt,
        updatedAt: Date.now()
      });

      list[idx] = updated;
      this.saveLocal(list);

      // Sincroniza alteração na nuvem Supabase
      this.pushSingleToCloud(updated).catch(() => {});
      this.backupToStoreSettings(list).catch(() => {});

      return updated;
    },

    // Exclui entregador
    async delete(id) {
      let list = this.getAll();
      const target = list.find(m => String(m.id) === String(id));
      if (!target) return false;

      list = list.filter(m => String(m.id) !== String(id));
      this.saveLocal(list);

      // Remove da nuvem Supabase
      this.deleteFromCloud(id).catch(() => {});
      this.backupToStoreSettings(list).catch(() => {});

      return true;
    },

    // Alterna status (Ativo / Em Pausa)
    async toggleStatus(id) {
      const item = this.getById(id);
      if (!item) return null;
      return await this.update(id, { active: !item.active });
    },

    // Autenticação do Motoboy (Login = Nome, Senha = Placa da Moto)
    authenticate(loginInput, passwordInput) {
      if (!loginInput || !passwordInput) {
        return { success: false, message: "Por favor, preencha o Nome e a Placa da moto." };
      }

      const cleanLogin = String(loginInput).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const cleanPass = String(passwordInput).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

      const list = this.getAll();
      const found = list.find(m => {
        const mName = String(m.name || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const mPhone = String(m.phone || "").replace(/\D/g, "");
        const nameMatch = mName === cleanLogin || mName.includes(cleanLogin) || cleanLogin.includes(mName) || (mPhone && mPhone === cleanLogin.replace(/\D/g, ""));

        const mPlate = String(m.plate || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
        const mVehicle = String(m.vehicle || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

        // A senha confere se for a placa exata ou se coincidir com o veículo cadastrado
        const plateMatch = (mPlate && mPlate === cleanPass) ||
          (cleanPass && mPlate && (cleanPass.includes(mPlate) || mPlate.includes(cleanPass))) ||
          (cleanPass && mVehicle && mVehicle.includes(cleanPass));

        return nameMatch && plateMatch;
      });

      if (found) {
        return { success: true, motoboy: found };
      }
      return { success: false, message: "Nome do entregador ou placa da moto incorretos." };
    },

    // Autenticação com garantia de sincronização com o banco em nuvem
    async authenticateCloud(loginInput, passwordInput) {
      const localRes = this.authenticate(loginInput, passwordInput);
      if (localRes.success) return localRes;

      // Se falhar no cache local, força busca atualizada no Supabase
      try {
        await this.syncFromCloud();
      } catch (e) {}

      return this.authenticate(loginInput, passwordInput);
    },

    // ============================================================================
    // CAMADA DE INTEGRAÇÃO COM NUVEM SUPABASE (ISOLADA & BLINDADA)
    // ============================================================================

    // Envia um único entregador para a tabela 'delivery_men' no Supabase
    async pushSingleToCloud(m) {
      const sb = getSupabase();
      if (!sb) return null;

      const payload = {
        id: m.id,
        name: m.name,
        phone: m.phone,
        vehicle: m.vehicle,
        plate: m.plate || "",
        fee_type: m.feeType || "fixed",
        daily_rate: m.dailyRate,
        default_fee: m.defaultFee,
        work_days: m.workDays,
        pix_key: m.pixKey,
        pix_type: m.pixType,
        active: m.active !== false,
        notes: m.notes,
        created_at: m.createdAt,
        updated_at: m.updatedAt || Date.now()
      };

      try {
        const { data, error } = await sb.from("delivery_men").upsert(payload).select().single();
        if (error) {
          console.warn("[VIPDeliveryMenDB] Aviso ao salvar entregador na tabela dedicada:", error.message);
          return null;
        }
        return data;
      } catch (err) {
        console.warn("[VIPDeliveryMenDB] Exceção ao sincronizar entregador no Supabase:", err);
        return null;
      }
    },

    // Remove entregador da tabela 'delivery_men'
    async deleteFromCloud(id) {
      const sb = getSupabase();
      if (!sb) return false;

      try {
        const { error } = await sb.from("delivery_men").delete().eq("id", String(id));
        if (error) {
          console.warn("[VIPDeliveryMenDB] Falha ao deletar entregador no Supabase:", error.message);
          return false;
        }
        return true;
      } catch (err) {
        return false;
      }
    },

    // Backup em lote em 'store_settings' com id='delivery_men' (Redundância máxima)
    async backupToStoreSettings(list) {
      const sb = getSupabase();
      if (!sb) return;

      try {
        await sb.from("store_settings").upsert({
          id: "delivery_men",
          value: list,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        // Redundância secundária silenciosa
      }
    },

    // Sincroniza e mescla os dados da nuvem Supabase com o banco local
    async syncFromCloud() {
      if (_isCloudSyncing) return this.getAll();
      _isCloudSyncing = true;

      const sb = getSupabase();
      if (!sb) {
        _isCloudSyncing = false;
        return this.getAll();
      }

      try {
        // 1. Tenta carregar da tabela dedicada 'delivery_men'
        const { data: cloudRows, error } = await sb
          .from("delivery_men")
          .select("*")
          .order("created_at", { ascending: true });

        if (!error && Array.isArray(cloudRows) && cloudRows.length > 0) {
          const cloudList = cloudRows.map(normalizeMotoboy).filter(Boolean);
          const localList = this.getAll();

          // Mescla inteligente: mantém o registro mais atualizado por 'updatedAt'
          const mergedMap = new Map();
          localList.forEach(m => mergedMap.set(m.id, m));
          cloudList.forEach(cm => {
            if (!mergedMap.has(cm.id)) {
              mergedMap.set(cm.id, cm);
            } else {
              const lm = mergedMap.get(cm.id);
              if ((cm.updatedAt || 0) >= (lm.updatedAt || 0)) {
                mergedMap.set(cm.id, cm);
              }
            }
          });

          const finalList = Array.from(mergedMap.values());
          this.saveLocal(finalList, false);
          dispatchUpdateEvents("cloud_sync");
          console.log(`[VIPDeliveryMenDB] Sincronização concluída: ${finalList.length} entregador(es) alinhados.`);
          _isCloudSyncing = false;
          return finalList;
        }

        // 2. Fallback de contingência: verificar se há backup em 'store_settings'
        const { data: settingRow } = await sb
          .from("store_settings")
          .select("value")
          .eq("id", "delivery_men")
          .single();

        if (settingRow && Array.isArray(settingRow.value) && settingRow.value.length > 0) {
          const cloudList = settingRow.value.map(normalizeMotoboy).filter(Boolean);
          this.saveLocal(cloudList, false);
          dispatchUpdateEvents("cloud_sync");
          _isCloudSyncing = false;
          return cloudList;
        }

        // 3. Se a nuvem estiver vazia mas temos dados locais reais, envia os locais para a nuvem
        const currentLocal = this.getAll();
        if (currentLocal && currentLocal.length > 0) {
          console.info("[VIPDeliveryMenDB] Nuvem vazia: populando tabela com entregadores locais...");
          for (const m of currentLocal) {
            await this.pushSingleToCloud(m);
          }
          await this.backupToStoreSettings(currentLocal);
        }
      } catch (err) {
        console.warn("[VIPDeliveryMenDB] Erro durante sincronização em nuvem:", err);
      } finally {
        _isCloudSyncing = false;
      }

      return this.getAll();
    },

    // Inscreve no canal Supabase Realtime para ouvir alterações imediatas em outras abas/dispositivos
    subscribeRealtime() {
      if (_cloudSubscribed) return;
      const sb = getSupabase();
      if (!sb) return;

      try {
        _cloudSubscribed = true;
        sb.channel("vip_realtime_delivery_men")
          .on("postgres_changes", { event: "*", schema: "public", table: "delivery_men" }, (payload) => {
            const { eventType, new: rowNew, old: rowOld } = payload;
            let list = this.getAll();

            if (eventType === "INSERT") {
              const added = normalizeMotoboy(rowNew);
              if (!list.some(m => m.id === added.id)) {
                list.push(added);
                this.saveLocal(list, true);
              }
            } else if (eventType === "UPDATE") {
              const updated = normalizeMotoboy(rowNew);
              const idx = list.findIndex(m => m.id === updated.id);
              if (idx !== -1) {
                list[idx] = updated;
                this.saveLocal(list, true);
              }
            } else if (eventType === "DELETE") {
              const delId = String(rowOld?.id);
              list = list.filter(m => m.id !== delId);
              this.saveLocal(list, true);
            }
          })
          .subscribe();
      } catch (e) {
        console.warn("[VIPDeliveryMenDB] Erro ao registrar canal realtime de entregadores:", e);
      }
    },

    // Inicialização autônoma do módulo
    async init() {
      this.loadLocal();
      if (typeof window !== "undefined") {
        // Escuta mensagens de outras abas via barramento BroadcastChannel
        if (typeof BroadcastChannel !== "undefined") {
          try {
            const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
            bc.onmessage = (ev) => {
              if (ev.data && ev.data.type === "DELIVERY_MEN_UPDATED" && ev.data.source !== "local") {
                this.loadLocal();
                window.dispatchEvent(new CustomEvent("vip_delivery_men_updated", { detail: { count: _cachedList.length, source: "broadcast" } }));
              }
            };
          } catch(e) {}
        }

        // Aguarda sinal do Supabase e sincroniza em paralelo
        window.addEventListener("vip_supabase_synced", () => {
          this.syncFromCloud().then(() => this.subscribeRealtime());
        });

        // Tentativa de sincronização imediata se o Supabase já estiver pronto
        setTimeout(() => {
          this.syncFromCloud().then(() => this.subscribeRealtime());
        }, 1200);
      }
      return this;
    }
  };

  // ============================================================================
  // CONEXÃO DE RETROCOMPATIBILIDADE COM VIPDatabase
  // ============================================================================
  function attachToVIPDatabase() {
    if (typeof window !== "undefined" && window.VIPDatabase) {
      window.VIPDatabase.getMotoboys = function() {
        return VIPDeliveryMenDB.getAll();
      };
      window.VIPDatabase.saveMotoboys = function(list) {
        VIPDeliveryMenDB.saveLocal(list, true);
        VIPDeliveryMenDB.backupToStoreSettings(list).catch(() => {});
        return list;
      };
      window.VIPDatabase.getMotoboyById = function(id) {
        return VIPDeliveryMenDB.getById(id);
      };
      window.VIPDatabase.addMotoboy = function(data) {
        return VIPDeliveryMenDB.add(data);
      };
      window.VIPDatabase.updateMotoboy = function(id, data) {
        return VIPDeliveryMenDB.update(id, data);
      };
      window.VIPDatabase.deleteMotoboy = function(id) {
        return VIPDeliveryMenDB.delete(id);
      };
    }
  }

  // Exportações Globais
  window.VIPDeliveryMenDB = VIPDeliveryMenDB;
  window.VIPMotoboysDB = VIPDeliveryMenDB;
  window.VIPEntregadoresDB = VIPDeliveryMenDB;

  // Inicializa quando o DOM estiver pronto ou de imediato
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      VIPDeliveryMenDB.init();
      attachToVIPDatabase();
    });
  } else {
    VIPDeliveryMenDB.init();
    attachToVIPDatabase();
  }

  // Garante o binding caso o VIPDatabase seja carregado em ordem diferente
  setTimeout(attachToVIPDatabase, 150);
  setTimeout(attachToVIPDatabase, 800);

})(typeof window !== "undefined" ? window : globalThis);
