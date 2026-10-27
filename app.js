/**
 * ==============================================================================
 * SALGADOS VIP - NOVA IGUAÇU (RIO DE JANEIRO)
 * Cardápio Interativo com Distribuição de Sabores e Checkout WhatsApp
 * ==============================================================================
 */

// 1. OBTENÇÃO DINÂMICA DE DADOS DO BANCO (VIPDatabase)
function getStoreConfig() {
  return typeof VIPDatabase !== "undefined" ? VIPDatabase.getConfig() : DEFAULT_CONFIG;
}

function getKitsCatalog() {
  const kits = typeof VIPDatabase !== "undefined" ? VIPDatabase.getKits() : [];
  return kits.filter(k => k.active !== false);
}

function getFlavorsCatalog() {
  const flavors = typeof VIPDatabase !== "undefined" ? VIPDatabase.getFlavors() : [];
  return flavors.filter(f => f.active !== false);
}

function getSaucesCatalog() {
  const sauces = typeof VIPDatabase !== "undefined" ? VIPDatabase.getSauces() : [];
  return sauces.filter(s => s.active !== false);
}

function getCategoriesCatalog() {
  const cats = typeof VIPDatabase !== "undefined" ? VIPDatabase.getCategories() : [];
  return cats.filter(c => c.active !== false);
}

function getProductsCatalog() {
  const prods = typeof VIPDatabase !== "undefined" ? VIPDatabase.getProducts() : [];
  return prods.filter(p => p.active !== false);
}

function getCombosCatalog() {
  const combos = typeof VIPDatabase !== "undefined" ? VIPDatabase.getCombos() : [];
  return combos.filter(c => c.active !== false);
}

// ESTADO GLOBAL DA APLICAÇÃO
let cartItems = []; // Itens do pedido final (Kits montados com seus molhos inclusos)
let activeCustomizingKit = null; // Kit sendo montado atualmente
let activeCustomizingCombo = null; // Combo sendo montado atualmente
let currentFlavorSelections = {}; // { flavorId: quantity } no modal
let currentSauceSelections = {}; // { sauceId: quantity } sugestão de molhos no modal

// FORMATADOR DE MOEDA BRL
function formatBRL(val) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ==============================================================================
// 5. MODO AUTOMÁTICO DE ABERTURA (VERIFICAÇÃO DE HORÁRIOS POR DIA DA SEMANA)
// ==============================================================================
function getScheduleForDate(dateObj = new Date()) {
  const cfg = getStoreConfig();
  const dayIndex = dateObj.getDay();
  const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

  if (cfg.weeklySchedule && Array.isArray(cfg.weeklySchedule) && cfg.weeklySchedule.length > 0) {
    const found = cfg.weeklySchedule.find(s => s.day === dayIndex);
    if (found) return found;
  }

  // Fallback padrão
  const openStr = `${String(cfg.openingHour ?? 16).padStart(2, '0')}:${String(cfg.openingMinute ?? 0).padStart(2, '0')}`;
  const closeStr = `${String(cfg.closingHour ?? 22).padStart(2, '0')}:${String(cfg.closingMinute ?? 30).padStart(2, '0')}`;
  return {
    day: dayIndex,
    dayName: dayNames[dayIndex],
    open: true,
    openTime: openStr,
    closeTime: closeStr
  };
}

// Retorna se o estabelecimento está aberto para pedidos imediatos no exato momento
function isStoreOpenNow() {
  const now = new Date();
  const todaySched = getScheduleForDate(now);
  if (!todaySched || !todaySched.open) return false;

  const [openH, openM] = (todaySched.openTime || "16:00").split(":").map(Number);
  const [closeH, closeM] = (todaySched.closeTime || "22:30").split(":").map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

// Localiza a data e horário ideal para agendamento quando fora do horário imediato
function getSuggestedSchedulingDateAndTime() {
  const now = new Date();
  const todaySched = getScheduleForDate(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let [openH, openM] = (todaySched.openTime || "16:00").split(":").map(Number);
  let [closeH, closeM] = (todaySched.closeTime || "22:30").split(":").map(Number);
  let openMinutes = openH * 60 + openM;
  let closeMinutes = closeH * 60 + closeM;

  // 1. Se hoje a loja abre e ainda não fechou
  if (todaySched.open && currentMinutes < closeMinutes) {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    // Se ainda não abriu hoje, sugere a abertura; se já está aberta, sugere +45 min
    let suggestedTime = todaySched.openTime;
    if (currentMinutes >= openMinutes) {
      const nextTimeMin = Math.min(closeMinutes - 15, currentMinutes + 45);
      const nextH = Math.floor(nextTimeMin / 60);
      const nextM = nextTimeMin % 60;
      suggestedTime = `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;
    }

    return {
      dateStr: dateStr,
      timeStr: suggestedTime,
      sched: todaySched,
      isToday: true,
      daysAhead: 0
    };
  }

  // 2. Se hoje não abre ou já encerrou, localiza o próximo dia aberto
  for (let i = 1; i <= 7; i++) {
    const candidateDate = new Date(now);
    candidateDate.setDate(candidateDate.getDate() + i);
    const sched = getScheduleForDate(candidateDate);
    if (sched && sched.open) {
      const year = candidateDate.getFullYear();
      const month = String(candidateDate.getMonth() + 1).padStart(2, "0");
      const day = String(candidateDate.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;
      return {
        dateStr: dateStr,
        timeStr: sched.openTime || "16:00",
        sched: sched,
        isToday: false,
        daysAhead: i
      };
    }
  }

  return {
    dateStr: "",
    timeStr: "16:00",
    sched: todaySched,
    isToday: false,
    daysAhead: 1
  };
}

// REGRA CRÍTICA: Não deixa o cliente selecionar entrega imediata se a loja estiver fora do horário
window.applyStoreOperatingHoursRules = function() {
  const isOpen = isStoreOpenNow();
  const imediatoRadio = document.getElementById("timing-type-imediato");
  const agendadoRadio = document.getElementById("timing-type-agendado");
  const imediatoLabel = document.getElementById("seg-item-imediato");
  const alertBox = document.getElementById("store-closed-scheduling-alert");
  const alertText = document.getElementById("store-closed-scheduling-alert-text");

  if (!isOpen) {
    // 1. Desabilita o rádio de entrega imediata
    if (imediatoRadio) {
      imediatoRadio.checked = false;
      imediatoRadio.disabled = true;
    }
    if (imediatoLabel) {
      imediatoLabel.classList.add("disabled");
      imediatoLabel.title = "Atendimento imediato indisponível fora do horário de funcionamento.";
      const span = imediatoLabel.querySelector("span");
      if (span) {
        span.innerHTML = `<i class="fa-solid fa-lock"></i> Imediato (Fechado)`;
      }
    }

    // 2. Direciona e marca automaticamente o Agendamento
    if (agendadoRadio) {
      agendadoRadio.checked = true;
    }

    // 3. Abre a seção de campos de agendamento
    toggleSchedulingSection(true);

    // 4. Exibe banner explicativo com a próxima previsão de atendimento
    if (alertBox) {
      const sug = getSuggestedSchedulingDateAndTime();
      if (alertText && sug && sug.sched) {
        const diaTexto = sug.isToday ? "hoje" : (sug.daysAhead === 1 ? "amanhã" : `${sug.sched.dayName}`);
        alertText.innerHTML = `Nossa cozinha está fora do horário de atendimento imediato. Direcionamos seu pedido automaticamente para <strong>Agendamento</strong> para você garantir seus salgados para <strong>${diaTexto} a partir das ${sug.timeStr}</strong>!`;
      }
      alertBox.style.display = "flex";
    }
  } else {
    // Loja está aberta: permite ambas as opções
    if (imediatoRadio) {
      imediatoRadio.disabled = false;
      // Se agendamento não estiver ativamente marcado, mantém imediato como padrão
      if (!agendadoRadio || !agendadoRadio.checked) {
        imediatoRadio.checked = true;
        toggleSchedulingSection(false);
      }
    }
    if (imediatoLabel) {
      imediatoLabel.classList.remove("disabled");
      imediatoLabel.title = "";
      const span = imediatoLabel.querySelector("span");
      if (span) {
        span.innerHTML = `<i class="fa-solid fa-bolt"></i> Pedir para Agora`;
      }
    }
    if (alertBox) {
      alertBox.style.display = "none";
    }
  }
};

function checkStoreStatus() {
  const cfg = getStoreConfig();
  const now = new Date();
  const todaySched = getScheduleForDate(now);

  const badgeEl = document.getElementById("store-status-badge");
  const textEl = document.getElementById("store-status-text");

  if (!badgeEl || !textEl) return;

  const isOpen = isStoreOpenNow();

  if (isOpen) {
    badgeEl.className = "status-badge open";
    textEl.textContent = `Aberto agora • ${todaySched.openTime} às ${todaySched.closeTime}`;
  } else {
    badgeEl.className = "status-badge closed";

    const sug = getSuggestedSchedulingDateAndTime();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = (todaySched.openTime || "16:00").split(":").map(Number);
    const openMinutes = openH * 60 + openM;

    if (todaySched.open && currentMinutes < openMinutes) {
      textEl.textContent = `Fechado no momento • Abre hoje às ${todaySched.openTime} • Aceitamos agendamento`;
    } else if (sug && sug.daysAhead === 1) {
      textEl.textContent = `Fechado por hoje • Reabre amanhã às ${sug.sched.openTime} • Aceitamos agendamento`;
    } else if (sug && sug.sched) {
      textEl.textContent = `Fechado no momento • Reabre ${sug.sched.dayName} às ${sug.sched.openTime} • Aceitamos agendamento`;
    } else {
      textEl.textContent = `Fechado no momento • Aceitamos pedidos agendados`;
    }
  }

  // Sincroniza as opções de horário no checkout
  applyStoreOperatingHoursRules();
  renderStoreBranding();
}

// ==============================================================================
// 4.1 IDENTIDADE VISUAL E LOGOTIPO DA LOJA (PÁGINA DE PEDIDOS)
// ==============================================================================
function renderStoreBranding() {
  const cfg = getStoreConfig();
  const storeName = cfg.name || "Salgados VIP";

  // Nome da Loja em destaque
  const nameEl = document.getElementById("display-store-name");
  if (nameEl) nameEl.textContent = storeName;

  const drawerStoreName = document.getElementById("drawer-store-name");
  if (drawerStoreName) drawerStoreName.textContent = storeName;

  const footerStoreName = document.getElementById("footer-store-name");
  if (footerStoreName) footerStoreName.textContent = storeName;

  // Localização
  const locEl = document.getElementById("display-store-location");
  if (locEl) {
    locEl.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${cfg.location || 'Nova Iguaçu - Rio de Janeiro'}`;
  }

  // Logotipo da Loja
  const logoUrl = (cfg.logoUrl || "").trim();

  // 1. Logo no Topo do Cardápio (Hero Header)
  const headerLogoWrap = document.getElementById("store-logo-wrapper");
  const headerLogoImg = document.getElementById("store-logo-img");
  if (headerLogoWrap && headerLogoImg) {
    if (logoUrl) {
      headerLogoImg.src = logoUrl;
      headerLogoWrap.style.display = "flex";
    } else {
      headerLogoWrap.style.display = "none";
    }
  }

  // 2. Logo na Gaveta de Pedidos (Checkout Drawer)
  const drawerLogoWrap = document.getElementById("drawer-logo-wrapper");
  const drawerLogoImg = document.getElementById("drawer-logo-img");
  if (drawerLogoWrap && drawerLogoImg) {
    if (logoUrl) {
      drawerLogoImg.src = logoUrl;
      drawerLogoWrap.style.display = "flex";
    } else {
      drawerLogoWrap.style.display = "none";
    }
  }

  // 3. Logo no Rodapé (Footer)
  const footerLogoWrap = document.getElementById("footer-logo-wrapper");
  const footerLogoImg = document.getElementById("footer-logo-img");
  if (footerLogoWrap && footerLogoImg) {
    if (logoUrl) {
      footerLogoImg.src = logoUrl;
      footerLogoWrap.style.display = "flex";
    } else {
      footerLogoWrap.style.display = "none";
    }
  }

  // Atualiza título da aba do navegador
  if (storeName) {
    document.title = `${storeName} | Cardápio & Delivery`;
  }
}

// ==============================================================================
// 5.1 GERENCIADOR DE AGENDAMENTO DE PEDIDOS (DRAWER DO CLIENTE)
// ==============================================================================
window.toggleSchedulingSection = function(isScheduled) {
  const schedGroup = document.getElementById("scheduling-fields-group");
  if (!schedGroup) return;

  if (isScheduled) {
    schedGroup.style.display = "block";
    initSchedulingDatePicker();
  } else {
    schedGroup.style.display = "none";
  }
};

function initSchedulingDatePicker() {
  const dateInput = document.getElementById("sched-date");
  const timeInput = document.getElementById("sched-time");
  if (!dateInput) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  const sug = getSuggestedSchedulingDateAndTime();

  // Se a loja já fechou hoje, a data mínima e o valor inicial são o próximo dia aberto
  if (sug && !sug.isToday && sug.dateStr) {
    const todaySched = getScheduleForDate(now);
    const [closeH, closeM] = (todaySched.closeTime || "22:30").split(":").map(Number);
    if (!todaySched.open || (now.getHours() * 60 + now.getMinutes() >= (closeH * 60 + closeM))) {
      dateInput.min = sug.dateStr;
    } else {
      dateInput.min = todayStr;
    }
    dateInput.value = sug.dateStr;
  } else {
    dateInput.min = todayStr;
    if (!dateInput.value) {
      dateInput.value = todayStr;
    }
  }

  if (timeInput && sug && sug.timeStr) {
    if (!timeInput.value || timeInput.value === "") {
      timeInput.value = sug.timeStr;
    }
  }

  onScheduleDateChange();
}

window.onScheduleDateChange = function() {
  const dateInput = document.getElementById("sched-date");
  const timeInput = document.getElementById("sched-time");
  const feedbackEl = document.getElementById("sched-feedback-msg");
  if (!dateInput || !feedbackEl) return;

  const val = dateInput.value;
  if (!val) {
    feedbackEl.innerHTML = `<span style="color:#64748b;">Selecione a data para consultar os horários deste dia.</span>`;
    return;
  }

  const [y, m, d] = val.split("-").map(Number);
  const selectedDate = new Date(y, m - 1, d, 12, 0, 0);
  const sched = getScheduleForDate(selectedDate);
  const now = new Date();
  const isToday = (y === now.getFullYear() && (m - 1) === now.getMonth() && d === now.getDate());
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (!sched.open) {
    feedbackEl.className = "sched-feedback-banner error";
    feedbackEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <strong>Atenção:</strong> Não abrimos aos ${sched.dayName}s. Por favor, escolha outro dia.`;
    if (timeInput) timeInput.disabled = true;
    return;
  }

  const [openH, openM] = (sched.openTime || "16:00").split(":").map(Number);
  const [closeH, closeM] = (sched.closeTime || "22:30").split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  // Se o cliente selecionou hoje e o atendimento de hoje já encerrou
  if (isToday && currentMinutes >= closeMinutes) {
    feedbackEl.className = "sched-feedback-banner error";
    feedbackEl.innerHTML = `<i class="fa-solid fa-clock"></i> <strong>Atenção:</strong> O atendimento de hoje já encerrou às ${sched.closeTime}. Escolha amanhã ou outra data!`;
    if (timeInput) timeInput.disabled = true;
    return;
  }

  feedbackEl.className = "sched-feedback-banner success";
  let infoExtra = "";
  if (isToday && currentMinutes < openMinutes) {
    infoExtra = ` (Abre hoje às ${sched.openTime})`;
  } else if (isToday) {
    infoExtra = ` (Atendimento hoje até às ${sched.closeTime})`;
  }

  feedbackEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>${sched.dayName}:</strong> Atendimento das <strong>${sched.openTime} às ${sched.closeTime}</strong>${infoExtra}.`;
  
  if (timeInput) {
    timeInput.disabled = false;
    if (!timeInput.value) {
      if (isToday && currentMinutes >= openMinutes) {
        const nextMin = Math.min(closeMinutes - 15, currentMinutes + 45);
        const h = Math.floor(nextMin / 60);
        const min = nextMin % 60;
        timeInput.value = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      } else {
        timeInput.value = sched.openTime;
      }
    }
  }
};

// ==============================================================================
// 6. RENDERIZAÇÃO DOS KITS DE SALGADOS
// ==============================================================================
function renderKits() {
  const grid = document.getElementById("kits-grid");
  if (!grid) return;

  grid.innerHTML = "";
  const kits = getKitsCatalog();

  if (kits.length === 0) {
    grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 2rem;">Nenhum kit disponível no momento.</p>`;
    return;
  }

  kits.forEach(kit => {
    const card = document.createElement("div");
    card.className = "kit-card";
    const stepVal = kit.passo_quantidade || 10;
    const kitImg = kit.image || (window.DEFAULT_IMAGE_PLACEHOLDERS && window.DEFAULT_IMAGE_PLACEHOLDERS.kit) || "";

    card.innerHTML = `
      <div class="kit-card-media">
        <img src="${kitImg}" alt="${kit.name}" class="kit-card-img" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'200\\' fill=\\'%231e293b\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%230f172a\\'/><text x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'36\\'>🥟</text></svg>'">
        <span class="kit-card-qty-badge"><i class="fa-solid fa-boxes-stacked"></i> ${kit.quantity} Salgadinhos</span>
      </div>
      <div class="kit-badge-banner">
        <div class="kit-title-group">
          <h3>${kit.name}</h3>
        </div>
        <div class="kit-price-tag">${formatBRL(kit.price)}</div>
      </div>
      <div class="kit-body">
        <ul class="kit-features">
          <li><i class="fa-solid fa-check"></i> Escolha livre entre sabores disponíveis</li>
          <li><i class="fa-solid fa-check"></i> Montagem de sabores de ${stepVal} em ${stepVal} un</li>
          <li><i class="fa-solid fa-check"></i> Fritos na hora, sequinhos e crocantes</li>
        </ul>
        <button class="btn-customize-kit" onclick="openKitCustomizer('${kit.id}')">
          <i class="fa-solid fa-sliders"></i> Montar Sabores do Kit
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ==============================================================================
// 6.0. RENDERIZAÇÃO DOS COMBOS PROMOCIONAIS COM DESCONTO REAL
// ==============================================================================
function renderCombos() {
  const grid = document.getElementById("combos-grid");
  const section = document.getElementById("section-combos");
  if (!grid || !section) return;

  const combos = getCombosCatalog();

  if (combos.length === 0) {
    section.style.display = "none";
    grid.innerHTML = "";
    return;
  }

  section.style.display = "block";
  grid.innerHTML = "";

  combos.forEach(combo => {
    const card = document.createElement("div");
    card.className = "combo-card";

    const badge = combo.badge || "Economia Real 🔥";
    const regularVal = combo.regularPrice || combo.price;
    const finalVal = combo.price;
    const savings = Math.max(0, regularVal - finalVal);
    const pct = regularVal > 0 ? Math.round((savings / regularVal) * 100) : 0;
    const comboImg = combo.image || (window.DEFAULT_IMAGE_PLACEHOLDERS && window.DEFAULT_IMAGE_PLACEHOLDERS.combo) || "";

    let itemsHtml = (combo.items || []).map(i => {
      let icon = "fa-tag";
      if (i.type === "kit") icon = "fa-boxes-stacked";
      else if (i.type === "product") icon = "fa-bottle-water";
      else if (i.type === "sauce") icon = "fa-bowl-food";
      return `
        <div class="combo-item-line">
          <i class="fa-solid ${icon}"></i>
          <span><strong>${i.quantity}x</strong> ${i.name}</span>
        </div>
      `;
    }).join("");

    card.innerHTML = `
      <div class="combo-card-media">
        <img src="${comboImg}" alt="${combo.name}" class="combo-card-img" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'200\\' fill=\\'%231e293b\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%231c1917\\'/><text x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'36\\'>🔥</text></svg>'">
        <span class="combo-badge-pill">${badge}</span>
      </div>

      <div class="combo-header-banner">
        <h3 class="combo-title" style="padding-right: 0;">${combo.name}</h3>
        ${combo.description ? `<p class="combo-desc">${combo.description}</p>` : ''}
      </div>

      <div class="combo-body">
        <div class="combo-items-box">
          <div class="combo-items-box-title"><i class="fa-solid fa-circle-check"></i> Itens Inclusos no Combo:</div>
          ${itemsHtml}
        </div>

        <div class="combo-pricing-container">
          <div class="combo-comparison-row">
            <span class="combo-regular-label">Comprando separado:</span>
            <span class="combo-regular-price">${formatBRL(regularVal)}</span>
          </div>
          <div class="combo-final-row">
            <span class="combo-final-label">Preço exclusivo no Combo:</span>
            <span class="combo-final-price">${formatBRL(finalVal)}</span>
          </div>
          <div class="combo-savings-banner">
            <i class="fa-solid fa-piggy-bank"></i> Você economiza ${formatBRL(savings)} (${pct}% OFF)!
          </div>
        </div>

        <button class="btn-order-combo" onclick="orderCombo('${combo.id}')">
          <i class="fa-solid fa-cart-plus"></i> Pedir Combo por ${formatBRL(finalVal)}
        </button>
      </div>
    `;

    grid.appendChild(card);
  });
}

window.orderCombo = function(comboId) {
  const combo = getCombosCatalog().find(c => c.id === comboId);
  if (!combo) return;

  const kitItem = (combo.items || []).find(i => i.type === "kit");

  if (kitItem) {
    activeCustomizingCombo = combo;

    const registeredKit = getKitsCatalog().find(k => k.id === kitItem.id);
    const kitQty = registeredKit ? registeredKit.quantity : (parseInt(kitItem.name.replace(/\D/g, '')) || 30);
    const stepVal = registeredKit ? (registeredKit.passo_quantidade || 10) : 10;

    activeCustomizingKit = {
      id: kitItem.id,
      name: kitItem.name,
      quantity: kitQty,
      passo_quantidade: stepVal,
      price: combo.price,
      isCombo: true
    };

    currentFlavorSelections = {};
    currentSauceSelections = {};

    const regularVal = combo.regularPrice || combo.price;
    const savings = Math.max(0, regularVal - combo.price);

    document.getElementById("modal-kit-name").textContent = `Sabores: ${combo.name}`;
    document.getElementById("modal-kit-base-price").textContent = `Combo Promocional: ${formatBRL(combo.price)} (Economia de ${formatBRL(savings)} garantida!)`;

    renderFlavorsList();
    renderSaucesUpsell();
    updateCustomizerProgress();

    document.getElementById("customizer-modal").classList.add("active");
    document.getElementById("customizer-backdrop").classList.add("active");
  } else {
    const regularVal = combo.regularPrice || combo.price;
    const savings = Math.max(0, regularVal - combo.price);

    cartItems.push({
      cartItemId: Date.now().toString(),
      type: "combo",
      comboId: combo.id,
      name: combo.name,
      badge: combo.badge,
      comboPrice: combo.price,
      regularPrice: regularVal,
      savings: savings,
      discountPercent: combo.discountPercent || Math.round((savings / regularVal) * 100),
      items: combo.items,
      flavors: [],
      flavorExtraCost: 0,
      saucesCost: 0,
      finalPrice: combo.price
    });

    updateCartGlobalUI();
    showToastNotification(`🔥 ${combo.name} adicionado ao pedido!`);
  }
};

// ==============================================================================
// 6.1. RENDERIZAÇÃO DE NAVEGAÇÃO DE CATEGORIAS E PRODUTOS AVULSOS
// ==============================================================================
function renderCategoryNav() {
  const container = document.getElementById("category-nav-container");
  if (!container) return;

  const combos = getCombosCatalog();
  const categories = getCategoriesCatalog();
  const products = getProductsCatalog();

  let html = "";
  if (combos.length > 0) {
    html += `<a href="#section-combos" class="category-nav-pill active"><i class="fa-solid fa-fire-flame-curved"></i> Combos Promocionais</a>`;
    html += `<a href="#section-kits" class="category-nav-pill"><i class="fa-solid fa-boxes-stacked"></i> Kits de Salgados</a>`;
  } else {
    html += `<a href="#section-kits" class="category-nav-pill active"><i class="fa-solid fa-boxes-stacked"></i> Kits de Salgados</a>`;
  }

  categories.forEach(cat => {
    const prods = products.filter(p => p.categoryId === cat.id);
    if (prods.length > 0) {
      html += `<a href="#cat-section-${cat.id}" class="category-nav-pill"><i class="fa-solid ${cat.icon || 'fa-tag'}"></i> ${cat.name}</a>`;
    }
  });

  container.innerHTML = html;

  container.querySelectorAll(".category-nav-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      container.querySelectorAll(".category-nav-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
    });
  });
}

function renderCustomCategories() {
  const container = document.getElementById("custom-categories-container");
  if (!container) return;

  const categories = getCategoriesCatalog();
  const products = getProductsCatalog();

  container.innerHTML = "";

  categories.forEach(cat => {
    const prods = products.filter(p => p.categoryId === cat.id);
    if (prods.length === 0) return;

    const section = document.createElement("section");
    section.className = "catalog-category-section";
    section.id = `cat-section-${cat.id}`;

    let prodsHtml = "";
    prods.forEach(prod => {
      const cartItem = cartItems.find(i => i.type === "product" && i.productId === prod.id);
      const qtyInCart = cartItem ? cartItem.quantity : 0;

      let actionHtml = "";
      if (qtyInCart > 0) {
        actionHtml = `
          <div class="product-qty-stepper">
            <button class="btn-stepper-btn minus" onclick="changeProductCartQty('${prod.id}', -1)" title="Diminuir"><i class="fa-solid fa-minus"></i></button>
            <span class="stepper-count">${qtyInCart}</span>
            <button class="btn-stepper-btn plus" onclick="changeProductCartQty('${prod.id}', 1)" title="Aumentar"><i class="fa-solid fa-plus"></i></button>
          </div>
        `;
      } else {
        actionHtml = `
          <button class="btn-add-product" onclick="changeProductCartQty('${prod.id}', 1)">
            <i class="fa-solid fa-plus"></i> Adicionar
          </button>
        `;
      }

      const prodImg = prod.image || (window.DEFAULT_IMAGE_PLACEHOLDERS && window.DEFAULT_IMAGE_PLACEHOLDERS.product) || "";

      prodsHtml += `
        <div class="product-card">
          <div class="product-card-media">
            <img src="${prodImg}" alt="${prod.name}" class="product-card-img" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'300\\' height=\\'180\\' fill=\\'%23cbd5e1\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23f8fafc\\'/><text x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'28\\'>🥤</text></svg>'">
          </div>
          <div class="product-card-info">
            <h3 class="product-card-title">${prod.name}</h3>
            ${prod.description ? `<p class="product-card-desc">${prod.description}</p>` : ''}
            <div class="product-card-price">${formatBRL(prod.price)}</div>
          </div>
          <div class="product-card-action">
            ${actionHtml}
          </div>
        </div>
      `;
    });

    section.innerHTML = `
      <div class="section-intro">
        <span class="category-badge-heading"><i class="fa-solid ${cat.icon || 'fa-tag'}"></i> ${cat.name}</span>
        <h2>${cat.name}</h2>
        ${cat.description ? `<p>${cat.description}</p>` : ''}
      </div>
      <div class="products-grid">
        ${prodsHtml}
      </div>
    `;

    container.appendChild(section);
  });
}

window.changeProductCartQty = function(productId, delta) {
  const prod = getProductsCatalog().find(p => p.id === productId);
  if (!prod) return;

  let existingItem = cartItems.find(i => i.type === "product" && i.productId === productId);

  if (existingItem) {
    existingItem.quantity += delta;
    if (existingItem.quantity <= 0) {
      cartItems = cartItems.filter(i => i !== existingItem);
    }
  } else if (delta > 0) {
    cartItems.push({
      cartItemId: Date.now().toString(),
      type: "product",
      productId: prod.id,
      categoryId: prod.categoryId,
      name: prod.name,
      price: prod.price,
      quantity: delta,
      description: prod.description
    });
    showToastNotification(`${prod.name} adicionado ao pedido!`);
  }

  renderCustomCategories();
  updateCartGlobalUI();
};

// ==============================================================================
// 7. LÓGICA DE MONTAGEM, VALIDAÇÃO, FILTROS E UPSELL DE MOLHOS DO KIT
// ==============================================================================
let flavorSearchTerm = "";
let flavorCategoryFilter = "all";

window.filterFlavorsList = function(val) {
  flavorSearchTerm = (val || "").trim();
  const clearBtn = document.getElementById("btn-clear-flavor-search");
  if (clearBtn) {
    clearBtn.style.display = flavorSearchTerm ? "flex" : "none";
  }
  renderFlavorsList();
};

window.clearFlavorSearch = function() {
  flavorSearchTerm = "";
  const input = document.getElementById("flavor-search-input");
  if (input) {
    input.value = "";
    input.focus();
  }
  const clearBtn = document.getElementById("btn-clear-flavor-search");
  if (clearBtn) {
    clearBtn.style.display = "none";
  }
  renderFlavorsList();
};

window.setFlavorCategoryFilter = function(filter) {
  flavorCategoryFilter = filter || "all";
  document.querySelectorAll(".flavor-filter-tag").forEach(tag => {
    if (tag.getAttribute("data-filter") === flavorCategoryFilter) {
      tag.classList.add("active");
    } else {
      tag.classList.remove("active");
    }
  });
  renderFlavorsList();
};

window.openKitCustomizer = function(kitId) {
  const kit = getKitsCatalog().find(k => k.id === kitId);
  if (!kit) return;

  activeCustomizingKit = kit;
  currentFlavorSelections = {};
  currentSauceSelections = {};

  // Reseta busca e filtros do modal
  flavorSearchTerm = "";
  flavorCategoryFilter = "all";
  const searchInput = document.getElementById("flavor-search-input");
  if (searchInput) searchInput.value = "";
  const clearBtn = document.getElementById("btn-clear-flavor-search");
  if (clearBtn) clearBtn.style.display = "none";
  document.querySelectorAll(".flavor-filter-tag").forEach(tag => {
    if (tag.getAttribute("data-filter") === "all") tag.classList.add("active");
    else tag.classList.remove("active");
  });

  const stepVal = kit.passo_quantidade || 10;
  document.getElementById("modal-kit-name").textContent = kit.name;
  document.getElementById("modal-kit-base-price").textContent = `Valor base: ${formatBRL(kit.price)} • Escolha de ${stepVal} em ${stepVal} un`;

  renderFlavorsList();
  renderSaucesUpsell();
  updateCustomizerProgress();

  document.getElementById("customizer-modal").classList.add("active");
  document.getElementById("customizer-backdrop").classList.add("active");
};

function closeKitCustomizer() {
  document.getElementById("customizer-modal").classList.remove("active");
  document.getElementById("customizer-backdrop").classList.remove("active");
  activeCustomizingKit = null;
  activeCustomizingCombo = null;
  currentFlavorSelections = {};
  currentSauceSelections = {};
  flavorSearchTerm = "";
  flavorCategoryFilter = "all";
}

function renderFlavorsList() {
  const container = document.getElementById("flavors-list-container");
  if (!container) return;

  const countBadge = document.getElementById("count-selected-flavors");
  if (countBadge) {
    const selectedCount = Object.values(currentFlavorSelections).filter(q => q > 0).length;
    countBadge.textContent = selectedCount;
  }

  container.innerHTML = "";
  const allFlavors = getFlavorsCatalog();
  const step = activeCustomizingKit ? (activeCustomizingKit.passo_quantidade || 10) : 10;

  if (allFlavors.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: #64748b; padding: 1.5rem;">Nenhum sabor disponível no momento.</p>`;
    return;
  }

  // Normalizador para busca sem acentos
  const norm = str => (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const termNorm = norm(flavorSearchTerm);

  const filteredFlavors = allFlavors.filter(flavor => {
    const currentQty = currentFlavorSelections[flavor.id] || 0;

    // 1. Filtro por Categoria / Tag
    if (flavorCategoryFilter === "selected" && currentQty <= 0) return false;
    if (flavorCategoryFilter === "tradicionais" && flavor.adicional_por_10 && flavor.adicional_por_10 > 0) return false;
    if (flavorCategoryFilter === "especiais" && (!flavor.adicional_por_10 || flavor.adicional_por_10 <= 0)) return false;

    // 2. Filtro de Texto
    if (termNorm) {
      const nameNorm = norm(flavor.name);
      return nameNorm.includes(termNorm);
    }
    return true;
  });

  if (filteredFlavors.length === 0) {
    container.innerHTML = `
      <div class="empty-flavor-search">
        <i class="fa-solid fa-cookie-bite"></i>
        <p>Nenhum sabor encontrado para <strong>"${escapeHtml(flavorSearchTerm || flavorCategoryFilter)}"</strong>.</p>
        <button type="button" class="btn-reset-flavor-search" onclick="clearFlavorSearch(); setFlavorCategoryFilter('all');">
          <i class="fa-solid fa-rotate-left"></i> Ver Todos os Sabores
        </button>
      </div>
    `;
    return;
  }

  filteredFlavors.forEach(flavor => {
    const currentQty = currentFlavorSelections[flavor.id] || 0;
    const card = document.createElement("div");
    card.className = `flavor-item-card ${currentQty > 0 ? "has-items" : ""}`;
    card.id = `flavor-card-${flavor.id}`;

    let badgesHtml = "";
    if (flavor.adicional_por_10 && flavor.adicional_por_10 > 0) {
      if (step === 5) {
        const adic5 = flavor.adicional_por_10 / 2;
        badgesHtml += `<span class="badge-extra-cost">+ ${formatBRL(adic5)} a cada 5 un (+ ${formatBRL(flavor.adicional_por_10)} a cada 10)</span>`;
      } else {
        badgesHtml += `<span class="badge-extra-cost">+ ${formatBRL(flavor.adicional_por_10)} a cada 10 un</span>`;
      }
    }
    if (flavor.limite_quantidade) {
      badgesHtml += `<span class="badge-limit">Máx: ${flavor.limite_quantidade} un por kit</span>`;
    }

    const flavorImg = flavor.image || (window.DEFAULT_IMAGE_PLACEHOLDERS && window.DEFAULT_IMAGE_PLACEHOLDERS.flavor) || "";

    card.innerHTML = `
      <div class="flavor-thumb-wrap">
        <img src="${flavorImg}" alt="${flavor.name}" class="flavor-thumb-img" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'56\\' height=\\'56\\' fill=\\'%23cbd5e1\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23f8fafc\\'/><text x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'22\\'>🥟</text></svg>'">
      </div>
      <div class="flavor-info">
        <div class="flavor-name">${flavor.name}</div>
        <div class="flavor-badges-row">${badgesHtml}</div>
      </div>
      <div class="stepper-control">
        <button class="btn-step" onclick="changeFlavorQty('${flavor.id}', -${step})" title="Diminuir ${step}">-${step}</button>
        <span class="step-value" id="qty-val-${flavor.id}">${currentQty}</span>
        <button class="btn-step" id="btn-plus-${flavor.id}" onclick="changeFlavorQty('${flavor.id}', ${step})" title="Adicionar ${step}">+${step}</button>
      </div>
    `;

    container.appendChild(card);
  });
}

// RENDERIZAÇÃO DO MÓDULO DE UPSELL DE MOLHOS AO FINAL DO KIT
function renderSaucesUpsell() {
  const grid = document.getElementById("sauces-suggestion-grid");
  if (!grid) return;

  grid.innerHTML = "";
  const sauces = getSaucesCatalog();

  if (sauces.length === 0) {
    grid.innerHTML = `<p style="text-align: center; color: #64748b; padding: 1rem;">Nenhum molho disponível no momento.</p>`;
    return;
  }

  sauces.forEach(sauce => {
    const currentQty = currentSauceSelections[sauce.id] || 0;
    const card = document.createElement("div");
    card.className = `sauce-upsell-card ${currentQty > 0 ? "has-sauce" : ""}`;
    card.id = `sauce-card-${sauce.id}`;

    const priceLabel = sauce.price > 0 ? `+ ${formatBRL(sauce.price)}` : "Sem custo";
    const sauceImg = sauce.image || (window.DEFAULT_IMAGE_PLACEHOLDERS && window.DEFAULT_IMAGE_PLACEHOLDERS.sauce) || "";

    card.innerHTML = `
      <div class="sauce-card-content">
        <div class="sauce-thumb-wrap">
          <img src="${sauceImg}" alt="${sauce.name}" class="sauce-thumb-img" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'46\\' height=\\'46\\' fill=\\'%23cbd5e1\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23f8fafc\\'/><text x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'18\\'>🥫</text></svg>'">
        </div>
        <div>
          <div class="sauce-upsell-title">${sauce.name}</div>
          <div class="sauce-upsell-price">${priceLabel}</div>
        </div>
      </div>
      <div class="stepper-control">
        <button class="btn-step" onclick="changeSauceQty('${sauce.id}', -1)">-</button>
        <span class="step-value" id="sauce-qty-${sauce.id}">${currentQty}</span>
        <button class="btn-step" onclick="changeSauceQty('${sauce.id}', 1)">+</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Alteração de quantidade de molho como sugestão do kit
window.changeSauceQty = function(sauceId, delta) {
  const currentQty = currentSauceSelections[sauceId] || 0;
  const newQty = Math.max(0, currentQty + delta);

  if (newQty === 0) {
    delete currentSauceSelections[sauceId];
  } else {
    currentSauceSelections[sauceId] = newQty;
  }

  const qtyEl = document.getElementById(`sauce-qty-${sauceId}`);
  if (qtyEl) qtyEl.textContent = newQty;

  const cardEl = document.getElementById(`sauce-card-${sauceId}`);
  if (cardEl) {
    if (newQty > 0) cardEl.classList.add("has-sauce");
    else cardEl.classList.remove("has-sauce");
  }

  updateCustomizerProgress();
};

// Alteração de quantidade de um sabor (+ ou -)
window.changeFlavorQty = function(flavorId, delta) {
  if (!activeCustomizingKit) return;

  const flavor = getFlavorsCatalog().find(f => f.id === flavorId);
  if (!flavor) return;

  const currentQty = currentFlavorSelections[flavorId] || 0;
  const currentTotalChosen = Object.values(currentFlavorSelections).reduce((sum, q) => sum + q, 0);
  const remainingInKit = activeCustomizingKit.quantity - currentTotalChosen;

  // Diminuição
  if (delta < 0) {
    const newQty = Math.max(0, currentQty + delta);
    if (newQty === 0) {
      delete currentFlavorSelections[flavorId];
    } else {
      currentFlavorSelections[flavorId] = newQty;
    }
  } 
  // Aumento
  else {
    // Não pode ultrapassar a quantidade restante do kit
    if (remainingInKit <= 0) {
      showAlertMessage("Você já atingiu a quantidade máxima deste kit!");
      return;
    }

    if (remainingInKit < delta) {
      showAlertMessage(`Restam apenas ${remainingInKit} salgadinhos para completar este kit (escolha de ${delta} em ${delta} unidades).`);
      return;
    }

    const allowedAdd = delta; // passo configurado no kit (ex: 5 ou 10)

    // Validação de limite especial do produto (ex: Coxinha de costela limite_quantidade: 10)
    if (flavor.limite_quantidade !== null && flavor.limite_quantidade !== undefined) {
      if (currentQty + allowedAdd > flavor.limite_quantidade) {
        showAlertMessage(`Limite máximo de ${flavor.limite_quantidade} unidades para ${flavor.name} neste kit.`);
        return;
      }
    }

    currentFlavorSelections[flavorId] = currentQty + allowedAdd;
  }

  // Atualizar contadores visuais
  const updatedQty = currentFlavorSelections[flavorId] || 0;
  const qtyEl = document.getElementById(`qty-val-${flavorId}`);
  if (qtyEl) qtyEl.textContent = updatedQty;

  const cardEl = document.getElementById(`flavor-card-${flavorId}`);
  if (cardEl) {
    if (updatedQty > 0) cardEl.classList.add("has-items");
    else cardEl.classList.remove("has-items");
  }

  updateCustomizerProgress();
};

function showAlertMessage(msg) {
  const alertEl = document.getElementById("alert-limit-msg");
  if (!alertEl) return;
  alertEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${msg}`;
  alertEl.style.display = "flex";
  setTimeout(() => {
    alertEl.style.display = "none";
  }, 2500);
}

// 8. CÁLCULO DINÂMICO DE ADICIONAIS, MOLHOS E VALIDAÇÃO DO KIT
function calculateKitExtras() {
  let flavorExtraCost = 0;
  let flavorBreakdown = [];

  for (const [flavorId, qty] of Object.entries(currentFlavorSelections)) {
    if (qty <= 0) continue;
    const flavor = getFlavorsCatalog().find(f => f.id === flavorId);
    if (!flavor) continue;

    // REGRA DE ADICIONAL PROPORCIONAL À QUANTIDADE ESCOLHIDA (adicional_por_10):
    // Ex: R$ 3,00 a cada 10 unidades -> 5 un = +R$ 1,50 (50%), 10 un = +R$ 3,00, 15 un = +R$ 4,50, 20 un = +R$ 6,00...
    if (flavor.adicional_por_10 && flavor.adicional_por_10 > 0) {
      const adicionalTotal = (qty / 10) * flavor.adicional_por_10;
      if (adicionalTotal > 0) {
        flavorExtraCost += adicionalTotal;
        flavorBreakdown.push({
          flavorName: flavor.name,
          qty,
          adicionalTotal
        });
      }
    }
  }

  // Molhos sugeridos no upsell (aumento de ticket médio)
  let saucesCost = 0;
  let selectedSaucesList = [];
  for (const [sauceId, qty] of Object.entries(currentSauceSelections)) {
    if (qty <= 0) continue;
    const sauce = getSaucesCatalog().find(s => s.id === sauceId);
    if (!sauce) continue;

    const subtotal = sauce.price * qty;
    saucesCost += subtotal;
    selectedSaucesList.push({
      id: sauceId,
      name: sauce.name,
      price: sauce.price,
      quantity: qty,
      subtotal: subtotal
    });
  }

  return {
    flavorExtraCost,
    flavorBreakdown,
    saucesCost,
    selectedSaucesList,
    totalExtras: flavorExtraCost + saucesCost
  };
}

function updateCustomizerProgress() {
  if (!activeCustomizingKit) return;

  const totalChosen = Object.values(currentFlavorSelections).reduce((sum, q) => sum + q, 0);
  const targetQty = activeCustomizingKit.quantity;
  const remaining = targetQty - totalChosen;

  // Textos da interface: "Selecionados: 40 de 50 | Restam: 10"
  const progressText = document.getElementById("progress-text");
  const remainingBadge = document.getElementById("remaining-text");
  const progressFill = document.getElementById("progress-fill");
  const btnConfirm = document.getElementById("btn-confirm-kit");
  const btnConfirmText = document.getElementById("btn-confirm-text");

  progressText.textContent = `Selecionados: ${totalChosen} de ${targetQty}`;

  const countBadge = document.getElementById("count-selected-flavors");
  if (countBadge) {
    countBadge.textContent = Object.values(currentFlavorSelections).filter(q => q > 0).length;
  }

  const pct = Math.min(100, Math.round((totalChosen / targetQty) * 100));
  progressFill.style.width = `${pct}%`;

  const { flavorExtraCost, saucesCost, selectedSaucesList, totalExtras } = calculateKitExtras();
  const kitTotal = activeCustomizingKit.price + totalExtras;

  if (remaining === 0) {
    remainingBadge.textContent = `Kit Completo (${targetQty} de ${targetQty})`;
    remainingBadge.className = "progress-remaining-badge completed";
    progressFill.classList.add("full");

    // Libera botão para conclusão
    btnConfirm.disabled = false;
    btnConfirm.classList.remove("disabled");

    if (selectedSaucesList.length > 0) {
      btnConfirmText.textContent = `Confirmar Kit com Molhos (${formatBRL(kitTotal)})`;
    } else {
      btnConfirmText.textContent = `Adicionar Kit ao Pedido (${formatBRL(kitTotal)})`;
    }
  } else {
    remainingBadge.textContent = `Restam: ${remaining}`;
    remainingBadge.className = "progress-remaining-badge";
    progressFill.classList.remove("full");

    // Bloqueia botão enquanto != quantidade do kit
    btnConfirm.disabled = true;
    btnConfirm.classList.add("disabled");
    btnConfirmText.textContent = `Faltam ${remaining} salgadinhos para concluir o kit`;
  }

  // Atualizar resumo de extras no rodapé do modal
  const extraRow = document.getElementById("customizer-extra-row");
  const extraVal = document.getElementById("customizer-extra-value");
  const totalVal = document.getElementById("customizer-total-price");

  if (totalExtras > 0) {
    extraRow.style.display = "flex";
    let extraDetails = [];
    if (flavorExtraCost > 0) extraDetails.push(`Sabores: + ${formatBRL(flavorExtraCost)}`);
    if (saucesCost > 0) extraDetails.push(`Molhos: + ${formatBRL(saucesCost)}`);
    extraVal.textContent = extraDetails.join(" | ");
  } else {
    extraRow.style.display = "none";
  }

  totalVal.textContent = formatBRL(kitTotal);
}

// Confirmar e adicionar kit ao carrinho
document.getElementById("btn-confirm-kit").addEventListener("click", () => {
  if (!activeCustomizingKit) return;

  const totalChosen = Object.values(currentFlavorSelections).reduce((sum, q) => sum + q, 0);
  if (totalChosen !== activeCustomizingKit.quantity) {
    showAlertMessage(`Por favor, complete exatamente ${activeCustomizingKit.quantity} salgadinhos antes de avançar.`);
    return;
  }

  const { flavorExtraCost, flavorBreakdown, saucesCost, selectedSaucesList, totalExtras } = calculateKitExtras();
  const finalKitPrice = activeCustomizingKit.price + totalExtras;

  // Montar objeto detalhado dos sabores escolhidos
  const selectedFlavorsList = [];
  for (const [flavorId, qty] of Object.entries(currentFlavorSelections)) {
    if (qty > 0) {
      const flavor = getFlavorsCatalog().find(f => f.id === flavorId);
      selectedFlavorsList.push({
        id: flavorId,
        name: flavor.name,
        quantity: qty
      });
    }
  }

  // Se estiver personalizando um Combo com Kit:
  if (activeCustomizingCombo) {
    const regularVal = activeCustomizingCombo.regularPrice || activeCustomizingCombo.price;
    const savings = Math.max(0, regularVal - activeCustomizingCombo.price);

    const comboCartItem = {
      cartItemId: Date.now().toString(),
      type: "combo",
      comboId: activeCustomizingCombo.id,
      name: activeCustomizingCombo.name,
      badge: activeCustomizingCombo.badge,
      comboPrice: activeCustomizingCombo.price,
      regularPrice: regularVal,
      savings: savings,
      discountPercent: activeCustomizingCombo.discountPercent || (regularVal > 0 ? Math.round((savings / regularVal) * 100) : 0),
      totalQuantity: activeCustomizingKit.quantity,
      flavors: selectedFlavorsList,
      sauces: selectedSaucesList,
      items: activeCustomizingCombo.items,
      flavorExtraCost: flavorExtraCost,
      saucesCost: saucesCost,
      finalPrice: activeCustomizingCombo.price + totalExtras,
      extrasBreakdown: flavorBreakdown
    };

    cartItems.push(comboCartItem);
    closeKitCustomizer();
    updateCartGlobalUI();
    showToastNotification(`🔥 ${activeCustomizingCombo.name} adicionado ao pedido!`);
    return;
  }

  const cartItem = {
    cartItemId: Date.now().toString(),
    type: "kit",
    kitId: activeCustomizingKit.id,
    kitName: activeCustomizingKit.name,
    basePrice: activeCustomizingKit.price,
    flavorExtraCost: flavorExtraCost,
    saucesCost: saucesCost,
    finalPrice: finalKitPrice,
    totalQuantity: activeCustomizingKit.quantity,
    flavors: selectedFlavorsList,
    sauces: selectedSaucesList,
    extrasBreakdown: flavorBreakdown
  };

  cartItems.push(cartItem);
  closeKitCustomizer();
  updateCartGlobalUI();
  showToastNotification("Kit adicionado ao seu pedido com sucesso!");
});

// ==============================================================================
// 10. CONTROLE DO CARRINHO E CHECKOUT
// ==============================================================================
window.removeCartItem = function(cartItemId) {
  cartItems = cartItems.filter(item => item.cartItemId !== cartItemId);
  renderCustomCategories();
  updateCartGlobalUI();
};

function calculateOrderTotal() {
  return cartItems.reduce((acc, item) => {
    if (item.type === "kit" || item.type === "combo") return acc + item.finalPrice;
    if (item.type === "sauce") return acc + item.price;
    if (item.type === "product") return acc + (item.price * item.quantity);
    return acc;
  }, 0);
}

function getCartItemsCount() {
  return cartItems.reduce((acc, item) => {
    if (item.type === "product") return acc + item.quantity;
    return acc + 1;
  }, 0);
}

function updateCartGlobalUI() {
  const subtotal = calculateOrderTotal();
  const count = getCartItemsCount();

  const floatingBar = document.getElementById("floating-cart-bar");
  const countBadge = document.getElementById("bar-items-count");
  const totalBar = document.getElementById("bar-items-total");

  if (count > 0) {
    floatingBar.style.display = "flex";
    countBadge.textContent = count;
    totalBar.textContent = formatBRL(subtotal);
  } else {
    floatingBar.style.display = "none";
  }

  // Resumo Financeiro do Drawer (Subtotal + Taxa de Entrega + Total)
  const drawerSubtotal = document.getElementById("drawer-subtotal-amount");
  const drawerDelivery = document.getElementById("drawer-delivery-amount");
  const drawerDeliveryLine = document.getElementById("drawer-delivery-summary-line");
  const drawerDeliveryKmLabel = document.getElementById("drawer-delivery-km-label");
  const drawerTotal = document.getElementById("drawer-total-amount");

  const fulfillmentRadio = document.querySelector('input[name="order-fulfillment"]:checked');
  const fulfillment = fulfillmentRadio ? fulfillmentRadio.value : "Entrega";
  const isPickup = fulfillment === "Retirada";

  let deliveryFee = 0;
  let distanceKm = 2.0;

  if (isPickup) {
    if (drawerDeliveryLine) drawerDeliveryLine.style.display = "flex";
    if (drawerDeliveryKmLabel) drawerDeliveryKmLabel.textContent = "Balcão";
    if (drawerDelivery) {
      drawerDelivery.textContent = "Grátis (Retirada)";
      drawerDelivery.style.color = "#15803d";
    }
  } else {
    const feeInfo = getCurrentDeliveryCalculation();
    deliveryFee = feeInfo.allowed ? feeInfo.fee : 0;

    if (drawerDeliveryLine) drawerDeliveryLine.style.display = "flex";
    if (drawerDeliveryKmLabel) {
      if (feeInfo.status === "waiting_number") {
        drawerDeliveryKmLabel.textContent = "Aguardando Nº";
      } else if (feeInfo.status === "empty") {
        drawerDeliveryKmLabel.textContent = "A calcular";
      } else if (feeInfo.neighborhoodName) {
        drawerDeliveryKmLabel.textContent = feeInfo.neighborhoodName;
      } else if (feeInfo.distanceKm) {
        drawerDeliveryKmLabel.textContent = `${feeInfo.distanceKm.toFixed(1)} km`;
      } else {
        drawerDeliveryKmLabel.textContent = "Entrega";
      }
    }
    if (drawerDelivery) {
      if (feeInfo.status === "waiting_number") {
        drawerDelivery.textContent = "Informe o Nº";
        drawerDelivery.style.color = "#d97706";
      } else if (feeInfo.status === "empty") {
        drawerDelivery.textContent = "Digite o endereço";
        drawerDelivery.style.color = "#64748b";
      } else if (feeInfo.allowed) {
        drawerDelivery.textContent = formatBRL(deliveryFee);
        drawerDelivery.style.color = "#0f172a";
      } else {
        drawerDelivery.textContent = "Indisponível";
        drawerDelivery.style.color = "#dc2626";
      }
    }
  }

  const finalTotal = subtotal + (isPickup ? 0 : deliveryFee);

  if (drawerSubtotal) drawerSubtotal.textContent = formatBRL(subtotal);
  if (drawerTotal) drawerTotal.textContent = formatBRL(finalTotal);

  if (typeof updatePixCheckoutUI === "function") {
    updatePixCheckoutUI();
  }

  renderCartDrawerItems();
}

function renderCartDrawerItems() {
  const container = document.getElementById("order-items-container");
  if (!container) return;

  if (cartItems.length === 0) {
    container.innerHTML = `<div class="empty-order-msg"><i class="fa-solid fa-basket-shopping" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 8px;"></i><p>Nenhum item adicionado ainda.<br>Escolha seu combo, kit de salgados ou bebidas para começar.</p></div>`;
    return;
  }

  let html = "";
  cartItems.forEach(item => {
    if (item.type === "kit") {
      let flavorsText = item.flavors.map(f => `• ${f.quantity}x ${f.name}`).join("<br>");
      
      let extrasHtml = "";
      if (item.flavorExtraCost > 0) {
        extrasHtml += `<div style="color: #b45309; font-weight: 700; margin-top: 4px;">Adicionais de sabores nobres: + ${formatBRL(item.flavorExtraCost)}</div>`;
      }
      
      let saucesHtml = "";
      if (item.sauces && item.sauces.length > 0) {
        const saucesList = item.sauces.map(s => `• ${s.quantity}x ${s.name} (+ ${formatBRL(s.subtotal)})`).join("<br>");
        saucesHtml = `<div style="color: #047857; font-weight: 700; margin-top: 6px; border-top: 1px dashed #e2e8f0; padding-top: 4px;">
          🥫 Molhos Adicionados:<br>${saucesList}
        </div>`;
      }

      html += `
        <div class="cart-item-block">
          <div class="cart-item-header">
            <span class="cart-item-title">${item.kitName}</span>
            <span class="cart-item-price">${formatBRL(item.finalPrice)}</span>
          </div>
          <div class="cart-item-flavors-breakdown">
            <strong>Sabores escolhidos (${item.totalQuantity} un):</strong><br>
            ${flavorsText}
            ${extrasHtml}
            ${saucesHtml}
          </div>
          <button class="btn-remove-item" onclick="removeCartItem('${item.cartItemId}')">
            <i class="fa-solid fa-trash-can"></i> Remover Kit
          </button>
        </div>
      `;
    } else if (item.type === "combo") {
      let itemsListHtml = (item.items || []).map(i => `• ${i.quantity}x ${i.name}`).join("<br>");
      let flavorsHtml = "";
      if (item.flavors && item.flavors.length > 0) {
        flavorsHtml = `<div style="margin-top:4px; color:#475569;"><strong>Sabores dos salgados:</strong><br>` + item.flavors.map(f => `  - ${f.quantity}x ${f.name}`).join("<br>") + `</div>`;
      }
      let extrasHtml = "";
      if (item.flavorExtraCost > 0) {
        extrasHtml += `<div style="color: #b45309; font-weight: 700; margin-top: 4px;">Adicionais de sabores nobres: + ${formatBRL(item.flavorExtraCost)}</div>`;
      }
      if (item.saucesCost > 0) {
        extrasHtml += `<div style="color: #047857; font-weight: 700; margin-top: 4px;">Molhos extras: + ${formatBRL(item.saucesCost)}</div>`;
      }

      html += `
        <div class="cart-item-block">
          <div class="cart-item-header">
            <span class="cart-item-title"><i class="fa-solid fa-fire" style="color:#ef4444;"></i> ${item.name}</span>
            <span class="cart-item-price">${formatBRL(item.finalPrice)}</span>
          </div>
          <div style="background:#dcfce7; color:#15803d; font-size:0.78rem; font-weight:800; padding:3px 8px; border-radius:6px; margin: 4px 0 6px; display:inline-block;">
            ⚡ Economia de ${formatBRL(item.savings)} (${item.discountPercent || 15}% OFF)
          </div>
          <div class="cart-item-flavors-breakdown">
            <strong>Composição do Combo:</strong><br>
            ${itemsListHtml}
            ${flavorsHtml}
            ${extrasHtml}
          </div>
          <button class="btn-remove-item" onclick="removeCartItem('${item.cartItemId}')">
            <i class="fa-solid fa-trash-can"></i> Remover Combo
          </button>
        </div>
      `;
    } else if (item.type === "product") {
      html += `
        <div class="cart-item-block">
          <div class="cart-item-header">
            <span class="cart-item-title">${item.name}</span>
            <span class="cart-item-price">${formatBRL(item.price * item.quantity)}</span>
          </div>
          <div class="cart-item-product-row">
            <span class="cart-item-unit-price">${formatBRL(item.price)} cada</span>
            <div class="product-qty-stepper compact">
              <button class="btn-stepper-btn minus" onclick="changeProductCartQty('${item.productId}', -1)" title="Diminuir"><i class="fa-solid fa-minus"></i></button>
              <span class="stepper-count">${item.quantity}</span>
              <button class="btn-stepper-btn plus" onclick="changeProductCartQty('${item.productId}', 1)" title="Aumentar"><i class="fa-solid fa-plus"></i></button>
            </div>
          </div>
          <button class="btn-remove-item" onclick="removeCartItem('${item.cartItemId}')">
            <i class="fa-solid fa-trash-can"></i> Remover Item
          </button>
        </div>
      `;
    }
  });

  container.innerHTML = html;
}

// Abertura e fechamento das gavetas
window.openCheckoutDrawer = function() {
  document.getElementById("checkout-drawer").classList.add("active");
  document.getElementById("checkout-backdrop").classList.add("active");
  prefillCustomerCheckoutForm();
  if (typeof applyStoreOperatingHoursRules === "function") {
    applyStoreOperatingHoursRules();
  }
  if (typeof updatePixCheckoutUI === "function") {
    updatePixCheckoutUI();
  }
};

document.getElementById("btn-open-cart-drawer").addEventListener("click", window.openCheckoutDrawer);
document.getElementById("btn-close-drawer").addEventListener("click", closeCheckoutDrawer);
document.getElementById("checkout-backdrop").addEventListener("click", closeCheckoutDrawer);
document.getElementById("btn-close-customizer").addEventListener("click", closeKitCustomizer);
document.getElementById("customizer-backdrop").addEventListener("click", closeKitCustomizer);

function closeCheckoutDrawer() {
  const drawer = document.getElementById("checkout-drawer");
  const backdrop = document.getElementById("checkout-backdrop");
  if (drawer) drawer.classList.remove("active");
  if (backdrop) backdrop.classList.remove("active");
}
window.closeCheckoutDrawer = closeCheckoutDrawer;
window.closeCartDrawer = closeCheckoutDrawer;


// ==============================================================================
// 10.4 BUSCA AUTOMÁTICA DE ENDEREÇO POR CEP (VIACEP API)
// ==============================================================================
let isSearchingCep = false;

window.onCepInput = function(inputEl) {
  let val = inputEl.value.replace(/\D/g, "");
  if (val.length > 8) val = val.substring(0, 8);

  // Aplica máscara 00000-000
  if (val.length > 5) {
    inputEl.value = `${val.substring(0, 5)}-${val.substring(5)}`;
  } else {
    inputEl.value = val;
  }

  // Dispara busca automática ao completar os 8 dígitos
  if (val.length === 8) {
    searchAddressByCep(val);
  } else {
    const feedback = document.getElementById("cep-feedback-status");
    if (feedback) feedback.style.display = "none";
  }
};

window.onCepBlur = function(inputEl) {
  const val = inputEl.value.replace(/\D/g, "");
  if (val.length === 8 && !isSearchingCep) {
    searchAddressByCep(val);
  }
};

window.searchAddressByCep = async function(customCep) {
  if (isSearchingCep) return;

  const cepInput = document.getElementById("cust-cep");
  const rawVal = customCep || (cepInput ? cepInput.value : "");
  const cleanCep = rawVal.replace(/\D/g, "");

  const feedback = document.getElementById("cep-feedback-status");
  const btn = document.getElementById("btn-search-cep");
  const btnText = document.getElementById("btn-search-cep-text");

  if (!cleanCep || cleanCep.length !== 8) {
    if (feedback) {
      feedback.className = "cep-feedback-status error";
      feedback.style.display = "flex";
      feedback.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Digite um CEP com 8 números (ex: 26010-000).`;
    }
    if (cepInput) cepInput.focus();
    return;
  }

  isSearchingCep = true;
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = "Buscando...";
  if (feedback) {
    feedback.className = "cep-feedback-status loading";
    feedback.style.display = "flex";
    feedback.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Buscando endereço na web para o CEP ${cleanCep.substring(0, 5)}-${cleanCep.substring(5)}...`;
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.erro) {
      if (feedback) {
        feedback.className = "cep-feedback-status error";
        feedback.style.display = "flex";
        feedback.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> CEP não encontrado. Preencha o endereço abaixo manualmente.`;
      }
      document.getElementById("cust-street")?.focus();
      return;
    }

    // Preenche automaticamente: Rua, Bairro e Município
    const streetInput = document.getElementById("cust-street");
    const neighborhoodInput = document.getElementById("cust-neighborhood-input");
    const cityInput = document.getElementById("cust-city");
    const numberInput = document.getElementById("cust-number");

    if (streetInput && data.logradouro) {
      streetInput.value = data.logradouro;
    }
    if (neighborhoodInput && data.bairro) {
      neighborhoodInput.value = data.bairro;
    }
    if (cityInput && data.localidade) {
      cityInput.value = data.localidade;
    }

    const currentNumber = (document.getElementById("cust-number")?.value || "").trim();

    // REGRA DE NEGÓCIO: O valor do frete SÓ É CALCULADO após a digitação do número da residência!
    if (!currentNumber) {
      currentRouteCalculation = null;
      setDeliveryCardWaitingNumber(data.logradouro || "", data.bairro || "");
      updateCartGlobalUI();

      if (feedback) {
        feedback.className = "cep-feedback-status success";
        feedback.style.display = "flex";
        feedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> Endereço localizado! Agora <strong>digite o número da sua residência</strong> para calcular o frete exato.`;
      }

      // Direciona o foco para o campo número para preenchimento manual rápido
      if (numberInput) {
        setTimeout(() => {
          numberInput.focus();
        }, 80);
      }
      return;
    }

    // Se já havia número preenchido previamente, calcula a rota exata com o número
    updateDeliveryCalculationFromRoute({
      cep: cleanCep,
      street: data.logradouro || "",
      number: currentNumber,
      neighborhood: data.bairro || "",
      city: data.localidade || "Nova Iguaçu",
      requireNumber: true
    });

    if (feedback) {
      feedback.className = "cep-feedback-status success";
      feedback.style.display = "flex";
      feedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> Endereço preenchido com sucesso! Rota calculada com o Nº ${currentNumber}.`;
    }

  } catch (err) {
    console.warn("Falha na consulta do CEP online:", err);
    if (feedback) {
      feedback.className = "cep-feedback-status error";
      feedback.style.display = "flex";
      feedback.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Não foi possível consultar o CEP na web. Preencha o endereço abaixo manualmente.`;
    }
    document.getElementById("cust-street")?.focus();
  } finally {
    isSearchingCep = false;
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = "Buscar CEP";
  }
};

// ==============================================================================
// 10.5 CÁLCULO E CONTROLE DA TAXA DE ENTREGA (BAIRRO, REGIÃO E ROTA REAL)
// ==============================================================================
let currentRouteCalculation = null;
let neighborhoodDebounceTimer = null;
let addressFieldsDebounceTimer = null;

function initCustomerDeliveryNeighborhoods() {
  // Lista suspensa removida do módulo do cliente a pedido do usuário (preenchimento direto ou automático via CEP)
}

// Auxiliar: exibe o estado de espera pelo número da residência no card de frete
function setDeliveryCardWaitingNumber(street = "", neighborhood = "") {
  const feeCard = document.getElementById("delivery-calc-card");
  const titleEl = document.getElementById("delivery-distance-title");
  const etaEl = document.getElementById("delivery-eta-text");
  const badgeFeeEl = document.getElementById("delivery-fee-badge-amount");
  const warningEl = document.getElementById("delivery-warning-badge");

  if (feeCard) feeCard.className = "delivery-fee-badge-card waiting-number";
  if (titleEl) {
    if (street) {
      titleEl.innerHTML = `🛵 Aguardando número: <strong>${street}${neighborhood ? ' (' + neighborhood + ')' : ''}</strong>`;
    } else if (neighborhood) {
      titleEl.innerHTML = `🛵 Aguardando número em <strong>${neighborhood}</strong>`;
    } else {
      titleEl.innerHTML = `🛵 <strong>Aguardando número da residência</strong>`;
    }
  }
  if (etaEl) {
    etaEl.innerHTML = `<i class="fa-solid fa-arrow-up"></i> Digite o <strong>número da residência</strong> no campo acima para calcular o frete exato.`;
  }
  if (badgeFeeEl) {
    badgeFeeEl.textContent = "Informe o Nº";
  }
  if (warningEl) {
    warningEl.style.display = "none";
  }
}

// Disparado imediatamente quando o cliente digita o número da residência ou altera o logradouro
window.onCustomerAddressFieldChange = function() {
  clearTimeout(addressFieldsDebounceTimer);
  addressFieldsDebounceTimer = setTimeout(() => {
    const cep = (document.getElementById("cust-cep")?.value || "").trim();
    const street = (document.getElementById("cust-street")?.value || "").trim();
    const number = (document.getElementById("cust-number")?.value || "").trim();
    const neighborhood = (document.getElementById("cust-neighborhood-input")?.value || "").trim();
    const city = (document.getElementById("cust-city")?.value || "Nova Iguaçu").trim();

    // REGRA DE NEGÓCIO: Só calcula o frete APÓS a digitação do número da residência!
    if (!number) {
      currentRouteCalculation = null;
      setDeliveryCardWaitingNumber(street, neighborhood);
      updateCartGlobalUI();
      return;
    }

    if (!street && !neighborhood && !cep) return;

    updateDeliveryCalculationFromRoute({
      cep,
      street,
      number,
      neighborhood,
      city,
      requireNumber: true
    });
  }, 300);
};

window.updateDeliveryCalculationFromRoute = async function(addressObj) {
  const feeCard = document.getElementById("delivery-calc-card");
  const titleEl = document.getElementById("delivery-distance-title");
  const etaEl = document.getElementById("delivery-eta-text");
  const badgeFeeEl = document.getElementById("delivery-fee-badge-amount");
  const warningEl = document.getElementById("delivery-warning-badge");

  // Se o número não foi informado, mantém estado de espera
  if (!addressObj.number) {
    currentRouteCalculation = null;
    setDeliveryCardWaitingNumber(addressObj.street, addressObj.neighborhood);
    updateCartGlobalUI();
    return {
      allowed: false,
      status: "waiting_number",
      fee: 0,
      formattedFee: "Informe o Nº",
      distanceKm: 0
    };
  }

  if (etaEl) {
    etaEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Calculando rota exata para Nº ${addressObj.number}...`;
  }

  const feeInfo = await VIPDatabase.calculateRealRouteDistance({
    ...addressObj,
    requireNumber: true
  });
  currentRouteCalculation = feeInfo;

  if (feeInfo.status === "waiting_number") {
    currentRouteCalculation = null;
    setDeliveryCardWaitingNumber(addressObj.street, addressObj.neighborhood);
    updateCartGlobalUI();
    return feeInfo;
  }

  if (feeInfo.allowed) {
    if (feeCard) feeCard.className = "delivery-fee-badge-card active-fee";
    if (titleEl) {
      let locText = "";
      if (addressObj.street) {
        locText = addressObj.street + (addressObj.number ? `, Nº ${addressObj.number}` : "");
        if (addressObj.neighborhood) locText += ` (${addressObj.neighborhood})`;
      } else if (addressObj.neighborhood) {
        locText = addressObj.neighborhood + (addressObj.number ? ` - Nº ${addressObj.number}` : "");
      } else {
        locText = `Residência Nº ${addressObj.number}`;
      }
      titleEl.innerHTML = `🛵 Entrega para <strong>${locText}</strong>`;
    }
    if (etaEl) {
      const sourceTag = (feeInfo.sourceUsed === "google_maps" || feeInfo.sourceUsed === "google_maps_routes")
        ? " (Google Maps)"
        : (feeInfo.sourceUsed === "osrm_route" ? " (Rota de Trânsito)" : "");
      const timeDisplay = feeInfo.duration || feeInfo.eta || "25-35 min";
      etaEl.textContent = `Distância exata: ~${feeInfo.distanceKm.toFixed(1)} km${sourceTag} • Previsão: ${timeDisplay}`;
    }
    if (badgeFeeEl) badgeFeeEl.textContent = feeInfo.formattedFee;
    if (warningEl) warningEl.style.display = "none";
  } else {
    if (feeCard) feeCard.className = "delivery-fee-badge-card outside-radius";
    if (titleEl) titleEl.innerHTML = `⚠️ <strong>Fora do Raio de Entrega</strong>`;
    if (etaEl) etaEl.textContent = `Distância da rota: ~${feeInfo.distanceKm.toFixed(1)} km (Limite da loja: 15 km)`;
    if (badgeFeeEl) badgeFeeEl.textContent = "Não entrega";
    if (warningEl) {
      warningEl.style.display = "block";
      warningEl.textContent = feeInfo.reason || `A distância de ${feeInfo.distanceKm.toFixed(1)} km ultrapassa o raio máximo atendido de 15 km.`;
    }
  }

  updateCartGlobalUI();
  return feeInfo;
};

window.onCustomerNeighborhoodTyping = function(val) {
  const neighborhood = (val || "").trim();
  const street = (document.getElementById("cust-street")?.value || "").trim();
  const number = (document.getElementById("cust-number")?.value || "").trim();
  const cityEl = document.getElementById("cust-city");
  const city = cityEl ? cityEl.value.trim() : "Nova Iguaçu";
  const cep = (document.getElementById("cust-cep")?.value || "").trim();

  if (!neighborhood || neighborhood.length < 2) {
    currentRouteCalculation = null;
    setDeliveryCardWaitingNumber(street, "");
    updateCartGlobalUI();
    return;
  }

  // REGRA DE NEGÓCIO: Sem o número da residência, NÃO calcula o frete!
  if (!number) {
    currentRouteCalculation = null;
    setDeliveryCardWaitingNumber(street, neighborhood);
    updateCartGlobalUI();
    return;
  }

  // Com o número preenchido, calcula a rota completa de condução real
  clearTimeout(neighborhoodDebounceTimer);
  neighborhoodDebounceTimer = setTimeout(() => {
    updateDeliveryCalculationFromRoute({ cep, street, number, neighborhood, city, requireNumber: true });
  }, 350);
};

function getCurrentDeliveryCalculation() {
  const fulfillmentRadio = document.querySelector('input[name="order-fulfillment"]:checked');
  const fulfillment = fulfillmentRadio ? fulfillmentRadio.value : "Entrega";
  if (fulfillment === "Retirada") {
    return {
      allowed: true,
      fee: 0,
      distanceKm: 0,
      formattedFee: "Grátis (Retirada)",
      status: "pickup"
    };
  }

  // REGRA DE NEGÓCIO: O frete só é calculado após a digitação do número da residência!
  const number = (document.getElementById("cust-number")?.value || "").trim();
  if (!number) {
    return {
      allowed: false,
      status: "waiting_number",
      fee: 0,
      distanceKm: 0,
      formattedFee: "Informe o Nº",
      badgeText: "Aguardando número da residência"
    };
  }

  if (currentRouteCalculation && currentRouteCalculation.allowed) {
    return currentRouteCalculation;
  }

  return {
    allowed: false,
    status: "waiting_number",
    fee: 0,
    distanceKm: 0,
    formattedFee: "Informe o Nº",
    badgeText: "Aguardando número da residência"
  };
}

// Condicionais de Entrega / Retirada e Pagamento
document.querySelectorAll('input[name="order-fulfillment"]').forEach(radio => {
  radio.addEventListener("change", (e) => {
    const isPickup = e.target.value === "Retirada";
    document.getElementById("delivery-address-group").style.display = isPickup ? "none" : "block";
    document.getElementById("pickup-info-box").style.display = isPickup ? "flex" : "none";
    updateCartGlobalUI();
  });
});

document.getElementById("cust-payment").addEventListener("change", (e) => {
  document.getElementById("cash-change-group").style.display = e.target.value === "Dinheiro" ? "block" : "none";
  if (typeof updatePixCheckoutUI === "function") {
    updatePixCheckoutUI();
  }
});

// ==============================================================================
// 10.1 GERENCIADOR DE PAGAMENTO VIA PIX DINÂMICO NO CHECKOUT
// ==============================================================================
let currentPixPayload = "";

window.updatePixCheckoutUI = function() {
  const pixContainer = document.getElementById("pix-checkout-container");
  const paymentSelect = document.getElementById("cust-payment");
  if (!pixContainer || !paymentSelect) return;

  if (paymentSelect.value !== "Pix") {
    pixContainer.style.display = "none";
    return;
  }

  pixContainer.style.display = "block";

  const fulfillment = document.querySelector('input[name="order-fulfillment"]:checked')?.value || "Entrega";
  const subtotal = calculateOrderTotal();
  const feeInfo = getCurrentDeliveryCalculation();
  const deliveryFee = (fulfillment === "Entrega" && feeInfo && feeInfo.allowed) ? feeInfo.fee : 0;
  const total = subtotal + deliveryFee;

  const cfg = getStoreConfig();
  const pixDisplayTotal = document.getElementById("pix-display-total");
  if (pixDisplayTotal) {
    pixDisplayTotal.textContent = formatBRL(total);
  }

  if (typeof VIPPix !== "undefined") {
    currentPixPayload = VIPPix.generatePayload({
      key: cfg.pixKey || "5521986758102",
      keyType: cfg.pixKeyType || "telefone",
      name: cfg.pixReceiverName || cfg.name || "Salgados VIP",
      city: cfg.pixCity || "Nova Iguacu",
      amount: total,
      txid: "VIP" + Math.floor(100 + Math.random() * 900)
    });

    const qrImg = document.getElementById("pix-qr-img");
    if (qrImg) {
      qrImg.src = VIPPix.getQrCodeUrl(currentPixPayload, 260);
    }

    const copyInput = document.getElementById("pix-copy-paste-input");
    if (copyInput) {
      copyInput.value = currentPixPayload;
    }
  }

  const infoEl = document.getElementById("pix-beneficiary-info");
  if (infoEl) {
    infoEl.innerHTML = `
      <div><strong>Beneficiário:</strong> ${escapeHtml(cfg.pixReceiverName || cfg.name || 'Salgados VIP')}</div>
      <div><strong>Chave PIX:</strong> ${escapeHtml(cfg.pixKey || '5521986758102')} (${escapeHtml(cfg.pixKeyType || 'Telefone')})</div>
      <div><strong>Cidade:</strong> ${escapeHtml(cfg.pixCity || 'Nova Iguaçu')}</div>
    `;
  }
};

window.copyPixCodeToClipboard = function() {
  const input = document.getElementById("pix-copy-paste-input");
  const feedback = document.getElementById("pix-copy-feedback");
  const btn = document.getElementById("btn-copy-pix");
  const btnText = document.getElementById("btn-copy-pix-text");

  if (!input || !input.value) return;

  const textToCopy = input.value;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textToCopy).catch(() => {
      input.select();
      document.execCommand("copy");
    });
  } else {
    input.select();
    document.execCommand("copy");
  }

  if (btn) btn.classList.add("copied");
  if (btnText) btnText.textContent = "Copiado!";
  if (feedback) feedback.style.display = "flex";

  showToastNotification("✓ Código Pix Copia e Cola copiado com sucesso!");

  setTimeout(() => {
    if (btn) btn.classList.remove("copied");
    if (btnText) btnText.textContent = "Copiar Código";
    if (feedback) feedback.style.display = "none";
  }, 3500);
};

// ==============================================================================
// 11. FINALIZAÇÃO E ENVIO DO PEDIDO VIA WHATSAPP
// ==============================================================================
document.getElementById("btn-finish-whatsapp").addEventListener("click", async () => {
  if (cartItems.length === 0) {
    alert("Adicione pelo menos um kit de salgados ou outro item ao seu pedido.");
    return;
  }

  const name = document.getElementById("cust-name").value.trim();
  const phoneEl = document.getElementById("cust-phone");
  const phone = phoneEl ? phoneEl.value.trim() : "";
  const fulfillment = document.querySelector('input[name="order-fulfillment"]:checked').value;
  const payment = document.getElementById("cust-payment").value;
  const change = document.getElementById("cust-change").value.trim();
  const notes = document.getElementById("cust-notes").value.trim();

  let cep = (document.getElementById("cust-cep")?.value || "").trim();
  let street = "";
  let number = "";
  let neighborhood = "";
  let city = "Nova Iguaçu";
  let complement = "";
  let fullAddress = "";
  let currentDeliveryFee = 0;
  let currentDeliveryDistance = 0;
  let deliveryFeeInfo = null;

  if (!name) {
    alert("Por favor, preencha o seu nome.");
    document.getElementById("cust-name").focus();
    return;
  }

  if (!phone) {
    alert("Por favor, preencha seu WhatsApp para acompanhamento do pedido.");
    if (phoneEl) phoneEl.focus();
    return;
  }

  if (fulfillment === "Entrega") {
    street = (document.getElementById("cust-street")?.value || "").trim();
    number = (document.getElementById("cust-number")?.value || "").trim();
    neighborhood = (document.getElementById("cust-neighborhood-input")?.value || "").trim();
    city = (document.getElementById("cust-city")?.value || "Nova Iguaçu").trim();
    complement = (document.getElementById("cust-complement")?.value || "").trim();

    if (!street) {
      alert("Por favor, digite o endereço (Rua ou Avenida) para a entrega.");
      document.getElementById("cust-street")?.focus();
      return;
    }
    if (!number) {
      alert("Por favor, informe o número da residência/estabelecimento para calcular o frete.");
      document.getElementById("cust-number")?.focus();
      return;
    }
    if (!neighborhood) {
      alert("Por favor, informe o Bairro para calcular a taxa de entrega.");
      document.getElementById("cust-neighborhood-input")?.focus();
      return;
    }

    if (currentRouteCalculation && currentRouteCalculation.allowed) {
      deliveryFeeInfo = currentRouteCalculation;
    } else {
      deliveryFeeInfo = await VIPDatabase.calculateRealRouteDistance({
        cep,
        street,
        number,
        neighborhood,
        city,
        requireNumber: true
      });
      currentRouteCalculation = deliveryFeeInfo;
    }

    if (!deliveryFeeInfo || !deliveryFeeInfo.allowed) {
      alert(deliveryFeeInfo?.reason || "Desculpe, este endereço está fora da área atendida pela loja (máximo 15 km).");
      return;
    }

    currentDeliveryFee = deliveryFeeInfo.fee;
    currentDeliveryDistance = deliveryFeeInfo.distanceKm || 0;
    fullAddress = `${street}, Nº ${number}${complement ? ` (${complement})` : ''} - ${neighborhood}, ${city}${cep ? ` • CEP: ${cep}` : ''}`;
  }

  // Validação de Agendamento & Horário de Funcionamento
  const timingTypeRadio = document.querySelector('input[name="order-timing-type"]:checked');
  const timingType = timingTypeRadio ? timingTypeRadio.value : "imediato";
  const isScheduled = timingType === "agendado";

  // REGRA DE NEGÓCIO CRÍTICA: Bloqueia pedido para entrega imediata fora do horário da loja
  if (!isScheduled && !isStoreOpenNow()) {
    alert("Nosso estabelecimento está fora do horário de atendimento imediato. Seu pedido foi direcionado automaticamente para Agendamento!");
    if (typeof applyStoreOperatingHoursRules === "function") {
      applyStoreOperatingHoursRules();
    }
    const dateInput = document.getElementById("sched-date");
    if (dateInput) dateInput.focus();
    return;
  }

  let scheduledDate = null;
  let scheduledTime = null;
  let scheduledDateTimeFormatted = null;

  if (isScheduled) {
    const dateInput = document.getElementById("sched-date");
    const timeInput = document.getElementById("sched-time");
    scheduledDate = dateInput ? dateInput.value.trim() : "";
    scheduledTime = timeInput ? timeInput.value.trim() : "";

    if (!scheduledDate) {
      alert("Por favor, selecione a data do agendamento.");
      if (dateInput) dateInput.focus();
      return;
    }

    if (!scheduledTime) {
      alert("Por favor, informe o horário desejado para o agendamento.");
      if (timeInput) timeInput.focus();
      return;
    }

    const [y, m, d] = scheduledDate.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);
    const daySched = getScheduleForDate(dateObj);

    if (!daySched.open) {
      alert(`O estabelecimento não abre aos ${daySched.dayName}s. Por favor, escolha outra data.`);
      if (dateInput) dateInput.focus();
      return;
    }

    const [openH, openM] = (daySched.openTime || "16:00").split(":").map(Number);
    const [closeH, closeM] = (daySched.closeTime || "22:30").split(":").map(Number);
    const [reqH, reqM] = scheduledTime.split(":").map(Number);

    const openMin = openH * 60 + openM;
    const closeMin = closeH * 60 + closeM;
    const reqMin = reqH * 60 + reqM;

    const now = new Date();
    const isToday = (y === now.getFullYear() && (m - 1) === now.getMonth() && d === now.getDate());
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Se escolheu hoje e o atendimento de hoje já encerrou
    if (isToday && currentMinutes >= closeMin) {
      alert(`O atendimento de hoje já encerrou às ${daySched.closeTime}. Por favor, escolha a data de amanhã ou outro dia para agendar!`);
      if (dateInput) dateInput.focus();
      return;
    }

    if (reqMin < openMin || reqMin > closeMin) {
      alert(`Para ${daySched.dayName}, o horário de atendimento para agendamentos é das ${daySched.openTime} às ${daySched.closeTime}.`);
      if (timeInput) timeInput.focus();
      return;
    }

    const dateFormatted = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    scheduledDateTimeFormatted = `${dateFormatted} às ${scheduledTime} (${daySched.dayName})`;
  }

  const subtotal = calculateOrderTotal();
  const finalTotal = subtotal + (fulfillment === "Entrega" ? currentDeliveryFee : 0);
  const cfg = getStoreConfig();

  // Registrar pedido no banco de dados local para monitoramento ao vivo no painel adm
  const orderObj = {
    customer: {
      name: name,
      phone: phone,
      cep: cep || null,
      address: fulfillment === "Entrega" ? fullAddress : null,
      street: street || null,
      number: number || null,
      neighborhood: neighborhood || null,
      city: city || null,
      complement: complement || null
    },
    fulfillment: fulfillment,
    timingType: timingType,
    scheduledDate: scheduledDate,
    scheduledTime: scheduledTime,
    scheduledDateTimeFormatted: scheduledDateTimeFormatted,
    items: JSON.parse(JSON.stringify(cartItems)),
    subtotal: subtotal,
    deliveryFee: currentDeliveryFee,
    deliveryDistanceKm: currentDeliveryDistance,
    totalAmount: finalTotal,
    paymentMethod: payment,
    cashChangeFor: payment === "Dinheiro" && change ? change : null,
    pixCode: payment === "Pix" ? currentPixPayload : null,
    notes: notes || null,
    status: "novo",
    printedAt: null
  };

  const savedOrder = await VIPDatabase.addOrder(orderObj);

  // MEMÓRIA INTELIGENTE: Salvar perfil do cliente (1 única vez, sem senhas)
  const custProfile = {
    name: name,
    phone: phone,
    cep: cep || null,
    street: street || null,
    number: number || null,
    neighborhood: neighborhood || null,
    city: city || "Nova Iguaçu",
    complement: complement || null,
    fulfillment: fulfillment,
    lastUpdated: Date.now()
  };
  VIPDatabase.saveCustomerProfile(custProfile);

  // RECOMPRA RÁPIDA: Salvar último pedido para repetição com 1 clique
  const lastOrderData = {
    id: savedOrder.id,
    createdAt: Date.now(),
    dateFormatted: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date()),
    items: JSON.parse(JSON.stringify(cartItems)),
    subtotal: subtotal,
    deliveryFee: currentDeliveryFee,
    totalAmount: finalTotal,
    fulfillment: fulfillment
  };
  VIPDatabase.saveCustomerLastOrder(lastOrderData);

  // Atualizar imediatamente a barra de saudação e o card do último pedido
  if (typeof renderCustomerUI === "function") {
    renderCustomerUI();
  }

  // Mensagem estruturada para o WhatsApp do Salgados VIP
  let msg = `*🥟 NOVO PEDIDO #${savedOrder.id} - ${cfg.name}*\n`;
  msg += `📍 ${cfg.location}\n`;
  msg += `------------------------------------------\n`;
  msg += `*Cliente:* ${name}\n`;
  msg += `*WhatsApp Contato:* ${phone}\n`;
  msg += `*Opção:* ${fulfillment}\n`;

  if (isScheduled) {
    msg += `📅 *PREVISÃO:* AGENDADO para ${scheduledDateTimeFormatted}\n`;
  } else {
    msg += `⚡ *PREVISÃO:* Imediato (Preparar Agora)\n`;
  }

  if (fulfillment === "Entrega") {
    msg += `*Endereço:* ${fullAddress}\n`;
    const distText = currentDeliveryDistance > 0 ? ` (~${currentDeliveryDistance.toFixed(1)} km)` : "";
    msg += `🛵 *Taxa de Entrega${distText}:* ${formatBRL(currentDeliveryFee)}\n`;
  } else {
    msg += `*Retirada no Local:* ${cfg.pickupAddress}\n`;
    msg += `🏪 *Taxa de Entrega:* Grátis (Retirada no Balcão)\n`;
  }

  msg += `*Forma de Pagamento:* ${payment}\n`;
  if (payment === "Dinheiro" && change) {
    msg += `*Troco para:* ${change}\n`;
  }
  if (payment === "Pix") {
    msg += `*PAGAMENTO VIA PIX:* Instantâneo\n`;
    msg += `• *Chave PIX:* ${cfg.pixKey || '5521986758102'} (${cfg.pixKeyType || 'Telefone'})\n`;
    msg += `• *Titular:* ${cfg.pixReceiverName || cfg.name || 'Salgados VIP'}\n`;
    if (currentPixPayload) {
      msg += `• *Código Pix Copia e Cola:*\n\`\`\`${currentPixPayload}\`\`\`\n`;
    }
  }

  msg += `\n*ITENS DO PEDIDO:*\n`;

  const combosInCart = cartItems.filter(i => i.type === "combo");
  const kitsInCart = cartItems.filter(i => i.type === "kit");
  const prodsInCart = cartItems.filter(i => i.type === "product");

  if (combosInCart.length > 0) {
    msg += `\n🔥 *COMBOS PROMOCIONAIS COM DESCONTO:*\n`;
    combosInCart.forEach(item => {
      msg += `\n*${item.name}* - ${formatBRL(item.finalPrice)}\n`;
      msg += `   _(De ${formatBRL(item.regularPrice)} - Economia de ${formatBRL(item.savings)} | ${item.discountPercent || 15}% OFF)_\n`;
      msg += `   _Itens Inclusos no Combo:_\n`;
      (item.items || []).forEach(i => {
        msg += `   • ${i.quantity}x ${i.name}\n`;
      });
      if (item.flavors && item.flavors.length > 0) {
        msg += `   _Sabores Escolhidos do Salgado:_\n`;
        item.flavors.forEach(f => {
          msg += `     - ${f.quantity}x ${f.name}\n`;
        });
      }
      if (item.flavorExtraCost > 0) {
        msg += `   *(Adicional de sabores nobres: + ${formatBRL(item.flavorExtraCost)})*\n`;
      }
      if (item.saucesCost > 0) {
        msg += `   *(Molhos extras: + ${formatBRL(item.saucesCost)})*\n`;
      }
    });
  }

  if (kitsInCart.length > 0) {
    msg += `\n📦 *KITS DE SALGADOS:*\n`;
    kitsInCart.forEach(item => {
      msg += `\n*${item.kitName}* - ${formatBRL(item.finalPrice)}\n`;
      msg += `_Sabores Escolhidos:_\n`;
      item.flavors.forEach(f => {
        msg += `   • ${f.quantity}x ${f.name}\n`;
      });
      if (item.flavorExtraCost > 0) {
        msg += `   *(Adicional de sabores nobres: + ${formatBRL(item.flavorExtraCost)})*\n`;
      }
      if (item.sauces && item.sauces.length > 0) {
        msg += `_🥫 Molhos Especiais Inclusos:_\n`;
        item.sauces.forEach(s => {
          msg += `   • ${s.quantity}x ${s.name} (+ ${formatBRL(s.subtotal)})\n`;
        });
      }
    });
  }

  if (prodsInCart.length > 0) {
    msg += `\n🥤 *OUTROS ITENS & BEBIDAS:*\n`;
    prodsInCart.forEach(item => {
      msg += `• ${item.quantity}x ${item.name} (${formatBRL(item.price)} un) = ${formatBRL(item.price * item.quantity)}\n`;
    });
  }

  msg += `\n------------------------------------------\n`;
  msg += `*Subtotal:* ${formatBRL(subtotal)}\n`;
  if (fulfillment === "Entrega") {
    msg += `*Taxa de Entrega (${currentDeliveryDistance.toFixed(1)} km):* ${formatBRL(currentDeliveryFee)}\n`;
  }
  msg += `*VALOR TOTAL:* ${formatBRL(finalTotal)}\n`;

  if (notes) {
    msg += `\n*Observações:* ${notes}\n`;
  }

  msg += `\n_Pedido gerado via cardápio digital. Aguardo confirmação!_`;

  const waUrl = `https://wa.me/${cfg.whatsappNumber}?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, "_blank");

  showToastNotification(`Pedido #${savedOrder.id} enviado com sucesso!`);
  cartItems = [];
  updateCartGlobalUI();
  closeCheckoutDrawer();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Toast Feedback Helper
function showToastNotification(text) {
  let toast = document.getElementById("vip-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "vip-toast";
    toast.style.position = "fixed";
    toast.style.top = "20px";
    toast.style.right = "20px";
    toast.style.background = "#121214";
    toast.style.color = "#fff";
    toast.style.padding = "12px 20px";
    toast.style.borderRadius = "10px";
    toast.style.fontWeight = "700";
    toast.style.fontSize = "0.92rem";
    toast.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
    toast.style.zIndex = "9999";
    toast.style.borderLeft = "4px solid #f59e0b";
    toast.style.transition = "opacity 0.3s ease";
    document.body.appendChild(toast);
  }

  toast.textContent = text;
  toast.style.opacity = "1";
  toast.style.display = "block";

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.style.display = "none";
    }, 300);
  }, 2200);
}

// ==============================================================================
// 12. IDENTIFICAÇÃO DO CLIENTE, LOGIN FÁCIL POR WHATSAPP & REPETIR ÚLTIMO PEDIDO
// ==============================================================================

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.maskPhoneInput = function(input) {
  if (!input) return;
  let val = input.value.replace(/\D/g, "");
  if (val.length > 11) val = val.substring(0, 11);
  if (val.length > 10) {
    input.value = `(${val.substring(0, 2)}) ${val.substring(2, 7)}-${val.substring(7)}`;
  } else if (val.length > 6) {
    input.value = `(${val.substring(0, 2)}) ${val.substring(2, 6)}-${val.substring(6)}`;
  } else if (val.length > 2) {
    input.value = `(${val.substring(0, 2)}) ${val.substring(2)}`;
  } else if (val.length > 0) {
    input.value = `(${val}`;
  } else {
    input.value = "";
  }
};

window.renderCustomerUI = function() {
  const welcomeSection = document.getElementById("customer-welcome-section");
  const lastOrderSection = document.getElementById("customer-last-order-section");
  if (!welcomeSection) return;

  const profile = VIPDatabase.getCustomerProfile();
  const lastOrder = VIPDatabase.getCustomerLastOrder();

  // 1. Barra de Boas-Vindas
  if (profile && profile.name) {
    let addressDisplay = "";
    if (profile.fulfillment === "Retirada") {
      addressDisplay = `<i class="fa-solid fa-store"></i> <span>Retirada no Balcão (Rua Isabel Pedrosa, 31)</span>`;
    } else {
      const streetPart = profile.street || "Endereço cadastrado";
      const numPart = profile.number ? `, ${profile.number}` : "";
      const neighPart = profile.neighborhood ? ` - ${profile.neighborhood}` : "";
      addressDisplay = `<i class="fa-solid fa-location-dot"></i> <span>Entregar em: <strong>${escapeHtml(streetPart + numPart + neighPart)}</strong></span>`;
    }

    welcomeSection.innerHTML = `
      <div class="customer-welcome-card identified">
        <div class="customer-card-left">
          <div class="customer-avatar-icon">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <div class="customer-info-text">
            <div class="customer-welcome-title">
              Olá, <strong>${escapeHtml(profile.name)}</strong>!
              <span class="customer-badge-tag"><i class="fa-solid fa-crown"></i> Cliente VIP</span>
            </div>
            <div class="customer-welcome-sub">
              ${addressDisplay}
            </div>
          </div>
        </div>
        <div class="customer-card-actions">
          <button class="btn-customer-action" onclick="openCustomerLoginModal()" title="Trocar número ou atualizar dados">
            <i class="fa-solid fa-arrows-rotate"></i> Trocar
          </button>
          <button class="btn-customer-action logout" onclick="logoutCustomerProfile()" title="Desconectar deste dispositivo">
            <i class="fa-solid fa-arrow-right-from-bracket"></i> Sair
          </button>
        </div>
      </div>
    `;
  } else {
    welcomeSection.innerHTML = `
      <div class="customer-welcome-card guest">
        <div class="customer-card-left">
          <div class="customer-avatar-icon">
            <i class="fa-brands fa-whatsapp"></i>
          </div>
          <div class="customer-info-text">
            <div class="customer-welcome-title">Já é nosso cliente VIP?</div>
            <div class="customer-welcome-sub">
              Digite seu WhatsApp para carregar seu endereço e repetir seu pedido em 1 clique!
            </div>
          </div>
        </div>
        <button class="btn-customer-login" id="btn-open-customer-login" onclick="openCustomerLoginModal()">
          <i class="fa-brands fa-whatsapp"></i> Entrar com WhatsApp
        </button>
      </div>
    `;
  }

  // 2. Card do Último Pedido (Recompra Rápida)
  if (lastOrderSection) {
    if (lastOrder && lastOrder.items && Array.isArray(lastOrder.items) && lastOrder.items.length > 0) {
      const summaryParts = lastOrder.items.map(item => {
        if (item.type === "kit") {
          let flavorNames = (item.flavors || []).map(f => `${f.quantity}x ${f.name}`).join(", ");
          return `${item.kitName}${flavorNames ? " (" + flavorNames + ")" : ""}`;
        } else if (item.type === "combo") {
          return item.name;
        } else {
          return `${item.quantity || 1}x ${item.name}`;
        }
      });
      const summaryText = summaryParts.join(" • ");

      lastOrderSection.innerHTML = `
        <div class="last-order-card">
          <div class="last-order-badge">
            <i class="fa-solid fa-clock-rotate-left"></i> SEU ÚLTIMO PEDIDO
          </div>
          <div class="last-order-header">
            <div>
              <span class="last-order-id">#${escapeHtml(lastOrder.id || "VIP")}</span>
              <span class="last-order-date">• ${lastOrder.dateFormatted || "Feito recentemente"}</span>
            </div>
            <div class="last-order-price">${formatBRL(lastOrder.totalAmount || 0)}</div>
          </div>
          <div class="last-order-summary">
            <i class="fa-solid fa-box-open"></i>
            <div>${escapeHtml(summaryText)}</div>
          </div>
          <button class="btn-repeat-order" onclick="repeatCustomerLastOrder()">
            <i class="fa-solid fa-rotate-right"></i> Repetir Este Pedido com 1 Clique
          </button>
        </div>
      `;
      lastOrderSection.style.display = "block";
    } else {
      lastOrderSection.style.display = "none";
    }
  }
};

window.repeatCustomerLastOrder = function() {
  const lastOrder = VIPDatabase.getCustomerLastOrder();
  if (!lastOrder || !lastOrder.items || !Array.isArray(lastOrder.items) || lastOrder.items.length === 0) {
    showToastNotification("Nenhum pedido anterior encontrado para repetir.");
    return;
  }

  // Clona os itens do último pedido gerando novos identificadores de carrinho
  cartItems = lastOrder.items.map(item => ({
    ...JSON.parse(JSON.stringify(item)),
    cartItemId: "rep_" + Date.now() + "_" + Math.floor(Math.random() * 10000)
  }));

  updateCartGlobalUI();
  renderOrderItemsInDrawer();
  window.openCheckoutDrawer();
  showToastNotification("✨ Último pedido carregado na sacola!");
};

function prefillCustomerCheckoutForm() {
  const profile = VIPDatabase.getCustomerProfile();
  if (!profile) return;

  const nameInput = document.getElementById("cust-name");
  const phoneInput = document.getElementById("cust-phone");
  const cepInput = document.getElementById("cust-cep");
  const streetInput = document.getElementById("cust-street");
  const numberInput = document.getElementById("cust-number");
  const neighborhoodInput = document.getElementById("cust-neighborhood-input");
  const cityInput = document.getElementById("cust-city");
  const complementInput = document.getElementById("cust-complement");

  if (nameInput && (!nameInput.value || nameInput.value.trim() === "")) {
    nameInput.value = profile.name || "";
  }
  if (phoneInput && (!phoneInput.value || phoneInput.value.trim() === "")) {
    phoneInput.value = profile.phone || "";
  }

  if (profile.fulfillment) {
    const radio = document.querySelector(`input[name="order-fulfillment"][value="${profile.fulfillment}"]`);
    if (radio && !radio.checked) {
      radio.checked = true;
      radio.dispatchEvent(new Event("change"));
    }
  }

  if (cepInput && profile.cep) cepInput.value = profile.cep;
  if (streetInput && profile.street) streetInput.value = profile.street;
  if (numberInput && profile.number) numberInput.value = profile.number;
  if (neighborhoodInput && profile.neighborhood) neighborhoodInput.value = profile.neighborhood;
  if (cityInput && profile.city) cityInput.value = profile.city;
  if (complementInput && profile.complement) complementInput.value = profile.complement;

  // Se já houver número e rua/bairro, dispara imediatamente o recálculo do frete exato
  if (profile.number && (profile.street || profile.neighborhood)) {
    if (typeof window.onCustomerAddressFieldChange === "function") {
      window.onCustomerAddressFieldChange();
    }
  }
}

// Modal de Login com WhatsApp
window.openCustomerLoginModal = function() {
  const modal = document.getElementById("customer-login-modal");
  const backdrop = document.getElementById("customer-login-backdrop");
  const input = document.getElementById("login-cust-phone");
  const statusEl = document.getElementById("login-feedback-status");

  if (statusEl) {
    statusEl.style.display = "none";
    statusEl.textContent = "";
  }

  const profile = VIPDatabase.getCustomerProfile();
  if (profile && profile.phone && input) {
    input.value = profile.phone;
  } else if (input) {
    input.value = "";
  }

  if (modal) modal.style.display = "block";
  if (backdrop) backdrop.classList.add("active");
  if (input) setTimeout(() => input.focus(), 150);
};

window.closeCustomerLoginModal = function() {
  const modal = document.getElementById("customer-login-modal");
  const backdrop = document.getElementById("customer-login-backdrop");
  if (modal) modal.style.display = "none";
  if (backdrop) backdrop.classList.remove("active");
};

window.executeCustomerPhoneLookup = async function() {
  const input = document.getElementById("login-cust-phone");
  const btn = document.getElementById("btn-do-login");
  if (!input) return;

  const phone = input.value.trim();
  if (!phone) {
    showLoginFeedback("Por favor, digite seu WhatsApp.", "error");
    input.focus();
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Buscando...`;
  }
  showLoginFeedback("Consultando histórico na nuvem...", "info");

  try {
    const res = await VIPDatabase.lookupCustomerByPhone(phone);
    if (res.found && res.profile) {
      showLoginFeedback(`Olá, ${res.profile.name}! Seus dados foram carregados.`, "success");
      setTimeout(() => {
        closeCustomerLoginModal();
        renderCustomerUI();
        showToastNotification(`Bem-vindo(a) de volta, ${res.profile.name}! 👋`);
      }, 700);
    } else {
      showLoginFeedback(res.message || "Número ainda não possui pedidos anteriores. Ao fazer seu pedido, salvaremos tudo automaticamente!", "info");
      // Se não encontrado, preenche o telefone no formulário de entrega para adiantar
      const drawerPhone = document.getElementById("cust-phone");
      if (drawerPhone) drawerPhone.value = phone;
    }
  } catch (err) {
    showLoginFeedback("Erro ao consultar dados. Verifique sua conexão.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-arrow-right"></i> Entrar`;
    }
  }
};

function showLoginFeedback(msg, type = "info") {
  const statusEl = document.getElementById("login-feedback-status");
  if (!statusEl) return;
  statusEl.className = `login-feedback-status ${type}`;
  statusEl.textContent = msg;
  statusEl.style.display = "block";
}

window.logoutCustomerProfile = function() {
  if (confirm("Deseja desconectar seus dados deste aparelho? (Você poderá entrar novamente digitando seu WhatsApp a qualquer momento)")) {
    VIPDatabase.clearCustomerProfile();
    renderCustomerUI();
    showToastNotification("Dados desconectados deste aparelho.");
  }
};

// ==============================================================================
// INICIALIZAÇÃO
// ==============================================================================
document.addEventListener("DOMContentLoaded", () => {
  renderStoreBranding();
  checkStoreStatus();
  // Atualiza status do horário a cada 1 minuto automaticamente
  setInterval(checkStoreStatus, 60000);

  renderCustomerUI();
  renderCombos();
  renderKits();
  renderCategoryNav();
  renderCustomCategories();
  initCustomerDeliveryNeighborhoods();
  updateCartGlobalUI();

  // Sincronização em Nuvem com o Supabase
  if (typeof VIPDatabase.initSupabase === "function") {
    VIPDatabase.initSupabase().then(() => {
      renderCustomerUI();
      renderCombos();
      renderKits();
      renderCategoryNav();
      renderCustomCategories();
      renderStoreBranding();
      checkStoreStatus();
    });
  }
});

// Atualiza a tela se os dados forem sincronizados em segundo plano
window.addEventListener("vip_supabase_synced", () => {
  renderCustomerUI();
  renderCombos();
  renderKits();
  renderCategoryNav();
  renderCustomCategories();
  renderStoreBranding();
  checkStoreStatus();
});

// Atualiza imediatamente se o administrador alterar configurações em outra aba
window.addEventListener("storage", (e) => {
  if (e.key === "salgados_vip_config" || e.key === "vip_store_config") {
    renderStoreBranding();
    checkStoreStatus();
  }
  if (e.key === "salgados_vip_kits" || e.key === "salgados_vip_flavors" || e.key === "salgados_vip_combos" || e.key === "salgados_vip_products") {
    renderCombos();
    renderKits();
    renderCustomCategories();
  }
  if (e.key === "salgados_vip_customer_profile" || e.key === "salgados_vip_customer_last_order") {
    renderCustomerUI();
  }
});


