# 🥟 Salgados VIP - Nova Iguaçu (Rio de Janeiro)

Sistema de cardápio digital e montagem personalizada de kits de salgados fritos com envio formatado para WhatsApp.

---

## 📍 Dados do Estabelecimento
- **Nome:** Salgados VIP - Nova Iguaçu - Rio de Janeiro
- **Retirada:** Rua Isabel Pedrosa, 31, Da Luz, Nova Iguaçu - RJ
- **Horário:** Todos os dias, 16:00 – 22:30
- **Abertura Automática:** O status (Aberto / Fechado) é calculado em tempo real com base no relógio do cliente/loja.

---

## 📦 Kits Disponíveis
- **Kit 20 salgadinhos:** R$ 25,00
- **Kit 30 salgadinhos:** R$ 39,90
- **Kit 50 salgadinhos:** R$ 64,90
- **Kit 70 salgadinhos:** R$ 72,90
- **Kit 80 salgadinhos:** R$ 80,90
- **Kit 100 salgadinhos:** R$ 96,00

---

## ⚙️ Regras Implementadas

### 1. Validação de Quantidade e Passo de Montagem do Kit
- Ao clicar em "Montar Sabores", o cliente seleciona os sabores de acordo com o **passo configurado para aquele kit** (ex: de **10 em 10** ou de **5 em 5 unidades**).
- Esse passo é **100% configurável** no Painel Administrativo para cada kit individualmente.
- A tela exibe o progresso em tempo real: `Selecionados: 40 de 50 | Restam: 10`.
- O botão **"Adicionar Kit ao Pedido"** só é desbloqueado quando a soma dos sabores for **exatamente igual** à quantidade do kit (ex: 50 de 50).

### 2. Catálogo Administrável (`FLAVORS_CATALOG`)
O catálogo é modular no arquivo [`app.js`](file:///C:/Users/Laura%20Barbosa/.gemini/antigravity/scratch/delivery-salgados-bkp-20261016-1127-11/app.js) sem listas fixas no código de cálculo. Cada sabor possui:
- `adicional_por_10`: Adicional cobrado proporcionalmente (ex: base de R$ 3,00 para Croquete de pernil, Croquetinho de feijoada, Croquete de bacalhau):
  - 5 unidades = + R$ 1,50 (50% nos kits de 5 em 5)
  - 10 unidades = + R$ 3,00
  - 15 unidades = + R$ 4,50
  - 20 unidades = + R$ 6,00
  - 25 unidades = + R$ 7,50
  - 30 unidades = + R$ 9,00
- `limite_quantidade`: Quantidade máxima permitida por kit (ex: Coxinha de costela possui limite de 10 unidades por kit). Se `null`, não possui limite restrito.

### 3. Molhos Opcionais (`SAUCES_CATALOG`)
- Sem Molho (R$ 0,00)
- Ketchup (R$ 3,50)
- Maionese Tradicional (R$ 3,50)
- Barbecue (R$ 3,50)
- Mostarda Amarela (R$ 3,50)
- Billy Jack (R$ 3,50)
- Mostarda Escura (R$ 3,50)
- Maionese de Alho da Casa (R$ 4,50)
- Molho Verde da Casa (R$ 4,50)
- Cheddar cremoso (R$ 3,50)
- Maionese de bacon (R$ 4,00)
- Maionese Grill (R$ 4,00)

### 4. Busca Rápida e Filtros de Sabores no Modal do Kit
- **Barra de Pesquisa Instantânea:** Permite ao cliente digitar qualquer termo (ex: "queijo", "coxinha", "camarão") e filtrar em tempo real os 26+ sabores sem lentidão. A busca é insensível a acentuação e maiúsculas.
- **Pills de Filtragem Rápida:**
  - **Todos:** Exibe o catálogo completo de sabores ativos.
  - **Selecionados (X):** Exibe apenas os sabores que já possuem unidades selecionadas para aquele kit, permitindo ajustes rápidos de quantidade sem precisar rolar a lista.
  - **Tradicionais:** Exibe apenas os sabores sem taxa adicional.
  - **Especiais (+):** Exibe os sabores nobres que possuem adicional proporcional (ex: Pernil, Feijoada, Bacalhau).
- **Contador Dinâmico:** Badge atualizado em tempo real mostrando quantos sabores distintos já foram incluídos no kit.

### 5. Pagamento Instantâneo via PIX (QR Code Dinâmico & Copia e Cola Padrão BACEN)
- **Cálculo 100% Automático:** Ao selecionar "Pix" na gaveta de finalização, o sistema calcula o valor total (subtotal + taxa de entrega) e gera o código **EMV BR Code oficial do Banco Central** com redundância cíclica **CRC16-CCITT**.
- **QR Code Renderizado na Tela:** O cliente pode apontar a câmera do celular no aplicativo de qualquer banco (Nubank, Inter, Itaú, Bradesco, Santander, Caixa, PicPay, etc.) para pagar imediatamente.
- **Botão "Copiar Código Pix":** Copia com um único clique o código Pix Copia e Cola para a área de transferência do cliente com feedback visual instantâneo.
- **Integração no WhatsApp:** A mensagem enviada ao WhatsApp da loja já inclui em destaque a Chave Pix, o Nome do Beneficiário e o Código Pix Copia e Cola para pagamento.
- **Configuração no Painel Administrativo:** Na aba "Loja & Horários", o administrador define a Chave Pix, o tipo de chave (Telefone, CPF, CNPJ, E-mail, Chave Aleatória), o nome do titular e a cidade, com botão para teste e prévia do QR Code na hora.

---

## 🔐 Painel Administrativo Oculto (`admin.html`)
Para gerenciar kits, sabores, molhos e valores em tempo real sem mexer no código:
1. Acesse o arquivo [`admin.html`](file:///C:/Users/Laura%20Barbosa/.gemini/antigravity/scratch/delivery-salgados-bkp-20261016-1127-11/admin.html) no navegador.
2. **Credenciais Iniciais na Nuvem (Supabase):**
   - **Usuário:** `admin` (ou `admin@salgadosvip.com.br`)
   - **Senha Inicial:** `vip123`
   - **Chave Mestra Padrão:** `VIP-REC-7890-ABCD`
   *(As senhas agora são protegidas por criptografia nativa SHA-256 com Salt exclusivo e salvas na nuvem Supabase na tabela `admin_auth`. Nenhuma credencial fica exposta em texto puro no navegador).*

3. **Recuperação de Acesso em caso de Esquecimento:**
   - Na tela de login, clique em **"Esqueceu a senha?"** ou **"Recuperar Acesso"**:
     - **Opção 1 (Chave Mestra):** Digite sua Chave Mestra de Segurança (ex: `VIP-REC-7890-ABCD`) e redefina a senha na hora.
     - **Opção 2 (E-mail / PIN):** Digite seu e-mail cadastrado para gerar um código PIN de 6 dígitos com validade de 15 minutos e redefinir o acesso.

### Recursos do Painel:
- **🔔 Pedidos Ao Vivo (Janela Ativa Padrão):** Primeira tela exibida ao acessar o painel administrativo. Monitora pedidos em tempo real com indicador "Ao Vivo", contadores no topo (Novos, Em Preparo, Prontos, Atrasados e Faturamento do Dia), filtros por status e busca rápida por cliente/telefone/endereço.
- **⏱️ Tempo de Espera & Alerta de Atraso:** Calcula o tempo decorrido desde a realização de cada pedido em tempo real. Se ultrapassar o tempo limite alvo configurado (padrão de 35 min) e ainda não estiver concluído, o card pulsa com uma borda vermelha e badge de alerta `⚠️ ATRASADO (+X min)`.
- **🔍 Detalhes Completos do Pedido (Ao Clicar):** Ao clicar em qualquer pedido, abre um modal detalhado com todos os dados do cliente (nome, WhatsApp com link direto para conversa, endereço de entrega ou retirada), composição completa dos kits e combos (sabores individuais, adicionais de sabores nobres, molhos), total a pagar, troco e botões rápidos para avançar status.
- **🖨️ Impressão Térmica Otimizada (76mm com Margens 2mm & 2mm / Fontes Ampliadas):**
  - **🔍 Sabores e Opções com Fonte Grande (Alta Legibilidade na Cozinha):** Os sabores escolhidos (ex: `▶ 40x COXINHA DE FRANGO`, `▶ 30x BOLINHA DE QUEIJO`) são impressos com tipografia ampliada de **11.5pt a 12.5pt em negrito forte (900)** e em maiúsculas, facilitando a leitura imediata pelos funcionários mesmo à distância na bancada ou fritadeira.
  - **📐 Margens Reduzidas a 2mm & 2mm (Economia Máxima da Bobina):** Área imprimível estendida para **76mm** centralizada (`margin: 0 auto; padding: 0 2mm`), aproveitando ao máximo a largura da bobina de 80mm sem desperdiçar papel e sem cortar nenhuma letra.
  - **🛵 Bloco de Cobrança do Motoboy:** Quadro de destaque com borda reforçada e tarja preta contendo a forma de pagamento (`DINHEIRO`, `CARTÃO`, `PIX`), total a cobrar em tamanho grande, instrução de ação (ex: `LEVAR MAQUININHA DE CARTÃO`, `RECEBER EM ESPÉCIE` ou `CONFERIR O PIX`) e cálculo automático de troco (`DEVOLVER DE TROCO: R$ XX,XX`).
  - **🥤 Alerta Anti-Esquecimento de Bebidas:** Linhas destacadas com marcador `[BEBIDA GELADA]`, aviso nos combos (`➔ PEGAR NA GELADEIRA!`), checklist com caixas de conferência `[ ]` antes do despacho e lembrete de bag para o motoboy.
  - **Suporte 80mm e 58mm:** Compatível com 1 ou 2 vias (Cozinha e Cliente/Entrega) com corte de bobina e impressão automática.
- **🔊 Sinal Sonoro de Novo Pedido:** Emite aviso sonoro (chime sintetizado via Web Audio API) para alertar a equipe quando um novo pedido chegar.
- **⚙️ Configuração de Impressora Térmica & Prévia Ao Vivo:** Na aba "Configurações & Acesso", personalize a largura da bobina (80mm ou 58mm), largura imprimível (76mm recomendada, 75mm, 72mm, 70mm, 50mm), margem lateral de segurança (2mm recomendada, 3mm, 4mm, 6mm), quantidade de vias (1 ou 2), tipografia (Consolas/Arial), tamanho de letra, intensidade de negrito, espaçamento entre linhas, ligar/desligar auto-print, ligar/desligar alarme sonoro, definir o tempo limite de preparo para o alerta de atraso e botão para teste de impressão imediato com prévia dinâmica ao vivo em tempo real.
- **🕒 Horários de Funcionamento por Dia da Semana:** Na aba "Configurações & Acesso", defina individualmente para cada dia da semana (Domingo a Sábado) se a loja abre ou fecha, além do horário exato de abertura e fechamento. Inclui botões de atalho: "Abrir Todos", "Fechar Todos" e "Replicar Segunda p/ Todos".
- **📅 Gestão de Pedidos Agendados:** Pedidos agendados recebem um selo roxo exclusivo com a data e horário (`📅 Agendado: DD/MM às HH:mm`), filtro dedicado no painel (`📅 Agendados`), cálculo de atraso inteligente (apenas após o horário agendado) e impressão destacada na comanda térmica.
- **💬 Notificações de Status via WhatsApp para o Cliente (Pós-Venda Inteligente):**
  - **Envio Silencioso em 2º Plano (Sem Abrir Abas):** Conectado ao robô local [`Servico_WhatsApp_Silencioso.bat`](file:///C:/Users/Laura%20Barbosa/.gemini/antigravity/scratch/delivery-salgados-bkp-20261016-1127-11/Servico_WhatsApp_Silencioso.bat), as mensagens são despachadas instantaneamente em segundo plano sem abrir nenhuma nova janela ou aba no navegador da loja.
  - **Executável e Atalhos Disponíveis no Painel:** O próprio painel [`admin.html`](file:///C:/Users/Laura%20Barbosa/.gemini/antigravity/scratch/delivery-salgados-bkp-20261016-1127-11/admin.html) disponibiliza botões para **Executar / Abrir o .BAT**, baixar o script inicializador, baixar o script Python e criar o atalho direto na Área de Trabalho do Windows.
  - **Disparo Rápido em 1 Clique:** No card de cada pedido do Kanban ou dentro do modal de detalhes, botões inteligentes disparam mensagens contextualizadas para o WhatsApp do cliente.
  - **Disparo Automático ao Avançar Status:** Opção configurável no painel administrativo para enviar a mensagem de notificação automaticamente no exato momento em que o status do pedido é alterado (ex: ao mover para "Em Preparo", "Pronto / Saiu p/ Entrega", etc.).
  - **Etapas Contempladas:**
    - 🟡 **Confirmado:** Notifica o cliente do recebimento com resumo dos itens, total a pagar e previsão.
    - 👨‍🍳 **Na Cozinha:** Avisa que os salgados estão na fritadeira/forno sendo preparados quentinhos.
    - 🛵 **Saiu para Entrega (ou 🏪 Pronto no Balcão):** Envia o endereço de entrega, forma de pagamento, cálculo de troco e pede atenção à campainha/interfone.
    - ❤️ **Agradecimento / Concluído:** Mensagem carinhosa de fidelização e convite para avaliação.
    - ❌ **Cancelado:** Notificação transparente com orientações de suporte.
  - **Alerta Toast Interativo:** Ao avançar o status de qualquer pedido ("Iniciar Preparo", "Marcar Pronto", etc.), o painel exibe um toast com botão instantâneo `[💬 Avisar no WhatsApp]`.
  - **Rastreamento Visual no Kanban:** Cada pedido exibe uma etiqueta verde `💬 Avisado (HH:mm)` indicando a última notificação enviada, evitando mensagens duplicadas pela equipe.
  - **Modal de Prévia & Edição:** Permite ao lojista personalizar a mensagem antes do envio (ex: adicionar nome do motoboy ou observação) e copiar com 1 clique.
- **Sabores:** Cadastrar novos sabores, alterar valores de adicionais a cada 10 unidades, definir limites por kit, pausar/reativar sabores esgotados e excluir.
- **Kits:** Alterar preços, quantidades, **definir passo de montagem (5 em 5 ou 10 em 10)**, pausar kits ou criar novos.
- **Combos Promocionais:** Montar combos combinando qualquer item do cardápio (kits, bebidas, molhos), com sugestão automática de preço por porcentagem (5%, 10%, 15%, 20%, 25%, 30%), simulador em tempo real da economia para o cliente e comparativo (De R$ XX por R$ YY).
- **Molhos:** Cadastrar novos molhos, atualizar valores e pausar itens.
- **Categorias & Itens:** Criar novas categorias customizadas (ex: **Bebidas**, **Sobremesas**, etc.) com ícones representativos, e cadastrar produtos avulsos com preços, descrições e status ativo/esgotado.
- **Configurações:** Atualizar horários de funcionamento por dia da semana, WhatsApp de pedidos, endereço de retirada, impressora e senha.

---

## 📅 Agendamento de Pedidos no Checkout do Cliente
- **Imediato ou Agendado:** Ao abrir a gaveta de finalização do pedido, o cliente escolhe entre:
  - **⚡ Pedir para Agora (Preparo Imediato)**
  - **📅 Agendar Pedido (Data e Horário Futuro)**
- **Validação Inteligente por Dia da Semana:**
  - O cliente seleciona a data desejada (bloqueando datas passadas).
  - O sistema consulta automaticamente a grade de horários configurada no admin para aquele dia da semana.
  - Se a loja estiver fechada naquele dia, exibe um alerta explicativo e impede a seleção incorreta.
  - Se a loja estiver aberta, informa a faixa de horário permitida (ex: `Atendimento das 16:00 às 22:30`) e valida o horário informado.
- **Envio no WhatsApp e Painel:** O agendamento é destacado em negrito na mensagem enviada ao WhatsApp e no painel ao vivo da cozinha.

---

## 🔥 Combos Promocionais com Desconto Real
- **Visualização de Economia no Cardápio:** Cada combo exibe de forma destacada o preço dos itens comprados separadamente (`De: R$ XX,XX`), o preço exclusivo no combo (`Por: R$ YY,YY`) e a **Economia Real** do cliente (`Você economiza R$ ZZ,ZZ | XX% OFF`).
- **Personalização de Sabores no Combo:** Se o combo contiver um kit de salgados, ao clicar em "Pedir Combo" o cliente escolhe normalmente os sabores dos salgadinhos mantendo o valor promocional do combo.
- **Resumo no Carrinho e WhatsApp:** O pedido exibe a economia garantida e a mensagem do WhatsApp lista todos os itens inclusos e sabores escolhidos.

---

## 🥤 Categorias & Itens Avulsos (Bebidas, Sobremesas, etc.)
- O cardápio digital do cliente [`index.html`](file:///C:/Users/Laura%20Barbosa/.gemini/antigravity/scratch/delivery-salgados-bkp-20261016-1127-11/index.html) exibe uma **Barra de Navegação rápida com abas/pills** para fácil acesso a cada categoria.
- O cliente pode adicionar itens avulsos diretamente ao carrinho com botões interativos de quantidade (`+` e `-`).
- Os itens avulsos são calculados no pedido e formatados automaticamente na mensagem enviada ao WhatsApp da loja.

---

## 🚀 Como testar localmente
- **Cardápio do Cliente:** Abra [`index.html`](file:///C:/Users/Laura%20Barbosa/.gemini/antigravity/scratch/delivery-salgados-bkp-20261016-1127-11/index.html) no navegador para montar kits, combos ou bebidas e enviar pedidos (imediatos ou agendados).
- **Painel Administrativo:** Abra [`admin.html`](file:///C:/Users/Laura%20Barbosa/.gemini/antigravity/scratch/delivery-salgados-bkp-20261016-1127-11/admin.html) (usuário: `admin`, senha: `vip123`).
- **Teste de Horários Semanais:**
  1. No painel administrativo, vá para a aba **Configurações & Acesso**.
  2. Ajuste os horários da semana (por exemplo, feche às Segundas-feiras ou altere horários de Sexta e Sábado).
  3. Clique em **"Salvar Informações & Horários da Loja"**.
  4. Abra o cardápio [`index.html`](file:///C:/Users/Laura%20Barbosa/.gemini/antigravity/scratch/delivery-salgados-bkp-20261016-1127-11/index.html) e confira o badge de funcionamento atualizado automaticamente!
- **Teste de Agendamento:**
  1. No cardápio [`index.html`](file:///C:/Users/Laura%20Barbosa/.gemini/antigravity/scratch/delivery-salgados-bkp-20261016-1127-11/index.html), adicione um produto ao carrinho e clique em **"Finalizar Pedido"**.
  2. Selecione a opção **"📅 Agendar Pedido"**, escolha uma data e horário válidos.
  3. Finalize e veja o pedido entrar no painel administrativo [`admin.html`](file:///C:/Users/Laura%20Barbosa/.gemini/antigravity/scratch/delivery-salgados-bkp-20261016-1127-11/admin.html) com o selo lilás de **Agendado**!
- **Teste de Taxa de Entrega por Distância:**
  1. No cardápio [`index.html`](file:///C:/Users/Laura%20Barbosa/.gemini/antigravity/scratch/delivery-salgados-bkp-20261016-1127-11/index.html), ao selecionar **"🛵 Entrega a Domicílio"**, escolha um bairro (ex: *Centro de Nova Iguaçu*, *Jardim Tropical*, *Austin*).
  2. Veja o valor da taxa de entrega e o total atualizarem instantaneamente no resumo do pedido!
  3. No painel administrativo [`admin.html`](file:///C:/Users/Laura%20Barbosa/.gemini/antigravity/scratch/delivery-salgados-bkp-20261016-1127-11/admin.html), vá para a aba **🛵 Taxa & Distâncias** para alterar faixas de km, valores, testar no simulador e salvar!

---

## 🛵 Controle de Entrega, Mapa Dinâmico & Digitação de Endereço

### 📍 Ponto de Origem e Raio de Atendimento
- **Endereço Base da Loja:** `Rua Isabel Pedrosa, 31, Da Luz, Nova Iguaçu - RJ`
- **Raio Máximo de Atendimento:** 15.0 km
- Distâncias acima de 15 km são bloqueadas com aviso informativo para o cliente, prevenindo pedidos fora do raio de entrega.

### 📱 Experiência de Checkout do Cliente (`index.html`)
- Ao optar por **"🛵 Entrega a Domicílio"**, o cliente preenche o endereço com máxima precisão e praticidade:
  - **📮 CEP (Preenchimento Automático na Web):** Ao digitar o CEP de 8 dígitos (ex: `26010-391`), o sistema consulta o ViaCEP, preenche automaticamente Rua, Bairro e Município, e **calcula a distância real de condução/tráfego a partir da loja**, aplicando a faixa correta de entrega (ex: no CEP `26010-391`, calcula os ~6.4 km reais de rota, aplicando a faixa de R$ 14,00).
  - **1. Endereço (Rua / Logradouro)** (preenchido via CEP ou manual)
  - **2. Número** (preenchimento manual - o cursor foca automaticamente aqui)
  - **3. Bairro** (preenchido via CEP ou manual)
  - **4. Município** (preenchido via CEP)
  - **5. Complemento / Referência** (preenchimento manual: Apto, bloco, etc.)
- O card de status de entrega exibe em tempo real o endereço, a **distância real da rota calculada (em km)** e o valor correspondente da faixa.
- O rodapé do carrinho atualiza imediatamente: **Subtotal dos Itens**, **Taxa de Entrega (com indicação do Bairro e km)** e **Total Final**.
- Para **"🏪 Retirada no Local"**, a taxa é automaticamente zerada (`R$ 0,00`).
- Ao enviar o pedido pelo WhatsApp, a mensagem contém o endereço formatado completo com CEP e distância real:
  `*Endereço:* Rua Dona Clara de Araújo, Nº 145 - Engenho Pequeno, Nova Iguaçu • CEP: 26010-391`
  `🛵 *Taxa de Entrega (~6.4 km):* R$ 14,00`

### 🗺️ Módulo Administrativo: "Controle de Entrega por Distância & Mapa" (`admin.html`)
- **Gestão 100% por Distância (Zero Trabalho Manual de Cadastrar Bairros):**
  - O administrador define apenas as **Faixas de Distância / Raio (1 a 15 km)** e o valor cobrado em cada faixa (ex: até 2 km = R$ 5,00; 2 a 4 km = R$ 8,00; 6 a 8 km = R$ 14,00; etc.).
  - Qualquer alteração de valor na faixa atualiza automaticamente a cobrança de todos os endereços correspondentes em tempo real!
- **Motor de Cálculo por Rota Real & Integração Google Maps:**
  - **Motor Automático Web Gratuito (OSRM / OpenStreetMap):** Ativo por padrão e sem custos. Calcula a rota de tráfego real entre a loja (`Rua Isabel Pedrosa, 31, Da Luz`) e o endereço de destino (ou CEP).
  - **Google Maps Distance Matrix API (Opcional):** Campo dedicado no painel adm para inserir chave de API oficial do Google Maps, caso a loja prefira utilizar diretamente o serviço pago da Google.
  - **Simulador de Teste Rápido:** No próprio painel, o administrador pode digitar qualquer CEP (ex: `26010-391`) ou endereço e ver imediatamente a distância real em km, a faixa aplicada e a taxa cobrada.
- **Mapa Dinâmico Leaflet / OpenStreetMap:**
  - Marcador da loja Salgados VIP (`Rua Isabel Pedrosa, 31, Da Luz, Nova Iguaçu`).
  - Anéis concêntricos de raio coloridos de 1 até 15 km com tooltips explicativos de distância e taxa.
  - **Medição ao Clicar:** Clique em qualquer ponto do mapa para traçar uma rota em linha reta até a loja, medir a distância exata em km e simular instantaneamente a taxa que será cobrada.
  - Ferramentas no topo do mapa para centralizar a loja e alternar a visualização dos anéis de raio.
- **Tabela de Faixas de Distância / Raio (Km):**
  - Cadastre e edite facilmente as faixas de quilometragem, valores em R$, previsão de tempo e rótulos/exemplos de regiões atendidas.
- **Ponto de Origem da Loja & Raio Máximo:**
  - Configuração do endereço de partida e limite máximo de atendimento (até 15 km). Distâncias além do limite são automaticamente barradas com mensagem orientando o cliente.

---

## ☁️ Banco de Dados em Nuvem & Tempo Real (Supabase Free)

O sistema conta com integração nativa ao **Supabase (PostgreSQL 17)** configurado no plano gratuito, com persistência na nuvem e transmissão de pedidos em tempo real via **WebSockets**.

### ⚡ Vantagens da Integração:
1. **Multi-Dispositivos em Tempo Real:**
   - O cliente faz o pedido no celular pelo cardápio digital.
   - O painel administrativo da cozinha/loja (aberto no computador ou tablet) recebe o pedido **imediatamente sem precisar recarregar a página**.
   - Dispara o **aviso sonoro** e a **impressão térmica automática** de imediato.
2. **Resiliência Offline-First (Modo Híbrido):**
   - Todos os dados continuam salvos no `localStorage` local como cache ultra-rápido.
   - Se faltar internet momentaneamente, o sistema não trava e sincroniza automaticamente assim que a conexão retornar.
3. **Segurança & Políticas Row Level Security (RLS):**
   - Tabelas criadas com RLS habilitado e políticas públicas para leitura do cardápio e gravação de pedidos.
4. **Tabelas Criadas no Supabase:**
   - `orders`: Pedidos em tempo real (com Realtime habilitado).
   - `kits`: Kits de salgados configurados.
   - `flavors`: Sabores, adicionais de nobres e limites por kit.
   - `sauces`: Molhos e valores.
   - `categories`: Categorias de produtos (Bebidas, Sobremesas, etc.).
   - `products`: Produtos avulsos vinculados às categorias.
   - `combos`: Combos promocionais montados.
   - `store_settings`: Configurações da loja, horários por dia da semana, regras de entrega e impressora.
5. **Diagnóstico & Gestão no Painel (`admin.html`):**
   - Na aba **Configurações & Acesso**, há um painel exclusivo do Supabase com indicador de status (`🟢 Conectado e Ativo`), botão para **Testar Conexão** e botão para **Sincronizar Tudo Manualmente**.




---

---

## 🌐 Central WhatsApp em Nuvem Multi-Dispositivos (100% Silencioso & Autônomo)

O sistema conta com um **Gateway em Nuvem Exclusivo (Evolution API / Z-API / Baileys Cloud)** que permite conectar o WhatsApp da loja diretamente pelo aplicativo via QR Code na tela, operando **100% autônomo e silencioso em qualquer computador, notebook, tablet ou celular (Netlify, PC de casa ou loja), sem depender de nenhuma máquina Windows ligada localmente**.

### 🌟 Principais Recursos:
1. **Zero Dependência Local (Independência Total de Máquinas Específicas):**
   - Ao invés de depender de um computador Windows físico ligado rodando Selenium ou Python, a sessão do WhatsApp é hospedada 24/7 em um servidor na nuvem (Railway, Render, VPS ou SaaS).
   - O painel administrativo ([`admin.html`](file:///C:/Users/Laura%20Barbosa/.gemini/antigravity/scratch/delivery-salgados-bkp-20261016-1127-11/admin.html)) se comunica diretamente com a API na nuvem via `fetch()`, permitindo envios instantâneos em segundo plano de qualquer navegador ou hospedagem (Netlify, Vercel, localhost).
2. **Sincronização Universal na Nuvem (Supabase):**
   - As credenciais da API e o status de conexão da sessão são persistidos na tabela `store_settings` do Supabase (`id: "whatsapp_cloud_gateway"`).
   - Quando o administrador conecta o WhatsApp uma única vez em qualquer aparelho, **todos os outros computadores e celulares acessando o painel reconhecem a conexão instantaneamente** e já podem enviar mensagens silenciosas na hora!
3. **Pareamento Direto via QR Code no App:**
   - Na aba **Configurações & Acesso**, basta clicar em **"Gerar QR Code & Conectar"**.
   - O sistema gera a imagem do QR Code em tempo real e inicia o monitoramento dinâmico.
   - Assim que o operador escaneia o código com o celular da loja (Salgados VIP), o painel reconhece a autenticação automaticamente e transita para o status verde **"Conectado na Nuvem"**, exibindo o número verificado (ex: `+55 (21) 98675-8102`).
4. **Envio 100% Silencioso (Zero Janelas / Sem Abas do WhatsApp Web):**
   - Notificações automáticas ao avançar status no Kanban.
   - Disparo rápido com 1 clique nos cards de pedidos e no modal de detalhes.
   - Despacho de entregas para o motoboy com taxa e rota.
   - Fechamento de caixa e envio de extratos financeiros diários para os entregadores.
   - CRM e campanhas de fidelização com cupons promocionais para clientes.
5. **Suporte Multi-Provedores Integrado:**
   - **Evolution API (v1 e v2 - Recomendado):** Código aberto, gratuito para hospedar no Railway/Render em 3 minutos, com endpoints `/instance/connect`, `/instance/connectionState` e `/message/sendText`.
   - **Z-API:** Plataforma nacional com integração por URL de instância e token.
   - **Modo Demonstração / Teste Imediato:** Permite demonstrar o fluxo completo de QR Code e disparos silenciosos mesmo sem configurar uma chave externa previamente.
6. **Contingência e Fallback Seguro:**
   - Se o gateway em nuvem estiver desconectado, o sistema recorre de forma transparente ao link tradicional (`wa.me`) para garantir que o cliente ou motoboy nunca fiquem sem a mensagem.



---

## 📋 Quadro Kanban de Pedidos Ao Vivo (Em Tela Única)

O painel de **Pedidos Ao Vivo** ([`admin.html`](file:///C:/Users/Laura%20Barbosa/.gemini/antigravity/scratch/delivery-salgados-bkp-20261016-1127-11/admin.html)) conta com uma experiência visual limpa, fluida e intuitiva em formato de **Quadro Kanban de 4 Colunas**, reunidas em uma única tela:

### 🎯 4 Etapas Bem Definidas:
1. **Recebidos (Aguardando Início):** Novos pedidos que chegam à loja ficam imediatamente no topo desta coluna em destaque âmbar/amarelo. Botão de ação: `[▶ Iniciar Preparo]`.
2. **Em Preparo (Na Fritadeira / Forno):** Pedidos que estão sendo preparados na cozinha em destaque azul. Botão de ação: `[✓ Marcar Pronto]`.
3. **Prontos p/ Despachar (Balcão ou Motoboy):** Pedidos finalizados aguardando saída em destaque esmeralda/verde. Botão de ação contextual:
   - Se entrega em domicílio: `[🛵 Despachar Pedido]`
   - Se retirada no balcão: `[🏪 Entregar no Balcão]`
4. **Despachados (Entregues Hoje):** Pedidos concluídos do dia com badge `✓ Concluído` e botão de segurança `[↺ Desfazer]` para retornar o pedido à etapa anterior caso o operador tenha clicado por engano.

### 🚀 Progressão Automática e Arrastar e Soltar (Drag & Drop):
- Ao clicar no botão de promoção no card, o pedido é **movido automaticamente para a próxima coluna instantaneamente**, sem recarregar a página e mantendo as métricas atualizadas.
- Também possui suporte completo a **arrastar e soltar (Drag and Drop)** com mouse entre as colunas, com feedback visual iluminado (`drag-over`).

### 📅 Filtro por Data (Apenas Pedidos do Dia por Padrão):
- **Visualização Padrão ("Pedidos de Hoje"):** Por padrão, o painel exibe estritamente os pedidos do dia atual (`pedidos do dia`), mantendo a tela focada na operação de hoje.
- **Botão Alternador ("Ver Todos os Dias"):** Permite consultar pedidos históricos a qualquer momento com apenas 1 clique.
- **Filtro Rápido de Atrasados:** Pílula dedicada com indicador de alerta visual pulsante para isolar apenas pedidos com tempo estourado.
- **Busca em Tempo Real:** Campo de busca rápida por nome de cliente, número do pedido, telefone ou endereço integrado na barra superior.

---

## 🔀 Sistema Universal de Reordenação (Drag & Drop e Botões ▲/▼)

O painel administrativo ([`admin.html`](file:///C:/Users/Laura%20Barbosa/.gemini/antigravity/scratch/delivery-salgados-bkp-20261016-1127-11/admin.html)) oferece uma forma **fácil, simples e rápida** de personalizar e definir a ordem exata de exibição de todos os itens do cardápio:

### 🌟 Catálogos Suportados:
1. **Sabores dos Salgados:** 26+ sabores reordenáveis. A ordem definida aqui é a mesma exibida na montagem do kit pelo cliente.
2. **Kits de Salgados:** Tamanhos de kits (10, 20, 30, 40, 50, 70, 80, 100). A ordem no admin reflete diretamente no catálogo da loja.
3. **Combos Promocionais:** Ordenação dos combos em destaque.
4. **Molhos Especiais:** Reordenação dos molhos sugeridos ao final da montagem do kit.
5. **Categorias do Cardápio:** Ordem das abas de categorias no cardápio do cliente.
6. **Produtos & Itens Avulsos:** Ordenação dos refrigerantes, bebidas e sobremesas avulsas.

### 🎯 Recursos da Reordenação:
- **Arrastar e Soltar Nativo (HTML5 Drag & Drop):**
  - Alça com ícone de pegada vertical (`⋮⋮`) e cursor tátil (`grab`/`grabbing`).
  - Feedback visual dinâmico com linha indicadora de inserção âmbar no topo ou na base da linha (`drag-over-above` / `drag-over-below`).
  - Linha ativa semi-transparente com moldura pontilhada enquanto é arrastada.
- **Botões Rápidos de 1 Clique (▲ / ▼):**
  - Setas compactas em cada linha para subir ou descer 1 posição com um único clique.
  - Ideal para ajustes rápidos ou para uso em dispositivos com tela de toque/mobile sem necessidade de arrastar.
  - Desativação automática da seta superior no primeiro item e da seta inferior no último item.
- **Identificação Visual Numérica (#1, #2, #3...):**
  - Badge numérico estilizado exibindo a posição real de cada item na lista em tempo real.
- **Salvamento Automático e Instantâneo:**
  - Não requer botão "Salvar": ao soltar o item ou clicar em uma seta, a nova sequência é gravada instantaneamente no `localStorage` e sincronizada com a nuvem (Supabase `store_settings -> catalog_order`).
  - Feedback via notificação Toast elegante no canto superior direito: `✓ Sabor "Nome" movido para a posição #X!`.
- **Reflexo Imediato no Cardápio do Cliente (`index.html`):**
  - O catálogo público do delivery respeita rigorosamente a ordenação personalizada sem requisições adicionais.

---

## 📱 Progressive Web App (PWA) - Aplicativo Instalável no Celular e PC

O Salgados VIP agora é um **Progressive Web App (PWA) completo**, permitindo que clientes e equipe da loja instalem o delivery diretamente na tela inicial de qualquer smartphone (**Android e iOS / iPhone**), tablet ou computador, funcionando com visual e experiência de aplicativo nativo sem precisar de App Store ou Google Play.

### 🌟 Recursos do PWA:
1. **Ícones em Alta Definição (192px e 512px Maskable):**
   - Ícone personalizado da marca Salgados VIP com squircle moderno, salgado dourado central, coroa VIP e insígnia avermelhada.
   - Suporte a ícones adaptativos (*maskable icons*) que se ajustam automaticamente ao formato de ícones de qualquer aparelho (redondo, quadrado com cantos arredondados, etc.).
   - Suporte nativo a `apple-touch-icon` para iPhones e iPads.
2. **Experiência de Aplicativo Nativo (Standalone Full-Screen):**
   - Abre em tela cheia sem a barra de endereços do navegador (`display: standalone`).
   - Cor do tema integrada na barra de status do celular (`theme-color: #d97706`).
   - Carregamento ultrarrápido instantâneo.
3. **Banner Inteligente de Instalação (`pwa.js` & `pwa.css`):**
   - **No Celular/PC:** Exibe um banner flutuante moderno: `📱 Instale o App Salgados VIP [Instalar Grátis]`.
   - **No iPhone (iOS Safari):** Detecta aparelhos Apple e exibe um guia visual em 2 passos:
     1. Toque em Compartilhar (`⬆`);
     2. Selecione *"Adicionar à Tela de Início"*.
   - **Botão Fixo no Topo:** Botão discreto `[Instalar App]` presente no header do cardápio e no topo do painel administrativo.
4. **Service Worker com Cache Inteligente (`sw.js`):**
   - Pré-carrega arquivos essenciais para navegação instantânea.
   - **Resiliência Offline:** Se a conexão móvel do cliente oscilar ou cair, o cardápio continua carregando perfeitamente a partir do cache local.
   - **Bypass Automático:** Chamadas de banco em tempo real (Supabase), fila do robô de WhatsApp e spooler local nunca são cacheados, garantindo 100% de sincronismo dos pedidos e mensagens.
5. **Atalhos Rápidos na Tela Inicial (App Shortcuts):**
   - Ao segurar o ícone do aplicativo na tela inicial do celular, são exibidos atalhos rápidos:
     - 🥟 **Cardápio Delivery** (acesso direto dos clientes)
     - 🍳 **Painel da Loja / Cozinha** (acesso rápido da equipe ao Kanban)

---

## 🚀 Publicação & Hospedagem Gratuita no GitHub (GitHub Pages)

O projeto é **100% estático no frontend** com comunicação direta na nuvem via **Supabase** e **WhatsApp Cloud Gateway**. Por esse motivo, você pode hospedá-lo e rodá-lo diretamente a partir do **GitHub** com custo zero na conta gratuita!

### 💡 Regra Importante da Conta Free do GitHub:
- No plano **GitHub Free**, a hospedagem nativa do **GitHub Pages** está disponível para repositórios **Públicos** (`Public`).
- **Se você deseja manter o repositório Privado (`Private`):**
  - Você pode criar o repositório privado no GitHub e conectar ao **Netlify** ou **Vercel** gratuitamente com 1 clique (eles oferecem hospedagem gratuita de repositórios privados com SSL e domínio próprio).
- **Se o repositório for Público (`Public`):**
  - O **GitHub Pages** roda diretamente no endereço: `https://<seu-usuario>.github.io/<nome-do-repositorio>/`.

### 🛠️ Passo a Passo para Publicar:

#### Método Automático (1 Clique no Windows):
1. Dê dois cliques no arquivo [`Subir_Para_GitHub.bat`](file:///C:/Users/Laura%20Barbosa/.gemini/antigravity/scratch/delivery-salgados-bkp-20261016-1127-11/Subir_Para_GitHub.bat).
2. Cole a URL do seu repositório no GitHub (ex: `https://github.com/SEU_USUARIO/salgados-vip.git`).
3. Confirme o envio. Todos os arquivos serão enviados para o branch `main`.

#### Método Manual via Terminal:
```bash
git init
git branch -M main
git add .
git commit -m "Deploy Salgados VIP Delivery & PWA"
git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPOSITORIO.git
git push -u origin main
```

#### Ativando o Site no GitHub Pages:
1. No seu navegador, abra o repositório no **GitHub**.
2. Clique na aba **Settings** (Configurações) no topo.
3. No menu lateral esquerdo, clique em **Pages**.
4. Em **Build and deployment > Source**, selecione: `Deploy from a branch`.
5. Em **Branch**, selecione `main` e pasta `/ (root)`.
6. Clique no botão **Save**.
7. Aguarde cerca de 1 minuto. O GitHub exibirá o link oficial no topo:
   `Your site is live at https://<seu-usuario>.github.io/<nome-do-repositorio>/`

### 📱 Links Gerados no GitHub Pages:
- **Cardápio do Cliente:** `https://<seu-usuario>.github.io/<nome-do-repositorio>/` (ou `/index.html`)
- **Painel da Cozinha / Admin:** `https://<seu-usuario>.github.io/<nome-do-repositorio>/admin.html`

