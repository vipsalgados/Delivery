/**
 * ==============================================================================
 * SALGADOS VIP - PAINEL ADMINISTRATIVO (LÓGICA E CRUD)
 * ==============================================================================
 */

// Formatação BRL
function formatBRL(val) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ==========================================
// 1. AUTENTICAÇÃO E SESSÃO
// ==========================================
function activateOrdersTabByDefault() {
  document.querySelectorAll(".adm-tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".adm-tab-pane").forEach(p => p.classList.remove("active"));

  const ordersBtn = document.querySelector('.adm-tab-btn[data-tab="orders"]');
  const ordersPane = document.getElementById("tab-orders");
  if (ordersBtn) ordersBtn.classList.add("active");
  if (ordersPane) ordersPane.classList.add("active");
}

function checkSession() {
  const isLogged = VIPAuth.isLoggedIn();
  const loginView = document.getElementById("login-view");
  const dashboardView = document.getElementById("dashboard-view");

  if (isLogged) {
    if (loginView) loginView.style.display = "none";
    if (dashboardView) dashboardView.style.display = "block";
    activateOrdersTabByDefault();
    initSidebarMenuState();
    loadAllData();
    initOrdersWatcher();
  } else {
    if (loginView) loginView.style.display = "flex";
    if (dashboardView) dashboardView.style.display = "none";
  }
}

// Alternar visibilidade de senhas
window.togglePasswordVisibility = function(inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPass = input.type === "password";
  input.type = isPass ? "text" : "password";
  const icon = btnEl ? btnEl.querySelector("i") : null;
  if (icon) {
    icon.className = isPass ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
  }
};

// Login seguro conectado ao Supabase
const btnLogin = document.getElementById("btn-do-login");
if (btnLogin) {
  btnLogin.addEventListener("click", async () => {
    const user = document.getElementById("login-user").value.trim();
    const pass = document.getElementById("login-pass").value.trim();
    const errorEl = document.getElementById("login-error-msg");
    const errorText = document.getElementById("login-error-text");
    const btnText = document.getElementById("btn-login-text");

    if (!user || !pass) {
      if (errorText) errorText.textContent = "Preencha o usuário e a senha.";
      if (errorEl) errorEl.style.display = "flex";
      return;
    }

    btnLogin.disabled = true;
    if (btnText) btnText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Autenticando...';
    if (errorEl) errorEl.style.display = "none";

    try {
      const res = await VIPAuth.login(user, pass);
      if (res.success) {
        checkSession();
      } else {
        if (errorText) errorText.textContent = res.message || "Usuário ou senha incorretos.";
        if (errorEl) errorEl.style.display = "flex";
      }
    } catch (e) {
      if (errorText) errorText.textContent = "Erro ao validar credenciais. Verifique sua conexão com a internet.";
      if (errorEl) errorEl.style.display = "flex";
    } finally {
      btnLogin.disabled = false;
      if (btnText) btnText.innerHTML = 'Entrar no Painel <i class="fa-solid fa-arrow-right-to-bracket"></i>';
    }
  });

  ["login-user", "login-pass"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("keyup", (e) => {
        if (e.key === "Enter") btnLogin.click();
      });
    }
  });
}

// Logout
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    VIPAuth.logout();
    checkSession();
  });
}

// ==============================================================================
// MODAL DE RECUPERAÇÃO DE ACESSO (CHAVE MESTRA / CÓDIGO PIN)
// ==============================================================================
window.openRecoveryModal = function() {
  const backdrop = document.getElementById("modal-recovery-backdrop");
  const modal = document.getElementById("modal-recovery");
  if (backdrop) {
    backdrop.style.display = "block";
    backdrop.classList.add("active");
  }
  if (modal) {
    modal.style.display = "block";
    modal.classList.add("active");
  }
  switchRecoveryTab("key");
};

window.closeRecoveryModal = function() {
  const backdrop = document.getElementById("modal-recovery-backdrop");
  const modal = document.getElementById("modal-recovery");
  if (backdrop) {
    backdrop.classList.remove("active");
    setTimeout(() => { backdrop.style.display = "none"; }, 200);
  }
  if (modal) {
    modal.classList.remove("active");
    setTimeout(() => { modal.style.display = "none"; }, 200);
  }

  const kMsg = document.getElementById("rec-key-msg");
  if (kMsg) kMsg.style.display = "none";
  const pMsg = document.getElementById("rec-pin-msg");
  if (pMsg) pMsg.style.display = "none";
  const eMsg = document.getElementById("rec-email-msg");
  if (eMsg) eMsg.style.display = "none";
};

const recBackdrop = document.getElementById("modal-recovery-backdrop");
if (recBackdrop) recBackdrop.addEventListener("click", closeRecoveryModal);

window.switchRecoveryTab = function(tab) {
  const tabKey = document.getElementById("tab-rec-key");
  const tabEmail = document.getElementById("tab-rec-email");
  const viewKey = document.getElementById("recovery-step-key");
  const viewEmail = document.getElementById("recovery-step-email");

  if (tab === "key") {
    if (tabKey) { tabKey.style.background = "#fee2e2"; tabKey.style.color = "#e11d48"; }
    if (tabEmail) { tabEmail.style.background = "#f1f5f9"; tabEmail.style.color = "#64748b"; }
    if (viewKey) viewKey.style.display = "block";
    if (viewEmail) viewEmail.style.display = "none";
  } else {
    if (tabEmail) { tabEmail.style.background = "#fee2e2"; tabEmail.style.color = "#e11d48"; }
    if (tabKey) { tabKey.style.background = "#f1f5f9"; tabKey.style.color = "#64748b"; }
    if (viewKey) viewKey.style.display = "none";
    if (viewEmail) viewEmail.style.display = "block";
    const subReq = document.getElementById("rec-email-substep-request");
    const subVer = document.getElementById("rec-email-substep-verify");
    if (subReq) subReq.style.display = "block";
    if (subVer) subVer.style.display = "none";
  }
};

window.submitRecoveryWithKey = async function() {
  const key = document.getElementById("rec-master-key").value.trim();
  const pass1 = document.getElementById("rec-new-pass-key").value.trim();
  const pass2 = document.getElementById("rec-confirm-pass-key").value.trim();
  const msgEl = document.getElementById("rec-key-msg");

  if (!key) {
    showRecMsg(msgEl, "Informe a Chave Mestra de Segurança.", "error");
    return;
  }
  if (!pass1 || pass1.length < 6) {
    showRecMsg(msgEl, "A nova senha deve ter no mínimo 6 caracteres.", "error");
    return;
  }
  if (pass1 !== pass2) {
    showRecMsg(msgEl, "As senhas digitadas não coincidem.", "error");
    return;
  }

  showRecMsg(msgEl, "Validando Chave Mestra e redefinindo senha...", "info");

  const res = await VIPAuth.recoverWithMasterKey(key, pass1);
  if (res.success) {
    showRecMsg(msgEl, "Senha redefinida com sucesso! Entrando no painel...", "success");
    setTimeout(() => {
      closeRecoveryModal();
      checkSession();
    }, 1200);
  } else {
    showRecMsg(msgEl, res.message || "Chave Mestra inválida.", "error");
  }
};

window.requestRecoveryPinUI = async function() {
  const email = document.getElementById("rec-email-input").value.trim();
  const msgEl = document.getElementById("rec-email-msg");

  if (!email) {
    showRecMsg(msgEl, "Informe o e-mail cadastrado.", "error");
    return;
  }

  showRecMsg(msgEl, "Verificando e gerando código PIN...", "info");

  const res = await VIPAuth.requestRecoveryPin(email);
  if (res.success) {
    const subReq = document.getElementById("rec-email-substep-request");
    const subVer = document.getElementById("rec-email-substep-verify");
    if (subReq) subReq.style.display = "none";
    if (subVer) subVer.style.display = "block";

    const noticeEl = document.getElementById("rec-pin-display-notice");
    if (noticeEl) {
      noticeEl.innerHTML = `Código PIN gerado com sucesso: <strong>${res.pin}</strong> (anote este código para redefinir sua senha).`;
    }
  } else {
    showRecMsg(msgEl, res.message || "E-mail não encontrado.", "error");
  }
};

window.submitRecoveryWithPin = async function() {
  const pin = document.getElementById("rec-pin-code").value.trim();
  const pass1 = document.getElementById("rec-new-pass-pin").value.trim();
  const pass2 = document.getElementById("rec-confirm-pass-pin").value.trim();
  const msgEl = document.getElementById("rec-pin-msg");

  if (!pin || pin.length !== 6) {
    showRecMsg(msgEl, "Digite o código PIN de 6 dígitos.", "error");
    return;
  }
  if (!pass1 || pass1.length < 6) {
    showRecMsg(msgEl, "A nova senha deve ter no mínimo 6 caracteres.", "error");
    return;
  }
  if (pass1 !== pass2) {
    showRecMsg(msgEl, "As senhas digitadas não coincidem.", "error");
    return;
  }

  showRecMsg(msgEl, "Validando PIN e redefinindo senha...", "info");

  const res = await VIPAuth.resetPasswordWithPin(pin, pass1);
  if (res.success) {
    showRecMsg(msgEl, "Senha redefinida com sucesso! Entrando no painel...", "success");
    setTimeout(() => {
      closeRecoveryModal();
      checkSession();
    }, 1200);
  } else {
    showRecMsg(msgEl, res.message || "Código PIN inválido ou expirado.", "error");
  }
};

function showRecMsg(el, text, type) {
  if (!el) return;
  el.style.display = "block";
  if (type === "error") {
    el.style.background = "#fee2e2";
    el.style.color = "#991b1b";
    el.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${text}`;
  } else if (type === "success") {
    el.style.background = "#ecfdf5";
    el.style.color = "#047857";
    el.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${text}`;
  } else {
    el.style.background = "#eff6ff";
    el.style.color = "#1d4ed8";
    el.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${text}`;
  }
}

// ==========================================
// 1.1 CONTROLE DO MENU LATERAL INTELIGENTE (CORTINA)
// ==========================================
window.toggleSidebarMenu = function(forceState) {
  const container = document.getElementById("admin-layout-container");
  const quickText = document.getElementById("quick-curtain-text");
  if (!container) return;

  const isMobile = window.innerWidth <= 992;

  if (isMobile) {
    if (typeof forceState === "boolean") {
      if (forceState) container.classList.add("sidebar-mobile-open");
      else container.classList.remove("sidebar-mobile-open");
    } else {
      container.classList.toggle("sidebar-mobile-open");
    }
  } else {
    if (typeof forceState === "boolean") {
      if (forceState) container.classList.remove("sidebar-collapsed");
      else container.classList.add("sidebar-collapsed");
    } else {
      container.classList.toggle("sidebar-collapsed");
    }

    const isCollapsed = container.classList.contains("sidebar-collapsed");
    try {
      localStorage.setItem("vip_admin_sidebar_collapsed", isCollapsed ? "true" : "false");
    } catch (e) {}

    if (quickText) {
      quickText.textContent = isCollapsed ? "Ver Menu" : "Ocultar Menu";
    }
  }
};

function initSidebarMenuState() {
  const container = document.getElementById("admin-layout-container");
  const quickText = document.getElementById("quick-curtain-text");
  if (!container) return;

  try {
    const wasCollapsed = localStorage.getItem("vip_admin_sidebar_collapsed") === "true";
    if (wasCollapsed && window.innerWidth > 992) {
      container.classList.add("sidebar-collapsed");
      if (quickText) quickText.textContent = "Ver Menu";
    }
  } catch (e) {}

  initPanoramicBodyCurtainListener();
}

// ==========================================
// 1.2 AUTO-RECOLHIMENTO DA CORTINA AO CLICAR NO CORPO PANORÂMICO
// ==========================================
function initPanoramicBodyCurtainListener() {
  const mainContent = document.getElementById("admin-main-content");
  if (!mainContent || mainContent.dataset.curtainListenerBound) return;

  mainContent.dataset.curtainListenerBound = "true";

  // Captura o clique em qualquer parte do corpo panorâmico
  mainContent.addEventListener("click", () => {
    const container = document.getElementById("admin-layout-container");
    if (!container) return;

    const isMobile = window.innerWidth <= 992;
    if (isMobile) {
      if (container.classList.contains("sidebar-mobile-open")) {
        toggleSidebarMenu(false);
      }
    } else {
      // No desktop: se a cortina lateral estiver aberta, recolhe automaticamente para liberar a visão panorâmica
      if (!container.classList.contains("sidebar-collapsed")) {
        toggleSidebarMenu(false);
      }
    }
  }, true);
}

// Inicializa a escuta no corpo panorâmico imediatamente
initPanoramicBodyCurtainListener();

// ==========================================
// 2. NAVEGAÇÃO DE ABAS DO PAINEL (MENU LATERAL)
// ==========================================
window.switchTab = function(targetTab) {
  const btn = document.querySelector(`.adm-tab-btn[data-tab="${targetTab}"]`);
  if (btn) {
    btn.click();
  } else {
    document.querySelectorAll(".adm-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".adm-tab-pane").forEach(p => p.classList.remove("active"));
    const pane = document.getElementById(`tab-${targetTab}`);
    if (pane) pane.classList.add("active");
  }
};

document.querySelectorAll(".adm-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".adm-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".adm-tab-pane").forEach(p => p.classList.remove("active"));

    btn.classList.add("active");
    const target = btn.dataset.tab;
    const targetPane = document.getElementById(`tab-${target}`);
    if (targetPane) targetPane.classList.add("active");

    // Fecha a cortina no mobile automaticamente ao clicar no item
    if (window.innerWidth <= 992) {
      toggleSidebarMenu(false);
    }

    if (target === "caixa") {
      if (typeof renderCashClosingView === "function") {
        renderCashClosingView();
      }
    }

    if (target === "motoboys") {
      if (typeof renderMotoboysView === "function") {
        renderMotoboysView();
      }
    }

    if (target === "customers") {
      if (typeof renderCustomersCRMView === "function") {
        renderCustomersCRMView();
      }
    }

    if (target === "delivery") {
      setTimeout(() => {
        if (window.deliveryMap) {
          window.deliveryMap.invalidateSize();
        } else {
          initDeliveryMap();
        }
      }, 150);
    }

    if (target === "settings") {
      const activeBtn = document.querySelector(".settings-subtab-btn.active");
      const activeSubtab = activeBtn ? activeBtn.dataset.subtab : "store";
      switchSettingsSubtab(activeSubtab);
    }
  });
});

// ==========================================
// 2.0 NAVEGAÇÃO DE SUBMENUS DAS CONFIGURAÇÕES
// ==========================================
window.switchSettingsSubtab = function(subtabName) {
  const targetSubtab = subtabName || "store";
  document.querySelectorAll(".settings-subtab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.subtab === targetSubtab);
  });
  document.querySelectorAll(".settings-subpane").forEach(pane => {
    pane.classList.toggle("active", pane.id === `subtab-pane-${targetSubtab}`);
  });

  if (targetSubtab === "printer") {
    populatePrinterSettings(false);
    if (typeof window.updatePrinterLivePreview === "function") {
      setTimeout(() => window.updatePrinterLivePreview(), 60);
    }
  } else if (targetSubtab === "store") {
    populateSettingsForm(false);
  }
};

function loadAllData() {
  renderLiveOrders();
  renderFlavorsTable();
  renderKitsTable();
  renderCombosTable();
  renderSaucesTable();
  renderCategoriesTable();
  renderProductsTable();
  renderDeliveryModule();
  if (typeof renderMotoboysView === "function") {
    renderMotoboysView();
  }
  if (typeof updateMotoboyBadgeCount === "function") {
    updateMotoboyBadgeCount();
  }
  if (typeof renderCustomersCRMView === "function") {
    renderCustomersCRMView();
  }
  if (typeof updateCustomersBadgeCount === "function") {
    updateCustomersBadgeCount();
  }
  populateSettingsForm(false);
  populatePrinterSettings(false);
}
window.renderAllModules = loadAllData;

// ==============================================================================
// 2.1 MÓDULO DE PEDIDOS AO VIVO, STATUS, ATRASO & IMPRESSÃO TÉRMICA
// ==============================================================================
let currentOrderFilter = "todos";
let orderSearchTerm = "";
let activeModalOrderId = null;
const knownOrderIds = new Set();
let liveOrdersInterval = null;

// Inicializa o monitoramento contínuo de novos pedidos (executado uma única vez)
function initOrdersWatcher() {
  if (window._adminWatcherInitialized) return;
  window._adminWatcherInitialized = true;

  const orders = VIPDatabase.getOrders();
  orders.forEach(o => knownOrderIds.add(o.id));

  // Inicializa o Supabase (Nuvem em Tempo Real)
  if (typeof VIPDatabase.initSupabase === "function") {
    VIPDatabase.initSupabase().then(success => {
      updateSupabasePillStatus(success ? "SUBSCRIBED" : "OFFLINE");
    });
  }

  // Verifica se o Agente Local de Spooler está rodando no computador
  if (typeof checkPrintAgentStatus === "function") {
    checkPrintAgentStatus();
  }

  if (!liveOrdersInterval) {
    liveOrdersInterval = setInterval(async () => {
      // 1. Sincroniza ativamente com a Nuvem Supabase (garantia total de recebimento mesmo com oscilações no Realtime)
      if (typeof VIPDatabase.syncOrdersFromSupabase === "function") {
        try {
          await VIPDatabase.syncOrdersFromSupabase();
        } catch(e) {}
      }
      // 2. Verifica novos pedidos e atualiza timers
      checkIncomingLiveOrders();
      updateLiveElapsedTimers();
    }, 3500);
  }

  // Sincronização entre abas e eventos do Supabase Realtime (registrados apenas uma vez)
  if (!window._adminWatcherEventsBound) {
    window._adminWatcherEventsBound = true;

    // Canal Broadcast para comunicação instantânea entre abas no mesmo navegador
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const bc = new BroadcastChannel("salgados_vip_bus");
        bc.onmessage = (ev) => {
          if (ev.data && ev.data.type === "NEW_ORDER") {
            console.log("[BroadcastChannel] Pedido recebido instantaneamente via barramento local:", ev.data.order?.id);
            checkIncomingLiveOrders();
            renderLiveOrders();
          }
        };
      } catch(e) {}
    }

    window.removeEventListener("storage", handleOrdersStorageEvent);
    window.addEventListener("storage", handleOrdersStorageEvent);

    window.addEventListener("vip_order_received", (e) => {
      checkIncomingLiveOrders();
      renderLiveOrders();
    });

    window.addEventListener("vip_orders_updated", () => {
      checkIncomingLiveOrders();
      renderLiveOrders();
    });

    window.addEventListener("vip_supabase_status", (e) => {
      updateSupabasePillStatus(e.detail?.status);
    });

    window.addEventListener("vip_supabase_synced", () => {
      // Atualiza tabelas e listas da nuvem sem reiniciar watchers nem sobrescrever campos em digitação
      renderLiveOrders();
      renderFlavorsTable();
      renderKitsTable();
      renderCombosTable();
      renderSaucesTable();
      renderCategoriesTable();
      renderProductsTable();
      renderDeliveryModule();
      populateSettingsForm(false);
      populatePrinterSettings(false);
    });
  }
}

function updateSupabasePillStatus(status) {
  const pill = document.getElementById("supabase-status-pill");
  if (!pill) return;
  if (status === "SUBSCRIBED" || status === "ONLINE" || status === true) {
    pill.className = "badge badge-success";
    pill.style.background = "#e8f5e9";
    pill.style.color = "#2e7d32";
    pill.innerHTML = '<i class="fa-solid fa-circle-check"></i> Conectado e Ativo (Tempo Real)';
  } else if (status === "TIMED_OUT" || status === "CHANNEL_ERROR" || status === "CLOSED") {
    pill.className = "badge badge-warning";
    pill.style.background = "#fef3c7";
    pill.style.color = "#b45309";
    pill.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Reconectando...';
  } else {
    pill.className = "badge";
    pill.style.background = "#f1f5f9";
    pill.style.color = "#64748b";
    pill.innerHTML = '<i class="fa-solid fa-database"></i> Modo Nuvem (Sincronizado)';
  }
}

window.syncSupabaseUI = async function() {
  const msg = document.getElementById("supabase-feedback-msg");
  if (msg) {
    msg.style.display = "block";
    msg.style.color = "#2563eb";
    msg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando todos os dados com o Supabase...';
  }

  const res = await VIPDatabase.initSupabase();
  if (msg) {
    if (res) {
      msg.style.color = "#16a34a";
      msg.innerHTML = '<i class="fa-solid fa-circle-check"></i> <strong>Sincronização concluída com sucesso!</strong> Todos os dados estão alinhados na nuvem.';
    } else {
      msg.style.color = "#dc2626";
      msg.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Não foi possível sincronizar agora. Verifique sua conexão.';
    }
    setTimeout(() => { if (msg) msg.style.display = "none"; }, 5000);
  }
};

window.testSupabaseConnectionUI = async function() {
  const msg = document.getElementById("supabase-feedback-msg");
  if (msg) {
    msg.style.display = "block";
    msg.style.color = "#2563eb";
    msg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testando conexão com o projeto Supabase...';
  }

  const result = await VIPDatabase.testSupabaseConnection();
  if (msg) {
    if (result.success) {
      msg.style.color = "#16a34a";
      msg.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>Conexão bem-sucedida!</strong> Banco PostgreSQL 17 ativo e respondendo na nuvem.`;
    } else {
      msg.style.color = "#dc2626";
      msg.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> <strong>Falha na conexão:</strong> ${result.message}`;
    }
    setTimeout(() => { if (msg) msg.style.display = "none"; }, 6000);
  }
};

function handleOrdersStorageEvent(e) {
  if (e.key === "salgados_vip_orders") {
    checkIncomingLiveOrders();
    renderLiveOrders();
  }
}

// Emite aviso sonoro (Web Audio API - sem necessidade de arquivos externos)
function playNewOrderChime() {
  const cfg = VIPDatabase.getPrinterConfig();
  if (!cfg.soundAlert) return;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Nota 1 (Ré5 - 587.33Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Nota 2 (Lá5 - 880.00Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880.00, now + 0.16);
    gain2.gain.setValueAtTime(0.35, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.16);
    osc2.stop(now + 0.6);
  } catch (err) {
    console.warn("Áudio de notificação bloqueado pelo navegador:", err);
  }
}

// Fila inteligente de auto-impressão para garantir que pedidos em lote sejam todos impressos ordenadamente
let printQueue = [];
let isProcessingPrintQueue = false;

function processPrintQueue() {
  if (isProcessingPrintQueue || printQueue.length === 0) return;
  isProcessingPrintQueue = true;
  const nextOrderId = printQueue.shift();

  try {
    printOrderReceipt(nextOrderId, true);
  } catch (err) {
    console.error("Erro na impressão do pedido da fila:", err);
  }

  // Intervalo suave de 1400ms para a impressora física processar cada via
  setTimeout(() => {
    isProcessingPrintQueue = false;
    if (printQueue.length > 0) {
      processPrintQueue();
    }
  }, 1400);
}

function enqueueAutoPrint(orderId) {
  if (!printQueue.includes(orderId)) {
    printQueue.push(orderId);
  }
  processPrintQueue();
}

// Verifica novos pedidos e dispara auto-print imediato
function checkIncomingLiveOrders() {
  const orders = VIPDatabase.getOrders();
  const printerCfg = VIPDatabase.getPrinterConfig();
  let hasNew = false;
  let ordersToAutoPrint = [];

  orders.forEach(order => {
    if (!knownOrderIds.has(order.id)) {
      knownOrderIds.add(order.id);
      hasNew = true;
      if (order.status === "novo" && !order.printedAt && printerCfg.autoPrintNewOrders !== false) {
        ordersToAutoPrint.push(order);
      }
    }
  });

  if (hasNew) {
    if (printerCfg.soundAlert !== false) {
      playNewOrderChime();
    }
    renderLiveOrders();

    if (ordersToAutoPrint.length > 0) {
      ordersToAutoPrint.forEach(ord => enqueueAutoPrint(ord.id));
    }
  }
}

// Calcula tempo decorrido e estado de atraso (considerando pedidos imediatos ou agendados)
function getOrderTiming(order) {
  const printerCfg = VIPDatabase.getPrinterConfig();
  const targetPrepTime = printerCfg.targetPrepTimeMinutes || 35;
  const now = Date.now();
  const elapsedMinutes = Math.max(0, Math.floor((now - order.createdAt) / 60000));
  const isFinalized = order.status === "pronto" || order.status === "concluido" || order.status === "cancelado";

  const isScheduled = order.timingType === "agendado" && order.scheduledDate && order.scheduledTime;
  let scheduledTimestamp = null;
  let isScheduledFuture = false;

  if (isScheduled) {
    try {
      scheduledTimestamp = new Date(`${order.scheduledDate}T${order.scheduledTime}:00`).getTime();
      if (!isNaN(scheduledTimestamp) && now < scheduledTimestamp) {
        isScheduledFuture = true;
      }
    } catch (e) {
      // Ignorar erro de parsing
    }
  }

  let isDelayed = false;
  let delayMinutes = 0;

  if (!isFinalized) {
    if (isScheduled && scheduledTimestamp && !isNaN(scheduledTimestamp)) {
      if (now > scheduledTimestamp) {
        delayMinutes = Math.floor((now - scheduledTimestamp) / 60000);
        if (delayMinutes > 0) {
          isDelayed = true;
        }
      }
    } else {
      if (elapsedMinutes > targetPrepTime) {
        isDelayed = true;
        delayMinutes = elapsedMinutes - targetPrepTime;
      }
    }
  }

  let timerText = "";
  if (isScheduled) {
    if (isScheduledFuture) {
      timerText = `📅 Agendado`;
    } else {
      timerText = isDelayed ? `⚠️ +${delayMinutes}m atraso` : `⏱️ No horário`;
    }
  } else {
    timerText = `⏱️ ${elapsedMinutes} min`;
  }

  return { elapsedMinutes, targetPrepTime, isDelayed, delayMinutes, isScheduled, isScheduledFuture, scheduledTimestamp, timerText };
}

// Atualização leve dos contadores de tempo na tela
function updateLiveElapsedTimers() {
  const timerEls = document.querySelectorAll("[data-order-elapsed-id]");
  timerEls.forEach(el => {
    const orderId = el.dataset.orderElapsedId;
    const orders = VIPDatabase.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const timing = getOrderTiming(order);
    el.textContent = timing.timerText;

    const cardEl = document.getElementById(`order-card-${orderId}`);
    if (cardEl) {
      if (timing.isDelayed) {
        cardEl.classList.add("is-delayed");
        const delayBadge = cardEl.querySelector(".card-delay-slot");
        if (delayBadge) {
          delayBadge.innerHTML = `<span class="badge-delay-pill"><i class="fa-solid fa-triangle-exclamation"></i> ATRASADO (+${timing.delayMinutes}m)</span>`;
        }
      } else {
        cardEl.classList.remove("is-delayed");
        const delayBadge = cardEl.querySelector(".card-delay-slot");
        if (delayBadge) delayBadge.innerHTML = "";
      }
    }
  });
}

// Filtro de status
window.filterOrdersBy = function(filterName) {
  currentOrderFilter = filterName;

  document.querySelectorAll(".order-filter-pill").forEach(p => {
    p.classList.toggle("active", p.dataset.filter === filterName);
  });

  renderLiveOrders();
};

window.onOrderSearchChange = function() {
  orderSearchTerm = document.getElementById("order-search-input").value.trim().toLowerCase();
  renderLiveOrders();
};

// ==============================================================================
// DETECÇÃO DE BEBIDAS E DESTAQUES DE COBRANÇA PARA MOTOBOY
// ==============================================================================
function isOrderDrinkItem(item) {
  if (!item) return false;
  const name = item.name || "";
  const catId = item.categoryId;

  if (catId) {
    const cats = typeof VIPDatabase !== "undefined" && VIPDatabase.getCategories ? VIPDatabase.getCategories() : [];
    const cat = cats.find(c => c.id === catId);
    if (cat && /bebida|refrigerante|suco|cerveja|água|agua/i.test(cat.name)) {
      return true;
    }
  }

  if (item.productId) {
    const prods = typeof VIPDatabase !== "undefined" && VIPDatabase.getProducts ? VIPDatabase.getProducts() : [];
    const p = prods.find(prod => prod.id === item.productId);
    if (p && p.categoryId) {
      const cats = typeof VIPDatabase !== "undefined" && VIPDatabase.getCategories ? VIPDatabase.getCategories() : [];
      const cat = cats.find(c => c.id === p.categoryId);
      if (cat && /bebida|refrigerante|suco|cerveja|água|agua/i.test(cat.name)) {
        return true;
      }
    }
  }

  const drinkRegex = /coca|guaran[aá]|refrigerante|suco|água|agua|fanta|bebida|cerveja|lata|2l|1\.5l|500ml|350ml|garrafa|matte|mate|pepsi|sprite|soda|schweppes|h2oh|heineken|antarctica|gelad/i;
  return drinkRegex.test(name);
}

function extractOrderDrinks(order) {
  const drinks = [];
  if (!order || !Array.isArray(order.items)) return drinks;

  order.items.forEach(item => {
    if (item.type === "product") {
      if (isOrderDrinkItem(item)) {
        drinks.push({
          name: item.name,
          quantity: item.quantity || 1,
          source: "Avulso"
        });
      }
    } else if (item.type === "combo") {
      (item.items || []).forEach(ci => {
        if (ci.type === "product" || isOrderDrinkItem(ci)) {
          drinks.push({
            name: ci.name,
            quantity: ci.quantity || 1,
            source: item.name || "Combo"
          });
        }
      });
    }
  });

  return drinks;
}

function getMotoboyPaymentInfo(order) {
  const method = (order.paymentMethod || "Não informado").trim();
  const total = order.totalAmount || order.subtotal || 0;
  const isDelivery = order.fulfillment === "Entrega";
  const roleTitle = isDelivery ? "MOTOBOY / ENTREGA" : "BALCÃO / ATENDIMENTO";

  const lower = method.toLowerCase();
  let paymentType = "outro";
  let title = `COBRAR DO CLIENTE`;
  let instruction = "";
  let badgeText = method;
  let changeAlert = "";

  if (lower.includes("dinheiro")) {
    paymentType = "dinheiro";
    title = `RECEBER EM DINHEIRO`;
    badgeText = "💵 DINHEIRO (RECEBER NO ATO)";

    if (order.cashChangeFor) {
      const cleaned = String(order.cashChangeFor).replace(/[^\d.,]/g, "").replace(",", ".");
      const changeVal = parseFloat(cleaned);
      if (!isNaN(changeVal) && changeVal > total) {
        const toGive = changeVal - total;
        changeAlert = `
          <div class="receipt-change-highlight">
            <div class="change-line-title">*** ⚠️ LEVAR TROCO NA CARTEIRA ***</div>
            <div class="change-line-detail">Troco solicitado para: <strong>${formatBRL(changeVal)}</strong></div>
            <div class="change-line-action">DEVOLVER DE TROCO: <strong>${formatBRL(toGive)}</strong></div>
          </div>
        `;
      } else {
        changeAlert = `
          <div class="receipt-change-highlight">
            <div class="change-line-title">*** ⚠️ LEVAR TROCO ***</div>
            <div class="change-line-detail">Troco solicitado para: <strong>${order.cashChangeFor}</strong></div>
          </div>
        `;
      }
    } else {
      changeAlert = `
        <div class="receipt-change-highlight no-change">
          <div class="change-line-detail">>>> NÃO PRECISA DE TROCO (DINHEIRO EXATO) &lt;&lt;&lt;</div>
        </div>
      `;
    }
    instruction = `RECEBER DO CLIENTE: <strong>${formatBRL(total)}</strong> EM ESPÉCIE`;
  } else if (lower.includes("cartão") || lower.includes("cartao") || lower.includes("crédito") || lower.includes("débito")) {
    paymentType = "cartao";
    title = `COBRAR NO CARTÃO`;
    badgeText = "💳 CARTÃO (LEVAR MAQUININHA)";
    instruction = `>>> ⚠️ LEVAR MAQUININHA DE CARTÃO! &lt;&lt;&lt;<br>PASSAR NA MÁQUINA: <strong>${formatBRL(total)}</strong> (Débito/Crédito)`;
  } else if (lower.includes("pix")) {
    paymentType = "pix";
    title = `PAGAMENTO PIX`;
    badgeText = "⚡ PIX (CONFERIR PAGAMENTO)";
    instruction = `>>> ⚠️ ATENÇÃO: CONFERIR O PIX! &lt;&lt;&lt;<br>Checar se o cliente já enviou o comprovante no WhatsApp<br>ou solicitar a comprovação na entrega.<br>VALOR TOTAL: <strong>${formatBRL(total)}</strong>`;
  } else {
    badgeText = method.toUpperCase();
    instruction = `RECEBER DO CLIENTE: <strong>${formatBRL(total)}</strong> (${method})`;
  }

  return {
    isDelivery,
    roleTitle,
    paymentType,
    title,
    badgeText,
    instruction,
    changeAlert,
    totalFormatted: formatBRL(total)
  };
}

// ==============================================================================
// GESTÃO DO QUADRO KANBAN DE PEDIDOS AO VIVO (EM UMA ÚNICA TELA)
// ==============================================================================
let currentOrdersDateFilter = "hoje"; // 'hoje' ou 'todos'
let onlyDelayedOrdersFilter = false;

// Verifica se o pedido pertence ao dia de hoje
function isOrderFromToday(order) {
  if (!order) return false;

  // REGRA CRÍTICA: Pedidos ativos em aberto (novo, em_preparo, pronto) DEVEM sempre aparecer no Kanban para a cozinha não perder!
  if (order.status === "novo" || order.status === "em_preparo" || order.status === "pronto") {
    return true;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();

  // Pedidos agendados para a data de hoje
  if (order.timingType === "agendado" && order.scheduledDate) {
    const todayISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    if (order.scheduledDate === todayISO) return true;
  }

  // Pedidos criados hoje
  if (order.createdAt) {
    const d = new Date(order.createdAt);
    if (!isNaN(d.getTime())) {
      if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === date) {
        return true;
      }
    }
  }

  // Se o pedido não tiver timestamps ou data explícita, exibe por segurança
  if (!order.createdAt && !order.scheduledDate) return true;

  return false;
}

window.setOrdersDateFilter = function(filter) {
  currentOrdersDateFilter = filter;
  const btnToday = document.getElementById("pill-date-today");
  const btnAll = document.getElementById("pill-date-all");
  const infoLabel = document.getElementById("kanban-date-info-label");

  if (btnToday) btnToday.classList.toggle("active", filter === "hoje");
  if (btnAll) btnAll.classList.toggle("active", filter === "todos");

  if (infoLabel) {
    if (filter === "hoje") {
      const todayStr = new Date().toLocaleDateString("pt-BR");
      infoLabel.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #059669;"></i> Exibindo apenas pedidos de hoje (<strong>${todayStr}</strong>)`;
    } else {
      infoLabel.innerHTML = `<i class="fa-solid fa-calendar-days" style="color: #0284c7;"></i> Exibindo pedidos de <strong>todo o histórico</strong>`;
    }
  }

  renderLiveOrders();
};

window.toggleOnlyDelayedFilter = function() {
  onlyDelayedOrdersFilter = !onlyDelayedOrdersFilter;
  const pillDelay = document.getElementById("pill-filter-delay");
  if (pillDelay) {
    pillDelay.classList.toggle("active", onlyDelayedOrdersFilter);
  }
  renderLiveOrders();
};

window.scrollKanbanTo = function(stage) {
  const col = document.querySelector(`.kanban-col[data-stage="${stage}"]`);
  if (col) {
    col.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    col.classList.add("highlight-col");
    setTimeout(() => col.classList.remove("highlight-col"), 1200);
  }
};

window.revertOrderStatus = function(orderId, event) {
  if (event) event.stopPropagation();
  const orders = VIPDatabase.getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  let prevStatus = "pronto";
  if (order.status === "concluido") prevStatus = "pronto";
  else if (order.status === "pronto") prevStatus = "em_preparo";
  else if (order.status === "em_preparo") prevStatus = "novo";
  window.setOrderStatus(orderId, prevStatus);
};

// Funções de Arrastar e Soltar (Drag & Drop) entre colunas
window.onKanbanDragStart = function(event, orderId) {
  event.dataTransfer.setData("text/plain", orderId);
  event.dataTransfer.effectAllowed = "move";
  const el = document.getElementById(`order-card-${orderId}`);
  if (el) el.classList.add("dragging");
};

window.onKanbanDragEnd = function(event) {
  document.querySelectorAll(".kanban-card.dragging").forEach(c => c.classList.remove("dragging"));
  document.querySelectorAll(".kanban-col.drag-over").forEach(col => col.classList.remove("drag-over"));
};

window.onKanbanDragOver = function(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  const col = event.currentTarget;
  if (col && !col.classList.contains("drag-over")) {
    col.classList.add("drag-over");
  }
};

window.onKanbanDragLeave = function(event) {
  const col = event.currentTarget;
  if (col && !col.contains(event.relatedTarget)) {
    col.classList.remove("drag-over");
  }
};

window.onKanbanDrop = function(event, targetStage) {
  event.preventDefault();
  const col = event.currentTarget;
  if (col) col.classList.remove("drag-over");
  const orderId = event.dataTransfer.getData("text/plain");
  if (!orderId) return;

  const validStages = ["novo", "em_preparo", "pronto", "concluido"];
  if (validStages.includes(targetStage)) {
    window.setOrderStatus(orderId, targetStage);
  }
};

// Renderização principal do Quadro Kanban em 4 Colunas (Em uma única tela)
function renderLiveOrders() {
  const colNovo = document.getElementById("kanban-cards-novo");
  const colPrep = document.getElementById("kanban-cards-em_preparo");
  const colReady = document.getElementById("kanban-cards-pronto");
  const colDone = document.getElementById("kanban-cards-concluido");
  const emptyState = document.getElementById("orders-empty-state");

  if (!colNovo || !colPrep || !colReady || !colDone) return;

  const orders = VIPDatabase.getOrders();

  // Data de hoje formatada
  const todayStr = new Date().toLocaleDateString("pt-BR");
  const elTodayStr = document.getElementById("current-today-str");
  if (elTodayStr) elTodayStr.textContent = todayStr;

  // Separação dos pedidos de hoje vs histórico geral
  const todayOrders = orders.filter(isOrderFromToday);
  const countToday = todayOrders.length;
  const countAll = orders.length;

  const elCountToday = document.getElementById("count-orders-today");
  const elCountAll = document.getElementById("count-orders-all");
  if (elCountToday) elCountToday.textContent = countToday;
  if (elCountAll) elCountAll.textContent = countAll;

  // Filtragem ativa por Data (Padrão: Apenas Hoje)
  let activeList = (currentOrdersDateFilter === "hoje") ? todayOrders : orders;

  // Filtro de Atrasados
  if (onlyDelayedOrdersFilter) {
    activeList = activeList.filter(o => getOrderTiming(o).isDelayed);
  }

  // Filtro por termo de busca em tempo real
  if (orderSearchTerm) {
    activeList = activeList.filter(order => {
      const searchStr = `${order.id} ${order.customer?.name || ""} ${order.customer?.phone || ""} ${order.customer?.address || ""} ${order.paymentMethod || ""} ${order.scheduledDate || ""} ${order.scheduledTime || ""}`.toLowerCase();
      return searchStr.includes(orderSearchTerm);
    });
  }

  // Contadores para as colunas e métricas com base na lista ativa
  let countNovo = 0;
  let countPrep = 0;
  let countReady = 0;
  let countDone = 0;
  let countDelayed = 0;
  let activeRevenue = 0;

  activeList.forEach(order => {
    const timing = getOrderTiming(order);
    if (order.status === "novo") countNovo++;
    else if (order.status === "em_preparo") countPrep++;
    else if (order.status === "pronto") countReady++;
    else if (order.status === "concluido") countDone++;

    if (timing.isDelayed && order.status !== "concluido" && order.status !== "cancelado") {
      countDelayed++;
    }
    if (order.status !== "cancelado") {
      activeRevenue += (order.totalAmount || 0);
    }
  });

  // Atualizar contadores das colunas Kanban
  const elKCountNovo = document.getElementById("kcount-novo");
  const elKCountPrep = document.getElementById("kcount-em_preparo");
  const elKCountReady = document.getElementById("kcount-pronto");
  const elKCountDone = document.getElementById("kcount-concluido");
  if (elKCountNovo) elKCountNovo.textContent = countNovo;
  if (elKCountPrep) elKCountPrep.textContent = countPrep;
  if (elKCountReady) elKCountReady.textContent = countReady;
  if (elKCountDone) elKCountDone.textContent = countDone;

  // Atualizar barra de métricas do topo
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
  if (elMetricRevenue) elMetricRevenue.textContent = formatBRL(activeRevenue);

  // Efeito pulsante no card de atraso se houver pedidos atrasados
  const delayCard = document.querySelector(".metric-delay");
  if (delayCard) {
    if (countDelayed > 0) delayCard.classList.add("has-delays");
    else delayCard.classList.remove("has-delays");
  }

  // Atualizar badge do botão de aba "Pedidos Ao Vivo" (Novos + Em Preparo)
  const navBadge = document.getElementById("nav-orders-count");
  if (navBadge) {
    const activeOrdersCount = countNovo + countPrep;
    navBadge.textContent = activeOrdersCount;
    navBadge.style.display = activeOrdersCount > 0 ? "inline-flex" : "none";
  }

  // Limpar as 4 colunas
  colNovo.innerHTML = "";
  colPrep.innerHTML = "";
  colReady.innerHTML = "";
  colDone.innerHTML = "";

  // Ordenação dentro de cada coluna: atrasados primeiro, depois mais recentes
  const sortedOrders = [...activeList].sort((a, b) => {
    const timingA = getOrderTiming(a);
    const timingB = getOrderTiming(b);
    if (timingA.isDelayed && !timingB.isDelayed) return -1;
    if (!timingA.isDelayed && timingB.isDelayed) return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  // Distribuir pedidos para suas respectivas colunas
  let hasInNovo = false;
  let hasInPrep = false;
  let hasInReady = false;
  let hasInDone = false;

  sortedOrders.forEach(order => {
    const cardEl = renderKanbanCard(order);
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

  // Inserir mensagem de estado vazio em colunas sem pedidos para manter estética limpa
  if (!hasInNovo) {
    colNovo.innerHTML = `<div class="kanban-col-empty"><i class="fa-solid fa-circle-check"></i><span>Sem novos pedidos aguardando</span></div>`;
  }
  if (!hasInPrep) {
    colPrep.innerHTML = `<div class="kanban-col-empty"><i class="fa-solid fa-fire-burner"></i><span>Nenhum pedido em preparo</span></div>`;
  }
  if (!hasInReady) {
    colReady.innerHTML = `<div class="kanban-col-empty"><i class="fa-solid fa-truck-fast"></i><span>Nenhum pedido em entrega / pronto p/ retirar</span></div>`;
  }
  if (!hasInDone) {
    colDone.innerHTML = `<div class="kanban-col-empty"><i class="fa-solid fa-circle-check"></i><span>Nenhum pedido finalizado hoje</span></div>`;
  }

  // Exibir ou ocultar banner de lista vazia geral
  if (emptyState) {
    if (activeList.length === 0) {
      emptyState.style.display = "block";
      const titleEl = document.getElementById("empty-state-title");
      const descEl = document.getElementById("empty-state-desc");
      if (currentOrdersDateFilter === "hoje") {
        if (titleEl) titleEl.textContent = `Nenhum pedido registrado hoje (${todayStr})`;
        if (descEl) descEl.textContent = `Assim que novos pedidos forem realizados, eles aparecerão na coluna "Recebidos" automaticamente.`;
      } else {
        if (titleEl) titleEl.textContent = "Nenhum pedido encontrado";
        if (descEl) descEl.textContent = "Verifique os termos da busca ou clique em 'Pedidos de Hoje'.";
      }
    } else {
      emptyState.style.display = "none";
    }
  }
}

// Criação do Elemento Card para o Kanban
function renderKanbanCard(order) {
  const timing = getOrderTiming(order);
  const card = document.createElement("div");
  card.className = `kanban-card ${timing.isDelayed ? "is-delayed" : ""}`;
  card.id = `order-card-${order.id}`;
  card.setAttribute("data-order-id", order.id);
  card.draggable = true;
  card.setAttribute("ondragstart", `onKanbanDragStart(event, '${order.id}')`);
  card.setAttribute("ondragend", "onKanbanDragEnd(event)");

  // Badges de Atendimento (Entrega vs Retirada)
  const isDelivery = order.fulfillment === "Entrega";
  const fulfillmentBadge = isDelivery
    ? `<span class="kanban-tag-delivery" title="Entrega em domicílio"><i class="fa-solid fa-motorcycle"></i> Entrega${order.deliveryDistanceKm ? ` (${order.deliveryDistanceKm.toFixed(1)}km)` : ''}</span>`
    : `<span class="kanban-tag-pickup" title="Retirada no balcão"><i class="fa-solid fa-store"></i> Balcão</span>`;

  // Detecção de Bebidas
  const orderDrinks = extractOrderDrinks(order);
  const totalDrinksCount = orderDrinks.reduce((acc, d) => acc + (d.quantity || 1), 0);
  const drinkTag = totalDrinksCount > 0
    ? `<span class="kanban-tag-drink" title="Contém ${totalDrinksCount} bebida(s) gelada(s)!"><i class="fa-solid fa-bottle-water"></i> Bebida (${totalDrinksCount})</span>`
    : "";

  // Agendamento
  const schedTag = order.timingType === "agendado"
    ? `<span class="kanban-tag-sched" title="Pedido agendado"><i class="fa-solid fa-calendar-days"></i> ${order.scheduledDateTimeFormatted || (order.scheduledDate + ' ' + (order.scheduledTime || ''))}</span>`
    : "";

  // Tag de WhatsApp já enviado
  let waSentHtml = "";
  if (order.lastWhatsAppSent) {
    const sentTime = new Date(order.lastWhatsAppSent.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    waSentHtml = `<span class="card-wa-sent-tag" title="Último aviso WhatsApp enviado às ${sentTime}"><i class="fa-brands fa-whatsapp"></i> ${sentTime}</span>`;
  }

  // Tag de Atraso
  const delayBadgeHtml = timing.isDelayed
    ? `<span class="badge-delay-pill"><i class="fa-solid fa-triangle-exclamation"></i> +${timing.delayMinutes}m</span>`
    : "";

  // Resumo de Itens do Pedido
  let itemsSummaryHtml = "";
  (order.items || []).forEach(item => {
    if (item.type === "kit") {
      const flv = (item.flavors || []).map(f => `${f.quantity}x ${f.name}`).join(", ");
      itemsSummaryHtml += `<div class="order-item-line"><span>📦 <strong>${item.kitName || "Kit Salgados"}</strong> <small>(${flv})</small></span></div>`;
    } else if (item.type === "combo") {
      itemsSummaryHtml += `<div class="order-item-line"><span>🔥 <strong>${item.name || "Combo"}</strong></span></div>`;
    } else {
      itemsSummaryHtml += `<div class="order-item-line"><span>🥤 <strong>${item.quantity || 1}x ${item.name}</strong></span></div>`;
    }
  });

  // Forma de Pagamento e Destaques
  const payInfo = getMotoboyPaymentInfo(order);
  let paySummary = order.paymentMethod || "Não informado";
  if (order.cashChangeFor) {
    paySummary += ` (Troco: ${order.cashChangeFor})`;
  }

  // Seção de Promoção de Status (O Botão Principal na Base do Card)
  let promotionHtml = "";
  if (order.status === "novo") {
    promotionHtml = `
      <button type="button" class="btn-kanban-promote btn-promote-prep" onclick="advanceOrderStatus('${order.id}', event)" title="Iniciar preparo do pedido">
        <i class="fa-solid fa-play"></i> Iniciar preparo
      </button>
    `;
  } else if (order.status === "em_preparo") {
    promotionHtml = `
      <button type="button" class="btn-kanban-promote btn-promote-ready" onclick="advanceOrderStatus('${order.id}', event)" title="Pronto para entrega ou retirada">
        <i class="fa-solid fa-truck-fast"></i> Pronto / Despachar
      </button>
    `;
  } else if (order.status === "pronto") {
    promotionHtml = `
      <button type="button" class="btn-kanban-promote btn-promote-dispatch" onclick="advanceOrderStatus('${order.id}', event)" title="Marcar como entregue">
        <i class="fa-solid fa-circle-check"></i> Entregue
      </button>
    `;
  } else {
    promotionHtml = `
      <div class="kanban-done-footer">
        <span class="badge-done-today"><i class="fa-solid fa-circle-check"></i> Concluído</span>
        <button type="button" class="btn-kanban-undo" onclick="revertOrderStatus('${order.id}', event)" title="Desfazer e retornar para etapa anterior">
          <i class="fa-solid fa-rotate-left"></i> Desfazer
        </button>
      </div>
    `;
  }

  // Tag de Entregador (Motoboy)
  let motoboyTagHtml = "";
  if (isDelivery) {
    if (order.deliveryMan) {
      const cleanPhone = (order.deliveryMan.phone || "").replace(/\D/g, "");
      const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : "javascript:void(0)";
      motoboyTagHtml = `
        <div class="kanban-motoboy-badge" onclick="event.stopPropagation(); openDispatchMotoboyModal('${order.id}')" title="Clique para trocar o motoboy">
          <i class="fa-solid fa-motorcycle"></i>
          <span>${order.deliveryMan.name} (R$ ${(Number(order.deliveryMan.fee) || 7).toFixed(2).replace('.', ',')})</span>
          ${cleanPhone ? `<a href="${waLink}" target="_blank" onclick="event.stopPropagation()" title="Falar com o entregador no WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>` : ''}
        </div>
      `;
    } else if (order.status === "pronto" || order.status === "em_preparo") {
      motoboyTagHtml = `
        <button type="button" class="kanban-assign-motoboy-btn" onclick="event.stopPropagation(); openDispatchMotoboyModal('${order.id}')" title="Atribuir motoboy a esta entrega">
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
        <span class="kanban-card-customer" title="${order.customer?.name || 'Cliente'}">${order.customer?.name || 'Cliente'}</span>
      </div>
      ${fulfillmentBadge}
    </div>

    <div class="kanban-card-tags">
      ${drinkTag}
      ${schedTag}
      ${motoboyTagHtml}
    </div>

    <div class="kanban-card-timebar">
      <span class="kanban-card-elapsed ${timing.isDelayed ? 'is-delayed' : ''}" data-order-elapsed-id="${order.id}">
        ${timing.timerText}
      </span>
      <div style="display:flex; align-items:center; gap:5px;">
        <span class="card-delay-slot">${delayBadgeHtml}</span>
        ${waSentHtml}
      </div>
    </div>

    <div class="kanban-card-items" onclick="openOrderDetails('${order.id}')" title="Clique para ver os detalhes completos do pedido">
      ${itemsSummaryHtml || '<span style="color:#94a3b8; font-style:italic;">Sem itens listados</span>'}
    </div>

    <div class="kanban-card-footer">
      <div>
        <div class="kanban-card-price">${formatBRL(order.totalAmount || 0)}</div>
        <span class="kanban-card-pay-badge" title="${paySummary}">${paySummary}</span>
      </div>
      <div class="kanban-quick-actions">
        <button type="button" class="btn-kanban-icon" onclick="printOrderReceipt('${order.id}', false); event.stopPropagation();" title="Imprimir Comanda Térmica">
          <i class="fa-solid fa-print"></i>
        </button>
        <button type="button" class="btn-kanban-icon btn-wa-icon ${order.lastWhatsAppSent ? 'has-sent' : ''}" onclick="openWhatsAppNotifyModal('${order.id}', event)" title="Notificar cliente via WhatsApp">
          <i class="fa-brands fa-whatsapp"></i>
        </button>
        <button type="button" class="btn-kanban-icon" onclick="openOrderDetails('${order.id}')" title="Ver Detalhes do Pedido">
          <i class="fa-solid fa-eye"></i>
        </button>
      </div>
    </div>

    ${promotionHtml}
  `;

  return card;
}

// ==============================================================================
// GESTÃO DE NOTIFICAÇÕES DE STATUS VIA WHATSAPP PARA CLIENTES (HÍBRIDO: SILENCIOSO & WEB)
// ==============================================================================
let activeWhatsAppNotifyOrderId = null;
let activeWhatsAppTemplateKey = "confirmado";

// ==============================================================================
// CENTRAL DE GATEWAY DE WHATSAPP EM NUVEM (EVOLUTION API / Z-API / BAILEYS CLOUD)
// 100% Funcional e Silencioso em qualquer computador, tablet, celular ou Netlify
// Não depende de nenhum computador Windows ligado localmente!
// As credenciais e a sessão são sincronizadas globalmente via Supabase store_settings.
// ==============================================================================
const VIPWhatsAppGateway = {
  ENDPOINT_LOCAL: "http://127.0.0.1:18182",
  config: {
    provider: "evolution", // "evolution", "zapi", "custom", "simulator"
    serverUrl: "",
    instanceName: "salgadosvip",
    apiKey: "",
    connected: false,
    phone: "",
    status: "disconnected", // "disconnected", "qr_ready", "connected"
    lastConnectedAt: null
  },
  isChecking: false,
  pollTimer: null,
  qrCountdownTimer: null,

  // Inicializa e carrega credenciais da nuvem Supabase e do localStorage
  async init() {
    this.loadLocalConfig();
    await this.syncFromSupabase();
    this.updateUIConfigFields();
  },

  loadLocalConfig() {
    try {
      const saved = localStorage.getItem("salgados_vip_wa_cloud_config");
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = { ...this.config, ...parsed };
      }
    } catch (e) {
      console.warn("[WhatsApp Gateway] Falha ao carregar do localStorage:", e);
    }
  },

  async syncFromSupabase() {
    try {
      const sb = typeof getSupabaseClient === "function" ? getSupabaseClient() : null;
      if (!sb) return;

      const { data: row } = await sb.from("store_settings")
        .select("value, updated_at")
        .eq("id", "whatsapp_cloud_gateway")
        .maybeSingle();

      if (row && row.value) {
        this.config = { ...this.config, ...row.value };
        localStorage.setItem("salgados_vip_wa_cloud_config", JSON.stringify(this.config));
      }
    } catch (err) {
      console.warn("[WhatsApp Gateway] Falha ao sincronizar do Supabase:", err);
    }
  },

  async saveConfig(newConfig, syncSupabase = true) {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem("salgados_vip_wa_cloud_config", JSON.stringify(this.config));
    } catch (e) {}

    if (syncSupabase) {
      try {
        const sb = typeof getSupabaseClient === "function" ? getSupabaseClient() : null;
        if (sb) {
          await sb.from("store_settings").upsert({
            id: "whatsapp_cloud_gateway",
            value: this.config,
            updated_at: new Date().toISOString()
          });
        }
      } catch (err) {
        console.warn("[WhatsApp Gateway] Erro ao salvar no Supabase:", err);
      }
    }
  },

  updateUIConfigFields() {
    const provEvolution = document.getElementById("btn-provider-evolution");
    const provZapi = document.getElementById("btn-provider-zapi");
    const provCustom = document.getElementById("btn-provider-custom");
    const provSimulator = document.getElementById("btn-provider-simulator");

    const pills = [
      { id: "evolution", el: provEvolution },
      { id: "zapi", el: provZapi },
      { id: "custom", el: provCustom },
      { id: "simulator", el: provSimulator }
    ];

    pills.forEach(p => {
      if (p.el) {
        if (p.id === this.config.provider) {
          p.el.classList.add("active");
        } else {
          p.el.classList.remove("active");
        }
      }
    });

    const urlInput = document.getElementById("cfg-wa-cloud-url");
    const instInput = document.getElementById("cfg-wa-cloud-instance");
    const tokenInput = document.getElementById("cfg-wa-cloud-token");
    const instCol = document.getElementById("cfg-wa-instance-col");

    if (urlInput && this.config.serverUrl) urlInput.value = this.config.serverUrl;
    if (instInput && this.config.instanceName) instInput.value = this.config.instanceName;
    if (tokenInput && this.config.apiKey) tokenInput.value = this.config.apiKey;

    if (instCol) {
      instCol.style.display = this.config.provider === "zapi" ? "none" : "block";
    }
  },

  cleanBaseUrl(url) {
    if (!url) return "";
    let u = url.trim();
    if (!u.startsWith("http://") && !u.startsWith("https://")) {
      u = "https://" + u;
    }
    return u.replace(/\/+$/, "");
  },

  cleanPhone(phone) {
    if (!phone) return "";
    let digits = String(phone).replace(/\D/g, "");
    if (digits.length === 10 || digits.length === 11) {
      digits = "55" + digits;
    }
    return digits;
  },

  // Consulta status atual da conexão em nuvem ou local
  async checkStatus() {
    if (this.isChecking) return this.lastStatus;
    this.isChecking = true;
    try {
      const provider = this.config.provider || "evolution";
      const serverUrl = this.cleanBaseUrl(this.config.serverUrl);
      const instance = (this.config.instanceName || "salgadosvip").trim();
      const apiKey = (this.config.apiKey || "").trim();

      // 1. MODO SIMULADO / DEMONSTRAÇÃO
      if (provider === "simulator") {
        if (this.config.connected) {
          this.lastStatus = {
            online: true,
            connected: true,
            mode: "cloud",
            provider: "simulator",
            phone: this.config.phone || "+55 (21) 98675-8102 (Demonstração)",
            instance: "modo-simulado"
          };
          return this.lastStatus;
        }
        this.lastStatus = {
          online: true,
          connected: false,
          status: this.config.status || "disconnected",
          mode: "cloud",
          provider: "simulator"
        };
        return this.lastStatus;
      }

      // 2. EVOLUTION API (v1 / v2)
      if (provider === "evolution" && serverUrl && apiKey) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(`${serverUrl}/instance/connectionState/${instance}`, {
            headers: { "apikey": apiKey },
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            const state = data?.instance?.state || data?.state;
            const isOpen = state === "open";

            if (isOpen) {
              this.config.connected = true;
              this.config.status = "connected";
              this.lastStatus = {
                online: true,
                connected: true,
                mode: "cloud",
                provider: "evolution",
                phone: this.config.phone || "Instância Conectada",
                instance: instance
              };
              return this.lastStatus;
            } else if (state === "connecting") {
              this.lastStatus = {
                online: true,
                connected: false,
                status: "qr_ready",
                mode: "cloud",
                provider: "evolution"
              };
              return this.lastStatus;
            }
          }
        } catch (errEv) {
          // Timeout ou erro de rede no gateway
        }
      }

      // 3. Z-API
      if (provider === "zapi" && serverUrl) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          const headers = {};
          if (apiKey) headers["Client-Token"] = apiKey;

          const res = await fetch(`${serverUrl}/status`, {
            headers,
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            if (data && data.connected) {
              this.config.connected = true;
              this.config.status = "connected";
              if (data.phone) this.config.phone = data.phone;
              this.lastStatus = {
                online: true,
                connected: true,
                mode: "cloud",
                provider: "zapi",
                phone: data.phone || this.config.phone || "Z-API Conectada",
                instance: instance
              };
              return this.lastStatus;
            }
          }
        } catch (errZ) {}
      }

      // 4. Se a nuvem marcou anteriormente como conectada (verificação rápida para manter estado)
      if (this.config.connected && !serverUrl) {
        this.lastStatus = {
          online: true,
          connected: true,
          mode: "cloud",
          provider: this.config.provider,
          phone: this.config.phone || "Conectado",
          instance: this.config.instanceName
        };
        return this.lastStatus;
      }

      // 5. Fallback opcional para serviço local caso exista no PC
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        const resLocal = await fetch(`${this.ENDPOINT_LOCAL}/status`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (resLocal.ok) {
          const localData = await resLocal.json();
          if (localData.connected) {
            this.lastStatus = { ...localData, mode: "local" };
            return this.lastStatus;
          }
        }
      } catch (e) {}

      // 6. Totalmente desconectado
      this.lastStatus = {
        online: false,
        connected: false,
        status: "disconnected",
        mode: "offline"
      };
      return this.lastStatus;
    } finally {
      this.isChecking = false;
    }
  },

  // Inicia conexão e gera QR Code
  async connectAndShowQR() {
    const provider = this.config.provider || "evolution";
    const serverUrl = this.cleanBaseUrl(this.config.serverUrl);
    const instance = (this.config.instanceName || "salgadosvip").trim();
    const apiKey = (this.config.apiKey || "").trim();

    const paneOffline = document.getElementById("wa-silent-status-offline");
    const paneQr = document.getElementById("wa-silent-status-qr");
    const paneConnected = document.getElementById("wa-silent-status-connected");
    const qrImg = document.getElementById("wa-silent-qr-img");
    const badgeEl = document.getElementById("wa-silent-global-badge");
    const instLabel = document.getElementById("wa-qr-instance-label");

    if (instLabel) instLabel.innerText = instance || provider;

    if (provider === "simulator") {
      // Gera QR Code simulado
      if (paneOffline) paneOffline.style.display = "none";
      if (paneConnected) paneConnected.style.display = "none";
      if (paneQr) paneQr.style.display = "block";
      if (badgeEl) {
        badgeEl.className = "wa-status-pill qr";
        badgeEl.innerHTML = `<i class="fa-solid fa-qrcode"></i> QR Pronto (Simulado)`;
      }

      const dummyCode = "SALGADOS_VIP_DEMO_" + Date.now();
      if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(dummyCode)}`;
      }

      this.startCountdown(45);

      // Simula conexão automática após 6 segundos
      setTimeout(async () => {
        await this.saveConfig({
          connected: true,
          status: "connected",
          phone: "+55 (21) 98675-8102"
        });
        this.stopPollingAndTimers();
        await window.checkWhatsAppSilentServiceStatus(true);
        if (typeof showToastNotification === "function") {
          showToastNotification("✓ WhatsApp Conectado com Sucesso na Nuvem (Modo Simulado)!");
        }
      }, 6000);
      return;
    }

    if (!serverUrl) {
      alert("Por favor, preencha a URL da API na nuvem antes de gerar o QR Code (veja o botão 'Como Funciona' para instruções).");
      const urlInput = document.getElementById("cfg-wa-cloud-url");
      if (urlInput) urlInput.focus();
      return;
    }

    if (provider === "evolution" && !apiKey) {
      alert("Por favor, informe a API Key da sua Evolution API.");
      const tokenInput = document.getElementById("cfg-wa-cloud-token");
      if (tokenInput) tokenInput.focus();
      return;
    }

    if (typeof showToastNotification === "function") {
      showToastNotification("Solicitando QR Code ao servidor em nuvem...");
    }

    try {
      let qrSrc = "";

      if (provider === "evolution") {
        try {
          await fetch(`${serverUrl}/instance/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": apiKey },
            body: JSON.stringify({ instanceName: instance, qrcode: true, integration: "WHATSAPP-BAILEYS" })
          });
        } catch (e) {}

        const connRes = await fetch(`${serverUrl}/instance/connect/${instance}`, {
          headers: { "apikey": apiKey }
        });

        if (!connRes.ok) {
          throw new Error(`Servidor Evolution retornou status ${connRes.status}`);
        }

        const connData = await connRes.json();
        const b64 = connData.base64 || connData.qrcode?.base64 || "";
        const code = connData.code || connData.qrcode?.code || "";

        if (b64) {
          qrSrc = b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
        } else if (code) {
          qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(code)}`;
        } else if (connData.state === "open" || connData.instance?.state === "open") {
          await this.saveConfig({ connected: true, status: "connected" });
          await window.checkWhatsAppSilentServiceStatus(true);
          return;
        } else {
          throw new Error("Não foi possível gerar a imagem do QR Code. Verifique se a instância já está aberta no servidor.");
        }
      } else if (provider === "zapi") {
        const headers = {};
        if (apiKey) headers["Client-Token"] = apiKey;
        const zRes = await fetch(`${serverUrl}/qr-code/image`, { headers });
        if (!zRes.ok) throw new Error(`Z-API retornou status ${zRes.status}`);
        const zData = await zRes.json();
        qrSrc = zData.value || zData.image || "";
      }

      if (qrImg && qrSrc) {
        qrImg.src = qrSrc;
      }

      if (paneOffline) paneOffline.style.display = "none";
      if (paneConnected) paneConnected.style.display = "none";
      if (paneQr) paneQr.style.display = "block";
      if (badgeEl) {
        badgeEl.className = "wa-status-pill qr";
        badgeEl.innerHTML = `<i class="fa-solid fa-qrcode"></i> QR Code Pronto`;
      }

      this.startCountdown(60);
      this.startPollingConnection();
    } catch (err) {
      alert("Falha ao conectar com o servidor WhatsApp em nuvem:\n" + err.message);
    }
  },

  startCountdown(seconds) {
    if (this.qrCountdownTimer) clearInterval(this.qrCountdownTimer);
    let remaining = seconds;
    const timerEl = document.getElementById("wa-qr-timer");

    const updateLabel = () => {
      if (timerEl) {
        timerEl.innerHTML = `<i class="fa-regular fa-clock"></i> Expira em ${remaining}s`;
      }
    };
    updateLabel();

    this.qrCountdownTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(this.qrCountdownTimer);
        if (timerEl) {
          timerEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> QR Code Expirado`;
        }
      } else {
        updateLabel();
      }
    }, 1000);
  },

  startPollingConnection() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    let attempts = 0;

    this.pollTimer = setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        this.stopPollingAndTimers();
        return;
      }

      try {
        const status = await this.checkStatus();
        if (status && status.connected) {
          this.stopPollingAndTimers();
          await this.saveConfig({
            connected: true,
            status: "connected",
            phone: status.phone || this.config.phone || "+55 (21) 98675-8102"
          });
          await window.checkWhatsAppSilentServiceStatus(true);
          if (typeof showToastNotification === "function") {
            showToastNotification("✓ WhatsApp Conectado com Sucesso!");
          }
        }
      } catch (e) {}
    }, 2500);
  },

  stopPollingAndTimers() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.qrCountdownTimer) {
      clearInterval(this.qrCountdownTimer);
      this.qrCountdownTimer = null;
    }
  },

  async disconnect() {
    if (!confirm("Deseja realmente desconectar a sessão do WhatsApp?")) return;
    this.stopPollingAndTimers();

    const provider = this.config.provider;
    const serverUrl = this.cleanBaseUrl(this.config.serverUrl);
    const instance = this.config.instanceName;
    const apiKey = this.config.apiKey;

    if (provider === "evolution" && serverUrl && apiKey) {
      try {
        await fetch(`${serverUrl}/instance/logout/${instance}`, {
          method: "DELETE",
          headers: { "apikey": apiKey }
        });
      } catch (e) {}
    } else if (provider === "zapi" && serverUrl) {
      try {
        const headers = apiKey ? { "Client-Token": apiKey } : {};
        await fetch(`${serverUrl}/disconnect`, { headers });
      } catch (e) {}
    }

    await this.saveConfig({
      connected: false,
      status: "disconnected",
      phone: ""
    });

    await window.checkWhatsAppSilentServiceStatus(true);
    if (typeof showToastNotification === "function") {
      showToastNotification("Sessão do WhatsApp desconectada.");
    }
  },

  // Envio Universal Silencioso
  async sendMessage(phone, message, orderId = null, templateKey = null) {
    const cleanNum = this.cleanPhone(phone);
    if (!cleanNum) throw new Error("Número de telefone inválido para envio.");

    const status = await this.checkStatus();

    // 1. Se estiver conectado via Nuvem (Evolution / Z-API / Simulator)
    if (status && status.connected && status.mode === "cloud") {
      const provider = this.config.provider || "evolution";
      const serverUrl = this.cleanBaseUrl(this.config.serverUrl);
      const instance = (this.config.instanceName || "salgadosvip").trim();
      const apiKey = (this.config.apiKey || "").trim();

      // MODO SIMULADO
      if (provider === "simulator") {
        await new Promise(r => setTimeout(r, 600));
        console.log(`[WhatsApp Simulado] Mensagem silenciosa entregue para ${cleanNum}:`, message);
        return { success: true, mode: "cloud", provider: "simulator", phone: cleanNum };
      }

      // EVOLUTION API
      if (provider === "evolution") {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        const res = await fetch(`${serverUrl}/message/sendText/${instance}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": apiKey
          },
          body: JSON.stringify({
            number: cleanNum,
            text: message,
            delay: 1000
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Evolution API erro HTTP ${res.status}: ${errText}`);
        }

        const data = await res.json();
        return { success: true, mode: "cloud", provider: "evolution", phone: cleanNum, response: data };
      }

      // Z-API
      if (provider === "zapi") {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        const headers = { "Content-Type": "application/json" };
        if (apiKey) headers["Client-Token"] = apiKey;

        const res = await fetch(`${serverUrl}/send-text`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            phone: cleanNum,
            message: message
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Z-API erro HTTP ${res.status}: ${errText}`);
        }

        const data = await res.json();
        return { success: true, mode: "cloud", provider: "zapi", phone: cleanNum, response: data };
      }
    }

    // 2. Fallback para serviço local na máquina (se estiver rodando)
    if (status && status.mode === "local" && status.connected) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const res = await fetch(`${this.ENDPOINT_LOCAL}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanNum, message }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Erro HTTP no serviço local: ${res.status}`);
      const data = await res.json();
      return { ...data, mode: "local" };
    }

    throw new Error("Robô de WhatsApp não está conectado no momento.");
  }
};

window.VIPWhatsAppLocalService = VIPWhatsAppGateway;
window.VIPWhatsAppGateway = VIPWhatsAppGateway;

window.selectWhatsAppProvider = function(providerId) {
  VIPWhatsAppGateway.config.provider = providerId;
  VIPWhatsAppGateway.updateUIConfigFields();
  const urlInput = document.getElementById("cfg-wa-cloud-url");
  if (urlInput) {
    if (providerId === "evolution" && !urlInput.value) {
      urlInput.placeholder = "https://api-wa.sua-loja.up.railway.app";
    } else if (providerId === "zapi" && !urlInput.value) {
      urlInput.placeholder = "https://api.z-api.io/instances/ID/token/TOKEN";
    } else if (providerId === "simulator") {
      urlInput.placeholder = "Modo de testes ativo (sem necessidade de servidor)";
    }
  }
};

window.saveWhatsAppCloudConfig = async function(showFeedback = true) {
  const urlInput = document.getElementById("cfg-wa-cloud-url");
  const instInput = document.getElementById("cfg-wa-cloud-instance");
  const tokenInput = document.getElementById("cfg-wa-cloud-token");

  const newCfg = {
    serverUrl: urlInput ? urlInput.value.trim() : "",
    instanceName: instInput ? instInput.value.trim() : "salgadosvip",
    apiKey: tokenInput ? tokenInput.value.trim() : ""
  };

  await VIPWhatsAppGateway.saveConfig(newCfg, true);
  if (showFeedback && typeof showToastNotification === "function") {
    showToastNotification("✓ Configurações de WhatsApp em Nuvem salvas e sincronizadas!");
  }
  await window.checkWhatsAppSilentServiceStatus(false);
};

window.startWhatsAppCloudConnect = async function() {
  await VIPWhatsAppGateway.connectAndShowQR();
};

window.cancelWhatsAppCloudConnect = function() {
  VIPWhatsAppGateway.stopPollingAndTimers();
  const paneOffline = document.getElementById("wa-silent-status-offline");
  const paneQr = document.getElementById("wa-silent-status-qr");
  if (paneQr) paneQr.style.display = "none";
  if (paneOffline) paneOffline.style.display = "block";
  const badgeEl = document.getElementById("wa-silent-global-badge");
  if (badgeEl) {
    badgeEl.className = "wa-status-pill offline";
    badgeEl.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Desconectado`;
  }
};

window.disconnectWhatsAppCloud = async function() {
  await VIPWhatsAppGateway.disconnect();
};

window.openWhatsAppCloudHelpModal = function() {
  const modal = document.getElementById("modal-wa-cloud-help");
  const backdrop = document.getElementById("modal-wa-cloud-help-backdrop");
  if (modal) modal.style.display = "block";
  if (backdrop) backdrop.style.display = "block";
};

window.closeWhatsAppCloudHelpModal = function() {
  const modal = document.getElementById("modal-wa-cloud-help");
  const backdrop = document.getElementById("modal-wa-cloud-help-backdrop");
  if (modal) modal.style.display = "none";
  if (backdrop) backdrop.style.display = "none";
};

// Atualiza a interface do robô silencioso no painel
window.checkWhatsAppSilentServiceStatus = async function(showFeedback = false) {
  const badgeEl = document.getElementById("wa-silent-global-badge");
  const paneOffline = document.getElementById("wa-silent-status-offline");
  const paneQr = document.getElementById("wa-silent-status-qr");
  const paneConnected = document.getElementById("wa-silent-status-connected");
  const phoneBadge = document.getElementById("wa-conn-phone-badge");
  const autoSendCheck = document.getElementById("cfg-wa-auto-send-on-status");

  if (autoSendCheck) {
    autoSendCheck.checked = localStorage.getItem("salgados_vip_wa_auto_send") === "true";
  }

  const status = await VIPWhatsAppGateway.checkStatus();

  if (status && status.connected) {
    if (badgeEl) {
      const modeLabel = status.mode === "cloud" ? "Conectado na Nuvem" : "Robô Conectado";
      badgeEl.className = "wa-status-pill connected";
      badgeEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${modeLabel}`;
    }
    if (phoneBadge) {
      phoneBadge.innerHTML = `<i class="fa-solid fa-phone"></i> ${status.phone || VIPWhatsAppGateway.config.phone || "+55 (21) 98675-8102"}`;
    }
    if (paneConnected) paneConnected.style.display = "block";
    if (paneQr) paneQr.style.display = "none";
    if (paneOffline) paneOffline.style.display = "none";
    if (showFeedback && typeof showToastNotification === "function") {
      showToastNotification("✓ WhatsApp conectado e ativo para envio silencioso em qualquer máquina!");
    }
  } else if (status && status.status === "qr_ready") {
    if (badgeEl) {
      badgeEl.className = "wa-status-pill qr";
      badgeEl.innerHTML = `<i class="fa-solid fa-qrcode"></i> QR Code Pronto`;
    }
    if (paneQr) paneQr.style.display = "block";
    if (paneConnected) paneConnected.style.display = "none";
    if (paneOffline) paneOffline.style.display = "none";
  } else {
    if (badgeEl) {
      badgeEl.className = "wa-status-pill offline";
      badgeEl.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Desconectado`;
    }
    if (paneOffline) paneOffline.style.display = "block";
    if (paneQr) paneQr.style.display = "none";
    if (paneConnected) paneConnected.style.display = "none";
    if (showFeedback && typeof showToastNotification === "function") {
      showToastNotification("WhatsApp desconectado. Clique em 'Gerar QR Code & Conectar'.");
    }
  }
};

window.saveWhatsAppAutoSendSetting = function(checked) {
  localStorage.setItem("salgados_vip_wa_auto_send", checked ? "true" : "false");
  showToastNotification(checked 
    ? "✓ Disparo automático silencioso ao avançar status ATIVADO!" 
    : "Disparo automático desativado. Notificações serão enviadas manualmente.");
};

window.testSilentWhatsAppDispatch = async function() {
  const storeCfg = VIPDatabase.getConfig() || {};
  const defaultPhone = storeCfg.phone || storeCfg.whatsappNumber || "21986758102";
  const phone = prompt("Digite o número de WhatsApp com DDD para o teste de envio silencioso:", defaultPhone);
  if (!phone) return;

  const status = await VIPWhatsAppGateway.checkStatus();
  if (!status || !status.connected) {
    alert("O WhatsApp não está conectado no momento. Clique em 'Gerar QR Code & Conectar' para conectar.");
    return;
  }

  showToastNotification(`Disparando mensagem de teste silenciosa em segundo plano...`);

  try {
    const res = await VIPWhatsAppGateway.sendMessage(
      phone, 
      "🥟 *Salgados VIP Nova Iguaçu*\n\nTeste de mensagem silenciosa em nuvem realizado com sucesso! 🎉\nO robô de atendimento está 100% operacional sem abrir janelas (acessível de qualquer computador ou celular)."
    );
    if (res && res.success) {
      showToastNotification(`✓ Mensagem de teste entregue com sucesso via WhatsApp em segundo plano!`);
    } else {
      alert("Falha no teste: " + (res?.error || "Erro desconhecido"));
    }
  } catch (err) {
    alert("Erro ao enviar: " + err.message);
  }
};

window.launchWhatsAppSilentService = async function() {
  await VIPWhatsAppGateway.connectAndShowQR();
};

window.stopWhatsAppSilentService = async function() {
  await VIPWhatsAppGateway.disconnect();
};


// Toast Universal com suporte a ação clicável
window.showToastNotification = function(text, options = {}) {
  let container = document.getElementById("vip-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "vip-toast-container";
    container.style.cssText = "position:fixed; top:20px; right:20px; z-index:99999; display:flex; flex-direction:column; gap:8px; pointer-events:none; max-width:440px; width:calc(100% - 40px);";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "vip-toast-item";
  toast.style.cssText = "background:#121214; color:#fff; padding:12px 16px; border-radius:10px; font-weight:600; font-size:0.88rem; box-shadow:0 8px 24px rgba(0,0,0,0.3); border-left:4px solid #10b981; display:flex; align-items:center; justify-content:space-between; gap:12px; pointer-events:auto; animation:vipToastIn 0.25s ease;";

  let contentHtml = `<div style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-bell" style="color:#10b981;"></i><span>${text}</span></div>`;
  if (options.actionText && typeof options.onAction === "function") {
    contentHtml += `<button type="button" class="btn-toast-action" style="background:#25D366; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:0.78rem; font-weight:800; cursor:pointer; white-space:nowrap; transition:all 0.15s ease;"><i class="fa-brands fa-whatsapp"></i> ${options.actionText}</button>`;
  }

  toast.innerHTML = contentHtml;

  if (options.actionText && typeof options.onAction === "function") {
    const actBtn = toast.querySelector(".btn-toast-action");
    if (actBtn) {
      actBtn.onclick = () => {
        options.onAction();
        toast.remove();
      };
    }
  }

  container.appendChild(toast);

  const duration = options.duration || 5000;
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 320);
  }, duration);
};

// Abrir modal de notificação
window.openWhatsAppNotifyModal = function(orderId, event, preferredTemplateKey) {
  if (event) event.stopPropagation();

  activeWhatsAppNotifyOrderId = orderId;
  const orders = VIPDatabase.getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const storeCfg = VIPDatabase.getConfig() || {};
  const notifier = window.VIPWhatsAppNotifier;
  if (!notifier) {
    alert("Módulo WhatsApp não carregado. Recarregue a página.");
    return;
  }

  // Preencher dados do cabeçalho
  document.getElementById("wa-notify-title").textContent = `Notificar Cliente via WhatsApp`;
  document.getElementById("wa-notify-subtitle").textContent = `Pedido #${order.id} • ${order.customer?.name || "Cliente"} (${order.fulfillment === "Entrega" ? "Entrega" : "Retirada"})`;
  document.getElementById("wa-notify-customer-name").textContent = order.customer?.name || "Não informado";

  const phoneInput = document.getElementById("wa-notify-customer-phone");
  const rawPhone = order.customer?.phone || "";
  phoneInput.value = notifier.formatPhoneDisplay(rawPhone) || rawPhone;
  onWhatsAppPhoneInputChange();

  // Template sugerido
  activeWhatsAppTemplateKey = preferredTemplateKey || notifier.getSuggestedTemplateKey(order);

  // Renderizar chips de templates
  renderWhatsAppTemplateChips(order, storeCfg);

  // Carregar texto no textarea
  updateWhatsAppMessagePreview(order, storeCfg);

  // Histórico de envios anteriores
  const historyBox = document.getElementById("wa-notify-history-box");
  const historyText = document.getElementById("wa-notify-history-text");
  if (order.lastWhatsAppSent) {
    const sentTime = new Date(order.lastWhatsAppSent.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const tmplName = (order.lastWhatsAppSent.template || "notificação").replace("_", " ").toUpperCase();
    historyBox.style.display = "flex";
    historyText.innerHTML = `Último aviso enviado: <strong>${tmplName}</strong> às <strong>${sentTime}</strong>.`;
  } else {
    historyBox.style.display = "none";
  }

  // Exibir modal
  document.getElementById("modal-whatsapp-notify-backdrop").classList.add("active");
  document.getElementById("modal-whatsapp-notify").classList.add("active");
};

window.closeWhatsAppNotifyModal = function() {
  activeWhatsAppNotifyOrderId = null;
  document.getElementById("modal-whatsapp-notify-backdrop").classList.remove("active");
  document.getElementById("modal-whatsapp-notify").classList.remove("active");
};

// Renderizar chips de seleção de template
function renderWhatsAppTemplateChips(order, storeCfg) {
  const container = document.getElementById("wa-template-chips");
  if (!container) return;

  const notifier = window.VIPWhatsAppNotifier;
  const templates = notifier.getTemplates(order, storeCfg);

  // Determinar lista de templates relevantes
  const isDelivery = order.fulfillment === "Entrega";
  const templateKeys = ["confirmado", "em_preparo", isDelivery ? "saiu_entrega" : "pronto_retirada", "concluido", "cancelado"];

  container.innerHTML = templateKeys.map(key => {
    const t = templates[key];
    if (!t) return "";
    const isActive = (key === activeWhatsAppTemplateKey);
    return `
      <button type="button" class="wa-chip ${isActive ? "active" : ""}" onclick="selectWhatsAppTemplate('${key}')">
        <i class="fa-solid ${t.icon}"></i> ${t.label}
      </button>
    `;
  }).join("");
}

// Selecionar outro template
window.selectWhatsAppTemplate = function(templateKey) {
  activeWhatsAppTemplateKey = templateKey;
  const orders = VIPDatabase.getOrders();
  const order = orders.find(o => o.id === activeWhatsAppNotifyOrderId);
  const storeCfg = VIPDatabase.getConfig() || {};

  renderWhatsAppTemplateChips(order, storeCfg);
  updateWhatsAppMessagePreview(order, storeCfg);
};

// Atualiza o textarea com o texto do template selecionado
function updateWhatsAppMessagePreview(order, storeCfg) {
  const notifier = window.VIPWhatsAppNotifier;
  const templates = notifier.getTemplates(order, storeCfg);
  const tmpl = templates[activeWhatsAppTemplateKey] || templates["confirmado"];

  const textarea = document.getElementById("wa-notify-message-text");
  const charCount = document.getElementById("wa-message-char-count");
  if (textarea && tmpl) {
    textarea.value = tmpl.text;
    if (charCount) charCount.textContent = `${tmpl.text.length} caracteres`;
  }
}

// Validação em tempo real do telefone digitado
window.onWhatsAppPhoneInputChange = function() {
  const input = document.getElementById("wa-notify-customer-phone");
  const badge = document.getElementById("wa-phone-validation-badge");
  const btnSend = document.getElementById("btn-send-wa-message");
  if (!input || !badge) return;

  const notifier = window.VIPWhatsAppNotifier;
  const isValid = notifier.isValidPhone(input.value);

  if (isValid) {
    badge.className = "wa-phone-valid-badge";
    badge.textContent = "Válido";
    if (btnSend) btnSend.disabled = false;
  } else {
    badge.className = "wa-phone-invalid-badge";
    badge.textContent = "Incompleto";
    if (btnSend) btnSend.disabled = true;
  }
};

// Copiar texto da notificação para área de transferência
window.copyWhatsAppNotificationText = function() {
  const textarea = document.getElementById("wa-notify-message-text");
  if (!textarea) return;

  navigator.clipboard.writeText(textarea.value).then(() => {
    showToastNotification("Texto da mensagem copiado com sucesso!");
    const btn = document.getElementById("btn-copy-wa-message");
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = `<i class="fa-solid fa-check"></i> Copiado!`;
      setTimeout(() => { btn.innerHTML = orig; }, 1800);
    }
  }).catch(() => {
    textarea.select();
    document.execCommand("copy");
    showToastNotification("Texto copiado!");
  });
};

// Disparar envio de notificação (Híbrido: tenta envio silencioso primeiro, depois fallback wa.me)
window.triggerSendWhatsAppNotification = async function() {
  const orderId = activeWhatsAppNotifyOrderId;
  const orders = VIPDatabase.getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const phoneInput = document.getElementById("wa-notify-customer-phone");
  const textarea = document.getElementById("wa-notify-message-text");
  const notifier = window.VIPWhatsAppNotifier;

  const phone = phoneInput ? phoneInput.value : (order.customer?.phone || "");
  const message = textarea ? textarea.value : "";

  if (!notifier.isValidPhone(phone)) {
    alert("Por favor, digite um número de WhatsApp válido (DDD + número).");
    if (phoneInput) phoneInput.focus();
    return;
  }

  const btnSend = document.getElementById("btn-send-wa-message");
  const origHtml = btnSend ? btnSend.innerHTML : "";

  // 1. Tentar envio silencioso via robô local ou nuvem (sem abrir nenhuma janela)
  let sentSilently = false;
  try {
    if (btnSend) {
      btnSend.disabled = true;
      btnSend.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Enviando em 2º plano...`;
    }
    const status = await VIPWhatsAppGateway.checkStatus();
    if (status && status.connected) {
      const res = await VIPWhatsAppGateway.sendMessage(phone, message, orderId, activeWhatsAppTemplateKey);
      if (res && res.success) {
        sentSilently = true;
        VIPDatabase.recordOrderWhatsAppNotification(orderId, activeWhatsAppTemplateKey, message);
        closeWhatsAppNotifyModal();
        renderLiveOrders();
        if (activeModalOrderId === orderId) openOrderDetails(orderId);
        const viaText = res.mode === "cloud_queue" ? " (via Nuvem da Loja)" : "";
        showToastNotification(`✓ Mensagem enviada silenciosamente para ${order.customer?.name || "o cliente"}${viaText}!`);
        return;
      }
    }
  } catch (err) {
    console.info("[WhatsApp Silencioso] Serviço automático indisponível, abrindo WhatsApp Web...", err);
  } finally {
    if (btnSend) {
      btnSend.disabled = false;
      btnSend.innerHTML = origHtml;
    }
  }

  // 2. Fallback: abre no WhatsApp Web (wa.me) caso o robô esteja desconectado
  if (!sentSilently) {
    const waUrl = notifier.buildWhatsAppUrl(phone, message);
    if (!waUrl) {
      alert("Erro ao gerar link do WhatsApp.");
      return;
    }

    VIPDatabase.recordOrderWhatsAppNotification(orderId, activeWhatsAppTemplateKey, message);
    window.open(waUrl, "_blank");

    closeWhatsAppNotifyModal();
    renderLiveOrders();
    if (activeModalOrderId === orderId) {
      openOrderDetails(orderId);
    }

    showToastNotification(`WhatsApp Web aberto para ${order.customer?.name || "o cliente"}!`);
  }
};

// Envio rápido com 1 clique (usado dentro do modal de detalhes do pedido)
window.quickSendWhatsAppStatus = async function(orderId, templateKey) {
  const orders = VIPDatabase.getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const notifier = window.VIPWhatsAppNotifier;
  const phone = order.customer?.phone || "";

  if (!notifier.isValidPhone(phone)) {
    // Se o telefone não for válido, abre o modal para o usuário digitar
    openWhatsAppNotifyModal(orderId, null, templateKey);
    return;
  }

  const storeCfg = VIPDatabase.getConfig() || {};
  const templates = notifier.getTemplates(order, storeCfg);
  const tmpl = templates[templateKey] || templates["confirmado"];

  // 1. Tentar envio silencioso em segundo plano (Local ou Nuvem)
  try {
    const status = await VIPWhatsAppGateway.checkStatus();
    if (status && status.connected) {
      showToastNotification(`Enviando mensagem "${tmpl.label}" em segundo plano...`);
      const res = await VIPWhatsAppGateway.sendMessage(phone, tmpl.text, orderId, templateKey);
      if (res && res.success) {
        VIPDatabase.recordOrderWhatsAppNotification(orderId, templateKey, tmpl.text);
        renderLiveOrders();
        if (activeModalOrderId === orderId) openOrderDetails(orderId);
        const viaText = res.mode === "cloud_queue" ? " (via Nuvem da Loja)" : "";
        showToastNotification(`✓ Mensagem "${tmpl.label}" enviada silenciosamente para ${order.customer?.name || "o cliente"}${viaText}!`);
        return;
      }
    }
  } catch (err) {
    console.info("[WhatsApp Silencioso] Fallback para WhatsApp Web:", err);
  }

  // 2. Fallback se serviço estiver offline
  const waUrl = notifier.buildWhatsAppUrl(phone, tmpl.text);
  if (waUrl) {
    VIPDatabase.recordOrderWhatsAppNotification(orderId, templateKey, tmpl.text);
    window.open(waUrl, "_blank");
    renderLiveOrders();
    if (activeModalOrderId === orderId) {
      openOrderDetails(orderId);
    }
    showToastNotification(`WhatsApp Web aberto com mensagem de "${tmpl.label}"!`);
  }
};

// Avanço rápido de status pelo card
window.advanceOrderStatus = async function(orderId, event) {
  if (event) event.stopPropagation();

  const orders = VIPDatabase.getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  let nextStatus = "em_preparo";
  if (order.status === "novo") {
    nextStatus = "em_preparo";
  } else if (order.status === "em_preparo") {
    // Se for Entrega e ainda não possui entregador selecionado, abre o modal de despacho rápido!
    if (order.fulfillment === "Entrega" && !order.deliveryMan) {
      openDispatchMotoboyModal(orderId);
      return;
    }
    nextStatus = "pronto";
  } else if (order.status === "pronto") {
    nextStatus = "concluido";
  }

  VIPDatabase.updateOrderStatus(orderId, nextStatus);
  renderLiveOrders();

  const statusNames = {
    novo: "Recebidos",
    em_preparo: "Empreparo",
    pronto: "Em entrega / Pronto p/ Retirar",
    concluido: "Finalizado"
  };

  const updatedOrder = { ...order, status: nextStatus };
  const suggestedTemplate = window.VIPWhatsAppNotifier 
    ? window.VIPWhatsAppNotifier.getSuggestedTemplateKey(updatedOrder)
    : "confirmado";

  // Se o envio automático silencioso estiver ativado e o robô estiver conectado, envia direto!
  const isAutoSendEnabled = localStorage.getItem("salgados_vip_wa_auto_send") === "true";
  if (isAutoSendEnabled && order.customer?.phone) {
    const status = await VIPWhatsAppGateway.checkStatus();
    if (status && status.connected) {
      quickSendWhatsAppStatus(orderId, suggestedTemplate);
      return;
    }
  }

  showToastNotification(`Status do Pedido #${orderId} alterado para "${statusNames[nextStatus] || nextStatus}"!`, {
    actionText: "Avisar WhatsApp",
    onAction: () => openWhatsAppNotifyModal(orderId, null, suggestedTemplate)
  });
};

// ==============================================================================
// MODAL DE DETALHES COMPLETOS DO PEDIDO
// ==============================================================================
window.openOrderDetails = function(orderId) {
  activeModalOrderId = orderId;
  const orders = VIPDatabase.getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const timing = getOrderTiming(order);

  // Título e Badges no Modal
  document.getElementById("modal-order-title").textContent = `Pedido #${order.id}`;

  const statusBadge = document.getElementById("modal-order-status-badge");
  statusBadge.className = `badge-status-order status-${order.status}`;
  const statusNames = {
    novo: "Recebidos",
    em_preparo: "Empreparo",
    pronto: "Em entrega / Pronto p/ Retirar",
    concluido: "Finalizado",
    cancelado: "Cancelado"
  };
  statusBadge.textContent = statusNames[order.status] || order.status;

  const delayBadge = document.getElementById("modal-order-delay-badge");
  if (timing.isDelayed) {
    delayBadge.style.display = "inline-flex";
    delayBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ATRASADO (+${timing.delayMinutes} min)`;
  } else {
    delayBadge.style.display = "none";
  }

  // Montar conteúdo do corpo do modal
  const contentEl = document.getElementById("modal-order-content");

  const orderDateStr = new Date(order.createdAt).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const rawPhone = (order.customer?.phone || "").replace(/\D/g, "");
  const waPhone = rawPhone.length <= 11 ? `55${rawPhone}` : rawPhone;
  const waText = encodeURIComponent(`Olá ${order.customer?.name || ""}! Aqui é do Salgados VIP Nova Iguaçu referente ao seu Pedido #${order.id}.`);
  const waLink = rawPhone ? `https://wa.me/${waPhone}?text=${waText}` : null;

  // Detalhamento dos itens
  let itemsBreakdownHtml = "";
  (order.items || []).forEach(item => {
    if (item.type === "kit") {
      let flavorListHtml = "";
      (item.flavors || []).forEach(f => {
        flavorListHtml += `<li><strong>${f.quantity}x</strong> ${f.name}</li>`;
      });

      let extraCostHtml = "";
      if (item.flavorExtraCost && item.flavorExtraCost > 0) {
        extraCostHtml = `<div style="font-size:0.8rem; color:#b45309; margin-top:4px;"><strong>+ ${formatBRL(item.flavorExtraCost)}</strong> (Adicional por sabores nobres)</div>`;
      }

      let saucesHtml = "";
      if (item.sauces && item.sauces.length > 0) {
        const sauceItems = item.sauces.map(s => `${s.quantity}x ${s.name} (+${formatBRL(s.subtotal)})`).join(", ");
        saucesHtml = `<div style="font-size:0.8rem; color:#475569; margin-top:4px;">🥫 <strong>Molhos inclusos:</strong> ${sauceItems}</div>`;
      }

      itemsBreakdownHtml += `
        <div class="order-item-box">
          <div class="order-item-head">
            <span>📦 ${item.kitName || "Kit de Salgados"}</span>
            <span>${formatBRL(item.finalPrice || 0)}</span>
          </div>
          <ul class="order-flavor-sublist">
            ${flavorListHtml}
          </ul>
          ${extraCostHtml}
          ${saucesHtml}
        </div>
      `;
    } else if (item.type === "combo") {
      let comboItemsHtml = "";
      (item.items || []).forEach(ci => {
        comboItemsHtml += `<li><strong>${ci.quantity}x</strong> ${ci.name}</li>`;
      });

      itemsBreakdownHtml += `
        <div class="order-item-box" style="border-left: 3px solid #f59e0b;">
          <div class="order-item-head">
            <span>🔥 ${item.name || "Combo Promocional"} <small style="background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; font-size:0.75rem;">${item.discountPercent || 15}% OFF</small></span>
            <span>${formatBRL(item.finalPrice || 0)}</span>
          </div>
          <div style="font-size:0.78rem; color:#059669; font-weight:700; margin-bottom:4px;">
            💰 Cliente economizou ${formatBRL(item.savings || 0)} (Preço avulso: ${formatBRL(item.regularPrice || 0)})
          </div>
          <ul class="order-flavor-sublist">
            ${comboItemsHtml}
          </ul>
        </div>
      `;
    } else {
      itemsBreakdownHtml += `
        <div class="order-item-box">
          <div class="order-item-head">
            <span>🥤 ${item.quantity}x ${item.name}</span>
            <span>${formatBRL((item.price || 0) * (item.quantity || 1))}</span>
          </div>
        </div>
      `;
    }
  });

  const notesHtml = order.notes ? `
    <div class="order-notes-box">
      <strong><i class="fa-solid fa-comment-dots"></i> Observações do Cliente:</strong>
      <p style="margin: 0;">${order.notes}</p>
    </div>
  ` : "";

  const orderDrinks = extractOrderDrinks(order);
  const drinkBannerHtml = orderDrinks.length > 0 ? `
    <div class="modal-drink-warning-box">
      <i class="fa-solid fa-bottle-water" style="font-size:1.6rem;"></i>
      <div>
        <strong>⚠️ ATENÇÃO: NÃO ESQUECER A BEBIDA!</strong><br>
        Este pedido contém <strong>${orderDrinks.reduce((a, b) => a + b.quantity, 0)} bebida(s) gelada(s)</strong>:
        <strong>${orderDrinks.map(d => `${d.quantity}x ${d.name}`).join(", ")}</strong>. Retirar da geladeira antes do despacho!
      </div>
    </div>
  ` : "";

  const payInfo = getMotoboyPaymentInfo(order);
  const paymentAlertHtml = `
    <div class="modal-payment-alert-box is-${payInfo.paymentType}">
      <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 4px;">
        🛵 COBRANÇA (${payInfo.roleTitle}): ${payInfo.badgeText}
      </div>
      <div>
        Total a receber: <strong>${formatBRL(order.totalAmount || 0)}</strong>
      </div>
      <div style="margin-top: 3px;">
        ${payInfo.instruction}
      </div>
      ${payInfo.changeAlert}
    </div>
  `;

  // Painel de Notificações WhatsApp dentro do Modal
  const waSentBadge = order.lastWhatsAppSent 
    ? `<span class="card-wa-sent-tag" style="font-size:0.75rem;"><i class="fa-brands fa-whatsapp"></i> Avisado (${new Date(order.lastWhatsAppSent.sentAt).toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"})})</span>`
    : "";

  const isDeliveryOrder = order.fulfillment === "Entrega";
  const waPanelHtml = `
    <div class="order-whatsapp-quick-panel">
      <div class="wa-panel-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <i class="fa-brands fa-whatsapp" style="color: #25D366; font-size: 1.3rem;"></i>
          <div>
            <strong style="color: #0f172a; font-size: 0.88rem;">Notificar Cliente no WhatsApp</strong>
            <div style="font-size: 0.75rem; color: #64748b;">Disparo rápido com mensagens pré-formatadas ou edição personalizada</div>
          </div>
        </div>
        ${waSentBadge}
      </div>
      <div class="wa-panel-buttons">
        <button type="button" class="btn-wa-action" onclick="quickSendWhatsAppStatus('${order.id}', 'confirmado')" title="Avisar que o pedido foi confirmado">
          🟡 Confirmado
        </button>
        <button type="button" class="btn-wa-action" onclick="quickSendWhatsAppStatus('${order.id}', 'em_preparo')" title="Avisar que está na cozinha preparando">
          👨‍🍳 Na Cozinha
        </button>
        ${isDeliveryOrder ? `
          <button type="button" class="btn-wa-action highlight-ready" onclick="quickSendWhatsAppStatus('${order.id}', 'saiu_entrega')" title="Avisar que saiu com o motoboy">
            🛵 Saiu p/ Entrega
          </button>
        ` : `
          <button type="button" class="btn-wa-action highlight-ready" onclick="quickSendWhatsAppStatus('${order.id}', 'pronto_retirada')" title="Avisar que está pronto para retirada no balcão">
            🏪 Pronto no Balcão
          </button>
        `}
        <button type="button" class="btn-wa-action" onclick="quickSendWhatsAppStatus('${order.id}', 'concluido')" title="Enviar mensagem de agradecimento">
          ❤️ Agradecimento
        </button>
        <button type="button" class="btn-wa-action btn-wa-more" onclick="openWhatsAppNotifyModal('${order.id}')" title="Ver prévia e editar mensagem antes de enviar">
          <i class="fa-solid fa-pen-to-square"></i> Ver / Editar Mensagem
        </button>
      </div>
    </div>
  `;

  contentEl.innerHTML = `
    <!-- Grade de Informações Gerais -->
    <div class="order-detail-grid">
      <div class="order-detail-card">
        <h4><i class="fa-solid fa-user"></i> Dados do Cliente</h4>
        <div class="order-info-row">
          <span>Nome:</span>
          <strong>${order.customer?.name || "Não informado"}</strong>
        </div>
        <div class="order-info-row">
          <span>Telefone:</span>
          <span>
            ${order.customer?.phone || "Não informado"}
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
            ${order.fulfillment === "Entrega" ? (order.customer?.address || "Endereço não informado") : "Rua Isabel Pedrosa, 31, Da Luz, Nova Iguaçu - RJ"}
          </strong>
          ${order.fulfillment === "Entrega" && order.deliveryDistanceKm ? `
            <span style="font-size:0.8rem; color:#0369a1; font-weight:600; margin-top:2px;">
              <i class="fa-solid fa-route"></i> Distância: <strong>${order.deliveryDistanceKm.toFixed(1)} km</strong> da loja ${order.customer?.neighborhood ? `(${order.customer.neighborhood})` : ''}
            </span>
          ` : ''}
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
            <strong>📅 AGENDADO: ${order.scheduledDateTimeFormatted || (order.scheduledDate + ' às ' + order.scheduledTime)}</strong>
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
          <strong style="color: ${timing.isDelayed ? '#dc2626' : '#059669'};">
            ${timing.isDelayed ? `⚠️ ATRASADO (+${timing.delayMinutes} min)` : "✓ No Prazo Regular"}
          </strong>
        </div>
        <div class="order-info-row">
          <span>Comanda Impressa:</span>
          <strong>${order.printedAt ? "Sim (" + new Date(order.printedAt).toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"}) + ")" : "Ainda não impressa"}</strong>
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
        <span>${formatBRL(order.subtotal || order.totalAmount || 0)}</span>
      </div>
      <div class="fin-row">
        <span>Taxa de Entrega${order.deliveryDistanceKm ? ` (${order.deliveryDistanceKm.toFixed(1)} km)` : ""}:</span>
        <span>${order.deliveryFee && order.deliveryFee > 0 ? formatBRL(order.deliveryFee) : "Grátis / Retirada"}</span>
      </div>
      <div class="fin-row">
        <span>Forma de Pagamento:</span>
        <strong>${order.paymentMethod || "Não informado"}</strong>
      </div>
      ${order.pixCode ? `
        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 8px 10px; margin: 8px 0; font-size: 0.82rem;">
          <div style="color: #166534; font-weight: 800; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <i class="fa-brands fa-pix" style="color: #16a34a;"></i> Código Pix Copia e Cola:
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <input type="text" readonly value="${escapeHtml(order.pixCode)}" style="flex: 1; font-family: monospace; font-size: 0.76rem; padding: 4px 8px; border: 1px solid #86efac; border-radius: 6px; background: #fff;" onclick="this.select()">
            <button type="button" class="btn-outline-admin" onclick="navigator.clipboard.writeText('${escapeHtml(order.pixCode)}'); alert('Código Pix copiado!');" style="padding: 4px 8px; font-size: 0.75rem; white-space: nowrap;">
              <i class="fa-solid fa-copy"></i> Copiar
            </button>
          </div>
        </div>
      ` : ""}
      ${order.cashChangeFor ? `
        <div class="fin-row" style="color:#b45309; font-weight:700;">
          <span>Troco solicitado para:</span>
          <span>${order.cashChangeFor}</span>
        </div>
      ` : ""}
      <div class="fin-row fin-total">
        <span>Total a Cobrar:</span>
        <span style="color:#10b981;">${formatBRL(order.totalAmount || 0)}</span>
      </div>
    </div>

    ${paymentAlertHtml}
  `;

  // Renderizar botões de troca rápida de status no rodapé
  const statusBtnsContainer = document.getElementById("modal-order-status-btns");
  const statuses = [
    { key: "novo", label: "🟡 Recebidos" },
    { key: "em_preparo", label: "🔵 Empreparo" },
    { key: "pronto", label: "🟢 Em entrega / Pronto p/ Retirar" },
    { key: "concluido", label: "⚪ Finalizado" },
    { key: "cancelado", label: "🔴 Cancelado" }
  ];

  statusBtnsContainer.innerHTML = statuses.map(s => `
    <button class="btn-status-pill ${order.status === s.key ? "active" : ""}" onclick="setOrderStatus('${order.id}', '${s.key}')">
      ${s.label}
    </button>
  `).join("");

  // Botão de impressão do modal
  const btnPrint = document.getElementById("btn-modal-print-order");
  btnPrint.onclick = () => printOrderReceipt(order.id, false);

  // Abrir Modal
  document.getElementById("modal-order-backdrop").classList.add("active");
  document.getElementById("modal-order").classList.add("active");
};

window.setOrderStatus = async function(orderId, newStatus) {
  VIPDatabase.updateOrderStatus(orderId, newStatus);
  renderLiveOrders();
  if (activeModalOrderId === orderId) {
    openOrderDetails(orderId);
  }

  const orders = VIPDatabase.getOrders();
  const order = orders.find(o => o.id === orderId);
  const statusNames = {
    novo: "Recebidos",
    em_preparo: "Empreparo",
    pronto: "Em entrega / Pronto p/ Retirar",
    concluido: "Finalizado",
    cancelado: "Cancelado"
  };

  const suggestedTemplate = window.VIPWhatsAppNotifier 
    ? window.VIPWhatsAppNotifier.getSuggestedTemplateKey(order || { status: newStatus })
    : "confirmado";

  // Se o envio automático silencioso estiver ativado e o robô estiver conectado, envia direto!
  const isAutoSendEnabled = localStorage.getItem("salgados_vip_wa_auto_send") === "true";
  if (isAutoSendEnabled && order?.customer?.phone) {
    const status = await VIPWhatsAppGateway.checkStatus();
    if (status && status.connected) {
      quickSendWhatsAppStatus(orderId, suggestedTemplate);
      return;
    }
  }

  showToastNotification(`Status alterado para "${statusNames[newStatus] || newStatus}"!`, {
    actionText: "Avisar WhatsApp",
    onAction: () => openWhatsAppNotifyModal(orderId, null, suggestedTemplate)
  });
};

window.closeOrderModal = function() {
  activeModalOrderId = null;
  document.getElementById("modal-order-backdrop").classList.remove("active");
  document.getElementById("modal-order").classList.remove("active");
};

// ==============================================================================
// MOTOR DE IMPRESSÃO TÉRMICA & RECIBOS (DUAL ENGINE: SPOOLER NATIVO & KIOSK HTML)
// ==============================================================================
function buildOrderTextReceipt(order, cfg, printerCfg) {
  const paperWidth = parseInt(printerCfg.textColumns) || (printerCfg.paperWidth === "58mm" ? 30 : 40);
  const marginMm = parseInt(printerCfg.marginSideMm) !== undefined ? parseInt(printerCfg.marginSideMm) : 4;
  const leftPadSpaces = Math.max(1, Math.min(4, Math.floor(marginMm / 1.5)));
  const leftPad = " ".repeat(leftPadSpaces);

  const divider = leftPad + "=".repeat(paperWidth);
  const thinDivider = leftPad + "-".repeat(paperWidth);

  function center(text) {
    if (!text) return "";
    const str = String(text);
    if (str.length >= paperWidth) return leftPad + str.substring(0, paperWidth);
    const pad = Math.floor((paperWidth - str.length) / 2);
    return leftPad + " ".repeat(pad) + str;
  }

  function line(left, right) {
    const l = String(left || "");
    const r = String(right || "");
    const space = paperWidth - l.length - r.length;
    if (space <= 0) return leftPad + (l + " " + r).substring(0, paperWidth);
    return leftPad + l + " ".repeat(space) + r;
  }

  function rawLine(text) {
    return leftPad + String(text || "");
  }

  const orderDateStr = new Date(order.createdAt).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const lines = [];
  lines.push(divider);
  lines.push(center(cfg.name ? cfg.name.toUpperCase() : "SALGADOS VIP"));
  lines.push(center("DELIVERY & BALCAO - NOVA IGUACU"));
  if (cfg.phone) {
    lines.push(center("WhatsApp: " + cfg.phone));
  }
  lines.push(divider);
  lines.push(center(`PEDIDO #${order.id || order.orderId}`));
  lines.push(line("Data/Hora:", orderDateStr));

  const isScheduled = order.timingType === "agendado" && order.scheduledDate && order.scheduledTime;
  if (isScheduled) {
    lines.push(divider);
    lines.push(center("[ PEDIDO AGENDADO ]"));
    lines.push(line("Data Entrega:", order.scheduledDate));
    lines.push(line("Horario Alvo:", order.scheduledTime));
    lines.push(divider);
  } else {
    lines.push(line("Tipo:", "ENTREGA IMEDIATA"));
  }

  lines.push(thinDivider);
  lines.push(center("[ DADOS DO CLIENTE ]"));
  lines.push(line("Cliente:", (order.customer?.name || "Cliente").substring(0, Math.max(12, paperWidth - 10))));
  lines.push(line("Telefone:", order.customer?.phone || "Nao informado"));
  lines.push(line("Modalidade:", order.customer?.fulfillment === "Retirada" ? "RETIRADA NO BALCAO" : "ENTREGA EM DOMICILIO"));

  if (order.customer?.fulfillment !== "Retirada") {
    lines.push(thinDivider);
    lines.push(center("[ ENDERECO DE ENTREGA ]"));
    lines.push(rawLine(order.customer?.address || ""));
    if (order.customer?.reference) {
      lines.push(rawLine("Ref: " + order.customer.reference));
    }
    if (order.customer?.cep) {
      lines.push(rawLine("CEP: " + order.customer.cep));
    }
  }

  const orderDrinks = extractOrderDrinks(order);
  const hasDrinks = orderDrinks.length > 0;
  if (printerCfg.highlightDrinks !== false && hasDrinks) {
    lines.push(divider);
    lines.push(center("*** BEBIDA GELADA NO PEDIDO ***"));
    lines.push(divider);
  }

  lines.push(thinDivider);
  lines.push(center("[ ITENS DO PEDIDO ]"));

  (order.items || []).forEach(item => {
    if (item.type === "kit") {
      lines.push(line(`1x ${item.kitName || "Kit de Salgados"}`, formatBRL(item.finalPrice || 0)));
      (item.flavors || []).forEach(f => {
        lines.push(rawLine(`   - ${f.quantity}x ${f.name}`));
      });
      if (item.sauces && item.sauces.length > 0) {
        const sText = item.sauces.map(s => `${s.quantity}x ${s.name}`).join(", ");
        lines.push(rawLine(`   * Molhos: ${sText}`));
      }
    } else if (item.type === "combo") {
      lines.push(line(`1x ${item.name || "Combo Promocional"}`, formatBRL(item.finalPrice || 0)));
      (item.items || []).forEach(ci => {
        const isDrink = isOrderDrinkItem(ci);
        if (isDrink && printerCfg.highlightDrinks !== false) {
          lines.push(rawLine(`   - [BEBIDA GELADA] ${ci.quantity}x ${ci.name}`));
        } else {
          lines.push(rawLine(`   - ${ci.quantity}x ${ci.name}`));
        }
      });
    } else {
      const isDrink = isOrderDrinkItem(item);
      const prefix = (isDrink && printerCfg.highlightDrinks !== false) ? "[BEBIDA] " : "";
      lines.push(line(`${item.quantity || 1}x ${prefix}${item.name}`, formatBRL((item.price || 0) * (item.quantity || 1))));
    }
  });

  if (printerCfg.highlightDrinks !== false && hasDrinks) {
    lines.push(thinDivider);
    lines.push(center("*** CONFERENCIA DE GELADEIRA ***"));
    orderDrinks.forEach(d => {
      lines.push(rawLine(` [ ] PEGAR: ${d.quantity}x ${d.name}`));
    });
  }

  if (order.customer?.notes) {
    lines.push(thinDivider);
    lines.push(rawLine("OBSERVACOES:"));
    lines.push(rawLine(order.customer.notes));
  }

  lines.push(thinDivider);
  lines.push(line("Subtotal:", formatBRL(order.subtotalAmount || order.totalAmount || 0)));
  if (order.deliveryFee && order.deliveryFee > 0) {
    const kmStr = order.deliveryDistanceKm ? ` (${order.deliveryDistanceKm.toFixed(1)} km)` : "";
    lines.push(line(`Taxa Entrega${kmStr}:`, formatBRL(order.deliveryFee)));
  }
  lines.push(divider);
  lines.push(line("TOTAL DO PEDIDO:", formatBRL(order.totalAmount || 0)));
  lines.push(divider);

  const payMethod = order.paymentMethod || "A Definir";
  lines.push(line("Forma Pagamento:", payMethod));

  if (printerCfg.showMotoboyBox !== false && order.fulfillment === "Entrega") {
    lines.push(divider);
    lines.push(center("*** INSTRUCOES DO MOTOBOY ***"));
    lines.push(line("TOTAL A COBRAR:", formatBRL(order.totalAmount || 0)));
    if (order.motoboyChangeNeeded) {
      lines.push(line("Troco para:", formatBRL(order.changeFor || 0)));
      lines.push(line("LEVAR DE TROCO:", formatBRL(order.changeAmount || 0)));
    }
    lines.push(divider);
  }

  const isPix = order.paymentMethod === "PIX" || String(order.paymentMethod || "").toUpperCase().includes("PIX");
  if (printerCfg.printPixDetails !== false && isPix) {
    lines.push(thinDivider);
    lines.push(center("[ PAGAMENTO VIA PIX ]"));
    lines.push(center("Chave PIX: " + (cfg.pixKey || "(21) 98675-8102")));
    lines.push(center("Favorecido: " + (cfg.name || "Salgados VIP")));
    lines.push(center("Enviar comprovante pelo WhatsApp"));
  }

  lines.push(thinDivider);
  lines.push(center("Obrigado pela preferencia!"));
  lines.push(center(cfg.name || "Salgados VIP"));
  lines.push(thinDivider);
  lines.push("\r\n\r\n\r\n\r\n"); // avanço para guilhotina

  return lines.join("\r\n");
}

window.printOrderReceipt = async function(orderId, isAutoPrint = false) {
  const orders = VIPDatabase.getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const cfg = VIPDatabase.getConfig();
  const printerCfg = VIPDatabase.getPrinterConfig();
  const numCopies = printerCfg.copies || 1;

  // 1. TENTA PRIMEIRO O SERVIÇO DE IMPRESSÃO DIRETA LOCAL DO WINDOWS (SPOOLER NATIVO - ZERO JANELAS)
  try {
    const textReceipt = buildOrderTextReceipt(order, cfg, printerCfg);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const response = await fetch("http://127.0.0.1:18181/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        receiptText: textReceipt,
        copies: numCopies,
        printerName: printerCfg.printerTarget || "windows_default"
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        VIPDatabase.markOrderPrinted(orderId);
        renderLiveOrders();
        checkPrintAgentStatus();
        console.log(`[OK] Pedido #${order.id} impresso diretamente no Spooler sem dialogos.`);
        return;
      }
    }
  } catch (agentErr) {
    // Se o serviço local de spooler não estiver ativo, segue para o motor Kiosk HTML
  }

  // 2. SE O AGENTE LOCAL NÃO ESTIVER ATIVO, USA O MOTOR DE TELA HTML (COM SUPORTE A KIOSK PRINTING)
  const paperClass = printerCfg.paperWidth === "58mm" ? "paper-58mm" : "paper-80mm";
  const orderDateStr = new Date(order.createdAt).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const orderDrinks = extractOrderDrinks(order);
  const hasDrinks = orderDrinks.length > 0;
  const paymentInfo = getMotoboyPaymentInfo(order);

  const receiptArea = document.getElementById("thermal-receipt-area");
  if (!receiptArea) return;
  receiptArea.className = `thermal-receipt-area ${paperClass}`;
  receiptArea.innerHTML = "";

  // Aplicar dimensões, margens e tipografia dinâmicas no elemento de impressão (76mm com margens 2mm & 2mm na bobina 80mm)
  const printableWidthMm = parseInt(printerCfg.printableWidthMm) || (printerCfg.paperWidth === "58mm" ? 50 : 76);
  const marginSideMm = parseInt(printerCfg.marginSideMm) !== undefined ? parseInt(printerCfg.marginSideMm) : 2;

  let fontFam = "'Consolas', 'Courier New', Courier, monospace";
  if (printerCfg.fontFamily === "sans-serif") {
    fontFam = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  } else if (printerCfg.fontFamily === "condensed") {
    fontFam = "'Arial Narrow', 'Franklin Gothic Medium', 'Tw Cen MT', sans-serif";
  }

  let fSize = "11pt";
  if (printerCfg.fontSize === "small") fSize = "9.5pt";
  else if (printerCfg.fontSize === "large") fSize = "12.5pt";
  else if (printerCfg.fontSize === "xlarge") fSize = "14pt";

  let fWeight = "700";
  if (printerCfg.fontWeight === "normal") fWeight = "500";
  else if (printerCfg.fontWeight === "heavy") fWeight = "900";

  let lSpacing = "1.28";
  if (printerCfg.lineSpacing === "compact") lSpacing = "1.15";
  else if (printerCfg.lineSpacing === "spacious") lSpacing = "1.45";

  // Centralização geométrica e dimensionamento exato no papel (margens 2mm & 2mm)
  receiptArea.style.setProperty("width", `${printableWidthMm}mm`, "important");
  receiptArea.style.setProperty("max-width", `${printableWidthMm}mm`, "important");
  receiptArea.style.setProperty("min-width", `${printableWidthMm}mm`, "important");
  receiptArea.style.setProperty("margin-left", "auto", "important");
  receiptArea.style.setProperty("margin-right", "auto", "important");
  receiptArea.style.setProperty("margin-top", "0", "important");
  receiptArea.style.setProperty("margin-bottom", "0", "important");
  receiptArea.style.setProperty("position", "relative", "important");
  receiptArea.style.setProperty("left", "auto", "important");
  receiptArea.style.setProperty("right", "auto", "important");
  receiptArea.style.setProperty("padding-left", `${marginSideMm}mm`, "important");
  receiptArea.style.setProperty("padding-right", `${marginSideMm}mm`, "important");
  receiptArea.style.setProperty("box-sizing", "border-box", "important");
  receiptArea.style.setProperty("text-align", "left", "important");
  receiptArea.style.setProperty("font-family", fontFam, "important");
  receiptArea.style.setProperty("font-size", fSize, "important");
  receiptArea.style.setProperty("font-weight", fWeight, "important");
  receiptArea.style.setProperty("line-height", lSpacing, "important");

  const showLogo = printerCfg.printLogo !== false && cfg.logoUrl;
  const logoHtml = showLogo ? `
    <div class="receipt-logo-wrap" style="text-align: center; margin-bottom: 6px;">
      <img src="${cfg.logoUrl}" alt="Logo" style="max-height: 52px; max-width: 140px; object-fit: contain; filter: grayscale(100%) contrast(150%);">
    </div>
  ` : "";

  for (let copy = 1; copy <= numCopies; copy++) {
    const copyLabel = numCopies > 1
      ? (copy === 1 ? "[ 1ª VIA - COZINHA / PREPARO ]" : "[ 2ª VIA - CLIENTE / ENTREGA ]")
      : "[ VIA COZINHA / CONTROLE ]";

    let itemsTableRows = "";
    (order.items || []).forEach(item => {
      if (item.type === "kit") {
        let flavorLines = "";
        (item.flavors || []).forEach(f => {
          flavorLines += `<div class="receipt-flavor-line"><span class="receipt-flavor-qty">▶ ${f.quantity}x</span> <strong>${f.name.toUpperCase()}</strong></div>`;
        });

        let extrasText = "";
        if (item.flavorExtraCost && item.flavorExtraCost > 0) {
          extrasText += `<div class="receipt-extra-line">★ Adic. nobres: +${formatBRL(item.flavorExtraCost)}</div>`;
        }
        if (item.sauces && item.sauces.length > 0) {
          const sText = item.sauces.map(s => `${s.quantity}x ${s.name}`).join(", ");
          extrasText += `<div class="receipt-extra-line">★ Molhos: ${sText}</div>`;
        }

        itemsTableRows += `
          <tr>
            <td colspan="2" class="receipt-item-desc">1x ${item.kitName || "Kit de Salgados"}</td>
            <td class="receipt-item-price">${formatBRL(item.finalPrice || 0)}</td>
          </tr>
          <tr>
            <td colspan="3" class="receipt-subitems">
              ${flavorLines}
              ${extrasText}
            </td>
          </tr>
        `;
      } else if (item.type === "combo") {
        let comboItemsLines = "";
        (item.items || []).forEach(ci => {
          const isDrink = isOrderDrinkItem(ci);
          if (isDrink && printerCfg.highlightDrinks !== false) {
            comboItemsLines += `<div class="receipt-flavor-line"><span class="receipt-flavor-qty">▶ ${ci.quantity}x</span> 🥤 <strong>[BEBIDA GELADA] ${ci.name.toUpperCase()}</strong> ➔ PEGAR NA GELADEIRA!</div>`;
          } else {
            comboItemsLines += `<div class="receipt-flavor-line"><span class="receipt-flavor-qty">▶ ${ci.quantity}x</span> <strong>${ci.name.toUpperCase()}</strong></div>`;
          }
        });

        itemsTableRows += `
          <tr>
            <td colspan="2" class="receipt-item-desc">1x ${item.name || "Combo Promocional"}</td>
            <td class="receipt-item-price">${formatBRL(item.finalPrice || 0)}</td>
          </tr>
          <tr>
            <td colspan="3" class="receipt-subitems">
              ${comboItemsLines}
              <small>(Economia real: ${formatBRL(item.savings || 0)})</small>
            </td>
          </tr>
        `;
      } else {
        const isDrink = isOrderDrinkItem(item);
        if (isDrink && printerCfg.highlightDrinks !== false) {
          itemsTableRows += `
            <tr class="receipt-drink-item-row">
              <td colspan="2" class="receipt-item-desc receipt-drink-name">
                🥤 [BEBIDA GELADA] ${item.quantity}x ${item.name}
                <span class="receipt-drink-subhighlight">➔ PEGAR NA GELADEIRA ANTES DE ENVIAR</span>
              </td>
              <td class="receipt-item-price">${formatBRL((item.price || 0) * (item.quantity || 1))}</td>
            </tr>
          `;
        } else {
          itemsTableRows += `
            <tr>
              <td colspan="2" class="receipt-item-desc">${item.quantity}x ${item.name}</td>
              <td class="receipt-item-price">${formatBRL((item.price || 0) * (item.quantity || 1))}</td>
            </tr>
          `;
        }
      }
    });

    const drinksChecklistBox = (printerCfg.highlightDrinks !== false && hasDrinks) ? `
      <div class="receipt-drinks-checklist-box">
        <div class="drinks-checklist-title">*** 🥤 ATENÇÃO: NÃO ESQUECER A BEBIDA! ***</div>
        <div class="drinks-checklist-sub">RETIRAR DA GELADEIRA ANTES DE ENTREGAR AO MOTOBOY:</div>
        <div class="drinks-checklist-items">
          ${orderDrinks.map(d => `<div class="drinks-chk-item">[ ] 👉 <strong>${d.quantity}x ${d.name}</strong></div>`).join("")}
        </div>
      </div>
    ` : "";

    const motoboyPaymentBox = (printerCfg.showMotoboyBox !== false && order.fulfillment === "Entrega") ? `
      <div class="receipt-motoboy-box">
        <div class="motoboy-box-header">*** ATENÇÃO ${paymentInfo.roleTitle} ***</div>
        <div class="motoboy-box-badge">${paymentInfo.badgeText}</div>
        <div class="motoboy-box-amount">TOTAL A COBRAR: ${paymentInfo.totalFormatted}</div>
        <div class="motoboy-box-instructions">
          ${paymentInfo.instruction}
        </div>
        ${paymentInfo.changeAlert}
        ${(printerCfg.highlightDrinks !== false && hasDrinks) ? `
          <div class="motoboy-drink-check">
            [ ] CONFERIU A BEBIDA NA BAG? (🥤 ${orderDrinks.reduce((a, b) => a + b.quantity, 0)} item(ns) gelado(s))
          </div>
        ` : ""}
      </div>
    ` : "";

    const isPix = order.paymentMethod === "PIX" || String(order.paymentMethod || "").toUpperCase().includes("PIX");
    const pixBoxHtml = (printerCfg.printPixDetails !== false && isPix) ? `
      <div class="receipt-pix-box">
        <strong>*** PAGAMENTO VIA PIX ***</strong><br>
        <span>Chave: <strong>${cfg.pixKey || "(21) 98675-8102"}</strong></span><br>
        <span>Favorecido: ${cfg.name || "Salgados VIP"}</span><br>
        <small>Favor enviar o comprovante no WhatsApp da loja</small>
      </div>
    ` : "";

    const copyHtml = `
      <div class="receipt-copy" style="margin-bottom: 25px;">
        <div class="receipt-header">
          ${logoHtml}
          <h2>${(cfg.name || "SALGADOS VIP").toUpperCase()}</h2>
          <p>NOVA IGUAÇU - RIO DE JANEIRO</p>
          <p>Rua Isabel Pedrosa, 31 - Da Luz</p>
          <p>WhatsApp: ${cfg.phone || "(21) 98675-8102"}</p>
          <div style="margin-top: 4px; text-align: center;"><span class="receipt-via-badge">[ ${copyLabel} ]</span></div>
        </div>

        <div class="receipt-order-meta">
          <div class="row" style="font-size: 11pt; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 4px;">
            <span><strong>PEDIDO:</strong> #${order.id}</span>
            <span><strong>DATA:</strong> ${orderDateStr}</span>
          </div>
          <div class="row">
            <span><strong>CLIENTE:</strong> ${order.customer?.name || "Cliente"}</span>
          </div>
          <div class="row">
            <span><strong>CONTATO:</strong> ${order.customer?.phone || "-"}</span>
          </div>
          <div class="row" style="margin-top: 3px;">
            <span><strong>TIPO:</strong> ${order.fulfillment === "Entrega" ? "🛵 MOTO ENTREGA" : "🏪 RETIRADA BALCÃO"}</span>
          </div>
          ${order.timingType === "agendado" ? `
            <div style="border: 2px solid #000; padding: 4px; text-align: center; margin: 5px 0; font-weight: bold; font-size: 10pt; box-sizing: border-box; width: 100%;">
              *** PEDIDO AGENDADO ***<br>
              PARA: ${order.scheduledDateTimeFormatted || (order.scheduledDate + ' AS ' + order.scheduledTime)}
            </div>
          ` : `
            <div class="row" style="margin-top: 2px;">
              <span><strong>PREVISÃO:</strong> IMEDIATO / AGORA</span>
            </div>
          `}
          ${(printerCfg.highlightDrinks !== false && hasDrinks) ? `
            <div class="receipt-drink-pill-banner">
              *** 🥤 PEDIDO CONTÉM BEBIDA GELADA (${orderDrinks.reduce((a, b) => a + b.quantity, 0)} UN) ***
            </div>
          ` : ""}
          ${order.fulfillment === "Entrega" ? `
            <div style="margin-top: 3px; border-top: 1px dotted #888; padding-top: 3px;">
              <strong>ENDEREÇO DE ENTREGA:</strong><br>
              ${order.customer?.address || "Não informado"}
              ${order.deliveryDistanceKm ? `<br><small><strong>DISTÂNCIA ESTIMADA:</strong> ${order.deliveryDistanceKm.toFixed(1)} km ${order.customer?.neighborhood ? `(${order.customer.neighborhood})` : ''}</small>` : ""}
            </div>
          ` : `
            <div style="margin-top: 3px; border-top: 1px dotted #888; padding-top: 3px;">
              <strong>LOCAL:</strong> Retirada na Loja Da Luz
            </div>
          `}
        </div>

        <div class="receipt-divider"></div>
        <div class="receipt-section-title">ITENS DO PEDIDO</div>

        <table class="receipt-items-table">
          ${itemsTableRows}
        </table>

        ${drinksChecklistBox}

        ${order.notes ? `
          <div class="receipt-divider"></div>
          <div>
            <strong>OBSERVAÇÕES:</strong><br>
            ${order.notes}
          </div>
        ` : ""}

        <div class="receipt-totals">
          <div class="row">
            <span>SUBTOTAL:</span>
            <span>${formatBRL(order.subtotal || order.totalAmount || 0)}</span>
          </div>
          <div class="row">
            <span>TAXA ENTREGA${order.deliveryDistanceKm ? ` (${order.deliveryDistanceKm.toFixed(1)} km)` : ""}:</span>
            <span>${order.deliveryFee && order.deliveryFee > 0 ? formatBRL(order.deliveryFee) : "R$ 0,00"}</span>
          </div>
          <div class="row total-big">
            <span>TOTAL DO PEDIDO:</span>
            <span>${formatBRL(order.totalAmount || 0)}</span>
          </div>
        </div>

        ${motoboyPaymentBox}
        ${pixBoxHtml}

        <div class="receipt-footer">
          <p>Obrigado pela preferência!</p>
          <p>${cfg.name || "Salgados VIP"} - O Melhor de Nova Iguaçu</p>
        </div>

        ${copy < numCopies 
          ? `<div class="receipt-cut-line">-- CORTE DA BOBINA --</div>` 
          : (printerCfg.autoCutPaper !== false ? `<div style="height: 18mm; border-bottom: 1px dashed #000; text-align: center; font-size: 8pt; padding-top: 8mm; color: #666;">- - - - - - - - - - - - - - - - -</div>` : "")
        }
      </div>
    `;

    receiptArea.innerHTML += copyHtml;
  }

  // Marcar como impresso no banco
  VIPDatabase.markOrderPrinted(orderId);
  renderLiveOrders();

  // Acionar impressão do navegador / impressora térmica instalada
  setTimeout(() => {
    window.print();
  }, 200);
};

// Teste de impressão rápida a partir das configurações
window.testThermalPrint = function() {
  const orders = VIPDatabase.getOrders();
  if (orders.length > 0) {
    printOrderReceipt(orders[0].id, false);
  } else {
    simulateNewOrder();
  }
};

// Simulação de novo pedido em tempo real
window.simulateNewOrder = function() {
  const sampleNames = ["Juliana Rocha", "Marcelo Rezende", "Carla Mendonça", "Felipe Vasconcellos"];
  const randomName = sampleNames[Math.floor(Math.random() * sampleNames.length)];
  const randomNum = Math.floor(100 + Math.random() * 900);

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
        sauces: [
          { name: "Maionese de Alho da Casa", quantity: 1, subtotal: 4.50 }
        ]
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
    notes: "Tocar o interfone 302 e entregar bem quentinho, por favor!",
    cashChangeFor: null,
    status: "novo",
    printedAt: null
  };

  const created = VIPDatabase.addOrder(sampleOrder);
  playNewOrderChime();
  renderLiveOrders();

  const printerCfg = VIPDatabase.getPrinterConfig();
  if (printerCfg.autoPrintNewOrders) {
    setTimeout(() => {
      printOrderReceipt(created.id, true);
    }, 600);
  }

  showToastNotification(`Novo pedido #${created.id} recebido com sucesso!`);
};

// ==========================================
// 2.9 HELPER UNIVERSAL DE FOTOS DOS ITENS (SABORES, KITS, COMBOS, MOLHOS, PRODUTOS)
// ==========================================
window.triggerItemFileInput = function(entity) {
  const fileInput = document.getElementById(`${entity}-file-input`);
  if (fileInput) fileInput.click();
};

window.compressItemImage = function(file, maxWidth = 500, maxHeight = 500, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo selecionado."));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Erro ao decodificar a imagem."));
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

window.compressItemImageBlob = function(file, maxWidth = 600, maxHeight = 600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Erro ao decodificar a imagem."));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Erro ao gerar Blob da imagem."));
        }, "image/jpeg", quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

window.handleItemImageUpload = async function(entity, fileInput) {
  if (!fileInput.files || fileInput.files.length === 0) return;
  const file = fileInput.files[0];
  const emptyState = document.getElementById(`${entity}-image-empty`);
  const previewImg = document.getElementById(`${entity}-image-preview`);
  const originalEmptyHtml = emptyState ? emptyState.innerHTML : "";

  try {
    if (emptyState) {
      emptyState.style.display = "flex";
      emptyState.innerHTML = '<i class="fa-solid fa-cloud-arrow-up fa-fade" style="font-size: 2rem; color: #2563eb; margin-bottom: 6px;"></i><span style="font-size: 0.85rem; color: #2563eb; font-weight: 600;">Enviando para a nuvem Supabase...</span>';
    }
    if (previewImg) previewImg.style.display = "none";

    // 1. Otimiza a imagem em Blob leve (JPEG 600x600)
    const compressedBlob = await compressItemImageBlob(file, 600, 600, 0.85);

    // 2. Faz o upload diretamente para o Banco de Imagens do Supabase Storage
    let publicUrl = "";
    if (typeof VIPDatabase !== "undefined" && typeof VIPDatabase.uploadImageToSupabase === "function") {
      publicUrl = await VIPDatabase.uploadImageToSupabase(compressedBlob, entity);
    }

    if (publicUrl) {
      setItemImageState(entity, publicUrl);
    } else {
      // Fallback base64
      const compressedBase64 = await compressItemImage(file, 500, 500, 0.82);
      setItemImageState(entity, compressedBase64);
    }
    const urlInput = document.getElementById(`${entity}-input-image-url`);
    if (urlInput) urlInput.value = publicUrl || "";
  } catch (err) {
    console.error("[Upload] Erro no upload para o Supabase Storage:", err);
    try {
      const compressedBase64 = await compressItemImage(file, 500, 500, 0.82);
      setItemImageState(entity, compressedBase64);
    } catch (e2) {
      alert("Não foi possível carregar a imagem. Verifique o formato.");
    }
  } finally {
    if (emptyState && originalEmptyHtml) emptyState.innerHTML = originalEmptyHtml;
    fileInput.value = "";
  }
};

window.handleItemImageUrlInput = function(entity, url) {
  const trimmed = (url || "").trim();
  setItemImageState(entity, trimmed);
};

window.removeItemImage = function(entity) {
  setItemImageState(entity, "");
  const urlInput = document.getElementById(`${entity}-input-image-url`);
  if (urlInput) urlInput.value = "";
  const fileInput = document.getElementById(`${entity}-file-input`);
  if (fileInput) fileInput.value = "";
};

window.setItemImageState = function(entity, imageUrl) {
  const hiddenInput = document.getElementById(`${entity}-input-image`);
  const previewImg = document.getElementById(`${entity}-image-preview`);
  const emptyState = document.getElementById(`${entity}-image-empty`);
  const removeBtn = document.getElementById(`${entity}-btn-remove-img`);
  const urlInput = document.getElementById(`${entity}-input-image-url`);

  const trimmed = (imageUrl || "").trim();

  if (hiddenInput) hiddenInput.value = trimmed;

  if (trimmed) {
    if (previewImg) {
      previewImg.src = trimmed;
      previewImg.style.display = "block";
    }
    if (emptyState) emptyState.style.display = "none";
    if (removeBtn) removeBtn.style.display = "inline-flex";
    if (urlInput && !trimmed.startsWith("data:")) {
      urlInput.value = trimmed;
    }
  } else {
    if (previewImg) {
      previewImg.src = "";
      previewImg.style.display = "none";
    }
    if (emptyState) emptyState.style.display = "flex";
    if (removeBtn) removeBtn.style.display = "none";
    if (urlInput) urlInput.value = "";
  }
};

// ==========================================
// SISTEMA UNIVERSAL DE REORDENAÇÃO (DRAG & DROP + BOTÕES ▲▼)
// ==========================================
window._draggedTableItem = null;

function buildDragHandleCell(entityType, index, totalItems, itemName) {
  const isFirst = index === 0;
  const isLast = index === totalItems - 1;
  return `
    <td class="drag-handle-cell">
      <div class="drag-handle-wrap" title="Arraste a linha para reordenar ou use as setas">
        <span class="drag-grip" title="Arraste para reordenar"><i class="fa-solid fa-grip-vertical"></i></span>
        <span class="row-order-index">#${index + 1}</span>
        <div class="drag-quick-arrows">
          <button type="button" class="btn-arrow-move" ${isFirst ? 'disabled' : ''} onclick="moveItemRow('${entityType}', ${index}, -1, event)" title="Mover para cima">
            <i class="fa-solid fa-chevron-up"></i>
          </button>
          <button type="button" class="btn-arrow-move" ${isLast ? 'disabled' : ''} onclick="moveItemRow('${entityType}', ${index}, 1, event)" title="Mover para baixo">
            <i class="fa-solid fa-chevron-down"></i>
          </button>
        </div>
      </div>
    </td>
  `;
}

function attachDraggableRowListeners(tr, entityType, index) {
  tr.draggable = true;
  tr.classList.add("table-row-draggable");
  tr.dataset.entityType = entityType;
  tr.dataset.index = index;

  tr.addEventListener("dragstart", (e) => {
    // Se o clique começou em botão, link, input ou ação, cancela o drag
    if (e.target.closest("button, input, a, select, textarea, .table-actions")) {
      e.preventDefault();
      return;
    }
    window._draggedTableItem = {
      entityType: entityType,
      index: index,
      element: tr
    };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ entityType, index }));
    setTimeout(() => {
      if (tr) tr.classList.add("is-dragging");
    }, 0);
  });

  tr.addEventListener("dragend", () => {
    if (tr) tr.classList.remove("is-dragging");
    document.querySelectorAll(".drag-over-above, .drag-over-below").forEach(el => {
      el.classList.remove("drag-over-above", "drag-over-below");
    });
    window._draggedTableItem = null;
  });

  tr.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!window._draggedTableItem || window._draggedTableItem.entityType !== entityType) {
      return;
    }
    e.dataTransfer.dropEffect = "move";

    const rect = tr.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const isAbove = e.clientY < midY;

    if (isAbove) {
      tr.classList.add("drag-over-above");
      tr.classList.remove("drag-over-below");
    } else {
      tr.classList.add("drag-over-below");
      tr.classList.remove("drag-over-above");
    }
  });

  tr.addEventListener("dragleave", (e) => {
    if (!tr.contains(e.relatedTarget)) {
      tr.classList.remove("drag-over-above", "drag-over-below");
    }
  });

  tr.addEventListener("drop", (e) => {
    e.preventDefault();
    tr.classList.remove("drag-over-above", "drag-over-below");

    if (!window._draggedTableItem || window._draggedTableItem.entityType !== entityType) {
      return;
    }

    const fromIndex = window._draggedTableItem.index;
    const rect = tr.getBoundingClientRect();
    const isAbove = e.clientY < (rect.top + rect.height / 2);
    
    let targetIndex = index;
    if (!isAbove) {
      targetIndex = index + 1;
    }
    if (fromIndex < targetIndex) {
      targetIndex--;
    }

    if (fromIndex !== targetIndex) {
      reorderEntityList(entityType, fromIndex, targetIndex);
    }
  });
}

window.moveItemRow = function(entityType, index, direction, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const targetIndex = index + direction;
  reorderEntityList(entityType, index, targetIndex);
};

function reorderEntityList(entityType, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
  let list = [];
  let saveFn = null;
  let renderFn = null;
  let entityLabel = "Item";

  if (entityType === "flavors") {
    list = VIPDatabase.getFlavors();
    saveFn = (l) => VIPDatabase.saveFlavors(l);
    renderFn = renderFlavorsTable;
    entityLabel = "Sabor";
  } else if (entityType === "kits") {
    list = VIPDatabase.getKits();
    saveFn = (l) => VIPDatabase.saveKits(l);
    renderFn = renderKitsTable;
    entityLabel = "Kit";
  } else if (entityType === "combos") {
    list = VIPDatabase.getCombos();
    saveFn = (l) => VIPDatabase.saveCombos(l);
    renderFn = renderCombosTable;
    entityLabel = "Combo";
  } else if (entityType === "sauces") {
    list = VIPDatabase.getSauces();
    saveFn = (l) => VIPDatabase.saveSauces(l);
    renderFn = renderSaucesTable;
    entityLabel = "Molho";
  } else if (entityType === "categories") {
    list = VIPDatabase.getCategories();
    saveFn = (l) => VIPDatabase.saveCategories(l);
    renderFn = () => {
      renderCategoriesTable();
      renderProductsTable();
    };
    entityLabel = "Categoria";
  } else if (entityType === "products") {
    list = VIPDatabase.getProducts();
    saveFn = (l) => VIPDatabase.saveProducts(l);
    renderFn = renderProductsTable;
    entityLabel = "Produto";
  }

  if (!list || !saveFn || fromIndex >= list.length || toIndex >= list.length) return;

  const [movedItem] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, movedItem);

  // Manter consistência de índice .order nos itens
  list.forEach((item, idx) => {
    item.order = idx + 1;
  });

  saveFn(list);
  if (renderFn) renderFn();

  const itemName = movedItem.name || entityLabel;
  if (typeof showToastNotification === "function") {
    showToastNotification(`✓ ${entityLabel} "${itemName}" movido para a posição #${toIndex + 1}!`);
  }
}

// ==========================================
// 3. GERENCIAMENTO DE SABORES (CRUD)
// ==========================================
function renderFlavorsTable() {
  const tbody = document.getElementById("flavors-table-body");
  const flavors = VIPDatabase.getFlavors();
  tbody.innerHTML = "";

  if (flavors.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 2rem;">Nenhum sabor cadastrado ainda. Clique em "+ Novo Sabor" acima.</td></tr>`;
    return;
  }

  flavors.forEach((flavor, index) => {
    const tr = document.createElement("tr");
    attachDraggableRowListeners(tr, "flavors", index);

    const adicionalText = flavor.adicional_por_10 && flavor.adicional_por_10 > 0
      ? `+ ${formatBRL(flavor.adicional_por_10)}`
      : `<span style="color:#94a3b8;">Padrão (R$ 0)</span>`;

    const limiteText = flavor.limite_quantidade
      ? `<strong>${flavor.limite_quantidade} un</strong>`
      : `<span style="color:#94a3b8;">Sem limite</span>`;

    const statusBadge = flavor.active !== false
      ? `<span class="badge-status-item active"><i class="fa-solid fa-circle-check"></i> Disponível</span>`
      : `<span class="badge-status-item inactive"><i class="fa-solid fa-circle-xmark"></i> Esgotado / Pausado</span>`;

    const flavorThumb = flavor.image || (window.DEFAULT_IMAGE_PLACEHOLDERS && window.DEFAULT_IMAGE_PLACEHOLDERS.flavor) || "";

    tr.innerHTML = `
      ${buildDragHandleCell("flavors", index, flavors.length, flavor.name)}
      <td><img src="${flavorThumb}" class="table-item-thumb" alt="${flavor.name}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'48\\' height=\\'48\\' fill=\\'%23cbd5e1\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23f8fafc\\'/><text x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'18\\'>🥟</text></svg>'"></td>
      <td><strong>${flavor.name}</strong></td>
      <td>${adicionalText}</td>
      <td>${limiteText}</td>
      <td>${statusBadge}</td>
      <td class="text-right">
        <div class="table-actions">
          <button class="btn-action-icon toggle" onclick="toggleFlavorStatus('${flavor.id}')" title="Alternar Disponível / Esgotado">
            <i class="fa-solid fa-power-off"></i>
          </button>
          <button class="btn-action-icon edit" onclick="editFlavor('${flavor.id}')" title="Editar">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn-action-icon delete" onclick="deleteFlavor('${flavor.id}')" title="Excluir">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.toggleFlavorStatus = function(id) {
  const flavors = VIPDatabase.getFlavors();
  const item = flavors.find(f => f.id === id);
  if (item) {
    item.active = !item.active;
    VIPDatabase.saveFlavors(flavors);
    renderFlavorsTable();
  }
};

window.openFlavorModal = function() {
  document.getElementById("modal-flavor-title").textContent = "Cadastrar Novo Sabor";
  document.getElementById("flavor-edit-id").value = "";
  document.getElementById("flavor-input-name").value = "";
  document.getElementById("flavor-input-adicional").value = "";
  document.getElementById("flavor-input-limite").value = "";
  document.getElementById("flavor-input-active").checked = true;
  setItemImageState("flavor", "");

  document.getElementById("modal-flavor").classList.add("active");
  document.getElementById("modal-flavor-backdrop").classList.add("active");
};

window.editFlavor = function(id) {
  const flavors = VIPDatabase.getFlavors();
  const flavor = flavors.find(f => f.id === id);
  if (!flavor) return;

  document.getElementById("modal-flavor-title").textContent = "Editar Sabor";
  document.getElementById("flavor-edit-id").value = flavor.id;
  document.getElementById("flavor-input-name").value = flavor.name;
  document.getElementById("flavor-input-adicional").value = flavor.adicional_por_10 || "";
  document.getElementById("flavor-input-limite").value = flavor.limite_quantidade || "";
  document.getElementById("flavor-input-active").checked = flavor.active !== false;
  setItemImageState("flavor", flavor.image || "");

  document.getElementById("modal-flavor").classList.add("active");
  document.getElementById("modal-flavor-backdrop").classList.add("active");
};

window.closeFlavorModal = function() {
  document.getElementById("modal-flavor").classList.remove("active");
  document.getElementById("modal-flavor-backdrop").classList.remove("active");
};

document.getElementById("btn-save-flavor").addEventListener("click", async () => {
  const id = document.getElementById("flavor-edit-id").value;
  const name = document.getElementById("flavor-input-name").value.trim();
  const adicionalRaw = document.getElementById("flavor-input-adicional").value;
  const limiteRaw = document.getElementById("flavor-input-limite").value;
  const active = document.getElementById("flavor-input-active").checked;
  const image = document.getElementById("flavor-input-image").value.trim() || null;

  if (!name) {
    alert("Informe o nome do sabor.");
    return;
  }

  const adicional = adicionalRaw ? parseFloat(adicionalRaw) : null;
  const limite = limiteRaw ? parseInt(limiteRaw) : null;

  const flavors = VIPDatabase.getFlavors();

  if (id) {
    // Editar
    const item = flavors.find(f => f.id === id);
    if (item) {
      item.name = name;
      item.adicional_por_10 = adicional;
      item.limite_quantidade = limite;
      item.active = active;
      item.image = image;
    }
  } else {
    // Novo
    const newId = "flavor-" + Date.now();
    flavors.push({
      id: newId,
      name: name,
      adicional_por_10: adicional,
      limite_quantidade: limite,
      active: active,
      image: image
    });
  }

  const btn = document.getElementById("btn-save-flavor");
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up fa-fade"></i> Salvando na nuvem...';

  try {
    await VIPDatabase.saveFlavors(flavors);
  } catch (e) {
    console.warn("Aviso ao salvar sabor:", e);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
    closeFlavorModal();
    renderFlavorsTable();
  }
});

window.deleteFlavor = function(id) {
  if (confirm("Deseja realmente remover este sabor do cardápio?")) {
    let flavors = VIPDatabase.getFlavors();
    flavors = flavors.filter(f => f.id !== id);
    VIPDatabase.saveFlavors(flavors);
    renderFlavorsTable();
  }
};

// ==========================================
// 4. GERENCIAMENTO DE KITS (CRUD)
// ==========================================
function renderKitsTable() {
  const tbody = document.getElementById("kits-table-body");
  const kits = VIPDatabase.getKits();
  tbody.innerHTML = "";

  if (kits.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 2rem;">Nenhum kit cadastrado ainda. Clique em "+ Novo Kit" acima.</td></tr>`;
    return;
  }

  kits.forEach((kit, index) => {
    const tr = document.createElement("tr");
    attachDraggableRowListeners(tr, "kits", index);

    const statusBadge = kit.active !== false
      ? `<span class="badge-status-item active"><i class="fa-solid fa-circle-check"></i> Ativo</span>`
      : `<span class="badge-status-item inactive"><i class="fa-solid fa-circle-xmark"></i> Pausado</span>`;

    const stepVal = kit.passo_quantidade || 10;
    const stepBadge = `<span class="badge-step-item"><i class="fa-solid fa-layer-group"></i> De ${stepVal} em ${stepVal} un</span>`;
    const kitThumb = kit.image || (window.DEFAULT_IMAGE_PLACEHOLDERS && window.DEFAULT_IMAGE_PLACEHOLDERS.kit) || "";

    tr.innerHTML = `
      ${buildDragHandleCell("kits", index, kits.length, kit.name)}
      <td><img src="${kitThumb}" class="table-item-thumb" alt="${kit.name}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'48\\' height=\\'48\\' fill=\\'%23cbd5e1\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23f8fafc\\'/><text x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'18\\'>📦</text></svg>'"></td>
      <td><strong>${kit.name}</strong></td>
      <td>${kit.quantity} salgadinhos</td>
      <td><strong>${formatBRL(kit.price)}</strong></td>
      <td>${stepBadge}</td>
      <td>${statusBadge}</td>
      <td class="text-right">
        <div class="table-actions">
          <button class="btn-action-icon toggle" onclick="toggleKitStatus('${kit.id}')" title="Ativar / Pausar">
            <i class="fa-solid fa-power-off"></i>
          </button>
          <button class="btn-action-icon edit" onclick="editKit('${kit.id}')" title="Editar">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn-action-icon delete" onclick="deleteKit('${kit.id}')" title="Excluir">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.toggleKitStatus = function(id) {
  const kits = VIPDatabase.getKits();
  const kit = kits.find(k => k.id === id);
  if (kit) {
    kit.active = !kit.active;
    VIPDatabase.saveKits(kits);
    renderKitsTable();
  }
};

window.openKitModal = function() {
  document.getElementById("modal-kit-title").textContent = "Cadastrar Novo Kit";
  document.getElementById("kit-edit-id").value = "";
  document.getElementById("kit-input-name").value = "";
  document.getElementById("kit-input-qty").value = "";
  document.getElementById("kit-input-step").value = "10";
  document.getElementById("kit-input-price").value = "";
  document.getElementById("kit-input-active").checked = true;
  setItemImageState("kit", "");

  document.getElementById("modal-kit").classList.add("active");
  document.getElementById("modal-kit-backdrop").classList.add("active");
};

window.editKit = function(id) {
  const kits = VIPDatabase.getKits();
  const kit = kits.find(k => k.id === id);
  if (!kit) return;

  document.getElementById("modal-kit-title").textContent = "Editar Kit";
  document.getElementById("kit-edit-id").value = kit.id;
  document.getElementById("kit-input-name").value = kit.name;
  document.getElementById("kit-input-qty").value = kit.quantity;
  document.getElementById("kit-input-step").value = String(kit.passo_quantidade || 10);
  document.getElementById("kit-input-price").value = kit.price;
  document.getElementById("kit-input-active").checked = kit.active !== false;
  setItemImageState("kit", kit.image || "");

  document.getElementById("modal-kit").classList.add("active");
  document.getElementById("modal-kit-backdrop").classList.add("active");
};

window.closeKitModal = function() {
  document.getElementById("modal-kit").classList.remove("active");
  document.getElementById("modal-kit-backdrop").classList.remove("active");
};

document.getElementById("btn-save-kit").addEventListener("click", async () => {
  const id = document.getElementById("kit-edit-id").value;
  const name = document.getElementById("kit-input-name").value.trim();
  const qty = parseInt(document.getElementById("kit-input-qty").value);
  const step = parseInt(document.getElementById("kit-input-step").value) || 10;
  const price = parseFloat(document.getElementById("kit-input-price").value);
  const active = document.getElementById("kit-input-active").checked;
  const image = document.getElementById("kit-input-image").value.trim() || null;

  if (!name || isNaN(qty) || isNaN(price)) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  const kits = VIPDatabase.getKits();

  if (id) {
    const item = kits.find(k => k.id === id);
    if (item) {
      item.name = name;
      item.quantity = qty;
      item.passo_quantidade = step;
      item.price = price;
      item.active = active;
      item.image = image;
    }
  } else {
    kits.push({
      id: "kit-" + Date.now(),
      name: name,
      quantity: qty,
      passo_quantidade: step,
      price: price,
      active: active,
      image: image
    });
  }

  const btn = document.getElementById("btn-save-kit");
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up fa-fade"></i> Salvando na nuvem...';

  try {
    await VIPDatabase.saveKits(kits);
  } catch (e) {
    console.warn("Aviso ao salvar kit:", e);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
    closeKitModal();
    renderKitsTable();
  }
});

window.deleteKit = function(id) {
  if (confirm("Deseja realmente remover este kit?")) {
    let kits = VIPDatabase.getKits();
    kits = kits.filter(k => k.id !== id);
    VIPDatabase.saveKits(kits);
    renderKitsTable();
  }
};

// ==========================================
// 5. GERENCIAMENTO DE MOLHOS (CRUD)
// ==========================================
function renderSaucesTable() {
  const tbody = document.getElementById("sauces-table-body");
  const sauces = VIPDatabase.getSauces();
  tbody.innerHTML = "";

  if (sauces.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 2rem;">Nenhum molho cadastrado ainda. Clique em "+ Novo Molho" acima.</td></tr>`;
    return;
  }

  sauces.forEach((sauce, index) => {
    const tr = document.createElement("tr");
    attachDraggableRowListeners(tr, "sauces", index);

    const statusBadge = sauce.active !== false
      ? `<span class="badge-status-item active"><i class="fa-solid fa-circle-check"></i> Disponível</span>`
      : `<span class="badge-status-item inactive"><i class="fa-solid fa-circle-xmark"></i> Esgotado</span>`;

    const sauceThumb = sauce.image || (window.DEFAULT_IMAGE_PLACEHOLDERS && window.DEFAULT_IMAGE_PLACEHOLDERS.sauce) || "";

    tr.innerHTML = `
      ${buildDragHandleCell("sauces", index, sauces.length, sauce.name)}
      <td><img src="${sauceThumb}" class="table-item-thumb" alt="${sauce.name}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'48\\' height=\\'48\\' fill=\\'%23cbd5e1\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23f8fafc\\'/><text x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'18\\'>🥫</text></svg>'"></td>
      <td><strong>${sauce.name}</strong></td>
      <td><strong>${sauce.price > 0 ? formatBRL(sauce.price) : "Grátis / Sem Custo"}</strong></td>
      <td>${statusBadge}</td>
      <td class="text-right">
        <div class="table-actions">
          <button class="btn-action-icon toggle" onclick="toggleSauceStatus('${sauce.id}')" title="Disponível / Esgotado">
            <i class="fa-solid fa-power-off"></i>
          </button>
          <button class="btn-action-icon edit" onclick="editSauce('${sauce.id}')" title="Editar">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn-action-icon delete" onclick="deleteSauce('${sauce.id}')" title="Excluir">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.toggleSauceStatus = function(id) {
  const sauces = VIPDatabase.getSauces();
  const sauce = sauces.find(s => s.id === id);
  if (sauce) {
    sauce.active = !sauce.active;
    VIPDatabase.saveSauces(sauces);
    renderSaucesTable();
  }
};

window.openSauceModal = function() {
  document.getElementById("modal-sauce-title").textContent = "Cadastrar Novo Molho";
  document.getElementById("sauce-edit-id").value = "";
  document.getElementById("sauce-input-name").value = "";
  document.getElementById("sauce-input-price").value = "";
  document.getElementById("sauce-input-active").checked = true;
  setItemImageState("sauce", "");

  document.getElementById("modal-sauce").classList.add("active");
  document.getElementById("modal-sauce-backdrop").classList.add("active");
};

window.editSauce = function(id) {
  const sauces = VIPDatabase.getSauces();
  const sauce = sauces.find(s => s.id === id);
  if (!sauce) return;

  document.getElementById("modal-sauce-title").textContent = "Editar Molho";
  document.getElementById("sauce-edit-id").value = sauce.id;
  document.getElementById("sauce-input-name").value = sauce.name;
  document.getElementById("sauce-input-price").value = sauce.price;
  document.getElementById("sauce-input-active").checked = sauce.active !== false;
  setItemImageState("sauce", sauce.image || "");

  document.getElementById("modal-sauce").classList.add("active");
  document.getElementById("modal-sauce-backdrop").classList.add("active");
};

window.closeSauceModal = function() {
  document.getElementById("modal-sauce").classList.remove("active");
  document.getElementById("modal-sauce-backdrop").classList.remove("active");
};

document.getElementById("btn-save-sauce").addEventListener("click", async () => {
  const id = document.getElementById("sauce-edit-id").value;
  const name = document.getElementById("sauce-input-name").value.trim();
  const price = parseFloat(document.getElementById("sauce-input-price").value);
  const active = document.getElementById("sauce-input-active").checked;
  const image = document.getElementById("sauce-input-image").value.trim() || null;

  if (!name || isNaN(price)) {
    alert("Preencha todos os campos do molho corretamente.");
    return;
  }

  const sauces = VIPDatabase.getSauces();

  if (id) {
    const item = sauces.find(s => s.id === id);
    if (item) {
      item.name = name;
      item.price = price;
      item.active = active;
      item.image = image;
    }
  } else {
    sauces.push({
      id: "sauce-" + Date.now(),
      name: name,
      price: price,
      active: active,
      image: image
    });
  }

  const btn = document.getElementById("btn-save-sauce");
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up fa-fade"></i> Salvando na nuvem...';

  try {
    await VIPDatabase.saveSauces(sauces);
  } catch (e) {
    console.warn("Aviso ao salvar molho:", e);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
    closeSauceModal();
    renderSaucesTable();
  }
});

window.deleteSauce = function(id) {
  if (confirm("Deseja realmente remover este molho?")) {
    let sauces = VIPDatabase.getSauces();
    sauces = sauces.filter(s => s.id !== id);
    VIPDatabase.saveSauces(sauces);
    renderSaucesTable();
  }
};

// ==========================================
// 6. GERENCIAMENTO DE CATEGORIAS E PRODUTOS AVULSOS
// ==========================================

// CATEGORIAS
function renderCategoriesTable() {
  const tbody = document.getElementById("categories-table-body");
  if (!tbody) return;
  const categories = VIPDatabase.getCategories();
  const products = VIPDatabase.getProducts();
  tbody.innerHTML = "";

  if (categories.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 2rem;">Nenhuma categoria cadastrada ainda. Clique em "+ Nova Categoria" acima.</td></tr>`;
    return;
  }

  categories.forEach((cat, index) => {
    const tr = document.createElement("tr");
    attachDraggableRowListeners(tr, "categories", index);
    const count = products.filter(p => p.categoryId === cat.id).length;
    const statusBadge = cat.active !== false
      ? `<span class="badge-status-item active"><i class="fa-solid fa-circle-check"></i> Ativa</span>`
      : `<span class="badge-status-item inactive"><i class="fa-solid fa-circle-xmark"></i> Pausada</span>`;

    tr.innerHTML = `
      ${buildDragHandleCell("categories", index, categories.length, cat.name)}
      <td style="font-size: 1.25rem; text-align: center; color: #f59e0b;"><i class="fa-solid ${cat.icon || 'fa-tag'}"></i></td>
      <td><strong>${cat.name}</strong></td>
      <td>${cat.description || '<span style="color:#94a3b8;">Sem descrição</span>'}</td>
      <td><span class="badge-step-item"><i class="fa-solid fa-box"></i> ${count} ${count === 1 ? 'item' : 'itens'}</span></td>
      <td>${statusBadge}</td>
      <td class="text-right">
        <div class="table-actions">
          <button class="btn-action-icon toggle" onclick="toggleCategoryStatus('${cat.id}')" title="Ativar / Pausar Categoria">
            <i class="fa-solid fa-power-off"></i>
          </button>
          <button class="btn-action-icon edit" onclick="editCategory('${cat.id}')" title="Editar Categoria">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn-action-icon delete" onclick="deleteCategory('${cat.id}')" title="Excluir Categoria">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.toggleCategoryStatus = function(id) {
  const categories = VIPDatabase.getCategories();
  const cat = categories.find(c => c.id === id);
  if (cat) {
    cat.active = !cat.active;
    VIPDatabase.saveCategories(categories);
    renderCategoriesTable();
    renderProductsTable();
  }
};

window.openCategoryModal = function() {
  document.getElementById("modal-category-title").textContent = "Cadastrar Nova Categoria";
  document.getElementById("category-edit-id").value = "";
  document.getElementById("category-input-name").value = "";
  document.getElementById("category-input-icon").value = "fa-bottle-water";
  document.getElementById("category-input-desc").value = "";
  document.getElementById("category-input-active").checked = true;

  document.getElementById("modal-category").classList.add("active");
  document.getElementById("modal-category-backdrop").classList.add("active");
};

window.editCategory = function(id) {
  const categories = VIPDatabase.getCategories();
  const cat = categories.find(c => c.id === id);
  if (!cat) return;

  document.getElementById("modal-category-title").textContent = "Editar Categoria";
  document.getElementById("category-edit-id").value = cat.id;
  document.getElementById("category-input-name").value = cat.name;
  document.getElementById("category-input-icon").value = cat.icon || "fa-tag";
  document.getElementById("category-input-desc").value = cat.description || "";
  document.getElementById("category-input-active").checked = cat.active !== false;

  document.getElementById("modal-category").classList.add("active");
  document.getElementById("modal-category-backdrop").classList.add("active");
};

window.closeCategoryModal = function() {
  document.getElementById("modal-category").classList.remove("active");
  document.getElementById("modal-category-backdrop").classList.remove("active");
};

document.getElementById("btn-save-category").addEventListener("click", () => {
  const id = document.getElementById("category-edit-id").value;
  const name = document.getElementById("category-input-name").value.trim();
  const icon = document.getElementById("category-input-icon").value;
  const desc = document.getElementById("category-input-desc").value.trim();
  const active = document.getElementById("category-input-active").checked;

  if (!name) {
    alert("Informe o nome da categoria.");
    return;
  }

  const categories = VIPDatabase.getCategories();

  if (id) {
    const item = categories.find(c => c.id === id);
    if (item) {
      item.name = name;
      item.icon = icon;
      item.description = desc;
      item.active = active;
    }
  } else {
    categories.push({
      id: "cat-" + Date.now(),
      name: name,
      icon: icon,
      description: desc,
      active: active
    });
  }

  VIPDatabase.saveCategories(categories);
  closeCategoryModal();
  renderCategoriesTable();
  renderProductsTable();
});

window.deleteCategory = function(id) {
  const categories = VIPDatabase.getCategories();
  const cat = categories.find(c => c.id === id);
  if (!cat) return;

  const products = VIPDatabase.getProducts();
  const linkedProds = products.filter(p => p.categoryId === id);

  const confirmMsg = linkedProds.length > 0
    ? `Deseja realmente remover a categoria "${cat.name}"?\nIsso também removerá os ${linkedProds.length} produto(s) vinculados a ela!`
    : `Deseja realmente remover a categoria "${cat.name}"?`;

  if (confirm(confirmMsg)) {
    const updatedCats = categories.filter(c => c.id !== id);
    const updatedProds = products.filter(p => p.categoryId !== id);
    VIPDatabase.saveCategories(updatedCats);
    VIPDatabase.saveProducts(updatedProds);
    renderCategoriesTable();
    renderProductsTable();
  }
};

// PRODUTOS AVULSOS
function renderProductsTable() {
  const tbody = document.getElementById("products-table-body");
  if (!tbody) return;
  const products = VIPDatabase.getProducts();
  const categories = VIPDatabase.getCategories();
  tbody.innerHTML = "";

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 2rem;">Nenhum produto cadastrado ainda. Clique em "+ Novo Produto" acima.</td></tr>`;
    return;
  }

  products.forEach((prod, index) => {
    const tr = document.createElement("tr");
    attachDraggableRowListeners(tr, "products", index);
    const cat = categories.find(c => c.id === prod.categoryId);
    const catName = cat ? cat.name : "Sem Categoria";
    const catIcon = cat ? (cat.icon || "fa-tag") : "fa-tag";

    const statusBadge = prod.active !== false
      ? `<span class="badge-status-item active"><i class="fa-solid fa-circle-check"></i> Disponível</span>`
      : `<span class="badge-status-item inactive"><i class="fa-solid fa-circle-xmark"></i> Esgotado</span>`;

    const prodThumb = prod.image || (window.DEFAULT_IMAGE_PLACEHOLDERS && window.DEFAULT_IMAGE_PLACEHOLDERS.product) || "";

    tr.innerHTML = `
      ${buildDragHandleCell("products", index, products.length, prod.name)}
      <td><img src="${prodThumb}" class="table-item-thumb" alt="${prod.name}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'48\\' height=\\'48\\' fill=\\'%23cbd5e1\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23f8fafc\\'/><text x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'18\\'>🥤</text></svg>'"></td>
      <td><strong>${prod.name}</strong></td>
      <td><span class="badge-step-item"><i class="fa-solid ${catIcon}"></i> ${catName}</span></td>
      <td><strong>${formatBRL(prod.price)}</strong></td>
      <td>${prod.description || '<span style="color:#94a3b8;">-</span>'}</td>
      <td>${statusBadge}</td>
      <td class="text-right">
        <div class="table-actions">
          <button class="btn-action-icon toggle" onclick="toggleProductStatus('${prod.id}')" title="Disponível / Esgotado">
            <i class="fa-solid fa-power-off"></i>
          </button>
          <button class="btn-action-icon edit" onclick="editProduct('${prod.id}')" title="Editar Produto">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn-action-icon delete" onclick="deleteProduct('${prod.id}')" title="Excluir Produto">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function populateCategorySelect(selectedId = null) {
  const select = document.getElementById("product-input-category");
  if (!select) return;
  const categories = VIPDatabase.getCategories();
  select.innerHTML = "";

  if (categories.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Nenhuma categoria existente - Crie uma primeiro!";
    select.appendChild(opt);
    return;
  }

  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = `${cat.name} ${cat.active === false ? '(Pausada)' : ''}`;
    if (selectedId && cat.id === selectedId) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

window.toggleProductStatus = function(id) {
  const products = VIPDatabase.getProducts();
  const prod = products.find(p => p.id === id);
  if (prod) {
    prod.active = !prod.active;
    VIPDatabase.saveProducts(products);
    renderProductsTable();
  }
};

window.openProductModal = function() {
  const categories = VIPDatabase.getCategories();
  if (categories.length === 0) {
    alert("Por favor, crie pelo menos uma Categoria antes de cadastrar um produto!");
    openCategoryModal();
    return;
  }

  populateCategorySelect();
  document.getElementById("modal-product-title").textContent = "Cadastrar Novo Produto";
  document.getElementById("product-edit-id").value = "";
  document.getElementById("product-input-name").value = "";
  document.getElementById("product-input-price").value = "";
  document.getElementById("product-input-desc").value = "";
  document.getElementById("product-input-active").checked = true;
  setItemImageState("product", "");

  document.getElementById("modal-product").classList.add("active");
  document.getElementById("modal-product-backdrop").classList.add("active");
};

window.editProduct = function(id) {
  const products = VIPDatabase.getProducts();
  const prod = products.find(p => p.id === id);
  if (!prod) return;

  populateCategorySelect(prod.categoryId);
  document.getElementById("modal-product-title").textContent = "Editar Produto";
  document.getElementById("product-edit-id").value = prod.id;
  document.getElementById("product-input-name").value = prod.name;
  document.getElementById("product-input-price").value = prod.price;
  document.getElementById("product-input-desc").value = prod.description || "";
  document.getElementById("product-input-active").checked = prod.active !== false;
  setItemImageState("product", prod.image || "");

  document.getElementById("modal-product").classList.add("active");
  document.getElementById("modal-product-backdrop").classList.add("active");
};

window.closeProductModal = function() {
  document.getElementById("modal-product").classList.remove("active");
  document.getElementById("modal-product-backdrop").classList.remove("active");
};

document.getElementById("btn-save-product").addEventListener("click", async () => {
  const id = document.getElementById("product-edit-id").value;
  const name = document.getElementById("product-input-name").value.trim();
  const categoryId = document.getElementById("product-input-category").value;
  const price = parseFloat(document.getElementById("product-input-price").value);
  const desc = document.getElementById("product-input-desc").value.trim();
  const active = document.getElementById("product-input-active").checked;
  const image = document.getElementById("product-input-image").value.trim() || null;

  if (!name || !categoryId || isNaN(price)) {
    alert("Preencha o nome, selecione a categoria e informe um preço válido.");
    return;
  }

  const products = VIPDatabase.getProducts();

  if (id) {
    const item = products.find(p => p.id === id);
    if (item) {
      item.name = name;
      item.categoryId = categoryId;
      item.price = price;
      item.description = desc;
      item.active = active;
      item.image = image;
    }
  } else {
    products.push({
      id: "prod-" + Date.now(),
      name: name,
      categoryId: categoryId,
      price: price,
      description: desc,
      active: active,
      image: image
    });
  }

  const btn = document.getElementById("btn-save-product");
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up fa-fade"></i> Salvando na nuvem...';

  try {
    await VIPDatabase.saveProducts(products);
  } catch (e) {
    console.warn("Aviso ao salvar produto:", e);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
    closeProductModal();
    renderProductsTable();
    renderCategoriesTable();
  }
});

window.deleteProduct = function(id) {
  if (confirm("Deseja realmente remover este produto?")) {
    let products = VIPDatabase.getProducts();
    products = products.filter(p => p.id !== id);
    VIPDatabase.saveProducts(products);
    renderProductsTable();
    renderCategoriesTable();
  }
};

const catBackdrop = document.getElementById("modal-category-backdrop");
if (catBackdrop) catBackdrop.addEventListener("click", closeCategoryModal);
const prodBackdrop = document.getElementById("modal-product-backdrop");
if (prodBackdrop) prodBackdrop.addEventListener("click", closeProductModal);

// ==========================================
// 6.5. GERENCIAMENTO DE COMBOS PROMOCIONAIS (CRUD & BUILDER INTELIGENTE)
// ==========================================

let currentComboBuilderItems = [];

function renderCombosTable() {
  const tbody = document.getElementById("combos-table-body");
  if (!tbody) return;
  const combos = VIPDatabase.getCombos();
  tbody.innerHTML = "";

  if (combos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #94a3b8; padding: 2rem;">Nenhum combo cadastrado ainda. Clique em "+ Novo Combo" acima para montar seu primeiro combo promocional!</td></tr>`;
    return;
  }

  combos.forEach((combo, index) => {
    const tr = document.createElement("tr");
    attachDraggableRowListeners(tr, "combos", index);

    // Destaque / Badge
    const badgeHtml = combo.badge
      ? `<span class="badge-step-item" style="background:#fee2e2; border-color:#fca5a5; color:#b91c1c;"><i class="fa-solid fa-fire"></i> ${combo.badge}</span>`
      : `<span style="color:#94a3b8;">Padrão</span>`;

    // Itens inclusos
    let itemsSummary = (combo.items || []).map(i => {
      let icon = "fa-tag";
      if (i.type === "kit") icon = "fa-boxes-stacked";
      else if (i.type === "product") icon = "fa-bottle-water";
      else if (i.type === "sauce") icon = "fa-bowl-food";
      return `<div style="font-size:0.83rem; line-height:1.4;"><i class="fa-solid ${icon}" style="color:#d97706; width:14px;"></i> ${i.quantity}x ${i.name}</div>`;
    }).join("");

    if (!itemsSummary) itemsSummary = `<span style="color:#94a3b8;">Sem itens configurados</span>`;

    const regularVal = combo.regularPrice || combo.price;
    const finalVal = combo.price;
    const savings = Math.max(0, regularVal - finalVal);
    const pct = regularVal > 0 ? Math.round((savings / regularVal) * 100) : 0;

    const discountHtml = savings > 0
      ? `<div style="color:#059669; font-weight:800; font-size:0.88rem;">Economiza ${formatBRL(savings)}</div><div style="font-size:0.78rem; color:#10b981; font-weight:700;">(${pct}% OFF)</div>`
      : `<span style="color:#94a3b8;">Sem desconto</span>`;

    const statusBadge = combo.active !== false
      ? `<span class="badge-status-item active"><i class="fa-solid fa-circle-check"></i> Ativo</span>`
      : `<span class="badge-status-item inactive"><i class="fa-solid fa-circle-xmark"></i> Pausado</span>`;

    const comboThumb = combo.image || (window.DEFAULT_IMAGE_PLACEHOLDERS && window.DEFAULT_IMAGE_PLACEHOLDERS.combo) || "";

    tr.innerHTML = `
      ${buildDragHandleCell("combos", index, combos.length, combo.name)}
      <td><img src="${comboThumb}" class="table-item-thumb" alt="${combo.name}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'48\\' height=\\'48\\' fill=\\'%23cbd5e1\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23f8fafc\\'/><text x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'18\\'>🔥</text></svg>'"></td>
      <td>${badgeHtml}</td>
      <td>
        <strong>${combo.name}</strong>
        ${combo.description ? `<div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">${combo.description}</div>` : ''}
      </td>
      <td>${itemsSummary}</td>
      <td><span style="text-decoration: line-through; color: #94a3b8; font-weight: 600;">${formatBRL(regularVal)}</span></td>
      <td><strong style="color: #b45309; font-size: 1.05rem;">${formatBRL(finalVal)}</strong></td>
      <td>${discountHtml}</td>
      <td>${statusBadge}</td>
      <td class="text-right">
        <div class="table-actions">
          <button class="btn-action-icon toggle" onclick="toggleComboStatus('${combo.id}')" title="Ativar / Pausar Combo">
            <i class="fa-solid fa-power-off"></i>
          </button>
          <button class="btn-action-icon edit" onclick="editCombo('${combo.id}')" title="Editar Combo">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn-action-icon delete" onclick="deleteCombo('${combo.id}')" title="Excluir Combo">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.toggleComboStatus = function(id) {
  const combos = VIPDatabase.getCombos();
  const combo = combos.find(c => c.id === id);
  if (combo) {
    combo.active = !combo.active;
    VIPDatabase.saveCombos(combos);
    renderCombosTable();
  }
};

window.deleteCombo = function(id) {
  if (confirm("Deseja realmente remover este combo promocional?")) {
    let combos = VIPDatabase.getCombos();
    combos = combos.filter(c => c.id !== id);
    VIPDatabase.saveCombos(combos);
    renderCombosTable();
  }
};

window.openComboModal = function() {
  document.getElementById("modal-combo-title").textContent = "Cadastrar Novo Combo Promocional";
  document.getElementById("combo-edit-id").value = "";
  document.getElementById("combo-input-name").value = "";
  document.getElementById("combo-input-badge").value = "Mais Vendido 🔥";
  document.getElementById("combo-input-desc").value = "";
  document.getElementById("combo-input-item-qty").value = "1";
  document.getElementById("combo-calc-percent").value = "15";
  document.getElementById("combo-calc-final").value = "";
  document.getElementById("combo-input-active").checked = true;
  setItemImageState("combo", "");

  currentComboBuilderItems = [];
  onComboItemTypeChange();
  updateComboPricingAndItemsUI(true);

  document.getElementById("modal-combo").classList.add("active");
  document.getElementById("modal-combo-backdrop").classList.add("active");
};

window.editCombo = function(id) {
  const combos = VIPDatabase.getCombos();
  const combo = combos.find(c => c.id === id);
  if (!combo) return;

  document.getElementById("modal-combo-title").textContent = "Editar Combo Promocional";
  document.getElementById("combo-edit-id").value = combo.id;
  document.getElementById("combo-input-name").value = combo.name;
  document.getElementById("combo-input-badge").value = combo.badge || "";
  document.getElementById("combo-input-desc").value = combo.description || "";
  document.getElementById("combo-input-active").checked = combo.active !== false;
  setItemImageState("combo", combo.image || "");

  currentComboBuilderItems = JSON.parse(JSON.stringify(combo.items || []));
  onComboItemTypeChange();

  document.getElementById("combo-calc-final").value = combo.price.toFixed(2);
  if (combo.discountPercent) {
    document.getElementById("combo-calc-percent").value = combo.discountPercent;
  }

  updateComboPricingAndItemsUI(false);

  document.getElementById("modal-combo").classList.add("active");
  document.getElementById("modal-combo-backdrop").classList.add("active");
};

window.closeComboModal = function() {
  document.getElementById("modal-combo").classList.remove("active");
  document.getElementById("modal-combo-backdrop").classList.remove("active");
  currentComboBuilderItems = [];
};

// Builder selector population
window.onComboItemTypeChange = function() {
  const type = document.getElementById("combo-select-type").value;
  const itemSelect = document.getElementById("combo-select-item");
  if (!itemSelect) return;
  itemSelect.innerHTML = "";

  if (type === "kit") {
    const kits = VIPDatabase.getKits();
    kits.forEach(kit => {
      const opt = document.createElement("option");
      opt.value = kit.id;
      opt.textContent = `${kit.name} - ${formatBRL(kit.price)}`;
      opt.dataset.price = kit.price;
      opt.dataset.name = kit.name;
      itemSelect.appendChild(opt);
    });
  } else if (type === "product") {
    const prods = VIPDatabase.getProducts();
    prods.forEach(prod => {
      const opt = document.createElement("option");
      opt.value = prod.id;
      opt.textContent = `${prod.name} - ${formatBRL(prod.price)}`;
      opt.dataset.price = prod.price;
      opt.dataset.name = prod.name;
      itemSelect.appendChild(opt);
    });
  } else if (type === "sauce") {
    const sauces = VIPDatabase.getSauces();
    sauces.forEach(sauce => {
      const opt = document.createElement("option");
      opt.value = sauce.id;
      opt.textContent = `${sauce.name} - ${sauce.price > 0 ? formatBRL(sauce.price) : "Grátis"}`;
      opt.dataset.price = sauce.price;
      opt.dataset.name = sauce.name;
      itemSelect.appendChild(opt);
    });
  }
};

window.addItemToComboBuilder = function() {
  const type = document.getElementById("combo-select-type").value;
  const itemSelect = document.getElementById("combo-select-item");
  const qtyInput = document.getElementById("combo-input-item-qty");
  const qty = parseInt(qtyInput.value) || 1;

  if (!itemSelect.value) {
    alert("Selecione um produto para adicionar ao combo.");
    return;
  }

  const selectedOpt = itemSelect.options[itemSelect.selectedIndex];
  const id = itemSelect.value;
  const name = selectedOpt.dataset.name || selectedOpt.textContent.split(" - ")[0];
  const unitPrice = parseFloat(selectedOpt.dataset.price) || 0;

  const existing = currentComboBuilderItems.find(i => i.type === type && i.id === id);
  if (existing) {
    existing.quantity += qty;
  } else {
    currentComboBuilderItems.push({
      type,
      id,
      name,
      quantity: qty,
      unitPrice
    });
  }

  qtyInput.value = "1";
  updateComboPricingAndItemsUI(true);
};

window.changeComboBuilderItemQty = function(index, delta) {
  if (!currentComboBuilderItems[index]) return;
  currentComboBuilderItems[index].quantity += delta;
  if (currentComboBuilderItems[index].quantity <= 0) {
    currentComboBuilderItems.splice(index, 1);
  }
  updateComboPricingAndItemsUI(true);
};

window.removeComboBuilderItem = function(index) {
  currentComboBuilderItems.splice(index, 1);
  updateComboPricingAndItemsUI(true);
};

function updateComboPricingAndItemsUI(autoCalculatePrice = false) {
  const container = document.getElementById("combo-items-list");
  if (!container) return;

  container.innerHTML = "";

  if (currentComboBuilderItems.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 1rem; font-size: 0.85rem;"><i class="fa-solid fa-basket-shopping"></i> Nenhum item adicionado ainda. Escolha os itens acima e clique em "+ Adicionar".</div>`;
  } else {
    currentComboBuilderItems.forEach((item, index) => {
      const chip = document.createElement("div");
      chip.className = "combo-item-chip";

      let typeTag = "";
      if (item.type === "kit") typeTag = `<span class="chip-type-tag kit">🥟 Kit</span>`;
      else if (item.type === "product") typeTag = `<span class="chip-type-tag product">🥤 Bebida</span>`;
      else if (item.type === "sauce") typeTag = `<span class="chip-type-tag sauce">🥫 Molho</span>`;

      chip.innerHTML = `
        <div class="chip-left">
          ${typeTag}
          <span>${item.name}</span>
          <span style="font-size: 0.78rem; color: #64748b;">(${formatBRL(item.unitPrice)} un)</span>
        </div>
        <div class="chip-right">
          <div class="product-qty-stepper compact">
            <button type="button" class="btn-stepper-btn minus" onclick="changeComboBuilderItemQty(${index}, -1)"><i class="fa-solid fa-minus"></i></button>
            <span class="stepper-count">${item.quantity}</span>
            <button type="button" class="btn-stepper-btn plus" onclick="changeComboBuilderItemQty(${index}, 1)"><i class="fa-solid fa-plus"></i></button>
          </div>
          <strong style="min-width: 65px; text-align: right; font-size: 0.88rem;">${formatBRL(item.unitPrice * item.quantity)}</strong>
          <button type="button" class="btn-remove-chip" onclick="removeComboBuilderItem(${index})" title="Remover do Combo">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;
      container.appendChild(chip);
    });
  }

  // Cálculos de preço regular e desconto
  const totalRegular = currentComboBuilderItems.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0);
  document.getElementById("combo-calc-regular").value = formatBRL(totalRegular);

  const priceInput = document.getElementById("combo-calc-final");
  const percentInput = document.getElementById("combo-calc-percent");

  if (autoCalculatePrice && totalRegular > 0) {
    const pct = parseFloat(percentInput.value) || 15;
    const discounted = totalRegular * (1 - (pct / 100));
    priceInput.value = discounted.toFixed(2);
  }

  const currentFinal = parseFloat(priceInput.value) || 0;
  const currentSavings = Math.max(0, totalRegular - currentFinal);
  const currentPercent = totalRegular > 0 ? ((currentSavings / totalRegular) * 100) : 0;

  // Atualizar simulação visual
  document.getElementById("sim-regular-val").textContent = formatBRL(totalRegular);
  document.getElementById("sim-final-val").textContent = formatBRL(currentFinal);
  document.getElementById("sim-savings-val").textContent = `${formatBRL(currentSavings)} (${currentPercent.toFixed(1)}% de Desconto Real!)`;
}

window.applyComboDiscountPreset = function(pct) {
  document.querySelectorAll(".btn-preset-pill").forEach(p => {
    if (p.textContent.includes(`${pct}%`)) {
      p.classList.add("active");
    } else {
      p.classList.remove("active");
    }
  });

  document.getElementById("combo-calc-percent").value = pct;
  const totalRegular = currentComboBuilderItems.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0);
  if (totalRegular > 0) {
    const discounted = totalRegular * (1 - (pct / 100));
    document.getElementById("combo-calc-final").value = discounted.toFixed(2);
  }
  updateComboPricingAndItemsUI(false);
};

window.onComboPercentChange = function() {
  const pct = parseFloat(document.getElementById("combo-calc-percent").value) || 0;
  const totalRegular = currentComboBuilderItems.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0);
  if (totalRegular > 0) {
    const discounted = Math.max(0, totalRegular * (1 - (pct / 100)));
    document.getElementById("combo-calc-final").value = discounted.toFixed(2);
  }
  updateComboPricingAndItemsUI(false);
};

window.onComboPriceChange = function() {
  const finalPrice = parseFloat(document.getElementById("combo-calc-final").value) || 0;
  const totalRegular = currentComboBuilderItems.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0);
  if (totalRegular > 0) {
    const pct = Math.max(0, ((totalRegular - finalPrice) / totalRegular) * 100);
    document.getElementById("combo-calc-percent").value = pct.toFixed(1);
  }
  updateComboPricingAndItemsUI(false);
};

document.getElementById("btn-save-combo").addEventListener("click", async () => {
  const id = document.getElementById("combo-edit-id").value;
  const name = document.getElementById("combo-input-name").value.trim();
  const badge = document.getElementById("combo-input-badge").value.trim();
  const desc = document.getElementById("combo-input-desc").value.trim();
  const price = parseFloat(document.getElementById("combo-calc-final").value);
  const active = document.getElementById("combo-input-active").checked;

  if (!name) {
    alert("Informe o nome do combo.");
    return;
  }

  if (currentComboBuilderItems.length === 0) {
    alert("Adicione pelo menos 1 item à composição deste combo.");
    return;
  }

  if (isNaN(price) || price <= 0) {
    alert("Informe um preço promocional válido para o combo.");
    return;
  }

  const image = document.getElementById("combo-input-image").value.trim() || null;

  const regularPrice = currentComboBuilderItems.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0);
  const discountPercent = regularPrice > 0 ? Math.round(((regularPrice - price) / regularPrice) * 100) : 0;

  const combos = VIPDatabase.getCombos();

  if (id) {
    const item = combos.find(c => c.id === id);
    if (item) {
      item.name = name;
      item.badge = badge;
      item.description = desc;
      item.items = currentComboBuilderItems;
      item.regularPrice = regularPrice;
      item.price = price;
      item.discountPercent = discountPercent;
      item.active = active;
      item.image = image;
    }
  } else {
    combos.push({
      id: "combo-" + Date.now(),
      name: name,
      badge: badge,
      description: desc,
      items: currentComboBuilderItems,
      regularPrice: regularPrice,
      price: price,
      discountPercent: discountPercent,
      active: active,
      image: image
    });
  }

  const btn = document.getElementById("btn-save-combo");
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up fa-fade"></i> Salvando na nuvem...';

  try {
    await VIPDatabase.saveCombos(combos);
  } catch (e) {
    console.warn("Aviso ao salvar combo:", e);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
    closeComboModal();
    renderCombosTable();
  }
});

const comboBackdrop = document.getElementById("modal-combo-backdrop");
if (comboBackdrop) comboBackdrop.addEventListener("click", closeComboModal);

// ==========================================
// 7. CONFIGURAÇÕES DA LOJA E SEGURANÇA
// ==========================================
async function populateSettingsForm(force = false) {
  const cfg = VIPDatabase.getConfig();

  const nameEl = document.getElementById("cfg-name");
  const pickupEl = document.getElementById("cfg-pickup");
  const whatsappEl = document.getElementById("cfg-whatsapp");
  const logoUrlInput = document.getElementById("cfg-logo-url");

  // Se o usuário estiver ativamente digitando (campo com foco), NÃO sobrescreve a digitação dele
  if (nameEl && (force || document.activeElement !== nameEl)) {
    nameEl.value = cfg.name || "";
  }
  if (pickupEl && (force || document.activeElement !== pickupEl)) {
    pickupEl.value = cfg.pickupAddress || "";
  }
  if (whatsappEl && (force || document.activeElement !== whatsappEl)) {
    whatsappEl.value = cfg.whatsappNumber || "";
  }

  // Carrega configurações de Pix
  const pixKeyEl = document.getElementById("cfg-pix-key");
  const pixTypeEl = document.getElementById("cfg-pix-type");
  const pixNameEl = document.getElementById("cfg-pix-name");
  const pixCityEl = document.getElementById("cfg-pix-city");

  if (pixKeyEl && (force || document.activeElement !== pixKeyEl)) {
    pixKeyEl.value = cfg.pixKey || "";
  }
  if (pixTypeEl && (force || document.activeElement !== pixTypeEl)) {
    pixTypeEl.value = cfg.pixKeyType || "telefone";
  }
  if (pixNameEl && (force || document.activeElement !== pixNameEl)) {
    pixNameEl.value = cfg.pixReceiverName || cfg.name || "Salgados VIP";
  }
  if (pixCityEl && (force || document.activeElement !== pixCityEl)) {
    pixCityEl.value = cfg.pixCity || "Nova Iguaçu";
  }

  // Carrega logotipo da loja
  const logoUrl = cfg.logoUrl || "";
  const logoPreview = document.getElementById("cfg-logo-preview");
  const logoEmptyState = document.getElementById("cfg-logo-empty-state");
  const btnRemoveLogo = document.getElementById("btn-remove-logo");
  const btnCropLogo = document.getElementById("btn-crop-logo");

  if (logoUrlInput && (force || document.activeElement !== logoUrlInput)) {
    logoUrlInput.value = logoUrl;
  }
  if (logoUrl) {
    if (logoPreview) { logoPreview.src = logoUrl; logoPreview.style.display = "block"; }
    if (logoEmptyState) logoEmptyState.style.display = "none";
    if (btnRemoveLogo) btnRemoveLogo.style.display = "inline-flex";
    if (btnCropLogo) btnCropLogo.style.display = "inline-flex";
  } else {
    if (logoPreview) { logoPreview.src = ""; logoPreview.style.display = "none"; }
    if (logoEmptyState) logoEmptyState.style.display = "flex";
    if (btnRemoveLogo) btnRemoveLogo.style.display = "none";
    if (btnCropLogo) btnCropLogo.style.display = "inline-flex";
  }

  renderWeeklyScheduleTable(cfg);

  try {
    const authRec = await VIPAuth.getCloudAuthRecord();
    if (authRec) {
      const uEl = document.getElementById("cfg-auth-user");
      const eEl = document.getElementById("cfg-auth-email");
      if (uEl) uEl.value = authRec.username || "admin";
      if (eEl) eEl.value = authRec.email || "admin@salgadosvip.com.br";
    }
  } catch (err) {
    const uEl = document.getElementById("cfg-auth-user");
    const eEl = document.getElementById("cfg-auth-email");
    if (uEl) uEl.value = "admin";
    if (eEl) eEl.value = "admin@salgadosvip.com.br";
  }

  const pEl = document.getElementById("cfg-auth-pass");
  const pcEl = document.getElementById("cfg-auth-pass-confirm");
  if (pEl) pEl.value = "";
  if (pcEl) pcEl.value = "";
}

function renderWeeklyScheduleTable(cfg) {
  const tbody = document.getElementById("weekly-schedule-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const schedule = cfg.weeklySchedule || DEFAULT_WEEKLY_SCHEDULE;

  schedule.forEach(dayItem => {
    const tr = document.createElement("tr");
    tr.id = `sched-row-${dayItem.day}`;
    tr.className = dayItem.open ? "sched-row-open" : "sched-row-closed";

    tr.innerHTML = `
      <td>
        <strong style="color: #0f172a; font-size: 0.92rem;">${dayItem.dayName}</strong>
      </td>
      <td>
        <label class="switch-toggle-day">
          <input type="checkbox" id="sched-check-${dayItem.day}" ${dayItem.open ? "checked" : ""} onchange="onToggleDaySchedule(${dayItem.day})">
          <span class="badge-day-status ${dayItem.open ? "status-day-open" : "status-day-closed"}" id="sched-status-badge-${dayItem.day}">
            <i class="fa-solid ${dayItem.open ? 'fa-door-open' : 'fa-door-closed'}"></i> ${dayItem.open ? "Aberto" : "Fechado"}
          </span>
        </label>
      </td>
      <td>
        <input type="time" class="adm-time-picker" id="sched-open-${dayItem.day}" value="${dayItem.openTime || '16:00'}" ${!dayItem.open ? "disabled" : ""}>
      </td>
      <td>
        <input type="time" class="adm-time-picker" id="sched-close-${dayItem.day}" value="${dayItem.closeTime || '22:30'}" ${!dayItem.open ? "disabled" : ""}>
      </td>
      <td class="text-right">
        <button type="button" class="btn-copy-sched-day" onclick="copyScheduleToAll(${dayItem.day})" title="Copiar este horário para todos os outros dias da semana">
          <i class="fa-solid fa-copy"></i> Replicar
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.onToggleDaySchedule = function(dayIndex) {
  const checkEl = document.getElementById(`sched-check-${dayIndex}`);
  const openInput = document.getElementById(`sched-open-${dayIndex}`);
  const closeInput = document.getElementById(`sched-close-${dayIndex}`);
  const badgeEl = document.getElementById(`sched-status-badge-${dayIndex}`);
  const rowEl = document.getElementById(`sched-row-${dayIndex}`);

  const isOpen = checkEl ? checkEl.checked : false;

  if (openInput) openInput.disabled = !isOpen;
  if (closeInput) closeInput.disabled = !isOpen;

  if (badgeEl) {
    badgeEl.className = `badge-day-status ${isOpen ? "status-day-open" : "status-day-closed"}`;
    badgeEl.innerHTML = `<i class="fa-solid ${isOpen ? 'fa-door-open' : 'fa-door-closed'}"></i> ${isOpen ? "Aberto" : "Fechado"}`;
  }

  if (rowEl) {
    rowEl.className = isOpen ? "sched-row-open" : "sched-row-closed";
  }
};

window.copyScheduleToAll = function(sourceDayIndex) {
  const sourceCheck = document.getElementById(`sched-check-${sourceDayIndex}`);
  const sourceOpen = document.getElementById(`sched-open-${sourceDayIndex}`);
  const sourceClose = document.getElementById(`sched-close-${sourceDayIndex}`);

  if (!sourceCheck || !sourceOpen || !sourceClose) return;

  const isOpen = sourceCheck.checked;
  const openTime = sourceOpen.value;
  const closeTime = sourceClose.value;

  for (let d = 0; d < 7; d++) {
    const checkEl = document.getElementById(`sched-check-${d}`);
    const openEl = document.getElementById(`sched-open-${d}`);
    const closeEl = document.getElementById(`sched-close-${d}`);

    if (checkEl) checkEl.checked = isOpen;
    if (openEl) openEl.value = openTime;
    if (closeEl) closeEl.value = closeTime;

    onToggleDaySchedule(d);
  }

  const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  alert(`Horário de ${dayNames[sourceDayIndex]} (${isOpen ? `Aberto ${openTime} às ${closeTime}` : 'Fechado'}) replicado para todos os dias! Clique em 'Salvar Informações' para confirmar.`);
};

window.setAllDaysOpen = function(isOpen) {
  for (let d = 0; d < 7; d++) {
    const checkEl = document.getElementById(`sched-check-${d}`);
    if (checkEl) {
      checkEl.checked = isOpen;
      onToggleDaySchedule(d);
    }
  }
};

document.getElementById("btn-save-settings").addEventListener("click", async () => {
  const btn = document.getElementById("btn-save-settings");
  const origHtml = btn ? btn.innerHTML : "Salvar Configurações";

  const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const schedule = [];

  for (let d = 0; d < 7; d++) {
    const checkEl = document.getElementById(`sched-check-${d}`);
    const openEl = document.getElementById(`sched-open-${d}`);
    const closeEl = document.getElementById(`sched-close-${d}`);

    schedule.push({
      day: d,
      dayName: dayNames[d],
      open: checkEl ? checkEl.checked : true,
      openTime: openEl ? openEl.value : "16:00",
      closeTime: closeEl ? closeEl.value : "22:30"
    });
  }

  const firstOpen = schedule.find(s => s.open) || schedule[0];
  const [fOpenH, fOpenM] = (firstOpen.openTime || "16:00").split(":").map(Number);
  const [fCloseH, fCloseM] = (firstOpen.closeTime || "22:30").split(":").map(Number);

  let logoUrlVal = (document.getElementById("cfg-logo-url")?.value || "").trim();

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gravando no Supabase...';
  }

  try {
    // Se a logo informada for DataURL Base64, sobe diretamente para o Supabase Storage
    if (logoUrlVal.startsWith("data:image/") && typeof VIPDatabase.uploadImageToSupabase === "function") {
      if (btn) btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up fa-fade"></i> Enviando imagem para o Supabase Storage...';
      try {
        const publicUrl = await VIPDatabase.uploadImageToSupabase(logoUrlVal, "store_logo");
        if (publicUrl) {
          logoUrlVal = publicUrl;
          const urlInput = document.getElementById("cfg-logo-url");
          if (urlInput) urlInput.value = publicUrl;
          setLogoPreviewUI(publicUrl);
        }
      } catch (uploadErr) {
        console.warn("Falha no upload do logo para o Supabase Storage:", uploadErr);
      }
    }

    const nameEl = document.getElementById("cfg-name");
    const typedName = (nameEl?.value || "").trim();
    if (!typedName) {
      alert("Por favor, preencha o nome do estabelecimento.");
      if (nameEl) nameEl.focus();
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
      return;
    }

    const cfg = {
      name: typedName,
      location: "Nova Iguaçu - Rio de Janeiro",
      pickupAddress: (document.getElementById("cfg-pickup")?.value || "").trim(),
      whatsappNumber: (document.getElementById("cfg-whatsapp")?.value || "").trim(),
      pixKey: (document.getElementById("cfg-pix-key")?.value || "").trim(),
      pixKeyType: document.getElementById("cfg-pix-type")?.value || "telefone",
      pixReceiverName: (document.getElementById("cfg-pix-name")?.value || "").trim(),
      pixCity: (document.getElementById("cfg-pix-city")?.value || "Nova Iguaçu").trim(),
      openingHour: fOpenH || 16,
      openingMinute: fOpenM || 0,
      closingHour: fCloseH || 22,
      closingMinute: fCloseM || 30,
      logoUrl: logoUrlVal,
      weeklySchedule: schedule
    };

    if (btn) btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up fa-fade"></i> Gravando configurações na nuvem...';
    await VIPDatabase.saveConfig(cfg);
    populateSettingsForm(true);

    if (btn) {
      btn.className = "btn btn-success";
      btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Gravado com Sucesso!';
      setTimeout(() => {
        btn.className = "btn btn-primary";
        btn.innerHTML = origHtml;
        btn.disabled = false;
      }, 2000);
    }
    alert("Informações da loja, dados do PIX, logotipo e horários gravados com sucesso no Supabase!");
  } catch (err) {
    if (btn) {
      btn.className = "btn btn-primary";
      btn.innerHTML = origHtml;
      btn.disabled = false;
    }
    console.error("Erro ao salvar configurações no Supabase:", err);
    alert("Erro ao gravar configurações no Supabase: " + (err.message || err));
  }
});

// ==============================================================================
// TESTE & PRÉVIA DO QR CODE PIX NO ADMIN
// ==============================================================================
window.testPixQrCodeUI = function() {
  const key = (document.getElementById("cfg-pix-key")?.value || "").trim();
  const type = document.getElementById("cfg-pix-type")?.value || "telefone";
  const name = (document.getElementById("cfg-pix-name")?.value || "Salgados VIP").trim();
  const city = (document.getElementById("cfg-pix-city")?.value || "Nova Iguaçu").trim();

  if (!key) {
    alert("Por favor, preencha a Chave PIX antes de testar.");
    document.getElementById("cfg-pix-key")?.focus();
    return;
  }

  const testAmount = 50.00;
  let payload = "";
  if (typeof VIPPix !== "undefined") {
    payload = VIPPix.generatePayload({
      key: key,
      keyType: type,
      name: name,
      city: city,
      amount: testAmount,
      txid: "TESTE" + Math.floor(100 + Math.random() * 900)
    });
  }

  const qrEl = document.getElementById("admin-pix-test-qr");
  if (qrEl) qrEl.src = (typeof VIPPix !== "undefined") ? VIPPix.getQrCodeUrl(payload, 240) : "";

  const nameEl = document.getElementById("admin-pix-test-name");
  if (nameEl) nameEl.textContent = name;

  const keyEl = document.getElementById("admin-pix-test-key");
  if (keyEl) keyEl.textContent = key;

  const typeEl = document.getElementById("admin-pix-test-type");
  if (typeEl) typeEl.textContent = type.toUpperCase();

  const amountEl = document.getElementById("admin-pix-test-amount");
  if (amountEl) amountEl.textContent = formatBRL(testAmount);

  const codeEl = document.getElementById("admin-pix-test-code");
  if (codeEl) codeEl.value = payload;

  const backdrop = document.getElementById("modal-pix-test-backdrop");
  if (backdrop) backdrop.style.display = "block";

  const modal = document.getElementById("modal-pix-test");
  if (modal) modal.style.display = "block";
};

window.closePixTestModal = function() {
  const backdrop = document.getElementById("modal-pix-test-backdrop");
  if (backdrop) backdrop.style.display = "none";

  const modal = document.getElementById("modal-pix-test");
  if (modal) modal.style.display = "none";

  const feedback = document.getElementById("admin-pix-test-copy-feedback");
  if (feedback) feedback.style.display = "none";
};

window.copyAdminPixTestCode = function() {
  const codeEl = document.getElementById("admin-pix-test-code");
  if (!codeEl) return;
  codeEl.select();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(codeEl.value);
  } else {
    document.execCommand("copy");
  }
  const feedback = document.getElementById("admin-pix-test-copy-feedback");
  if (feedback) {
    feedback.style.display = "block";
    setTimeout(() => { feedback.style.display = "none"; }, 3000);
  }
};

// ==============================================================================
// GESTÃO DO LOGOTIPO DA LOJA & ENQUADRADOR / CROPPER INTERATIVO
// ==============================================================================
let cropperImg = null;
let cropperScale = 1.0;
let cropperPosX = 0;
let cropperPosY = 0;
let cropperRotation = 0;
let cropperMaskShape = "circle"; // "circle" or "square"
let isCropperDragging = false;
let cropperStartMouseX = 0;
let cropperStartMouseY = 0;
let cropperStartPosX = 0;
let cropperStartPosY = 0;
let cropperEventsBound = false;

window.triggerLogoFileInput = function() {
  const fileInput = document.getElementById("cfg-logo-file-input");
  if (fileInput) {
    fileInput.value = "";
    fileInput.click();
  }
};

window.handleLogoFileUpload = function(input) {
  const file = input.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP ou SVG).");
    input.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const rawData = e.target.result;
    // Abre diretamente a ferramenta de enquadramento interativo
    openLogoCropperModal(rawData);
    input.value = "";
  };
  reader.onerror = function() {
    alert("Erro ao ler o arquivo selecionado. Tente novamente.");
    input.value = "";
  };
  reader.readAsDataURL(file);
};

window.handleLogoUrlInput = function(url) {
  const trimmed = (url || "").trim();
  setLogoPreviewUI(trimmed);
};

window.removeStoreLogo = async function() {
  const fileInput = document.getElementById("cfg-logo-file-input");
  if (fileInput) fileInput.value = "";
  setLogoPreviewUI("");
  try {
    const currentCfg = VIPDatabase.getConfig();
    currentCfg.logoUrl = "";
    await VIPDatabase.saveConfig(currentCfg);
    alert("Logotipo removido e atualizado no Supabase.");
  } catch (err) {
    console.warn("Remove logo error:", err);
  }
};

function setLogoPreviewUI(urlOrData) {
  const urlInput = document.getElementById("cfg-logo-url");
  const previewImg = document.getElementById("cfg-logo-preview");
  const emptyBox = document.getElementById("cfg-logo-empty-state");
  const removeBtn = document.getElementById("btn-remove-logo");
  const cropBtn = document.getElementById("btn-crop-logo");

  if (urlInput) urlInput.value = urlOrData;
  if (urlOrData) {
    if (previewImg) {
      previewImg.src = urlOrData;
      previewImg.style.display = "block";
    }
    if (emptyBox) emptyBox.style.display = "none";
    if (removeBtn) removeBtn.style.display = "inline-flex";
    if (cropBtn) {
      cropBtn.style.display = "inline-flex";
      cropBtn.title = "Enquadrar ou cortar a logo atual";
    }
  } else {
    if (previewImg) {
      previewImg.src = "";
      previewImg.style.display = "none";
    }
    if (emptyBox) emptyBox.style.display = "flex";
    if (removeBtn) removeBtn.style.display = "none";
    if (cropBtn) {
      cropBtn.style.display = "inline-flex";
      cropBtn.title = "Carregue ou enquadre uma imagem";
    }
  }
}

window.openLogoCropperModal = function(imageSrc) {
  if (!imageSrc) {
    const currentLogo = (document.getElementById("cfg-logo-url")?.value || "").trim();
    if (!currentLogo) {
      triggerLogoFileInput();
      return;
    }
    imageSrc = currentLogo;
  }

  const modal = document.getElementById("modal-logo-cropper");
  const backdrop = document.getElementById("modal-logo-cropper-backdrop");
  if (!modal || !backdrop) return;

  modal.style.display = "block";
  backdrop.style.display = "block";
  modal.classList.add("active");
  backdrop.classList.add("active");

  const img = new Image();
  if (typeof imageSrc === "string" && !imageSrc.startsWith("data:")) {
    img.crossOrigin = "anonymous";
  }

  img.onload = function() {
    cropperImg = img;
    cropperRotation = 0;
    cropperMaskShape = "circle";
    initCropperEvents();
    cropperFitCover();
  };

  img.onerror = function() {
    if (img.crossOrigin) {
      const fallbackImg = new Image();
      fallbackImg.onload = function() {
        cropperImg = fallbackImg;
        cropperRotation = 0;
        cropperMaskShape = "circle";
        initCropperEvents();
        cropperFitCover();
      };
      fallbackImg.onerror = function() {
        alert("Não foi possível carregar a imagem para recorte. Carregue uma imagem do seu dispositivo.");
        closeLogoCropperModal();
      };
      fallbackImg.src = imageSrc;
      return;
    }
    alert("Não foi possível carregar a imagem para recorte. Carregue uma imagem do seu dispositivo.");
    closeLogoCropperModal();
  };

  img.src = imageSrc;
};

window.openCurrentLogoInCropper = function() {
  const currentLogo = (document.getElementById("cfg-logo-url")?.value || "").trim();
  if (currentLogo) {
    openLogoCropperModal(currentLogo);
  } else {
    triggerLogoFileInput();
  }
};

window.closeLogoCropperModal = function() {
  const modal = document.getElementById("modal-logo-cropper");
  const backdrop = document.getElementById("modal-logo-cropper-backdrop");
  if (modal) {
    modal.classList.remove("active");
    modal.style.display = "none";
  }
  if (backdrop) {
    backdrop.classList.remove("active");
    backdrop.style.display = "none";
  }
};

function initCropperEvents() {
  if (cropperEventsBound) return;
  const canvas = document.getElementById("cropper-canvas");
  if (!canvas) return;

  // Mouse Drag
  canvas.addEventListener("mousedown", (e) => {
    isCropperDragging = true;
    cropperStartMouseX = e.clientX;
    cropperStartMouseY = e.clientY;
    cropperStartPosX = cropperPosX;
    cropperStartPosY = cropperPosY;
    canvas.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isCropperDragging) return;
    const dx = e.clientX - cropperStartMouseX;
    const dy = e.clientY - cropperStartMouseY;
    cropperPosX = cropperStartPosX + dx;
    cropperPosY = cropperStartPosY + dy;
    renderCropperCanvas();
  });

  window.addEventListener("mouseup", () => {
    if (isCropperDragging) {
      isCropperDragging = false;
      const c = document.getElementById("cropper-canvas");
      if (c) c.style.cursor = "grab";
    }
  });

  // Touch Drag
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      isCropperDragging = true;
      cropperStartMouseX = e.touches[0].clientX;
      cropperStartMouseY = e.touches[0].clientY;
      cropperStartPosX = cropperPosX;
      cropperStartPosY = cropperPosY;
    }
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (!isCropperDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - cropperStartMouseX;
    const dy = e.touches[0].clientY - cropperStartMouseY;
    cropperPosX = cropperStartPosX + dx;
    cropperPosY = cropperStartPosY + dy;
    renderCropperCanvas();
  }, { passive: true });

  window.addEventListener("touchend", () => {
    isCropperDragging = false;
  });

  // Wheel Zoom
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomStep = e.deltaY < 0 ? 0.08 : -0.08;
    stepCropperZoom(zoomStep);
  }, { passive: false });

  cropperEventsBound = true;
}

window.renderCropperCanvas = function() {
  const canvas = document.getElementById("cropper-canvas");
  if (!canvas || !cropperImg) return;

  const ctx = canvas.getContext("2d");
  const cw = canvas.width;
  const ch = canvas.height;
  const cropSize = 280;
  const cropRadius = cropSize / 2;
  const cx = cw / 2;
  const cy = ch / 2;

  ctx.clearRect(0, 0, cw, ch);

  // Fundo quadriculado (indicador de transparência)
  drawCheckerboard(ctx, cw, ch);

  // Desenha imagem com transformações
  ctx.save();
  ctx.translate(cx + cropperPosX, cy + cropperPosY);
  ctx.rotate((cropperRotation * Math.PI) / 180);
  ctx.scale(cropperScale, cropperScale);
  ctx.drawImage(cropperImg, -cropperImg.width / 2, -cropperImg.height / 2, cropperImg.width, cropperImg.height);
  ctx.restore();

  // Máscara externa semitransparente escurecida
  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
  ctx.beginPath();
  ctx.rect(0, 0, cw, ch);

  if (cropperMaskShape === "circle") {
    ctx.arc(cx, cy, cropRadius, 0, Math.PI * 2, true);
  } else {
    drawRoundedRectPath(ctx, cx - cropRadius, cy - cropRadius, cropSize, cropSize, 28, true);
  }
  ctx.fill();

  // Borda da janela de corte
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  if (cropperMaskShape === "circle") {
    ctx.arc(cx, cy, cropRadius, 0, Math.PI * 2, false);
  } else {
    drawRoundedRectPath(ctx, cx - cropRadius, cy - cropRadius, cropSize, cropSize, 28, false);
  }
  ctx.stroke();

  // Guias de enquadramento em terços (tracejadas)
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(cx - cropRadius + cropSize / 3, cy - cropRadius + 15);
  ctx.lineTo(cx - cropRadius + cropSize / 3, cy + cropRadius - 15);
  ctx.moveTo(cx - cropRadius + (cropSize * 2) / 3, cy - cropRadius + 15);
  ctx.lineTo(cx - cropRadius + (cropSize * 2) / 3, cy + cropRadius - 15);
  ctx.moveTo(cx - cropRadius + 15, cy - cropRadius + cropSize / 3);
  ctx.lineTo(cx + cropRadius - 15, cy - cropRadius + cropSize / 3);
  ctx.moveTo(cx - cropRadius + 15, cy - cropRadius + (cropSize * 2) / 3);
  ctx.lineTo(cx + cropRadius - 15, cy - cropRadius + (cropSize * 2) / 3);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
};

function drawCheckerboard(ctx, w, h) {
  const size = 10;
  for (let x = 0; x < w; x += size) {
    for (let y = 0; y < h; y += size) {
      ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? "#f8fafc" : "#e2e8f0";
      ctx.fillRect(x, y, size, size);
    }
  }
}

function drawRoundedRectPath(ctx, x, y, width, height, radius, counterClockwise = false) {
  ctx.moveTo(x + radius, y);
  if (!counterClockwise) {
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  } else {
    ctx.lineTo(x + radius, y);
    ctx.quadraticCurveTo(x, y, x, y + radius);
    ctx.lineTo(x, y + height - radius);
    ctx.quadraticCurveTo(x, y + height, x + radius, y + height);
    ctx.lineTo(x + width - radius, y + height);
    ctx.quadraticCurveTo(x + width, y + height, x + width, y + height - radius);
    ctx.lineTo(x + width, y + radius);
    ctx.quadraticCurveTo(x + width, y, x + width - radius, y);
    ctx.lineTo(x + radius, y);
  }
}

window.onCropperZoomSlider = function(val) {
  cropperScale = parseFloat(val);
  updateZoomLabel();
  renderCropperCanvas();
};

window.stepCropperZoom = function(delta) {
  const slider = document.getElementById("cropper-zoom-range");
  cropperScale = Math.max(0.2, Math.min(3.5, cropperScale + delta));
  if (slider) slider.value = cropperScale;
  updateZoomLabel();
  renderCropperCanvas();
};

function updateZoomLabel() {
  const el = document.getElementById("cropper-zoom-val");
  if (el) el.textContent = `${Math.round(cropperScale * 100)}%`;
}

window.resetCropperPosition = function() {
  cropperPosX = 0;
  cropperPosY = 0;
  renderCropperCanvas();
};

window.cropperFitCover = function() {
  if (!cropperImg) return;
  const cropSize = 280;
  const scaleW = cropSize / cropperImg.width;
  const scaleH = cropSize / cropperImg.height;
  cropperScale = Math.max(scaleW, scaleH);
  cropperPosX = 0;
  cropperPosY = 0;
  const slider = document.getElementById("cropper-zoom-range");
  if (slider) slider.value = cropperScale;
  updateZoomLabel();
  renderCropperCanvas();
};

window.cropperFitContain = function() {
  if (!cropperImg) return;
  const cropSize = 280;
  const scaleW = cropSize / cropperImg.width;
  const scaleH = cropSize / cropperImg.height;
  cropperScale = Math.min(scaleW, scaleH);
  cropperPosX = 0;
  cropperPosY = 0;
  const slider = document.getElementById("cropper-zoom-range");
  if (slider) slider.value = cropperScale;
  updateZoomLabel();
  renderCropperCanvas();
};

window.rotateCropperImage = function() {
  cropperRotation = (cropperRotation + 90) % 360;
  renderCropperCanvas();
};

window.setCropperMaskShape = function(shape) {
  cropperMaskShape = shape;
  document.getElementById("btn-mask-circle")?.classList.toggle("active", shape === "circle");
  document.getElementById("btn-mask-square")?.classList.toggle("active", shape === "square");
  renderCropperCanvas();
};

window.applyLogoCropAndSave = function() {
  if (!cropperImg) return;

  const exportSize = 512;
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = exportSize;
  exportCanvas.height = exportSize;
  const eCtx = exportCanvas.getContext("2d");
  eCtx.imageSmoothingEnabled = true;
  eCtx.imageSmoothingQuality = "high";

  const cropSizeOnViewer = 280;
  const factor = exportSize / cropSizeOnViewer;

  eCtx.save();

  // Se o usuário selecionou recorte redondo, aplica recorte circular limpo com cantos transparentes
  if (cropperMaskShape === "circle") {
    eCtx.beginPath();
    eCtx.arc(exportSize / 2, exportSize / 2, exportSize / 2, 0, Math.PI * 2);
    eCtx.clip();
  }

  eCtx.translate(exportSize / 2 + cropperPosX * factor, exportSize / 2 + cropperPosY * factor);
  eCtx.rotate((cropperRotation * Math.PI) / 180);
  eCtx.scale(cropperScale * factor, cropperScale * factor);
  eCtx.drawImage(cropperImg, -cropperImg.width / 2, -cropperImg.height / 2, cropperImg.width, cropperImg.height);
  eCtx.restore();

  const saveBtn = document.querySelector("#modal-logo-cropper .btn-primary-admin");
  const origBtnText = saveBtn ? saveBtn.innerHTML : "";
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando para Supabase...';
  }

  exportCanvas.toBlob(async (blob) => {
    let finalLogoUrl = "";
    try {
      if (blob && typeof VIPDatabase.uploadImageToSupabase === "function") {
        const publicUrl = await VIPDatabase.uploadImageToSupabase(blob, "store_logo");
        if (publicUrl) {
          finalLogoUrl = publicUrl;
        }
      }
    } catch (uploadErr) {
      console.warn("Falha no upload do logo recortado para Supabase Storage:", uploadErr);
    }

    if (!finalLogoUrl) {
      try {
        finalLogoUrl = exportCanvas.toDataURL("image/png");
      } catch (err) {
        finalLogoUrl = cropperImg.src;
      }
    }

    setLogoPreviewUI(finalLogoUrl);
    closeLogoCropperModal();

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = origBtnText;
    }

    try {
      const cfg = VIPDatabase.getConfig();
      cfg.logoUrl = finalLogoUrl;
      await VIPDatabase.saveConfig(cfg);
      alert("Logotipo enquadrado e gravado com sucesso no Supabase!");
    } catch (saveErr) {
      console.warn("Erro ao salvar config do logo no Supabase:", saveErr);
      alert("Logotipo enquadrado! Ocorreu um aviso ao salvar na nuvem: " + (saveErr.message || saveErr));
    }
  }, "image/png");
};

// Gestão da Chave Mestra e Credenciais Seguras
window.copyMasterKeyUI = function() {
  const keyInput = document.getElementById("cfg-master-key");
  if (!keyInput) return;
  navigator.clipboard.writeText(keyInput.value).then(() => {
    alert("Chave Mestra copiada para a área de transferência! Guarde-a em um local seguro.");
  }).catch(() => {
    keyInput.select();
    document.execCommand("copy");
    alert("Chave Mestra copiada!");
  });
};

window.generateNewMasterKeyUI = function() {
  const keyInput = document.getElementById("cfg-master-key");
  if (!keyInput) return;
  if (confirm("Deseja gerar uma nova Chave Mestra de Recuperação? A chave anterior deixará de funcionar quando você salvar as configurações.")) {
    keyInput.value = VIPAuth.generateMasterKey();
  }
};

window.saveAdminAuthSettingsUI = async function() {
  const user = document.getElementById("cfg-auth-user").value.trim();
  const email = document.getElementById("cfg-auth-email").value.trim();
  const pass = document.getElementById("cfg-auth-pass").value.trim();
  const passConfirm = document.getElementById("cfg-auth-pass-confirm").value.trim();
  const masterKey = document.getElementById("cfg-master-key").value.trim();
  const msgEl = document.getElementById("auth-feedback-msg");
  const btn = document.getElementById("btn-save-auth");

  if (!user) {
    alert("Informe o nome de usuário.");
    return;
  }
  if (!email || !email.includes("@")) {
    alert("Informe um e-mail de recuperação válido.");
    return;
  }
  if (pass && pass.length < 6) {
    alert("A nova senha deve ter no mínimo 6 caracteres.");
    return;
  }
  if (pass && pass !== passConfirm) {
    alert("As senhas digitadas não coincidem.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criptografando e Salvando na Nuvem...';
  }
  if (msgEl) msgEl.style.display = "none";

  try {
    const res = await VIPAuth.updateCredentials({
      username: user,
      email: email,
      newPassword: pass || null,
      newMasterKey: masterKey || null
    });

    if (res.success) {
      if (msgEl) {
        msgEl.style.display = "block";
        msgEl.style.background = "#ecfdf5";
        msgEl.style.color = "#047857";
        msgEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> <strong>Credenciais salvas com sucesso no Supabase!</strong> Senha protegida por criptografia SHA-256.';
      }
      document.getElementById("cfg-auth-pass").value = "";
      document.getElementById("cfg-auth-pass-confirm").value = "";
    } else {
      if (msgEl) {
        msgEl.style.display = "block";
        msgEl.style.background = "#fee2e2";
        msgEl.style.color = "#991b1b";
        msgEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${res.message || "Erro ao salvar credenciais."}`;
      }
    }
  } catch (err) {
    alert("Erro ao salvar: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Salvar Credenciais na Nuvem com Criptografia';
    }
    setTimeout(() => { if (msgEl) msgEl.style.display = "none"; }, 6000);
  }
};

// Configuração de Impressora Térmica & Comandas
function populatePrinterSettings(force = false) {
  const pCfg = VIPDatabase.getPrinterConfig();
  const autoPrintEl = document.getElementById("cfg-printer-autoprint");
  const silentEl = document.getElementById("cfg-printer-silent");
  const soundEl = document.getElementById("cfg-printer-sound");
  const autoCutEl = document.getElementById("cfg-printer-autocut");
  const targetEl = document.getElementById("cfg-printer-target");
  const paperEl = document.getElementById("cfg-printer-paper");
  const copiesEl = document.getElementById("cfg-printer-copies");
  const prepTimeEl = document.getElementById("cfg-printer-preptime");

  // Controles de Tipografia, Tamanho, Estilo e Margens
  const fontFamEl = document.getElementById("cfg-printer-font-family");
  const fontSizeEl = document.getElementById("cfg-printer-font-size");
  const fontWeightEl = document.getElementById("cfg-printer-font-weight");
  const lineSpacingEl = document.getElementById("cfg-printer-line-spacing");
  const widthMmEl = document.getElementById("cfg-printer-width-mm");
  const marginMmEl = document.getElementById("cfg-printer-margin-mm");
  const columnsEl = document.getElementById("cfg-printer-columns");
  const showLogoEl = document.getElementById("cfg-printer-show-logo");
  const highlightDrinksEl = document.getElementById("cfg-printer-highlight-drinks");
  const showMotoboyEl = document.getElementById("cfg-printer-show-motoboy");
  const showPixEl = document.getElementById("cfg-printer-show-pix");

  if (autoPrintEl && (force || document.activeElement !== autoPrintEl)) autoPrintEl.checked = pCfg.autoPrintNewOrders !== false;
  if (silentEl && (force || document.activeElement !== silentEl)) silentEl.checked = pCfg.silentPrintMode !== false;
  if (soundEl && (force || document.activeElement !== soundEl)) soundEl.checked = pCfg.soundAlert !== false;
  if (autoCutEl && (force || document.activeElement !== autoCutEl)) autoCutEl.checked = pCfg.autoCutPaper !== false;
  if (targetEl && (force || document.activeElement !== targetEl)) targetEl.value = pCfg.printerTarget || "windows_default";
  if (paperEl && (force || document.activeElement !== paperEl)) paperEl.value = pCfg.paperWidth || "80mm";
  if (copiesEl && (force || document.activeElement !== copiesEl)) copiesEl.value = String(pCfg.copies || 1);
  if (prepTimeEl && (force || document.activeElement !== prepTimeEl)) prepTimeEl.value = pCfg.targetPrepTimeMinutes || 35;

  if (fontFamEl && (force || document.activeElement !== fontFamEl)) fontFamEl.value = pCfg.fontFamily || "monospace";
  if (fontSizeEl && (force || document.activeElement !== fontSizeEl)) fontSizeEl.value = pCfg.fontSize || "medium";
  if (fontWeightEl && (force || document.activeElement !== fontWeightEl)) fontWeightEl.value = pCfg.fontWeight || "bold";
  if (lineSpacingEl && (force || document.activeElement !== lineSpacingEl)) lineSpacingEl.value = pCfg.lineSpacing || "normal";
  if (widthMmEl && (force || document.activeElement !== widthMmEl)) widthMmEl.value = String(pCfg.printableWidthMm || (pCfg.paperWidth === "58mm" ? 50 : 76));
  if (marginMmEl && (force || document.activeElement !== marginMmEl)) marginMmEl.value = String(pCfg.marginSideMm !== undefined ? pCfg.marginSideMm : 2);
  if (columnsEl && (force || document.activeElement !== columnsEl)) columnsEl.value = String(pCfg.textColumns || 40);
  if (showLogoEl && (force || document.activeElement !== showLogoEl)) showLogoEl.checked = pCfg.printLogo !== false;
  if (highlightDrinksEl && (force || document.activeElement !== highlightDrinksEl)) highlightDrinksEl.checked = pCfg.highlightDrinks !== false;
  if (showMotoboyEl && (force || document.activeElement !== showMotoboyEl)) showMotoboyEl.checked = pCfg.showMotoboyBox !== false;
  if (showPixEl && (force || document.activeElement !== showPixEl)) showPixEl.checked = pCfg.printPixDetails !== false;

  // Atualizar prévia ao vivo
  if (typeof window.updatePrinterLivePreview === "function") {
    window.updatePrinterLivePreview();
  }
}

// Pré-visualização Dinâmica Ao Vivo do Cupom Térmico
window.updatePrinterLivePreview = function() {
  const previewBox = document.getElementById("printer-live-preview-box");
  if (!previewBox) return;

  const pCfg = VIPDatabase.getPrinterConfig();
  const cfg = VIPDatabase.getConfig();

  const fontFamilyVal = document.getElementById("cfg-printer-font-family")?.value || pCfg.fontFamily || "monospace";
  const fontSizeVal = document.getElementById("cfg-printer-font-size")?.value || pCfg.fontSize || "medium";
  const fontWeightVal = document.getElementById("cfg-printer-font-weight")?.value || pCfg.fontWeight || "bold";
  const lineSpacingVal = document.getElementById("cfg-printer-line-spacing")?.value || pCfg.lineSpacing || "normal";
  const widthMmVal = parseInt(document.getElementById("cfg-printer-width-mm")?.value) || pCfg.printableWidthMm || 76;
  const marginMmVal = document.getElementById("cfg-printer-margin-mm") ? parseInt(document.getElementById("cfg-printer-margin-mm").value) : (pCfg.marginSideMm !== undefined ? pCfg.marginSideMm : 2);
  const showLogo = document.getElementById("cfg-printer-show-logo") ? document.getElementById("cfg-printer-show-logo").checked : (pCfg.printLogo !== false);
  const highlightDrinks = document.getElementById("cfg-printer-highlight-drinks") ? document.getElementById("cfg-printer-highlight-drinks").checked : (pCfg.highlightDrinks !== false);
  const showMotoboy = document.getElementById("cfg-printer-show-motoboy") ? document.getElementById("cfg-printer-show-motoboy").checked : (pCfg.showMotoboyBox !== false);
  const showPix = document.getElementById("cfg-printer-show-pix") ? document.getElementById("cfg-printer-show-pix").checked : (pCfg.printPixDetails !== false);

  const dimBadge = document.getElementById("printer-preview-dimension-badge");
  if (dimBadge) {
    dimBadge.textContent = `Área ${widthMmVal}mm | Margens ${marginMmVal}mm (Economia Máxima)`;
  }

  let fontFamCss = "'Consolas', 'Courier New', Courier, monospace";
  if (fontFamilyVal === "sans-serif") {
    fontFamCss = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  } else if (fontFamilyVal === "condensed") {
    fontFamCss = "'Arial Narrow', 'Franklin Gothic Medium', 'Tw Cen MT', sans-serif";
  }

  let fontSizeCss = "11pt";
  if (fontSizeVal === "small") fontSizeCss = "9.5pt";
  else if (fontSizeVal === "large") fontSizeCss = "12.5pt";
  else if (fontSizeVal === "xlarge") fontSizeCss = "14pt";

  let fontWeightCss = "700";
  if (fontWeightVal === "normal") fontWeightCss = "500";
  else if (fontWeightVal === "heavy") fontWeightCss = "900";

  let lineHeightCss = "1.28";
  if (lineSpacingVal === "compact") lineHeightCss = "1.15";
  else if (lineSpacingVal === "spacious") lineHeightCss = "1.45";

  previewBox.style.width = `${widthMmVal}mm`;
  previewBox.style.maxWidth = "100%";
  previewBox.style.marginLeft = "auto";
  previewBox.style.marginRight = "auto";
  previewBox.style.paddingLeft = `${marginMmVal}mm`;
  previewBox.style.paddingRight = `${marginMmVal}mm`;
  previewBox.style.boxSizing = "border-box";
  previewBox.style.fontFamily = fontFamCss;
  previewBox.style.fontSize = fontSizeCss;
  previewBox.style.fontWeight = fontWeightCss;
  previewBox.style.lineHeight = lineHeightCss;

  const nowStr = new Date().toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const logoHtml = (showLogo && cfg.logoUrl) ? `
    <div style="text-align: center; margin-bottom: 6px;">
      <img src="${cfg.logoUrl}" alt="Logo" style="max-height: 52px; max-width: 140px; object-fit: contain; filter: grayscale(100%) contrast(150%);">
    </div>
  ` : "";

  const drinksBannerHtml = highlightDrinks ? `
    <div class="receipt-drink-pill-banner">
      *** 🥤 PEDIDO CONTÉM BEBIDA GELADA (1 UN) ***
    </div>
  ` : "";

  const drinksRowHtml = highlightDrinks ? `
    <tr class="receipt-drink-item-row">
      <td colspan="2" class="receipt-item-desc receipt-drink-name">
        🥤 [BEBIDA GELADA] 1x Coca-Cola 2L
        <span class="receipt-drink-subhighlight">➔ PEGAR NA GELADEIRA ANTES DE ENVIAR</span>
      </td>
      <td style="text-align:right; font-weight:bold;">R$ 14,00</td>
    </tr>
  ` : `
    <tr>
      <td colspan="2" class="receipt-item-desc">1x Coca-Cola 2L</td>
      <td style="text-align:right; font-weight:bold;">R$ 14,00</td>
    </tr>
  `;

  const drinksChecklistHtml = highlightDrinks ? `
    <div class="receipt-drinks-checklist-box">
      <div class="drinks-checklist-title">*** 🥤 ATENÇÃO: NÃO ESQUECER A BEBIDA! ***</div>
      <div class="drinks-checklist-sub">RETIRAR DA GELADEIRA ANTES DE ENTREGAR AO MOTOBOY:</div>
      <div class="drinks-checklist-items">
        <div class="drinks-chk-item">[ ] 👉 <strong>1x Coca-Cola 2L</strong></div>
      </div>
    </div>
  ` : "";

  const motoboyBoxHtml = showMotoboy ? `
    <div class="receipt-motoboy-box">
      <div class="motoboy-box-header">*** ATENÇÃO MOTOBOY: DINHEIRO COM TROCO ***</div>
      <div class="motoboy-box-badge">COBRAR DO CLIENTE NA ENTREGA</div>
      <div class="motoboy-box-amount">TOTAL A COBRAR: R$ 86,00</div>
      <div class="motoboy-box-instructions">
        Receber em dinheiro e conferir as notas no ato da entrega.
      </div>
      <div class="receipt-change-highlight">
        <div class="change-line-title">🚨 ATENÇÃO: SEPARAR TROCO NA SAÍDA 🚨</div>
        <div class="change-line-detail">Cliente vai pagar com: <strong>R$ 100,00</strong></div>
        <div class="change-line-action">👉 LEVAR DE TROCO: R$ 14,00</div>
      </div>
      ${highlightDrinks ? `
        <div class="motoboy-drink-check">
          [ ] CONFERIU A BEBIDA NA BAG? (🥤 1 item gelado)
        </div>
      ` : ""}
    </div>
  ` : "";

  const pixBoxHtml = showPix ? `
    <div class="receipt-pix-box">
      <strong>*** PAGAMENTO VIA PIX ***</strong><br>
      <span>Chave: <strong>${cfg.pixKey || "(21) 98675-8102"}</strong></span><br>
      <span>Favorecido: ${cfg.name || "Salgados VIP"}</span><br>
      <small>Favor enviar o comprovante no WhatsApp da loja</small>
    </div>
  ` : "";

  previewBox.innerHTML = `
    <div class="receipt-copy">
      <div class="receipt-header">
        ${logoHtml}
        <h2>${(cfg.name || "SALGADOS VIP").toUpperCase()}</h2>
        <p>DELIVERY & BALCÃO - NOVA IGUAÇU</p>
        <p>Rua Isabel Pedrosa, 31 - Da Luz</p>
        <p>WhatsApp: ${cfg.phone || "(21) 98675-8102"}</p>
        <div style="margin-top: 4px; font-weight: bold; font-size: 10pt;">[ 1ª VIA - CONTROLE & COZINHA ]</div>
      </div>

      <div class="receipt-order-meta">
        <div class="row">
          <span><strong>PEDIDO:</strong> #DEMO-108</span>
          <span><strong>DATA:</strong> ${nowStr}</span>
        </div>
        <div class="row">
          <span><strong>CLIENTE:</strong> Ana Paula Souza</span>
        </div>
        <div class="row">
          <span><strong>CONTATO:</strong> (21) 98765-4321</span>
        </div>
        <div class="row" style="margin-top: 4px;">
          <span><strong>TIPO:</strong> MOTO ENTREGA EM DOMICÍLIO</span>
        </div>
        <div class="row" style="margin-top: 2px;">
          <span><strong>PREVISÃO:</strong> IMEDIATO / AGORA</span>
        </div>
        ${drinksBannerHtml}
        <div style="margin-top: 2px;">
          <strong>ENDEREÇO:</strong><br>
          Rua Bernardino de Mello, 1450, Apto 201 - Centro, Nova Iguaçu<br>
          <small><strong>DISTÂNCIA ESTIMADA:</strong> 2.4 km (Centro)</small>
        </div>
      </div>

      <div class="receipt-divider"></div>
      <div class="receipt-section-title">ITENS DO PEDIDO</div>

      <table class="receipt-items-table">
        <tr>
          <td colspan="2" class="receipt-item-desc">1x Cento de Salgados Fritos Tradicionais</td>
          <td style="text-align:right; font-weight:bold;">R$ 64,00</td>
        </tr>
        <tr>
          <td colspan="3" class="receipt-subitems">
            <div class="receipt-flavor-line"><span class="receipt-flavor-qty">▶ 40x</span> <strong>COXINHA DE FRANGO C/ CATUPIRY</strong></div>
            <div class="receipt-flavor-line"><span class="receipt-flavor-qty">▶ 30x</span> <strong>BOLINHA DE QUEIJO</strong></div>
            <div class="receipt-flavor-line"><span class="receipt-flavor-qty">▶ 30x</span> <strong>KIBE TRADICIONAL</strong></div>
            <div class="receipt-extra-line">★ Molhos: 2x Molho Barbecue Especial</div>
          </td>
        </tr>
        ${drinksRowHtml}
      </table>

      ${drinksChecklistHtml}

      <div class="receipt-divider"></div>
      <div>
        <strong>OBSERVAÇÕES:</strong><br>
        Interfone 201. Tocar e aguardar descer. Salgados bem sequinhos, por favor.
      </div>

      <div class="receipt-totals">
        <div class="row">
          <span>SUBTOTAL:</span>
          <span>R$ 78,00</span>
        </div>
        <div class="row">
          <span>TAXA ENTREGA (2.4 km):</span>
          <span>R$ 8,00</span>
        </div>
        <div class="row total-big">
          <span>TOTAL DO PEDIDO:</span>
          <span>R$ 86,00</span>
        </div>
      </div>

      ${motoboyBoxHtml}
      ${pixBoxHtml}

      <div class="receipt-footer">
        <p>Obrigado pela preferência!</p>
        <p>${cfg.name || "Salgados VIP"} - O Melhor de Nova Iguaçu</p>
      </div>

      <div style="height: 14mm; border-bottom: 1px dashed #000; text-align: center; font-size: 8pt; padding-top: 6mm; color: #666;">
        - - - - - - - - - - - CORTE DA BOBINA - - - - - - - - - - -
      </div>
    </div>
  `;
};

const btnSavePrinter = document.getElementById("btn-save-printer-config");
if (btnSavePrinter) {
  btnSavePrinter.addEventListener("click", () => {
    const updatedPrinterCfg = {
      autoPrintNewOrders: document.getElementById("cfg-printer-autoprint") ? document.getElementById("cfg-printer-autoprint").checked : true,
      silentPrintMode: document.getElementById("cfg-printer-silent") ? document.getElementById("cfg-printer-silent").checked : true,
      soundAlert: document.getElementById("cfg-printer-sound") ? document.getElementById("cfg-printer-sound").checked : true,
      autoCutPaper: document.getElementById("cfg-printer-autocut") ? document.getElementById("cfg-printer-autocut").checked : true,
      printerTarget: document.getElementById("cfg-printer-target") ? document.getElementById("cfg-printer-target").value : "windows_default",
      paperWidth: document.getElementById("cfg-printer-paper") ? document.getElementById("cfg-printer-paper").value : "80mm",
      copies: parseInt(document.getElementById("cfg-printer-copies") ? document.getElementById("cfg-printer-copies").value : "1") || 1,
      targetPrepTimeMinutes: parseInt(document.getElementById("cfg-printer-preptime") ? document.getElementById("cfg-printer-preptime").value : "35") || 35,

      fontFamily: document.getElementById("cfg-printer-font-family") ? document.getElementById("cfg-printer-font-family").value : "monospace",
      fontSize: document.getElementById("cfg-printer-font-size") ? document.getElementById("cfg-printer-font-size").value : "medium",
      fontWeight: document.getElementById("cfg-printer-font-weight") ? document.getElementById("cfg-printer-font-weight").value : "bold",
      lineSpacing: document.getElementById("cfg-printer-line-spacing") ? document.getElementById("cfg-printer-line-spacing").value : "normal",
      printableWidthMm: parseInt(document.getElementById("cfg-printer-width-mm") ? document.getElementById("cfg-printer-width-mm").value : "76") || 76,
      marginSideMm: parseInt(document.getElementById("cfg-printer-margin-mm") ? document.getElementById("cfg-printer-margin-mm").value : "2") || 2,
      textColumns: parseInt(document.getElementById("cfg-printer-columns") ? document.getElementById("cfg-printer-columns").value : "40") || 40,
      printLogo: document.getElementById("cfg-printer-show-logo") ? document.getElementById("cfg-printer-show-logo").checked : true,
      highlightDrinks: document.getElementById("cfg-printer-highlight-drinks") ? document.getElementById("cfg-printer-highlight-drinks").checked : true,
      showMotoboyBox: document.getElementById("cfg-printer-show-motoboy") ? document.getElementById("cfg-printer-show-motoboy").checked : true,
      printPixDetails: document.getElementById("cfg-printer-show-pix") ? document.getElementById("cfg-printer-show-pix").checked : true
    };

    VIPDatabase.savePrinterConfig(updatedPrinterCfg);
    renderLiveOrders();
    if (typeof window.updatePrinterLivePreview === "function") {
      window.updatePrinterLivePreview();
    }
    alert("Configurações de impressão térmica, fontes e margens salvas com sucesso!");
  });
}

window.downloadWindowsSilentPrintLauncher = function() {
  const currentUrl = window.location.href.split("#")[0];
  const batContent = `@echo off
chcp 65001 >nul
title Salgados VIP - Inicializador PDV com Impressao Silenciosa (Zero Dialogos)
cls
echo =====================================================================
echo    SALGADOS VIP - PAINEL ADM COM IMPRESSAO DIRETA SILENCIOSA
echo =====================================================================
echo.
echo [*] 1. Iniciando Agente de Impressao Silenciosa do Windows...
if exist "%~dp0Servico_Impressao_Silenciosa.bat" (
    start /min "" cmd /c "%~dp0Servico_Impressao_Silenciosa.bat"
)

echo [*] 2. Configurando perfil isolado de Kiosk Printing...
set TARGET_URL="${currentUrl}"
set USER_DATA_DIR=%LOCALAPPDATA%\\SalgadosVIP_PDV

if not exist "%USER_DATA_DIR%" mkdir "%USER_DATA_DIR%"

echo [*] 3. Abrindo Painel em modo PDV Kiosk (Zero Telas de Confirmacao)...

:: 1. Tenta Google Chrome com perfil isolado e kiosk-printing
if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (
    echo [+] Iniciando via Google Chrome (Kiosk)...
    start "" "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" --kiosk-printing --user-data-dir="%USER_DATA_DIR%" --no-first-run --no-default-browser-check --disable-features=TranslateUI --disable-extensions --app="%TARGET_URL%"
    goto :FIM
)
if exist "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" (
    echo [+] Iniciando via Google Chrome x86 (Kiosk)...
    start "" "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" --kiosk-printing --user-data-dir="%USER_DATA_DIR%" --no-first-run --no-default-browser-check --disable-features=TranslateUI --disable-extensions --app="%TARGET_URL%"
    goto :FIM
)
if exist "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" (
    echo [+] Iniciando via Google Chrome User (Kiosk)...
    start "" "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" --kiosk-printing --user-data-dir="%USER_DATA_DIR%" --no-first-run --no-default-browser-check --disable-features=TranslateUI --disable-extensions --app="%TARGET_URL%"
    goto :FIM
)

:: 2. Tenta Microsoft Edge com perfil isolado e kiosk-printing
if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (
    echo [+] Iniciando via Microsoft Edge (Kiosk)...
    start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --kiosk-printing --user-data-dir="%USER_DATA_DIR%" --no-first-run --no-default-browser-check --disable-features=TranslateUI --disable-extensions --app="%TARGET_URL%"
    goto :FIM
)
if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" (
    echo [+] Iniciando via Microsoft Edge x64 (Kiosk)...
    start "" "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" --kiosk-printing --user-data-dir="%USER_DATA_DIR%" --no-first-run --no-default-browser-check --disable-features=TranslateUI --disable-extensions --app="%TARGET_URL%"
    goto :FIM
)

:: 3. Fallback
start msedge --kiosk-printing --user-data-dir="%USER_DATA_DIR%" --app="%TARGET_URL%"

:FIM
timeout /t 2 >nul
exit
`;

  const blob = new Blob([batContent], { type: "application/bat" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "Abrir_Painel_Salgados_Impressao_Silenciosa.bat";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  alert("Inicializador Kiosk baixado com sucesso!\n\nEle cria uma sessão exclusiva e isolada com --kiosk-printing e --user-data-dir, enviando o pedido direto para a impressora padrão sem abrir janela de confirmação!");
};

window.downloadPrintAgentLauncher = function() {
  const batContent = `@echo off
chcp 65001 >nul
title Salgados VIP - Servico de Impressao Silenciosa Local (Zero Dialogos)
cls
echo =====================================================================
echo    SALGADOS VIP - SERVICO DE IMPRESSAO SILENCIOSA (WINDOWS)
echo =====================================================================
echo.
echo [*] Iniciando servidor local na porta 18181...
echo [*] Este servico permite imprimir direto no Spooler do Windows
echo [*] SEM abrir nenhuma janela do navegador ou pedir confirmacao.
echo.
echo Mantenha esta janela minimizada durante o expediente.
echo.

powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0Servico_Impressao_Silenciosa.ps1"
if %errorlevel% neq 0 (
    echo.
    echo [!] O servico foi encerrado ou encontrou um erro.
    pause
)
`;

  const blob = new Blob([batContent], { type: "application/bat" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "Servico_Impressao_Silenciosa.bat";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  alert("Agente de Spooler Local baixado com sucesso!\n\nEle conecta o painel diretamente à fila de impressão do Windows (porta 18181). Ao iniciar, ele imprime todos os pedidos no papel sem tocar na tela do navegador!");
};

window.downloadDesktopShortcutCreator = function() {
  const batContent = `@echo off
chcp 65001 >nul
title Salgados VIP - Criar Atalho na Área de Trabalho
cls
echo =====================================================================
echo    SALGADOS VIP - CRIANDO ATALHO NA ÁREA DE TRABALHO
echo =====================================================================
echo.
set SCRIPT="%TEMP%\\create_vip_shortcut.vbs"
if exist %SCRIPT% del %SCRIPT%

echo Set oWS = WScript.CreateObject("WScript.Shell") >> %SCRIPT%
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\\Salgados VIP - Painel PDV.lnk" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = "%~dp0Abrir_Painel_Impressao_Silenciosa.bat" >> %SCRIPT%
echo oLink.WorkingDirectory = "%~dp0" >> %SCRIPT%
echo oLink.Description = "Salgados VIP - Painel com Impressao Silenciosa" >> %SCRIPT%
echo oLink.Save >> %SCRIPT%

cscript /nologo %SCRIPT%
if exist %SCRIPT% del %SCRIPT%

echo [+] Atalho 'Salgados VIP - Painel PDV' criado na sua Área de Trabalho!
echo.
echo Basta clicar duas vezes nele na sua Área de Trabalho para abrir o painel
echo com a impressão silenciosa direta já ativada!
echo.
timeout /t 4 >nul
`;

  const blob = new Blob([batContent], { type: "application/bat" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "Criar_Atalho_Area_de_Trabalho.bat";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  alert("Criador de atalho baixado!\n\nColoque-o na mesma pasta do app e dê 2 cliques para criar o atalho 'Salgados VIP - Painel PDV' na sua Área de Trabalho!");
};

window.checkPrintAgentStatus = async function() {
  const badge = document.getElementById("badge-print-agent-status");
  if (!badge) return false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 900);
    const res = await fetch("http://127.0.0.1:18181/status", { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      badge.className = "badge-silent-active";
      badge.style.background = "#ecfdf5";
      badge.style.color = "#047857";
      badge.style.borderColor = "#a7f3d0";
      badge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Agente Spooler Ativo (${data.defaultPrinter || "Padrão Windows"})`;
      return true;
    }
  } catch (err) {
    // offline
  }

  badge.className = "badge-silent-active";
  badge.style.background = "#eff6ff";
  badge.style.color = "#1d4ed8";
  badge.style.borderColor = "#bfdbfe";
  badge.innerHTML = `<i class="fa-solid fa-bolt"></i> Impressão Direta (Kiosk / Spooler)`;
  return false;
};

document.getElementById("btn-reset-defaults").addEventListener("click", () => {
  if (confirm("ATENÇÃO: Deseja restaurar todos os 26 sabores, kits e molhos para os valores originais de fábrica? Todas as alterações manuais serão resetadas.")) {
    VIPDatabase.resetAll();
    loadAllData();
    alert("Cardápio restaurado com sucesso para os padrões originais!");
  }
});

// ==============================================================================
// 12. MÓDULO DE CONTROLE DE ENTREGA & MAPAS (DUAL ENGINE: GOOGLE MAPS & LEAFLET)
// ==============================================================================
let activeMapEngine = "leaflet"; // "leaflet" | "google"
let deliveryMap = null;
let mapStoreMarker = null;
let mapRingsGroup = null;
let mapClickMarker = null;
let mapClickPolyline = null;
let showMapRings = true;

// Variáveis do Google Maps Platform JS SDK
let googleDeliveryMap = null;
let googleStoreMarker = null;
let googleClickMarker = null;
let googleRoutePolylines = [];
let googleRingsCircles = [];
let googleTrafficLayer = null;
let isGoogleTrafficActive = false;
let isGoogleMapInitialized = false;

function renderDeliveryModule() {
  const deliveryCfg = VIPDatabase.getDeliveryConfig();

  // 1. Preencher Configurações de Origem & Regras
  const addrInput = document.getElementById("cfg-delivery-store-address");
  const radiusInput = document.getElementById("cfg-delivery-max-radius");
  const googleKeyInput = document.getElementById("cfg-delivery-google-api-key");

  if (addrInput) addrInput.value = deliveryCfg.storeOriginAddress || "Rua Isabel Pedrosa, 31, Da Luz, Nova Iguaçu - RJ";
  if (radiusInput) radiusInput.value = deliveryCfg.maxRadiusKm || 15.0;
  if (googleKeyInput) googleKeyInput.value = deliveryCfg.googleMapsApiKey || "";

  // 2. Atualizar status visual do Google Maps
  updateGoogleMapsStatusUI();

  // 3. Renderizar Tabela de Faixas de Distância
  renderDeliveryTiersTable();

  // 4. Inicializar Mapa padrão (Leaflet ou Google Maps)
  setTimeout(() => {
    if (activeMapEngine === "google") {
      initGoogleDeliveryMap();
    } else {
      initDeliveryMap();
    }
  }, 200);
}

// ==============================================================================
// MAPA INTERATIVO LEAFLET (OPENSTREETMAP / OSRM)
// ==============================================================================
function initDeliveryMap() {
  const mapContainer = document.getElementById("admin-delivery-map");
  if (!mapContainer) return;

  if (typeof L === "undefined") {
    mapContainer.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#64748b; padding:2rem; text-align:center;">
        <i class="fa-solid fa-map-location-dot" style="font-size:3rem; margin-bottom:1rem; color:#cbd5e1;"></i>
        <h4 style="margin:0 0 6px;">Visualização em Mapa Dinâmico</h4>
        <p style="margin:0; font-size:0.85rem; max-width:480px;">Conecte-se à internet para carregar o mapa interativo com anéis de raio de 1 a 15 km.</p>
      </div>
    `;
    return;
  }

  const deliveryCfg = VIPDatabase.getDeliveryConfig();
  const storeCoords = deliveryCfg.storeCoords || { lat: -22.75735, lng: -43.47254 };
  const storeLatLng = [storeCoords.lat, storeCoords.lng];

  if (deliveryMap) {
    deliveryMap.invalidateSize();
    refreshMapLayers();
    return;
  }

  deliveryMap = L.map("admin-delivery-map", {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView(storeLatLng, 12);

  window.deliveryMap = deliveryMap;

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors"
  }).addTo(deliveryMap);

  // Marcador pulsante da Loja
  const storeIcon = L.divIcon({
    className: "store-map-icon-wrap",
    html: `<div class="store-pulse-marker" title="Loja Salgados VIP"><i class="fa-solid fa-crown"></i></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });

  mapStoreMarker = L.marker(storeLatLng, { icon: storeIcon }).addTo(deliveryMap);
  mapStoreMarker.bindPopup(`
    <div style="text-align:center; padding:4px;">
      <strong style="color:#d97706; font-size:1rem;">🥟 Salgados VIP (Loja)</strong><br>
      <span style="font-size:0.8rem; color:#475569;">${deliveryCfg.storeOriginAddress || "Rua Isabel Pedrosa, 31, Da Luz, Nova Iguaçu"}</span><br>
      <small style="font-weight:700; color:#15803d; margin-top:4px; display:inline-block;">Ponto de Partida das Entregas (Raio de 1 a 15 km)</small>
    </div>
  `);

  mapRingsGroup = L.layerGroup().addTo(deliveryMap);
  refreshMapLayers();

  // Clique no mapa para medição e simulação em tempo real
  deliveryMap.on("click", (e) => {
    onMapClicked(e.latlng);
  });
}

function refreshMapLayers() {
  if (!deliveryMap || !mapRingsGroup) return;

  const deliveryCfg = VIPDatabase.getDeliveryConfig();
  const storeCoords = deliveryCfg.storeCoords || { lat: -22.75735, lng: -43.47254 };
  const storeLatLng = [storeCoords.lat, storeCoords.lng];

  mapRingsGroup.clearLayers();
  if (showMapRings) {
    const ringColors = ["#16a34a", "#2563eb", "#0891b2", "#f59e0b", "#ea580c", "#9333ea", "#dc2626"];
    const tiers = [...(deliveryCfg.tiers || [])].sort((a, b) => a.maxKm - b.maxKm);

    tiers.forEach((tier, idx) => {
      const color = ringColors[idx % ringColors.length];
      const circle = L.circle(storeLatLng, {
        radius: tier.maxKm * 1000,
        color: color,
        fillColor: color,
        fillOpacity: 0.05,
        weight: 2,
        dashArray: idx === tiers.length - 1 ? "4, 4" : null
      });

      circle.bindTooltip(`Raio até ${tier.maxKm.toFixed(1)} km • Taxa: ${formatBRL(tier.price)}`, {
        permanent: false,
        direction: "top"
      });

      circle.on("click", (ev) => {
        L.DomEvent.stopPropagation(ev);
        onMapClicked(ev.latlng);
      });

      mapRingsGroup.addLayer(circle);
    });
  }
}

function onMapClicked(latlng) {
  if (!deliveryMap) return;

  const deliveryCfg = VIPDatabase.getDeliveryConfig();
  const storeCoords = deliveryCfg.storeCoords || { lat: -22.75735, lng: -43.47254 };
  const storeLatLng = L.latLng(storeCoords.lat, storeCoords.lng);

  const distMeters = deliveryMap.distance(storeLatLng, latlng);
  const distKm = distMeters / 1000;

  const feeInfo = VIPDatabase.calculateDeliveryFee(distKm);

  // Linha de rota até a loja
  if (mapClickPolyline) deliveryMap.removeLayer(mapClickPolyline);
  mapClickPolyline = L.polyline([storeLatLng, latlng], {
    color: "#2563eb",
    dashArray: "6, 8",
    weight: 3,
    opacity: 0.85
  }).addTo(deliveryMap);

  if (mapClickMarker) deliveryMap.removeLayer(mapClickMarker);
  mapClickMarker = L.marker(latlng).addTo(deliveryMap);

  const popupHtml = `
    <div style="font-size:0.85rem; padding:4px;">
      <strong style="color:#0f172a;">🎯 Ponto Selecionado</strong><br>
      Distância da loja: <strong>${distKm.toFixed(2)} km</strong><br>
      ${feeInfo.allowed
        ? `Faixa aplicada: <strong>${feeInfo.tier?.label || (distKm.toFixed(1) + ' km')}</strong><br>
           Taxa de Entrega: <strong style="color:#15803d; font-size:1.1rem;">${feeInfo.formattedFee}</strong><br>
           Previsão: <strong>${feeInfo.eta || "25-35 min"}</strong>`
        : `<span style="color:#dc2626; font-weight:700;">⚠️ Fora do raio atendido (${distKm.toFixed(1)} km > 15 km)</span>`
      }
    </div>
  `;
  mapClickMarker.bindPopup(popupHtml).openPopup();
  updateMapClickResultBar(distKm, feeInfo);
}

// ==============================================================================
// MAPA INTERATIVO GOOGLE MAPS PLATFORM (ROUTES API v2 & ADVANCED MARKERS)
// Source: Google Maps Platform Code Assist
// ==============================================================================
async function initGoogleDeliveryMap() {
  const gContainer = document.getElementById("admin-google-delivery-map");
  if (!gContainer) return;

  const deliveryCfg = VIPDatabase.getDeliveryConfig();
  const storeCoords = deliveryCfg.storeCoords || { lat: -22.75735, lng: -43.47254 };

  if (isGoogleMapInitialized && googleDeliveryMap) {
    refreshGoogleMapRings();
    return;
  }

  gContainer.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#2563eb; padding:2rem; text-align:center;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size:2.5rem; margin-bottom:1rem;"></i>
      <h4 style="margin:0 0 6px;">Carregando Google Maps Platform...</h4>
      <p style="margin:0; font-size:0.85rem; color:#64748b;">Inicializando Routes API v2 e Advanced Markers...</p>
    </div>
  `;

  try {
    await VIPDatabase.loadGoogleMapsScript(deliveryCfg.googleMapsApiKey);
    const [{ Map }, { AdvancedMarkerElement, PinElement }] = await Promise.all([
      google.maps.importLibrary("maps"),
      google.maps.importLibrary("marker"),
      google.maps.importLibrary("routes"),
      google.maps.importLibrary("core")
    ]);

    gContainer.innerHTML = "";

    googleDeliveryMap = new Map(gContainer, {
      center: storeCoords,
      zoom: 12,
      mapId: "DEMO_MAP_ID",
      mapTypeControl: true,
      mapTypeControlOptions: {
        position: google.maps.ControlPosition.TOP_RIGHT
      },
      streetViewControl: false,
      fullscreenControl: true,
      internalUsageAttributionIds: ["gmp_git_agentskills_v1"]
    });

    // Marcador da Loja com AdvancedMarkerElement e PinElement
    const storePin = new PinElement({
      glyphText: "👑",
      glyphColor: "#ffffff",
      background: "#d97706",
      borderColor: "#92400e"
    });

    googleStoreMarker = new AdvancedMarkerElement({
      map: googleDeliveryMap,
      position: storeCoords,
      title: "🥟 Salgados VIP (Loja Da Luz)",
      content: storePin.element || storePin
    });

    // Infowindow da Loja
    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="text-align:center; padding:4px; font-family:sans-serif;">
          <strong style="color:#d97706; font-size:0.95rem;">🥟 Salgados VIP (Loja)</strong><br>
          <span style="font-size:0.8rem; color:#475569;">${deliveryCfg.storeOriginAddress || "Rua Isabel Pedrosa, 31, Da Luz, Nova Iguaçu"}</span><br>
          <small style="font-weight:700; color:#15803d; margin-top:4px; display:inline-block;">Ponto de Partida das Entregas (Raio de 1 a 15 km)</small>
        </div>
      `
    });
    googleStoreMarker.addListener("click", () => {
      infoWindow.open({ anchor: googleStoreMarker, map: googleDeliveryMap });
    });

    // Anéis de raio
    refreshGoogleMapRings();

    // Clique no Google Map para calcular rota via Routes API v2
    googleDeliveryMap.addListener("click", async (e) => {
      if (!e.latLng) return;
      const clickedCoords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      await onGoogleMapClicked(clickedCoords);
    });

    isGoogleMapInitialized = true;
    updateGoogleMapsStatusUI();
  } catch (err) {
    console.error("Falha ao inicializar Google Maps:", err);
    gContainer.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#ef4444; padding:2rem; text-align:center;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:3rem; margin-bottom:1rem;"></i>
        <h4 style="margin:0 0 6px;">Não foi possível carregar o Google Maps</h4>
        <p style="margin:0 0 12px; font-size:0.85rem; max-width:480px; color:#64748b;">
          ${err.message || "Verifique se a chave de API é válida e possui a Maps JavaScript API e Routes API ativadas."}
        </p>
        <button type="button" class="btn-secondary-admin" onclick="toggleDeliveryMapEngine('leaflet')">
          <i class="fa-solid fa-map"></i> Voltar para OpenStreetMap
        </button>
      </div>
    `;
  }
}

function refreshGoogleMapRings() {
  if (!googleDeliveryMap) return;

  googleRingsCircles.forEach(c => c.setMap(null));
  googleRingsCircles = [];

  if (!showMapRings) return;

  const deliveryCfg = VIPDatabase.getDeliveryConfig();
  const storeCoords = deliveryCfg.storeCoords || { lat: -22.75735, lng: -43.47254 };
  const ringColors = ["#16a34a", "#2563eb", "#0891b2", "#f59e0b", "#ea580c", "#9333ea", "#dc2626"];
  const tiers = [...(deliveryCfg.tiers || [])].sort((a, b) => a.maxKm - b.maxKm);

  tiers.forEach((tier, idx) => {
    const color = ringColors[idx % ringColors.length];
    const circle = new google.maps.Circle({
      strokeColor: color,
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: color,
      fillOpacity: 0.05,
      map: googleDeliveryMap,
      center: storeCoords,
      radius: tier.maxKm * 1000
    });
    circle.addListener("click", async (ev) => {
      if (ev.latLng) {
        await onGoogleMapClicked({ lat: ev.latLng.lat(), lng: ev.latLng.lng() });
      }
    });
    googleRingsCircles.push(circle);
  });
}

async function onGoogleMapClicked(clickedLatLng) {
  if (!googleDeliveryMap) return;

  const deliveryCfg = VIPDatabase.getDeliveryConfig();
  const storeCoords = deliveryCfg.storeCoords || { lat: -22.75735, lng: -43.47254 };

  // Limpa polylines e marcadores anteriores de clique
  googleRoutePolylines.forEach(p => p.setMap(null));
  googleRoutePolylines = [];
  if (googleClickMarker) {
    googleClickMarker.map = null;
    googleClickMarker = null;
  }

  let distKm = 0;
  let etaText = "20-30 min";

  try {
    const { Route } = await google.maps.importLibrary("routes");
    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");

    const request = {
      origin: storeCoords,
      destination: clickedLatLng,
      travelMode: "DRIVING",
      fields: ["path", "legs", "distanceMeters", "durationMillis"],
      internalUsageAttributionIds: ["gmp_git_agentskills_v1"]
    };

    const response = await Route.computeRoutes(request);
    if (response && response.routes && response.routes.length > 0) {
      const r = response.routes[0];
      const leg = r.legs?.[0];
      const meters = leg?.distanceMeters ?? leg?.distance?.value ?? 0;
      distKm = Math.round((meters / 1000) * 10) / 10;
      const durMillis = leg?.durationMillis ?? (leg?.duration?.value ? leg.duration.value * 1000 : null);
      if (durMillis) {
        etaText = `${Math.max(1, Math.round(durMillis / 60000))} min`;
      }

      // Desenha a polyline oficial da rota
      googleRoutePolylines = r.createPolylines({
        polylineOptions: {
          map: googleDeliveryMap,
          strokeColor: "#2563eb",
          strokeWeight: 5,
          strokeOpacity: 0.85
        }
      });
      googleRoutePolylines.forEach(p => p.setMap(googleDeliveryMap));

      // Marcador no destino com AdvancedMarkerElement
      const destPin = new PinElement({
        glyphText: "📍",
        glyphColor: "#ffffff",
        background: "#2563eb",
        borderColor: "#1d4ed8"
      });
      googleClickMarker = new AdvancedMarkerElement({
        map: googleDeliveryMap,
        position: clickedLatLng,
        title: "Destino da Entrega",
        content: destPin.element || destPin
      });
    }
  } catch (err) {
    console.warn("Cálculo de rota Google Maps falhou ao clicar, usando linha direta:", err);
    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
    const straightKm = VIPDatabase._haversineDistance(storeCoords.lat, storeCoords.lng, clickedLatLng.lat, clickedLatLng.lng);
    distKm = Math.round((straightKm * 1.28) * 10) / 10;

    const line = new google.maps.Polyline({
      path: [storeCoords, clickedLatLng],
      geodesic: true,
      strokeColor: "#2563eb",
      strokeOpacity: 0.8,
      strokeWeight: 3,
      map: googleDeliveryMap
    });
    googleRoutePolylines.push(line);

    const destPin = new PinElement({ glyphText: "🎯", background: "#2563eb" });
    googleClickMarker = new AdvancedMarkerElement({
      map: googleDeliveryMap,
      position: clickedLatLng,
      content: destPin.element || destPin
    });
  }

  const feeInfo = VIPDatabase.calculateDeliveryFee(distKm);
  updateMapClickResultBar(distKm, feeInfo, etaText);
}

function updateMapClickResultBar(distKm, feeInfo, customEta) {
  const bar = document.getElementById("map-click-result-box");
  const titleEl = document.getElementById("map-click-title");
  const detailsEl = document.getElementById("map-click-details");
  const amountEl = document.getElementById("map-click-fee-amount");

  if (!bar || !titleEl || !detailsEl || !amountEl) return;

  bar.style.display = "flex";
  if (feeInfo.allowed) {
    titleEl.innerHTML = `Ponto Selecionado a <strong>${distKm.toFixed(1)} km</strong> da loja`;
    detailsEl.textContent = `Faixa: ${feeInfo.tier?.label || (distKm.toFixed(1) + ' km')} • Previsão: ${customEta || feeInfo.eta || '25-35 min'}`;
    amountEl.textContent = feeInfo.formattedFee;
    amountEl.style.color = "#15803d";
  } else {
    titleEl.innerHTML = `⚠️ Ponto Selecionado a <strong>${distKm.toFixed(1)} km</strong>`;
    detailsEl.textContent = feeInfo.reason || "Distância superior ao raio máximo atendido de 15 km.";
    amountEl.textContent = "Fora da área";
    amountEl.style.color = "#dc2626";
  }
}

// ==============================================================================
// CONTROLES DE BARRA DE FERRAMENTAS DO MAPA
// ==============================================================================
window.toggleDeliveryMapEngine = function(forcedEngine) {
  const nextEngine = forcedEngine || (activeMapEngine === "leaflet" ? "google" : "leaflet");
  activeMapEngine = nextEngine;

  const osmContainer = document.getElementById("admin-delivery-map");
  const googleContainer = document.getElementById("admin-google-delivery-map");
  const labelEl = document.getElementById("engine-btn-label");
  const btn = document.getElementById("btn-toggle-engine");

  if (activeMapEngine === "google") {
    if (osmContainer) osmContainer.style.display = "none";
    if (googleContainer) googleContainer.style.display = "block";
    if (labelEl) labelEl.textContent = "OpenStreetMap";
    if (btn) btn.classList.add("active");

    initGoogleDeliveryMap();
  } else {
    if (googleContainer) googleContainer.style.display = "none";
    if (osmContainer) osmContainer.style.display = "block";
    if (labelEl) labelEl.textContent = "Google Maps";
    if (btn) btn.classList.remove("active");

    if (deliveryMap) {
      deliveryMap.invalidateSize();
      refreshMapLayers();
    } else {
      initDeliveryMap();
    }
  }
};

window.recenterDeliveryMap = function() {
  const deliveryCfg = VIPDatabase.getDeliveryConfig();
  const storeCoords = deliveryCfg.storeCoords || { lat: -22.75735, lng: -43.47254 };

  if (activeMapEngine === "google" && googleDeliveryMap) {
    googleDeliveryMap.setCenter(storeCoords);
    googleDeliveryMap.setZoom(12);
  } else if (deliveryMap) {
    deliveryMap.setView([storeCoords.lat, storeCoords.lng], 12);
    if (mapStoreMarker) mapStoreMarker.openPopup();
  }
};

window.toggleMapRings = function() {
  showMapRings = !showMapRings;
  const btn = document.getElementById("btn-toggle-rings");
  if (btn) btn.classList.toggle("active", showMapRings);

  if (activeMapEngine === "google") {
    refreshGoogleMapRings();
  } else {
    refreshMapLayers();
  }
};

window.toggleMapTraffic = function() {
  if (activeMapEngine !== "google" || !googleDeliveryMap) {
    const shouldSwitch = confirm("A camada de trânsito em tempo real é um recurso exclusivo do Google Maps Platform. Deseja alternar para o Google Maps agora?");
    if (shouldSwitch) {
      toggleDeliveryMapEngine("google");
      setTimeout(() => toggleMapTraffic(), 600);
    }
    return;
  }

  if (!googleTrafficLayer) {
    googleTrafficLayer = new google.maps.TrafficLayer();
  }

  isGoogleTrafficActive = !isGoogleTrafficActive;
  googleTrafficLayer.setMap(isGoogleTrafficActive ? googleDeliveryMap : null);

  const btn = document.getElementById("btn-toggle-traffic");
  if (btn) btn.classList.toggle("active", isGoogleTrafficActive);
};

// ==============================================================================
// TABELA E GERENCIAMENTO DE FAIXAS POR DISTÂNCIA / RAIO (KM)
// ==============================================================================
function renderDeliveryTiersTable() {
  const tbody = document.getElementById("delivery-tiers-table-body");
  if (!tbody) return;

  const deliveryCfg = VIPDatabase.getDeliveryConfig();
  const tiers = [...(deliveryCfg.tiers || [])].sort((a, b) => a.maxKm - b.maxKm);

  tbody.innerHTML = "";

  if (tiers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 2rem;">Nenhuma faixa de entrega cadastrada. Clique em "+ Nova Faixa de Distância".</td></tr>`;
    return;
  }

  let previousKm = 0;
  tiers.forEach((tier) => {
    const tr = document.createElement("tr");
    const rangeLabel = previousKm === 0 ? `0.0 a ${tier.maxKm.toFixed(1)} km` : `${(previousKm + 0.1).toFixed(1)} a ${tier.maxKm.toFixed(1)} km`;
    previousKm = tier.maxKm;

    tr.innerHTML = `
      <td><strong>${rangeLabel}</strong></td>
      <td><span class="badge-status-order status-novo" style="font-size:0.78rem;">Até ${tier.maxKm.toFixed(1)} km</span></td>
      <td><strong style="color: #15803d; font-size: 1.05rem;">${formatBRL(tier.price)}</strong></td>
      <td><span>${tier.eta || "15-30 min"}</span></td>
      <td><span style="color: #475569; font-size: 0.85rem;">${tier.label || "-"}</span></td>
      <td class="text-right">
        <button class="btn-action edit" onclick="openEditDeliveryTierModal('${tier.id}')" title="Editar Faixa">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button class="btn-action delete" onclick="deleteDeliveryTier('${tier.id}')" title="Excluir Faixa">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.openAddDeliveryTierModal = function() {
  document.getElementById("modal-delivery-tier-title").textContent = "Adicionar Faixa de Distância";
  document.getElementById("delivery-tier-edit-id").value = "";
  document.getElementById("tier-input-maxkm").value = "";
  document.getElementById("tier-input-price").value = "";
  document.getElementById("tier-input-label").value = "";
  document.getElementById("tier-input-eta").value = "20-30 min";

  document.getElementById("modal-delivery-tier-backdrop").classList.add("active");
  document.getElementById("modal-delivery-tier").classList.add("active");
};

window.openEditDeliveryTierModal = function(tierId) {
  const deliveryCfg = VIPDatabase.getDeliveryConfig();
  const tier = (deliveryCfg.tiers || []).find(t => t.id === tierId);
  if (!tier) return;

  document.getElementById("modal-delivery-tier-title").textContent = "Editar Faixa de Distância";
  document.getElementById("delivery-tier-edit-id").value = tier.id;
  document.getElementById("tier-input-maxkm").value = tier.maxKm;
  document.getElementById("tier-input-price").value = tier.price;
  document.getElementById("tier-input-label").value = tier.label || "";
  document.getElementById("tier-input-eta").value = tier.eta || "20-30 min";

  document.getElementById("modal-delivery-tier-backdrop").classList.add("active");
  document.getElementById("modal-delivery-tier").classList.add("active");
};

window.closeDeliveryTierModal = function() {
  document.getElementById("modal-delivery-tier-backdrop").classList.remove("active");
  document.getElementById("modal-delivery-tier").classList.remove("active");
};

window.saveDeliveryTier = function() {
  const editId = document.getElementById("delivery-tier-edit-id").value;
  const maxKm = parseFloat(document.getElementById("tier-input-maxkm").value);
  const price = parseFloat(document.getElementById("tier-input-price").value);
  const label = document.getElementById("tier-input-label").value.trim();
  const eta = document.getElementById("tier-input-eta").value.trim() || "20-30 min";

  if (isNaN(maxKm) || maxKm <= 0 || maxKm > 15) {
    alert("Por favor, informe uma distância limite válida entre 0.5 km e 15.0 km.");
    document.getElementById("tier-input-maxkm").focus();
    return;
  }

  if (isNaN(price) || price < 0) {
    alert("Por favor, informe um valor de taxa válido (R$).");
    document.getElementById("tier-input-price").focus();
    return;
  }

  if (!label) {
    alert("Por favor, informe um rótulo ou exemplos de bairros atendidos nesta faixa.");
    document.getElementById("tier-input-label").focus();
    return;
  }

  const deliveryCfg = VIPDatabase.getDeliveryConfig();
  if (!deliveryCfg.tiers) deliveryCfg.tiers = [];

  if (editId) {
    const idx = deliveryCfg.tiers.findIndex(t => t.id === editId);
    if (idx !== -1) {
      deliveryCfg.tiers[idx] = {
        ...deliveryCfg.tiers[idx],
        maxKm: maxKm,
        price: price,
        label: label,
        eta: eta
      };
    }
  } else {
    deliveryCfg.tiers.push({
      id: "tier-" + Date.now(),
      maxKm: maxKm,
      price: price,
      label: label,
      eta: eta
    });
  }

  VIPDatabase.saveDeliveryConfig(deliveryCfg);
  closeDeliveryTierModal();
  renderDeliveryTiersTable();
  refreshMapLayers();
};

window.deleteDeliveryTier = function(tierId) {
  if (!confirm("Tem certeza que deseja excluir esta faixa de taxa de entrega?")) return;

  const deliveryCfg = VIPDatabase.getDeliveryConfig();
  deliveryCfg.tiers = (deliveryCfg.tiers || []).filter(t => t.id !== tierId);

  VIPDatabase.saveDeliveryConfig(deliveryCfg);
  renderDeliveryTiersTable();
  refreshMapLayers();
};

window.resetDeliveryTiersToDefault = function() {
  if (!confirm("Deseja restaurar as faixas de raio e distâncias recomendadas (1 a 15 km) para os valores padrão de fábrica?")) return;

  const deliveryCfg = VIPDatabase.getDeliveryConfig();
  deliveryCfg.tiers = JSON.parse(JSON.stringify(DEFAULT_DELIVERY_TIERS));
  deliveryCfg.maxRadiusKm = 15.0;

  VIPDatabase.saveDeliveryConfig(deliveryCfg);
  renderDeliveryModule();
  alert("Faixas de entrega por distância restauradas com sucesso!");
};

window.saveDeliveryOriginSettings = function() {
  const address = document.getElementById("cfg-delivery-store-address").value.trim();
  const maxRadius = parseFloat(document.getElementById("cfg-delivery-max-radius").value);

  if (!address) {
    alert("Informe o endereço de partida da loja.");
    return;
  }

  if (isNaN(maxRadius) || maxRadius <= 0 || maxRadius > 15) {
    alert("O raio máximo deve ser de 1 até 15 km.");
    return;
  }

  const deliveryCfg = VIPDatabase.getDeliveryConfig();
  deliveryCfg.storeOriginAddress = address;
  deliveryCfg.maxRadiusKm = maxRadius;

  VIPDatabase.saveDeliveryConfig(deliveryCfg);
  alert("Configurações de origem e raio máximo salvas com sucesso!");
  refreshMapLayers();
};

// ==============================================================================
// GESTÃO DA CHAVE E INTEGRAÇÃO GOOGLE MAPS PLATFORM
// ==============================================================================
function updateGoogleMapsStatusUI() {
  const deliveryCfg = VIPDatabase.getDeliveryConfig();
  const badge = document.getElementById("google-maps-status-badge");
  if (!badge) return;

  if (deliveryCfg.googleMapsApiKey && deliveryCfg.googleMapsApiKey.trim().length > 10) {
    badge.style.background = "#dbeafe";
    badge.style.color = "#1d4ed8";
    badge.innerHTML = `<i class="fa-brands fa-google"></i> Google Maps Configurado (Routes API v2)`;
  } else {
    badge.style.background = "#f1f5f9";
    badge.style.color = "#475569";
    badge.innerHTML = `<i class="fa-solid fa-leaf"></i> Motor Web Gratuito (OSRM / OpenStreetMap)`;
  }
}

window.saveGoogleMapsApiKey = function() {
  const apiKey = (document.getElementById("cfg-delivery-google-api-key")?.value || "").trim();
  const deliveryCfg = VIPDatabase.getDeliveryConfig();
  deliveryCfg.googleMapsApiKey = apiKey;
  VIPDatabase.saveDeliveryConfig(deliveryCfg);
  updateGoogleMapsStatusUI();

  if (apiKey) {
    alert("Chave de API do Google Maps salva com sucesso! Os cálculos agora consultarão a moderna Routes API v2 via Google Maps JS SDK.");
    VIPDatabase._gmapsLoadingPromise = null;
    isGoogleMapInitialized = false;
  } else {
    alert("Chave limpa. O sistema utilizará o motor de rotas automático web gratuito (OpenStreetMap/OSRM).");
    toggleDeliveryMapEngine("leaflet");
  }
};

window.testGoogleMapsConnection = async function() {
  const apiKey = (document.getElementById("cfg-delivery-google-api-key")?.value || "").trim();
  const fb = document.getElementById("google-maps-test-feedback");
  const btn = document.getElementById("btn-test-gmaps-conn");

  if (!apiKey || apiKey.length < 10) {
    alert("Por favor, digite uma chave de API válida para testar.");
    document.getElementById("cfg-delivery-google-api-key")?.focus();
    return;
  }

  if (btn) btn.disabled = true;
  if (fb) {
    fb.style.display = "block";
    fb.style.background = "#eff6ff";
    fb.style.color = "#1e40af";
    fb.style.border = "1px solid #bfdbfe";
    fb.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Testando conectividade com o SDK do Google Maps Platform (Routes API & Maps JS)...`;
  }

  try {
    VIPDatabase._gmapsLoadingPromise = null;
    await VIPDatabase.loadGoogleMapsScript(apiKey);
    const { Route } = await google.maps.importLibrary("routes");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    if (fb) {
      fb.style.background = "#f0fdf4";
      fb.style.color = "#15803d";
      fb.style.border = "1px solid #86efac";
      fb.innerHTML = `
        <strong>✓ Conexão bem-sucedida!</strong><br>
        O SDK do Google Maps foi carregado corretamente com suporte à <strong>Routes API v2</strong> e <strong>AdvancedMarkerElement</strong>.
      `;
    }
    updateGoogleMapsStatusUI();
  } catch (err) {
    if (fb) {
      fb.style.background = "#fef2f2";
      fb.style.color = "#dc2626";
      fb.style.border = "1px solid #fecaca";
      fb.innerHTML = `
        <strong>✕ Erro ao conectar ao Google Maps:</strong> ${err.message || "Chave rejeitada."}<br>
        <small style="color: #64748b;">Certifique-se de que a <strong>Maps JavaScript API</strong> e a <strong>Routes API</strong> estão ativadas no Google Cloud Console.</small>
      `;
    }
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.adminTestRouteDistance = async function() {
  const inputEl = document.getElementById("admin-test-cep-input");
  const resultBox = document.getElementById("admin-test-route-result");
  const btn = document.getElementById("btn-admin-test-route");
  const val = (inputEl?.value || "").trim();

  if (!val) {
    alert("Digite um CEP ou endereço para testar (ex: 26010-391 ou Rua Dona Clara de Araújo, Engenho Pequeno).");
    if (inputEl) inputEl.focus();
    return;
  }

  if (btn) btn.disabled = true;
  if (resultBox) {
    resultBox.style.display = "block";
    resultBox.style.background = "#eff6ff";
    resultBox.style.color = "#1e40af";
    resultBox.style.border = "1px solid #bfdbfe";
    resultBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Traçando rota de condução a partir da loja...`;
  }

  try {
    const cepWithNumberMatch = val.match(/^(\d{5}-?\d{3})[,\s]+(?:n[ºo°\.]?\s*)?(\d+[a-zA-Z]?)/i);
    const isCepOnly = /^\d{5}-?\d{3}$/.test(val) || /^\d{8}$/.test(val);
    let params = {};

    if (cepWithNumberMatch) {
      params.cep = cepWithNumberMatch[1];
      params.number = cepWithNumberMatch[2];
      try {
        const vResp = await fetch(`https://viacep.com.br/ws/${params.cep.replace(/\D/g, "")}/json/`);
        if (vResp.ok) {
          const vData = await vResp.json();
          if (!vData.erro) {
            params.street = vData.logradouro || "";
            params.neighborhood = vData.bairro || "";
            params.city = vData.localidade || "Nova Iguaçu";
          }
        }
      } catch (e) {}
    } else if (isCepOnly) {
      params.cep = val;
      try {
        const vResp = await fetch(`https://viacep.com.br/ws/${val.replace(/\D/g, "")}/json/`);
        if (vResp.ok) {
          const vData = await vResp.json();
          if (!vData.erro) {
            params.street = vData.logradouro || "";
            params.neighborhood = vData.bairro || "";
            params.city = vData.localidade || "Nova Iguaçu";
          }
        }
      } catch (e) {}
    } else {
      const streetNumMatch = val.match(/^(.+?)[,\s]+(?:n[ºo°\.]?\s*)?(\d+[a-zA-Z]?)(?:[,\s]+(.*))?$/i);
      if (streetNumMatch) {
        params.street = streetNumMatch[1].trim();
        params.number = streetNumMatch[2].trim();
        params.neighborhood = (streetNumMatch[3] || "").trim();
        params.city = "Nova Iguaçu";
      } else {
        params.street = val;
        params.city = "Nova Iguaçu";
      }
    }

    const calc = await VIPDatabase.calculateRealRouteDistance(params);

    if (resultBox) {
      if (calc.allowed) {
        resultBox.style.background = "#f0fdf4";
        resultBox.style.color = "#15803d";
        resultBox.style.border = "1px solid #86efac";
        const sourceLabel = (calc.sourceUsed === "google_maps" || calc.sourceUsed === "google_maps_routes")
          ? "Google Maps Platform (Routes API v2)"
          : (calc.sourceUsed === "osrm_route" ? "Motor de Rotas Web (OSRM)" : "Catálogo Mapeado Nova Iguaçu");

        resultBox.innerHTML = `
          <strong>✓ Rota calculada com sucesso!</strong><br>
          Destino: <strong>${params.street ? params.street + ', ' : ''}${params.neighborhood ? params.neighborhood + ' - ' : ''}${params.city || ''}${params.cep ? ' (CEP: ' + params.cep + ')' : ''}</strong><br>
          Distância de Rota: <strong style="font-size: 1.15rem; color: #0f172a;">${calc.distanceKm.toFixed(1)} km</strong> • Tempo de Viagem: <strong>${calc.duration || '20-30 min'}</strong><br>
          Faixa de Entrega: <strong>${calc.tier?.label || (calc.distanceKm.toFixed(1) + ' km')}</strong><br>
          Taxa a Cobrar do Cliente: <strong style="font-size: 1.25rem; color: #15803d;">${calc.formattedFee}</strong><br>
          <span style="font-size: 0.78rem; color: #64748b;">Motor Utilizado: ${sourceLabel}</span>
        `;

        // Renderiza no mapa ativo a rota visual
        const deliveryCfg = VIPDatabase.getDeliveryConfig();
        const storeCoords = deliveryCfg.storeCoords || { lat: -22.75735, lng: -43.47254 };

        if (activeMapEngine === "google" && googleDeliveryMap && calc.routePath && calc.routePath.length > 0) {
          googleRoutePolylines.forEach(p => p.setMap(null));
          googleRoutePolylines = [];
          if (googleClickMarker) googleClickMarker.map = null;

          const polyline = new google.maps.Polyline({
            path: calc.routePath,
            geodesic: true,
            strokeColor: "#2563eb",
            strokeOpacity: 0.85,
            strokeWeight: 5,
            map: googleDeliveryMap
          });
          googleRoutePolylines.push(polyline);

          const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
          const { LatLngBounds } = await google.maps.importLibrary("core");
          const destPin = new PinElement({ glyphText: "📍", background: "#2563eb", glyphColor: "#ffffff" });
          const lastPoint = calc.routePath[calc.routePath.length - 1];

          googleClickMarker = new AdvancedMarkerElement({
            map: googleDeliveryMap,
            position: lastPoint,
            title: "Destino Simulado",
            content: destPin.element || destPin
          });

          const bounds = new LatLngBounds();
          bounds.extend(storeCoords);
          calc.routePath.forEach(pt => bounds.extend(pt));
          googleDeliveryMap.fitBounds(bounds, 50);

        } else if (activeMapEngine === "leaflet" && deliveryMap) {
          if (mapClickPolyline) deliveryMap.removeLayer(mapClickPolyline);
          if (mapClickMarker) deliveryMap.removeLayer(mapClickMarker);

          if (calc.routePath && calc.routePath.length > 0) {
            const leafletPoints = calc.routePath.map(p => [p.lat, p.lng]);
            mapClickPolyline = L.polyline(leafletPoints, {
              color: "#2563eb",
              weight: 4,
              opacity: 0.85
            }).addTo(deliveryMap);
            mapClickMarker = L.marker(leafletPoints[leafletPoints.length - 1]).addTo(deliveryMap);
            deliveryMap.fitBounds(mapClickPolyline.getBounds(), { padding: [50, 50] });
          } else if (calc.destinationCoords) {
            mapClickPolyline = L.polyline([[storeCoords.lat, storeCoords.lng], [calc.destinationCoords.lat, calc.destinationCoords.lng]], {
              color: "#2563eb",
              dashArray: "6, 8",
              weight: 3,
              opacity: 0.85
            }).addTo(deliveryMap);
            mapClickMarker = L.marker([calc.destinationCoords.lat, calc.destinationCoords.lng]).addTo(deliveryMap);
            deliveryMap.fitBounds(mapClickPolyline.getBounds(), { padding: [50, 50] });
          }
        }

        // Atualiza a barra de feedback sob o mapa
        updateMapClickResultBar(calc.distanceKm, calc, calc.duration);

      } else {
        resultBox.style.background = "#fef2f2";
        resultBox.style.color = "#dc2626";
        resultBox.style.border = "1px solid #fecaca";
        resultBox.innerHTML = `
          <strong>⚠️ Fora do Limite de Atendimento</strong><br>
          Distância calculada: <strong>${calc.distanceKm.toFixed(1)} km</strong><br>
          Motivo: ${calc.reason || "Distância superior ao raio máximo de 15 km atendido pela loja."}
        `;
      }
    }
  } catch (err) {
    if (resultBox) {
      resultBox.style.background = "#fef2f2";
      resultBox.style.color = "#dc2626";
      resultBox.style.border = "1px solid #fecaca";
      resultBox.innerHTML = `<strong>✕ Erro ao calcular rota:</strong> ${err.message || "Tente novamente."}`;
    }
  } finally {
    if (btn) btn.disabled = false;
  }
};

// ==============================================================================
// MÓDULO DE FECHAMENTO DE CAIXA & AUDITORIA FINANCEIRA DIÁRIA
// ==============================================================================
let currentCaixaDateStr = "";
let currentCaixaPaymentFilter = "todos";
let currentCaixaCalculatedData = null;

function getTodayISODateString() {
  const d = new Date();
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

function formatISODateToBR(isoStr) {
  if (!isoStr) return "";
  const parts = isoStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoStr;
}

window.openCashRegisterTab = function() {
  document.querySelectorAll(".adm-tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".adm-tab-pane").forEach(p => p.classList.remove("active"));

  const caixaBtn = document.querySelector('.adm-tab-btn[data-tab="caixa"]');
  const caixaPane = document.getElementById("tab-caixa");
  if (caixaBtn) caixaBtn.classList.add("active");
  if (caixaPane) caixaPane.classList.add("active");

  const picker = document.getElementById("caixa-date-picker");
  if (picker && !picker.value) {
    picker.value = getTodayISODateString();
  }
  renderCashClosingView();
};

window.setCaixaDateToday = function() {
  const picker = document.getElementById("caixa-date-picker");
  if (picker) {
    picker.value = getTodayISODateString();
    renderCashClosingView();
  }
};

window.setCaixaPaymentFilter = function(filterKey) {
  currentCaixaPaymentFilter = filterKey;
  document.querySelectorAll("#caixa-payment-filters .btn-filter-pill").forEach(btn => {
    btn.classList.remove("active");
  });
  const activeBtn = Array.from(document.querySelectorAll("#caixa-payment-filters .btn-filter-pill")).find(b => 
    b.getAttribute("onclick")?.includes(`'${filterKey}'`)
  );
  if (activeBtn) activeBtn.classList.add("active");
  renderCaixaOrdersTable();
};

window.renderCashClosingView = function() {
  const picker = document.getElementById("caixa-date-picker");
  if (!picker) return;
  if (!picker.value) picker.value = getTodayISODateString();
  currentCaixaDateStr = picker.value;

  const brDateStr = formatISODateToBR(currentCaixaDateStr);
  const dateLabel = document.getElementById("caixa-selected-date-str");
  if (dateLabel) dateLabel.textContent = brDateStr;

  const allOrders = VIPDatabase.getOrders();

  const dayOrders = allOrders.filter(order => {
    if (!order.createdAt) return false;
    const d = new Date(order.createdAt);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    const orderDateStr = `${yr}-${mo}-${da}`;
    return orderDateStr === currentCaixaDateStr;
  });

  const validOrders = dayOrders.filter(o => o.status !== "cancelado");
  const cancelledOrders = dayOrders.filter(o => o.status === "cancelado");

  let totalRevenue = 0;
  let cashTotal = 0;
  let cashCount = 0;
  let pixTotal = 0;
  let pixCount = 0;
  let cardTotal = 0;
  let cardCount = 0;
  let otherTotal = 0;
  let otherCount = 0;
  let deliveryFeesTotal = 0;
  let deliveryCount = 0;
  let pickupCount = 0;

  validOrders.forEach(o => {
    const val = Number(o.totalAmount || o.total || 0);
    totalRevenue += val;

    const fee = Number(o.deliveryFee || 0);
    deliveryFeesTotal += fee;

    if (o.fulfillment === "Entrega") deliveryCount++;
    else pickupCount++;

    const pay = String(o.paymentMethod || "").toLowerCase();
    if (pay.includes("dinheiro") || pay.includes("especie") || pay.includes("espécie")) {
      cashTotal += val;
      cashCount++;
    } else if (pay.includes("pix")) {
      pixTotal += val;
      pixCount++;
    } else if (pay.includes("cart") || pay.includes("crédito") || pay.includes("debito") || pay.includes("débito")) {
      cardTotal += val;
      cardCount++;
    } else {
      otherTotal += val;
      otherCount++;
    }
  });

  const averageTicket = validOrders.length > 0 ? (totalRevenue / validOrders.length) : 0;

  currentCaixaCalculatedData = {
    dateStr: currentCaixaDateStr,
    brDateStr,
    dayOrders,
    validOrders,
    cancelledOrders,
    totalRevenue,
    cashTotal,
    cashCount,
    pixTotal,
    pixCount,
    cardTotal,
    cardCount,
    otherTotal,
    otherCount,
    deliveryFeesTotal,
    deliveryCount,
    pickupCount,
    averageTicket
  };

  const elTotalVal = document.getElementById("caixa-metric-total-val");
  const elTotalOrders = document.getElementById("caixa-metric-total-orders");
  const elCashVal = document.getElementById("caixa-metric-cash-val");
  const elCashCount = document.getElementById("caixa-metric-cash-count");
  const elPixVal = document.getElementById("caixa-metric-pix-val");
  const elPixCount = document.getElementById("caixa-metric-pix-count");
  const elCardVal = document.getElementById("caixa-metric-card-val");
  const elCardCount = document.getElementById("caixa-metric-card-count");
  const elDeliveryVal = document.getElementById("caixa-metric-delivery-val");
  const elDeliveryCount = document.getElementById("caixa-metric-delivery-count");
  const elTicketVal = document.getElementById("caixa-metric-ticket-val");

  if (elTotalVal) elTotalVal.textContent = formatBRL(totalRevenue);
  if (elTotalOrders) elTotalOrders.textContent = `${validOrders.length} pedido(s) faturado(s)${cancelledOrders.length > 0 ? ` (${cancelledOrders.length} canc.)` : ""}`;
  if (elCashVal) elCashVal.textContent = formatBRL(cashTotal);
  if (elCashCount) elCashCount.textContent = `${cashCount} pedido(s) em espécie`;
  if (elPixVal) elPixVal.textContent = formatBRL(pixTotal);
  if (elPixCount) elPixCount.textContent = `${pixCount} pedido(s) via PIX`;
  if (elCardVal) elCardVal.textContent = formatBRL(cardTotal);
  if (elCardCount) elCardCount.textContent = `${cardCount} pedido(s) no cartão`;
  if (elDeliveryVal) elDeliveryVal.textContent = formatBRL(deliveryFeesTotal);
  if (elDeliveryCount) elDeliveryCount.textContent = `${deliveryCount} entrega(s) (${pickupCount} balcão)`;
  if (elTicketVal) elTicketVal.textContent = formatBRL(averageTicket);

  const savedClosing = VIPDatabase.getCashClosingByDate(currentCaixaDateStr);
  const pillStatus = document.getElementById("caixa-status-pill");
  const timeStatus = document.getElementById("caixa-status-time");

  const fundoInput = document.getElementById("caixa-fundo-input");
  const sangriasInput = document.getElementById("caixa-sangrias-input");
  const countedInput = document.getElementById("caixa-counted-input");
  const notesInput = document.getElementById("caixa-notes-input");

  if (savedClosing) {
    if (pillStatus) {
      pillStatus.className = "caixa-status-badge status-closed";
      pillStatus.innerHTML = `<i class="fa-solid fa-lock"></i> CAIXA FECHADO & ARQUIVADO`;
    }
    if (timeStatus) {
      const closedAtStr = new Date(savedClosing.savedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      timeStatus.textContent = `Fechamento realizado em ${formatISODateToBR(savedClosing.dateStr)} às ${closedAtStr} por ${savedClosing.operator || "Admin"}`;
    }
    if (fundoInput && savedClosing.fundoTroco !== undefined) fundoInput.value = Number(savedClosing.fundoTroco).toFixed(2);
    if (sangriasInput && savedClosing.sangrias !== undefined) sangriasInput.value = Number(savedClosing.sangrias).toFixed(2);
    if (countedInput && savedClosing.dinheiroContado !== undefined) countedInput.value = Number(savedClosing.dinheiroContado).toFixed(2);
    if (notesInput && savedClosing.notes !== undefined) notesInput.value = savedClosing.notes || "";
  } else {
    if (pillStatus) {
      pillStatus.className = "caixa-status-badge status-open";
      pillStatus.innerHTML = `<i class="fa-solid fa-lock-open"></i> CAIXA EM OPERAÇÃO (ABERTO)`;
    }
    if (timeStatus) {
      timeStatus.textContent = `Auditoria em tempo real de ${brDateStr}`;
    }
    if (fundoInput && !fundoInput.value) fundoInput.value = "100.00";
    if (sangriasInput && !sangriasInput.value) sangriasInput.value = "0.00";
  }

  const elCashEntries = document.getElementById("caixa-display-cash-entries");
  if (elCashEntries) elCashEntries.textContent = formatBRL(cashTotal);

  updateCashBalancingUI();
  renderCaixaOrdersTable();
  renderCaixaMotoboysTable();
  renderCaixaHistoryTable();
};

window.updateCashBalancingUI = function() {
  if (!currentCaixaCalculatedData) return;
  const cashEntries = currentCaixaCalculatedData.cashTotal || 0;

  const fundoInput = document.getElementById("caixa-fundo-input");
  const sangriasInput = document.getElementById("caixa-sangrias-input");
  const countedInput = document.getElementById("caixa-counted-input");
  const diffBox = document.getElementById("caixa-diff-result-box");
  const expectedDisplay = document.getElementById("caixa-display-expected");

  const fundoVal = parseFloat(fundoInput?.value) || 0;
  const sangriasVal = parseFloat(sangriasInput?.value) || 0;
  const expectedVal = Math.max(0, fundoVal + cashEntries - sangriasVal);

  if (expectedDisplay) expectedDisplay.textContent = formatBRL(expectedVal);

  const rawCounted = countedInput?.value?.trim();
  if (!rawCounted || isNaN(parseFloat(rawCounted))) {
    if (diffBox) {
      diffBox.innerHTML = `
        <div class="diff-badge diff-badge-pending">
          <i class="fa-solid fa-hand-holding-dollar"></i>
          <div>
            <strong>Aguardando contagem física...</strong>
            <small style="display:block; font-weight: normal;">Digite o valor em dinheiro na gaveta para calcular a diferença.</small>
          </div>
        </div>
      `;
    }
    return;
  }

  const countedVal = parseFloat(rawCounted) || 0;
  const diff = countedVal - expectedVal;

  if (diffBox) {
    if (Math.abs(diff) < 0.05) {
      diffBox.innerHTML = `
        <div class="diff-badge diff-badge-balanced">
          <i class="fa-solid fa-circle-check" style="font-size: 1.5rem;"></i>
          <div>
            <strong>Caixa 100% Batido! (Diferença: R$ 0,00)</strong>
            <small style="display:block; font-weight: normal;">O valor contado confere exatamente com o saldo esperado do sistema.</small>
          </div>
        </div>
      `;
    } else if (diff > 0) {
      diffBox.innerHTML = `
        <div class="diff-badge diff-badge-surplus">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.5rem;"></i>
          <div>
            <strong>Sobra de Caixa: +${formatBRL(diff)}</strong>
            <small style="display:block; font-weight: normal;">Há mais dinheiro na gaveta do que o registrado no sistema.</small>
          </div>
        </div>
      `;
    } else {
      diffBox.innerHTML = `
        <div class="diff-badge diff-badge-deficit">
          <i class="fa-solid fa-circle-xmark" style="font-size: 1.5rem;"></i>
          <div>
            <strong>Falta de Caixa: -${formatBRL(Math.abs(diff))}</strong>
            <small style="display:block; font-weight: normal;">Há menos dinheiro na gaveta do que o registrado no sistema.</small>
          </div>
        </div>
      `;
    }
  }
};

function renderCaixaOrdersTable() {
  if (!currentCaixaCalculatedData) return;
  const { dayOrders, validOrders, cancelledOrders, cashCount, pixCount, cardCount } = currentCaixaCalculatedData;

  const countTodos = document.getElementById("caixa-filter-count-todos");
  const countDinheiro = document.getElementById("caixa-filter-count-dinheiro");
  const countPix = document.getElementById("caixa-filter-count-pix");
  const countCartao = document.getElementById("caixa-filter-count-cartao");
  const countCancelados = document.getElementById("caixa-filter-count-cancelados");
  const totalTableCount = document.getElementById("caixa-table-orders-count");

  if (countTodos) countTodos.textContent = dayOrders.length;
  if (countDinheiro) countDinheiro.textContent = cashCount;
  if (countPix) countPix.textContent = pixCount;
  if (countCartao) countCartao.textContent = cardCount;
  if (countCancelados) countCancelados.textContent = cancelledOrders.length;

  let filtered = dayOrders;
  if (currentCaixaPaymentFilter === "dinheiro") {
    filtered = dayOrders.filter(o => o.status !== "cancelado" && String(o.paymentMethod || "").toLowerCase().includes("dinheiro"));
  } else if (currentCaixaPaymentFilter === "pix") {
    filtered = dayOrders.filter(o => o.status !== "cancelado" && String(o.paymentMethod || "").toLowerCase().includes("pix"));
  } else if (currentCaixaPaymentFilter === "cartao") {
    filtered = dayOrders.filter(o => o.status !== "cancelado" && (
      String(o.paymentMethod || "").toLowerCase().includes("cart") || 
      String(o.paymentMethod || "").toLowerCase().includes("crédito") || 
      String(o.paymentMethod || "").toLowerCase().includes("débito")
    ));
  } else if (currentCaixaPaymentFilter === "cancelados") {
    filtered = cancelledOrders;
  }

  if (totalTableCount) totalTableCount.textContent = filtered.length;

  const tbody = document.getElementById("caixa-orders-table-body");
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; color: #94a3b8; padding: 24px;">
          <i class="fa-solid fa-receipt" style="font-size: 1.8rem; margin-bottom: 6px; display: block;"></i>
          Nenhum pedido encontrado para o filtro selecionado nesta data.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(o => {
    const timeStr = new Date(o.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const isDelivery = o.fulfillment === "Entrega";
    const payStr = o.paymentMethod || "Não informado";
    let payBadgeClass = "badge-pay-other";
    const pLow = payStr.toLowerCase();
    if (pLow.includes("dinheiro")) payBadgeClass = "badge-pay-money";
    else if (pLow.includes("pix")) payBadgeClass = "badge-pay-pix";
    else if (pLow.includes("cart") || pLow.includes("crédito") || pLow.includes("débito")) payBadgeClass = "badge-pay-card";

    const totalVal = Number(o.totalAmount || o.total || 0);
    const feeVal = Number(o.deliveryFee || 0);
    const subVal = Math.max(0, totalVal - feeVal);

    let statusBadge = `<span class="badge-status-order status-${o.status}">${o.status}</span>`;
    if (o.status === "novo") statusBadge = `<span class="badge-status-order status-novo">Recebidos</span>`;
    else if (o.status === "em_preparo") statusBadge = `<span class="badge-status-order status-prep">Empreparo</span>`;
    else if (o.status === "pronto") statusBadge = `<span class="badge-status-order status-pronto">Pronto/Entrega</span>`;
    else if (o.status === "concluido") statusBadge = `<span class="badge-status-order status-concluido">Finalizado</span>`;
    else if (o.status === "cancelado") statusBadge = `<span class="badge-status-order status-cancelado">Cancelado</span>`;

    return `
      <tr class="${o.status === 'cancelado' ? 'row-cancelled' : ''}">
        <td><strong>${timeStr}</strong></td>
        <td><strong style="color: #b45309;">#${o.id}</strong></td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${o.customer?.name || "Cliente"}</div>
          <small style="color: #64748b;">${o.customer?.phone || ""}</small>
        </td>
        <td>
          ${isDelivery ? `<span class="kanban-tag-delivery"><i class="fa-solid fa-motorcycle"></i> Entrega</span>` : `<span class="kanban-tag-pickup"><i class="fa-solid fa-store"></i> Balcão</span>`}
        </td>
        <td>
          <span class="${payBadgeClass}">${payStr}</span>
          ${o.cashChangeFor ? `<small style="display:block; color: #64748b; font-weight:600;">(Troco p/ ${o.cashChangeFor})</small>` : ""}
        </td>
        <td>${formatBRL(subVal)}</td>
        <td>${feeVal > 0 ? formatBRL(feeVal) : '<span style="color:#94a3b8;">Grátis</span>'}</td>
        <td><strong style="font-size: 1.05rem; color: #0f172a;">${formatBRL(totalVal)}</strong></td>
        <td>${statusBadge}</td>
        <td class="text-right">
          <button type="button" class="btn-action-icon" onclick="openOrderDetails('${o.id}')" title="Ver Detalhes do Pedido">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button type="button" class="btn-action-icon" onclick="printOrderReceipt('${o.id}', false)" title="Imprimir Comanda">
            <i class="fa-solid fa-print"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderCaixaHistoryTable() {
  const closings = VIPDatabase.getCashClosings();
  const tbody = document.getElementById("caixa-history-table-body");
  if (!tbody) return;

  if (closings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: #94a3b8; padding: 18px;">
          Nenhum fechamento arquivado ainda. Ao clicar em "Salvar Fechamento", o histórico do dia será guardado aqui.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = closings.map(c => {
    const closedDateStr = formatISODateToBR(c.dateStr);
    const savedTimeStr = new Date(c.savedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const diff = Number(c.difference || 0);

    let diffBadge = `<span style="color:#166534; font-weight:800;">✓ Batido (R$ 0,00)</span>`;
    if (diff > 0.05) diffBadge = `<span style="color:#b45309; font-weight:800;">+${formatBRL(diff)} (Sobra)</span>`;
    else if (diff < -0.05) diffBadge = `<span style="color:#dc2626; font-weight:800;">-${formatBRL(Math.abs(diff))} (Falta)</span>`;

    return `
      <tr>
        <td><strong>${closedDateStr}</strong></td>
        <td>${savedTimeStr}</td>
        <td><strong>${c.operator || "Admin"}</strong></td>
        <td><strong style="color: #0f172a;">${formatBRL(c.totalRevenue || 0)}</strong></td>
        <td>${formatBRL(c.cashTotal || 0)}</td>
        <td>${formatBRL(c.pixTotal || 0)}</td>
        <td>${formatBRL(c.cardTotal || 0)}</td>
        <td>${diffBadge}</td>
        <td class="text-right">
          <button type="button" class="btn-outline-admin" onclick="loadSavedClosingIntoView('${c.dateStr}')" style="padding: 4px 10px; font-size: 0.78rem;">
            <i class="fa-solid fa-folder-open"></i> Abrir
          </button>
          <button type="button" class="btn-primary-admin" onclick="printSavedCashClosing('${c.dateStr}')" style="padding: 4px 10px; font-size: 0.78rem;">
            <i class="fa-solid fa-print"></i> Imprimir
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

window.loadSavedClosingIntoView = function(dateStr) {
  const picker = document.getElementById("caixa-date-picker");
  if (picker) {
    picker.value = dateStr;
    renderCashClosingView();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};

window.saveCurrentCashClosing = function() {
  if (!currentCaixaCalculatedData) return;
  const { dateStr, brDateStr, totalRevenue, cashTotal, pixTotal, cardTotal, deliveryFeesTotal, validOrders } = currentCaixaCalculatedData;

  const fundoInput = document.getElementById("caixa-fundo-input");
  const sangriasInput = document.getElementById("caixa-sangrias-input");
  const countedInput = document.getElementById("caixa-counted-input");
  const notesInput = document.getElementById("caixa-notes-input");

  const fundoVal = parseFloat(fundoInput?.value) || 0;
  const sangriasVal = parseFloat(sangriasInput?.value) || 0;
  const expectedVal = Math.max(0, fundoVal + cashTotal - sangriasVal);
  const countedVal = parseFloat(countedInput?.value) || 0;
  const diff = countedVal - expectedVal;

  const operator = (VIPAuth.getCurrentUser() && VIPAuth.getCurrentUser().name) || "Administrador";

  const closingRecord = {
    dateStr,
    brDateStr,
    totalRevenue,
    cashTotal,
    pixTotal,
    cardTotal,
    deliveryFeesTotal,
    ordersCount: validOrders.length,
    fundoTroco: fundoVal,
    sangrias: sangriasVal,
    dinheiroEsperado: expectedVal,
    dinheiroContado: countedVal,
    difference: diff,
    operator,
    notes: notesInput?.value?.trim() || "",
    savedAt: Date.now()
  };

  VIPDatabase.saveCashClosing(closingRecord);
  showToastNotification(`Fechamento de Caixa do dia ${brDateStr} gravado com sucesso!`);
  renderCashClosingView();
};

window.printCashClosingThermal = function() {
  if (!currentCaixaCalculatedData) return;
  const data = currentCaixaCalculatedData;
  const cfg = VIPDatabase.getConfig();
  const printerCfg = VIPDatabase.getPrinterConfig();

  const fundoInput = document.getElementById("caixa-fundo-input");
  const sangriasInput = document.getElementById("caixa-sangrias-input");
  const countedInput = document.getElementById("caixa-counted-input");
  const notesInput = document.getElementById("caixa-notes-input");

  const fundoVal = parseFloat(fundoInput?.value) || 0;
  const sangriasVal = parseFloat(sangriasInput?.value) || 0;
  const expectedVal = Math.max(0, fundoVal + data.cashTotal - sangriasVal);
  const countedVal = parseFloat(countedInput?.value) || 0;
  const diff = countedVal - expectedVal;
  const operator = (VIPAuth.getCurrentUser() && VIPAuth.getCurrentUser().name) || "Administrador";

  let motoboyRunsCount = 0;
  let motoboyFeesTotal = 0;
  let motoboyCashTotal = 0;
  data.validOrders.forEach(o => {
    if (o.deliveryMan && o.deliveryMan.id) {
      motoboyRunsCount++;
      motoboyFeesTotal += Number(o.deliveryMan.fee !== undefined ? o.deliveryMan.fee : 7);
      const pay = String(o.paymentMethod || "").toLowerCase();
      if (pay.includes("dinheiro") || pay.includes("especie") || pay.includes("espécie")) {
        motoboyCashTotal += Number(o.totalAmount || o.total || 0);
      }
    }
  });

  const closingPayload = {
    ...data,
    fundoVal,
    sangriasVal,
    expectedVal,
    countedVal,
    diff,
    operator,
    notes: notesInput?.value?.trim() || ""
  };

  const receiptArea = document.getElementById("thermal-receipt-area");
  if (!receiptArea) return;

  const printableWidthMm = parseInt(printerCfg.printableWidthMm) || 76;
  const marginSideMm = parseInt(printerCfg.marginSideMm) !== undefined ? parseInt(printerCfg.marginSideMm) : 2;

  let diffText = `R$ 0,00 (100% BATIDO)`;
  if (diff > 0.05) diffText = `+${formatBRL(diff)} (SOBRA)`;
  else if (diff < -0.05) diffText = `-${formatBRL(Math.abs(diff))} (FALTA)`;

  receiptArea.className = "thermal-receipt-area paper-80mm";
  receiptArea.innerHTML = `
    <div style="width: 100%; max-width: ${printableWidthMm}mm; margin: 0 auto; padding: 0 ${marginSideMm}mm; box-sizing: border-box; font-family: 'Consolas', 'Courier New', monospace; font-size: 11pt; color: #000000; line-height: 1.35; text-align: left;">
      <div style="text-align: center; font-weight: 900; font-size: 13pt; margin-bottom: 2px;">
        *** SALGADOS VIP ***
      </div>
      <div style="text-align: center; font-weight: 800; font-size: 11.5pt; text-transform: uppercase;">
        FECHAMENTO DE CAIXA DO DIA
      </div>
      <div style="text-align: center; font-size: 9pt; color: #333; margin-bottom: 6px;">
        DATA: <strong>${data.brDateStr}</strong> | EMISSÃO: ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div style="text-align: center; font-size: 9pt; margin-bottom: 6px;">
        OPERADOR: ${operator}
      </div>

      <div style="border-top: 2px dashed #000; margin: 6px 0;"></div>

      <div style="font-weight: 900; font-size: 10.5pt; margin-bottom: 4px;">
        RESUMO FINANCEIRO DE VENDAS
      </div>

      <div style="display: flex; justify-content: space-between; font-weight: 700;">
        <span>(+) VENDAS DINHEIRO (${data.cashCount}):</span>
        <span>${formatBRL(data.cashTotal)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: 700;">
        <span>(+) VENDAS VIA PIX (${data.pixCount}):</span>
        <span>${formatBRL(data.pixTotal)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: 700;">
        <span>(+) VENDAS CARTÃO (${data.cardCount}):</span>
        <span>${formatBRL(data.cardTotal)}</span>
      </div>
      ${data.otherCount > 0 ? `
      <div style="display: flex; justify-content: space-between; font-weight: 700;">
        <span>(+) OUTRAS FORMAS (${data.otherCount}):</span>
        <span>${formatBRL(data.otherTotal)}</span>
      </div>
      ` : ""}

      <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>

      <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 12pt;">
        <span>TOTAL FATURADO:</span>
        <span>${formatBRL(data.totalRevenue)}</span>
      </div>

      <div style="border-top: 2px dashed #000; margin: 6px 0;"></div>

      <div style="font-weight: 900; font-size: 10.5pt; margin-bottom: 4px;">
        OPERAÇÃO & LOGÍSTICA
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Total de Pedidos Válidos:</span>
        <strong>${data.validOrders.length} pedidos</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Entregas em Domicílio:</span>
        <span>${data.deliveryCount} viagens</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Retiradas no Balcão:</span>
        <span>${data.pickupCount} pedidos</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Taxas de Entrega Totais:</span>
        <strong>${formatBRL(data.deliveryFeesTotal)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Ticket Médio por Pedido:</span>
        <strong>${formatBRL(data.averageTicket)}</strong>
      </div>
      ${motoboyRunsCount > 0 ? `
        <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>
        <div style="font-weight: 800; font-size: 9.5pt; margin-bottom: 2px;">
          🏍️ ACERTO DE MOTOBOYS
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Corridas Atribuídas:</span>
          <span>${motoboyRunsCount} viagens</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Taxas a Pagar (Crédito):</span>
          <strong>${formatBRL(motoboyFeesTotal)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Dinheiro em Mãos (Débito):</span>
          <strong>${formatBRL(motoboyCashTotal)}</strong>
        </div>
      ` : ''}

      <div style="border-top: 2px dashed #000; margin: 6px 0;"></div>

      <div style="font-weight: 900; font-size: 10.5pt; margin-bottom: 4px;">
        CONCILIAÇÃO DA GAVETA (ESPÉCIE)
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>(+) Fundo de Troco Inicial:</span>
        <span>${formatBRL(fundoVal)}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>(+) Entradas em Dinheiro:</span>
        <span>${formatBRL(data.cashTotal)}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>(-) Sangrias / Despesas:</span>
        <span>${formatBRL(sangriasVal)}</span>
      </div>
      <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>
      <div style="display: flex; justify-content: space-between; font-weight: 800;">
        <span>(=) SALDO ESPERADO:</span>
        <span>${formatBRL(expectedVal)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 11.5pt;">
        <span>DINHEIRO CONTADO:</span>
        <span>${formatBRL(countedVal)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 11pt; margin-top: 2px;">
        <span>DIFERENÇA:</span>
        <span>${diffText}</span>
      </div>

      ${closingPayload.notes ? `
      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
      <div style="font-size: 9pt;">
        <strong>OBSERVAÇÕES:</strong><br>
        ${closingPayload.notes}
      </div>
      ` : ""}

      <div style="border-top: 2px dashed #000; margin: 16px 0 20px 0;"></div>

      <div style="text-align: center; font-size: 9pt; margin-top: 25px;">
        _____________________________________<br>
        Assinatura do Responsável
      </div>
      <div style="text-align: center; font-size: 8pt; color: #666; margin-top: 12px; margin-bottom: 12px;">
        *** SALGADOS VIP GESTÃO ***
      </div>
    </div>
  `;

  try {
    const textReport = `
========================================
         *** SALGADOS VIP ***           
      FECHAMENTO DE CAIXA DO DIA        
Data: ${data.brDateStr}  Hora: ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
Operador: ${operator}
========================================
RESUMO FINANCEIRO:
(+) Dinheiro (${data.cashCount}):        ${formatBRL(data.cashTotal)}
(+) PIX (${data.pixCount}):             ${formatBRL(data.pixTotal)}
(+) Cartao (${data.cardCount}):          ${formatBRL(data.cardTotal)}
----------------------------------------
TOTAL FATURADO:       ${formatBRL(data.totalRevenue)}
----------------------------------------
OPERAÇÃO:
Pedidos Faturados:     ${data.validOrders.length}
Entregas:              ${data.deliveryCount} (${formatBRL(data.deliveryFeesTotal)})
Retiradas no Balcao:   ${data.pickupCount}
Ticket Medio:          ${formatBRL(data.averageTicket)}
========================================
CONCILIACAO GAVETA (DINHEIRO):
(+) Fundo Inicial:     ${formatBRL(fundoVal)}
(+) Entradas Dinheiro: ${formatBRL(data.cashTotal)}
(-) Sangrias / Saidas: ${formatBRL(sangriasVal)}
----------------------------------------
SALDO ESPERADO:        ${formatBRL(expectedVal)}
VALOR CONTADO:         ${formatBRL(countedVal)}
DIFERENCA:             ${diffText}
========================================
${closingPayload.notes ? `OBS: ${closingPayload.notes}\n` : ""}
Assinatura: ___________________________
`;

    fetch("http://127.0.0.1:18181/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: textReport,
        printerName: printerCfg.printerName || "",
        copies: 1,
        cutPaper: true
      })
    }).then(res => {
      if (res.ok) {
        showToastNotification("Fechamento de Caixa impresso na impressora térmica!");
        return;
      }
      window.print();
    }).catch(() => {
      window.print();
    });
  } catch (e) {
    window.print();
  }
};

window.printSavedCashClosing = function(dateStr) {
  loadSavedClosingIntoView(dateStr);
  setTimeout(() => {
    printCashClosingThermal();
  }, 250);
};

window.shareCashClosingWhatsApp = function() {
  if (!currentCaixaCalculatedData) return;
  const d = currentCaixaCalculatedData;

  const fundoVal = parseFloat(document.getElementById("caixa-fundo-input")?.value) || 0;
  const sangriasVal = parseFloat(document.getElementById("caixa-sangrias-input")?.value) || 0;
  const countedVal = parseFloat(document.getElementById("caixa-counted-input")?.value) || 0;
  const expectedVal = Math.max(0, fundoVal + d.cashTotal - sangriasVal);
  const diff = countedVal - expectedVal;

  let diffIcon = "🟢";
  let diffStr = "Caixa 100% Batido";
  if (diff > 0.05) { diffIcon = "🟡"; diffStr = `Sobra de +${formatBRL(diff)}`; }
  else if (diff < -0.05) { diffIcon = "🔴"; diffStr = `Falta de -${formatBRL(Math.abs(diff))}`; }

  const msg = `📊 *FECHAMENTO DE CAIXA - SALGADOS VIP*
📅 *Data:* ${d.brDateStr}

💰 *Faturamento Total:* ${formatBRL(d.totalRevenue)}
📦 *Total de Pedidos:* ${d.validOrders.length}
🎯 *Ticket Médio:* ${formatBRL(d.averageTicket)}

💵 *Dinheiro:* ${formatBRL(d.cashTotal)} (${d.cashCount})
📱 *PIX:* ${formatBRL(d.pixTotal)} (${d.pixCount})
💳 *Cartão:* ${formatBRL(d.cardTotal)} (${d.cardCount})
🛵 *Taxas de Entrega:* ${formatBRL(d.deliveryFeesTotal)} (${d.deliveryCount} entregas / ${d.pickupCount} balcão)

⚖️ *CONFERÊNCIA DA GAVETA:*
(+) Fundo de Troco: ${formatBRL(fundoVal)}
(+) Entradas Dinheiro: ${formatBRL(d.cashTotal)}
(-) Sangrias: ${formatBRL(sangriasVal)}
(=) Esperado: ${formatBRL(expectedVal)}
💵 Contado: ${formatBRL(countedVal)}
${diffIcon} *Resultado:* ${diffStr}

_Gerado automaticamente pelo Sistema Salgados VIP_`;

  navigator.clipboard.writeText(msg).then(() => {
    showToastNotification("Resumo do fechamento copiado para a Área de Transferência! Pronto para colar no WhatsApp.");
  }).catch(() => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  });
};

// ==============================================================================
// 2.10 MÓDULO DE GESTÃO DE ENTREGADORES (MOTOBOYS) & DESPACHO INTELIGENTE
// ==============================================================================
let currentMotoboyFilter = "all";
let motoboySearchTerm = "";
let currentMotoboySubTab = "fleet"; // "fleet" ou "crm"
let modalSelectedWorkDays = [0, 1, 2, 3, 4, 5, 6]; // Domingo (0) a Sábado (6)
let mbCrmPeriodState = {
  startDate: "",
  endDate: "",
  motoboyId: "all"
};
const WEEKDAY_NAMES_PT = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const WEEKDAY_SHORT_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

window.updateMotoboyBadgeCount = function() {
  const badge = document.getElementById("badge-motoboys-count");
  if (!badge) return;
  const list = VIPDatabase.getMotoboys();
  const activeCount = list.filter(m => m.active).length;
  badge.textContent = activeCount;
  badge.style.display = activeCount > 0 ? "inline-block" : "none";
};

// Alternador de Sub-Abas do Módulo de Motoboys
window.switchMotoboySubTab = function(subTab) {
  currentMotoboySubTab = subTab;
  const btnFleet = document.getElementById("btn-subtab-mb-fleet");
  const btnCrm = document.getElementById("btn-subtab-mb-crm");
  const paneFleet = document.getElementById("subtab-pane-motoboys-fleet");
  const paneCrm = document.getElementById("subtab-pane-motoboys-crm");

  if (btnFleet) btnFleet.classList.toggle("active", subTab === "fleet");
  if (btnCrm) btnCrm.classList.toggle("active", subTab === "crm");

  if (paneFleet) paneFleet.style.display = subTab === "fleet" ? "block" : "none";
  if (paneCrm) paneCrm.style.display = subTab === "crm" ? "block" : "none";

  if (subTab === "crm") {
    initMotoboysCRMFilters();
    renderMotoboysCRMPeriodView();
  } else {
    renderMotoboysView();
  }
};

window.renderMotoboysView = function() {
  if (currentMotoboySubTab === "crm") {
    renderMotoboysCRMPeriodView();
    return;
  }

  const grid = document.getElementById("motoboys-cards-grid");
  if (!grid) return;

  const motoboys = VIPDatabase.getMotoboys();
  const orders = VIPDatabase.getOrders();
  const todayStr = getTodayISODateString();
  const currentDayOfWeek = new Date().getDay();

  // Filtra pedidos válidos de hoje para estatísticas dos motoboys
  const todayOrders = orders.filter(o => {
    if (!o.createdAt || o.status === "cancelado") return false;
    const d = new Date(o.createdAt);
    const orderDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return orderDateStr === todayStr;
  });

  // Mapeia corridas de hoje por motoboy
  const statsByMotoboy = {};
  motoboys.forEach(m => {
    statsByMotoboy[m.id] = { runsCount: 0, totalFees: 0, cashCollected: 0, orders: [] };
  });

  todayOrders.forEach(o => {
    if (o.deliveryMan && o.deliveryMan.id) {
      const mbId = o.deliveryMan.id;
      if (!statsByMotoboy[mbId]) {
        statsByMotoboy[mbId] = { runsCount: 0, totalFees: 0, cashCollected: 0, orders: [] };
      }
      const st = statsByMotoboy[mbId];
      st.runsCount++;
      const fee = Number(o.deliveryMan.fee !== undefined ? o.deliveryMan.fee : (m?.defaultFee || 7));
      st.totalFees += fee;
      st.orders.push(o);

      const pay = String(o.paymentMethod || "").toLowerCase();
      if (pay.includes("dinheiro") || pay.includes("especie") || pay.includes("espécie")) {
        st.cashCollected += Number(o.totalAmount || o.total || 0);
      }
    }
  });

  // Atualiza Indicadores KPI no topo da aba
  const activeCount = motoboys.filter(m => m.active).length;
  let totalRunsToday = 0;
  let totalFeesToday = 0;
  let totalCashToday = 0;

  Object.values(statsByMotoboy).forEach(st => {
    totalRunsToday += st.runsCount;
    totalFeesToday += st.totalFees;
    totalCashToday += st.cashCollected;
  });

  const elActive = document.getElementById("mb-kpi-active");
  const elRuns = document.getElementById("mb-kpi-deliveries");
  const elFees = document.getElementById("mb-kpi-fees");
  const elCash = document.getElementById("mb-kpi-cash");

  if (elActive) elActive.textContent = activeCount;
  if (elRuns) elRuns.textContent = totalRunsToday;
  if (elFees) elFees.textContent = formatBRL(totalFeesToday);
  if (elCash) elCash.textContent = formatBRL(totalCashToday);

  // Contadores de filtros
  const pausedCount = motoboys.length - activeCount;
  const countAll = document.getElementById("mb-filter-count-all");
  const countAct = document.getElementById("mb-filter-count-active");
  const countPau = document.getElementById("mb-filter-count-paused");
  if (countAll) countAll.textContent = motoboys.length;
  if (countAct) countAct.textContent = activeCount;
  if (countPau) countPau.textContent = pausedCount;

  // Filtragem
  const searchInput = document.getElementById("motoboy-search-input");
  motoboySearchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";

  let filtered = motoboys.filter(m => {
    if (currentMotoboyFilter === "active" && !m.active) return false;
    if (currentMotoboyFilter === "paused" && m.active) return false;
    if (motoboySearchTerm) {
      const matchName = (m.name || "").toLowerCase().includes(motoboySearchTerm);
      const matchVehicle = (m.vehicle || "").toLowerCase().includes(motoboySearchTerm);
      const matchPhone = (m.phone || "").toLowerCase().includes(motoboySearchTerm);
      return matchName || matchVehicle || matchPhone;
    }
    return true;
  });

  // Renderiza Grade de Cards
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; background: #ffffff; border-radius: 12px; border: 1px dashed #cbd5e1; color: #64748b;">
        <i class="fa-solid fa-motorcycle" style="font-size: 2.5rem; color: #cbd5e1; margin-bottom: 10px;"></i>
        <h4 style="margin: 0 0 6px 0; color: #334155;">Nenhum entregador encontrado</h4>
        <p style="font-size: 0.85rem; margin: 0 0 14px 0;">Cadastre seus motoboys para organizar a fila de entregas e acertar corridas facilmente.</p>
        <button type="button" class="btn-primary-admin" onclick="openMotoboyModal()">
          <i class="fa-solid fa-plus"></i> Cadastrar Primeiro Entregador
        </button>
      </div>
    `;
  } else {
    grid.innerHTML = filtered.map(m => {
      const st = statsByMotoboy[m.id] || { runsCount: 0, totalFees: 0, cashCollected: 0 };
      const cleanPhone = (m.phone || "").replace(/\D/g, "");
      const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : "javascript:void(0)";
      const isPaused = !m.active;

      // Escala de dias da semana
      const workDays = Array.isArray(m.workDays) && m.workDays.length > 0 ? m.workDays : [0, 1, 2, 3, 4, 5, 6];
      const worksToday = workDays.includes(currentDayOfWeek);

      const daysPillsHtml = [0, 1, 2, 3, 4, 5, 6].map(dayIdx => {
        const isScheduled = workDays.includes(dayIdx);
        const isToday = dayIdx === currentDayOfWeek;
        let cls = "workday-pill";
        if (isScheduled && isToday) {
          cls += " is-today-active";
        } else if (isScheduled) {
          cls += " is-active";
        }
        return `<span class="${cls}" title="${WEEKDAY_NAMES_PT[dayIdx]}: ${isScheduled ? 'Trabalha' : 'Folga'}">${WEEKDAY_SHORT_PT[dayIdx]}</span>`;
      }).join("");

      return `
        <div class="motoboy-card ${isPaused ? 'is-paused' : ''}">
          <div>
            <div class="motoboy-card-top">
              <div class="motoboy-avatar-wrap">
                <div class="motoboy-avatar-icon">
                  <i class="fa-solid fa-motorcycle"></i>
                </div>
                <div class="motoboy-info-head">
                  <h3>${m.name}</h3>
                  <span class="motoboy-vehicle-text">
                    <i class="fa-solid fa-gauge-high"></i> ${m.vehicle || "Moto padrão"}
                  </span>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                <span class="badge-mb-status ${m.active ? 'badge-mb-active' : 'badge-mb-paused'}">
                  ${m.active ? '🟢 Ativo' : '⏸️ Em Pausa'}
                </span>
                <span style="font-size: 0.72rem; font-weight: 700; padding: 2px 6px; border-radius: 6px; ${worksToday ? 'background: #dcfce7; color: #166534;' : 'background: #f1f5f9; color: #64748b;'}">
                  ${worksToday ? '⚡ Escalado Hoje' : '☕ Folga Hoje'}
                </span>
              </div>
            </div>

            <!-- Escala de Dias da Semana -->
            <div style="margin-bottom: 8px;">
              <div style="font-size: 0.72rem; font-weight: 700; color: #475569; margin-bottom: 4px; display: flex; justify-content: space-between;">
                <span><i class="fa-solid fa-calendar-days"></i> Escala Semanal:</span>
                <span style="color: #64748b;">${workDays.length === 7 ? 'Todos os dias' : `${workDays.length} dias/sem`}</span>
              </div>
              <div class="motoboy-workdays-badge-row">
                ${daysPillsHtml}
              </div>
            </div>

            <!-- Valores Predefinidos de Remuneração -->
            <div class="motoboy-remuneration-badge">
              <div>
                <span style="color: #64748b; font-size: 0.72rem; display: block;">Diária Fixa:</span>
                <strong style="color: #0284c7; font-size: 0.88rem;">${formatBRL(m.dailyRate || 0)}</strong>
              </div>
              <div style="text-align: right;">
                <span style="color: #64748b; font-size: 0.72rem; display: block;">Taxa por Corrida:</span>
                <strong style="color: #047857; font-size: 0.88rem;">${formatBRL(m.defaultFee !== undefined ? m.defaultFee : 7)}</strong>
              </div>
            </div>

            <!-- Estatísticas do Dia de Hoje -->
            <div class="motoboy-card-stats">
              <div class="mb-stat-box">
                <span class="mb-stat-val">${st.runsCount}</span>
                <span class="mb-stat-lbl">Corridas Hoje</span>
              </div>
              <div class="mb-stat-box">
                <span class="mb-stat-val" style="color: #d97706;">${formatBRL(st.totalFees)}</span>
                <span class="mb-stat-lbl">Taxas a Pagar</span>
              </div>
              <div class="mb-stat-box">
                <span class="mb-stat-val" style="color: #059669;">${formatBRL(st.cashCollected)}</span>
                <span class="mb-stat-lbl">Dinheiro em Mãos</span>
              </div>
            </div>

            <!-- Linha de Contato -->
            <div class="motoboy-contact-row">
              <span><i class="fa-solid fa-phone" style="color: #64748b;"></i> ${m.phone || "Sem telefone"}</span>
              <a href="${waLink}" target="_blank" class="btn-mb-whatsapp" title="Abrir conversa no WhatsApp">
                <i class="fa-brands fa-whatsapp"></i> Conversar
              </a>
            </div>

            <!-- Chave Pix -->
            ${m.pixKey ? `
              <div class="motoboy-pix-badge">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px;" title="PIX: ${m.pixKey}">
                  <i class="fa-brands fa-pix" style="color: #10b981;"></i> <strong>${m.pixType || 'PIX'}:</strong> ${m.pixKey}
                </span>
                <button type="button" onclick="copyMotoboyPixKey('${m.pixKey}')" style="background: none; border: none; color: #0284c7; cursor: pointer; font-size: 0.8rem; font-weight: 700;" title="Copiar Chave PIX">
                  <i class="fa-solid fa-copy"></i> Copiar
                </button>
              </div>
            ` : `
              <div class="motoboy-pix-badge" style="color: #94a3b8; font-style: italic;">
                <i class="fa-solid fa-info-circle"></i> Nenhuma chave Pix cadastrada
              </div>
            `}
          </div>

          <div class="motoboy-card-actions">
            <div>
              <button type="button" class="btn-outline-admin" onclick="toggleMotoboyStatus('${m.id}')" style="padding: 5px 9px; font-size: 0.78rem;">
                ${m.active ? '<i class="fa-solid fa-pause"></i> Pausar' : '<i class="fa-solid fa-play"></i> Ativar'}
              </button>
              <button type="button" class="btn-outline-admin" onclick="printMotoboySettlementThermal('${m.id}')" style="padding: 5px 9px; font-size: 0.78rem;" title="Imprimir comprovante de acerto">
                <i class="fa-solid fa-print"></i> Acerto
              </button>
            </div>
            <div>
              <button type="button" class="btn-action-icon" onclick="openMotoboyModal('${m.id}')" title="Editar dados do entregador">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button type="button" class="btn-action-icon btn-action-delete" onclick="deleteMotoboyConfirm('${m.id}')" title="Excluir entregador">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  // Renderiza Tabela de Corridas Despachadas Hoje
  renderMotoboysTodayRunsTable(todayOrders);
  updateMotoboyBadgeCount();
};

function renderMotoboysTodayRunsTable(todayOrders) {
  const tbody = document.getElementById("motoboys-runs-table-body");
  const countEl = document.getElementById("mb-today-runs-count");
  if (!tbody) return;

  const runs = todayOrders.filter(o => o.fulfillment === "Entrega" && o.deliveryMan);
  if (countEl) countEl.textContent = runs.length;

  if (runs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2rem; color: #94a3b8; font-style: italic;">
          Nenhum pedido despachado com motoboy atribuído hoje ainda.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = runs.map(o => {
    const timeStr = o.createdAt ? new Date(o.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--";
    const cleanPhone = (o.deliveryMan?.phone || "").replace(/\D/g, "");
    const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : "javascript:void(0)";
    const feeVal = Number(o.deliveryMan?.fee || 7);
    const totalVal = Number(o.totalAmount || 0);

    return `
      <tr>
        <td><strong>${timeStr}</strong></td>
        <td><span class="order-id-badge">#${o.id}</span></td>
        <td>
          <div style="font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 5px;">
            <i class="fa-solid fa-motorcycle" style="color: #d97706;"></i> ${o.deliveryMan.name}
          </div>
          <small style="color: #64748b;">${o.deliveryMan.vehicle || 'Moto'}</small>
        </td>
        <td>
          <div style="font-weight: 600; color: #1e293b;">${o.customer?.name || "Cliente"}</div>
          <small style="color: #64748b; display: block; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${o.customer?.address || ''}">
            ${o.customer?.address || "Retirada"}
          </small>
        </td>
        <td>
          <span class="badge-status-order status-prep">${o.paymentMethod || "Não informado"}</span>
        </td>
        <td>
          <strong style="color: #d97706;">${formatBRL(feeVal)}</strong>
        </td>
        <td>
          <strong style="color: #0f172a;">${formatBRL(totalVal)}</strong>
        </td>
        <td>
          <span class="badge-status-order status-ready">Em Entrega</span>
        </td>
        <td class="text-right">
          ${cleanPhone ? `
            <a href="${waLink}" target="_blank" class="btn-action-icon" style="color: #059669; display: inline-flex;" title="Falar no WhatsApp">
              <i class="fa-brands fa-whatsapp"></i>
            </a>
          ` : ''}
          <button type="button" class="btn-action-icon" onclick="openOrderDetails('${o.id}')" title="Ver pedido completo">
            <i class="fa-solid fa-eye"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

window.setMotoboyStatusFilter = function(filter) {
  currentMotoboyFilter = filter;
  ["all", "active", "paused"].forEach(f => {
    const btn = document.getElementById(`mb-filter-${f}`);
    if (btn) btn.classList.toggle("active", f === filter);
  });
  renderMotoboysView();
};

window.filterMotoboysList = function() {
  renderMotoboysView();
};

// ==========================================
// MODAL DE CADASTRO / EDIÇÃO DE MOTOBOY
// ==========================================
window.toggleWorkDayChip = function(dayIndex) {
  dayIndex = Number(dayIndex);
  if (modalSelectedWorkDays.includes(dayIndex)) {
    if (modalSelectedWorkDays.length > 1) {
      modalSelectedWorkDays = modalSelectedWorkDays.filter(d => d !== dayIndex);
    } else {
      showToastNotification("O entregador deve trabalhar em pelo menos 1 dia da semana.", "warning");
      return;
    }
  } else {
    modalSelectedWorkDays.push(dayIndex);
    modalSelectedWorkDays.sort((a, b) => a - b);
  }
  updateWorkDaysChipsUI();
};

window.setWorkDaysPreset = function(preset) {
  if (preset === "all") {
    modalSelectedWorkDays = [0, 1, 2, 3, 4, 5, 6];
  } else if (preset === "weekdays") {
    modalSelectedWorkDays = [1, 2, 3, 4, 5];
  } else if (preset === "weekend") {
    modalSelectedWorkDays = [5, 6, 0];
  }
  updateWorkDaysChipsUI();
};

function updateWorkDaysChipsUI() {
  const container = document.getElementById("motoboy-days-chips-wrap");
  if (!container) return;
  const buttons = container.querySelectorAll(".btn-day-chip");
  buttons.forEach(btn => {
    const day = Number(btn.getAttribute("data-day"));
    btn.classList.toggle("active", modalSelectedWorkDays.includes(day));
  });
}

window.openMotoboyModal = function(motoboyId) {
  const modal = document.getElementById("modal-motoboy");
  const backdrop = document.getElementById("modal-motoboy-backdrop");
  const title = document.getElementById("modal-motoboy-title");
  const idInput = document.getElementById("motoboy-id");
  const nameInput = document.getElementById("motoboy-name");
  const phoneInput = document.getElementById("motoboy-phone");
  const vehicleInput = document.getElementById("motoboy-vehicle");
  const dailyRateInput = document.getElementById("motoboy-daily-rate");
  const feeInput = document.getElementById("motoboy-fee");
  const pixTypeSelect = document.getElementById("motoboy-pix-type");
  const pixKeyInput = document.getElementById("motoboy-pix-key");
  const statusSelect = document.getElementById("motoboy-status");
  const notesInput = document.getElementById("motoboy-notes");

  if (!modal || !backdrop) return;

  if (motoboyId) {
    const motoboy = VIPDatabase.getMotoboyById(motoboyId);
    if (!motoboy) return;
    title.innerHTML = `<i class="fa-solid fa-motorcycle" style="color: #d97706;"></i> Editar Entregador`;
    idInput.value = motoboy.id;
    nameInput.value = motoboy.name || "";
    phoneInput.value = motoboy.phone || "";
    vehicleInput.value = motoboy.vehicle || "";
    if (dailyRateInput) dailyRateInput.value = (motoboy.dailyRate !== undefined ? motoboy.dailyRate : 0.00).toFixed(2);
    feeInput.value = (motoboy.defaultFee !== undefined ? motoboy.defaultFee : 7.00).toFixed(2);
    pixTypeSelect.value = motoboy.pixType || "Telefone";
    pixKeyInput.value = motoboy.pixKey || "";
    statusSelect.value = motoboy.active ? "active" : "paused";
    notesInput.value = motoboy.notes || "";

    modalSelectedWorkDays = Array.isArray(motoboy.workDays) && motoboy.workDays.length > 0 
      ? [...motoboy.workDays] 
      : [0, 1, 2, 3, 4, 5, 6];
  } else {
    title.innerHTML = `<i class="fa-solid fa-motorcycle" style="color: #d97706;"></i> Cadastrar Novo Entregador`;
    idInput.value = "";
    nameInput.value = "";
    phoneInput.value = "";
    vehicleInput.value = "";
    if (dailyRateInput) dailyRateInput.value = "50.00";
    feeInput.value = "7.00";
    pixTypeSelect.value = "Telefone";
    pixKeyInput.value = "";
    statusSelect.value = "active";
    notesInput.value = "";
    modalSelectedWorkDays = [0, 1, 2, 3, 4, 5, 6];
  }

  updateWorkDaysChipsUI();

  backdrop.style.display = "block";
  modal.style.display = "block";
  setTimeout(() => {
    backdrop.classList.add("active");
    modal.classList.add("active");
    nameInput?.focus();
  }, 10);
};

window.closeMotoboyModal = function() {
  const modal = document.getElementById("modal-motoboy");
  const backdrop = document.getElementById("modal-motoboy-backdrop");
  if (modal) modal.classList.remove("active");
  if (backdrop) backdrop.classList.remove("active");
  setTimeout(() => {
    if (modal) modal.style.display = "none";
    if (backdrop) backdrop.style.display = "none";
  }, 200);
};

window.saveMotoboyFromModal = function() {
  const id = document.getElementById("motoboy-id").value;
  const name = document.getElementById("motoboy-name").value.trim();
  const phone = document.getElementById("motoboy-phone").value.trim();
  const vehicle = document.getElementById("motoboy-vehicle").value.trim();
  const dailyRate = parseFloat(document.getElementById("motoboy-daily-rate")?.value) || 0.00;
  const fee = parseFloat(document.getElementById("motoboy-fee").value) || 7.00;
  const pixType = document.getElementById("motoboy-pix-type").value;
  const pixKey = document.getElementById("motoboy-pix-key").value.trim();
  const status = document.getElementById("motoboy-status").value;
  const notes = document.getElementById("motoboy-notes").value.trim();

  if (!name) {
    showToastNotification("Por favor, preencha o nome do entregador.", "error");
    return;
  }

  const workDaysToSave = modalSelectedWorkDays.length > 0 ? [...modalSelectedWorkDays] : [0, 1, 2, 3, 4, 5, 6];

  const payload = {
    name,
    phone,
    vehicle,
    dailyRate,
    defaultFee: fee,
    workDays: workDaysToSave,
    pixType,
    pixKey,
    active: status === "active",
    notes
  };

  if (id) {
    VIPDatabase.updateMotoboy(id, payload);
    showToastNotification(`Entregador "${name}" atualizado com sucesso!`);
  } else {
    VIPDatabase.addMotoboy(payload);
    showToastNotification(`Entregador "${name}" cadastrado com sucesso!`);
  }

  closeMotoboyModal();
  renderMotoboysView();
};

window.toggleMotoboyStatus = function(id) {
  const motoboy = VIPDatabase.getMotoboyById(id);
  if (!motoboy) return;
  const newStatus = !motoboy.active;
  VIPDatabase.updateMotoboy(id, { active: newStatus });
  showToastNotification(`Entregador "${motoboy.name}" agora está ${newStatus ? 'ATIVO' : 'EM PAUSA'}.`);
  renderMotoboysView();
};

window.deleteMotoboyConfirm = function(id) {
  const motoboy = VIPDatabase.getMotoboyById(id);
  if (!motoboy) return;
  if (confirm(`Deseja realmente remover o entregador "${motoboy.name}" do sistema?`)) {
    VIPDatabase.deleteMotoboy(id);
    showToastNotification(`Entregador removido com sucesso.`);
    renderMotoboysView();
  }
};

window.copyMotoboyPixKey = function(key) {
  if (!key) return;
  navigator.clipboard.writeText(key).then(() => {
    showToastNotification(`Chave PIX "${key}" copiada com sucesso!`);
  }).catch(() => {
    prompt("Copie a chave PIX abaixo:", key);
  });
};

// ==========================================
// MODAL DE DESPACHO RÁPIDO DO PEDIDO (KANBAN)
// ==========================================
let activeDispatchOrderId = null;

window.openDispatchMotoboyModal = function(orderId) {
  activeDispatchOrderId = orderId;
  const orders = VIPDatabase.getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const modal = document.getElementById("modal-dispatch-motoboy");
  const backdrop = document.getElementById("modal-dispatch-motoboy-backdrop");
  if (!modal || !backdrop) return;

  const labelId = document.getElementById("dispatch-order-id-label");
  const inputId = document.getElementById("dispatch-order-id");
  const custName = document.getElementById("dispatch-customer-name");
  const custAddr = document.getElementById("dispatch-customer-address");
  const payBadge = document.getElementById("dispatch-payment-badge");
  const changeAlertWrap = document.getElementById("dispatch-change-alert-wrap");
  const weekdayBadge = document.getElementById("dispatch-weekday-badge");

  if (labelId) labelId.textContent = `#${order.id}`;
  if (inputId) inputId.value = order.id;
  if (custName) custName.textContent = order.customer?.name || "Cliente";
  if (custAddr) custAddr.textContent = order.customer?.address || "Endereço não informado";

  // Identificação do dia atual
  const currentDayIdx = new Date().getDay();
  const todayName = WEEKDAY_NAMES_PT[currentDayIdx];
  if (weekdayBadge) {
    weekdayBadge.innerHTML = `<i class="fa-solid fa-calendar-day"></i> Hoje: <strong>${todayName}</strong>`;
  }

  // Pagamento & Troco
  const payInfo = getMotoboyPaymentInfo(order);
  if (payBadge) {
    payBadge.textContent = payInfo.badgeText || order.paymentMethod || "Não informado";
    payBadge.className = `badge-status-order ${payInfo.paymentType === 'dinheiro' ? 'status-delay' : 'status-prep'}`;
  }

  if (changeAlertWrap) {
    if (order.cashChangeFor) {
      changeAlertWrap.style.display = "block";
      changeAlertWrap.innerHTML = `⚠️ <strong>LEVAR TROCO:</strong> Troco para ${order.cashChangeFor}! Total a cobrar: ${formatBRL(order.totalAmount || 0)}`;
    } else {
      changeAlertWrap.style.display = "none";
    }
  }

  // Popula opções de motoboy respeitando a escala do dia
  refreshDispatchMotoboyOptions(order);

  backdrop.style.display = "block";
  modal.style.display = "block";
  setTimeout(() => {
    backdrop.classList.add("active");
    modal.classList.add("active");
  }, 10);
};

window.refreshDispatchMotoboyOptions = function(existingOrder) {
  const selectMb = document.getElementById("dispatch-motoboy-select");
  const feeInput = document.getElementById("dispatch-fee-input");
  const filterTodayCheckbox = document.getElementById("dispatch-filter-today-only");
  if (!selectMb) return;

  const orderId = activeDispatchOrderId || document.getElementById("dispatch-order-id")?.value;
  const order = existingOrder || (VIPDatabase.getOrders().find(o => o.id === orderId));

  const motoboys = VIPDatabase.getMotoboys();
  const activeMotoboys = motoboys.filter(m => m.active);
  const currentDayIdx = new Date().getDay();
  const todayName = WEEKDAY_NAMES_PT[currentDayIdx];

  const filterTodayOnly = filterTodayCheckbox ? filterTodayCheckbox.checked : true;

  // Filtra motoboys que trabalham no dia de hoje se o filtro estiver ativo
  const candidateMotoboys = filterTodayOnly
    ? activeMotoboys.filter(m => {
        const workDays = Array.isArray(m.workDays) && m.workDays.length > 0 ? m.workDays : [0, 1, 2, 3, 4, 5, 6];
        return workDays.includes(currentDayIdx);
      })
    : activeMotoboys;

  // Calcula corridas de hoje para mostrar no select
  const orders = VIPDatabase.getOrders();
  const todayStr = getTodayISODateString();
  const runsCountMap = {};
  orders.forEach(o => {
    if (o.deliveryMan && o.deliveryMan.id && o.createdAt) {
      const d = new Date(o.createdAt);
      const oDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (oDate === todayStr) {
        runsCountMap[o.deliveryMan.id] = (runsCountMap[o.deliveryMan.id] || 0) + 1;
      }
    }
  });

  if (candidateMotoboys.length === 0) {
    if (filterTodayOnly && activeMotoboys.length > 0) {
      selectMb.innerHTML = `<option value="">⚠️ Nenhum entregador escalado para ${todayName} (Desmarque o filtro acima para ver todos)</option>`;
    } else {
      selectMb.innerHTML = `<option value="">Nenhum entregador ativo cadastrado</option>`;
    }
    if (feeInput) feeInput.value = "7.00";
  } else {
    selectMb.innerHTML = candidateMotoboys.map(m => {
      const runs = runsCountMap[m.id] || 0;
      const isSelected = (order && order.deliveryMan && order.deliveryMan.id === m.id);
      const fee = m.defaultFee !== undefined ? m.defaultFee : 7.00;
      return `<option value="${m.id}" data-fee="${fee}" ${isSelected ? 'selected' : ''}>🏍️ ${m.name} - ${m.vehicle || 'Moto'} (Tx: ${formatBRL(fee)} | ${runs} corrida${runs === 1 ? '' : 's'} hoje)</option>`;
    }).join("");

    // Atualiza automaticamente o campo de taxa com o valor do motoboy selecionado
    const selectedOption = selectMb.options[selectMb.selectedIndex];
    if (selectedOption && selectedOption.value) {
      const defaultFee = parseFloat(selectedOption.getAttribute("data-fee")) || 7.00;
      if (feeInput) {
        feeInput.value = (order && order.deliveryMan && order.deliveryMan.fee !== undefined)
          ? Number(order.deliveryMan.fee).toFixed(2)
          : defaultFee.toFixed(2);
      }
    }
  }
};

window.closeDispatchMotoboyModal = function() {
  const modal = document.getElementById("modal-dispatch-motoboy");
  const backdrop = document.getElementById("modal-dispatch-motoboy-backdrop");
  if (modal) modal.classList.remove("active");
  if (backdrop) backdrop.classList.remove("active");
  setTimeout(() => {
    if (modal) modal.style.display = "none";
    if (backdrop) backdrop.style.display = "none";
    activeDispatchOrderId = null;
  }, 200);
};

window.onDispatchMotoboyChanged = function() {
  const selectMb = document.getElementById("dispatch-motoboy-select");
  const feeInput = document.getElementById("dispatch-fee-input");
  if (!selectMb || !feeInput) return;
  const opt = selectMb.options[selectMb.selectedIndex];
  if (opt && opt.value) {
    const fee = parseFloat(opt.getAttribute("data-fee")) || 7.00;
    feeInput.value = fee.toFixed(2);
  }
};

window.confirmDispatchMotoboy = async function() {
  const orderId = activeDispatchOrderId || document.getElementById("dispatch-order-id")?.value;
  if (!orderId) return;

  const orders = VIPDatabase.getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const selectMb = document.getElementById("dispatch-motoboy-select");
  const feeInput = document.getElementById("dispatch-fee-input");
  const sendWaCheckbox = document.getElementById("dispatch-send-whatsapp");

  const mbId = selectMb?.value;
  const feeVal = parseFloat(feeInput?.value) || 7.00;
  const motoboy = VIPDatabase.getMotoboyById(mbId);

  if (motoboy) {
    order.deliveryMan = {
      id: motoboy.id,
      name: motoboy.name,
      phone: motoboy.phone,
      vehicle: motoboy.vehicle,
      fee: feeVal,
      dailyRate: motoboy.dailyRate || 0,
      pixKey: motoboy.pixKey,
      pixType: motoboy.pixType,
      dispatchedAt: Date.now()
    };
  }

  order.status = "pronto";
  VIPDatabase.updateOrderStatus(orderId, "pronto", { deliveryMan: order.deliveryMan });

  // Se o checkbox de WhatsApp estiver ativo, dispara mensagem para o motoboy
  if (sendWaCheckbox?.checked && motoboy && motoboy.phone) {
    const cleanPhone = motoboy.phone.replace(/\D/g, "");
    if (cleanPhone) {
      const cleanAddress = encodeURIComponent(order.customer?.address || "");
      const gmapsLink = `https://www.google.com/maps/search/?api=1&query=${cleanAddress}`;
      const payInfo = getMotoboyPaymentInfo(order);

      let trocoMsg = "";
      if (order.cashChangeFor) {
        trocoMsg = `\n⚠️ *LEVAR TROCO:* Troco para ${order.cashChangeFor}!\n💰 *Total a Cobrar:* ${formatBRL(order.totalAmount || 0)}`;
      }

      const waMsg = `🛵 *NOVA CORRIDA - SALGADOS VIP* 🛵\n` +
        `📦 *Pedido:* #${order.id}\n` +
        `👤 *Cliente:* ${order.customer?.name || 'Cliente'}\n` +
        `📞 *Telefone:* ${order.customer?.phone || '--'}\n` +
        `📍 *Endereço:* ${order.customer?.address || 'Retirada'}\n` +
        `🧭 *Abrir Rota no Google Maps:*\n${gmapsLink}\n\n` +
        `💵 *Forma de Pagamento:* ${order.paymentMethod || 'Não informado'}${trocoMsg}\n` +
        `💰 *Total do Pedido:* ${formatBRL(order.totalAmount || 0)}\n` +
        `🏍️ *Sua Taxa nesta Corrida:* ${formatBRL(feeVal)}\n\n` +
        `_Obrigado e boa corrida com segurança! 🚀_`;

      let sentSilently = false;

      if (window.VIPWhatsAppGateway) {
        try {
          const status = await VIPWhatsAppGateway.checkStatus();
          if (status && status.connected) {
            await VIPWhatsAppGateway.sendMessage(cleanPhone, waMsg);
            sentSilently = true;
          }
        } catch (e) {
          console.warn("[Despacho Motoboy] Envio silencioso falhou:", e);
        }
      }

      if (!sentSilently) {
        window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(waMsg)}`, "_blank");
      }
    }
  }

  closeDispatchMotoboyModal();
  renderLiveOrders();
  if (typeof renderCashClosingView === "function" && document.getElementById("tab-caixa")?.classList.contains("active")) {
    renderCashClosingView();
  }
  showToastNotification(`Pedido #${orderId} despachado com sucesso com ${motoboy ? motoboy.name : 'entregador'}!`);
};

window.confirmDispatchWithoutMotoboy = function() {
  const orderId = activeDispatchOrderId || document.getElementById("dispatch-order-id")?.value;
  if (!orderId) return;

  VIPDatabase.updateOrderStatus(orderId, "pronto");
  closeDispatchMotoboyModal();
  renderLiveOrders();
  showToastNotification(`Pedido #${orderId} pronto para entrega/retirada.`);
};

// ==============================================================================
// 2.11 CRM & CONTROLE DE GASTOS COM MOTOBOYS POR PERÍODO
// ==============================================================================
window.initMotoboysCRMFilters = function() {
  const startInput = document.getElementById("mb-crm-date-start");
  const endInput = document.getElementById("mb-crm-date-end");
  const selectMb = document.getElementById("mb-crm-select-motoboy");

  if (!startInput || !endInput) return;

  if (!mbCrmPeriodState.startDate || !mbCrmPeriodState.endDate) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    // Padrão: início do mês atual até hoje
    const firstDayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
    mbCrmPeriodState.startDate = firstDayStr;
    mbCrmPeriodState.endDate = todayStr;
  }

  startInput.value = mbCrmPeriodState.startDate;
  endInput.value = mbCrmPeriodState.endDate;

  if (selectMb) {
    const motoboys = VIPDatabase.getMotoboys();
    const currentVal = selectMb.value || mbCrmPeriodState.motoboyId || "all";
    selectMb.innerHTML = `<option value="all">🛵 Todos os Entregadores</option>` +
      motoboys.map(m => `<option value="${m.id}" ${currentVal === m.id ? 'selected' : ''}>${m.name} (${m.vehicle || 'Moto'})</option>`).join("");
  }
};

window.setMotoboyCRMQuickPeriod = function(periodKey) {
  const today = new Date();
  let start = new Date();
  let end = new Date();

  if (periodKey === "today") {
    // hoje até hoje
  } else if (periodKey === "yesterday") {
    start.setDate(today.getDate() - 1);
    end.setDate(today.getDate() - 1);
  } else if (periodKey === "this_week") {
    // Segunda-feira desta semana
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
  } else if (periodKey === "last_7_days") {
    start.setDate(today.getDate() - 6);
  } else if (periodKey === "this_month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (periodKey === "last_month") {
    start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    end = new Date(today.getFullYear(), today.getMonth(), 0);
  }

  const toIsoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  mbCrmPeriodState.startDate = toIsoDate(start);
  mbCrmPeriodState.endDate = toIsoDate(end);

  const startInput = document.getElementById("mb-crm-date-start");
  const endInput = document.getElementById("mb-crm-date-end");
  if (startInput) startInput.value = mbCrmPeriodState.startDate;
  if (endInput) endInput.value = mbCrmPeriodState.endDate;

  // Atualiza classe ativa nos botões
  const periodButtons = document.querySelectorAll(".mb-crm-quick-periods .btn-filter-pill");
  periodButtons.forEach(btn => {
    const text = btn.textContent.toLowerCase();
    const match = (periodKey === "today" && text.includes("hoje")) ||
                  (periodKey === "yesterday" && text.includes("ontem")) ||
                  (periodKey === "this_week" && text.includes("esta semana")) ||
                  (periodKey === "last_7_days" && text.includes("7 dias")) ||
                  (periodKey === "this_month" && text.includes("este mês")) ||
                  (periodKey === "last_month" && text.includes("mês anterior"));
    btn.classList.toggle("active", match);
  });

  renderMotoboysCRMPeriodView();
};

window.renderMotoboysCRMPeriodView = function() {
  const startInput = document.getElementById("mb-crm-date-start");
  const endInput = document.getElementById("mb-crm-date-end");
  const selectMb = document.getElementById("mb-crm-select-motoboy");

  if (startInput && startInput.value) mbCrmPeriodState.startDate = startInput.value;
  if (endInput && endInput.value) mbCrmPeriodState.endDate = endInput.value;
  if (selectMb) mbCrmPeriodState.motoboyId = selectMb.value;

  const startDateStr = mbCrmPeriodState.startDate || getTodayISODateString();
  const endDateStr = mbCrmPeriodState.endDate || getTodayISODateString();
  const selectedMotoboyId = mbCrmPeriodState.motoboyId || "all";

  const allOrders = VIPDatabase.getOrders();
  const allMotoboys = VIPDatabase.getMotoboys();

  // Filtra pedidos do período com motoboy
  const periodOrders = allOrders.filter(o => {
    if (!o.createdAt || o.status === "cancelado" || o.fulfillment !== "Entrega" || !o.deliveryMan) {
      return false;
    }
    const d = new Date(o.createdAt);
    const orderDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (orderDateStr < startDateStr || orderDateStr > endDateStr) {
      return false;
    }
    if (selectedMotoboyId !== "all" && o.deliveryMan.id !== selectedMotoboyId) {
      return false;
    }
    return true;
  });

  // Agrupa dados por motoboy
  const statsMap = {};
  allMotoboys.forEach(m => {
    if (selectedMotoboyId === "all" || m.id === selectedMotoboyId) {
      statsMap[m.id] = {
        motoboy: m,
        uniqueDates: new Set(),
        runsCount: 0,
        totalFees: 0,
        cashCollected: 0,
        orders: []
      };
    }
  });

  periodOrders.forEach(o => {
    const mbId = o.deliveryMan.id;
    if (!statsMap[mbId]) {
      const found = allMotoboys.find(m => m.id === mbId) || {
        id: mbId,
        name: o.deliveryMan.name || "Entregador",
        dailyRate: o.deliveryMan.dailyRate || 0,
        defaultFee: o.deliveryMan.fee || 7,
        phone: o.deliveryMan.phone || "",
        pixKey: o.deliveryMan.pixKey || ""
      };
      statsMap[mbId] = {
        motoboy: found,
        uniqueDates: new Set(),
        runsCount: 0,
        totalFees: 0,
        cashCollected: 0,
        orders: []
      };
    }

    const st = statsMap[mbId];
    const d = new Date(o.createdAt);
    const orderDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    st.uniqueDates.add(orderDateStr);
    st.runsCount++;
    const fee = Number(o.deliveryMan.fee !== undefined ? o.deliveryMan.fee : (st.motoboy.defaultFee || 7));
    st.totalFees += fee;
    st.orders.push(o);

    const pay = String(o.paymentMethod || "").toLowerCase();
    if (pay.includes("dinheiro") || pay.includes("especie") || pay.includes("espécie")) {
      st.cashCollected += Number(o.totalAmount || o.total || 0);
    }
  });

  // Totais Gerais do Período
  let grandTotalRuns = 0;
  let grandTotalDays = 0;
  let grandTotalDaily = 0;
  let grandTotalFees = 0;
  let grandTotalCash = 0;

  Object.values(statsMap).forEach(st => {
    const days = st.uniqueDates.size;
    const dailyRate = Number(st.motoboy.dailyRate || 0);
    const totalDaily = days * dailyRate;

    grandTotalRuns += st.runsCount;
    grandTotalDays += days;
    grandTotalDaily += totalDaily;
    grandTotalFees += st.totalFees;
    grandTotalCash += st.cashCollected;
  });

  const grandTotalCost = grandTotalDaily + grandTotalFees;
  const grandNetBalance = grandTotalCost - grandTotalCash;

  // Atualiza KPIs do CRM
  const elKpiRuns = document.getElementById("mb-crm-kpi-runs");
  const elKpiDays = document.getElementById("mb-crm-kpi-days");
  const elKpiDaily = document.getElementById("mb-crm-kpi-daily-total");
  const elKpiFees = document.getElementById("mb-crm-kpi-fees-total");
  const elKpiCost = document.getElementById("mb-crm-kpi-cost-total");
  const elKpiCash = document.getElementById("mb-crm-kpi-cash-total");
  const elKpiBalanceVal = document.getElementById("mb-crm-kpi-balance-val");
  const elKpiBalanceLbl = document.getElementById("mb-crm-kpi-balance-lbl");
  const cardBalance = document.getElementById("mb-crm-kpi-balance-card");
  const iconBalance = document.getElementById("mb-crm-kpi-balance-icon");

  if (elKpiRuns) elKpiRuns.textContent = grandTotalRuns;
  if (elKpiDays) elKpiDays.textContent = grandTotalDays;
  if (elKpiDaily) elKpiDaily.textContent = formatBRL(grandTotalDaily);
  if (elKpiFees) elKpiFees.textContent = formatBRL(grandTotalFees);
  if (elKpiCost) elKpiCost.textContent = formatBRL(grandTotalCost);
  if (elKpiCash) elKpiCash.textContent = formatBRL(grandTotalCash);

  if (elKpiBalanceVal && elKpiBalanceLbl && cardBalance && iconBalance) {
    if (grandNetBalance > 0) {
      elKpiBalanceVal.textContent = formatBRL(grandNetBalance);
      elKpiBalanceVal.style.color = "#047857";
      elKpiBalanceLbl.textContent = "A PAGAR AOS MOTOBOYS (Loja Deve)";
      cardBalance.style.borderColor = "#10b981";
      iconBalance.style.color = "#047857";
      iconBalance.style.background = "rgba(16, 185, 129, 0.15)";
    } else if (grandNetBalance < 0) {
      elKpiBalanceVal.textContent = formatBRL(Math.abs(grandNetBalance));
      elKpiBalanceVal.style.color = "#b91c1c";
      elKpiBalanceLbl.textContent = "A RECEBER DOS MOTOBOYS (Repasse ao Caixa)";
      cardBalance.style.borderColor = "#ef4444";
      iconBalance.style.color = "#b91c1c";
      iconBalance.style.background = "rgba(239, 68, 68, 0.15)";
    } else {
      elKpiBalanceVal.textContent = "R$ 0,00";
      elKpiBalanceVal.style.color = "#475569";
      elKpiBalanceLbl.textContent = "ACERTO 100% QUITADO / ZERADO";
      cardBalance.style.borderColor = "#cbd5e1";
      iconBalance.style.color = "#475569";
      iconBalance.style.background = "rgba(100, 116, 139, 0.15)";
    }
  }

  // Renderiza Tabela Consolidada por Entregador
  const tbodyConsolidated = document.getElementById("mb-crm-consolidated-tbody");
  if (tbodyConsolidated) {
    const list = Object.values(statsMap);
    if (list.length === 0) {
      tbodyConsolidated.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2rem; color: #94a3b8;">Nenhum entregador encontrado para este período.</td></tr>`;
    } else {
      tbodyConsolidated.innerHTML = list.map(st => {
        const m = st.motoboy;
        const days = st.uniqueDates.size;
        const dailyRate = Number(m.dailyRate || 0);
        const totalDaily = days * dailyRate;
        const totalCost = totalDaily + st.totalFees;
        const netBalance = totalCost - st.cashCollected;
        const cleanPhone = (m.phone || "").replace(/\D/g, "");

        let saldoBadge = "";
        if (netBalance > 0) {
          saldoBadge = `<span class="badge-saldo-pay" style="color: #047857; background: #dcfce7;">A Pagar: ${formatBRL(netBalance)}</span>`;
        } else if (netBalance < 0) {
          saldoBadge = `<span class="badge-saldo-pay" style="color: #b91c1c; background: #fee2e2;">Receber: ${formatBRL(Math.abs(netBalance))}</span>`;
        } else {
          saldoBadge = `<span class="badge-saldo-even">Quitado (R$ 0)</span>`;
        }

        return `
          <tr>
            <td>
              <div style="font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-motorcycle" style="color: #d97706;"></i> ${m.name}
              </div>
              <small style="color: #64748b;">${m.vehicle || 'Moto'} ${m.phone ? `| ${m.phone}` : ''}</small>
            </td>
            <td><strong>${days}</strong> dia${days === 1 ? '' : 's'}</td>
            <td>${formatBRL(dailyRate)}</td>
            <td><strong style="color: #0284c7;">${formatBRL(totalDaily)}</strong></td>
            <td><strong>${st.runsCount}</strong></td>
            <td><strong style="color: #047857;">${formatBRL(st.totalFees)}</strong></td>
            <td><strong style="color: #4f46e5;">${formatBRL(totalCost)}</strong></td>
            <td><strong style="color: #0f172a;">${formatBRL(st.cashCollected)}</strong></td>
            <td>${saldoBadge}</td>
            <td class="text-right">
              <button type="button" class="btn-action-icon" onclick="printMotoboysCRMReportThermal('${m.id}')" title="Imprimir extrato térmico 80mm deste entregador">
                <i class="fa-solid fa-print"></i>
              </button>
              ${cleanPhone ? `
                <button type="button" class="btn-action-icon" style="color: #059669;" onclick="sendMotoboyCRMWhatsApp('${m.id}')" title="Enviar resumo pelo WhatsApp">
                  <i class="fa-brands fa-whatsapp"></i>
                </button>
              ` : ''}
              ${m.pixKey ? `
                <button type="button" class="btn-action-icon" style="color: #0284c7;" onclick="copyMotoboyPixKey('${m.pixKey}')" title="Copiar Chave PIX">
                  <i class="fa-solid fa-copy"></i>
                </button>
              ` : ''}
            </td>
          </tr>
        `;
      }).join("");
    }
  }

  // Renderiza Tabela de Detalhamento das Corridas do Período
  renderMotoboyCRMRunsDetailTable(periodOrders);
};

function renderMotoboyCRMRunsDetailTable(orders) {
  const tbody = document.getElementById("mb-crm-runs-detail-tbody");
  const countEl = document.getElementById("mb-crm-runs-detail-count");
  if (!tbody) return;

  if (countEl) countEl.textContent = orders.length;

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2rem; color: #94a3b8; font-style: italic;">Nenhuma corrida despachada no período selecionado.</td></tr>`;
    return;
  }

  // Ordena por data decrescente
  const sorted = [...orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  tbody.innerHTML = sorted.map(o => {
    const d = new Date(o.createdAt);
    const dateFormatted = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const timeFormatted = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const feeVal = Number(o.deliveryMan?.fee || 7);
    const totalVal = Number(o.totalAmount || 0);

    const pay = String(o.paymentMethod || "").toLowerCase();
    const isCash = pay.includes("dinheiro") || pay.includes("especie") || pay.includes("espécie");

    return `
      <tr>
        <td><strong>${dateFormatted}</strong></td>
        <td>${timeFormatted}</td>
        <td><span class="order-id-badge">#${o.id}</span></td>
        <td>
          <span style="font-weight: 700; color: #0f172a;"><i class="fa-solid fa-motorcycle" style="color: #d97706;"></i> ${o.deliveryMan.name}</span>
        </td>
        <td>
          <div style="font-weight: 600; color: #1e293b;">${o.customer?.name || "Cliente"}</div>
          <small style="color: #64748b; display: block; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${o.customer?.address || ''}">
            ${o.customer?.address || "Retirada"}
          </small>
        </td>
        <td>
          <span class="badge-status-order status-prep">${o.paymentMethod || "Não informado"}</span>
        </td>
        <td>
          ${isCash ? `<strong style="color: #0f172a;">💵 ${formatBRL(totalVal)}</strong>` : `<span style="color: #94a3b8;">--</span>`}
        </td>
        <td><strong style="color: #047857;">${formatBRL(feeVal)}</strong></td>
        <td><strong style="color: #1e293b;">${formatBRL(totalVal)}</strong></td>
        <td class="text-right">
          <button type="button" class="btn-action-icon" onclick="openOrderDetails('${o.id}')" title="Ver detalhes do pedido">
            <i class="fa-solid fa-eye"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

window.filterMotoboyCRMTable = function() {
  const input = document.getElementById("mb-crm-table-search");
  const term = (input?.value || "").toLowerCase().trim();
  const tbody = document.getElementById("mb-crm-runs-detail-tbody");
  if (!tbody) return;

  const rows = tbody.querySelectorAll("tr");
  rows.forEach(tr => {
    const text = tr.textContent.toLowerCase();
    tr.style.display = text.includes(term) ? "" : "none";
  });
};

// Impressão Térmica 80mm do Extrato do Período
window.printMotoboysCRMReportThermal = function(specificMotoboyId) {
  const startDateStr = mbCrmPeriodState.startDate || getTodayISODateString();
  const endDateStr = mbCrmPeriodState.endDate || getTodayISODateString();
  const mbIdFilter = specificMotoboyId || mbCrmPeriodState.motoboyId || "all";

  const allOrders = VIPDatabase.getOrders();
  const allMotoboys = VIPDatabase.getMotoboys();

  const periodOrders = allOrders.filter(o => {
    if (!o.createdAt || o.status === "cancelado" || o.fulfillment !== "Entrega" || !o.deliveryMan) return false;
    const d = new Date(o.createdAt);
    const oDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (oDate < startDateStr || oDate > endDateStr) return false;
    if (mbIdFilter !== "all" && o.deliveryMan.id !== mbIdFilter) return false;
    return true;
  });

  const statsMap = {};
  allMotoboys.forEach(m => {
    if (mbIdFilter === "all" || m.id === mbIdFilter) {
      statsMap[m.id] = {
        motoboy: m,
        uniqueDates: new Set(),
        runsCount: 0,
        totalFees: 0,
        cashCollected: 0,
        runs: []
      };
    }
  });

  periodOrders.forEach(o => {
    const mbId = o.deliveryMan.id;
    if (statsMap[mbId]) {
      const st = statsMap[mbId];
      const d = new Date(o.createdAt);
      const oDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      st.uniqueDates.add(oDate);
      st.runsCount++;
      const fee = Number(o.deliveryMan.fee !== undefined ? o.deliveryMan.fee : (st.motoboy.defaultFee || 7));
      st.totalFees += fee;
      st.runs.push(o);

      const pay = String(o.paymentMethod || "").toLowerCase();
      if (pay.includes("dinheiro") || pay.includes("especie") || pay.includes("espécie")) {
        st.cashCollected += Number(o.totalAmount || o.total || 0);
      }
    }
  });

  const receiptArea = document.getElementById("thermal-receipt-area");
  if (!receiptArea) return;

  const printerCfg = VIPDatabase.getPrinterConfig();
  const printableWidthMm = parseInt(printerCfg.printableWidthMm) || 76;
  const marginSideMm = parseInt(printerCfg.marginSideMm) !== undefined ? parseInt(printerCfg.marginSideMm) : 2;

  let totalGeneralCost = 0;
  let totalGeneralCash = 0;

  let sectionsHtml = Object.values(statsMap).map(st => {
    const m = st.motoboy;
    const days = st.uniqueDates.size;
    const dailyRate = Number(m.dailyRate || 0);
    const totalDaily = days * dailyRate;
    const totalCost = totalDaily + st.totalFees;
    const netBalance = totalCost - st.cashCollected;

    totalGeneralCost += totalCost;
    totalGeneralCash += st.cashCollected;

    let balanceStr = "";
    if (netBalance > 0) {
      balanceStr = `A PAGAR: ${formatBRL(netBalance)}`;
    } else if (netBalance < 0) {
      balanceStr = `REPASSAR AO CAIXA: ${formatBRL(Math.abs(netBalance))}`;
    } else {
      balanceStr = `QUITADO (R$ 0,00)`;
    }

    return `
      <div style="margin: 8px 0; border: 1px solid #000; padding: 6px;">
        <div style="font-weight: 900; font-size: 11pt;">🛵 ${m.name}</div>
        <div style="font-size: 8.5pt;">${m.vehicle || 'Moto'} | PIX: ${m.pixKey || '--'} (${m.pixType || 'Chave'})</div>
        <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>
        <div style="display: flex; justify-content: space-between;">
          <span>Dias Trabalhados:</span>
          <strong>${days} d (x ${formatBRL(dailyRate)}) = ${formatBRL(totalDaily)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Corridas Entregues:</span>
          <strong>${st.runsCount} (${formatBRL(st.totalFees)})</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>(+) Custo Total Loja:</span>
          <strong>${formatBRL(totalCost)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>(-) Dinheiro em Mãos:</span>
          <strong>${formatBRL(st.cashCollected)}</strong>
        </div>
        <div style="border-top: 1px solid #000; margin-top: 4px; padding-top: 3px; font-weight: 900; font-size: 10.5pt; text-align: center;">
          ${balanceStr}
        </div>
      </div>
    `;
  }).join("");

  const grandNet = totalGeneralCost - totalGeneralCash;

  receiptArea.className = "thermal-receipt-area paper-80mm";
  receiptArea.innerHTML = `
    <div style="width: 100%; max-width: ${printableWidthMm}mm; margin: 0 auto; padding: 0 ${marginSideMm}mm; box-sizing: border-box; font-family: 'Consolas', 'Courier New', monospace; font-size: 10pt; color: #000; line-height: 1.35; text-align: left;">
      <div style="text-align: center; font-weight: 900; font-size: 13pt;">*** SALGADOS VIP ***</div>
      <div style="text-align: center; font-weight: 800; font-size: 11pt; margin-bottom: 2px;">EXTRATO FINANCEIRO DE MOTOBOYS</div>
      <div style="text-align: center; font-size: 8.5pt; margin-bottom: 6px;">
        PERÍODO: ${formatISODateToBR(startDateStr)} ATÉ ${formatISODateToBR(endDateStr)}<br>
        EMISSÃO: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
      </div>
      <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>
      ${sectionsHtml || '<div style="text-align: center; padding: 10px;">Nenhuma corrida neste período.</div>'}
      <div style="border-top: 2px solid #000; margin: 8px 0 4px 0;"></div>
      <div style="display: flex; justify-content: space-between; font-weight: 800;">
        <span>TOTAL CUSTO LOJA:</span>
        <span>${formatBRL(totalGeneralCost)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: 800;">
        <span>TOTAL DINHEIRO RECEBIDO:</span>
        <span>${formatBRL(totalGeneralCash)}</span>
      </div>
      <div style="border: 2px solid #000; padding: 6px; text-align: center; margin: 8px 0; font-weight: 900; font-size: 12pt;">
        ${grandNet >= 0 ? `TOTAL A PAGAR: ${formatBRL(grandNet)}` : `TOTAL A REPASSAR AO CAIXA: ${formatBRL(Math.abs(grandNet))}`}
      </div>
      <div style="margin-top: 25px; text-align: center;">
        <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto 4px auto;"></div>
        <div style="font-size: 8.5pt;">Assinatura / Conferência</div>
      </div>
      <div style="text-align: center; font-size: 8pt; margin-top: 12px; color: #555;">
        Conferido e emitido pelo Sistema Salgados VIP
      </div>
    </div>
  `;

  setTimeout(() => {
    window.print();
  }, 300);
};

// Disparo de Extrato no WhatsApp do Motoboy
window.sendMotoboyCRMWhatsApp = async function(motoboyId) {
  const mbId = motoboyId || mbCrmPeriodState.motoboyId;
  const motoboy = VIPDatabase.getMotoboyById(mbId);

  if (!motoboy || !motoboy.phone) {
    showToastNotification("Selecione um entregador com telefone/WhatsApp cadastrado.", "warning");
    return;
  }

  const startDateStr = mbCrmPeriodState.startDate || getTodayISODateString();
  const endDateStr = mbCrmPeriodState.endDate || getTodayISODateString();

  const allOrders = VIPDatabase.getOrders();
  const periodOrders = allOrders.filter(o => {
    if (!o.createdAt || o.status === "cancelado" || o.fulfillment !== "Entrega" || !o.deliveryMan) return false;
    const d = new Date(o.createdAt);
    const oDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return oDate >= startDateStr && oDate <= endDateStr && o.deliveryMan.id === motoboy.id;
  });

  const uniqueDates = new Set();
  let totalFees = 0;
  let cashCollected = 0;

  periodOrders.forEach(o => {
    const d = new Date(o.createdAt);
    const oDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    uniqueDates.add(oDate);
    const fee = Number(o.deliveryMan.fee !== undefined ? o.deliveryMan.fee : (motoboy.defaultFee || 7));
    totalFees += fee;

    const pay = String(o.paymentMethod || "").toLowerCase();
    if (pay.includes("dinheiro") || pay.includes("especie") || pay.includes("espécie")) {
      cashCollected += Number(o.totalAmount || o.total || 0);
    }
  });

  const daysWorked = uniqueDates.size;
  const dailyRate = Number(motoboy.dailyRate || 0);
  const totalDaily = daysWorked * dailyRate;
  const totalCost = totalDaily + totalFees;
  const netBalance = totalCost - cashCollected;

  let balanceText = "";
  if (netBalance > 0) {
    balanceText = `🟢 *VALOR A RECEBER DA LOJA:* ${formatBRL(netBalance)}\n_(Será pago via Pix ou dinheiro)_`;
  } else if (netBalance < 0) {
    balanceText = `🔴 *VALOR A REPASSAR AO CAIXA:* ${formatBRL(Math.abs(netBalance))}\n_(Dinheiro físico recebido de clientes maior que suas diárias/taxas)_`;
  } else {
    balanceText = `⚪ *ACERTO 100% ZERADO / QUITADO*`;
  }

  const waMsg = `🛵 *PRESTAÇÃO DE CONTAS - SALGADOS VIP* 🛵\n` +
    `Olá, *${motoboy.name}*!\n` +
    `Segue o resumo do seu extrato de entregas:\n\n` +
    `📅 *Período:* ${formatISODateToBR(startDateStr)} até ${formatISODateToBR(endDateStr)}\n` +
    `📆 *Dias Trabalhados:* ${daysWorked} dias\n` +
    `💵 *Diárias Somadas (${formatBRL(dailyRate)}/dia):* ${formatBRL(totalDaily)}\n` +
    `📦 *Corridas Realizadas:* ${periodOrders.length} entregas\n` +
    `🏷️ *Total em Taxas de Corridas:* ${formatBRL(totalFees)}\n` +
    `💰 *Total Bruto Devido:* ${formatBRL(totalCost)}\n` +
    `💵 *Dinheiro em Mãos Recolhido de Clientes:* ${formatBRL(cashCollected)}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${balanceText}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    (motoboy.pixKey ? `🔑 *Sua Chave PIX cadastrada:* ${motoboy.pixKey} (${motoboy.pixType || 'Chave'})\n\n` : `\n`) +
    `_Qualquer dúvida, fale com a gerência do Salgados VIP. Obrigado pelo ótimo trabalho! 🚀_`;

  const cleanPhone = motoboy.phone.replace(/\D/g, "");
  let sentSilently = false;

  if (window.VIPWhatsAppGateway) {
    try {
      const status = await VIPWhatsAppGateway.checkStatus();
      if (status && status.connected) {
        await VIPWhatsAppGateway.sendMessage(cleanPhone, waMsg);
        sentSilently = true;
        showToastNotification(`Extrato enviado silenciosamente para ${motoboy.name}!`);
      }
    } catch (e) {
      console.warn("[Extrato Motoboy] Envio silencioso falhou:", e);
    }
  }

  if (!sentSilently) {
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(waMsg)}`, "_blank");
  }
};

// Exportar CSV do CRM de Motoboys
window.exportMotoboysCRMCSV = function() {
  const startDateStr = mbCrmPeriodState.startDate || getTodayISODateString();
  const endDateStr = mbCrmPeriodState.endDate || getTodayISODateString();
  const mbIdFilter = mbCrmPeriodState.motoboyId || "all";

  const allOrders = VIPDatabase.getOrders();
  const periodOrders = allOrders.filter(o => {
    if (!o.createdAt || o.status === "cancelado" || o.fulfillment !== "Entrega" || !o.deliveryMan) return false;
    const d = new Date(o.createdAt);
    const oDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (oDate < startDateStr || oDate > endDateStr) return false;
    if (mbIdFilter !== "all" && o.deliveryMan.id !== mbIdFilter) return false;
    return true;
  });

  if (periodOrders.length === 0) {
    showToastNotification("Nenhuma corrida encontrada no período para exportar.", "warning");
    return;
  }

  let csv = "\uFEFFData;Hora;Pedido;Entregador;Cliente;Telefone;Endereco;FormaPagamento;DinheiroRecolhido;TaxaCorrida;TotalPedido\n";

  periodOrders.forEach(o => {
    const d = new Date(o.createdAt);
    const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const fee = Number(o.deliveryMan?.fee || 7).toFixed(2).replace(".", ",");
    const total = Number(o.totalAmount || 0).toFixed(2).replace(".", ",");
    const pay = String(o.paymentMethod || "").toLowerCase();
    const isCash = pay.includes("dinheiro") || pay.includes("especie") || pay.includes("espécie");
    const cashVal = isCash ? total : "0,00";

    const clean = (val) => String(val || "").replace(/;/g, " ").replace(/"/g, '""').trim();

    csv += `"${dateStr}";"${timeStr}";"#${clean(o.id)}";"${clean(o.deliveryMan.name)}";"${clean(o.customer?.name)}";"${clean(o.customer?.phone)}";"${clean(o.customer?.address)}";"${clean(o.paymentMethod)}";"${cashVal}";"${fee}";"${total}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `extrato_motoboys_${startDateStr}_a_${endDateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToastNotification("Planilha de corridas exportada com sucesso!");
};

// ==============================================================================
// 2.12 ACERTO DE MOTOBOYS NO FECHAMENTO DE CAIXA
// ==============================================================================
window.renderCaixaMotoboysTable = function() {
  const tbody = document.getElementById("caixa-motoboys-table-body");
  const countEl = document.getElementById("caixa-mb-count");
  const pillsWrap = document.getElementById("caixa-motoboy-summary-pills");
  if (!tbody) return;

  const targetDateStr = currentCaixaDateStr || getTodayISODateString();
  const allOrders = VIPDatabase.getOrders();
  const motoboys = VIPDatabase.getMotoboys();

  const dayOrders = allOrders.filter(order => {
    if (!order.createdAt || order.status === "cancelado") return false;
    const d = new Date(order.createdAt);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${yr}-${mo}-${da}` === targetDateStr;
  });

  // Agrupa pedidos por entregador
  const settlements = {};
  motoboys.forEach(m => {
    settlements[m.id] = {
      id: m.id,
      name: m.name,
      vehicle: m.vehicle,
      phone: m.phone,
      pixKey: m.pixKey,
      pixType: m.pixType,
      defaultFee: m.defaultFee,
      runsCount: 0,
      totalFees: 0,
      cashCollected: 0,
      orders: []
    };
  });

  dayOrders.forEach(o => {
    if (o.deliveryMan && o.deliveryMan.id) {
      const mbId = o.deliveryMan.id;
      if (!settlements[mbId]) {
        settlements[mbId] = {
          id: mbId,
          name: o.deliveryMan.name,
          vehicle: o.deliveryMan.vehicle || "Moto",
          phone: o.deliveryMan.phone || "",
          pixKey: o.deliveryMan.pixKey || "",
          pixType: o.deliveryMan.pixType || "PIX",
          defaultFee: o.deliveryMan.fee || 7,
          runsCount: 0,
          totalFees: 0,
          cashCollected: 0,
          orders: []
        };
      }
      const item = settlements[mbId];
      item.runsCount++;
      const fee = Number(o.deliveryMan.fee !== undefined ? o.deliveryMan.fee : 7);
      item.totalFees += fee;
      item.orders.push(o);

      const pay = String(o.paymentMethod || "").toLowerCase();
      if (pay.includes("dinheiro") || pay.includes("especie") || pay.includes("espécie")) {
        item.cashCollected += Number(o.totalAmount || o.total || 0);
      }
    }
  });

  const activeSettlements = Object.values(settlements).filter(s => s.runsCount > 0);
  if (countEl) countEl.textContent = activeSettlements.length;

  // Atualiza pílulas de resumo
  let totalRuns = 0;
  let totalFees = 0;
  let totalCash = 0;

  activeSettlements.forEach(s => {
    totalRuns += s.runsCount;
    totalFees += s.totalFees;
    totalCash += s.cashCollected;
  });

  if (pillsWrap) {
    pillsWrap.innerHTML = `
      <div class="caixa-motoboy-summary-pill"><i class="fa-solid fa-boxes-stacked" style="color: #0284c7;"></i> ${totalRuns} corridas realizadas</div>
      <div class="caixa-motoboy-summary-pill"><i class="fa-solid fa-hand-holding-dollar" style="color: #d97706;"></i> ${formatBRL(totalFees)} em taxas a pagar</div>
      <div class="caixa-motoboy-summary-pill"><i class="fa-solid fa-money-bill-wave" style="color: #059669;"></i> ${formatBRL(totalCash)} em dinheiro c/ entregadores</div>
    `;
  }

  if (activeSettlements.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: #94a3b8; font-style: italic;">
          Nenhum motoboy possui corridas registradas nesta data (${formatISODateToBR(targetDateStr)}).
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = activeSettlements.map(s => {
    const balance = s.totalFees - s.cashCollected;
    let balanceHtml = "";
    if (balance < 0) {
      balanceHtml = `<span class="badge-saldo-pay" title="Entregador deve repassar este valor ao caixa"><i class="fa-solid fa-arrow-down"></i> Repassar ${formatBRL(Math.abs(balance))}</span>`;
    } else if (balance > 0) {
      balanceHtml = `<span class="badge-saldo-receive" title="Caixa deve pagar este valor ao entregador"><i class="fa-solid fa-arrow-up"></i> Pagar ${formatBRL(balance)}</span>`;
    } else {
      balanceHtml = `<span class="badge-saldo-even"><i class="fa-solid fa-check"></i> Zerado (R$ 0,00)</span>`;
    }

    const cleanPhone = (s.phone || "").replace(/\D/g, "");
    const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : "javascript:void(0)";

    return `
      <tr>
        <td>
          <div style="font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-motorcycle" style="color: #d97706;"></i> ${s.name}
          </div>
        </td>
        <td>
          <div style="font-size: 0.82rem; color: #475569;">${s.vehicle || 'Moto'}</div>
          ${cleanPhone ? `<a href="${waLink}" target="_blank" style="font-size: 0.78rem; color: #059669; font-weight: 700; text-decoration: none;"><i class="fa-brands fa-whatsapp"></i> ${s.phone}</a>` : ''}
        </td>
        <td>
          <strong style="font-size: 0.95rem;">${s.runsCount}</strong> <small style="color: #64748b;">viagens</small>
        </td>
        <td>
          <strong style="color: #d97706;">${formatBRL(s.totalFees)}</strong>
        </td>
        <td>
          <strong style="color: #059669;">${formatBRL(s.cashCollected)}</strong>
        </td>
        <td>
          ${balanceHtml}
        </td>
        <td>
          ${s.pixKey ? `
            <button type="button" class="btn-outline-admin" onclick="copyMotoboyPixKey('${s.pixKey}')" style="padding: 4px 8px; font-size: 0.75rem;">
              <i class="fa-brands fa-pix" style="color: #10b981;"></i> Copiar PIX
            </button>
          ` : '<span style="color: #94a3b8; font-size: 0.75rem;">Sem PIX</span>'}
        </td>
        <td class="text-right">
          <button type="button" class="btn-motoboy-print-thermal" onclick="printMotoboySettlementThermal('${s.id}', '${targetDateStr}')" title="Imprimir comprovante de acerto 80mm">
            <i class="fa-solid fa-print"></i> Imprimir Acerto
          </button>
        </td>
      </tr>
    `;
  }).join("");
};

window.printMotoboySettlementThermal = function(motoboyId, dateStr) {
  const targetDateStr = dateStr || currentCaixaDateStr || getTodayISODateString();
  const allOrders = VIPDatabase.getOrders();
  const motoboy = VIPDatabase.getMotoboyById(motoboyId);
  if (!motoboy) {
    showToastNotification("Entregador não encontrado.");
    return;
  }

  const motoboyOrders = allOrders.filter(o => {
    if (!o.createdAt || o.status === "cancelado") return false;
    const d = new Date(o.createdAt);
    const orderDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return orderDateStr === targetDateStr && o.deliveryMan && o.deliveryMan.id === motoboyId;
  });

  let totalFees = 0;
  let cashCollected = 0;
  let runsLines = "";

  motoboyOrders.forEach(o => {
    const fee = Number(o.deliveryMan?.fee !== undefined ? o.deliveryMan.fee : 7);
    totalFees += fee;
    const pay = String(o.paymentMethod || "").toLowerCase();
    const isCash = pay.includes("dinheiro") || pay.includes("especie") || pay.includes("espécie");
    const val = Number(o.totalAmount || 0);
    if (isCash) cashCollected += val;

    runsLines += `
      <div style="display: flex; justify-content: space-between; border-bottom: 1px dotted #ccc; padding: 3px 0; font-size: 9.5pt;">
        <span>#${o.id} - ${o.customer?.name ? o.customer.name.substring(0, 14) : 'Cli'}</span>
        <span>${isCash ? '💵 ' + formatBRL(val) : 'Pix/Cart'} | Tx: ${formatBRL(fee)}</span>
      </div>
    `;
  });

  const balance = totalFees - cashCollected;
  let balanceHtml = "";
  if (balance < 0) {
    balanceHtml = `
      <div style="border: 2px dashed #000; padding: 6px; text-align: center; margin: 8px 0;">
        <div style="font-size: 10pt; font-weight: 800;">REPASSAR AO CAIXA DA LOJA:</div>
        <div style="font-size: 14pt; font-weight: 900;">${formatBRL(Math.abs(balance))}</div>
        <small style="font-size: 8pt;">(Dinheiro recebido em mãos maior que as taxas)</small>
      </div>
    `;
  } else if (balance > 0) {
    balanceHtml = `
      <div style="border: 2px solid #000; padding: 6px; text-align: center; margin: 8px 0;">
        <div style="font-size: 10pt; font-weight: 800;">A PAGAR AO MOTOBOY:</div>
        <div style="font-size: 14pt; font-weight: 900;">${formatBRL(balance)}</div>
        <small style="font-size: 8pt;">(Pagar via Pix ou em Dinheiro)</small>
      </div>
    `;
  } else {
    balanceHtml = `
      <div style="border: 1px solid #000; padding: 6px; text-align: center; margin: 8px 0;">
        <div style="font-size: 11pt; font-weight: 900;">ACERTO 100% ZERADO / QUITADO</div>
      </div>
    `;
  }

  const receiptArea = document.getElementById("thermal-receipt-area");
  if (!receiptArea) return;

  const printerCfg = VIPDatabase.getPrinterConfig();
  const printableWidthMm = parseInt(printerCfg.printableWidthMm) || 76;
  const marginSideMm = parseInt(printerCfg.marginSideMm) !== undefined ? parseInt(printerCfg.marginSideMm) : 2;

  receiptArea.className = "thermal-receipt-area paper-80mm";
  receiptArea.innerHTML = `
    <div style="width: 100%; max-width: ${printableWidthMm}mm; margin: 0 auto; padding: 0 ${marginSideMm}mm; box-sizing: border-box; font-family: 'Consolas', 'Courier New', monospace; font-size: 10.5pt; color: #000; line-height: 1.35; text-align: left;">
      <div style="text-align: center; font-weight: 900; font-size: 13pt;">*** SALGADOS VIP ***</div>
      <div style="text-align: center; font-weight: 800; font-size: 11pt; margin-bottom: 2px;">COMPROVANTE DE ACERTO DE CORRIDAS</div>
      <div style="text-align: center; font-size: 9pt; margin-bottom: 6px;">DATA: ${formatISODateToBR(targetDateStr)} | EMISSÃO: ${new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</div>
      <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>
      <div><strong>Entregador:</strong> ${motoboy.name}</div>
      <div><strong>Veículo:</strong> ${motoboy.vehicle || 'Moto'}</div>
      <div><strong>Telefone:</strong> ${motoboy.phone || '--'}</div>
      ${motoboy.pixKey ? `<div><strong>PIX (${motoboy.pixType || 'Chave'}):</strong> ${motoboy.pixKey}</div>` : ''}
      <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>
      <div style="font-weight: 800; margin-bottom: 4px;">RESUMO DAS CORRIDAS (${motoboyOrders.length}):</div>
      ${runsLines || '<div style="font-style: italic; color: #555;">Nenhuma corrida registrada nesta data.</div>'}
      <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>
      <div style="display: flex; justify-content: space-between;">
        <span>(+) Total de Taxas (Crédito):</span>
        <strong>${formatBRL(totalFees)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>(-) Dinheiro Recebido (Débito):</span>
        <strong>${formatBRL(cashCollected)}</strong>
      </div>
      ${balanceHtml}
      <div style="margin-top: 20px; text-align: center;">
        <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto 4px auto;"></div>
        <div style="font-size: 8.5pt;">Assinatura do Entregador</div>
      </div>
      <div style="text-align: center; font-size: 8pt; margin-top: 12px; color: #555;">
        Conferido e emitido pelo Sistema Salgados VIP
      </div>
    </div>
  `;

  setTimeout(() => {
    window.print();
  }, 300);
};

// ==============================================================================
// 2.12 MÓDULO DE CRM & HISTÓRICO DE CLIENTES (FIDELIDADE & RELACIONAMENTO)
// ==============================================================================
let currentCRMSegment = "all";
let crmSearchTerm = "";
let activeCRMCustomerId = null;

window.updateCustomersBadgeCount = function() {
  const badge = document.getElementById("badge-customers-count");
  if (!badge) return;
  const customers = VIPDatabase.getCustomersCRM();
  badge.textContent = customers.length;
  badge.style.display = customers.length > 0 ? "inline-block" : "none";
};

window.renderCustomersCRMView = function() {
  const tbody = document.getElementById("crm-customers-table-body");
  if (!tbody) return;

  const customers = VIPDatabase.getCustomersCRM();

  // KPIs
  const totalCount = customers.length;
  const vipCount = customers.filter(c => c.segment === "vip").length;
  const inactiveCount = customers.filter(c => c.isInactive).length;
  const recurrentCount = customers.filter(c => c.segment === "recurrent").length;
  const newCount = customers.filter(c => c.segment === "new").length;

  let totalRevenueAll = 0;
  let totalOrdersAll = 0;
  customers.forEach(c => {
    totalRevenueAll += c.totalSpent;
    totalOrdersAll += c.validOrdersCount;
  });
  const avgTicketAll = totalOrdersAll > 0 ? (totalRevenueAll / totalOrdersAll) : 0;

  const elTotal = document.getElementById("crm-kpi-total");
  const elVip = document.getElementById("crm-kpi-vip");
  const elInactive = document.getElementById("crm-kpi-inactive");
  const elAvg = document.getElementById("crm-kpi-avg-ticket");

  if (elTotal) elTotal.textContent = totalCount;
  if (elVip) elVip.textContent = vipCount;
  if (elInactive) elInactive.textContent = inactiveCount;
  if (elAvg) elAvg.textContent = formatBRL(avgTicketAll);

  // Contadores nos botões de filtro
  const countAll = document.getElementById("crm-count-all");
  const countVip = document.getElementById("crm-count-vip");
  const countRec = document.getElementById("crm-count-recurrent");
  const countNew = document.getElementById("crm-count-new");
  const countIna = document.getElementById("crm-count-inactive");

  if (countAll) countAll.textContent = totalCount;
  if (countVip) countVip.textContent = vipCount;
  if (countRec) countRec.textContent = recurrentCount;
  if (countNew) countNew.textContent = newCount;
  if (countIna) countIna.textContent = inactiveCount;

  // Busca e Filtros
  const searchInput = document.getElementById("crm-search-input");
  crmSearchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";

  let filtered = customers.filter(c => {
    if (currentCRMSegment === "vip" && c.segment !== "vip") return false;
    if (currentCRMSegment === "recurrent" && c.segment !== "recurrent") return false;
    if (currentCRMSegment === "new" && c.segment !== "new") return false;
    if (currentCRMSegment === "inactive" && !c.isInactive) return false;

    if (crmSearchTerm) {
      const matchName = (c.name || "").toLowerCase().includes(crmSearchTerm);
      const matchPhone = (c.phone || "").toLowerCase().includes(crmSearchTerm) || (c.cleanPhone || "").includes(crmSearchTerm);
      const matchAddr = (c.address || "").toLowerCase().includes(crmSearchTerm);
      const matchTag = (c.customTag || "").toLowerCase().includes(crmSearchTerm);
      return matchName || matchPhone || matchAddr || matchTag;
    }
    return true;
  });

  // Ordenação
  const sortSelect = document.getElementById("crm-sort-select");
  const sortBy = sortSelect ? sortSelect.value : "recent";

  if (sortBy === "recent") {
    filtered.sort((a, b) => b.lastOrderDate - a.lastOrderDate);
  } else if (sortBy === "spent") {
    filtered.sort((a, b) => b.totalSpent - a.totalSpent);
  } else if (sortBy === "orders") {
    filtered.sort((a, b) => b.validOrdersCount - a.validOrdersCount);
  } else if (sortBy === "name") {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2.5rem; color: #94a3b8; font-style: italic;">
          Nenhum cliente encontrado para os critérios de busca selecionados.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const names = (c.name || "Cliente").split(" ");
    const initials = names.length > 1 ? (names[0][0] + names[names.length - 1][0]).toUpperCase() : names[0].substring(0, 2).toUpperCase();

    const lastDate = new Date(c.lastOrderDate);
    const lastDateStr = lastDate.toLocaleDateString("pt-BR");
    let recencyText = "";
    if (c.daysSinceLastOrder === 0) recencyText = "Hoje";
    else if (c.daysSinceLastOrder === 1) recencyText = "Ontem";
    else recencyText = `Há ${c.daysSinceLastOrder} dias`;

    const favsHtml = (c.favoriteItems || []).map(f => `
      <span class="badge-crm-tag" title="${f.qty}x pedidos">${f.name} (${f.qty}x)</span>
    `).join(" ") || '<span style="color:#94a3b8; font-size:0.75rem;">--</span>';

    const cleanPhone = (c.phone || "").replace(/\D/g, "");
    const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : "javascript:void(0)";

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="customer-avatar-small">${initials}</div>
            <div>
              <div style="font-weight: 800; color: #0f172a; cursor: pointer;" onclick="openCustomerDetailsModal('${c.id}')" title="Ver histórico completo">${c.name}</div>
              <div style="display: flex; align-items: center; gap: 5px; margin-top: 2px;">
                <span class="${c.segmentBadgeClass}">${c.segmentLabel}</span>
                ${c.isInactive ? '<span class="badge-crm-inactive" title="Cliente sem pedir há mais de 30 dias">💤 Inativo</span>' : ''}
                ${c.customTag ? `<span class="badge-crm-tag">${c.customTag}</span>` : ''}
              </div>
            </div>
          </div>
        </td>
        <td>
          <div style="font-weight: 600; color: #334155;">${c.phone || "--"}</div>
          ${cleanPhone ? `
            <a href="${waLink}" target="_blank" style="font-size: 0.78rem; color: #059669; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; margin-top: 2px;">
              <i class="fa-brands fa-whatsapp"></i> Conversar
            </a>
          ` : ''}
        </td>
        <td>
          <div style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.82rem; color: #475569;" title="${c.address || ''}">
            ${c.address || '<span style="color:#94a3b8; font-style:italic;">Sem endereço</span>'}
          </div>
        </td>
        <td>
          <strong style="font-size: 0.95rem; color: #0f172a;">${c.validOrdersCount}</strong> <small style="color: #64748b;">pedidos</small>
        </td>
        <td>
          <strong style="color: #059669; font-size: 0.95rem;">${formatBRL(c.totalSpent)}</strong>
        </td>
        <td>
          <span style="font-weight: 600; color: #475569;">${formatBRL(c.averageTicket)}</span>
        </td>
        <td>
          <div style="font-size: 0.82rem; font-weight: 700; color: #1e293b;">${lastDateStr}</div>
          <small style="color: ${c.daysSinceLastOrder >= 30 ? '#dc2626' : '#64748b'}; font-weight: 600;">${recencyText}</small>
        </td>
        <td>
          <div style="max-width: 200px; display: flex; flex-wrap: wrap; gap: 4px;">
            ${favsHtml}
          </div>
        </td>
        <td class="text-right">
          <button type="button" class="btn-action-icon" onclick="openCustomerWAModal('${c.id}')" title="Disparar mensagem no WhatsApp" style="color: #059669;">
            <i class="fa-brands fa-whatsapp"></i>
          </button>
          <button type="button" class="btn-action-icon" onclick="openCustomerDetailsModal('${c.id}')" title="Ver ficha e histórico de pedidos">
            <i class="fa-solid fa-clock-rotate-left"></i>
          </button>
          <button type="button" class="btn-action-icon" onclick="openCustomerEditModal('${c.id}')" title="Editar dados cadastrais">
            <i class="fa-solid fa-pen"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");

  updateCustomersBadgeCount();
};

window.setCRMSegmentFilter = function(segment) {
  currentCRMSegment = segment;
  ["all", "vip", "recurrent", "new", "inactive"].forEach(s => {
    const btn = document.getElementById(`crm-filter-${s}`);
    if (btn) btn.classList.toggle("active", s === segment);
  });
  renderCustomersCRMView();
};

window.filterCustomersList = function() {
  renderCustomersCRMView();
};

// Modal de Detalhes & Histórico do Cliente
window.openCustomerDetailsModal = function(customerId) {
  activeCRMCustomerId = customerId;
  const customer = VIPDatabase.getCustomerByIdCRM(customerId);
  if (!customer) return;

  const modal = document.getElementById("modal-customer-details");
  const backdrop = document.getElementById("modal-customer-details-backdrop");
  if (!modal || !backdrop) return;

  const names = (customer.name || "Cliente").split(" ");
  const initials = names.length > 1 ? (names[0][0] + names[names.length - 1][0]).toUpperCase() : names[0].substring(0, 2).toUpperCase();

  const elAvatar = document.getElementById("cd-avatar");
  const elName = document.getElementById("cd-name");
  const elSegment = document.getElementById("cd-segment-badge");
  const elPhone = document.getElementById("cd-phone");
  const elAddress = document.getElementById("cd-address");
  const elSpent = document.getElementById("cd-total-spent");
  const elOrders = document.getElementById("cd-total-orders");
  const elAvg = document.getElementById("cd-avg-ticket");
  const elLast = document.getElementById("cd-last-order-time");
  const notesInput = document.getElementById("cd-notes-input");
  const ordersCountLbl = document.getElementById("cd-orders-count-label");
  const tbody = document.getElementById("cd-orders-table-body");

  if (elAvatar) elAvatar.textContent = initials;
  if (elName) elName.textContent = customer.name;
  if (elSegment) {
    elSegment.className = customer.segmentBadgeClass;
    elSegment.textContent = customer.segmentLabel;
  }
  if (elPhone) elPhone.innerHTML = `<i class="fa-solid fa-phone"></i> ${customer.phone || 'Sem telefone'}`;
  if (elAddress) elAddress.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${customer.address || 'Sem endereço'}`;

  if (elSpent) elSpent.textContent = formatBRL(customer.totalSpent);
  if (elOrders) elOrders.textContent = customer.validOrdersCount;
  if (elAvg) elAvg.textContent = formatBRL(customer.averageTicket);

  if (elLast) {
    const lastDate = new Date(customer.lastOrderDate);
    elLast.textContent = `${lastDate.toLocaleDateString("pt-BR")} (${customer.daysSinceLastOrder === 0 ? 'Hoje' : `há ${customer.daysSinceLastOrder} dias`})`;
  }

  if (notesInput) notesInput.value = customer.notes || "";
  if (ordersCountLbl) ordersCountLbl.textContent = customer.orders.length;

  if (tbody) {
    if (customer.orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:#94a3b8;">Nenhum pedido registrado para este cliente.</td></tr>`;
    } else {
      tbody.innerHTML = customer.orders.map(o => {
        const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString("pt-BR") : "--";
        const timeStr = o.createdAt ? new Date(o.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
        const itemsSummary = (o.items || []).map(it => `${it.quantity || 1}x ${it.kitName || it.name}`).join(", ");

        const statusNames = {
          novo: "Recebidos",
          em_preparo: "Empreparo",
          pronto: "Em entrega / Balcão",
          concluido: "Finalizado",
          cancelado: "Cancelado"
        };
        const statusClass = o.status === "cancelado" ? "status-delay" : (o.status === "concluido" ? "status-done" : "status-prep");

        return `
          <tr>
            <td>
              <div style="font-weight:700; font-size:0.82rem;">${dateStr}</div>
              <small style="color:#64748b;">${timeStr}</small>
            </td>
            <td><span class="order-id-badge">#${o.id}</span></td>
            <td>
              <div style="max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.82rem;" title="${itemsSummary}">
                ${itemsSummary}
              </div>
            </td>
            <td><small style="font-weight:600;">${o.paymentMethod || 'Não informado'}</small></td>
            <td><strong style="color:#0f172a;">${formatBRL(o.totalAmount || 0)}</strong></td>
            <td><span class="badge-status-order ${statusClass}">${statusNames[o.status] || o.status}</span></td>
            <td class="text-right">
              <button type="button" class="btn-action-icon" onclick="openOrderDetails('${o.id}')" title="Ver pedido detalhado">
                <i class="fa-solid fa-eye"></i>
              </button>
            </td>
          </tr>
        `;
      }).join("");
    }
  }

  backdrop.style.display = "block";
  modal.style.display = "block";
  setTimeout(() => {
    backdrop.classList.add("active");
    modal.classList.add("active");
  }, 10);
};

window.closeCustomerDetailsModal = function() {
  const modal = document.getElementById("modal-customer-details");
  const backdrop = document.getElementById("modal-customer-details-backdrop");
  if (modal) modal.classList.remove("active");
  if (backdrop) backdrop.classList.remove("active");
  setTimeout(() => {
    if (modal) modal.style.display = "none";
    if (backdrop) backdrop.style.display = "none";
    activeCRMCustomerId = null;
  }, 200);
};

window.saveCurrentCustomerNotes = function() {
  if (!activeCRMCustomerId) return;
  const input = document.getElementById("cd-notes-input");
  const statusEl = document.getElementById("cd-notes-status");
  if (!input) return;

  const notes = input.value.trim();
  VIPDatabase.saveCustomerCRM(activeCRMCustomerId, { notes });

  if (statusEl) {
    statusEl.style.display = "inline";
    setTimeout(() => { statusEl.style.display = "none"; }, 2000);
  }
};

// Modal de Cadastrar / Editar Cliente
window.openCustomerEditModal = function(customerId) {
  const modal = document.getElementById("modal-customer-edit");
  const backdrop = document.getElementById("modal-customer-edit-backdrop");
  const title = document.getElementById("modal-customer-edit-title");
  const idInput = document.getElementById("ce-id");
  const nameInput = document.getElementById("ce-name");
  const phoneInput = document.getElementById("ce-phone");
  const addrInput = document.getElementById("ce-address");
  const tagInput = document.getElementById("ce-custom-tag");
  const notesInput = document.getElementById("ce-notes");

  if (!modal || !backdrop) return;

  if (customerId) {
    const customer = VIPDatabase.getCustomerByIdCRM(customerId);
    if (!customer) return;
    title.innerHTML = `<i class="fa-solid fa-user-pen" style="color: #d97706;"></i> Editar Dados do Cliente`;
    idInput.value = customer.id;
    nameInput.value = customer.name || "";
    phoneInput.value = customer.phone || "";
    addrInput.value = customer.address || "";
    tagInput.value = customer.customTag || "";
    notesInput.value = customer.notes || "";
  } else {
    title.innerHTML = `<i class="fa-solid fa-user-plus" style="color: #d97706;"></i> Cadastrar Novo Cliente`;
    idInput.value = "";
    nameInput.value = "";
    phoneInput.value = "";
    addrInput.value = "";
    tagInput.value = "";
    notesInput.value = "";
  }

  backdrop.style.display = "block";
  modal.style.display = "block";
  setTimeout(() => {
    backdrop.classList.add("active");
    modal.classList.add("active");
    nameInput?.focus();
  }, 10);
};

window.closeCustomerEditModal = function() {
  const modal = document.getElementById("modal-customer-edit");
  const backdrop = document.getElementById("modal-customer-edit-backdrop");
  if (modal) modal.classList.remove("active");
  if (backdrop) backdrop.classList.remove("active");
  setTimeout(() => {
    if (modal) modal.style.display = "none";
    if (backdrop) backdrop.style.display = "none";
  }, 200);
};

window.saveCustomerEditFromModal = function() {
  const id = document.getElementById("ce-id").value;
  const name = document.getElementById("ce-name").value.trim();
  const phone = document.getElementById("ce-phone").value.trim();
  const address = document.getElementById("ce-address").value.trim();
  const customTag = document.getElementById("ce-custom-tag").value.trim();
  const notes = document.getElementById("ce-notes").value.trim();

  if (!name || !phone) {
    showToastNotification("Por favor, preencha o nome e o telefone do cliente.", "error");
    return;
  }

  const cleanPhone = phone.replace(/\D/g, "");
  const targetId = id || (cleanPhone.length >= 8 ? cleanPhone : `cust-${Date.now()}`);

  VIPDatabase.saveCustomerCRM(targetId, {
    name,
    phone,
    address,
    customTag,
    notes
  });

  closeCustomerEditModal();
  renderCustomersCRMView();
  if (activeCRMCustomerId === targetId) {
    openCustomerDetailsModal(targetId);
  }
  showToastNotification(`Dados do cliente "${name}" salvos com sucesso!`);
};

window.openCustomerEditFromDetails = function() {
  if (activeCRMCustomerId) {
    openCustomerEditModal(activeCRMCustomerId);
  }
};

// Modal de Disparo Rápido WhatsApp (Fidelização / Reativação)
window.openCustomerWAModal = function(customerId) {
  const customer = VIPDatabase.getCustomerByIdCRM(customerId);
  if (!customer) return;

  const modal = document.getElementById("modal-customer-wa");
  const backdrop = document.getElementById("modal-customer-wa-backdrop");
  const targetName = document.getElementById("cwa-target-name");
  const targetPhone = document.getElementById("cwa-target-phone");
  const templateSelect = document.getElementById("cwa-template-select");

  if (!modal || !backdrop) return;

  activeCRMCustomerId = customerId;
  if (targetName) targetName.textContent = customer.name;
  if (targetPhone) targetPhone.value = customer.cleanPhone || customer.phone;

  if (templateSelect) {
    if (customer.isInactive) templateSelect.value = "reativacao";
    else if (customer.segment === "vip") templateSelect.value = "vip";
    else templateSelect.value = "novidades";
  }

  onCRMWATemplateChanged();

  backdrop.style.display = "block";
  modal.style.display = "block";
  setTimeout(() => {
    backdrop.classList.add("active");
    modal.classList.add("active");
  }, 10);
};

window.closeCustomerWAModal = function() {
  const modal = document.getElementById("modal-customer-wa");
  const backdrop = document.getElementById("modal-customer-wa-backdrop");
  if (modal) modal.classList.remove("active");
  if (backdrop) backdrop.classList.remove("active");
  setTimeout(() => {
    if (modal) modal.style.display = "none";
    if (backdrop) backdrop.style.display = "none";
  }, 200);
};

window.openCustomerWhatsAppModalFromDetails = function() {
  if (activeCRMCustomerId) {
    openCustomerWAModal(activeCRMCustomerId);
  }
};

window.onCRMWATemplateChanged = function() {
  const templateSelect = document.getElementById("cwa-template-select");
  const textInput = document.getElementById("cwa-text-input");
  if (!templateSelect || !textInput || !activeCRMCustomerId) return;

  const customer = VIPDatabase.getCustomerByIdCRM(activeCRMCustomerId);
  const firstName = customer ? (customer.name || "Cliente").split(" ")[0] : "Cliente";
  const type = templateSelect.value;

  let msg = "";
  if (type === "vip") {
    msg = `Olá, *${firstName}*! Tudo bem? ⭐\nPassando para te agradecer por ser um dos nossos clientes mais especiais aqui no *Salgados VIP*!\n\nComo forma de carinho, preparamos uma cortesia especial para o seu próximo pedido! 🎁\nVocê pode pedir agora pelo nosso cardápio online com entrega rápida e salgados quentinhos. Esperamos por você! 😋`;
  } else if (type === "reativacao") {
    msg = `Oi, *${firstName}*! Sentimos sua falta por aqui no *Salgados VIP*! 💛\nFazia um tempinho que você não pedia salgadinhos crocantes e quentinhos com a gente.\n\nPara comemorar o seu retorno, temos um desconto especial esperando por você hoje! 🥟🔥\nAcesse nosso cardápio e faça seu pedido direto pelo link. Será um prazer atender você de novo!`;
  } else if (type === "novidades") {
    msg = `Olá, *${firstName}*! Tudo bem com você? 🥟✨\nO forno do *Salgados VIP* já está a todo vapor com salgadinhos fresquinhos, coxinhas crocantes e kits perfeitos para hoje!\n\nJá deu uma olhada nas opções do nosso cardápio hoje?\nEntrega rápida e tudo feito com a máxima qualidade. Peça o seu agora! 🚀`;
  } else {
    msg = `Olá, *${firstName}*! Aqui é do *Salgados VIP*! Tudo bem? 😊`;
  }

  textInput.value = msg;
};

window.sendCustomerWAMessage = async function() {
  const phone = document.getElementById("cwa-target-phone")?.value?.replace(/\D/g, "");
  const text = document.getElementById("cwa-text-input")?.value?.trim();

  if (!phone || phone.length < 8) {
    showToastNotification("Telefone do cliente inválido ou não informado.", "error");
    return;
  }
  if (!text) {
    showToastNotification("Por favor, digite o texto da mensagem.", "error");
    return;
  }

  let sentSilently = false;

  if (window.VIPWhatsAppGateway) {
    try {
      const status = await VIPWhatsAppGateway.checkStatus();
      if (status && status.connected) {
        await VIPWhatsAppGateway.sendMessage(phone, text);
        sentSilently = true;
      }
    } catch(e) {
      console.warn("[CRM Cliente] Envio silencioso falhou:", e);
    }
  }

  if (!sentSilently) {
    const waUrl = `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  }

  closeCustomerWAModal();
  showToastNotification(`Mensagem de fidelização enviada para o cliente com sucesso!`);
};

// Exportar Lista de Clientes em CSV
window.exportCustomersToCSV = function() {
  const customers = VIPDatabase.getCustomersCRM();
  if (!customers || customers.length === 0) {
    showToastNotification("Nenhum cliente disponível para exportação.", "error");
    return;
  }

  let csvContent = "\uFEFF";
  csvContent += "Nome;Telefone;Endereço;Segmento;Qtd Pedidos;Total Gasto (R$);Ticket Médio (R$);Último Pedido;Dias Sem Pedir;Anotações\n";

  customers.forEach(c => {
    const lastDate = new Date(c.lastOrderDate).toLocaleDateString("pt-BR");
    const line = [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${(c.address || '').replace(/"/g, '""')}"`,
      `"${c.segmentLabel}"`,
      c.validOrdersCount,
      (c.totalSpent || 0).toFixed(2).replace('.', ','),
      (c.averageTicket || 0).toFixed(2).replace('.', ','),
      lastDate,
      c.daysSinceLastOrder,
      `"${(c.notes || '').replace(/"/g, '""')}"`
    ].join(";");
    csvContent += line + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = getTodayISODateString();
  a.href = url;
  a.download = `clientes_salgados_vip_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToastNotification(`Arquivo CSV gerado com ${customers.length} contatos exportados com sucesso!`);
};

// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  checkSession();
  setTimeout(() => {
    if (window.VIPWhatsAppGateway && typeof VIPWhatsAppGateway.init === "function") {
      VIPWhatsAppGateway.init().then(() => {
        if (typeof checkWhatsAppSilentServiceStatus === "function") {
          checkWhatsAppSilentServiceStatus(false);
        }
      });
      setInterval(() => {
        if (typeof checkWhatsAppSilentServiceStatus === "function") {
          checkWhatsAppSilentServiceStatus(false);
        }
      }, 15000);
    } else if (typeof checkWhatsAppSilentServiceStatus === "function") {
      checkWhatsAppSilentServiceStatus(false);
    }
  }, 1200);
});
