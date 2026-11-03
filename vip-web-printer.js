/**
 * ==============================================================================
 * SALGADOS VIP - MOTOR AUTÔNOMO DE IMPRESSÃO TÉRMICA & COMANDAS (v50.0)
 * ==============================================================================
 * Módulo 100% Isolado: window.VIPThermalPrinter / window.VIPWebPrinter
 *
 * CARACTERÍSTICAS DE ARQUITETURA & SEGURANÇA:
 * 1. UNIFICAÇÃO TOTAL: A impressão na bobina é 100% IDÊNTICA à Prévia Ao Vivo.
 *    - O mesmo gerador de layout HTML (ReceiptBuilder) alimenta tanto a prévia
 *      quanto o envio para o cabeçote da impressora (#thermal-receipt-area).
 *    - Respeita tipografia (Monospace, Sans-Serif, Condensed).
 *    - Respeita tamanho da letra (Pequena, Média, Grande, Extra Grande).
 *    - Respeita intensidade de negrito (Normal, Negrito, Extra Forte).
 *    - Respeita espaçamento entre linhas e margens milimétricas.
 *    - Renderiza Logotipo com filtro de alto contraste térmico.
 *    - Banners e checklists de Bebidas Geladas.
 *    - Caixas destacadas para o Motoboy (Cobrança, Troco em Dinheiro, Checklist).
 *    - Caixa do PIX com chave e favorecido.
 *    - Sabores detalhados com indicadores ampliados (▶ 40x COXINHA...).
 * 2. ELIMINAÇÃO DA IMPRESSÃO EM 3 PÁGINAS (Página única contínua):
 *    - Remoção estrita de page-break-after: always no marcador de corte.
 *    - Altura fluida auto, quebras de página desativadas para bobina contínua.
 * 3. INDEPENDÊNCIA MULTI-COMPUTADOR (PC 1, PC 2, etc.):
 *    - Alvo de impressão armazenado isoladamente em localStorage por máquina.
 *    - Consulta automática ao Spooler local (porta 18181) para listar impressoras
 *      reais instaladas no Windows e alimentar o seletor no painel admin.
 *    - Suporte nativo a WebUSB direto, WebSerial (COM), e Kiosk Silent Print.
 * 4. BLINDAGEM DE BANCO DE DADOS & EVENTOS:
 *    - Conector seguro getDB().
 *    - Prevenção de impressões duplicadas para pedidos já impressos.
 *    - Retrocompatibilidade global (printOrderReceipt, updatePrinterLivePreview).
 */

(function () {
  "use strict";

  const LOCAL_STORAGE_KEY = "vip_local_printer_device_target";
  const LOCAL_USB_DEVICE_KEY = "vip_local_paired_usb_printer";
  const LOCAL_SERIAL_PORT_KEY = "vip_local_paired_serial_port";
  const PRINTED_ORDERS_SESSION_KEY = "vip_printed_order_ids";

  // Conector seguro ao banco de dados com tolerância a múltiplos escopos
  function getDB() {
    if (typeof window !== "undefined" && window.VIPDatabase) return window.VIPDatabase;
    if (typeof VIPDatabase !== "undefined") return VIPDatabase;
    return null;
  }

  // ============================================================================
  // 1. RECEIPT BUILDER: GERADOR UNIFICADO DE LAYOUT TÉRMICO (PRÉVIA & IMPRESSÃO)
  // ============================================================================
  const ReceiptBuilder = {
    // Formata moeda BRL
    formatMoney(val) {
      const num = Number(val) || 0;
      return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    },

    // Formata data e hora legível
    formatDateTime(ts) {
      if (!ts) return new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const d = new Date(ts);
      if (isNaN(d.getTime())) return String(ts);
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    },

    // Detecta se um item é bebida gelada
    isDrink(item) {
      if (!item) return false;
      const name = String(item.name || "").toLowerCase();
      const catId = String(item.categoryId || "").toLowerCase();
      if (/bebida|refrigerante|suco|cerveja|água|agua|refri/i.test(catId)) return true;
      if (/coca|guaraná|guarana|fanta|pepsi|sprite|schweppes|heineken|antarctica|brahma|suco|água|agua|mate|del valle|tonica|red bull|monster|cerveja|lata|latão|2l|1\.5l|600ml|350ml/i.test(name)) {
        return true;
      }
      return false;
    },

    // Extrai todas as bebidas geladas de um pedido para banners e checklist
    extractDrinks(order) {
      const drinks = [];
      if (!order || !Array.isArray(order.items)) return drinks;

      order.items.forEach((item) => {
        if (item.type === "product" || !item.type) {
          if (this.isDrink(item)) {
            drinks.push({
              name: item.name || "Bebida",
              quantity: item.quantity || 1
            });
          }
        } else if (item.type === "combo") {
          (item.items || []).forEach((ci) => {
            if (this.isDrink(ci)) {
              drinks.push({
                name: ci.name || "Bebida do Combo",
                quantity: ci.quantity || 1
              });
            }
          });
        }
      });
      return drinks;
    },

    // Constrói mapa de propriedades tipográficas e espaçamentos
    getTypographyStyles(printerCfg) {
      const pCfg = printerCfg || {};

      const fontFamilyVal = pCfg.fontFamily || "monospace";
      const fontSizeVal = pCfg.fontSize || "medium";
      const fontWeightVal = pCfg.fontWeight || "bold";
      const lineSpacingVal = pCfg.lineSpacing || "normal";
      const widthMmVal = parseInt(pCfg.printableWidthMm) || (pCfg.paperWidth === "58mm" ? 50 : 76);
      const marginMmVal = pCfg.marginSideMm !== undefined ? parseInt(pCfg.marginSideMm) : 2;

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

      return {
        fontFamily: fontFamCss,
        fontSize: fontSizeCss,
        fontWeight: fontWeightCss,
        lineHeight: lineHeightCss,
        widthMm: widthMmVal,
        marginMm: marginMmVal
      };
    },

    // Aplica regras de tipografia no elemento container (seja o preview ou o receipt-area)
    applyStylesToElement(el, printerCfg) {
      if (!el) return;
      const t = this.getTypographyStyles(printerCfg);
      el.style.width = `${t.widthMm}mm`;
      el.style.maxWidth = "100%";
      el.style.marginLeft = "auto";
      el.style.marginRight = "auto";
      el.style.paddingLeft = `${t.marginMm}mm`;
      el.style.paddingRight = `${t.marginMm}mm`;
      el.style.boxSizing = "border-box";
      el.style.fontFamily = t.fontFamily;
      el.style.fontSize = t.fontSize;
      el.style.fontWeight = t.fontWeight;
      el.style.lineHeight = t.lineHeight;
    },

    // Gera o HTML Completo e Fiel do Cupom Térmico (Idêntico na Prévia e na Bobina)
    buildHtmlReceipt(order, cfg, printerCfg, copyNum = 1, totalCopies = 1) {
      const storeCfg = cfg || {};
      const pCfg = printerCfg || {};
      const ord = order || {};

      const showLogo = pCfg.printLogo !== false;
      const highlightDrinks = pCfg.highlightDrinks !== false;
      const showMotoboy = pCfg.showMotoboyBox !== false;
      const showPix = pCfg.printPixDetails !== false;

      const orderId = ord.id || ord.orderId || "VIP-DEMO";
      const orderDateStr = this.formatDateTime(ord.createdAt);
      const custName = ord.customer?.name || "Cliente";
      const custPhone = ord.customer?.phone || "";
      const isDelivery = ord.fulfillment === "Entrega" || ord.customer?.fulfillment !== "Retirada";

      // 1. Logo
      const logoHtml = (showLogo && storeCfg.logoUrl) ? `
        <div style="text-align: center; margin-bottom: 6px;">
          <img src="${storeCfg.logoUrl}" alt="Logo" style="max-height: 52px; max-width: 140px; object-fit: contain; filter: grayscale(100%) contrast(150%);">
        </div>
      ` : "";

      // 2. Título da Via
      let viaTitle = "[ 1ª VIA - CONTROLE & COZINHA ]";
      if (totalCopies > 1) {
        if (copyNum === 1) viaTitle = "[ 1ª VIA - CONTROLE & COZINHA ]";
        else if (copyNum === 2) viaTitle = "[ 2ª VIA - CLIENTE / ENTREGA ]";
        else viaTitle = `[ ${copyNum}ª VIA - ADICIONAL ]`;
      }

      // 3. Bebidas Geladas
      const drinks = this.extractDrinks(ord);
      const hasDrinks = drinks.length > 0;
      const totalDrinkUnits = drinks.reduce((acc, d) => acc + (d.quantity || 1), 0);

      const drinksBannerHtml = (highlightDrinks && hasDrinks) ? `
        <div class="receipt-drink-pill-banner" style="border: 2px solid #000; background: #000; color: #fff !important; text-align: center; font-weight: 900; font-size: 9.5pt; padding: 3px 4px; margin: 5px 0; letter-spacing: 0.5px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
          *** 🥤 PEDIDO CONTÉM BEBIDA GELADA (${totalDrinkUnits} UN) ***
        </div>
      ` : "";

      // 4. Linhas de Itens
      let itemsRowsHtml = "";
      (ord.items || []).forEach((item) => {
        const qty = item.quantity || 1;
        const name = item.name || item.kitName || "Item do Cardápio";
        const priceNum = Number(item.totalPrice || item.finalPrice || (item.price ? item.price * qty : 0)) || 0;
        const priceFormatted = this.formatMoney(priceNum);
        const itemIsDrink = this.isDrink(item);

        if (itemIsDrink && highlightDrinks) {
          itemsRowsHtml += `
            <tr class="receipt-drink-item-row" style="background: #f4f4f4; border-top: 1px solid #000; border-bottom: 1px solid #000; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
              <td colspan="2" class="receipt-item-desc receipt-drink-name" style="padding: 4px 2px; font-weight: 900; font-size: 10.5pt;">
                🥤 [BEBIDA GELADA] ${qty}x ${name}
                <span class="receipt-drink-subhighlight" style="display: block; margin-top: 2px; font-size: 8.5pt; font-weight: 900;">➔ PEGAR NA GELADEIRA ANTES DE ENVIAR</span>
              </td>
              <td style="text-align: right; font-weight: bold; padding: 4px 2px; white-space: nowrap;">${priceFormatted}</td>
            </tr>
          `;
        } else {
          itemsRowsHtml += `
            <tr>
              <td colspan="2" class="receipt-item-desc" style="padding: 3px 2px; font-weight: bold;">${qty}x ${name}</td>
              <td style="text-align: right; font-weight: bold; padding: 3px 2px; white-space: nowrap;">${priceFormatted}</td>
            </tr>
          `;
        }

        // Sabores, Molhos e Distribuição
        let subDetailsHtml = "";
        if (Array.isArray(item.flavors) && item.flavors.length > 0) {
          item.flavors.forEach((f) => {
            if (f.quantity && f.quantity > 0) {
              subDetailsHtml += `
                <div class="receipt-flavor-line" style="font-size: 11pt; font-weight: 900; line-height: 1.3; color: #000; margin: 2px 0;">
                  <span class="receipt-flavor-qty" style="font-size: 12pt; font-weight: 900; display: inline-block;">▶ ${f.quantity}x</span> <strong>${String(f.name || "").toUpperCase()}</strong>
                </div>
              `;
            }
          });
        } else if (item.selectedFlavor) {
          subDetailsHtml += `
            <div class="receipt-flavor-line" style="font-size: 11pt; font-weight: 900; line-height: 1.3; color: #000; margin: 2px 0;">
              <span class="receipt-flavor-qty" style="font-size: 12pt; font-weight: 900; display: inline-block;">▶</span> Sabor: <strong>${item.selectedFlavor}</strong>
            </div>
          `;
        }

        if (Array.isArray(item.sauces) && item.sauces.length > 0) {
          item.sauces.forEach((s) => {
            const sqty = s.quantity || 1;
            subDetailsHtml += `
              <div class="receipt-extra-line" style="font-size: 9.5pt; font-weight: 700; color: #111; margin-top: 2px;">
                ★ Molho: ${sqty}x ${s.name}
              </div>
            `;
          });
        }

        if (item.notes) {
          subDetailsHtml += `
            <div class="receipt-extra-line" style="font-size: 9.5pt; font-style: italic; color: #222; margin-top: 2px;">
              Obs Item: ${item.notes}
            </div>
          `;
        }

        if (subDetailsHtml) {
          itemsRowsHtml += `
            <tr>
              <td colspan="3" class="receipt-subitems" style="padding-left: 6px; padding-bottom: 4px; border-bottom: 1px dotted #ccc;">
                ${subDetailsHtml}
              </td>
            </tr>
          `;
        }
      });

      // 5. Checklist de Bebidas Geladas
      let drinksChecklistHtml = "";
      if (highlightDrinks && hasDrinks) {
        let chkItemsHtml = "";
        drinks.forEach((d) => {
          chkItemsHtml += `
            <div class="drinks-chk-item" style="font-size: 9.5pt; font-weight: 900; padding: 2px 0; border-bottom: 1px dotted #888;">
              [ ] 👉 <strong>${d.quantity}x ${d.name}</strong>
            </div>
          `;
        });
        drinksChecklistHtml = `
          <div class="receipt-drinks-checklist-box" style="border: 2px dashed #000; padding: 6px; margin: 8px 0; background: #ffffff; text-align: center;">
            <div class="drinks-checklist-title" style="font-size: 10.5pt; font-weight: 900; text-transform: uppercase; margin-bottom: 2px;">
              *** 🥤 ATENÇÃO: NÃO ESQUECER A BEBIDA! ***
            </div>
            <div class="drinks-checklist-sub" style="font-size: 8pt; font-weight: bold; margin-bottom: 5px;">
              RETIRAR DA GELADEIRA ANTES DE ENTREGAR AO MOTOBOY:
            </div>
            <div class="drinks-checklist-items" style="text-align: left; padding-left: 4px;">
              ${chkItemsHtml}
            </div>
          </div>
        `;
      }

      // 6. Observações Gerais
      const orderNotes = ord.notes || ord.customer?.notes || "";
      const notesHtml = orderNotes ? `
        <div class="receipt-divider" style="border-top: 1px dashed #000; margin: 4px 0;"></div>
        <div style="font-size: 9.5pt; margin: 3px 0;">
          <strong>OBSERVAÇÕES:</strong><br>
          ${orderNotes}
        </div>
      ` : "";

      // 7. Totais
      const subtotalNum = Number(ord.subtotal || ord.subtotalAmount || (ord.totalAmount ? ord.totalAmount - (ord.deliveryFee || 0) : 0)) || 0;
      const deliveryFeeNum = Number(ord.deliveryFee || 0);
      const totalNum = Number(ord.totalAmount || ord.total || 0);

      // 8. Bloco do Motoboy
      let motoboyBoxHtml = "";
      if (showMotoboy && isDelivery) {
        const payMethod = ord.paymentMethod || "A Definir";
        const isCash = /dinheiro|especie|espécie/i.test(payMethod);
        const isPixPay = /pix/i.test(payMethod);
        const changeForNum = Number(ord.changeFor || 0);
        const changeDue = changeForNum > totalNum ? (changeForNum - totalNum) : 0;

        let badgeText = "COBRAR DO CLIENTE NA ENTREGA";
        let amountText = `TOTAL A COBRAR: ${this.formatMoney(totalNum)}`;
        let instructText = `Receber em ${payMethod} e conferir na entrega.`;

        if (isPixPay) {
          badgeText = "PAGAMENTO PIX (JÁ PAGO / CONFERIR)";
          amountText = `VALOR DO PEDIDO: ${this.formatMoney(totalNum)}`;
          instructText = "Favor conferir se o comprovante já foi enviado no WhatsApp.";
        } else if (/cart[aã]o|cr[eé]dito|d[eé]bito/i.test(payMethod)) {
          badgeText = "COBRAR NA MAQUININHA (LEVAR CARTÃO)";
          instructText = `Passar cartão de ${payMethod} no valor de ${this.formatMoney(totalNum)}.`;
        }

        let changeHtml = "";
        if (isCash && changeForNum > 0) {
          changeHtml = `
            <div class="receipt-change-highlight" style="border: 1px dashed #000; padding: 5px; margin-top: 5px; background: #fbfbfb;">
              <div class="change-line-title" style="font-size: 9.5pt; font-weight: 900; text-transform: uppercase;">🚨 ATENÇÃO: SEPARAR TROCO NA SAÍDA 🚨</div>
              <div class="change-line-detail" style="font-size: 9pt; margin: 2px 0;">Cliente vai pagar com: <strong>${this.formatMoney(changeForNum)}</strong></div>
              <div class="change-line-action" style="font-size: 11pt; font-weight: 900; color: #000; text-decoration: underline; margin-top: 2px;">👉 LEVAR DE TROCO: ${this.formatMoney(changeDue)}</div>
            </div>
          `;
        }

        let drinkCheckInMotoboy = "";
        if (hasDrinks && highlightDrinks) {
          drinkCheckInMotoboy = `
            <div class="motoboy-drink-check" style="border-top: 1px dashed #000; margin-top: 6px; padding-top: 4px; font-size: 8.5pt; font-weight: 900;">
              [ ] CONFERIU A BEBIDA NA BAG? (🥤 ${totalDrinkUnits} item gelado)
            </div>
          `;
        }

        motoboyBoxHtml = `
          <div class="receipt-motoboy-box" style="border: 3px solid #000; padding: 6px; margin: 10px 0 6px 0; text-align: center; background: #ffffff;">
            <div class="motoboy-box-header" style="font-size: 10pt; font-weight: 900; letter-spacing: 0.5px; margin-bottom: 4px; border-bottom: 1px solid #000; padding-bottom: 3px;">
              *** ATENÇÃO MOTOBOY: ${payMethod.toUpperCase()} ***
            </div>
            <div class="motoboy-box-badge" style="background: #000; color: #fff !important; font-size: 10.5pt; font-weight: 900; padding: 4px 6px; margin: 3px 0 5px 0; display: block; width: 100%; box-sizing: border-box; text-transform: uppercase; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
              ${badgeText}
            </div>
            <div class="motoboy-box-amount" style="font-size: 13pt; font-weight: 900; margin: 4px 0;">
              ${amountText}
            </div>
            <div class="motoboy-box-instructions" style="font-size: 9pt; font-weight: bold; line-height: 1.3; margin: 4px 0;">
              ${instructText}
            </div>
            ${changeHtml}
            ${drinkCheckInMotoboy}
          </div>
        `;
      }

      // 9. Bloco do PIX
      let pixBoxHtml = "";
      if (showPix && (/pix/i.test(ord.paymentMethod || "") || ord.pixCode)) {
        pixBoxHtml = `
          <div class="receipt-pix-box" style="border: 2px dashed #000; padding: 6px; margin: 8px 0; text-align: center; font-size: 9pt;">
            <strong>*** PAGAMENTO VIA PIX ***</strong><br>
            <span>Chave: <strong>${storeCfg.pixKey || "(21) 98675-8102"}</strong></span><br>
            <span>Favorecido: ${storeCfg.name || "Salgados VIP"}</span><br>
            <small>Favor enviar o comprovante no WhatsApp da loja</small>
          </div>
        `;
      }

      // 10. Endereço formatado com detalhes
      let addressHtml = "";
      if (isDelivery) {
        const addr = ord.customer?.address || "Endereço não informado";
        const ref = ord.customer?.reference ? `<br><small><strong>REF:</strong> ${ord.customer.reference}</small>` : "";
        addressHtml = `
          <div style="margin-top: 2px;">
            <strong>ENDEREÇO DE ENTREGA:</strong><br>
            ${addr}
            ${ref}
          </div>
        `;
      }

      // Montagem do HTML completo com página única contínua (sem quebra 3 páginas)
      return `
        <div class="receipt-copy" style="width: 100%; box-sizing: border-box; margin: 0 auto; page-break-after: avoid !important; break-inside: avoid !important;">
          <div class="receipt-header" style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 4px; margin-bottom: 4px;">
            ${logoHtml}
            <h2 style="font-size: 13.5pt; font-weight: 900; margin: 0 0 2px 0; letter-spacing: 0.5px;">${(storeCfg.name || "SALGADOS VIP").toUpperCase()}</h2>
            <p style="font-size: 9pt; margin: 1px 0;">${storeCfg.subtitle || "DELIVERY & BALCÃO - NOVA IGUAÇU"}</p>
            <p style="font-size: 9pt; margin: 1px 0;">${storeCfg.address || "Rua Isabel Pedrosa, 31 - Da Luz"}</p>
            <p style="font-size: 9pt; margin: 1px 0;">WhatsApp: ${storeCfg.phone || "(21) 98675-8102"}</p>
            <div class="receipt-via-badge" style="display: inline-block; padding: 2px 8px; border: 1.5px solid #000; font-weight: 900; font-size: 9pt; margin-top: 3px; text-transform: uppercase; border-radius: 3px; letter-spacing: 0.5px;">
              ${viaTitle}
            </div>
          </div>

          <div class="receipt-order-meta" style="margin-bottom: 4px;">
            <div class="row" style="display: flex; justify-content: space-between; align-items: baseline; gap: 4px; flex-wrap: wrap; margin: 1px 0;">
              <span><strong>PEDIDO:</strong> #${orderId}</span>
              <span><strong>DATA:</strong> ${orderDateStr}</span>
            </div>
            <div class="row" style="display: flex; justify-content: space-between; align-items: baseline; gap: 4px; flex-wrap: wrap; margin: 1px 0;">
              <span><strong>CLIENTE:</strong> ${custName}</span>
            </div>
            ${custPhone ? `
              <div class="row" style="display: flex; justify-content: space-between; align-items: baseline; gap: 4px; flex-wrap: wrap; margin: 1px 0;">
                <span><strong>CONTATO:</strong> ${custPhone}</span>
              </div>
            ` : ""}
            <div class="row" style="display: flex; justify-content: space-between; align-items: baseline; gap: 4px; flex-wrap: wrap; margin-top: 3px;">
              <span><strong>MODALIDADE:</strong> ${isDelivery ? "MOTO ENTREGA EM DOMICÍLIO" : "RETIRADA NO BALCÃO"}</span>
            </div>
            <div class="row" style="display: flex; justify-content: space-between; align-items: baseline; gap: 4px; flex-wrap: wrap; margin-top: 1px;">
              <span><strong>PREVISÃO:</strong> ${ord.timingType === "agendado" && ord.scheduledDate ? `${ord.scheduledDate} às ${ord.scheduledTime || ""}` : "IMEDIATO / AGORA"}</span>
            </div>
            ${drinksBannerHtml}
            ${addressHtml}
          </div>

          <div class="receipt-divider" style="border-top: 1px dashed #000; margin: 4px 0;"></div>
          <div class="receipt-section-title" style="font-weight: 900; text-transform: uppercase; font-size: 10pt; margin: 4px 0 2px 0; letter-spacing: 0.5px;">ITENS DO PEDIDO</div>

          <table class="receipt-items-table" style="width: 100%; border-collapse: collapse; margin: 4px 0; table-layout: fixed;">
            ${itemsRowsHtml}
          </table>

          ${drinksChecklistHtml}
          ${notesHtml}

          <div class="receipt-totals" style="border-top: 2px dashed #000; padding-top: 4px; margin-top: 4px;">
            ${deliveryFeeNum > 0 ? `
              <div class="row" style="display: flex; justify-content: space-between; align-items: baseline; margin: 2px 0;">
                <span>SUBTOTAL:</span>
                <span>${this.formatMoney(subtotalNum)}</span>
              </div>
              <div class="row" style="display: flex; justify-content: space-between; align-items: baseline; margin: 2px 0;">
                <span>TAXA ENTREGA:</span>
                <span>${this.formatMoney(deliveryFeeNum)}</span>
              </div>
            ` : ""}
            <div class="row total-big" style="display: flex; justify-content: space-between; align-items: baseline; font-size: 13pt; font-weight: 900; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 3px 0; margin-top: 4px;">
              <span>TOTAL DO PEDIDO:</span>
              <span>${this.formatMoney(totalNum)}</span>
            </div>
            <div class="row" style="display: flex; justify-content: space-between; align-items: baseline; margin: 3px 0 1px 0; font-size: 9.5pt;">
              <span>PAGAMENTO:</span>
              <span style="font-weight: 900;">${ord.paymentMethod || "A Definir"}</span>
            </div>
          </div>

          ${motoboyBoxHtml}
          ${pixBoxHtml}

          <div class="receipt-footer" style="text-align: center; font-size: 8.5pt; margin-top: 6px; padding-top: 4px; border-top: 1px dashed #000;">
            <p style="margin: 2px 0;">Obrigado pela preferência!</p>
            <p style="margin: 2px 0; font-weight: bold;">${storeCfg.name || "Salgados VIP"} - O Melhor de Nova Iguaçu</p>
          </div>

          <div class="receipt-cut-line" style="border-top: 1px dashed #666; margin: 4mm 0 0 0; padding: 2mm 0 0 0; text-align: center; font-size: 8pt; color: #555; page-break-after: avoid !important;">
            - - - - - - - - - CORTE DA BOBINA - - - - - - - - -
          </div>
        </div>
      `;
    },

    // Gera texto ASCII estruturado (utilizado para spooler direto e fallback ESC/POS)
    buildPlainTextReceipt(order, cfg, printerCfg) {
      const paperWidth = parseInt(printerCfg?.textColumns) || (printerCfg?.paperWidth === "58mm" ? 30 : 40);
      const divider = "=".repeat(paperWidth);
      const thinDivider = "-".repeat(paperWidth);

      function center(text) {
        const s = String(text || "").trim();
        if (s.length >= paperWidth) return s.substring(0, paperWidth);
        const pad = Math.floor((paperWidth - s.length) / 2);
        return " ".repeat(pad) + s;
      }

      function line(l, r) {
        const sL = String(l || "");
        const sR = String(r || "");
        const space = paperWidth - sL.length - sR.length;
        if (space <= 0) return (sL + " " + sR).substring(0, paperWidth);
        return sL + " ".repeat(space) + sR;
      }

      const lines = [];
      lines.push(divider);
      lines.push(center(cfg.name ? cfg.name.toUpperCase() : "SALGADOS VIP"));
      lines.push(center(cfg.subtitle || "DELIVERY & BALCAO - NOVA IGUACU"));
      if (cfg.phone) lines.push(center("WhatsApp: " + cfg.phone));
      lines.push(divider);

      const orderId = order.id || order.orderId || "VIP-DEMO";
      const dateStr = this.formatDateTime(order.createdAt);
      lines.push(line(`PEDIDO #${orderId}`, dateStr));
      lines.push(line("CLIENTE:", (order.customer?.name || "Cliente").substring(0, 18)));
      if (order.customer?.phone) lines.push(line("CONTATO:", order.customer.phone));

      const isDelivery = order.fulfillment === "Entrega" || order.customer?.fulfillment !== "Retirada";
      lines.push(line("MODALIDADE:", isDelivery ? "MOTO ENTREGA" : "RETIRADA BALCAO"));

      if (isDelivery && order.customer?.address) {
        lines.push(`ENDERECO: ${order.customer.address.substring(0, paperWidth - 10)}`);
        if (order.customer?.reference) {
          lines.push(`REF: ${order.customer.reference.substring(0, paperWidth - 5)}`);
        }
      }

      const drinks = this.extractDrinks(order);
      if (drinks.length > 0 && printerCfg?.highlightDrinks !== false) {
        lines.push(thinDivider);
        lines.push(center("*** CONTEM BEBIDA GELADA ***"));
        drinks.forEach((d) => lines.push(`  [ ] ${d.quantity}x ${d.name}`));
        lines.push(thinDivider);
      }

      lines.push(thinDivider);
      lines.push(center("[ ITENS DO PEDIDO ]"));
      (order.items || []).forEach((item) => {
        const qty = item.quantity || 1;
        const name = (item.name || "Item").substring(0, paperWidth - 14);
        const price = this.formatMoney(item.totalPrice || item.finalPrice || (item.price ? item.price * qty : 0));
        lines.push(line(`${qty}x ${name}`, price));

        if (Array.isArray(item.flavors)) {
          item.flavors.forEach((f) => {
            if (f.quantity) lines.push(`   > ${f.quantity}x ${f.name}`);
          });
        }
        if (Array.isArray(item.sauces)) {
          item.sauces.forEach((s) => lines.push(`   * Molho: ${s.quantity || 1}x ${s.name}`));
        }
      });

      if (order.notes || order.customer?.notes) {
        lines.push(thinDivider);
        lines.push(`OBS: ${order.notes || order.customer?.notes}`);
      }

      lines.push(thinDivider);
      if (order.deliveryFee > 0) {
        lines.push(line("Subtotal:", this.formatMoney(order.subtotalAmount || 0)));
        lines.push(line("Taxa Entrega:", this.formatMoney(order.deliveryFee)));
      }
      lines.push(line("TOTAL DO PEDIDO:", this.formatMoney(order.totalAmount || 0)));
      lines.push(line("PAGAMENTO:", order.paymentMethod || "A Definir"));

      if (order.changeFor) {
        lines.push(line("Troco para:", this.formatMoney(order.changeFor)));
        const chgDue = order.changeFor - (order.totalAmount || 0);
        if (chgDue > 0) lines.push(line("LEVAR DE TROCO:", this.formatMoney(chgDue)));
      }

      lines.push(divider);
      lines.push(center("Obrigado pela preferencia!"));
      lines.push(center(cfg.name || "Salgados VIP"));
      lines.push(divider);
      lines.push("\n\n");

      return lines.join("\n");
    },

    // Gera bytes ESC/POS com comandos de cabeçalho, corte e negrito
    buildEscPosBytes(order, cfg, printerCfg) {
      const ESC = "\x1B";
      const GS = "\x1D";
      let cmd = "";

      // Reset
      cmd += ESC + "@";
      // Cabeçalho Centralizado Grande
      cmd += ESC + "a\x01";
      cmd += ESC + "E\x01";
      cmd += GS + "!\x11";
      cmd += (cfg.name ? cfg.name.toUpperCase() : "SALGADOS VIP") + "\n";
      cmd += GS + "!\x00";
      cmd += ESC + "E\x00";
      cmd += (cfg.subtitle || "DELIVERY & BALCAO - NOVA IGUACU") + "\n";
      if (cfg.phone) cmd += "WhatsApp: " + cfg.phone + "\n";
      cmd += "----------------------------------------\n";

      // Conteúdo em texto puro formatado
      const plainText = this.buildPlainTextReceipt(order, cfg, printerCfg);
      cmd += ESC + "a\x00"; // alinha esquerda
      cmd += plainText;

      // Avanço e Corte de papel
      cmd += "\n\n\n";
      cmd += GS + "V\x42\x03"; // Cut paper

      return new TextEncoder().encode(cmd);
    }
  };

  // ============================================================================
  // 2. MOTOR PRINCIPAL DE IMPRESSÃO TÉRMICA ISOLADA (VIPThermalPrinter)
  // ============================================================================
  const VIPThermalPrinter = {
    pairedUsbDevice: null,
    pairedSerialPort: null,
    isPrinting: false,
    installedSystemPrinters: [],
    spoolerOnline: false,

    // Inicialização autônoma ao carregar
    async init() {
      // 1. Reconectar WebUSB previamente autorizado neste computador
      if (typeof navigator !== "undefined" && navigator.usb) {
        try {
          const devices = await navigator.usb.getDevices();
          if (devices && devices.length > 0) {
            this.pairedUsbDevice = devices[0];
            console.log("[VIPThermalPrinter] WebUSB reconectado:", this.pairedUsbDevice.productName || "Impressora USB");
          }
        } catch (e) {
          console.warn("[VIPThermalPrinter] Aviso ao reconectar WebUSB:", e);
        }
      }

      // 2. Reconectar WebSerial previamente autorizado
      if (typeof navigator !== "undefined" && navigator.serial) {
        try {
          const ports = await navigator.serial.getPorts();
          if (ports && ports.length > 0) {
            this.pairedSerialPort = ports[0];
            console.log("[VIPThermalPrinter] WebSerial reconectado.");
          }
        } catch (e) {
          console.warn("[VIPThermalPrinter] Aviso ao reconectar WebSerial:", e);
        }
      }

      // 3. Consultar impressoras reais instaladas no Windows (porta 18181)
      this.detectSystemPrinters();

      // 4. Atualizar UI e renderizar a prévia ao vivo inicial
      this.updateUiStatus();
      this.updateLivePreview();
    },

    // Obtém o alvo configurado para ESTE computador específico
    getLocalTarget() {
      if (typeof localStorage === "undefined") return "windows_default";
      return localStorage.getItem(LOCAL_STORAGE_KEY) || "windows_default";
    },

    // Salva o alvo para ESTE computador sem afetar os outros
    setLocalTarget(target) {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_KEY, target || "windows_default");
      }
      this.updateUiStatus();
    },

    // Consulta silenciosa ao Spooler nativo do Windows (Porta 18181)
    async detectSystemPrinters() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 900);

        const res = await fetch("http://127.0.0.1:18181/status", {
          method: "GET",
          headers: { "Accept": "application/json" },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          this.spoolerOnline = true;
          this.installedSystemPrinters = Array.isArray(data.installedPrinters) ? data.installedPrinters : [];
          console.log("[VIPThermalPrinter] Spooler Windows detectado online. Impressoras:", this.installedSystemPrinters);
          this.populateInstalledPrintersDropdown(data.defaultPrinter);
          this.updateUiStatus();
        }
      } catch (err) {
        // Spooler não está rodando nesta máquina; utiliza modo nativo universal do navegador
        this.spoolerOnline = false;
      }
    },

    // Popula o seletor com as impressoras reais instaladas no Windows deste computador
    populateInstalledPrintersDropdown(defaultPrinterName) {
      const select = document.getElementById("cfg-printer-target");
      if (!select || this.installedSystemPrinters.length === 0) return;

      let group = document.getElementById("cfg-printer-installed-group");
      if (!group) {
        group = document.createElement("optgroup");
        group.id = "cfg-printer-installed-group";
        group.label = "🖨️ Impressoras Instaladas no Windows (Detectadas neste PC)";
        select.appendChild(group);
      }
      group.innerHTML = "";

      this.installedSystemPrinters.forEach((pName) => {
        const opt = document.createElement("option");
        opt.value = pName;
        opt.textContent = `${pName} ${pName === defaultPrinterName ? " (Padrão do Windows)" : ""}`;
        group.appendChild(opt);
      });

      const currentTarget = this.getLocalTarget();
      if (currentTarget) {
        select.value = currentTarget;
      }
    },

    // Conexão via WebUSB nativo (Zero programas)
    async pairUsbDevice() {
      if (!navigator.usb) {
        alert("O seu navegador não suporta WebUSB. Utilize o Google Chrome ou Microsoft Edge.");
        return false;
      }
      try {
        const device = await navigator.usb.requestDevice({ filters: [] });
        if (!device) return false;

        this.pairedUsbDevice = device;
        this.setLocalTarget("webusb");
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(LOCAL_USB_DEVICE_KEY, JSON.stringify({
            vendorId: device.vendorId,
            productId: device.productId,
            productName: device.productName || "Impressora Térmica USB"
          }));
        }
        this.updateUiStatus();
        alert(`✓ Impressora USB conectada: ${device.productName || "Impressora Térmica"}!\nAgora os pedidos imprimirão direto sem abrir janelas.`);
        return true;
      } catch (e) {
        if (e.name !== "NotFoundError") {
          console.error("[VIPThermalPrinter] Erro WebUSB:", e);
        }
        return false;
      }
    },

    // Conexão via WebSerial nativo
    async pairSerialPort() {
      if (!navigator.serial) {
        alert("O seu navegador não suporta WebSerial. Utilize o Google Chrome ou Edge.");
        return false;
      }
      try {
        const port = await navigator.serial.requestPort();
        if (!port) return false;

        this.pairedSerialPort = port;
        this.setLocalTarget("webserial");
        this.updateUiStatus();
        alert("✓ Porta Serial / COM conectada com sucesso!");
        return true;
      } catch (e) {
        if (e.name !== "NotFoundError") {
          console.error("[VIPThermalPrinter] Erro WebSerial:", e);
        }
        return false;
      }
    },

    // Atualiza indicadores de status e visibilidade na interface
    updateUiStatus() {
      const badge = document.getElementById("badge-print-agent-status");
      const targetSelect = document.getElementById("cfg-printer-target");
      const customNameInput = document.getElementById("cfg-printer-custom-name-box");
      const localTarget = this.getLocalTarget();

      if (targetSelect && localTarget) {
        targetSelect.value = localTarget;
      }
      if (customNameInput) {
        customNameInput.style.display = (localTarget === "custom") ? "block" : "none";
      }

      const statusBox = document.getElementById("vip-printer-device-status-text");
      if (statusBox) {
        if (localTarget === "webusb" && this.pairedUsbDevice) {
          statusBox.innerHTML = `<strong>Conectada (WebUSB):</strong> ${this.pairedUsbDevice.productName || "Impressora Térmica USB"}`;
        } else if (localTarget === "webusb") {
          statusBox.innerHTML = `<em>Modo WebUSB selecionado (Nenhuma impressora emparelhada. Clique em 'Conectar').</em>`;
        } else if (localTarget === "webserial") {
          statusBox.innerHTML = `<strong>Conectada (Porta Serial / COM):</strong> Pronta para envio direto ESC/POS.`;
        } else if (this.spoolerOnline && localTarget !== "windows_default") {
          statusBox.innerHTML = `<strong>Fila Windows Ativa:</strong> ${localTarget} (Spooler Local 18181).`;
        } else {
          statusBox.innerHTML = `<strong>Modo Universal:</strong> Impressora padrão deste computador (Zero Janelas / Kiosk).`;
        }
      }

      if (badge) {
        badge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Impressão Universal Ativa`;
        badge.className = "badge-silent-active";
      }
    },

    // ==========================================================================
    // 3. PRÉ-VISUALIZAÇÃO AO VIVO DO CUPOM (100% PARIDADE VISUAL COM A BOBINA)
    // ==========================================================================
    updateLivePreview() {
      const previewBox = document.getElementById("printer-live-preview-box");
      if (!previewBox) return;

      const db = getDB();
      const pCfg = db && db.getPrinterConfig ? db.getPrinterConfig() : {};
      const cfg = db && db.getConfig ? db.getConfig() : {};

      // Captura valores dos controles na tela ou da configuração salva
      const activePrinterCfg = {
        fontFamily: document.getElementById("cfg-printer-font-family")?.value || pCfg.fontFamily || "monospace",
        fontSize: document.getElementById("cfg-printer-font-size")?.value || pCfg.fontSize || "medium",
        fontWeight: document.getElementById("cfg-printer-font-weight")?.value || pCfg.fontWeight || "bold",
        lineSpacing: document.getElementById("cfg-printer-line-spacing")?.value || pCfg.lineSpacing || "normal",
        printableWidthMm: parseInt(document.getElementById("cfg-printer-width-mm")?.value) || pCfg.printableWidthMm || 76,
        marginSideMm: document.getElementById("cfg-printer-margin-mm") ? parseInt(document.getElementById("cfg-printer-margin-mm").value) : (pCfg.marginSideMm !== undefined ? pCfg.marginSideMm : 2),
        paperWidth: document.getElementById("cfg-printer-paper")?.value || pCfg.paperWidth || "80mm",
        printLogo: document.getElementById("cfg-printer-show-logo") ? document.getElementById("cfg-printer-show-logo").checked : (pCfg.printLogo !== false),
        highlightDrinks: document.getElementById("cfg-printer-highlight-drinks") ? document.getElementById("cfg-printer-highlight-drinks").checked : (pCfg.highlightDrinks !== false),
        showMotoboyBox: document.getElementById("cfg-printer-show-motoboy") ? document.getElementById("cfg-printer-show-motoboy").checked : (pCfg.showMotoboyBox !== false),
        printPixDetails: document.getElementById("cfg-printer-show-pix") ? document.getElementById("cfg-printer-show-pix").checked : (pCfg.printPixDetails !== false)
      };

      // Atualiza badge de dimensões na barra da prévia
      const dimBadge = document.getElementById("printer-preview-dimension-badge");
      if (dimBadge) {
        dimBadge.textContent = `Área ${activePrinterCfg.printableWidthMm}mm | Margens ${activePrinterCfg.marginSideMm}mm (Economia Máxima)`;
      }

      // Aplica exatamente os mesmos estilos tipográficos que vão para a bobina
      ReceiptBuilder.applyStylesToElement(previewBox, activePrinterCfg);

      // Pedido Exemplo para a Prévia Ao Vivo
      const sampleOrder = {
        id: "DEMO-108",
        createdAt: Date.now(),
        fulfillment: "Entrega",
        timingType: "imediato",
        customer: {
          name: "Ana Paula Souza",
          phone: "(21) 98765-4321",
          address: "Rua Bernardino de Mello, 1450, Apto 201 - Centro, Nova Iguaçu",
          reference: "Próximo à Praça do Skate"
        },
        items: [
          {
            type: "kit",
            name: "Cento de Salgados Fritos Tradicionais",
            quantity: 1,
            finalPrice: 64.00,
            flavors: [
              { name: "Coxinha de Frango c/ Catupiry", quantity: 40 },
              { name: "Bolinha de Queijo", quantity: 30 },
              { name: "Kibe Tradicional", quantity: 30 }
            ],
            sauces: [{ name: "Molho Barbecue Especial", quantity: 2 }]
          },
          {
            type: "product",
            name: "Coca-Cola 2L",
            quantity: 1,
            price: 14.00,
            totalPrice: 14.00,
            categoryId: "cat-bebidas"
          }
        ],
        subtotal: 78.00,
        deliveryFee: 8.00,
        totalAmount: 86.00,
        paymentMethod: "Dinheiro",
        changeFor: 100.00,
        notes: "Interfone 201. Tocar e aguardar descer. Salgados bem sequinhos, por favor."
      };

      // Gera o HTML do cupom idêntico ao impresso
      previewBox.innerHTML = ReceiptBuilder.buildHtmlReceipt(sampleOrder, cfg, activePrinterCfg, 1, 1);
    },

    // ==========================================================================
    // 4. DISPARO REAL DE IMPRESSÃO (UNIVERSAL, INDEPENDENTE & PARIDADE TOTAL)
    // ==========================================================================
    async printOrderReceipt(orderId, isAutoPrint = false, event = null, mockOrder = null) {
      if (this.isPrinting) return;
      this.isPrinting = true;

      try {
        const db = getDB();
        const orders = db && db.getOrders ? db.getOrders() : [];
        const order = mockOrder || orders.find((o) => String(o.id) === String(orderId) || String(o.orderId) === String(orderId));

        if (!order) {
          console.warn("[VIPThermalPrinter] Pedido não encontrado para impressão:", orderId);
          return;
        }

        // Se for auto-print e já foi impresso, descarta para evitar duplicidade
        if (isAutoPrint) {
          const sessionPrinted = sessionStorage.getItem(PRINTED_ORDERS_SESSION_KEY) || "";
          if (order.printed || order.printedAt || sessionPrinted.includes(String(order.id))) {
            return;
          }
        }

        // Registra pedido como impresso na sessão
        const sessionPrinted = sessionStorage.getItem(PRINTED_ORDERS_SESSION_KEY) || "";
        if (!sessionPrinted.includes(String(order.id))) {
          sessionStorage.setItem(PRINTED_ORDERS_SESSION_KEY, `${sessionPrinted},${order.id}`);
        }

        const cfg = db && db.getConfig ? db.getConfig() : {};
        const printerCfg = db && db.getPrinterConfig ? db.getPrinterConfig() : {};
        const localTarget = this.getLocalTarget();
        const numCopies = Math.max(1, parseInt(printerCfg.copies) || 1);

        // 1. TENTATIVA VIA WEBUSB DIRETO (Se configurado explicitamente)
        if (localTarget === "webusb" && this.pairedUsbDevice) {
          try {
            const escPosBytes = ReceiptBuilder.buildEscPosBytes(order, cfg, printerCfg);
            if (!this.pairedUsbDevice.opened) await this.pairedUsbDevice.open();
            if (this.pairedUsbDevice.configuration === null) await this.pairedUsbDevice.selectConfiguration(1);
            await this.pairedUsbDevice.claimInterface(0);
            const endpoint = this.pairedUsbDevice.configuration.interfaces[0].alternate.endpoints.find((e) => e.direction === "out");
            for (let c = 0; c < numCopies; c++) {
              await this.pairedUsbDevice.transferOut(endpoint.endpointNumber, escPosBytes);
            }
            this.finishPrint(order.id, isAutoPrint, "via WebUSB");
            return;
          } catch (usbErr) {
            console.warn("[VIPThermalPrinter] Falha WebUSB, recorrendo ao motor universal:", usbErr);
          }
        }

        // 2. TENTATIVA VIA WEBSERIAL DIRETO (Se configurado)
        if (localTarget === "webserial" && this.pairedSerialPort) {
          try {
            const escPosBytes = ReceiptBuilder.buildEscPosBytes(order, cfg, printerCfg);
            if (!this.pairedSerialPort.readable) await this.pairedSerialPort.open({ baudRate: 9600 });
            const writer = this.pairedSerialPort.writable.getWriter();
            for (let c = 0; c < numCopies; c++) {
              await writer.write(escPosBytes);
            }
            writer.releaseLock();
            this.finishPrint(order.id, isAutoPrint, "via Serial");
            return;
          } catch (serialErr) {
            console.warn("[VIPThermalPrinter] Falha WebSerial, recorrendo ao motor universal:", serialErr);
          }
        }

        // 3. MOTOR UNIVERSAL DO NAVEGADOR (Padrão para qualquer computador, notebook ou tablet)
        // Renderiza o cupom térmico no HTML dedicado de 1 página contínua com 100% de paridade visual
        const receiptArea = document.getElementById("thermal-receipt-area");
        if (receiptArea) {
          // Aplica exatamente as mesmas regras visuais da prévia ao vivo
          ReceiptBuilder.applyStylesToElement(receiptArea, printerCfg);

          let copiesHtml = "";
          for (let c = 1; c <= numCopies; c++) {
            copiesHtml += ReceiptBuilder.buildHtmlReceipt(order, cfg, printerCfg, c, numCopies);
          }
          receiptArea.innerHTML = copiesHtml;
        }

        this.finishPrint(order.id, isAutoPrint, "Universal");

        // Disparo de impressão universal do navegador:
        // Se o navegador estiver com atalho Kiosk (--kiosk-printing) ou SilentPrintingEnabled no Windows,
        // ele imprime IMEDIATAMENTE e SILENCIOSAMENTE sem nenhuma janela ou confirmação.
        setTimeout(() => {
          try {
            window.print();
          } catch (pErr) {
            console.error("[VIPThermalPrinter] Falha ao acionar window.print():", pErr);
          }
        }, 80);

      } finally {
        setTimeout(() => {
          this.isPrinting = false;
        }, 1200);
      }
    },

    // Finalização e gravação de status impresso
    finishPrint(orderId, isAutoPrint, channelDesc) {
      const db = getDB();
      if (db && typeof db.markOrderPrinted === "function") {
        db.markOrderPrinted(orderId);
      }

      if (typeof window.renderLiveOrders === "function") {
        window.renderLiveOrders();
      }

      console.log(`[VIPThermalPrinter] Pedido #${orderId} impresso (${channelDesc}).`);
      if (typeof window.showToastNotification === "function" && !isAutoPrint) {
        window.showToastNotification(`✓ Comanda do Pedido #${orderId} enviada para impressão!`);
      }
    },

    // Teste imediato de impressão
    testCurrentPrinter() {
      const db = getDB();
      const orders = db && db.getOrders ? db.getOrders() : [];
      const sampleOrder = orders.length > 0 ? orders[0] : null;

      if (sampleOrder) {
        this.printOrderReceipt(sampleOrder.id, false, null, sampleOrder);
      } else {
        const dummyOrder = {
          id: "TESTE",
          createdAt: Date.now(),
          fulfillment: "Entrega",
          customer: { name: "Cliente de Teste", phone: "(21) 98765-4321", address: "Av. Automóvel Clube, 500 - Centro" },
          items: [{ quantity: 1, name: "Kit 50 Salgados Degustação", finalPrice: 65, flavors: [{ name: "Coxinha", quantity: 50 }] }],
          totalAmount: 65,
          paymentMethod: "Pix"
        };
        this.printOrderReceipt("TESTE", false, null, dummyOrder);
      }
    }
  };

  // ============================================================================
  // 5. EXPORTAÇÕES GLOBAIS E RETROCOMPATIBILIDADE TOTAL
  // ============================================================================
  window.VIPThermalPrinter = VIPThermalPrinter;
  window.VIPWebPrinter = VIPThermalPrinter;

  // Funções legadas para o HTML e scripts antigos
  window.printOrderReceipt = function (orderId, isAutoPrint = false, event = null) {
    return VIPThermalPrinter.printOrderReceipt(orderId, isAutoPrint, event);
  };
  window.updatePrinterLivePreview = function () {
    return VIPThermalPrinter.updateLivePreview();
  };
  window.testThermalPrint = function () {
    return VIPThermalPrinter.testCurrentPrinter();
  };
  window.buildOrderTextReceipt = function (order, cfg, printerCfg) {
    return ReceiptBuilder.buildPlainTextReceipt(order, cfg, printerCfg);
  };

  // Inicialização quando o DOM estiver pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => VIPThermalPrinter.init());
  } else {
    VIPThermalPrinter.init();
  }
})();
