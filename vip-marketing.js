// ==============================================================================
// MÓDULO ISOLADO DE CUPONS, PLANEJAMENTO DE MARKETING & INTELIGÊNCIA IA (v54.0)
// Arquivo: vip-marketing.js
// 100% Independente e Blindado — Não afeta o funcionamento original do sistema
// ==============================================================================

(function () {
  "use strict";

  const STORAGE_KEY_MKT = "salgados_vip_marketing_v54";
  const SESSION_COUPON_KEY = "salgados_vip_active_coupon_code";
  const SESSION_POPUP_DISMISSED = "salgados_vip_popup_dismissed_v54";

  // Estado Padrão Completo (Pré-configurado para Salgados VIP - Nova Iguaçu)
  const DEFAULT_MARKETING_DATA = {
    masterEnabled: true,
    updatedAt: Date.now(),

    // 1. GERADOR E CONTROLE DE CUPONS
    coupons: [
      {
        id: "cup-sextou10",
        code: "SEXTOU10",
        title: "Sextou com 10% OFF",
        description: "10% de desconto nos kits e combos de salgados.",
        type: "percent", // percent | fixed | free_shipping | bonus_salgados
        value: 10,
        minOrder: 35,
        maxUses: 0, // 0 = ilimitado
        usedCount: 0,
        revenueGenerated: 0,
        active: true,
        showInCart: true,
        scheduleDays: [0, 1, 2, 3, 4, 5, 6],
        startTime: "00:00",
        endTime: "23:59",
        expiresAt: ""
      },
      {
        id: "cup-vip5",
        code: "VIP5",
        title: "R$ 5,00 de Desconto VIP",
        description: "Desconto direto de R$ 5,00 para pedidos acima de R$ 40,00.",
        type: "fixed",
        value: 5,
        minOrder: 40,
        maxUses: 0,
        usedCount: 0,
        revenueGenerated: 0,
        active: true,
        showInCart: true,
        scheduleDays: [0, 1, 2, 3, 4, 5, 6],
        startTime: "00:00",
        endTime: "23:59",
        expiresAt: ""
      },
      {
        id: "cup-mais10",
        code: "MAIS10SALGADOS",
        title: "+10 Salgadinhos de Bônus",
        description: "Ganhe +10 salgadinhos tradicionais extras em pedidos acima de R$ 55,00!",
        type: "bonus_salgados",
        value: 10,
        minOrder: 55,
        maxUses: 0,
        usedCount: 0,
        revenueGenerated: 0,
        active: false,
        showInCart: true,
        scheduleDays: [0, 1, 2, 3, 4, 5, 6],
        startTime: "00:00",
        endTime: "23:59",
        expiresAt: ""
      },
      {
        id: "cup-fretevip",
        code: "FRETEVIP",
        title: "Frete Grátis Promocional",
        description: "Entrega grátis para pedidos acima de R$ 75,00.",
        type: "free_shipping",
        value: 0,
        minOrder: 75,
        maxUses: 0,
        usedCount: 0,
        revenueGenerated: 0,
        active: false,
        showInCart: true,
        scheduleDays: [0, 1, 2, 3, 4, 5, 6],
        startTime: "00:00",
        endTime: "23:59",
        expiresAt: ""
      }
    ],

    // 2. POP-UP PROMOCIONAL CONFIGURÁVEL POR IA NO ACESSO AO SITE
    popup: {
      enabled: false,
      badge: "🔥 OFERTA RELÂMPAGO VIP",
      headline: "Salgadinhos Quentinhos com Desconto Especial!",
      bodyText: "Peça agora seu Kit ou Combo frito na hora e ative seu cupom exclusivo com 1 clique no carrinho!",
      ctaText: "Quero Ativar Meu Desconto Agora!",
      actionType: "apply_coupon", // apply_coupon | scroll_combos | scroll_kits
      couponCode: "SEXTOU10",
      scheduleMode: "always", // always | time_window | date_range
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: "16:00",
      endTime: "22:30",
      startDate: "",
      endDate: ""
    },

    // 3. OS 5 MOTORES INTELIGENTES BASEADOS EM DADOS
    engines: {
      // Motor 1: Recomendação Inteligente no Carrinho (Order Bump)
      smartCartUpsell: {
        enabled: true,
        badgeText: "⚡ Combinação Perfeita • 1 Clique",
        customHeadline: "Que tal adicionar acompanhamento gelado ou molho especial?",
        discountPercent: 0
      },
      // Motor 2: Gatilho de Recompra Baseado em Frequência (Retenção)
      retentionTrigger: {
        enabled: true,
        defaultCycleDays: 7,
        couponToOffer: "SEXTOU10",
        messageTemplate: "Olá *{nome}*! Tudo bem? 🥟 Sentimos sua falta aqui no *Salgados VIP*! Hoje é dia de salgadinho quentinho frito na hora. Que tal repetir seu pedido favorito (*{pedido}*) usando o cupom *{cupom}*? Peça em 1 clique: {link}"
      },
      // Motor 3: Previsão de Demanda e Produção (Redução de Desperdício)
      demandForecast: {
        enabled: true,
        weatherFactor: "normal", // normal | chuva | calor
        paydayBoost: true,
        safetyMarginPercent: 15
      },
      // Motor 4: "Peça Novamente em 1 Clique" Personalizado (Seu Pedido Favorito)
      favoriteOneClick: {
        enabled: true,
        lookbackDays: 90,
        cardBadge: "⭐ Seu Pedido Favorito (1 Clique)"
      },
      // Motor 5: Desconto Dinâmico em Horários Ociosos (Happy Hour do Salgado)
      happyHourIdle: {
        enabled: false,
        title: "Happy Hour do Salgado VIP",
        startTime: "15:00",
        endTime: "18:00",
        daysOfWeek: [1, 2, 3, 4, 5],
        benefitType: "percent", // percent | bonus_salgados
        benefitValue: 10,
        minOrder: 30,
        nearbyOnly: false,
        nearbyNeighborhoods: "Da Luz, Centro, Califórnia, Chacrinha, Santa Eugênia, Jardim Iguaçu"
      }
    },

    // 4. CRIADOR DE CRIATIVO POR IA (ESTÚDIO VISUAL & COPY)
    creativeStudio: {
      theme: "sextou",
      headline: "SEXTOU COM SALGADOS VIP!",
      subheadline: "Fritos na hora, crocantes e sequinhos em Nova Iguaçu",
      offerHighlight: "USE O CUPOM: SEXTOU10",
      priceTag: "Kits a partir de R$ 20,00",
      ctaFooter: "Peça pelo Cardápio Digital • Entrega Rápida",
      generatedCopyWhatsapp: "",
      generatedCopyInstagram: ""
    },

    // 5. PLANEJAMENTO DE MARKETING DE SUCESSO (8 PILARES COMPLETOS)
    planning: {
      smartGoals: [
        { id: "g1", title: "Aumentar Faturamento Mensal", metric: "revenue", targetValue: 15000, deadline: "2026-12-31", active: true },
        { id: "g2", title: "Elevar Ticket Médio por Pedido", metric: "avg_ticket", targetValue: 58, deadline: "2026-12-31", active: true },
        { id: "g3", title: "Volume de Pedidos no Mês", metric: "orders_count", targetValue: 300, deadline: "2026-12-31", active: true }
      ],
      personas: [
        {
          id: "p1",
          name: "Família Fim de Semana & Confraternização",
          ageIncome: "28 a 52 anos • Renda Familiar R$ 3.500 a R$ 8.000",
          pains: "Falta de tempo para cozinhar na sexta/sábado, medo de pedir salgado encharcado de óleo ou que atrase.",
          desires: "Praticidade, salgados sequinhos fritos na hora, kits variados com refrigerante gelado e entrega rápida em Nova Iguaçu.",
          emotionalBehavior: "Compra por recompensa após a semana de trabalho e prazer de reunir a família/amigos."
        },
        {
          id: "p2",
          name: "Organizador de Aniversários & Eventos Rápidos",
          ageIncome: "22 a 45 anos • Foco em custo-benefício e volume",
          pains: "Dificuldade em calcular quantidade por convidado e receio de faltar comida na festa.",
          desires: "Centos e kits grandes (50 a 100+ un), opção de multiplicar kits (2x a 5x) e agendamento pontual.",
          emotionalBehavior: "Busca segurança, pontualidade no agendamento e elogios dos convidados."
        }
      ],
      swot: {
        strengths: "• Salgados artesanais fritos na hora (sequinhos e crocantes)\n• Cardápio Digital PWA rápido com cálculo exato de rota e Pix automático\n• Variedade de sabores tradicionais e nobres + molhos especiais",
        weaknesses: "• Horários de menor movimento entre 16h e 18h em dias úteis\n• Dependência de picos concentrados na sexta, sábado e domingo",
        opportunities: "• Ativar Happy Hour automático nos horários ociosos\n• Gatilho de recompra via WhatsApp para clientes semanais\n• Recomendação automática de bebidas/molhos no carrinho (Order Bump)",
        threats: "• Oscilação no preço de insumos (óleo, queijo, carnes)\n• Concorrência local com salgados congelados de menor preço"
      },
      fourPs: {
        produto: "Kits de 20 a 100 salgados personalizáveis, Combos Promocionais com 15% OFF, sabores nobres (Camarão, Bacalhau, Carne Seca) e molhos da casa.",
        preco: "Ancoragem inteligente: Kits acessíveis a partir de R$ 20,00, combos com economia visível e Order Bump de bebidas/molhos para subir o ticket médio.",
        praca: "Cardápio Digital PWA (index.html), WhatsApp Automatizado, Retirada na Rua Isabel Pedrosa 31 (Da Luz) e Delivery em raio de até 15 km em Nova Iguaçu.",
        promocao: "Cupons segmentados (SEXTOU10, VIP5), Pop-up Inteligente na entrada do site, Happy Hour em horário ocioso e Recompra em 1 clique."
      },
      omnichannel: [
        { id: "om1", channel: "WhatsApp Marketing & Status", action: "Disparo da lista de retenção às sextas 17h30 + 3 vídeos curtos de fritura na hora nos Status", active: true },
        { id: "om2", channel: "Instagram (Reels & Stories)", action: "Reels mostrando crocância + link direto do Cardápio Digital na Bio e figurinha nos Stories", active: true },
        { id: "om3", channel: "Cardápio Digital PWA (Site)", action: "Pop-up com cupom de 1 clique, Card 'Seu Pedido Favorito' e Recomendação Inteligente no Carrinho", active: true },
        { id: "om4", channel: "Google Meu Negócio / Busca Local", action: "Fotos atualizadas dos kits e solicitação de avaliação 5 estrelas pós-entrega", active: true },
        { id: "om5", channel: "Embalagem Física (In-Box)", action: "Adesivo com QR Code do Cardápio Digital + Cupom VIP5 para pedir direto sem taxas de apps", active: true }
      ],
      timeline: [
        { id: "t1", title: "Terça & Quarta do Happy Hour", period: "Terças e Quartas (16h às 19h)", status: "Ativo", goal: "Movimentar cozinha em dias úteis com desconto automático" },
        { id: "t2", title: "Operação Sextou VIP", period: "Todas as Sextas (17h às 22h30)", status: "Ativo", goal: "Disparo de recompra no WhatsApp + Cupom SEXTOU10" },
        { id: "t3", title: "FimdeSemana Família & Festas", period: "Sábados e Domingos", status: "Ativo", goal: "Foco em Combos Grandes e multiplicador de Kits (2x a 5x)" },
        { id: "t4", title: "Semana do Pagamento (5º dia útil e dia 15/30)", period: "Mensal (Dias 1 a 10 e 15 a 20)", status: "Planejado", goal: "Destaque para Sabores Especiais e Combos Completos" }
      ],
      budgetRoi: {
        monthlyAdBudget: 350,
        packagingMarketingCost: 80,
        estimatedCpc: 0.65,
        estimatedConversionRate: 12
      }
    }
  };

  // ============================================================================
  // CAMADA DE PERSISTÊNCIA & SINCRONIZAÇÃO COM SUPABASE (100% TOLERANTE A FALHAS)
  // ============================================================================
  function loadMarketingData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_MKT);
      if (raw) {
        const parsed = JSON.parse(raw);
        return deepMerge(JSON.parse(JSON.stringify(DEFAULT_MARKETING_DATA)), parsed);
      }
      // Fallback: verificar se veio dentro do config do VIPDatabase
      if (typeof VIPDatabase !== "undefined" && typeof VIPDatabase.getConfig === "function") {
        const cfg = VIPDatabase.getConfig();
        if (cfg && cfg.vipMarketingData) {
          return deepMerge(JSON.parse(JSON.stringify(DEFAULT_MARKETING_DATA)), cfg.vipMarketingData);
        }
      }
    } catch (e) {
      console.warn("[VIPMarketing] Erro ao ler dados locais, usando padrão:", e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_MARKETING_DATA));
  }

  function saveMarketingData(data, silent) {
    try {
      data.updatedAt = Date.now();
      localStorage.setItem(STORAGE_KEY_MKT, JSON.stringify(data));
      if (typeof VIPDatabase !== "undefined") {
        if (typeof VIPDatabase.pushSettingToSupabase === "function") {
          VIPDatabase.pushSettingToSupabase("marketing", data).catch(() => {});
        }
        // Espelhar no config geral para sincronização imediata entre dispositivos (Admin -> Cliente)
        if (typeof VIPDatabase.getConfig === "function") {
          const cfg = VIPDatabase.getConfig();
          cfg.vipMarketingData = data;
          localStorage.setItem("salgados_vip_config", JSON.stringify(cfg));
          if (typeof VIPDatabase.pushSettingToSupabase === "function") {
            VIPDatabase.pushSettingToSupabase("config", cfg).catch(() => {});
          }
        }
      }
      if (!silent) {
        notifyToast("✓ Configurações de Marketing & Cupons salvas com sucesso!");
      }
    } catch (e) {
      console.warn("[VIPMarketing] Erro ao salvar dados:", e);
    }
  }

  function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target;
    Object.keys(source).forEach(key => {
      if (Array.isArray(source[key])) {
        target[key] = source[key];
      } else if (source[key] && typeof source[key] === "object" && target[key] && typeof target[key] === "object") {
        target[key] = deepMerge(target[key], source[key]);
      } else if (source[key] !== undefined) {
        target[key] = source[key];
      }
    });
    return target;
  }

  function formatMoney(v) {
    const n = parseFloat(v) || 0;
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function notifyToast(msg, type = "success") {
    if (typeof window.showToast === "function") {
      window.showToast(msg, type);
      return;
    }
    if (typeof window.showToastNotification === "function") {
      window.showToastNotification(msg);
      return;
    }
    let toast = document.getElementById("vip-mkt-floating-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "vip-mkt-floating-toast";
      toast.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:10005;background:#0f172a;color:#fff;padding:12px 18px;border-radius:12px;font-weight:700;font-size:0.88rem;box-shadow:0 10px 25px rgba(0,0,0,0.3);transition:opacity 0.25s;";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = "1";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.style.opacity = "0"; }, 3200);
  }

  // ============================================================================
  // MOTOR DE VALIDAÇÃO DE CUPONS E DESCONTO DINÂMICO (HAPPY HOUR)
  // ============================================================================
  function isTimeWithinWindow(startTime, endTime) {
    if (!startTime || !endTime) return true;
    const now = new Date();
    const curMin = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    if (isNaN(sh) || isNaN(eh)) return true;
    const startMin = sh * 60 + (sm || 0);
    const endMin = eh * 60 + (em || 0);
    return curMin >= startMin && curMin <= endMin;
  }

  function validateCouponCode(code, subtotal, deliveryFee, fulfillment) {
    const data = loadMarketingData();
    if (!data.masterEnabled) {
      return { valid: false, reason: "Promoções temporariamente desativadas." };
    }
    const cleanCode = String(code || "").trim().toUpperCase();
    if (!cleanCode) return { valid: false, reason: "Digite um código de cupom." };

    const coupon = (data.coupons || []).find(c => String(c.code || "").trim().toUpperCase() === cleanCode);
    if (!coupon) {
      return { valid: false, reason: "Cupom não encontrado." };
    }
    if (!coupon.active) {
      return { valid: false, reason: "Este cupom está desativado no momento." };
    }
    if (coupon.expiresAt) {
      const exp = new Date(coupon.expiresAt + "T23:59:59");
      if (!isNaN(exp.getTime()) && new Date() > exp) {
        return { valid: false, reason: "Este cupom já expirou." };
      }
    }
    const todayDay = new Date().getDay();
    if (Array.isArray(coupon.scheduleDays) && coupon.scheduleDays.length > 0 && !coupon.scheduleDays.includes(todayDay)) {
      return { valid: false, reason: "Este cupom não é válido para o dia de hoje." };
    }
    if (!isTimeWithinWindow(coupon.startTime, coupon.endTime)) {
      return { valid: false, reason: `Válido das ${coupon.startTime} às ${coupon.endTime}.` };
    }
    if (coupon.maxUses > 0 && (coupon.usedCount || 0) >= coupon.maxUses) {
      return { valid: false, reason: "Limite de usos deste cupom atingido." };
    }
    if ((coupon.minOrder || 0) > subtotal) {
      return {
        valid: false,
        reason: `Pedido mínimo de ${formatMoney(coupon.minOrder)} (faltam ${formatMoney(coupon.minOrder - subtotal)}).`
      };
    }

    let discountAmount = 0;
    let bonusSalgados = 0;
    let benefitLabel = "";

    if (coupon.type === "percent") {
      discountAmount = +(subtotal * ((parseFloat(coupon.value) || 0) / 100)).toFixed(2);
      benefitLabel = `${coupon.value}% OFF (-${formatMoney(discountAmount)})`;
    } else if (coupon.type === "fixed") {
      discountAmount = Math.min(subtotal, parseFloat(coupon.value) || 0);
      benefitLabel = `-${formatMoney(discountAmount)} OFF`;
    } else if (coupon.type === "free_shipping") {
      if (fulfillment === "Entrega" && deliveryFee > 0) {
        discountAmount = deliveryFee;
        benefitLabel = `Frete Grátis (-${formatMoney(discountAmount)})`;
      } else {
        discountAmount = 0;
        benefitLabel = "Frete Grátis Ativo (Informe o endereço)";
      }
    } else if (coupon.type === "bonus_salgados") {
      bonusSalgados = parseInt(coupon.value, 10) || 10;
      benefitLabel = `+${bonusSalgados} Salgadinhos Grátis de Bônus!`;
    }

    return {
      valid: true,
      coupon,
      code: coupon.code,
      discountAmount,
      bonusSalgados,
      benefitLabel
    };
  }

  function evaluateHappyHourBenefit(subtotal, customerNeighborhood) {
    const data = loadMarketingData();
    if (!data.masterEnabled) return null;
    const hh = data.engines?.happyHourIdle;
    if (!hh || !hh.enabled) return null;

    const today = new Date().getDay();
    if (Array.isArray(hh.daysOfWeek) && !hh.daysOfWeek.includes(today)) return null;
    if (!isTimeWithinWindow(hh.startTime, hh.endTime)) return null;
    if (subtotal < (parseFloat(hh.minOrder) || 0)) return null;

    if (hh.nearbyOnly && customerNeighborhood) {
      const allowedList = String(hh.nearbyNeighborhoods || "")
        .toLowerCase()
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
      const custBairro = String(customerNeighborhood || "").toLowerCase().trim();
      if (allowedList.length > 0 && custBairro && !allowedList.some(b => custBairro.includes(b) || b.includes(custBairro))) {
        return null;
      }
    }

    let discountAmount = 0;
    let bonusSalgados = 0;
    let label = hh.title || "Happy Hour do Salgado";

    if (hh.benefitType === "percent") {
      discountAmount = +(subtotal * ((parseFloat(hh.benefitValue) || 10) / 100)).toFixed(2);
      label += ` (${hh.benefitValue}% OFF Automático)`;
    } else {
      bonusSalgados = parseInt(hh.benefitValue, 10) || 5;
      label += ` (+${bonusSalgados} Salgados Extras)`;
    }

    return {
      active: true,
      title: hh.title || "Happy Hour VIP",
      discountAmount,
      bonusSalgados,
      label
    };
  }

  // Cálculo consolidado usado pelo Checkout (app.js)
  function getCheckoutAdjustment(subtotal, deliveryFee, fulfillment) {
    const sub = parseFloat(subtotal) || 0;
    const del = parseFloat(deliveryFee) || 0;
    let totalDiscount = 0;
    let totalBonusSalgados = 0;
    let appliedLabels = [];
    let appliedCouponCode = null;
    let couponValidation = null;

    const savedCode = sessionStorage.getItem(SESSION_COUPON_KEY) || "";
    if (savedCode && sub > 0) {
      couponValidation = validateCouponCode(savedCode, sub, del, fulfillment);
      if (couponValidation.valid) {
        totalDiscount += couponValidation.discountAmount;
        totalBonusSalgados += couponValidation.bonusSalgados;
        appliedCouponCode = couponValidation.code;
        appliedLabels.push(`Cupom ${couponValidation.code}: ${couponValidation.benefitLabel}`);
      }
    }

    const bairroInput = document.getElementById("cust-neighborhood-input")?.value || "";
    const hh = evaluateHappyHourBenefit(sub, bairroInput);
    if (hh && hh.active && sub > 0) {
      // Se já não tiver desconto maior, soma ou aplica o Happy Hour
      if (hh.discountAmount > 0 && totalDiscount === 0) {
        totalDiscount += hh.discountAmount;
        appliedLabels.push(hh.label);
      } else if (hh.bonusSalgados > 0) {
        totalBonusSalgados += hh.bonusSalgados;
        appliedLabels.push(hh.label);
      }
    }

    const maxDiscount = sub + (fulfillment === "Entrega" ? del : 0);
    if (totalDiscount > maxDiscount) totalDiscount = maxDiscount;

    return {
      discountAmount: +totalDiscount.toFixed(2),
      bonusSalgados: totalBonusSalgados,
      appliedCouponCode,
      couponValidation,
      summaryLabel: appliedLabels.join(" + "),
      finalTotal: Math.max(0, +(sub + (fulfillment === "Entrega" ? del : 0) - totalDiscount).toFixed(2))
    };
  }

  function recordOrderMarketingConversion(orderObj) {
    try {
      const adj = getCheckoutAdjustment(orderObj.subtotal || 0, orderObj.deliveryFee || 0, orderObj.fulfillment || "Entrega");
      if (!adj.appliedCouponCode) return;
      const data = loadMarketingData();
      const idx = (data.coupons || []).findIndex(c => c.code === adj.appliedCouponCode);
      if (idx !== -1) {
        data.coupons[idx].usedCount = (data.coupons[idx].usedCount || 0) + 1;
        data.coupons[idx].revenueGenerated = +((data.coupons[idx].revenueGenerated || 0) + (orderObj.totalAmount || 0)).toFixed(2);
        saveMarketingData(data, true);
      }
      sessionStorage.removeItem(SESSION_COUPON_KEY);
    } catch (e) {}
  }

  // ============================================================================
  // INTELIGÊNCIA DE DADOS: ANÁLISE DE PEDIDOS REAIS (5 MOTORES)
  // ============================================================================
  function getAllHistoricalOrders() {
    if (typeof VIPDatabase !== "undefined" && typeof VIPDatabase.getOrders === "function") {
      return VIPDatabase.getOrders() || [];
    }
    return [];
  }

  // Motor 1: Recomendação Inteligente no Carrinho (Order Bump)
  function getSmartCartRecommendation(currentCartItems) {
    const data = loadMarketingData();
    if (!data.masterEnabled || !data.engines?.smartCartUpsell?.enabled) return null;
    if (!Array.isArray(currentCartItems) || currentCartItems.length === 0) return null;

    const hasSalgados = currentCartItems.some(i => i.type === "kit" || i.type === "combo");
    const hasDrinksOrProducts = currentCartItems.some(i => i.type === "product");
    if (!hasSalgados || hasDrinksOrProducts) return null;

    // Cruzar histórico de pedidos para achar a bebida/acompanhamento mais vendido junto com salgados
    const orders = getAllHistoricalOrders();
    const productFreq = {};
    orders.forEach(o => {
      (o.items || []).forEach(it => {
        if (it.type === "product" && it.productId) {
          productFreq[it.productId] = (productFreq[it.productId] || 0) + (it.quantity || 1);
        }
      });
    });

    const allProducts = (typeof VIPDatabase !== "undefined" && typeof VIPDatabase.getProducts === "function")
      ? VIPDatabase.getProducts().filter(p => p.active !== false)
      : [];

    if (allProducts.length === 0) return null;

    let bestProd = allProducts[0];
    let bestScore = -1;
    allProducts.forEach(p => {
      const score = productFreq[p.id] || 0;
      if (score > bestScore) {
        bestScore = score;
        bestProd = p;
      }
    });

    return {
      product: bestProd,
      badge: data.engines.smartCartUpsell.badgeText || "⚡ Combinação Perfeita • 1 Clique",
      headline: `Que tal adicionar ${bestProd.name} por apenas ${formatMoney(bestProd.price)} para acompanhar?`,
      subtext: bestScore > 0
        ? `Item favorito dos clientes que pedem kits de salgados (${bestScore}x pedido junto!)`
        : "Combinação perfeita com salgadinhos quentinhos fritos na hora!"
    };
  }

  // Motor 2: Gatilho de Recompra Baseado em Frequência (Retenção)
  function analyzeCustomerRetention() {
    const orders = getAllHistoricalOrders().filter(o => o.status !== "cancelado");
    const byPhone = {};
    const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    orders.forEach(o => {
      const rawPhone = String(o.customer?.phone || "").replace(/\D/g, "");
      if (!rawPhone || rawPhone.length < 8) return;
      if (!byPhone[rawPhone]) {
        byPhone[rawPhone] = {
          name: o.customer?.name || "Cliente VIP",
          phone: o.customer?.phone || rawPhone,
          cleanPhone: rawPhone,
          orders: [],
          totalSpent: 0,
          itemCounts: {},
          weekdayCounts: {}
        };
      }
      const entry = byPhone[rawPhone];
      const ts = parseInt(o.createdAt, 10) || Date.now();
      entry.orders.push({ id: o.id, ts, total: parseFloat(o.totalAmount || o.total || 0), items: o.items || [] });
      entry.totalSpent += parseFloat(o.totalAmount || o.total || 0);
      const d = new Date(ts).getDay();
      entry.weekdayCounts[d] = (entry.weekdayCounts[d] || 0) + 1;

      (o.items || []).forEach(it => {
        const label = it.kitName || it.name || "Kit Salgados";
        entry.itemCounts[label] = (entry.itemCounts[label] || 0) + 1;
      });
    });

    const now = Date.now();
    const results = Object.values(byPhone).map(c => {
      c.orders.sort((a, b) => b.ts - a.ts);
      const lastOrderTs = c.orders[0]?.ts || now;
      const daysSinceLast = Math.max(0, Math.floor((now - lastOrderTs) / (1000 * 60 * 60 * 24)));

      let avgCycleDays = 7;
      if (c.orders.length >= 2) {
        const oldestTs = c.orders[c.orders.length - 1].ts;
        const spanDays = Math.max(1, (lastOrderTs - oldestTs) / (1000 * 60 * 60 * 24));
        avgCycleDays = Math.max(3, Math.round(spanDays / (c.orders.length - 1)));
      }

      let favItem = "Kit de Salgados";
      let maxItemCount = 0;
      Object.entries(c.itemCounts).forEach(([k, cnt]) => {
        if (cnt > maxItemCount) { maxItemCount = cnt; favItem = k; }
      });

      let favDayIdx = new Date().getDay();
      let maxDayCount = 0;
      Object.entries(c.weekdayCounts).forEach(([dIdx, cnt]) => {
        if (cnt > maxDayCount) { maxDayCount = cnt; favDayIdx = parseInt(dIdx, 10); }
      });

      const isDue = daysSinceLast >= avgCycleDays || (favDayIdx === new Date().getDay() && daysSinceLast >= 3);

      return {
        ...c,
        ordersCount: c.orders.length,
        daysSinceLast,
        avgCycleDays,
        favoriteItem: favItem,
        favoriteWeekday: dayNames[favDayIdx] || "Sexta",
        isDue
      };
    });

    return results.sort((a, b) => (b.isDue ? 1 : 0) - (a.isDue ? 1 : 0) || b.ordersCount - a.ordersCount);
  }

  // Motor 3: Previsão de Demanda e Produção (Redução de Desperdício)
  function analyzeKitchenDemandForecast() {
    const data = loadMarketingData();
    const cfg = data.engines?.demandForecast || {};
    const orders = getAllHistoricalOrders().filter(o => o.status !== "cancelado");
    const now = new Date();
    const todayWeekday = now.getDay();
    const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

    const hourBuckets = {};
    const flavorTotals = {};
    let sameWeekdayOrders = 0;
    let totalSalgadosCount = 0;

    orders.forEach(o => {
      const d = new Date(parseInt(o.createdAt, 10) || Date.now());
      const hr = d.getHours();
      const bucketKey = `${String(hr).padStart(2, "0")}:00`;
      hourBuckets[bucketKey] = (hourBuckets[bucketKey] || 0) + 1;
      if (d.getDay() === todayWeekday) sameWeekdayOrders++;

      (o.items || []).forEach(it => {
        const mult = Math.max(1, parseInt(it.repeatCount, 10) || 1);
        if (Array.isArray(it.flavors)) {
          it.flavors.forEach(f => {
            const q = (parseInt(f.quantity, 10) || 0) * mult;
            flavorTotals[f.name] = (flavorTotals[f.name] || 0) + q;
            totalSalgadosCount += q;
          });
        }
      });
    });

    // Descobrir horário de pico
    let peakHour = "18:30 às 20:30";
    let maxBucket = 0;
    Object.entries(hourBuckets).forEach(([h, count]) => {
      if (count > maxBucket) {
        maxBucket = count;
        const nextH = String((parseInt(h, 10) + 2) % 24).padStart(2, "0") + ":00";
        peakHour = `${h} às ${nextH}`;
      }
    });

    // Multiplicadores inteligentes (Dia de pagamento, Fim de Semana, Clima)
    let multiplier = 1.0;
    const dayOfMonth = now.getDate();
    const isPaydayWindow = (dayOfMonth >= 1 && dayOfMonth <= 10) || (dayOfMonth >= 15 && dayOfMonth <= 20) || dayOfMonth >= 28;
    if (cfg.paydayBoost && isPaydayWindow) multiplier += 0.2;
    if (todayWeekday === 5 || todayWeekday === 6 || todayWeekday === 0) multiplier += 0.35;
    if (cfg.weatherFactor === "chuva") multiplier += 0.18;
    multiplier += (parseFloat(cfg.safetyMarginPercent) || 15) / 100;

    const topFlavors = Object.entries(flavorTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({
        name,
        historicalQty: qty,
        recommendedPrep: Math.max(30, Math.round(((qty / Math.max(1, orders.length)) * 6 * multiplier) / 10) * 10)
      }));

    if (topFlavors.length === 0) {
      topFlavors.push(
        { name: "Coxinha de Frango", historicalQty: 120, recommendedPrep: 90 },
        { name: "Bolinha de Queijo", historicalQty: 90, recommendedPrep: 70 },
        { name: "Kibe Tradicional", historicalQty: 70, recommendedPrep: 50 },
        { name: "Risole de Carne", historicalQty: 60, recommendedPrep: 50 }
      );
    }

    const totalRecommendedPrep = topFlavors.reduce((acc, f) => acc + f.recommendedPrep, 0);

    return {
      todayName: dayNames[todayWeekday],
      peakHour,
      isPaydayWindow,
      weatherFactor: cfg.weatherFactor || "normal",
      topFlavors,
      totalRecommendedPrep,
      alertText: `Histórico indica pico de pedidos hoje (${dayNames[todayWeekday]}) entre ${peakHour}. Prepare cerca de ${totalRecommendedPrep} unidades dos sabores líderes para pré-empanamento/fritura rápida.`
    };
  }

  // Motor 4: "Seu Pedido Favorito em 1 Clique" para o Cliente Logado
  function getCustomerFavoriteOrder() {
    const data = loadMarketingData();
    if (!data.masterEnabled || !data.engines?.favoriteOneClick?.enabled) return null;
    if (typeof VIPDatabase === "undefined") return null;

    const profile = typeof VIPDatabase.getCustomerProfile === "function" ? VIPDatabase.getCustomerProfile() : null;
    const lastOrder = typeof VIPDatabase.getCustomerLastOrder === "function" ? VIPDatabase.getCustomerLastOrder() : null;
    const allOrders = getAllHistoricalOrders();

    const phoneClean = String(profile?.phone || "").replace(/\D/g, "");
    const cutoff = Date.now() - (parseInt(data.engines.favoriteOneClick.lookbackDays, 10) || 90) * 24 * 60 * 60 * 1000;

    let customerOrders = [];
    if (phoneClean.length >= 8) {
      customerOrders = allOrders.filter(o => {
        const p = String(o.customer?.phone || "").replace(/\D/g, "");
        return p === phoneClean && (parseInt(o.createdAt, 10) || Date.now()) >= cutoff;
      });
    }

    if (customerOrders.length === 0 && lastOrder && Array.isArray(lastOrder.items) && lastOrder.items.length > 0) {
      customerOrders = [lastOrder];
    }
    if (customerOrders.length === 0) return null;

    // Identificar a combinação mais frequente
    const comboMap = {};
    customerOrders.forEach(o => {
      if (!Array.isArray(o.items) || o.items.length === 0) return;
      const summary = o.items.map(it => it.kitName || it.name || "Item").join(" + ");
      if (!comboMap[summary]) {
        comboMap[summary] = { count: 0, items: o.items, total: o.subtotal || o.totalAmount || 0 };
      }
      comboMap[summary].count++;
    });

    const best = Object.entries(comboMap).sort((a, b) => b[1].count - a[1].count)[0];
    if (!best) return null;

    return {
      title: best[0],
      count: best[1].count,
      items: best[1].items,
      badge: data.engines.favoriteOneClick.cardBadge || "⭐ Seu Pedido Favorito (1 Clique)"
    };
  }

  // ============================================================================
  // RENDERIZAÇÃO NO MODO CLIENTE (index.html)
  // ============================================================================
  function initCustomerMarketingUI() {
    renderHappyHourTopBanner();
    renderFavoriteOneClickCard();
    renderCustomerPopupIfEligible();
    renderCheckoutMarketingWidgets();
  }

  function renderHappyHourTopBanner() {
    const existing = document.getElementById("vip-happy-hour-banner");
    if (existing) existing.remove();

    const data = loadMarketingData();
    if (!data.masterEnabled) return;
    const hh = data.engines?.happyHourIdle;
    if (!hh || !hh.enabled) return;
    const today = new Date().getDay();
    if (Array.isArray(hh.daysOfWeek) && !hh.daysOfWeek.includes(today)) return;
    if (!isTimeWithinWindow(hh.startTime, hh.endTime)) return;

    const banner = document.createElement("div");
    banner.id = "vip-happy-hour-banner";
    banner.className = "vip-happy-hour-top-banner";
    const benefitDesc = hh.benefitType === "percent"
      ? `${hh.benefitValue}% DE DESCONTO AUTOMÁTICO`
      : `+${hh.benefitValue} SALGADINHOS EXTRAS GRÁTIS`;

    banner.innerHTML = `
      <span class="vip-happy-hour-pill"><i class="fa-solid fa-bolt"></i> ${esc(hh.title || "Happy Hour VIP")}</span>
      <span>Ativo agora (${esc(hh.startTime)} às ${esc(hh.endTime)}): <strong>${esc(benefitDesc)}</strong> em pedidos acima de ${formatMoney(hh.minOrder || 30)}!</span>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
  }

  function renderFavoriteOneClickCard() {
    const fav = getCustomerFavoriteOrder();
    let container = document.getElementById("vip-favorite-oneclick-section");
    if (!fav) {
      if (container) container.style.display = "none";
      return;
    }

    const mainEl = document.querySelector("main.container");
    if (!mainEl) return;

    if (!container) {
      container = document.createElement("section");
      container.id = "vip-favorite-oneclick-section";
      const welcomeSec = document.getElementById("customer-welcome-section");
      if (welcomeSec && welcomeSec.nextSibling) {
        mainEl.insertBefore(container, welcomeSec.nextSibling);
      } else {
        mainEl.insertBefore(container, mainEl.firstChild);
      }
    }

    container.style.display = "block";
    container.innerHTML = `
      <div class="vip-favorite-order-card">
        <div class="vip-fav-left">
          <div class="vip-fav-icon"><i class="fa-solid fa-heart-circle-bolt"></i></div>
          <div>
            <span class="vip-fav-tag">${esc(fav.badge)}</span>
            <h3 class="vip-fav-title">${esc(fav.title)}</h3>
            <p class="vip-fav-sub">Seu combo preferido pronto para adicionar direto à sacola sem perder tempo!</p>
          </div>
        </div>
        <button type="button" class="vip-fav-btn" onclick="window.VIPMarketing.addFavoriteOrderToCart()">
          <i class="fa-solid fa-cart-plus"></i> Pedir Favorito em 1 Clique
        </button>
      </div>
    `;
  }

  function addFavoriteOrderToCart() {
    const fav = getCustomerFavoriteOrder();
    if (!fav || !Array.isArray(fav.items)) return;

    if (typeof window.repeatCustomerLastOrder === "function" && (!window.cartItems || window.cartItems.length === 0)) {
      // Utiliza o fluxo seguro do app.js ou adiciona diretamente
    }

    try {
      const cloned = JSON.parse(JSON.stringify(fav.items));
      if (typeof window.addMarketingItemsToCart === "function") {
        window.addMarketingItemsToCart(cloned);
      }
    } catch (e) {
      console.warn("[VIPMarketing] Erro ao adicionar favorito:", e);
    }
  }

  function renderCustomerPopupIfEligible() {
    const data = loadMarketingData();
    if (!data.masterEnabled || !data.popup?.enabled) return;
    if (sessionStorage.getItem(SESSION_POPUP_DISMISSED) === "1") return;

    const p = data.popup;
    const now = new Date();
    if (Array.isArray(p.daysOfWeek) && !p.daysOfWeek.includes(now.getDay())) return;

    if (p.scheduleMode === "time_window" && !isTimeWithinWindow(p.startTime, p.endTime)) {
      return;
    }
    if (p.scheduleMode === "date_range") {
      if (p.startDate && now < new Date(p.startDate + "T00:00:00")) return;
      if (p.endDate && now > new Date(p.endDate + "T23:59:59")) return;
    }

    let backdrop = document.getElementById("vip-mkt-popup-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "vip-mkt-popup-backdrop";
      backdrop.className = "vip-popup-backdrop";
      document.body.appendChild(backdrop);
    }

    const couponBlock = (p.actionType === "apply_coupon" && p.couponCode)
      ? `<div class="vip-popup-coupon-highlight">
           <span>Cupom Exclusivo</span>
           <strong>${esc(p.couponCode)}</strong>
         </div>`
      : "";

    backdrop.innerHTML = `
      <div class="vip-popup-modal">
        <div class="vip-popup-hero">
          <button type="button" class="vip-popup-close" onclick="window.VIPMarketing.closeCustomerPopup()" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
          <span class="vip-popup-badge">${esc(p.badge || "🔥 OFERTA VIP")}</span>
          <h3>${esc(p.headline || "Promoção Especial Salgados VIP!")}</h3>
        </div>
        <div class="vip-popup-body">
          <p>${esc(p.bodyText || "Aproveite nossos salgadinhos fritos na hora com desconto especial!")}</p>
          ${couponBlock}
          <button type="button" class="vip-popup-cta-btn" onclick="window.VIPMarketing.triggerPopupAction()">
            <i class="fa-solid fa-bolt"></i> ${esc(p.ctaText || "Aproveitar Promoção Agora!")}
          </button>
          <button type="button" class="vip-popup-skip-btn" onclick="window.VIPMarketing.closeCustomerPopup()">
            Continuar olhando o cardápio
          </button>
        </div>
      </div>
    `;

    setTimeout(() => {
      backdrop.classList.add("active");
    }, 650);
  }

  function closeCustomerPopup() {
    sessionStorage.setItem(SESSION_POPUP_DISMISSED, "1");
    const backdrop = document.getElementById("vip-mkt-popup-backdrop");
    if (backdrop) backdrop.classList.remove("active");
  }

  function triggerPopupAction() {
    const data = loadMarketingData();
    const p = data.popup || {};
    closeCustomerPopup();

    if (p.actionType === "apply_coupon" && p.couponCode) {
      sessionStorage.setItem(SESSION_COUPON_KEY, String(p.couponCode).trim().toUpperCase());
      notifyToast(`🎉 Cupom ${p.couponCode.toUpperCase()} ativado! Escolha seus itens no cardápio.`);
      renderCheckoutMarketingWidgets();
      if (typeof window.updateCartGlobalUI === "function") window.updateCartGlobalUI();
    } else if (p.actionType === "scroll_combos") {
      document.getElementById("section-combos")?.scrollIntoView({ behavior: "smooth" });
    } else {
      document.getElementById("section-kits")?.scrollIntoView({ behavior: "smooth" });
    }
  }

  // Renderiza o Order Bump (Motor 1) + Caixa de Cupom dentro do Checkout Drawer
  function renderCheckoutMarketingWidgets(currentCartItems, subtotal, deliveryFee, fulfillment) {
    const upsellBox = document.getElementById("vip-smart-cart-upsell");
    const couponBox = document.getElementById("vip-checkout-coupon-box");
    const discountLine = document.getElementById("drawer-discount-summary-line");
    const discountAmountEl = document.getElementById("drawer-discount-amount");
    const discountLabelEl = document.getElementById("drawer-discount-label");

    const items = Array.isArray(currentCartItems) ? currentCartItems : (window.getCartItemsSnapshot ? window.getCartItemsSnapshot() : []);
    const sub = subtotal !== undefined ? subtotal : (typeof window.calculateOrderTotal === "function" ? window.calculateOrderTotal() : 0);
    const del = deliveryFee !== undefined ? deliveryFee : 0;
    const ful = fulfillment || (document.querySelector('input[name="order-fulfillment"]:checked')?.value || "Entrega");

    // 1. Order Bump Inteligente no Carrinho
    if (upsellBox) {
      const rec = getSmartCartRecommendation(items);
      if (rec && rec.product) {
        upsellBox.style.display = "block";
        upsellBox.innerHTML = `
          <div class="vip-smart-upsell-card">
            <div class="vip-smart-upsell-info">
              <span class="vip-smart-upsell-badge">${esc(rec.badge)}</span>
              <p class="vip-smart-upsell-title">${esc(rec.headline)}</p>
              <p class="vip-smart-upsell-sub">${esc(rec.subtext)}</p>
            </div>
            <button type="button" class="vip-smart-upsell-btn" onclick="window.VIPMarketing.quickAddUpsellProduct('${esc(rec.product.id)}')">
              <i class="fa-solid fa-plus"></i> Adicionar
            </button>
          </div>
        `;
      } else {
        upsellBox.style.display = "none";
        upsellBox.innerHTML = "";
      }
    }

    // 2. Caixa de Cupom de Desconto no Checkout
    const data = loadMarketingData();
    const activeCode = sessionStorage.getItem(SESSION_COUPON_KEY) || "";
    const adj = getCheckoutAdjustment(sub, del, ful);

    if (couponBox) {
      if (!data.masterEnabled) {
        couponBox.style.display = "none";
      } else {
        couponBox.style.display = "block";
        const publicCoupons = (data.coupons || []).filter(c => c.active && c.showInCart);
        const pillsHtml = publicCoupons.map(c => {
          const isSel = activeCode.toUpperCase() === c.code.toUpperCase();
          return `<button type="button" class="vip-avail-coupon-pill" style="${isSel ? 'background:#f59e0b;color:#fff;' : ''}" onclick="window.VIPMarketing.applyCouponFromCheckout('${esc(c.code)}')">
            <i class="fa-solid fa-ticket"></i> ${esc(c.code)} (${c.type === 'percent' ? c.value + '% OFF' : c.type === 'fixed' ? 'R$ ' + c.value + ' OFF' : c.type === 'free_shipping' ? 'Frete Grátis' : '+' + c.value + ' Salgados'})
          </button>`;
        }).join("");

        let feedbackHtml = "";
        if (activeCode && adj.couponValidation) {
          if (adj.couponValidation.valid) {
            feedbackHtml = `
              <div class="vip-coupon-feedback-msg ok">
                <span><i class="fa-solid fa-circle-check"></i> Cupom <strong>${esc(activeCode)}</strong> ativo: ${esc(adj.couponValidation.benefitLabel)}</span>
                <button type="button" onclick="window.VIPMarketing.removeCheckoutCoupon()" style="background:none;border:none;color:#b91c1c;font-weight:800;cursor:pointer;">Remover</button>
              </div>
            `;
          } else {
            feedbackHtml = `
              <div class="vip-coupon-feedback-msg err">
                <span><i class="fa-solid fa-circle-exclamation"></i> ${esc(adj.couponValidation.reason)}</span>
                <button type="button" onclick="window.VIPMarketing.removeCheckoutCoupon()" style="background:none;border:none;color:#991b1b;font-weight:800;cursor:pointer;">Limpar</button>
              </div>
            `;
          }
        }

        couponBox.innerHTML = `
          <div class="vip-checkout-coupon-card">
            <div class="vip-checkout-coupon-head">
              <span><i class="fa-solid fa-ticket" style="color:#ea580c;"></i> Cupom de Desconto ou Bônus VIP</span>
              ${adj.bonusSalgados > 0 ? `<span style="color:#15803d;font-size:0.75rem;">🎁 +${adj.bonusSalgados} salgados grátis!</span>` : ""}
            </div>
            <div class="vip-checkout-coupon-row">
              <input type="text" id="vip-checkout-coupon-input" placeholder="Digite seu cupom (ex: SEXTOU10)" value="${esc(activeCode)}">
              <button type="button" onclick="window.VIPMarketing.applyCouponFromInput()">Aplicar</button>
            </div>
            ${pillsHtml ? `<div class="vip-available-coupons-bar">${pillsHtml}</div>` : ""}
            ${feedbackHtml}
          </div>
        `;
      }
    }

    // 3. Linha de Desconto no Resumo do Rodapé
    if (discountLine && discountAmountEl && discountLabelEl) {
      if (adj.discountAmount > 0 || adj.bonusSalgados > 0) {
        discountLine.style.display = "flex";
        discountLabelEl.textContent = adj.summaryLabel || "Desconto Promocional";
        discountAmountEl.textContent = adj.discountAmount > 0
          ? `- ${formatMoney(adj.discountAmount)}`
          : `+${adj.bonusSalgados} Salgados Grátis`;
      } else {
        discountLine.style.display = "none";
      }
    }

    return adj;
  }

  function applyCouponFromInput() {
    const input = document.getElementById("vip-checkout-coupon-input");
    if (!input) return;
    applyCouponFromCheckout(input.value);
  }

  function applyCouponFromCheckout(code) {
    const clean = String(code || "").trim().toUpperCase();
    if (!clean) return;
    sessionStorage.setItem(SESSION_COUPON_KEY, clean);
    if (typeof window.updateCartGlobalUI === "function") {
      window.updateCartGlobalUI();
    } else {
      renderCheckoutMarketingWidgets();
    }
  }

  function removeCheckoutCoupon() {
    sessionStorage.removeItem(SESSION_COUPON_KEY);
    if (typeof window.updateCartGlobalUI === "function") {
      window.updateCartGlobalUI();
    } else {
      renderCheckoutMarketingWidgets();
    }
  }

  function quickAddUpsellProduct(productId) {
    if (typeof window.changeProductCartQty === "function") {
      window.changeProductCartQty(productId, 1);
      notifyToast("✓ Item adicionado ao seu pedido com 1 clique!");
    }
  }

  // ============================================================================
  // RENDERIZAÇÃO NO PAINEL ADMINISTRATIVO (admin.html)
  // Aba 1: #tab-coupons | Aba 2: #tab-marketing
  // ============================================================================
  let currentMktSubtab = "engines";

  function renderAdminCouponsTab() {
    const container = document.getElementById("tab-coupons");
    if (!container) return;
    const data = loadMarketingData();
    const coupons = data.coupons || [];
    const activeCount = coupons.filter(c => c.active).length;
    const totalUses = coupons.reduce((acc, c) => acc + (c.usedCount || 0), 0);
    const totalRev = coupons.reduce((acc, c) => acc + (c.revenueGenerated || 0), 0);

    const cardsHtml = coupons.map(c => {
      const badgeLabel = c.type === "percent"
        ? `${c.value}% DE DESCONTO`
        : c.type === "fixed"
          ? `${formatMoney(c.value)} DE DESCONTO`
          : c.type === "free_shipping"
            ? `FRETE GRÁTIS`
            : `+${c.value} SALGADOS DE BÔNUS`;

      return `
        <div class="vip-coupon-card ${c.active ? "is-active" : "is-inactive"}">
          <div>
            <div class="vip-coupon-top">
              <span class="vip-coupon-code-badge"><i class="fa-solid fa-ticket"></i> ${esc(c.code)}</span>
              <label class="vip-switch" title="Ativar ou Desativar este cupom">
                <input type="checkbox" ${c.active ? "checked" : ""} onchange="window.VIPMarketing.toggleCouponActive('${esc(c.id)}', this.checked)">
                <span class="vip-switch-slider"></span>
              </label>
            </div>
            <div class="vip-coupon-discount-headline">${esc(badgeLabel)}</div>
            <p class="vip-coupon-desc"><strong>${esc(c.title)}</strong> — ${esc(c.description || "")}</p>
          </div>

          <div class="vip-coupon-meta-list">
            <span class="vip-coupon-meta-pill"><i class="fa-solid fa-coins"></i> Mínimo: ${formatMoney(c.minOrder || 0)}</span>
            <span class="vip-coupon-meta-pill"><i class="fa-regular fa-clock"></i> ${esc(c.startTime || "00:00")} às ${esc(c.endTime || "23:59")}</span>
            <span class="vip-coupon-meta-pill"><i class="fa-solid fa-chart-simple"></i> Usos: ${c.usedCount || 0}${c.maxUses > 0 ? "/" + c.maxUses : ""}</span>
            <span class="vip-coupon-meta-pill"><i class="fa-solid fa-sack-dollar"></i> Gerou: ${formatMoney(c.revenueGenerated || 0)}</span>
          </div>

          <div class="vip-coupon-actions">
            <label style="font-size:0.78rem;font-weight:700;color:#334155;display:flex;align-items:center;gap:6px;cursor:pointer;">
              <input type="checkbox" ${c.showInCart ? "checked" : ""} onchange="window.VIPMarketing.toggleCouponShowInCart('${esc(c.id)}', this.checked)">
              Mostrar botão 1-clique no carrinho
            </label>
            <div style="display:flex;gap:6px;">
              <button type="button" class="btn-secondary btn-sm" onclick="window.VIPMarketing.sendCouponToPopup('${esc(c.code)}')" title="Colocar este cupom no Pop-up do site">
                <i class="fa-solid fa-bullhorn"></i> Pop-up
              </button>
              <button type="button" class="btn-danger btn-sm" onclick="window.VIPMarketing.deleteCoupon('${esc(c.id)}')" title="Excluir cupom">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    container.innerHTML = `
      <div class="vip-mkt-header-banner">
        <div class="vip-mkt-header-title">
          <div class="vip-mkt-header-icon"><i class="fa-solid fa-ticket"></i></div>
          <div>
            <h2>Gerador e Controle Inteligente de Cupons</h2>
            <p>Crie cupons de desconto em %, R$, Frete Grátis ou Salgados de Bônus com ativação em 1 clique.</p>
          </div>
        </div>
        <div class="vip-mkt-master-toggle-box">
          <span>Sistema de Cupons & Promoções</span>
          <label class="vip-switch">
            <input type="checkbox" ${data.masterEnabled ? "checked" : ""} onchange="window.VIPMarketing.toggleMasterEnabled(this.checked)">
            <span class="vip-switch-slider"></span>
          </label>
        </div>
      </div>

      <div class="vip-mkt-kpi-grid">
        <div class="vip-mkt-kpi-card">
          <div class="vip-mkt-kpi-icon orange"><i class="fa-solid fa-tags"></i></div>
          <div class="vip-mkt-kpi-info">
            <span>Cupons Ativos</span>
            <strong>${activeCount} de ${coupons.length}</strong>
            <small>Prontos para uso no site</small>
          </div>
        </div>
        <div class="vip-mkt-kpi-card">
          <div class="vip-mkt-kpi-icon green"><i class="fa-solid fa-check-double"></i></div>
          <div class="vip-mkt-kpi-info">
            <span>Pedidos com Cupom</span>
            <strong>${totalUses}</strong>
            <small>Conversões registradas</small>
          </div>
        </div>
        <div class="vip-mkt-kpi-card">
          <div class="vip-mkt-kpi-icon blue"><i class="fa-solid fa-sack-dollar"></i></div>
          <div class="vip-mkt-kpi-info">
            <span>Receita Gerada por Cupons</span>
            <strong>${formatMoney(totalRev)}</strong>
            <small>Retorno direto de campanhas</small>
          </div>
        </div>
      </div>

      <!-- RECEITAS PRONTAS DE 1 CLIQUE -->
      <div class="vip-preset-bar">
        <div class="vip-preset-bar-title"><i class="fa-solid fa-wand-magic-sparkles"></i> Receitas Prontas (Criar e Ativar Cupom em 1 Clique — Sem Complicação)</div>
        <div class="vip-preset-pills">
          <button type="button" class="vip-preset-btn" onclick="window.VIPMarketing.createPresetCoupon('sextou10')">
            <i class="fa-solid fa-fire"></i> + Sextou 10% OFF (Mín R$ 35)
          </button>
          <button type="button" class="vip-preset-btn" onclick="window.VIPMarketing.createPresetCoupon('vip15')">
            <i class="fa-solid fa-crown"></i> + Super VIP 15% OFF (Mín R$ 60)
          </button>
          <button type="button" class="vip-preset-btn" onclick="window.VIPMarketing.createPresetCoupon('desconto10reais')">
            <i class="fa-solid fa-money-bill-wave"></i> + R$ 10,00 OFF no Kit Festa (Mín R$ 70)
          </button>
          <button type="button" class="vip-preset-btn" onclick="window.VIPMarketing.createPresetCoupon('bonus10salgados')">
            <i class="fa-solid fa-gift"></i> + Ganhe +10 Salgados Grátis (Mín R$ 50)
          </button>
          <button type="button" class="vip-preset-btn" onclick="window.VIPMarketing.createPresetCoupon('fretegratis')">
            <i class="fa-solid fa-motorcycle"></i> + Frete Grátis VIP (Mín R$ 75)
          </button>
        </div>
      </div>

      <!-- FORMULÁRIO SIMPLES PARA NOVO CUPOM PERSONALIZADO -->
      <div class="adm-card" style="margin-bottom: 1.5rem;">
        <div class="adm-card-header">
          <h3><i class="fa-solid fa-plus-circle"></i> Criar Novo Cupom Personalizado</h3>
        </div>
        <div class="adm-card-body">
          <div class="form-grid-3" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;">
            <div class="adm-form-group">
              <label>Código do Cupom (Ex: FESTA15)</label>
              <input type="text" id="new-cup-code" placeholder="Ex: FESTA15" style="text-transform:uppercase;font-weight:800;">
            </div>
            <div class="adm-form-group">
              <label>Nome / Título da Promoção</label>
              <input type="text" id="new-cup-title" placeholder="Ex: Desconto Especial de Festa">
            </div>
            <div class="adm-form-group">
              <label>Tipo de Benefício</label>
              <select id="new-cup-type">
                <option value="percent">Desconto em Porcentagem (%)</option>
                <option value="fixed">Desconto Fixo em Reais (R$)</option>
                <option value="bonus_salgados">Salgadinhos Extras de Bônus (+Un)</option>
                <option value="free_shipping">Frete Grátis na Entrega</option>
              </select>
            </div>
            <div class="adm-form-group">
              <label>Valor do Desconto / Quantidade Bônus</label>
              <input type="number" id="new-cup-val" value="10" step="1" min="0">
            </div>
            <div class="adm-form-group">
              <label>Pedido Mínimo (R$)</label>
              <input type="number" id="new-cup-min" value="35" step="5" min="0">
            </div>
            <div class="adm-form-group">
              <label>Horário Válido (Início e Fim)</label>
              <div style="display:flex;gap:6px;">
                <input type="time" id="new-cup-start" value="00:00">
                <input type="time" id="new-cup-end" value="23:59">
              </div>
            </div>
          </div>
          <div style="margin-top:1rem;display:flex;justify-content:flex-end;">
            <button type="button" class="btn-primary" onclick="window.VIPMarketing.saveCustomCouponFromForm()">
              <i class="fa-solid fa-check"></i> Criar e Ativar Cupom Agora
            </button>
          </div>
        </div>
      </div>

      <h3 style="margin: 0.5rem 0; font-size: 1.05rem; color: #0f172a;"><i class="fa-solid fa-layer-group"></i> Seus Cupons Cadastrados (Ative ou Desative quando quiser)</h3>
      <div class="vip-coupons-grid">
        ${cardsHtml}
      </div>
    `;
  }

  function renderAdminMarketingTab() {
    const container = document.getElementById("tab-marketing");
    if (!container) return;
    const data = loadMarketingData();
    const retentionList = analyzeCustomerRetention();
    const forecast = analyzeKitchenDemandForecast();

    container.innerHTML = `
      <div class="vip-mkt-header-banner">
        <div class="vip-mkt-header-title">
          <div class="vip-mkt-header-icon"><i class="fa-solid fa-bullhorn"></i></div>
          <div>
            <h2>MKT, Planejamento Estratégico & Inteligência de Vendas por IA</h2>
            <p>Tudo com botões simples de Ativar/Desativar, Pop-up inteligente, Criador de Criativo IA e 5 Motores de Vendas.</p>
          </div>
        </div>
        <div class="vip-mkt-master-toggle-box">
          <span>Módulo Geral de MKT</span>
          <label class="vip-switch">
            <input type="checkbox" ${data.masterEnabled ? "checked" : ""} onchange="window.VIPMarketing.toggleMasterEnabled(this.checked)">
            <span class="vip-switch-slider"></span>
          </label>
        </div>
      </div>

      <!-- NAVEGAÇÃO INTERNA DO MÓDULO DE MARKETING -->
      <div class="vip-mkt-subnav">
        <button type="button" class="vip-mkt-subnav-btn ${currentMktSubtab === 'engines' ? 'active' : ''}" onclick="window.VIPMarketing.switchMktSubtab('engines')">
          <i class="fa-solid fa-robot"></i> 5 Motores Inteligentes (Dados)
        </button>
        <button type="button" class="vip-mkt-subnav-btn ${currentMktSubtab === 'popup' ? 'active' : ''}" onclick="window.VIPMarketing.switchMktSubtab('popup')">
          <i class="fa-solid fa-window-restore"></i> Pop-up IA na Entrada do Site
        </button>
        <button type="button" class="vip-mkt-subnav-btn ${currentMktSubtab === 'creative' ? 'active' : ''}" onclick="window.VIPMarketing.switchMktSubtab('creative')">
          <i class="fa-solid fa-palette"></i> Criador de Criativo por IA
        </button>
        <button type="button" class="vip-mkt-subnav-btn ${currentMktSubtab === 'planning' ? 'active' : ''}" onclick="window.VIPMarketing.switchMktSubtab('planning')">
          <i class="fa-solid fa-compass-drafting"></i> Planejamento 8 Pilares (SMART/SWOT/ROI)
        </button>
      </div>

      <!-- SUB-ABA 1: OS 5 MOTORES INTELIGENTES BASEADOS EM DADOS -->
      <div class="vip-mkt-subpane ${currentMktSubtab === 'engines' ? 'active' : ''}" id="vip-subpane-engines">
        ${buildFiveEnginesHtml(data, retentionList, forecast)}
      </div>

      <!-- SUB-ABA 2: POP-UP CONFIGURÁVEL POR IA -->
      <div class="vip-mkt-subpane ${currentMktSubtab === 'popup' ? 'active' : ''}" id="vip-subpane-popup">
        ${buildPopupConfigHtml(data)}
      </div>

      <!-- SUB-ABA 3: CRIADOR DE CRIATIVO POR IA -->
      <div class="vip-mkt-subpane ${currentMktSubtab === 'creative' ? 'active' : ''}" id="vip-subpane-creative">
        ${buildCreativeStudioHtml(data)}
      </div>

      <!-- SUB-ABA 4: PLANEJAMENTO DE MARKETING COMPLETO (8 PILARES) -->
      <div class="vip-mkt-subpane ${currentMktSubtab === 'planning' ? 'active' : ''}" id="vip-subpane-planning">
        ${buildStrategicPlanningHtml(data)}
      </div>
    `;

    if (currentMktSubtab === "creative") {
      setTimeout(() => renderCreativeCanvas(), 60);
    }
  }

  function buildFiveEnginesHtml(data, retentionList, forecast) {
    const eng = data.engines || {};
    const retentionRows = retentionList.slice(0, 8).map(c => {
      const msg = (eng.retentionTrigger?.messageTemplate || "")
        .replace("{nome}", c.name)
        .replace("{pedido}", c.favoriteItem)
        .replace("{cupom}", eng.retentionTrigger?.couponToOffer || "SEXTOU10")
        .replace("{link}", window.location.origin + window.location.pathname.replace("admin.html", "index.html"));
      const waUrl = `https://wa.me/55${c.cleanPhone.replace(/^55/, "")}?text=${encodeURIComponent(msg)}`;

      return `
        <div class="vip-retention-item ${c.isDue ? 'urgent' : ''}">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="color:#0f172a;font-size:0.92rem;">${esc(c.name)}</strong>
              <span style="font-size:0.72rem;font-weight:800;padding:2px 8px;border-radius:999px;background:${c.isDue ? '#fef3c7' : '#e2e8f0'};color:${c.isDue ? '#92400e' : '#475569'};">
                ${c.isDue ? '🔔 Hora de Recompra!' : 'Em dia'}
              </span>
            </div>
            <div style="font-size:0.78rem;color:#475569;margin-top:4px;">
              📅 Costuma pedir: <strong>${esc(c.favoriteWeekday)}</strong> (a cada ~${c.avgCycleDays} dias)<br>
              ⏱️ Último pedido: <strong>há ${c.daysSinceLast} dia(s)</strong> (${c.ordersCount} pedidos | ${formatMoney(c.totalSpent)})<br>
              🥟 Favorito: <strong>${esc(c.favoriteItem)}</strong>
            </div>
          </div>
          <a href="${waUrl}" target="_blank" rel="noopener" class="btn-primary btn-sm" style="text-decoration:none;text-align:center;background:#16a34a;border-color:#16a34a;">
            <i class="fa-brands fa-whatsapp"></i> Enviar Convite VIP em 1 Clique
          </a>
        </div>
      `;
    }).join("");

    const flavorCards = forecast.topFlavors.map(f => `
      <div class="vip-forecast-box highlight-fry">
        <span style="font-size:0.74rem;font-weight:800;color:#9a3412;text-transform:uppercase;">Pré-Fritura / Empanamento</span>
        <strong style="display:block;font-size:1.05rem;color:#0f172a;margin:3px 0;">${esc(f.name)}</strong>
        <div style="font-size:1.25rem;font-weight:900;color:#ea580c;">Preparar ~${f.recommendedPrep} un</div>
        <small style="color:#64748b;">Histórico acumulado: ${f.historicalQty} un vendidas</small>
      </div>
    `).join("");

    return `
      <!-- MOTOR 1: RECOMENDAÇÃO INTELIGENTE NO CARRINHO -->
      <div class="vip-engine-card ${eng.smartCartUpsell?.enabled ? 'engine-on' : 'engine-off'}">
        <div class="vip-engine-head">
          <div class="vip-engine-title-group">
            <div class="vip-engine-badge-num">1</div>
            <div>
              <h3>Recomendação Inteligente no Carrinho (Aumento de Ticket Médio)</h3>
              <p>Cruza os pedidos anteriores e, se o cliente colocar apenas salgados na sacola, sugere bebida ou acompanhamento em 1 clique.</p>
            </div>
          </div>
          <label class="vip-switch">
            <input type="checkbox" ${eng.smartCartUpsell?.enabled ? "checked" : ""} onchange="window.VIPMarketing.toggleEngine('smartCartUpsell', this.checked)">
            <span class="vip-switch-slider"></span>
          </label>
        </div>
        <div style="font-size:0.84rem;color:#334155;background:#f8fafc;padding:0.75rem 1rem;border-radius:10px;">
          <i class="fa-solid fa-circle-check" style="color:#10b981;"></i> <strong>Status Automático:</strong> Quando ativo, analisa automaticamente os itens mais comprados junto com kits e exibe o botão <em>"+ Adicionar em 1 Clique"</em> dentro da gaveta do pedido do cliente.
        </div>
      </div>

      <!-- MOTOR 2: GATILHO DE RECOMPRA BASEADO EM FREQUÊNCIA -->
      <div class="vip-engine-card ${eng.retentionTrigger?.enabled ? 'engine-on' : 'engine-off'}">
        <div class="vip-engine-head">
          <div class="vip-engine-title-group">
            <div class="vip-engine-badge-num">2</div>
            <div>
              <h3>Gatilho de Recompra Baseado em Frequência (Retenção no WhatsApp)</h3>
              <p>Calcula a média de dias e o dia da semana favorito de cada cliente para disparar convite personalizado com 1 clique.</p>
            </div>
          </div>
          <label class="vip-switch">
            <input type="checkbox" ${eng.retentionTrigger?.enabled ? "checked" : ""} onchange="window.VIPMarketing.toggleEngine('retentionTrigger', this.checked)">
            <span class="vip-switch-slider"></span>
          </label>
        </div>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.75rem;align-items:center;">
          <label style="font-size:0.82rem;font-weight:700;">Cupom incluído na mensagem:</label>
          <input type="text" id="ret-coupon-input" value="${esc(eng.retentionTrigger?.couponToOffer || 'SEXTOU10')}" style="width:140px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:8px;font-weight:800;" onchange="window.VIPMarketing.updateRetentionCoupon(this.value)">
        </div>
        <div class="vip-retention-list">
          ${retentionRows || `<div style="padding:1rem;color:#64748b;">Assim que os clientes realizarem pedidos, a inteligência listará aqui automaticamente quem está no dia de pedir novamente!</div>`}
        </div>
      </div>

      <!-- MOTOR 3: PREVISÃO DE DEMANDA E PRODUÇÃO -->
      <div class="vip-engine-card ${eng.demandForecast?.enabled ? 'engine-on' : 'engine-off'}">
        <div class="vip-engine-head">
          <div class="vip-engine-title-group">
            <div class="vip-engine-badge-num">3</div>
            <div>
              <h3>Previsão de Demanda e Produção (Redução de Desperdício na Cozinha)</h3>
              <p>Cruza dia da semana + horário de pico + início/meio de mês + clima para orientar a pré-fritura e empanamento.</p>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:0.75rem;">
            <select onchange="window.VIPMarketing.updateWeatherFactor(this.value)" style="padding:6px 10px;border-radius:8px;border:1px solid #cbd5e1;font-weight:700;font-size:0.8rem;">
              <option value="normal" ${eng.demandForecast?.weatherFactor === 'normal' ? 'selected' : ''}>☀️ Clima Normal hoje</option>
              <option value="chuva" ${eng.demandForecast?.weatherFactor === 'chuva' ? 'selected' : ''}>🌧️ Dia Chuvoso (+Demanda Delivery)</option>
              <option value="calor" ${eng.demandForecast?.weatherFactor === 'calor' ? 'selected' : ''}>🔥 Calor Intenso (+Bebidas Geladas)</option>
            </select>
            <label class="vip-switch">
              <input type="checkbox" ${eng.demandForecast?.enabled ? "checked" : ""} onchange="window.VIPMarketing.toggleEngine('demandForecast', this.checked)">
              <span class="vip-switch-slider"></span>
            </label>
          </div>
        </div>
        <div style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;padding:0.85rem 1rem;border-radius:12px;font-weight:700;font-size:0.88rem;">
          <i class="fa-solid fa-fire-burner"></i> <strong>Alerta da Cozinha para Hoje (${esc(forecast.todayName)}):</strong> ${esc(forecast.alertText)}
        </div>
        <div class="vip-forecast-grid">
          ${flavorCards}
        </div>
      </div>

      <!-- MOTOR 4: PEÇA NOVAMENTE EM 1 CLIQUE ("SEU PEDIDO FAVORITO") -->
      <div class="vip-engine-card ${eng.favoriteOneClick?.enabled ? 'engine-on' : 'engine-off'}">
        <div class="vip-engine-head">
          <div class="vip-engine-title-group">
            <div class="vip-engine-badge-num">4</div>
            <div>
              <h3>"Peça Novamente em 1 Clique" Personalizado (Card "Seu Pedido Favorito")</h3>
              <p>Exibe no topo do cardápio do cliente o combo que ele mais pediu nos últimos 3 meses já com botão direto para a sacola.</p>
            </div>
          </div>
          <label class="vip-switch">
            <input type="checkbox" ${eng.favoriteOneClick?.enabled ? "checked" : ""} onchange="window.VIPMarketing.toggleEngine('favoriteOneClick', this.checked)">
            <span class="vip-switch-slider"></span>
          </label>
        </div>
        <div style="font-size:0.84rem;color:#334155;">
          Reduz o atrito na hora da fome: o cliente abre o aplicativo e repete seu combo predileto em 1 único toque.
        </div>
      </div>

      <!-- MOTOR 5: DESCONTO DINÂMICO EM HORÁRIOS OCIOSOS (HAPPY HOUR) -->
      <div class="vip-engine-card ${eng.happyHourIdle?.enabled ? 'engine-on' : 'engine-off'}">
        <div class="vip-engine-head">
          <div class="vip-engine-title-group">
            <div class="vip-engine-badge-num">5</div>
            <div>
              <h3>Desconto Dinâmico em Horários Ociosos ("Happy Hour do Salgado")</h3>
              <p>Ativa automaticamente uma promoção nos horários de menor movimento na cozinha, com opção de filtro para bairros próximos.</p>
            </div>
          </div>
          <label class="vip-switch">
            <input type="checkbox" ${eng.happyHourIdle?.enabled ? "checked" : ""} onchange="window.VIPMarketing.toggleEngine('happyHourIdle', this.checked)">
            <span class="vip-switch-slider"></span>
          </label>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0.9rem;margin-top:0.75rem;">
          <div class="adm-form-group">
            <label>Janela de Horário Ocioso</label>
            <div style="display:flex;gap:6px;">
              <input type="time" id="hh-start" value="${esc(eng.happyHourIdle?.startTime || '15:00')}">
              <input type="time" id="hh-end" value="${esc(eng.happyHourIdle?.endTime || '18:00')}">
            </div>
          </div>
          <div class="adm-form-group">
            <label>Tipo de Benefício Automático</label>
            <select id="hh-type">
              <option value="percent" ${eng.happyHourIdle?.benefitType === 'percent' ? 'selected' : ''}>Desconto em % no Pedido</option>
              <option value="bonus_salgados" ${eng.happyHourIdle?.benefitType === 'bonus_salgados' ? 'selected' : ''}>+Salgadinhos Extras Grátis</option>
            </select>
          </div>
          <div class="adm-form-group">
            <label>Valor (% ou Qtd Salgados)</label>
            <input type="number" id="hh-val" value="${eng.happyHourIdle?.benefitValue || 10}" min="1">
          </div>
          <div class="adm-form-group">
            <label>Bairros Próximos (Opcional)</label>
            <input type="text" id="hh-bairros" value="${esc(eng.happyHourIdle?.nearbyNeighborhoods || 'Da Luz, Centro, Califórnia')}">
          </div>
        </div>
        <div style="margin-top:0.85rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
          <label style="font-size:0.82rem;font-weight:700;display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" id="hh-nearby-only" ${eng.happyHourIdle?.nearbyOnly ? "checked" : ""}>
            Restringir apenas aos bairros próximos listados acima (economizar na entrega)
          </label>
          <button type="button" class="btn-primary btn-sm" onclick="window.VIPMarketing.saveHappyHourConfig()">
            <i class="fa-solid fa-floppy-disk"></i> Salvar Regra de Happy Hour
          </button>
        </div>
      </div>
    `;
  }

  function buildPopupConfigHtml(data) {
    const p = data.popup || {};
    return `
      <div class="vip-preset-bar">
        <div class="vip-preset-bar-title"><i class="fa-solid fa-robot"></i> Gerador IA de Pop-up em 1 Clique (Escolha o objetivo e a IA preenche tudo)</div>
        <div class="vip-preset-pills">
          <button type="button" class="vip-preset-btn" onclick="window.VIPMarketing.applyPopupPreset('sextou')">
            🔥 Pop-up "Sextou com Cupom 10% OFF"
          </button>
          <button type="button" class="vip-preset-btn" onclick="window.VIPMarketing.applyPopupPreset('combos')">
            🥤 Pop-up "Super Combos com 15% OFF"
          </button>
          <button type="button" class="vip-preset-btn" onclick="window.VIPMarketing.applyPopupPreset('happyhour')">
            ⚡ Pop-up "Happy Hour +10 Salgados Grátis"
          </button>
          <button type="button" class="vip-preset-btn" onclick="window.VIPMarketing.applyPopupPreset('festa')">
            🎉 Pop-up "Vai fazer Festa? Multiplique seu Kit"
          </button>
        </div>
      </div>

      <div class="adm-card">
        <div class="adm-card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;">
          <div>
            <h3><i class="fa-solid fa-window-restore"></i> Configuração do Pop-up Promocional na Entrada do Site</h3>
            <p style="margin:2px 0 0 0;font-size:0.82rem;color:#64748b;">Aparece automaticamente quando o cliente abre o cardápio e leva direto para o cupom ou promoção em 1 clique.</p>
          </div>
          <div style="display:flex;align-items:center;gap:0.75rem;">
            <span style="font-size:0.85rem;font-weight:800;color:${p.enabled ? '#059669' : '#64748b'};">
              ${p.enabled ? '🟢 POP-UP ATIVO NO SITE' : '⚪ POP-UP DESATIVADO'}
            </span>
            <label class="vip-switch">
              <input type="checkbox" id="pop-enabled-toggle" ${p.enabled ? "checked" : ""} onchange="window.VIPMarketing.togglePopupEnabled(this.checked)">
              <span class="vip-switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="adm-card-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;">
            <div class="adm-form-group">
              <label>Selo Superior (Badge Chamativo)</label>
              <input type="text" id="pop-badge" value="${esc(p.badge || '')}">
            </div>
            <div class="adm-form-group">
              <label>Título Principal Persuasivo (Headline)</label>
              <input type="text" id="pop-headline" value="${esc(p.headline || '')}">
            </div>
            <div class="adm-form-group" style="grid-column: 1 / -1;">
              <label>Texto da Oferta (Copy Persuasiva)</label>
              <input type="text" id="pop-body" value="${esc(p.bodyText || '')}">
            </div>
            <div class="adm-form-group">
              <label>Texto do Botão de Ação (CTA)</label>
              <input type="text" id="pop-cta" value="${esc(p.ctaText || '')}">
            </div>
            <div class="adm-form-group">
              <label>O que o botão faz quando o cliente clica?</label>
              <select id="pop-action-type">
                <option value="apply_coupon" ${p.actionType === 'apply_coupon' ? 'selected' : ''}>Ativar Cupom Automaticamente no Carrinho</option>
                <option value="scroll_combos" ${p.actionType === 'scroll_combos' ? 'selected' : ''}>Levar Direto para os Super Combos</option>
                <option value="scroll_kits" ${p.actionType === 'scroll_kits' ? 'selected' : ''}>Levar Direto para os Kits de Salgados</option>
              </select>
            </div>
            <div class="adm-form-group">
              <label>Código do Cupom vinculado (se aplicável)</label>
              <input type="text" id="pop-coupon-code" value="${esc(p.couponCode || 'SEXTOU10')}" style="text-transform:uppercase;font-weight:800;">
            </div>
            <div class="adm-form-group">
              <label>Programação de Exibição</label>
              <select id="pop-sched-mode">
                <option value="always" ${p.scheduleMode === 'always' ? 'selected' : ''}>Sempre que estiver Ativado</option>
                <option value="time_window" ${p.scheduleMode === 'time_window' ? 'selected' : ''}>Apenas em Horário Programado</option>
                <option value="date_range" ${p.scheduleMode === 'date_range' ? 'selected' : ''}>Período de Datas Específico</option>
              </select>
            </div>
            <div class="adm-form-group">
              <label>Janela de Horário (Início / Fim)</label>
              <div style="display:flex;gap:6px;">
                <input type="time" id="pop-start-time" value="${esc(p.startTime || '16:00')}">
                <input type="time" id="pop-end-time" value="${esc(p.endTime || '22:30')}">
              </div>
            </div>
            <div class="adm-form-group">
              <label>Período de Datas (Opcional)</label>
              <div style="display:flex;gap:6px;">
                <input type="date" id="pop-start-date" value="${esc(p.startDate || '')}">
                <input type="date" id="pop-end-date" value="${esc(p.endDate || '')}">
              </div>
            </div>
          </div>

          <div style="margin-top:1.25rem;display:flex;gap:0.75rem;justify-content:flex-end;flex-wrap:wrap;">
            <button type="button" class="btn-secondary" onclick="window.VIPMarketing.previewPopupInAdmin()">
              <i class="fa-solid fa-eye"></i> Testar / Visualizar Pop-up Agora
            </button>
            <button type="button" class="btn-primary" onclick="window.VIPMarketing.savePopupConfigFromForm()">
              <i class="fa-solid fa-floppy-disk"></i> Salvar Configuração do Pop-up
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function buildCreativeStudioHtml(data) {
    const cs = data.creativeStudio || {};
    const defaultWa = cs.generatedCopyWhatsapp || `🥟 *${cs.headline || 'SEXTOU COM SALGADOS VIP!'}* 🔥\n\nSalgadinhos fritos na hora, super crocantes e sequinhos saindo agora em Nova Iguaçu!\n\n🎟️ *${cs.offerHighlight || 'USE O CUPOM: SEXTOU10'}*\n💰 *${cs.priceTag || 'Kits a partir de R$ 20,00'}*\n\n👉 *Peça em 1 clique no nosso Cardápio Digital:*\n${window.location.origin + window.location.pathname.replace('admin.html', 'index.html')}`;

    return `
      <div class="vip-preset-bar">
        <div class="vip-preset-bar-title"><i class="fa-solid fa-wand-magic-sparkles"></i> Temas de Criativo IA em 1 Clique (Gera Arte + Texto Persuasivo automaticamente)</div>
        <div class="vip-preset-pills">
          <button type="button" class="vip-preset-btn" onclick="window.VIPMarketing.applyCreativePreset('sextou')">🔥 Tema Sextou Crocante</button>
          <button type="button" class="vip-preset-btn" onclick="window.VIPMarketing.applyCreativePreset('combofamilia')">🥤 Tema Combo Família 15% OFF</button>
          <button type="button" class="vip-preset-btn" onclick="window.VIPMarketing.applyCreativePreset('kitfesta')">🎉 Tema Kit Festa & Aniversário</button>
          <button type="button" class="vip-preset-btn" onclick="window.VIPMarketing.applyCreativePreset('happyhour')">⚡ Tema Happy Hour do Salgado</button>
        </div>
      </div>

      <div class="vip-creative-studio-layout">
        <div class="adm-card">
          <div class="adm-card-header">
            <h3><i class="fa-solid fa-pen-nib"></i> Gerador de Peça Publicitária & Copy Persuasiva por IA</h3>
          </div>
          <div class="adm-card-body">
            <div class="adm-form-group">
              <label>Título de Impacto da Arte (Headline)</label>
              <input type="text" id="cs-headline" value="${esc(cs.headline || '')}" oninput="window.VIPMarketing.renderCreativeCanvas()">
            </div>
            <div class="adm-form-group">
              <label>Subtítulo de Valor (Proposta de Valor)</label>
              <input type="text" id="cs-subheadline" value="${esc(cs.subheadline || '')}" oninput="window.VIPMarketing.renderCreativeCanvas()">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.85rem;">
              <div class="adm-form-group">
                <label>Destaque de Cupom / Oferta</label>
                <input type="text" id="cs-offer" value="${esc(cs.offerHighlight || '')}" oninput="window.VIPMarketing.renderCreativeCanvas()">
              </div>
              <div class="adm-form-group">
                <label>Ancoragem de Preço</label>
                <input type="text" id="cs-price" value="${esc(cs.priceTag || '')}" oninput="window.VIPMarketing.renderCreativeCanvas()">
              </div>
            </div>
            <div class="adm-form-group">
              <label>Texto Privo Prontinho para WhatsApp / Instagram (Gerado por IA)</label>
              <textarea id="cs-copy-wa" rows="6" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid #cbd5e1;font-family:inherit;font-size:0.86rem;">${esc(defaultWa)}</textarea>
            </div>
            <div style="display:flex;gap:0.65rem;flex-wrap:wrap;">
              <button type="button" class="btn-secondary" onclick="window.VIPMarketing.copyCreativeText()">
                <i class="fa-solid fa-copy"></i> Copiar Legenda p/ WhatsApp & Instagram
              </button>
              <button type="button" class="btn-primary" onclick="window.VIPMarketing.downloadCreativeImage()">
                <i class="fa-solid fa-download"></i> Baixar Imagem do Criativo (PNG Alta Resolução)
              </button>
            </div>
          </div>
        </div>

        <div class="vip-canvas-preview-wrap">
          <div style="font-size:0.8rem;font-weight:800;color:#fbbf24;text-transform:uppercase;margin-bottom:8px;">
            <i class="fa-solid fa-image"></i> Prévia Ao Vivo do Criativo (1080x1080)
          </div>
          <canvas id="vip-creative-canvas" width="1080" height="1080"></canvas>
          <p style="font-size:0.76rem;color:#cbd5e1;margin:8px 0 0 0;">Pronto para postar no Status do WhatsApp, Feed ou Stories do Instagram!</p>
        </div>
      </div>
    `;
  }

  function renderCreativeCanvas() {
    const canvas = document.getElementById("vip-creative-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const headline = document.getElementById("cs-headline")?.value || "SEXTOU COM SALGADOS VIP!";
    const subheadline = document.getElementById("cs-subheadline")?.value || "Fritos na hora, crocantes e sequinhos em Nova Iguaçu";
    const offer = document.getElementById("cs-offer")?.value || "USE O CUPOM: SEXTOU10";
    const price = document.getElementById("cs-price")?.value || "Kits a partir de R$ 20,00";

    // Fundo Gradiente Premium Escuro & Laranja Quente
    const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(0.55, "#7c2d12");
    grad.addColorStop(1, "#ea580c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Círculo decorativo luminoso
    ctx.beginPath();
    ctx.arc(540, 520, 420, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(251, 191, 36, 0.08)";
    ctx.fill();

    // Moldura interna elegante
    ctx.strokeStyle = "rgba(253, 224, 71, 0.35)";
    ctx.lineWidth = 4;
    ctx.strokeRect(48, 48, 984, 984);

    // Topo: Marca Salgados VIP
    ctx.fillStyle = "#fde047";
    ctx.font = "900 38px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🥟 SALGADOS VIP • NOVA IGUAÇU", 540, 145);

    // Headline Principal (Quebra inteligente em até 2 linhas)
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 68px sans-serif";
    wrapCanvasText(ctx, headline.toUpperCase(), 540, 295, 900, 78);

    // Subheadline
    ctx.fillStyle = "#fed7aa";
    ctx.font = "700 36px sans-serif";
    wrapCanvasText(ctx, subheadline, 540, 485, 880, 46);

    // Caixa Central de Oferta / Cupom
    ctx.fillStyle = "#fef08a";
    roundRect(ctx, 160, 575, 760, 130, 28);
    ctx.fill();

    ctx.fillStyle = "#7c2d12";
    ctx.font = "900 50px monospace";
    ctx.fillText(offer.toUpperCase(), 540, 658);

    // Ancoragem de Preço
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 54px sans-serif";
    ctx.fillText(price, 540, 815);

    // Rodapé CTA
    ctx.fillStyle = "#16a34a";
    roundRect(ctx, 190, 885, 700, 95, 48);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 34px sans-serif";
    ctx.fillText("PEÇA PELO CARDÁPIO DIGITAL • ENTREGA RÁPIDA", 540, 945);
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text || "").split(" ");
    let line = "";
    let curY = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, curY);
        line = words[n] + " ";
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, curY);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function buildStrategicPlanningHtml(data) {
    const plan = data.planning || {};
    const orders = getAllHistoricalOrders().filter(o => o.status !== "cancelado");
    const totalRevenue = orders.reduce((acc, o) => acc + parseFloat(o.totalAmount || o.total || 0), 0);
    const ordersCount = orders.length;
    const avgTicket = ordersCount > 0 ? totalRevenue / ordersCount : 0;

    // 1. Metas SMART com progresso real
    const smartHtml = (plan.smartGoals || []).map(g => {
      let currentVal = 0;
      let formattedCurrent = "";
      let formattedTarget = "";
      if (g.metric === "revenue") {
        currentVal = totalRevenue;
        formattedCurrent = formatMoney(currentVal);
        formattedTarget = formatMoney(g.targetValue);
      } else if (g.metric === "avg_ticket") {
        currentVal = avgTicket;
        formattedCurrent = formatMoney(currentVal);
        formattedTarget = formatMoney(g.targetValue);
      } else {
        currentVal = ordersCount;
        formattedCurrent = `${currentVal} pedidos`;
        formattedTarget = `${g.targetValue} pedidos`;
      }
      const pct = Math.min(100, Math.round((currentVal / Math.max(1, g.targetValue)) * 100));

      return `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <strong style="color:#0f172a;font-size:0.92rem;">🎯 ${esc(g.title)}</strong>
            <span style="font-size:0.76rem;font-weight:800;color:#ea580c;">Prazo: ${esc(g.deadline)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.82rem;color:#475569;margin-bottom:6px;">
            <span>Atual: <strong>${formattedCurrent}</strong></span>
            <span>Meta SMART: <strong>${formattedTarget} (${pct}%)</strong></span>
          </div>
          <div style="height:10px;background:#e2e8f0;border-radius:999px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#f59e0b,#10b981);"></div>
          </div>
        </div>
      `;
    }).join("");

    // 2. Personas
    const personasHtml = (plan.personas || []).map(p => `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1rem;">
        <h4 style="margin:0 0 4px 0;color:#0f172a;"><i class="fa-solid fa-user-tag" style="color:#ea580c;"></i> ${esc(p.name)}</h4>
        <div style="font-size:0.78rem;font-weight:700;color:#b45309;margin-bottom:8px;">${esc(p.ageIncome)}</div>
        <p style="margin:4px 0;font-size:0.82rem;"><strong>😣 Dores:</strong> ${esc(p.pains)}</p>
        <p style="margin:4px 0;font-size:0.82rem;"><strong>😍 Desejos:</strong> ${esc(p.desires)}</p>
        <p style="margin:4px 0;font-size:0.82rem;"><strong>❤️ Gatilho Emocional:</strong> ${esc(p.emotionalBehavior)}</p>
      </div>
    `).join("");

    // 5. Omnichannel
    const omniHtml = (plan.omnichannel || []).map(o => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;gap:1rem;">
        <div>
          <strong style="color:#0f172a;font-size:0.9rem;">${esc(o.channel)}</strong>
          <div style="font-size:0.8rem;color:#475569;">${esc(o.action)}</div>
        </div>
        <label class="vip-switch">
          <input type="checkbox" ${o.active ? "checked" : ""} onchange="window.VIPMarketing.toggleOmnichannel('${esc(o.id)}', this.checked)">
          <span class="vip-switch-slider"></span>
        </label>
      </div>
    `).join("");

    // 7. Cronograma
    const timelineHtml = (plan.timeline || []).map(t => `
      <div style="padding:0.85rem 1rem;background:#f8fafc;border-left:4px solid #f59e0b;border-radius:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="color:#0f172a;font-size:0.9rem;">📅 ${esc(t.title)}</strong>
          <span style="font-size:0.74rem;font-weight:800;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:999px;">${esc(t.period)}</span>
        </div>
        <div style="font-size:0.8rem;color:#475569;margin-top:4px;">Objetivo: ${esc(t.goal)}</div>
      </div>
    `).join("");

    // 8. Orçamento e ROI
    const roi = plan.budgetRoi || {};
    const totalInvested = (parseFloat(roi.monthlyAdBudget) || 350) + (parseFloat(roi.packagingMarketingCost) || 80);
    const couponRev = (data.coupons || []).reduce((acc, c) => acc + (c.revenueGenerated || 0), 0);
    const estimatedClicks = Math.round((parseFloat(roi.monthlyAdBudget) || 350) / Math.max(0.1, parseFloat(roi.estimatedCpc) || 0.65));
    const estimatedOrders = Math.round(estimatedClicks * ((parseFloat(roi.estimatedConversionRate) || 12) / 100));
    const projectedRevenue = estimatedOrders * (avgTicket > 0 ? avgTicket : 48);
    const roiPercent = Math.round(((projectedRevenue + couponRev - totalInvested) / Math.max(1, totalInvested)) * 100);

    return `
      <!-- 1. OBJETIVOS E METAS SMART -->
      <div class="adm-card" style="margin-bottom:1.25rem;">
        <div class="adm-card-header">
          <h3><i class="fa-solid fa-bullseye"></i> 1. Definição de Objetivos e Metas (SMART) — Conectado às Vendas Reais</h3>
        </div>
        <div class="adm-card-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem;">
            ${smartHtml}
          </div>
        </div>
      </div>

      <!-- 2. PÚBLICO-ALVO & PERSONAS E 4. ESTRATÉGIA DOS 4 Ps -->
      <div class="vip-plan-grid-2">
        <div class="adm-card">
          <div class="adm-card-header">
            <h3><i class="fa-solid fa-users-viewfinder"></i> 2. Público-Alvo e Personas (Dores, Desejos e Emoção)</h3>
          </div>
          <div class="adm-card-body" style="display:flex;flex-direction:column;gap:0.85rem;">
            ${personasHtml}
          </div>
        </div>

        <div class="adm-card">
          <div class="adm-card-header">
            <h3><i class="fa-solid fa-cubes"></i> 4. Estratégia dos 4 Ps (Produto, Preço, Praça e Promoção)</h3>
          </div>
          <div class="adm-card-body" style="display:flex;flex-direction:column;gap:0.75rem;font-size:0.84rem;">
            <div style="padding:0.7rem;background:#fff7ed;border-radius:10px;"><strong>🥟 Produto:</strong> ${esc(plan.fourPs?.produto)}</div>
            <div style="padding:0.7rem;background:#ecfdf5;border-radius:10px;"><strong>💰 Preço:</strong> ${esc(plan.fourPs?.preco)}</div>
            <div style="padding:0.7rem;background:#eff6ff;border-radius:10px;"><strong>📍 Praça (Canais):</strong> ${esc(plan.fourPs?.praca)}</div>
            <div style="padding:0.7rem;background:#f5f3ff;border-radius:10px;"><strong>📣 Promoção:</strong> ${esc(plan.fourPs?.promocao)}</div>
          </div>
        </div>
      </div>

      <!-- 3. ANÁLISE DE MERCADO E CONCORRÊNCIA (SWOT) -->
      <div class="adm-card" style="margin-bottom:1.25rem;">
        <div class="adm-card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <h3><i class="fa-solid fa-table-cells-large"></i> 3. Análise de Mercado e Concorrência (Matriz SWOT Editável)</h3>
          <button type="button" class="btn-primary btn-sm" onclick="window.VIPMarketing.saveSwotMatrix()">
            <i class="fa-solid fa-floppy-disk"></i> Salvar SWOT
          </button>
        </div>
        <div class="adm-card-body">
          <div class="vip-swot-grid">
            <div class="vip-swot-box strengths">
              <h4><i class="fa-solid fa-circle-plus"></i> Forças (Strengths)</h4>
              <textarea id="swot-s">${esc(plan.swot?.strengths || '')}</textarea>
            </div>
            <div class="vip-swot-box weaknesses">
              <h4><i class="fa-solid fa-circle-minus"></i> Fraquezas (Weaknesses)</h4>
              <textarea id="swot-w">${esc(plan.swot?.weaknesses || '')}</textarea>
            </div>
            <div class="vip-swot-box opportunities">
              <h4><i class="fa-solid fa-arrow-trend-up"></i> Oportunidades (Opportunities)</h4>
              <textarea id="swot-o">${esc(plan.swot?.opportunities || '')}</textarea>
            </div>
            <div class="vip-swot-box threats">
              <h4><i class="fa-solid fa-triangle-exclamation"></i> Ameaças (Threats)</h4>
              <textarea id="swot-t">${esc(plan.swot?.threats || '')}</textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- 5. OMNICHANNEL E 7. CRONOGRAMA DE AÇÕES -->
      <div class="vip-plan-grid-2">
        <div class="adm-card">
          <div class="adm-card-header">
            <h3><i class="fa-solid fa-share-nodes"></i> 5. Abordagem Multicanal (Omnichannel Ativo/Inativo)</h3>
          </div>
          <div class="adm-card-body" style="display:flex;flex-direction:column;gap:0.65rem;">
            ${omniHtml}
          </div>
        </div>

        <div class="adm-card">
          <div class="adm-card-header">
            <h3><i class="fa-solid fa-calendar-check"></i> 6 & 7. Cronograma de Ações e Campanhas</h3>
          </div>
          <div class="adm-card-body" style="display:flex;flex-direction:column;gap:0.65rem;">
            ${timelineHtml}
          </div>
        </div>
      </div>

      <!-- 8. ORÇAMENTO E ROI (RETORNO SOBRE INVESTIMENTO) -->
      <div class="adm-card">
        <div class="adm-card-header">
          <h3><i class="fa-solid fa-chart-pie"></i> 8. Orçamento e Simulador de ROI (CPC, CPL e Retorno sobre Investimento)</h3>
        </div>
        <div class="adm-card-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1rem;">
            <div class="adm-form-group">
              <label>Orçamento Tráfego Pago / Mês (R$)</label>
              <input type="number" id="roi-budget" value="${roi.monthlyAdBudget || 350}" oninput="window.VIPMarketing.saveRoiInputs()">
            </div>
            <div class="adm-form-group">
              <label>Custo Panfletos / Adesivos QR (R$)</label>
              <input type="number" id="roi-pack" value="${roi.packagingMarketingCost || 80}" oninput="window.VIPMarketing.saveRoiInputs()">
            </div>
            <div class="adm-form-group">
              <label>CPC Médio Estimado (R$ por clique)</label>
              <input type="number" id="roi-cpc" step="0.05" value="${roi.estimatedCpc || 0.65}" oninput="window.VIPMarketing.saveRoiInputs()">
            </div>
            <div class="adm-form-group">
              <label>Taxa de Conversão do Cardápio (%)</label>
              <input type="number" id="roi-conv" value="${roi.estimatedConversionRate || 12}" oninput="window.VIPMarketing.saveRoiInputs()">
            </div>
          </div>
          <div class="vip-mkt-kpi-grid" style="margin-bottom:0;">
            <div class="vip-mkt-kpi-card">
              <div class="vip-mkt-kpi-icon orange"><i class="fa-solid fa-wallet"></i></div>
              <div class="vip-mkt-kpi-info">
                <span>Investimento Total</span>
                <strong>${formatMoney(totalInvested)}</strong>
                <small>Tráfego + Embalagem</small>
              </div>
            </div>
            <div class="vip-mkt-kpi-card">
              <div class="vip-mkt-kpi-icon blue"><i class="fa-solid fa-mouse-pointer"></i></div>
              <div class="vip-mkt-kpi-info">
                <span>Visitas / Pedidos Previstos</span>
                <strong>~${estimatedClicks} cliques / ${estimatedOrders} ped.</strong>
                <small>CPL estimado: ${formatMoney(totalInvested / Math.max(1, estimatedOrders))}</small>
              </div>
            </div>
            <div class="vip-mkt-kpi-card">
              <div class="vip-mkt-kpi-icon green"><i class="fa-solid fa-money-bill-trend-up"></i></div>
              <div class="vip-mkt-kpi-info">
                <span>Retorno Estimado + Cupons</span>
                <strong>${formatMoney(projectedRevenue + couponRev)}</strong>
                <small>ROI Estimado: +${roiPercent}%</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // AÇÕES INTERATIVAS DO PAINEL ADMINISTRATIVO
  // ============================================================================
  function toggleMasterEnabled(checked) {
    const data = loadMarketingData();
    data.masterEnabled = !!checked;
    saveMarketingData(data);
    renderAdminCouponsTab();
    renderAdminMarketingTab();
  }

  function toggleCouponActive(couponId, checked) {
    const data = loadMarketingData();
    const c = (data.coupons || []).find(x => x.id === couponId);
    if (c) {
      c.active = !!checked;
      saveMarketingData(data);
      renderAdminCouponsTab();
    }
  }

  function toggleCouponShowInCart(couponId, checked) {
    const data = loadMarketingData();
    const c = (data.coupons || []).find(x => x.id === couponId);
    if (c) {
      c.showInCart = !!checked;
      saveMarketingData(data);
    }
  }

  function deleteCoupon(couponId) {
    const data = loadMarketingData();
    data.coupons = (data.coupons || []).filter(x => x.id !== couponId);
    saveMarketingData(data);
    renderAdminCouponsTab();
  }

  function createPresetCoupon(presetKey) {
    const presets = {
      sextou10: { code: "SEXTOU10", title: "Sextou 10% OFF", description: "10% de desconto para começar o fim de semana!", type: "percent", value: 10, minOrder: 35 },
      vip15: { code: "SUPERVIP15", title: "Super VIP 15% OFF", description: "15% OFF em pedidos a partir de R$ 60,00.", type: "percent", value: 15, minOrder: 60 },
      desconto10reais: { code: "FESTA10", title: "R$ 10,00 OFF no Kit Festa", description: "Desconto direto de R$ 10,00 acima de R$ 70,00.", type: "fixed", value: 10, minOrder: 70 },
      bonus10salgados: { code: "GANHE10", title: "+10 Salgadinhos Extras Grátis", description: "Ganhe +10 salgadinhos tradicionais de bônus!", type: "bonus_salgados", value: 10, minOrder: 50 },
      fretegratis: { code: "FRETEVIP", title: "Frete Grátis VIP", description: "Entrega grátis em pedidos acima de R$ 75,00.", type: "free_shipping", value: 0, minOrder: 75 }
    };
    const p = presets[presetKey];
    if (!p) return;

    const data = loadMarketingData();
    const existing = (data.coupons || []).find(c => c.code === p.code);
    if (existing) {
      existing.active = true;
      existing.showInCart = true;
    } else {
      data.coupons.unshift({
        id: "cup-" + Date.now(),
        code: p.code,
        title: p.title,
        description: p.description,
        type: p.type,
        value: p.value,
        minOrder: p.minOrder,
        maxUses: 0,
        usedCount: 0,
        revenueGenerated: 0,
        active: true,
        showInCart: true,
        scheduleDays: [0, 1, 2, 3, 4, 5, 6],
        startTime: "00:00",
        endTime: "23:59",
        expiresAt: ""
      });
    }
    saveMarketingData(data);
    renderAdminCouponsTab();
  }

  function saveCustomCouponFromForm() {
    const code = (document.getElementById("new-cup-code")?.value || "").trim().toUpperCase().replace(/\s+/g, "");
    const title = (document.getElementById("new-cup-title")?.value || "").trim() || `Cupom ${code}`;
    const type = document.getElementById("new-cup-type")?.value || "percent";
    const value = parseFloat(document.getElementById("new-cup-val")?.value) || 0;
    const minOrder = parseFloat(document.getElementById("new-cup-min")?.value) || 0;
    const startTime = document.getElementById("new-cup-start")?.value || "00:00";
    const endTime = document.getElementById("new-cup-end")?.value || "23:59";

    if (!code) {
      notifyToast("Digite um código para o cupom (ex: FESTA15).", "error");
      return;
    }

    const data = loadMarketingData();
    data.coupons.unshift({
      id: "cup-" + Date.now(),
      code,
      title,
      description: `Válido para pedidos acima de ${formatMoney(minOrder)}.`,
      type,
      value,
      minOrder,
      maxUses: 0,
      usedCount: 0,
      revenueGenerated: 0,
      active: true,
      showInCart: true,
      scheduleDays: [0, 1, 2, 3, 4, 5, 6],
      startTime,
      endTime,
      expiresAt: ""
    });
    saveMarketingData(data);
    renderAdminCouponsTab();
  }

  function sendCouponToPopup(code) {
    const data = loadMarketingData();
    data.popup.couponCode = code;
    data.popup.actionType = "apply_coupon";
    data.popup.enabled = true;
    data.popup.headline = `Ative seu Cupom ${code} Agora!`;
    saveMarketingData(data);
    notifyToast(`🎉 Cupom ${code} vinculado e ativado no Pop-up de entrada do site!`);
    renderAdminMarketingTab();
  }

  function switchMktSubtab(tab) {
    currentMktSubtab = tab;
    renderAdminMarketingTab();
  }

  function toggleEngine(engineKey, checked) {
    const data = loadMarketingData();
    if (data.engines && data.engines[engineKey]) {
      data.engines[engineKey].enabled = !!checked;
      saveMarketingData(data);
      renderAdminMarketingTab();
    }
  }

  function updateRetentionCoupon(val) {
    const data = loadMarketingData();
    data.engines.retentionTrigger.couponToOffer = String(val || "SEXTOU10").trim().toUpperCase();
    saveMarketingData(data);
    renderAdminMarketingTab();
  }

  function updateWeatherFactor(val) {
    const data = loadMarketingData();
    data.engines.demandForecast.weatherFactor = val;
    saveMarketingData(data);
    renderAdminMarketingTab();
  }

  function saveHappyHourConfig() {
    const data = loadMarketingData();
    const hh = data.engines.happyHourIdle;
    hh.startTime = document.getElementById("hh-start")?.value || "15:00";
    hh.endTime = document.getElementById("hh-end")?.value || "18:00";
    hh.benefitType = document.getElementById("hh-type")?.value || "percent";
    hh.benefitValue = parseFloat(document.getElementById("hh-val")?.value) || 10;
    hh.nearbyNeighborhoods = document.getElementById("hh-bairros")?.value || "";
    hh.nearbyOnly = !!document.getElementById("hh-nearby-only")?.checked;
    saveMarketingData(data);
    renderAdminMarketingTab();
  }

  function togglePopupEnabled(checked) {
    const data = loadMarketingData();
    data.popup.enabled = !!checked;
    saveMarketingData(data);
    renderAdminMarketingTab();
  }

  function applyPopupPreset(preset) {
    const data = loadMarketingData();
    const p = data.popup;
    if (preset === "sextou") {
      p.badge = "🔥 SEXTOU NO SALGADOS VIP";
      p.headline = "10% OFF nos Kits Fritos na Hora!";
      p.bodyText = "Comece o fim de semana com salgadinhos crocantes e sequinhos. Clique abaixo para ativar seu cupom automático na sacola!";
      p.ctaText = "Ativar Cupom SEXTOU10 em 1 Clique";
      p.actionType = "apply_coupon";
      p.couponCode = "SEXTOU10";
    } else if (preset === "combos") {
      p.badge = "⚡ ECONOMIA REAL DE 15%";
      p.headline = "Super Combos com Refrigerante + Molhos!";
      p.bodyText = "Salgadinhos quentinhos + bebida gelada + molhos especiais da casa com desconto direto no cardápio.";
      p.ctaText = "Ver Super Combos Agora";
      p.actionType = "scroll_combos";
    } else if (preset === "happyhour") {
      p.badge = "🎁 BÔNUS ESPECIAL VIP";
      p.headline = "Ganhe +10 Salgadinhos Extras Hoje!";
      p.bodyText = "Em pedidos acima de R$ 55,00 você ganha +10 salgadinhos tradicionais de presente da nossa cozinha!";
      p.ctaText = "Ativar Bônus +10 Salgados";
      p.actionType = "apply_coupon";
      p.couponCode = "MAIS10SALGADOS";
    } else if (preset === "festa") {
      p.badge = "🎉 ESPECIAL FESTAS & REUNIÕES";
      p.headline = "Vai receber amigos ou fazer aniversário?";
      p.bodyText = "Monte seu kit de salgados e multiplique por 2x, 3x até 5x em 1 clique com desconto VIP!";
      p.ctaText = "Ativar Cupom VIP5 e Montar Kit";
      p.actionType = "apply_coupon";
      p.couponCode = "VIP5";
    }
    p.enabled = true;
    saveMarketingData(data);
    renderAdminMarketingTab();
  }

  function savePopupConfigFromForm() {
    const data = loadMarketingData();
    const p = data.popup;
    p.badge = document.getElementById("pop-badge")?.value || p.badge;
    p.headline = document.getElementById("pop-headline")?.value || p.headline;
    p.bodyText = document.getElementById("pop-body")?.value || p.bodyText;
    p.ctaText = document.getElementById("pop-cta")?.value || p.ctaText;
    p.actionType = document.getElementById("pop-action-type")?.value || "apply_coupon";
    p.couponCode = (document.getElementById("pop-coupon-code")?.value || "SEXTOU10").trim().toUpperCase();
    p.scheduleMode = document.getElementById("pop-sched-mode")?.value || "always";
    p.startTime = document.getElementById("pop-start-time")?.value || "16:00";
    p.endTime = document.getElementById("pop-end-time")?.value || "22:30";
    p.startDate = document.getElementById("pop-start-date")?.value || "";
    p.endDate = document.getElementById("pop-end-date")?.value || "";
    saveMarketingData(data);
    renderAdminMarketingTab();
  }

  function previewPopupInAdmin() {
    savePopupConfigFromForm();
    sessionStorage.removeItem(SESSION_POPUP_DISMISSED);
    const data = loadMarketingData();
    const prev = data.popup.enabled;
    data.popup.enabled = true;
    localStorage.setItem(STORAGE_KEY_MKT, JSON.stringify(data));
    renderCustomerPopupIfEligible();
    data.popup.enabled = prev;
    localStorage.setItem(STORAGE_KEY_MKT, JSON.stringify(data));
  }

  function applyCreativePreset(theme) {
    const data = loadMarketingData();
    const cs = data.creativeStudio;
    if (theme === "sextou") {
      cs.headline = "SEXTOU COM SALGADOS VIP!";
      cs.subheadline = "Salgados fritos na hora, crocantes e sequinhos em Nova Iguaçu";
      cs.offerHighlight = "USE O CUPOM: SEXTOU10";
      cs.priceTag = "Kits a partir de R$ 20,00";
    } else if (theme === "combofamilia") {
      cs.headline = "SUPER COMBO FAMÍLIA VIP";
      cs.subheadline = "Salgadinhos Quentinhos + Refrigerante Gelado + Molhos da Casa";
      cs.offerHighlight = "15% DE DESCONTO REAL";
      cs.priceTag = "Combo Completo no Cardápio";
    } else if (theme === "kitfesta") {
      cs.headline = "VAI FAZER FESTA HOJE?";
      cs.subheadline = "Monte seu Kit de 50 a 500 salgados em 1 clique no nosso app";
      cs.offerHighlight = "CUPOM: VIP5 (-R$ 5,00)";
      cs.priceTag = "Sabores Tradicionais & Nobres";
    } else if (theme === "happyhour") {
      cs.headline = "HAPPY HOUR DO SALGADO!";
      cs.subheadline = "Peça entre 15h e 18h e ganhe vantagem automática na sacola";
      cs.offerHighlight = "DESCONTO AUTOMÁTICO";
      cs.priceTag = "Fritos na Hora • Entrega Rápida";
    }
    const storeUrl = window.location.origin + window.location.pathname.replace("admin.html", "index.html");
    cs.generatedCopyWhatsapp = `🥟 *${cs.headline}* 🔥\n\n${cs.subheadline}!\n\n🎟️ *${cs.offerHighlight}*\n💰 *${cs.priceTag}*\n\n👉 *Peça agora em 1 clique no nosso Cardápio Digital:*\n${storeUrl}`;
    saveMarketingData(data);
    renderAdminMarketingTab();
  }

  function copyCreativeText() {
    const txt = document.getElementById("cs-copy-wa")?.value || "";
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt);
    }
    notifyToast("✓ Texto persuasivo copiado! Pronto para colar no WhatsApp ou Instagram.");
  }

  function downloadCreativeImage() {
    renderCreativeCanvas();
    const canvas = document.getElementById("vip-creative-canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `criativo-salgados-vip-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    notifyToast("✓ Imagem PNG em alta resolução (1080x1080) baixada com sucesso!");
  }

  function saveSwotMatrix() {
    const data = loadMarketingData();
    data.planning.swot = {
      strengths: document.getElementById("swot-s")?.value || "",
      weaknesses: document.getElementById("swot-w")?.value || "",
      opportunities: document.getElementById("swot-o")?.value || "",
      threats: document.getElementById("swot-t")?.value || ""
    };
    saveMarketingData(data);
  }

  function toggleOmnichannel(id, checked) {
    const data = loadMarketingData();
    const item = (data.planning?.omnichannel || []).find(o => o.id === id);
    if (item) {
      item.active = !!checked;
      saveMarketingData(data);
    }
  }

  function saveRoiInputs() {
    const data = loadMarketingData();
    data.planning.budgetRoi = {
      monthlyAdBudget: parseFloat(document.getElementById("roi-budget")?.value) || 0,
      packagingMarketingCost: parseFloat(document.getElementById("roi-pack")?.value) || 0,
      estimatedCpc: parseFloat(document.getElementById("roi-cpc")?.value) || 0.65,
      estimatedConversionRate: parseFloat(document.getElementById("roi-conv")?.value) || 12
    };
    saveMarketingData(data, true);
    renderAdminMarketingTab();
  }

  // ============================================================================
  // INICIALIZAÇÃO AUTOMÁTICA (DETECTA SE ESTÁ NO ADMIN OU NO CLIENTE)
  // ============================================================================
  function bootstrap() {
    const isAdminPage = !!document.getElementById("admin-sidebar-nav");
    if (isAdminPage) {
      renderAdminCouponsTab();
      renderAdminMarketingTab();
      window.addEventListener("vip_orders_updated", () => {
        renderAdminCouponsTab();
        renderAdminMarketingTab();
      });
      window.addEventListener("vip_supabase_synced", () => {
        renderAdminCouponsTab();
        renderAdminMarketingTab();
      });
    } else {
      initCustomerMarketingUI();
      window.addEventListener("vip_supabase_synced", () => {
        initCustomerMarketingUI();
        if (typeof window.updateCartGlobalUI === "function") window.updateCartGlobalUI();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }

  // Expor API pública limpa e isolada
  window.VIPMarketing = {
    getData: loadMarketingData,
    saveData: saveMarketingData,
    getCheckoutAdjustment,
    recordOrderMarketingConversion,
    renderCheckoutMarketingWidgets,
    initCustomerMarketingUI,
    addFavoriteOrderToCart,
    closeCustomerPopup,
    triggerPopupAction,
    applyCouponFromInput,
    applyCouponFromCheckout,
    removeCheckoutCoupon,
    quickAddUpsellProduct,
    renderAdminCouponsTab,
    renderAdminMarketingTab,
    toggleMasterEnabled,
    toggleCouponActive,
    toggleCouponShowInCart,
    deleteCoupon,
    createPresetCoupon,
    saveCustomCouponFromForm,
    sendCouponToPopup,
    switchMktSubtab,
    toggleEngine,
    updateRetentionCoupon,
    updateWeatherFactor,
    saveHappyHourConfig,
    togglePopupEnabled,
    applyPopupPreset,
    savePopupConfigFromForm,
    previewPopupInAdmin,
    applyCreativePreset,
    renderCreativeCanvas,
    copyCreativeText,
    downloadCreativeImage,
    saveSwotMatrix,
    toggleOmnichannel,
    saveRoiInputs
  };
})();
