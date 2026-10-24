// ==============================================================================
// PWA CONTROLLER & INSTALLATION MANAGER - SALGADOS VIP
// ==============================================================================
(function () {
  let deferredPrompt = null;
  const DISMISS_KEY = 'salgados_vip_pwa_install_dismissed';

  // 1. Registro do Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Registra apenas em protocolo http/https (em file:// navegadores não suportam SW)
      if (window.location.protocol.startsWith('http')) {
        navigator.serviceWorker
          .register('./sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker registrado com sucesso. Escopo:', reg.scope);

            // Verificar atualizações do Service Worker
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[PWA] Nova versão disponível. Atualizando cache...');
                  }
                });
              }
            });
          })
          .catch((err) => {
            console.warn('[PWA] Falha ao registrar Service Worker:', err);
          });
      }
    });
  }

  // 2. Detecção se já está rodando como App Instalado (Standalone)
  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  }

  // 3. Captura do Evento Nativo de Instalação (Android, Chrome, Edge, PC)
  window.addEventListener('beforeinstallprompt', (e) => {
    // Previne a barra padrão inferior automática do navegador
    e.preventDefault();
    deferredPrompt = e;

    // Se já estiver instalado ou dispensado recentemente, não exibe
    if (isStandalone() || isDismissedRecently()) return;

    // Renderiza banner flutuante
    showInstallPromptBanner();
  });

  // 4. Detecção de Instalação Concluída
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] Aplicativo instalado com sucesso!');
    deferredPrompt = null;
    hideInstallBanner();
    showToastNotificationPWA('🎉 Salgados VIP instalado com sucesso na sua tela inicial!');
  });

  // 5. Interface Visual do Banner de Instalação (Diferenciado entre Cliente e Cozinha)
  function showInstallPromptBanner() {
    if (document.getElementById('pwa-install-banner') || isStandalone()) return;

    const isAdminPage = window.location.pathname.includes('admin') || 
                        window.location.href.includes('admin.html') ||
                        document.title.toLowerCase().includes('painel') ||
                        document.body.classList.contains('admin-body');

    const titleText = isAdminPage ? 'Instalar Painel da Cozinha' : 'Instale o App Salgados VIP';
    const subText = isAdminPage 
      ? 'Acompanhe pedidos em tela cheia no computador ou tablet!' 
      : 'Peça seus salgados favoritos direto da tela inicial!';
    const btnText = isAdminPage ? '<i class="fa-solid fa-desktop"></i> Instalar Painel' : '<i class="fa-solid fa-download"></i> Instalar Grátis';

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'pwa-install-banner';
    banner.innerHTML = `
      <div class="pwa-banner-content">
        <div class="pwa-banner-icon">
          <img src="icon-192.png" alt="Salgados VIP" onerror="this.src='favicon.png'">
        </div>
        <div class="pwa-banner-info">
          <strong>${titleText}</strong>
          <small>${subText}</small>
        </div>
        <div class="pwa-banner-actions">
          <button type="button" id="pwa-btn-install" class="pwa-btn-install">
            ${btnText}
          </button>
          <button type="button" id="pwa-btn-dismiss" class="pwa-btn-dismiss" aria-label="Fechar">&times;</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    // Eventos dos botões
    document.getElementById('pwa-btn-install')?.addEventListener('click', triggerInstallPrompt);
    document.getElementById('pwa-btn-dismiss')?.addEventListener('click', () => {
      dismissBanner();
    });
  }

  function hideInstallBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
      banner.classList.add('pwa-banner-hiding');
      setTimeout(() => banner.remove(), 300);
    }
  }

  function dismissBanner() {
    hideInstallBanner();
    // Lembra a dispensa por 48 horas
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch (e) {}
  }

  function isDismissedRecently() {
    try {
      const last = localStorage.getItem(DISMISS_KEY);
      if (!last) return false;
      const elapsed = Date.now() - parseInt(last, 10);
      return elapsed < 48 * 60 * 60 * 1000; // 48 horas
    } catch (e) {
      return false;
    }
  }

  // 6. Ação de Instalar quando o usuário clica
  window.showPWAInstallBanner = showInstallPromptBanner;
  window.triggerInstallPrompt = async function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      console.log('[PWA] Escolha do usuário:', choiceResult.outcome);
      if (choiceResult.outcome === 'accepted') {
        hideInstallBanner();
      }
      deferredPrompt = null;
    } else {
      // Se for iOS Safari, exibe modal explicativo de 2 passos
      const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase()) && !window.MSStream;
      if (isIos && !isStandalone()) {
        showIosInstallModal();
      } else {
        alert('Para instalar o app, clique nos três pontinhos do seu navegador (menu) e selecione "Instalar aplicativo" ou "Adicionar à tela inicial".');
      }
    }
  };

  // 7. Modal Especial para Usuários de iPhone (iOS Safari)
  function showIosInstallModal() {
    if (document.getElementById('pwa-ios-modal')) return;

    const isAdminPage = window.location.pathname.includes('admin') || 
                        window.location.href.includes('admin.html') ||
                        document.title.toLowerCase().includes('painel') ||
                        document.body.classList.contains('admin-body');

    const appName = isAdminPage ? 'Painel da Cozinha' : 'Salgados VIP';

    const modal = document.createElement('div');
    modal.id = 'pwa-ios-modal';
    modal.className = 'pwa-ios-modal-backdrop';
    modal.innerHTML = `
      <div class="pwa-ios-modal-card">
        <div class="pwa-ios-modal-header">
          <img src="icon-192.png" alt="${appName}" style="width: 48px; height: 48px; border-radius: 10px;">
          <div>
            <h3>Instalar no iPhone</h3>
            <p>Adicione o ${appName} à sua tela de início em 2 passos rápidos:</p>
          </div>
        </div>
        <div class="pwa-ios-steps">
          <div class="pwa-ios-step">
            <span class="pwa-step-num">1</span>
            <span>Toque no botão <strong>Compartilhar</strong> na barra do Safari (ícone <i class="fa-solid fa-arrow-up-from-bracket"></i> abaixo).</span>
          </div>
          <div class="pwa-ios-step">
            <span class="pwa-step-num">2</span>
            <span>Role para baixo e selecione <strong>"Adicionar à Tela de Início"</strong> (<i class="fa-regular fa-square-plus"></i>).</span>
          </div>
        </div>
        <button type="button" class="pwa-ios-close-btn" onclick="document.getElementById('pwa-ios-modal').remove()">Entendido!</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // 8. Monitor de Conexão Online/Offline
  window.addEventListener('offline', () => {
    showConnectionToast('📶 Você está sem conexão com a internet. O cardápio segue disponível!', 'offline');
  });

  window.addEventListener('online', () => {
    showConnectionToast('🟢 Conexão com a internet restabelecida!', 'online');
  });

  function showConnectionToast(msg, type) {
    let toast = document.getElementById('pwa-connection-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pwa-connection-toast';
      document.body.appendChild(toast);
    }
    toast.className = `pwa-conn-toast pwa-conn-${type} show`;
    toast.textContent = msg;

    if (type === 'online') {
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3500);
    }
  }

  function showToastNotificationPWA(msg) {
    if (typeof showToastNotification === 'function') {
      showToastNotification(msg);
    } else {
      showConnectionToast(msg, 'online');
    }
  }
})();
