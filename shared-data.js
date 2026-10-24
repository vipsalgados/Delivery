/**
 * ==============================================================================
 * SALGADOS VIP - BANCO DE DADOS & GERENCIADOR DE ESTADO (LOCALSTORAGE)
 * Compartilhado entre o Cardápio do Cliente e o Painel Administrativo
 * ==============================================================================
 */

const STORAGE_KEYS = {
  CONFIG: "salgados_vip_config",
  KITS: "salgados_vip_kits",
  FLAVORS: "salgados_vip_flavors",
  SAUCES: "salgados_vip_sauces",
  CATEGORIES: "salgados_vip_categories",
  PRODUCTS: "salgados_vip_products",
  COMBOS: "salgados_vip_combos",
  ORDERS: "salgados_vip_orders",
  PRINTER: "salgados_vip_printer",
  AUTH: "salgados_vip_auth",
  DELIVERY: "salgados_vip_delivery",
  CUSTOMER_PROFILE: "salgados_vip_customer_profile",
  CUSTOMER_LAST_ORDER: "salgados_vip_customer_last_order",
  CATALOG_ORDER: "salgados_vip_catalog_order",
  CASH_CLOSINGS: "salgados_vip_cash_closings",
  MOTOBOYS: "salgados_vip_motoboys",
  CUSTOMERS_CRM: "salgados_vip_customers_crm"
};

// Ordenador universal com base na sequência de IDs customizada pelo administrador
function applyCatalogOrder(list, orderIds) {
  if (!Array.isArray(list) || !Array.isArray(orderIds) || orderIds.length === 0) return list;
  const orderMap = new Map();
  orderIds.forEach((id, idx) => orderMap.set(id, idx));
  return [...list].sort((a, b) => {
    const idxA = orderMap.has(a.id) ? orderMap.get(a.id) : 99999;
    const idxB = orderMap.has(b.id) ? orderMap.get(b.id) : 99999;
    return idxA - idxB;
  });
}

// HORÁRIOS DE FUNCIONAMENTO POR DIA DA SEMANA (0 = Domingo, 1 = Segunda, ..., 6 = Sábado)
const DEFAULT_WEEKLY_SCHEDULE = [
  { day: 0, dayName: "Domingo", open: true, openTime: "16:00", closeTime: "22:30" },
  { day: 1, dayName: "Segunda-feira", open: true, openTime: "16:00", closeTime: "22:30" },
  { day: 2, dayName: "Terça-feira", open: true, openTime: "16:00", closeTime: "22:30" },
  { day: 3, dayName: "Quarta-feira", open: true, openTime: "16:00", closeTime: "22:30" },
  { day: 4, dayName: "Quinta-feira", open: true, openTime: "16:00", closeTime: "22:30" },
  { day: 5, dayName: "Sexta-feira", open: true, openTime: "16:00", closeTime: "22:30" },
  { day: 6, dayName: "Sábado", open: true, openTime: "16:00", closeTime: "22:30" }
];

// FAIXAS DE TAXA DE ENTREGA POR DISTÂNCIA (1 ATÉ 15 KM A PARTIR DA RUA ISABEL PEDROSA, DA LUZ - NOVA IGUAÇU)
const DEFAULT_DELIVERY_TIERS = [
  { id: "tier-1", maxKm: 2.0, price: 5.00, label: "Até 2.0 km (Da Luz, Centro, Moquetá)", eta: "15-25 min" },
  { id: "tier-2", maxKm: 4.0, price: 8.00, label: "De 2.1 a 4.0 km (Rancho Novo, Caonze, Califórnia)", eta: "20-30 min" },
  { id: "tier-3", maxKm: 6.0, price: 11.00, label: "De 4.1 a 6.0 km (Posse, Comendador Soares, Cerâmica)", eta: "25-35 min" },
  { id: "tier-4", maxKm: 8.0, price: 14.00, label: "De 6.1 a 8.0 km (Austin, Nova América, Kennedy)", eta: "30-40 min" },
  { id: "tier-5", maxKm: 10.0, price: 17.00, label: "De 8.1 a 10.0 km (Miguel Couto, Ambaí)", eta: "35-45 min" },
  { id: "tier-6", maxKm: 12.0, price: 21.00, label: "De 10.1 a 12.0 km (Vila de Cava, Cabuçu)", eta: "40-50 min" },
  { id: "tier-7", maxKm: 15.0, price: 26.00, label: "De 12.1 a 15.0 km (Valverde, Tinguá - Raio Máximo)", eta: "45-60 min" }
];

const DEFAULT_NEIGHBORHOODS = [
  { id: "bairro-da-luz", name: "Da Luz", city: "Nova Iguaçu", km: 0.5, fee: 5.00, eta: "15-25 min", active: true, lat: -22.75735, lng: -43.47254 },
  { id: "bairro-centro", name: "Centro", city: "Nova Iguaçu", km: 2.5, fee: 8.00, eta: "20-30 min", active: true, lat: -22.7565, lng: -43.4560 },
  { id: "bairro-santa-eugenia", name: "Santa Eugênia", city: "Nova Iguaçu", km: 2.2, fee: 8.00, eta: "20-30 min", active: true, lat: -22.7480, lng: -43.4590 },
  { id: "bairro-moqueta", name: "Moquetá", city: "Nova Iguaçu", km: 2.8, fee: 8.00, eta: "20-30 min", active: true, lat: -22.7630, lng: -43.4480 },
  { id: "bairro-rancho-novo", name: "Rancho Novo", city: "Nova Iguaçu", km: 3.5, fee: 8.00, eta: "25-35 min", active: true, lat: -22.7620, lng: -43.4350 },
  { id: "bairro-caonze", name: "Caonze", city: "Nova Iguaçu", km: 3.2, fee: 8.00, eta: "25-35 min", active: true, lat: -22.7670, lng: -43.4520 },
  { id: "bairro-california", name: "Califórnia", city: "Nova Iguaçu", km: 4.0, fee: 8.00, eta: "25-35 min", active: true, lat: -22.7420, lng: -43.4400 },
  { id: "bairro-prata", name: "Prata", city: "Nova Iguaçu", km: 4.5, fee: 11.00, eta: "25-35 min", active: true, lat: -22.7720, lng: -43.4380 },
  { id: "bairro-engenho-pequeno", name: "Engenho Pequeno", city: "Nova Iguaçu", km: 6.4, fee: 14.00, eta: "25-35 min", active: true, lat: -22.7531, lng: -43.4235 },
  { id: "bairro-posse", name: "Posse", city: "Nova Iguaçu", km: 5.5, fee: 11.00, eta: "25-35 min", active: true, lat: -22.7300, lng: -43.4250 },
  { id: "bairro-vila-nova", name: "Vila Nova", city: "Nova Iguaçu", km: 5.2, fee: 11.00, eta: "25-35 min", active: true, lat: -22.7400, lng: -43.4200 },
  { id: "bairro-comendador-soares", name: "Comendador Soares", city: "Nova Iguaçu", km: 4.8, fee: 11.00, eta: "30-40 min", active: true, lat: -22.7480, lng: -43.4850 },
  { id: "bairro-ceramica", name: "Cerâmica", city: "Nova Iguaçu", km: 5.8, fee: 11.00, eta: "30-40 min", active: true, lat: -22.7250, lng: -43.4400 },
  { id: "bairro-bandeirantes", name: "Bandeirantes", city: "Nova Iguaçu", km: 5.8, fee: 11.00, eta: "25-35 min", active: true, lat: -22.7410, lng: -43.4310 },
  { id: "bairro-nova-america", name: "Nova América", city: "Nova Iguaçu", km: 6.5, fee: 14.00, eta: "30-40 min", active: true, lat: -22.7650, lng: -43.4150 },
  { id: "bairro-jardim-tropical", name: "Jardim Tropical", city: "Nova Iguaçu", km: 5.8, fee: 11.00, eta: "35-45 min", active: true, lat: -22.7350, lng: -43.4750 },
  { id: "bairro-iguacu-velho", name: "Iguaçu Velho", city: "Nova Iguaçu", km: 6.8, fee: 14.00, eta: "35-45 min", active: true, lat: -22.7750, lng: -43.4050 },
  { id: "bairro-kennedy", name: "Pres. Kennedy", city: "Nova Iguaçu", km: 6.8, fee: 14.00, eta: "30-40 min", active: true, lat: -22.7680, lng: -43.4110 },
  { id: "bairro-ambai", name: "Ambaí", city: "Nova Iguaçu", km: 8.5, fee: 17.00, eta: "35-45 min", active: true, lat: -22.7150, lng: -43.4100 },
  { id: "bairro-carmary", name: "Carmary", city: "Nova Iguaçu", km: 7.2, fee: 14.00, eta: "30-40 min", active: true, lat: -22.7210, lng: -43.4450 },
  { id: "bairro-viga", name: "Viga", city: "Nova Iguaçu", km: 5.6, fee: 11.00, eta: "20-30 min", active: true, lat: -22.7415, lng: -43.4445 },
  { id: "bairro-cacuia", name: "Cacuia", city: "Nova Iguaçu", km: 7.2, fee: 14.00, eta: "35-45 min", active: true, lat: -22.7300, lng: -43.4800 },
  { id: "bairro-austin", name: "Austin", city: "Nova Iguaçu", km: 8.8, fee: 17.00, eta: "35-50 min", active: true, lat: -22.7200, lng: -43.5100 },
  { id: "bairro-jardim-alvorada", name: "Jardim Alvorada", city: "Nova Iguaçu", km: 7.5, fee: 14.00, eta: "35-50 min", active: true, lat: -22.7550, lng: -43.5150 },
  { id: "bairro-miguel-couto", name: "Miguel Couto", city: "Nova Iguaçu", km: 10.5, fee: 21.00, eta: "40-55 min", active: true, lat: -22.6850, lng: -43.3950 },
  { id: "bairro-vila-de-cava", name: "Vila de Cava", city: "Nova Iguaçu", km: 11.2, fee: 21.00, eta: "40-55 min", active: true, lat: -22.6950, lng: -43.4450 },
  { id: "bairro-rodilandia", name: "Rodilândia", city: "Nova Iguaçu", km: 8.5, fee: 17.00, eta: "45-60 min", active: true, lat: -22.7350, lng: -43.5350 },
  { id: "bairro-cabucu", name: "Cabuçu", city: "Nova Iguaçu", km: 11.8, fee: 21.00, eta: "50-65 min", active: true, lat: -22.7650, lng: -43.5500 },
  { id: "bairro-valverde", name: "Valverde / Palhada", city: "Nova Iguaçu", km: 8.5, fee: 17.00, eta: "40-55 min", active: true, lat: -22.7750, lng: -43.5350 },
  { id: "bairro-km-32", name: "Km 32", city: "Nova Iguaçu", km: 13.5, fee: 26.00, eta: "50-65 min", active: true, lat: -22.7850, lng: -43.5650 },
  { id: "bairro-tingua", name: "Tinguá (Entrada)", city: "Nova Iguaçu", km: 14.8, fee: 26.00, eta: "50-65 min", active: true, lat: -22.6350, lng: -43.4250 }
];

const DEFAULT_DELIVERY_CONFIG = {
  enabled: true,
  storeOriginAddress: "Rua Isabel Pedrosa, 31, Da Luz, Nova Iguaçu - RJ",
  storeCoords: { lat: -22.75735, lng: -43.47254 },
  maxRadiusKm: 15.0,
  pricingMode: "distance", // Cálculo 100% por distância / raio (1 a 15 km)
  defaultFee: 8.00,
  googleMapsApiKey: "", // Chave de API opcional do Google Maps (Distance Matrix)
  tiers: DEFAULT_DELIVERY_TIERS,
  neighborhoods: DEFAULT_NEIGHBORHOODS
};

// DADOS PADRÃO DE FÁBRICA
const DEFAULT_CONFIG = {
  name: "Salgados VIP - Nova Iguaçu",
  location: "Nova Iguaçu - Rio de Janeiro",
  pickupAddress: "Rua Isabel Pedrosa, 31, Da Luz, Nova Iguaçu - RJ",
  whatsappNumber: "5521986758102",
  pixKey: "5521986758102",
  pixKeyType: "telefone",
  pixReceiverName: "Salgados VIP",
  pixCity: "Nova Iguacu",
  openingHour: 16,
  openingMinute: 0,
  closingHour: 22,
  closingMinute: 30,
  logoUrl: "", // URL ou Base64 da logo da loja
  weeklySchedule: DEFAULT_WEEKLY_SCHEDULE
};

const DEFAULT_AUTH = {
  user: "admin"
  // Senhas são gerenciadas com hash criptográfico SHA-256 no Supabase (tabela admin_auth)
};

// IMAGENS PADRÃO DE DEMONSTRAÇÃO E PLACEHOLDERS
const DEFAULT_IMAGE_PLACEHOLDERS = {
  kit: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=500&auto=format&fit=crop&q=80",
  flavor: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=300&auto=format&fit=crop&q=80",
  product: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80",
  combo: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80",
  sauce: "https://images.unsplash.com/photo-1594041680534-e8c8cdebd659?w=300&auto=format&fit=crop&q=80"
};
if (typeof window !== "undefined") {
  window.DEFAULT_IMAGE_PLACEHOLDERS = DEFAULT_IMAGE_PLACEHOLDERS;
}

const DEFAULT_KITS = [
  { id: "kit-20", name: "Kit 20 Salgadinhos", quantity: 20, price: 25.00, passo_quantidade: 10, active: true, image: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=500&auto=format&fit=crop&q=80" },
  { id: "kit-30", name: "Kit 30 Salgadinhos", quantity: 30, price: 39.90, passo_quantidade: 10, active: true, image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500&auto=format&fit=crop&q=80" },
  { id: "kit-50", name: "Kit 50 Salgadinhos", quantity: 50, price: 64.90, passo_quantidade: 10, active: true, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=80" },
  { id: "kit-70", name: "Kit 70 Salgadinhos", quantity: 70, price: 72.90, passo_quantidade: 10, active: true, image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80" },
  { id: "kit-80", name: "Kit 80 Salgadinhos", quantity: 80, price: 80.90, passo_quantidade: 10, active: true, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80" },
  { id: "kit-100", name: "Kit 100 Salgadinhos", quantity: 100, price: 96.00, passo_quantidade: 10, active: true, image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&auto=format&fit=crop&q=80" }
];

const DEFAULT_FLAVORS = [
  { id: "palmito", name: "Palmito com molho branco", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&auto=format&fit=crop&q=80" },
  { id: "aipim-carne-seca", name: "Aipim com carne seca", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=300&auto=format&fit=crop&q=80" },
  { id: "coxinha", name: "Coxinha de Frango Tradicional", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=300&auto=format&fit=crop&q=80" },
  { id: "risole-frango", name: "Risole de Frango", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&auto=format&fit=crop&q=80" },
  { id: "tomate-seco", name: "Tomate Seco com Mussarela", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300&auto=format&fit=crop&q=80" },
  { id: "risole-carne", name: "Risole de carne", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&auto=format&fit=crop&q=80" },
  { id: "calabresa-requeijao", name: "Calabresa com Requeijão", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=300&auto=format&fit=crop&q=80" },
  { id: "queijo-azeitona", name: "Bolinha de queijo com azeitona", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300&auto=format&fit=crop&q=80" },
  { id: "kibe", name: "Kibe Tradicional", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300&auto=format&fit=crop&q=80" },
  { id: "kibe-requeijao", name: "Kibe com requeijão", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300&auto=format&fit=crop&q=80" },
  { id: "queijo-oregano", name: "Bolinha de queijo com orégano", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300&auto=format&fit=crop&q=80" },
  { id: "queijo-alho-poro", name: "Queijo com alho-poró", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300&auto=format&fit=crop&q=80" },
  { id: "queijo-alho", name: "Queijo com alho", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300&auto=format&fit=crop&q=80" },
  { id: "queijo-presunto", name: "Queijo com presunto", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300&auto=format&fit=crop&q=80" },
  { id: "croquete-milho", name: "Croquete de milho com mussarela", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=300&auto=format&fit=crop&q=80" },
  { id: "empanado-salsicha", name: "Empanado de salsicha", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=300&auto=format&fit=crop&q=80" },
  { id: "risole-camarao", name: "Risole creme de camarão", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&auto=format&fit=crop&q=80" },
  { id: "camarao-moranga", name: "Camarão na moranga", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&auto=format&fit=crop&q=80" },
  { id: "acaraje", name: "Acarajé", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=300&auto=format&fit=crop&q=80" },
  { id: "croquete-alemao", name: "Croquete alemão de carne", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=300&auto=format&fit=crop&q=80" },
  { id: "bolinha-4-queijos", name: "Bolinha de 4 queijos", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300&auto=format&fit=crop&q=80" },
  { id: "croquete-pernil", name: "Croquete de pernil", adicional_por_10: 3.00, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=300&auto=format&fit=crop&q=80" },
  { id: "croquete-feijoada", name: "Croquetinho de feijoada", adicional_por_10: 3.00, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=300&auto=format&fit=crop&q=80" },
  { id: "coxinha-costela", name: "Coxinha de costela", adicional_por_10: null, limite_quantidade: 10, active: true, image: "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=300&auto=format&fit=crop&q=80" },
  { id: "croquete-bacalhau", name: "Croquete de bacalhau", adicional_por_10: 3.00, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=300&auto=format&fit=crop&q=80" },
  { id: "camarao-casca", name: "Empanado de camarão com casca", adicional_por_10: null, limite_quantidade: null, active: true, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&auto=format&fit=crop&q=80" }
];

const DEFAULT_SAUCES = [
  { id: "sem-molho", name: "Sem Molho", price: 0.00, active: true, image: "" },
  { id: "ketchup", name: "Ketchup", price: 3.50, active: true, image: "https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=300&auto=format&fit=crop&q=80" },
  { id: "maionese-trad", name: "Maionese Tradicional", price: 3.50, active: true, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300&auto=format&fit=crop&q=80" },
  { id: "barbecue", name: "Barbecue", price: 3.50, active: true, image: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=300&auto=format&fit=crop&q=80" },
  { id: "mostarda-amarela", name: "Mostarda Amarela", price: 3.50, active: true, image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=300&auto=format&fit=crop&q=80" },
  { id: "billy-jack", name: "Billy Jack", price: 3.50, active: true, image: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=300&auto=format&fit=crop&q=80" },
  { id: "mostarda-escura", name: "Mostarda Escura", price: 3.50, active: true, image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=300&auto=format&fit=crop&q=80" },
  { id: "maionese-alho", name: "Maionese de Alho da Casa", price: 4.50, active: true, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300&auto=format&fit=crop&q=80" },
  { id: "molho-verde", name: "Molho Verde da Casa", price: 4.50, active: true, image: "https://images.unsplash.com/photo-1594041680534-e8c8cdebd659?w=300&auto=format&fit=crop&q=80" },
  { id: "cheddar", name: "Cheddar cremoso", price: 3.50, active: true, image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=300&auto=format&fit=crop&q=80" },
  { id: "maionese-bacon", name: "Maionese de bacon", price: 4.00, active: true, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300&auto=format&fit=crop&q=80" },
  { id: "maionese-grill", name: "Maionese Grill", price: 4.00, active: true, image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300&auto=format&fit=crop&q=80" }
];

const DEFAULT_CATEGORIES = [
  { id: "cat-bebidas", name: "Bebidas", icon: "fa-bottle-water", description: "Refrigerantes, sucos e bebidas geladas", active: true }
];

const DEFAULT_PRODUCTS = [
  { id: "prod-coca-2l", categoryId: "cat-bebidas", name: "Coca-Cola 2 Litros (Gelada)", price: 14.00, description: "Garrafa de Coca-Cola 2L bem gelada", active: true, image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80" },
  { id: "prod-guarana-2l", categoryId: "cat-bebidas", name: "Guaraná Antarctica 2 Litros", price: 12.00, description: "Refrigerante Guaraná Antarctica 2L gelado", active: true, image: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop&q=80" },
  { id: "prod-coca-lata", categoryId: "cat-bebidas", name: "Coca-Cola Lata 350ml", price: 6.00, description: "Lata 350ml bem geladinha", active: true, image: "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=500&auto=format&fit=crop&q=80" },
  { id: "prod-agua-500", categoryId: "cat-bebidas", name: "Água Mineral 500ml", price: 4.00, description: "Garrafinha 500ml (com ou sem gás)", active: true, image: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80" }
];

const DEFAULT_COMBOS = [
  {
    id: "combo-casal",
    name: "Combo Casal VIP (30 Salgados + Coca Lata + Molho)",
    description: "Ideal para duas pessoas: Kit 30 salgadinhos à sua escolha + 1 Coca-Cola Lata 350ml + 1 Molho Especial da Casa.",
    badge: "Mais Vendido 🔥",
    image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80",
    items: [
      { type: "kit", id: "kit-30", name: "Kit 30 Salgadinhos", quantity: 1, unitPrice: 39.90 },
      { type: "product", id: "prod-coca-lata", name: "Coca-Cola Lata 350ml", quantity: 1, unitPrice: 6.00 },
      { type: "sauce", id: "maionese-alho", name: "Maionese de Alho da Casa", quantity: 1, unitPrice: 4.50 }
    ],
    regularPrice: 50.40,
    price: 42.90,
    discountPercent: 15,
    active: true
  },
  {
    id: "combo-familia",
    name: "Super Combo Família VIP (50 Salgados + Coca 2L + 2 Molhos)",
    description: "O combo mais pedido da casa! Kit 50 salgadinhos variados + 1 Coca-Cola 2L geladinha + 2 Molhos Especiais.",
    badge: "Super Econômico 💰",
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&auto=format&fit=crop&q=80",
    items: [
      { type: "kit", id: "kit-50", name: "Kit 50 Salgadinhos", quantity: 1, unitPrice: 64.90 },
      { type: "product", id: "prod-coca-2l", name: "Coca-Cola 2 Litros (Gelada)", quantity: 1, unitPrice: 14.00 },
      { type: "sauce", id: "maionese-alho", name: "Maionese de Alho da Casa", quantity: 1, unitPrice: 4.50 },
      { type: "sauce", id: "molho-verde", name: "Molho Verde da Casa", quantity: 1, unitPrice: 4.50 }
    ],
    regularPrice: 87.90,
    price: 72.90,
    discountPercent: 17,
    active: true
  }
];

const DEFAULT_PRINTER_CONFIG = {
  autoPrintNewOrders: true,
  silentPrintMode: true, // Impressão direta silenciosa sem diálogo de confirmação
  printerTarget: "windows_default", // Impressora padrão do Windows
  paperWidth: "80mm", // "80mm" (padrão balcão) ou "58mm"
  copies: 1, // 1 ou 2 vias
  soundAlert: true,
  autoCutPaper: true, // Avanço de papel e linha de corte
  targetPrepTimeMinutes: 35,

  // Opções de Tipografia e Formatação Visual do Cupom
  fontFamily: "monospace", // "monospace", "sans-serif", "condensed"
  fontSize: "medium", // "small" (9.5pt), "medium" (11pt), "large" (12.5pt), "xlarge" (14pt)
  fontWeight: "bold", // "normal" (500), "bold" (700), "heavy" (900)
  lineSpacing: "normal", // "compact" (1.15), "normal" (1.28), "spacious" (1.42)
  marginSideMm: 2, // Margem lateral de segurança (2mm, 3mm, 4mm, 6mm) - 2mm para máxima economia de papel
  printableWidthMm: 76, // Largura útil imprimível (76mm com margens 2mm & 2mm na bobina 80mm - zero desperdício!)
  textColumns: 40, // Colunas no spooler nativo (38 a 44)
  printLogo: true, // Imprimir logo da loja no topo do cupom
  printPixDetails: true, // Imprimir instruções de chave PIX no rodapé
  highlightDrinks: true, // Destacar aviso de bebidas geladas
  showMotoboyBox: true // Caixa de pagamento/troco do motoboy
};

const DEFAULT_ORDERS = [
  {
    id: "VIP-101",
    orderId: "VIP-101",
    createdAt: Date.now() - (14 * 60 * 1000), // 14 minutos atrás
    customer: {
      name: "Mariana Alcântara",
      phone: "(21) 98765-4321",
      fulfillment: "Entrega",
      address: "Rua Bernardino de Melo, 1420, Apt 302, Centro - Nova Iguaçu",
      payment: "Pix",
      change: "",
      notes: "Tocar interfone 302, portão preto."
    },
    fulfillment: "Entrega",
    items: [
      {
        type: "kit",
        kitName: "Kit 50 Salgadinhos",
        finalPrice: 67.90,
        totalQuantity: 50,
        flavors: [
          { name: "Coxinha de Frango Tradicional", quantity: 20 },
          { name: "Bolinha de queijo com alho", quantity: 10 },
          { name: "Kibe Tradicional", quantity: 10 },
          { name: "Croquete de pernil", quantity: 10 }
        ],
        flavorExtraCost: 3.00,
        sauces: [
          { name: "Maionese de Alho da Casa", quantity: 1, subtotal: 4.50 }
        ]
      },
      {
        type: "product",
        name: "Coca-Cola 2 Litros (Gelada)",
        price: 14.00,
        quantity: 1
      }
    ],
    subtotal: 81.90,
    deliveryFee: 0,
    totalAmount: 81.90,
    total: 81.90,
    paymentMethod: "Pix",
    cashChangeFor: null,
    status: "em_preparo",
    printed: true,
    printedAt: Date.now() - (12 * 60 * 1000),
    history: [
      { status: "novo", time: Date.now() - (14 * 60 * 1000) },
      { status: "em_preparo", time: Date.now() - (11 * 60 * 1000) }
    ]
  },
  {
    id: "VIP-102",
    orderId: "VIP-102",
    createdAt: Date.now() - (44 * 60 * 1000), // 44 minutos atrás (> 35 min -> ATRASADO!)
    customer: {
      name: "Carlos Eduardo Souza",
      phone: "(21) 97654-3210",
      fulfillment: "Entrega",
      address: "Av. Getúlio de Moura, 850, Moquetá - Nova Iguaçu",
      payment: "Dinheiro",
      change: "100.00",
      notes: "Por favor caprichar no molho verde!"
    },
    fulfillment: "Entrega",
    items: [
      {
        type: "combo",
        name: "Super Combo Família VIP (50 Salgados + Coca 2L + 2 Molhos)",
        finalPrice: 72.90,
        regularPrice: 87.90,
        savings: 15.00,
        discountPercent: 17,
        flavors: [
          { name: "Coxinha de Frango Tradicional", quantity: 25 },
          { name: "Kibe Tradicional", quantity: 15 },
          { name: "Risole de carne", quantity: 10 }
        ],
        items: [
          { type: "kit", name: "Kit 50 Salgadinhos", quantity: 1 },
          { type: "product", name: "Coca-Cola 2 Litros (Gelada)", quantity: 1 },
          { type: "sauce", name: "Maionese de Alho da Casa", quantity: 1 },
          { type: "sauce", name: "Molho Verde da Casa", quantity: 1 }
        ]
      }
    ],
    subtotal: 72.90,
    deliveryFee: 0,
    totalAmount: 72.90,
    total: 72.90,
    paymentMethod: "Dinheiro",
    cashChangeFor: "R$ 100,00",
    notes: "Por favor caprichar no molho verde!",
    status: "em_preparo",
    printed: true,
    printedAt: Date.now() - (40 * 60 * 1000),
    history: [
      { status: "novo", time: Date.now() - (44 * 60 * 1000) },
      { status: "em_preparo", time: Date.now() - (40 * 60 * 1000) }
    ]
  },
  {
    id: "VIP-103",
    orderId: "VIP-103",
    createdAt: Date.now() - (3 * 60 * 1000), // 3 minutos atrás (NOVO!)
    customer: {
      name: "Juliana Mendes Ribeiro",
      phone: "(21) 99887-6543",
      fulfillment: "Retirada",
      address: "Retirada no Balcão: Rua Isabel Pedrosa, 31, Da Luz",
      payment: "Cartão de Crédito",
      change: "",
      notes: "Vou retirar às 19:30."
    },
    fulfillment: "Retirada",
    items: [
      {
        type: "combo",
        name: "Combo Casal VIP (30 Salgados + Coca Lata + Molho)",
        finalPrice: 42.90,
        regularPrice: 50.40,
        savings: 7.50,
        discountPercent: 15,
        flavors: [
          { name: "Coxinha de Frango Tradicional", quantity: 10 },
          { name: "Bolinha de queijo com orégano", quantity: 10 },
          { name: "Kibe com requeijão", quantity: 10 }
        ],
        items: [
          { type: "kit", name: "Kit 30 Salgadinhos", quantity: 1 },
          { type: "product", name: "Coca-Cola Lata 350ml", quantity: 1 },
          { type: "sauce", name: "Maionese de Alho da Casa", quantity: 1 }
        ]
      }
    ],
    subtotal: 42.90,
    deliveryFee: 0,
    totalAmount: 42.90,
    total: 42.90,
    paymentMethod: "Cartão de Crédito/Débito",
    cashChangeFor: null,
    notes: "Vou retirar às 19:30.",
    status: "novo",
    printed: false,
    printedAt: null,
    history: [
      { status: "novo", time: Date.now() - (3 * 60 * 1000) }
    ]
  }
];

// ==============================================================================
// CONFIGURAÇÃO DO SUPABASE (BANCO DE DADOS EM NUVEM E TEMPO REAL - FREE TIER)
// ==============================================================================
const SUPABASE_CONFIG = {
  url: "https://koudymqezejvhdazvqom.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdWR5bXFlemVqdmhkYXp2cW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5OTQyNjAsImV4cCI6MjEwNzU3MDI2MH0.it1qrMFxDnCb3mihTcsyPjrg3c0T34TLm0yzUaATPpM",
  projectId: "koudymqezejvhdazvqom",
  projectName: "Site_delivery's Project",
  realtimeEnabled: true
};

let _supabaseClient = null;
let _supabaseChannel = null;

function getSupabaseClient() {
  if (!_supabaseClient && window.supabase && typeof window.supabase.createClient === "function") {
    try {
      _supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    } catch (e) {
      console.warn("[Supabase] Aviso ao instanciar cliente:", e);
    }
  }
  return _supabaseClient;
}

// Fallback SHA-256 síncrono para garantir suporte em qualquer ambiente
function sha256Sync(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  var mathPow = Math.pow;
  var maxWord = mathPow(2, 32);
  var lengthProperty = 'length';
  var i, j;
  var result = '';
  var words = [];
  var asciiBitLength = ascii[lengthProperty] * 8;
  var hash = sha256Sync.h = sha256Sync.h || [];
  var k = sha256Sync.k = sha256Sync.k || [];
  var primeCounter = k[lengthProperty];
  var isComposite = {};
  for (var candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return;
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
  words[words[lengthProperty]] = (asciiBitLength);
  for (j = 0; j < words[lengthProperty];) {
    var w = words.slice(j, j += 16);
    var oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      var w15 = w[i - 15], w2 = w[i - 2];
      var s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      var s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] = (i < 16) ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      var ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      var maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      var temp1 = (hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + w[i]) | 0;
      var temp2 = ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) | 0;
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      var b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

// ==============================================================================
// MÓDULO DE AUTENTICAÇÃO SEGURA EM NUVEM (SUPABASE CLOUD AUTH + CRIPTOGRAFIA)
// ==============================================================================
const VIPAuth = {
  // Hash SHA-256 criptográfico nativo com salt
  async hashPassword(password, salt) {
    const text = (password || "") + ":" + (salt || "");
    if (window.crypto && window.crypto.subtle) {
      try {
        const msgBuffer = new TextEncoder().encode(text);
        const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgBuffer);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
      } catch (e) {
        // Fallback síncrono
      }
    }
    return sha256Sync(text);
  },

  generateSalt() {
    if (window.crypto && window.crypto.getRandomValues) {
      const arr = new Uint8Array(16);
      window.crypto.getRandomValues(arr);
      return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
    }
    return "salt_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
  },

  generateMasterKey() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const chunk = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `VIP-REC-${chunk(4)}-${chunk(4)}`;
  },

  generatePin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  isLoggedIn() {
    const raw = sessionStorage.getItem("vip_admin_session");
    if (!raw) return false;
    try {
      const sess = JSON.parse(raw);
      if (sess.logged && sess.expiresAt && Date.now() < sess.expiresAt) {
        return true;
      }
    } catch (e) {}
    sessionStorage.removeItem("vip_admin_session");
    return false;
  },

  setSession(user) {
    sessionStorage.setItem("vip_admin_session", JSON.stringify({
      logged: true,
      username: user || "admin",
      createdAt: Date.now(),
      expiresAt: Date.now() + (12 * 60 * 60 * 1000) // 12 horas de sessão ativa
    }));
    // Limpeza de segurança para não deixar senhas ou auth em localStorage
    localStorage.removeItem(STORAGE_KEYS.AUTH);
  },

  getCurrentUser() {
    try {
      const sess = sessionStorage.getItem("vip_admin_session");
      if (sess) {
        const parsed = JSON.parse(sess);
        return { name: parsed.username || "Administrador", username: parsed.username || "admin" };
      }
    } catch (e) {}
    return { name: "Administrador", username: "admin" };
  },

  logout() {
    sessionStorage.removeItem("vip_admin_session");
    sessionStorage.removeItem("vip_admin_logged");
  },

  async getCloudAuthRecord() {
    const sb = VIPDatabase.getSupabaseClient();
    if (!sb) {
      throw new Error("Não foi possível conectar ao banco de dados Supabase.");
    }
    const { data, error } = await sb.from("admin_auth").select("*").eq("id", "primary_admin").single();
    if (error || !data) {
      throw new Error(error ? error.message : "Registro de autenticação não encontrado na nuvem.");
    }
    return data;
  },

  async login(userOrEmail, password) {
    const sb = VIPDatabase.getSupabaseClient();
    if (!sb) {
      return { success: false, message: "Sem conexão com o Supabase. Verifique sua internet." };
    }

    const trimmedUser = (userOrEmail || "").trim().toLowerCase();
    const cleanPass = (password || "").trim();

    if (!trimmedUser || !cleanPass) {
      return { success: false, message: "Preencha o usuário e a senha." };
    }

    try {
      const record = await this.getCloudAuthRecord();

      // Verificar bloqueio por tentativas excessivas
      if (record.locked_until && Date.now() < parseInt(record.locked_until)) {
        const remainingMin = Math.ceil((parseInt(record.locked_until) - Date.now()) / 60000);
        return {
          success: false,
          locked: true,
          message: `Acesso temporariamente bloqueado por excesso de tentativas. Tente novamente em ${remainingMin} minuto(s) ou recupere seu acesso com a Chave Mestra.`
        };
      }

      // Validar usuário ou e-mail
      const isUserMatch = (trimmedUser === (record.username || "").toLowerCase());
      const isEmailMatch = (trimmedUser === (record.email || "").toLowerCase());

      if (!isUserMatch && !isEmailMatch) {
        await this.handleFailedAttempt(record);
        return { success: false, message: "Usuário ou senha incorretos." };
      }

      // Validar hash criptográfico da senha
      const computedHash = await this.hashPassword(cleanPass, record.password_salt);
      if (computedHash !== record.password_hash) {
        await this.handleFailedAttempt(record);
        return { success: false, message: "Usuário ou senha incorretos." };
      }

      // Sucesso: resetar tentativas falhas e criar sessão segura
      await sb.from("admin_auth").update({
        failed_attempts: 0,
        locked_until: 0,
        recovery_pin: null,
        recovery_pin_expires_at: null
      }).eq("id", "primary_admin");

      this.setSession(record.username);
      return { success: true, username: record.username };

    } catch (err) {
      console.error("[VIPAuth] Erro no login:", err);
      return { success: false, message: err.message || "Erro ao consultar autenticação no Supabase." };
    }
  },

  async handleFailedAttempt(record) {
    const sb = VIPDatabase.getSupabaseClient();
    if (!sb) return;

    const attempts = (record.failed_attempts || 0) + 1;
    const updates = { failed_attempts: attempts };

    if (attempts >= 5) {
      updates.locked_until = Date.now() + (15 * 60 * 1000); // 15 minutos de bloqueio
    }

    await sb.from("admin_auth").update(updates).eq("id", "primary_admin");
  },

  // Recuperação com Chave Mestra
  async recoverWithMasterKey(masterKey, newPassword) {
    const sb = VIPDatabase.getSupabaseClient();
    if (!sb) return { success: false, message: "Sem conexão com o Supabase." };

    const cleanKey = (masterKey || "").trim().toUpperCase();
    const cleanPass = (newPassword || "").trim();

    if (!cleanKey) return { success: false, message: "Informe a Chave Mestra de Segurança." };
    if (!cleanPass || cleanPass.length < 6) return { success: false, message: "A nova senha deve ter no mínimo 6 caracteres." };

    try {
      const record = await this.getCloudAuthRecord();
      const computedKeyHash = await this.hashPassword(cleanKey, record.password_salt);

      if (computedKeyHash !== record.recovery_key_hash) {
        return { success: false, message: "Chave Mestra inválida. Verifique o código e tente novamente." };
      }

      // Gera novo salt e novos hashes
      const newSalt = this.generateSalt();
      const newPassHash = await this.hashPassword(cleanPass, newSalt);
      const newKeyHash = await this.hashPassword(cleanKey, newSalt);

      const { error } = await sb.from("admin_auth").update({
        password_hash: newPassHash,
        password_salt: newSalt,
        recovery_key_hash: newKeyHash,
        failed_attempts: 0,
        locked_until: 0,
        recovery_pin: null,
        recovery_pin_expires_at: null,
        updated_at: new Date().toISOString()
      }).eq("id", "primary_admin");

      if (error) throw error;

      this.setSession(record.username);
      return { success: true, message: "Senha redefinida com sucesso!", username: record.username };

    } catch (err) {
      console.error("[VIPAuth] Erro na recuperação com chave:", err);
      return { success: false, message: err.message || "Erro ao redefinir senha." };
    }
  },

  // Solicitar PIN de recuperação
  async requestRecoveryPin(emailOrUser) {
    const sb = VIPDatabase.getSupabaseClient();
    if (!sb) return { success: false, message: "Sem conexão com o Supabase." };

    const input = (emailOrUser || "").trim().toLowerCase();
    if (!input) return { success: false, message: "Informe o e-mail ou usuário cadastrado." };

    try {
      const record = await this.getCloudAuthRecord();
      const isEmailMatch = (input === (record.email || "").toLowerCase());
      const isUserMatch = (input === (record.username || "").toLowerCase());

      if (!isEmailMatch && !isUserMatch) {
        return { success: false, message: "E-mail ou usuário não corresponde ao administrador cadastrado." };
      }

      const pin = this.generatePin();
      const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minutos

      const { error } = await sb.from("admin_auth").update({
        recovery_pin: pin,
        recovery_pin_expires_at: expiresAt
      }).eq("id", "primary_admin");

      if (error) throw error;

      return {
        success: true,
        pin: pin,
        email: record.email,
        expiresInMinutes: 15
      };

    } catch (err) {
      console.error("[VIPAuth] Erro ao gerar PIN:", err);
      return { success: false, message: err.message || "Erro ao gerar código de recuperação." };
    }
  },

  // Validar PIN e redefinir senha
  async resetPasswordWithPin(pin, newPassword) {
    const sb = VIPDatabase.getSupabaseClient();
    if (!sb) return { success: false, message: "Sem conexão com o Supabase." };

    const cleanPin = (pin || "").trim();
    const cleanPass = (newPassword || "").trim();

    if (!cleanPin || cleanPin.length !== 6) return { success: false, message: "Digite o código PIN de 6 dígitos." };
    if (!cleanPass || cleanPass.length < 6) return { success: false, message: "A nova senha deve ter no mínimo 6 caracteres." };

    try {
      const record = await this.getCloudAuthRecord();

      if (!record.recovery_pin || !record.recovery_pin_expires_at) {
        return { success: false, message: "Nenhum código PIN ativo. Solicite um novo código." };
      }

      if (Date.now() > parseInt(record.recovery_pin_expires_at)) {
        return { success: false, message: "O código PIN expirou (validade de 15 min). Solicite um novo." };
      }

      if (cleanPin !== record.recovery_pin) {
        return { success: false, message: "Código PIN incorreto." };
      }

      // PIN correto -> redefinir senha
      const newSalt = this.generateSalt();
      const newPassHash = await this.hashPassword(cleanPass, newSalt);

      const { error } = await sb.from("admin_auth").update({
        password_hash: newPassHash,
        password_salt: newSalt,
        failed_attempts: 0,
        locked_until: 0,
        recovery_pin: null,
        recovery_pin_expires_at: null,
        updated_at: new Date().toISOString()
      }).eq("id", "primary_admin");

      if (error) throw error;

      this.setSession(record.username);
      return { success: true, message: "Senha redefinida com sucesso!", username: record.username };

    } catch (err) {
      console.error("[VIPAuth] Erro ao redefinir com PIN:", err);
      return { success: false, message: err.message || "Erro ao redefinir senha." };
    }
  },

  // Atualizar credenciais no painel de configurações
  async updateCredentials({ username, email, newPassword, newMasterKey }) {
    const sb = VIPDatabase.getSupabaseClient();
    if (!sb) return { success: false, message: "Sem conexão com o Supabase." };

    const cleanUser = (username || "").trim();
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanPass = (newPassword || "").trim();
    const cleanKey = (newMasterKey || "").trim().toUpperCase();

    if (!cleanUser) return { success: false, message: "O nome de usuário não pode ficar vazio." };
    if (!cleanEmail || !cleanEmail.includes("@")) return { success: false, message: "Informe um e-mail de recuperação válido." };

    try {
      const record = await this.getCloudAuthRecord();
      const newSalt = this.generateSalt();

      const updates = {
        username: cleanUser,
        email: cleanEmail,
        password_salt: newSalt,
        updated_at: new Date().toISOString()
      };

      if (cleanPass) {
        if (cleanPass.length < 6) return { success: false, message: "A senha deve ter no mínimo 6 caracteres." };
        updates.password_hash = await this.hashPassword(cleanPass, newSalt);
      } else {
        // Se manteve a senha atual, precisamos atualizar o hash com o novo salt
        // Se não forneceu nova senha, mantemos o salt anterior para a senha
        updates.password_salt = record.password_salt;
      }

      if (cleanKey) {
        updates.recovery_key_hash = await this.hashPassword(cleanKey, updates.password_salt);
      }

      const { error } = await sb.from("admin_auth").update(updates).eq("id", "primary_admin");
      if (error) throw error;

      // Limpa dados locais
      localStorage.removeItem(STORAGE_KEYS.AUTH);

      return { success: true, message: "Credenciais e Chave Mestra salvas com sucesso no Supabase!" };

    } catch (err) {
      console.error("[VIPAuth] Erro ao atualizar credenciais:", err);
      return { success: false, message: err.message || "Erro ao atualizar credenciais." };
    }
  }
};

// ==============================================================================
// MÓDULO AUXILIAR PIX (PAYLOAD EMV BR CODE PADRÃO BACEN & QR CODE DINÂMICO)
// ==============================================================================
const VIPPix = {
  // Cálculo de redundância cíclica CRC16-CCITT (Polinômio 0x1021, Init 0xFFFF)
  crc16(str) {
    let crc = 0xFFFF;
    const polynomial = 0x1021;
    const bytes = new TextEncoder().encode(str);
    for (let i = 0; i < bytes.length; i++) {
      for (let j = 0; j < 8; j++) {
        const bit = ((bytes[i] >> (7 - j)) & 1) === 1;
        const c15 = ((crc >> 15) & 1) === 1;
        crc = (crc << 1) & 0xFFFF;
        if (c15 !== bit) crc = (crc ^ polynomial) & 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  },

  formatTLV(id, value) {
    const valStr = String(value ?? "");
    const len = new TextEncoder().encode(valStr).length;
    return id.padStart(2, "0") + String(len).padStart(2, "0") + valStr;
  },

  removeAccents(str) {
    return (str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim();
  },

  // Gera o código "Pix Copia e Cola" 100% compatível com todos os bancos (Nubank, Inter, Itaú, Bradesco, etc.)
  generatePayload({ key, keyType = "telefone", name = "Salgados VIP", city = "Nova Iguacu", amount = 0, txid = "***" }) {
    let cleanKey = (key || "").trim();
    if (keyType === "telefone") {
      cleanKey = cleanKey.replace(/\D/g, "");
      if (cleanKey.length === 11 || cleanKey.length === 10) {
        cleanKey = "+55" + cleanKey;
      } else if (!cleanKey.startsWith("+") && cleanKey.length >= 12) {
        cleanKey = "+" + cleanKey;
      }
    } else if (keyType === "cpf" || keyType === "cnpj") {
      cleanKey = cleanKey.replace(/\D/g, "");
    }

    const cleanName = this.removeAccents(name || "Salgados VIP").toUpperCase().substring(0, 25) || "SALGADOS VIP";
    const cleanCity = this.removeAccents(city || "Nova Iguacu").toUpperCase().substring(0, 15) || "NOVA IGUACU";
    const cleanTxid = (txid || "***").replace(/[^a-zA-Z0-9]/g, "").substring(0, 25) || "***";

    // 00: Payload Format Indicator = 01
    let payload = this.formatTLV("00", "01");

    // 26: Merchant Account Information
    const gui = this.formatTLV("00", "br.gov.bcb.pix");
    const pixKeyTLV = this.formatTLV("01", cleanKey);
    payload += this.formatTLV("26", gui + pixKeyTLV);

    // 52: Merchant Category Code = 0000
    payload += this.formatTLV("52", "0000");

    // 53: Transaction Currency (986 = BRL)
    payload += this.formatTLV("53", "986");

    // 54: Transaction Amount
    const numAmount = parseFloat(amount) || 0;
    if (numAmount > 0) {
      payload += this.formatTLV("54", numAmount.toFixed(2));
    }

    // 58: Country Code = BR
    payload += this.formatTLV("58", "BR");

    // 59: Merchant Name
    payload += this.formatTLV("59", cleanName);

    // 60: Merchant City
    payload += this.formatTLV("60", cleanCity);

    // 62: Additional Data Field Template
    const txidTLV = this.formatTLV("05", cleanTxid);
    payload += this.formatTLV("62", txidTLV);

    // 63: CRC16 (CCITT-FALSE)
    payload += "6304";
    const crc = this.crc16(payload);
    return payload + crc;
  },

  getQrCodeUrl(payload, size = 260) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(payload)}`;
  }
};

if (typeof window !== "undefined") {
  window.VIPPix = VIPPix;
}

// ==============================================================================
// MÓDULO AUXILIAR WHATSAPP (NOTIFICAÇÕES DE STATUS, MODELOS DE MENSAGENS E LINKS)
// ==============================================================================
const VIPWhatsAppNotifier = {
  // Limpa e normaliza telefone para o formato internacional do WhatsApp (DDI 55 + DDD + Número)
  normalizePhone(phone) {
    if (!phone) return "";
    let clean = String(phone).replace(/\D/g, "");
    if (!clean) return "";
    // Se digitou sem DDI (10 ou 11 dígitos, ex: 21986758102)
    if (clean.length === 10 || clean.length === 11) {
      clean = "55" + clean;
    }
    return clean;
  },

  // Formata telefone amigavelmente para exibição visual (ex: (21) 98675-8102)
  formatPhoneDisplay(phone) {
    if (!phone) return "";
    let clean = String(phone).replace(/\D/g, "");
    if (clean.startsWith("55") && clean.length >= 12) {
      clean = clean.substring(2);
    }
    if (clean.length === 11) {
      return `(${clean.substring(0, 2)}) ${clean.substring(2, 7)}-${clean.substring(7)}`;
    } else if (clean.length === 10) {
      return `(${clean.substring(0, 2)}) ${clean.substring(2, 6)}-${clean.substring(6)}`;
    }
    return phone;
  },

  // Valida se o número possui o mínimo de dígitos exigidos para envio (DDD + 8 ou 9 dígitos)
  isValidPhone(phone) {
    const norm = this.normalizePhone(phone);
    return norm.length >= 12; // 55 + 2 digitos DDD + 8 ou 9 digitos
  },

  // Gera o link direto wa.me com texto devidamente codificado para URL
  buildWhatsAppUrl(phone, text) {
    const normPhone = this.normalizePhone(phone);
    if (!normPhone) return null;
    return `https://wa.me/${normPhone}?text=${encodeURIComponent(text)}`;
  },

  // Formata o resumo rápido dos itens do pedido
  formatItemsSummary(items) {
    if (!items || !items.length) return "1x Pedido";
    const parts = items.map(item => {
      if (item.type === "kit") {
        return `1x ${item.kitName || "Kit de Salgados"}`;
      } else if (item.type === "combo") {
        return `1x ${item.name || "Combo"}`;
      }
      return `${item.quantity || 1}x ${item.name || "Item"}`;
    });
    return parts.join(", ");
  },

  // Formata moeda BRL com fallback
  formatCurrency(val) {
    try {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);
    } catch (e) {
      return `R$ ${(val || 0).toFixed(2).replace(".", ",")}`;
    }
  },

  // Gera os templates prontos para cada etapa do pedido
  getTemplates(order, storeConfig = {}) {
    if (!order) return {};
    const storeName = storeConfig.name || "Salgados VIP Nova Iguaçu";
    const storeAddress = storeConfig.address || "Rua Isabel Pedrosa, 31, Da Luz, Nova Iguaçu - RJ";
    const custName = (order.customer?.name || "Cliente").trim();
    const orderId = order.id;
    const isDelivery = order.fulfillment === "Entrega";
    const totalFormatted = (typeof formatBRL === "function") 
      ? formatBRL(order.totalAmount || 0) 
      : this.formatCurrency(order.totalAmount || 0);
    const itemsSummary = this.formatItemsSummary(order.items);
    
    let timingStr = "⚡ Preparar Agora (Imediato)";
    if (order.timingType === "agendado") {
      timingStr = `📅 Agendado para: ${order.scheduledDateTimeFormatted || (order.scheduledDate + ' às ' + order.scheduledTime)}`;
    }

    const destInfo = isDelivery
      ? `🛵 *Entrega em:* ${order.customer?.address || "Endereço cadastrado"}`
      : `🏪 *Retirada no Balcão:* ${storeAddress}`;

    const paymentInfo = `${order.paymentMethod || "A combinar"}${order.cashChangeFor ? ` (Troco para ${order.cashChangeFor})` : ""}`;

    return {
      confirmado: {
        id: "confirmado",
        label: "Confirmado",
        badge: "🟡 Confirmar Pedido",
        icon: "fa-circle-check",
        color: "#f59e0b",
        text: `Olá, *${custName}*! Tudo bem? 😊\n\n` +
              `Confirmamos o recebimento do seu *Pedido #${orderId}* no *${storeName}*! 🥟✨\n\n` +
              `📋 *Itens:* ${itemsSummary}\n` +
              `💵 *Total:* ${totalFormatted} (${paymentInfo})\n` +
              `${destInfo}\n` +
              `⏱️ *Previsão:* ${timingStr}\n\n` +
              `Seu pedido já foi registrado e encaminhado para a produção. Qualquer dúvida estamos à disposição por aqui! 💛`
      },
      em_preparo: {
        id: "em_preparo",
        label: "Na Cozinha",
        badge: "👨‍🍳 Em Preparo",
        icon: "fa-fire-burner",
        color: "#3b82f6",
        text: `Olá, *${custName}*! 👨‍🍳🔥\n\n` +
              `Passando para avisar que o seu *Pedido #${orderId}* já está na cozinha sendo preparado com todo carinho!\n\n` +
              `Nossos salgados são fritos na hora para chegarem bem quentinhos e crocantes. 🥟✨\n\n` +
              `Assim que estiver pronto, te avisamos de imediato!`
      },
      saiu_entrega: {
        id: "saiu_entrega",
        label: "Saiu p/ Entrega",
        badge: "🛵 Saiu p/ Entrega",
        icon: "fa-motorcycle",
        color: "#10b981",
        text: `Olá, *${custName}*! 🛵💨\n\n` +
              `Boas notícias! O seu *Pedido #${orderId}* acabou de sair para entrega com o nosso motoboy!\n\n` +
              `📍 *Endereço de Entrega:* ${order.customer?.address || "Seu endereço cadastrado"}\n` +
              `💵 *Valor a Pagar:* ${totalFormatted}\n` +
              `💳 *Forma de Pagamento:* ${paymentInfo}\n\n` +
              `Por favor, fique atento(a) ao interfone, portão ou campainha. Seus salgados estão a caminho quentinhos! Bom apetite! 🥟😋`
      },
      pronto_retirada: {
        id: "pronto_retirada",
        label: "Pronto p/ Retirada",
        badge: "🏪 Pronto no Balcão",
        icon: "fa-store",
        color: "#10b981",
        text: `Olá, *${custName}*! 🏪✨\n\n` +
              `O seu *Pedido #${orderId}* já está PRONTINHO e quentinho aguardando sua retirada aqui no balcão do *${storeName}*!\n\n` +
              `📍 *Endereço de Retirada:* ${storeAddress}\n` +
              `💵 *Valor Total:* ${totalFormatted} (${paymentInfo})\n\n` +
              `Pode vir retirar quando quiser, estamos prontos para te entregar! 😊🥟`
      },
      concluido: {
        id: "concluido",
        label: "Agradecimento",
        badge: "❤️ Concluído / Agradecimento",
        icon: "fa-heart",
        color: "#ec4899",
        text: `Olá, *${custName}*! ❤️\n\n` +
              `Seu *Pedido #${orderId}* foi finalizado! Esperamos de verdade que você e seus convidados tenham adorado os salgados! 🥟✨\n\n` +
              `Muito obrigado pela preferência e confiança no *${storeName}*.\n` +
              `Se puder, nos conte o que achou ou envie uma foto do seu lanche! Sua opinião nos ajuda muito. 🌟\n\n` +
              `Conte sempre com a gente e tenha um momento maravilhoso! 🎉`
      },
      cancelado: {
        id: "cancelado",
        label: "Cancelado",
        badge: "❌ Cancelado",
        icon: "fa-ban",
        color: "#ef4444",
        text: `Olá, *${custName}*.\n\n` +
              `Informamos que o seu *Pedido #${orderId}* no *${storeName}* precisou ser cancelado em nosso sistema.\n\n` +
              `Caso tenha alguma dúvida, precise de estorno ou queira realizar um novo pedido, por favor nos responda por aqui.`
      }
    };
  },

  // Retorna a chave do template sugerido com base no status do pedido
  getSuggestedTemplateKey(order) {
    if (!order) return "confirmado";
    if (order.status === "novo") return "confirmado";
    if (order.status === "em_preparo") return "em_preparo";
    if (order.status === "pronto") {
      return order.fulfillment === "Retirada" ? "pronto_retirada" : "saiu_entrega";
    }
    if (order.status === "concluido") return "concluido";
    if (order.status === "cancelado") return "cancelado";
    return "confirmado";
  }
};

if (typeof window !== "undefined") {
  window.VIPWhatsAppNotifier = VIPWhatsAppNotifier;
}

// GERENCIADOR DE ACESSO AO STORAGE & SUPABASE
const VIPDatabase = {
  // Configuração e Cliente Supabase
  getSupabaseConfig() {
    return SUPABASE_CONFIG;
  },
  getSupabaseClient() {
    return getSupabaseClient();
  },

  // Configurações
  getConfig() {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    let cfg = null;
    if (raw) {
      try {
        cfg = JSON.parse(raw);
      } catch (e) {
        cfg = null;
      }
    }
    if (!cfg) {
      return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
    if (!cfg.weeklySchedule || !Array.isArray(cfg.weeklySchedule) || cfg.weeklySchedule.length === 0) {
      cfg.weeklySchedule = JSON.parse(JSON.stringify(DEFAULT_WEEKLY_SCHEDULE));
    }
    if (cfg.logoUrl === undefined) {
      cfg.logoUrl = "";
    }
    if (!cfg.pixKey) {
      cfg.pixKey = DEFAULT_CONFIG.pixKey;
    }
    if (!cfg.pixKeyType) {
      cfg.pixKeyType = DEFAULT_CONFIG.pixKeyType;
    }
    if (!cfg.pixReceiverName) {
      cfg.pixReceiverName = DEFAULT_CONFIG.pixReceiverName;
    }
    if (!cfg.pixCity) {
      cfg.pixCity = DEFAULT_CONFIG.pixCity;
    }
    return cfg;
  },
  loadConfig() {
    return this.getConfig();
  },
  saveConfig(cfg) {
    try {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(cfg));
    } catch (e) {
      console.warn("[VIPDatabase] Erro ao salvar config no localStorage:", e);
    }
    return this.pushSettingToSupabase("config", cfg);
  },

  // Autenticação Segura (Delegada ao VIPAuth e Nuvem Supabase)
  getAuth() {
    return { user: "admin" };
  },
  saveAuth(auth) {
    // Não salvar senha em texto claro no localStorage
    localStorage.removeItem(STORAGE_KEYS.AUTH);
  },

  // Ordem Customizada dos Catálogos (Drag & Drop)
  getCatalogOrder() {
    const raw = localStorage.getItem(STORAGE_KEYS.CATALOG_ORDER);
    if (!raw) return {};
    try {
      return JSON.parse(raw) || {};
    } catch (e) {
      return {};
    }
  },
  saveCatalogOrder(orderMap) {
    const current = this.getCatalogOrder();
    const updated = { ...current, ...orderMap };
    try {
      localStorage.setItem(STORAGE_KEYS.CATALOG_ORDER, JSON.stringify(updated));
    } catch (e) {
      console.warn("[VIPDatabase] Erro ao salvar catalog_order:", e);
    }
    const sb = getSupabaseClient();
    if (sb) {
      sb.from("store_settings").upsert({
        id: "catalog_order",
        value: updated,
        updated_at: new Date().toISOString()
      }).then(({ error }) => {
        if (error) console.warn("[Supabase] Erro ao sincronizar catalog_order:", error);
      });
    }
    return updated;
  },

  // Kits
  getKits() {
    const raw = localStorage.getItem(STORAGE_KEYS.KITS);
    let kits = DEFAULT_KITS;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) kits = parsed;
      } catch (e) {}
    }
    const catalogOrder = this.getCatalogOrder();
    return applyCatalogOrder(kits, catalogOrder.kits);
  },
  saveKits(kits) {
    try {
      localStorage.setItem(STORAGE_KEYS.KITS, JSON.stringify(kits));
    } catch (e) {
      console.warn("[VIPDatabase] Erro ao salvar kits no localStorage:", e);
    }
    if (Array.isArray(kits)) {
      this.saveCatalogOrder({ kits: kits.map(k => k.id) });
    }
    return this.syncKitsToSupabase(kits);
  },

  // Sabores
  getFlavors() {
    const raw = localStorage.getItem(STORAGE_KEYS.FLAVORS);
    let flavors = DEFAULT_FLAVORS;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) flavors = parsed;
      } catch (e) {}
    }
    const catalogOrder = this.getCatalogOrder();
    return applyCatalogOrder(flavors, catalogOrder.flavors);
  },
  saveFlavors(flavors) {
    try {
      localStorage.setItem(STORAGE_KEYS.FLAVORS, JSON.stringify(flavors));
    } catch (e) {
      console.warn("[VIPDatabase] Erro ao salvar sabores no localStorage:", e);
    }
    if (Array.isArray(flavors)) {
      this.saveCatalogOrder({ flavors: flavors.map(f => f.id) });
    }
    return this.syncFlavorsToSupabase(flavors);
  },

  // Molhos
  getSauces() {
    const raw = localStorage.getItem(STORAGE_KEYS.SAUCES);
    let sauces = DEFAULT_SAUCES;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) sauces = parsed;
      } catch (e) {}
    }
    const catalogOrder = this.getCatalogOrder();
    return applyCatalogOrder(sauces, catalogOrder.sauces);
  },
  saveSauces(sauces) {
    try {
      localStorage.setItem(STORAGE_KEYS.SAUCES, JSON.stringify(sauces));
    } catch (e) {
      console.warn("[VIPDatabase] Erro ao salvar molhos no localStorage:", e);
    }
    if (Array.isArray(sauces)) {
      this.saveCatalogOrder({ sauces: sauces.map(s => s.id) });
    }
    return this.syncSaucesToSupabase(sauces);
  },

  // Categorias Adicionais (Bebidas, Sobremesas, etc.)
  getCategories() {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    let cats = DEFAULT_CATEGORIES;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) cats = parsed;
      } catch (e) {}
    }
    const catalogOrder = this.getCatalogOrder();
    return applyCatalogOrder(cats, catalogOrder.categories);
  },
  saveCategories(cats) {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(cats));
    } catch (e) {
      console.warn("[VIPDatabase] Erro ao salvar categorias no localStorage:", e);
    }
    if (Array.isArray(cats)) {
      this.saveCatalogOrder({ categories: cats.map(c => c.id) });
    }
    return this.syncCategoriesToSupabase(cats);
  },

  // Produtos Avulsos por Categoria
  getProducts() {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    let prods = DEFAULT_PRODUCTS;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) prods = parsed;
      } catch (e) {}
    }
    const catalogOrder = this.getCatalogOrder();
    return applyCatalogOrder(prods, catalogOrder.products);
  },
  saveProducts(prods) {
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(prods));
    } catch (e) {
      console.warn("[VIPDatabase] Erro ao salvar produtos no localStorage:", e);
    }
    if (Array.isArray(prods)) {
      this.saveCatalogOrder({ products: prods.map(p => p.id) });
    }
    return this.syncProductsToSupabase(prods);
  },

  // Combos Promocionais
  getCombos() {
    const raw = localStorage.getItem(STORAGE_KEYS.COMBOS);
    let combos = DEFAULT_COMBOS;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) combos = parsed;
      } catch (e) {}
    }
    const catalogOrder = this.getCatalogOrder();
    return applyCatalogOrder(combos, catalogOrder.combos);
  },
  saveCombos(combos) {
    try {
      localStorage.setItem(STORAGE_KEYS.COMBOS, JSON.stringify(combos));
    } catch (e) {
      console.warn("[VIPDatabase] Erro ao salvar combos no localStorage:", e);
    }
    if (Array.isArray(combos)) {
      this.saveCatalogOrder({ combos: combos.map(c => c.id) });
    }
    return this.syncCombosToSupabase(combos);
  },

  // Pedidos em Tempo Real
  getOrders() {
    const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
    let orders = [];
    if (!raw) {
      orders = DEFAULT_ORDERS;
      this.saveOrders(orders);
    } else {
      try {
        orders = JSON.parse(raw);
      } catch (e) {
        orders = DEFAULT_ORDERS;
      }
    }

    return orders.map(order => {
      const id = order.id || order.orderId;
      const totalAmount = order.totalAmount ?? order.total ?? 0;
      const fulfillment = order.fulfillment || order.customer?.fulfillment || "Retirada";
      const paymentMethod = order.paymentMethod || order.customer?.payment || "Não informado";
      const cashChangeFor = order.cashChangeFor ?? order.customer?.change ?? null;
      let status = order.status || "novo";
      if (status === "preparando") status = "em_preparo";

      const timingType = order.timingType || "imediato";
      const scheduledDate = order.scheduledDate || null;
      const scheduledTime = order.scheduledTime || null;
      const scheduledDateTimeFormatted = order.scheduledDateTimeFormatted || null;
      const pixCode = order.pixCode || order.pix_code || null;

      return {
        ...order,
        id,
        orderId: id,
        totalAmount,
        total: totalAmount,
        fulfillment,
        paymentMethod,
        cashChangeFor,
        pixCode,
        status,
        timingType,
        scheduledDate,
        scheduledTime,
        scheduledDateTimeFormatted,
        customer: {
          ...order.customer,
          fulfillment,
          payment: paymentMethod,
          change: cashChangeFor
        }
      };
    });
  },
  saveOrders(orders) {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  },
  generateOrderId() {
    const orders = this.getOrders();
    let maxNum = 100;
    orders.forEach(o => {
      const match = String(o.id || o.orderId || "").match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxNum && num < 999999) maxNum = num;
      }
    });
    return `VIP-${maxNum + 1}`;
  },
  addOrder(order) {
    const orders = this.getOrders();
    const id = order.id || order.orderId || this.generateOrderId();
    const newOrder = {
      ...order,
      id,
      orderId: id,
      createdAt: order.createdAt || Date.now(),
      status: order.status || "novo",
      timingType: order.timingType || "imediato",
      scheduledDate: order.scheduledDate || null,
      scheduledTime: order.scheduledTime || null,
      scheduledDateTimeFormatted: order.scheduledDateTimeFormatted || null,
      pixCode: order.pixCode || null
    };
    orders.unshift(newOrder);
    this.saveOrders(orders);

    // Broadcast imediato para abas locais (Admin na mesma máquina/navegador)
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const bc = new BroadcastChannel("salgados_vip_bus");
        bc.postMessage({ type: "NEW_ORDER", order: newOrder });
        bc.close();
      } catch(e) {}
    }

    // Envia para a Nuvem Supabase
    this.pushOrderToSupabase(newOrder);
    return newOrder;
  },
  updateOrderStatus(orderId, newStatus, extraData) {
    const orders = this.getOrders();
    const order = orders.find(o => (o.id === orderId || o.orderId === orderId));
    if (order) {
      order.status = newStatus;
      if (extraData && typeof extraData === "object") {
        Object.assign(order, extraData);
      }
      if (!order.history) order.history = [];
      order.history.push({ status: newStatus, time: Date.now() });
      this.saveOrders(orders);
      this.pushOrderStatusToSupabase(orderId, newStatus, order.history);
    }
    return orders;
  },
  updateOrder(updatedOrder) {
    if (!updatedOrder || !updatedOrder.id) return null;
    const orders = this.getOrders();
    const idx = orders.findIndex(o => (o.id === updatedOrder.id || o.orderId === updatedOrder.id));
    if (idx >= 0) {
      orders[idx] = { ...orders[idx], ...updatedOrder };
      this.saveOrders(orders);
      return orders[idx];
    }
    return null;
  },
  markOrderPrinted(orderId) {
    const orders = this.getOrders();
    const order = orders.find(o => (o.id === orderId || o.orderId === orderId));
    if (order) {
      order.printed = true;
      order.printedAt = Date.now();
      this.saveOrders(orders);
      this.pushOrderPrintedToSupabase(orderId, order.printedAt);
    }
  },
  recordOrderWhatsAppNotification(orderId, templateKey, messageText) {
    const orders = this.getOrders();
    const order = orders.find(o => (o.id === orderId || o.orderId === orderId));
    if (order) {
      if (!order.whatsappNotifications) order.whatsappNotifications = [];
      const entry = {
        template: templateKey,
        sentAt: Date.now(),
        preview: (messageText || "").substring(0, 100)
      };
      order.whatsappNotifications.push(entry);
      order.lastWhatsAppSent = entry;
      this.saveOrders(orders);
    }
    return order;
  },

  // ==============================================================================
  // FECHAMENTO DE CAIXA & HISTÓRICO FINANCEIRO
  // ==============================================================================
  getCashClosings() {
    const raw = localStorage.getItem(STORAGE_KEYS.CASH_CLOSINGS);
    if (!raw) return [];
    try {
      return JSON.parse(raw) || [];
    } catch (e) {
      return [];
    }
  },
  saveCashClosing(closing) {
    if (!closing) return null;
    const closings = this.getCashClosings();
    const id = closing.id || `CX-${Date.now()}`;
    const dateStr = closing.dateStr || new Date().toISOString().split("T")[0];
    const closingRecord = {
      ...closing,
      id,
      dateStr,
      savedAt: Date.now()
    };

    const existingIdx = closings.findIndex(c => c.dateStr === dateStr);
    if (existingIdx >= 0) {
      closings[existingIdx] = closingRecord;
    } else {
      closings.unshift(closingRecord);
    }

    try {
      localStorage.setItem(STORAGE_KEYS.CASH_CLOSINGS, JSON.stringify(closings));
    } catch (e) {
      console.warn("[VIPDatabase] Erro ao salvar fechamento de caixa:", e);
    }

    this.syncCashClosingToSupabase(closingRecord);
    return closingRecord;
  },
  getCashClosingByDate(dateStr) {
    const closings = this.getCashClosings();
    return closings.find(c => c.dateStr === dateStr) || null;
  },
  async syncCashClosingToSupabase(record) {
    const sb = this.getClient();
    if (!sb) return;
    try {
      await sb.from("cash_closings").upsert({
        id: record.id,
        date_str: record.dateStr,
        total_revenue: record.totalRevenue,
        cash_total: record.cashTotal,
        pix_total: record.pixTotal,
        card_total: record.cardTotal,
        delivery_fees: record.deliveryFeesTotal,
        orders_count: record.ordersCount,
        fundo_troco: record.fundoTroco,
        sangrias: record.sangrias,
        dinheiro_esperado: record.dinheiroEsperado,
        dinheiro_contado: record.dinheiroContado,
        difference: record.difference,
        operator: record.operator,
        notes: record.notes,
        saved_at: record.savedAt,
        details: record
      });
    } catch (err) {
      // Ignora silenciosamente se a tabela remota opcional não existir
    }
  },

  // ==============================================================================
  // GESTÃO DE ENTREGADORES (MOTOBOYS)
  // ==============================================================================
  getMotoboys() {
    const raw = localStorage.getItem(STORAGE_KEYS.MOTOBOYS);
    if (!raw) {
      const defaultList = [
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
          createdAt: Date.now() - 86400000 * 5
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
          createdAt: Date.now() - 86400000 * 2
        }
      ];
      this.saveMotoboys(defaultList);
      return defaultList;
    }
    try {
      const list = JSON.parse(raw) || [];
      // Garante retrocompatibilidade para motoboys existentes
      return list.map(m => {
        let workDays = m.workDays;
        if (!Array.isArray(workDays) || workDays.length === 0) {
          workDays = [0, 1, 2, 3, 4, 5, 6];
        }
        return {
          ...m,
          workDays,
          dailyRate: typeof m.dailyRate === "number" ? m.dailyRate : (parseFloat(m.dailyRate) || 0.00),
          defaultFee: typeof m.defaultFee === "number" ? m.defaultFee : (parseFloat(m.defaultFee) || 7.00)
        };
      });
    } catch (e) {
      return [];
    }
  },
  saveMotoboys(list) {
    try {
      localStorage.setItem(STORAGE_KEYS.MOTOBOYS, JSON.stringify(list || []));
    } catch (e) {
      console.warn("[VIPDatabase] Erro ao salvar entregadores:", e);
    }
    return list;
  },
  getMotoboyById(id) {
    const list = this.getMotoboys();
    return list.find(m => m.id === id) || null;
  },
  addMotoboy(data) {
    const list = this.getMotoboys();
    const newId = `mb-${Date.now()}`;
    const workDays = Array.isArray(data.workDays) && data.workDays.length > 0 
      ? data.workDays.map(Number) 
      : [0, 1, 2, 3, 4, 5, 6];

    const motoboy = {
      id: newId,
      name: (data.name || "Novo Entregador").trim(),
      phone: (data.phone || "").trim(),
      vehicle: (data.vehicle || "").trim(),
      feeType: data.feeType || "fixed",
      dailyRate: typeof data.dailyRate === "number" ? data.dailyRate : (parseFloat(data.dailyRate) || 0.00),
      defaultFee: typeof data.defaultFee === "number" ? data.defaultFee : (parseFloat(data.defaultFee) || 7.00),
      workDays: workDays,
      pixKey: (data.pixKey || "").trim(),
      pixType: data.pixType || "Chave Aleatória",
      active: data.active !== false,
      notes: (data.notes || "").trim(),
      createdAt: Date.now()
    };
    list.push(motoboy);
    this.saveMotoboys(list);
    return motoboy;
  },
  updateMotoboy(id, data) {
    const list = this.getMotoboys();
    const idx = list.findIndex(m => m.id === id);
    if (idx >= 0) {
      const updatedWorkDays = Array.isArray(data.workDays) 
        ? data.workDays.map(Number) 
        : (list[idx].workDays || [0, 1, 2, 3, 4, 5, 6]);

      list[idx] = {
        ...list[idx],
        ...data,
        id,
        workDays: updatedWorkDays,
        dailyRate: data.dailyRate !== undefined 
          ? (typeof data.dailyRate === "number" ? data.dailyRate : (parseFloat(data.dailyRate) || 0.00))
          : (list[idx].dailyRate !== undefined ? list[idx].dailyRate : 0.00),
        defaultFee: data.defaultFee !== undefined 
          ? (typeof data.defaultFee === "number" ? data.defaultFee : (parseFloat(data.defaultFee) || 7.00))
          : (list[idx].defaultFee !== undefined ? list[idx].defaultFee : 7.00),
        updatedAt: Date.now()
      };
      this.saveMotoboys(list);
      return list[idx];
    }
    return null;
  },
  deleteMotoboy(id) {
    let list = this.getMotoboys();
    list = list.filter(m => m.id !== id);
    this.saveMotoboys(list);
    return true;
  },

  // ==============================================================================
  // CRM & HISTÓRICO DE CLIENTES
  // ==============================================================================
  getCustomersCRM() {
    const orders = this.getOrders();
    const rawSaved = localStorage.getItem(STORAGE_KEYS.CUSTOMERS_CRM);
    let savedRecords = {};
    if (rawSaved) {
      try { savedRecords = JSON.parse(rawSaved) || {}; } catch(e) {}
    }

    const customerMap = new Map();

    orders.forEach(o => {
      if (!o.customer) return;
      const rawPhone = (o.customer.phone || "").trim();
      const cleanPhone = rawPhone.replace(/\D/g, "");
      const rawName = (o.customer.name || "Cliente").trim();
      
      const key = cleanPhone.length >= 8 ? cleanPhone : rawName.toLowerCase();
      if (!key) return;

      if (!customerMap.has(key)) {
        customerMap.set(key, {
          id: key,
          name: rawName,
          phone: rawPhone,
          cleanPhone: cleanPhone,
          address: o.customer.address || "",
          orders: [],
          validOrdersCount: 0,
          totalSpent: 0,
          firstOrderDate: Number(o.createdAt) || Date.now(),
          lastOrderDate: Number(o.createdAt) || Date.now(),
          itemCounts: {}
        });
      }

      const c = customerMap.get(key);
      c.orders.push(o);

      if (o.status !== "cancelado") {
        c.validOrdersCount++;
        c.totalSpent += Number(o.totalAmount || o.total || 0);
      }

      const orderTime = Number(o.createdAt) || Date.now();
      if (orderTime < c.firstOrderDate) c.firstOrderDate = orderTime;
      if (orderTime > c.lastOrderDate) {
        c.lastOrderDate = orderTime;
        if (rawName && rawName !== "Cliente") c.name = rawName;
        if (o.customer.address) c.address = o.customer.address;
        if (rawPhone) c.phone = rawPhone;
      }

      (o.items || []).forEach(it => {
        const title = it.kitName || it.name || (it.type === "kit" ? "Kit de Salgados" : "Produto");
        c.itemCounts[title] = (c.itemCounts[title] || 0) + (Number(it.quantity) || 1);
      });
    });

    // Inclui também clientes cadastrados manualmente que ainda não possuem pedidos
    Object.entries(savedRecords).forEach(([savedId, rec]) => {
      const cleanP = (rec.phone || "").replace(/\D/g, "");
      const key = cleanP.length >= 8 ? cleanP : savedId;
      if (!customerMap.has(key) && !customerMap.has(savedId)) {
        customerMap.set(savedId, {
          id: savedId,
          name: rec.name || "Novo Cliente",
          phone: rec.phone || "",
          cleanPhone: cleanP,
          address: rec.address || "",
          orders: [],
          validOrdersCount: 0,
          totalSpent: 0,
          firstOrderDate: Number(rec.createdAt) || Date.now(),
          lastOrderDate: Number(rec.createdAt) || Date.now(),
          itemCounts: {}
        });
      }
    });

    const list = Array.from(customerMap.values()).map(c => {
      c.orders.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));

      const averageTicket = c.validOrdersCount > 0 ? (c.totalSpent / c.validOrdersCount) : 0;
      const daysSinceLastOrder = Math.max(0, Math.floor((Date.now() - c.lastOrderDate) / 86400000));

      let segment = "new";
      let segmentLabel = "Novo Cliente";
      let segmentBadgeClass = "badge-crm-new";

      if (c.validOrdersCount >= 5 || c.totalSpent >= 250) {
        segment = "vip";
        segmentLabel = "⭐ Cliente VIP";
        segmentBadgeClass = "badge-crm-vip";
      } else if (c.validOrdersCount >= 2) {
        segment = "recurrent";
        segmentLabel = "🟢 Recorrente";
        segmentBadgeClass = "badge-crm-recurrent";
      } else {
        segment = "new";
        segmentLabel = "🆕 Novo (1 Pedido)";
        segmentBadgeClass = "badge-crm-new";
      }

      const isInactive = daysSinceLastOrder >= 30;

      const favoriteItems = Object.entries(c.itemCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, qty]) => ({ name, qty }));

      const saved = savedRecords[c.id] || {};

      return {
        ...c,
        name: saved.name || c.name,
        phone: saved.phone || c.phone,
        address: saved.address || c.address,
        notes: saved.notes || "",
        customTag: saved.customTag || "",
        averageTicket,
        daysSinceLastOrder,
        segment,
        segmentLabel,
        segmentBadgeClass,
        isInactive,
        favoriteItems
      };
    });

    return list.sort((a, b) => b.lastOrderDate - a.lastOrderDate);
  },

  saveCustomerCRM(id, data) {
    if (!id) return false;
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMERS_CRM);
    let saved = {};
    if (raw) {
      try { saved = JSON.parse(raw) || {}; } catch(e) {}
    }
    saved[id] = {
      ...(saved[id] || {}),
      ...data,
      id,
      updatedAt: Date.now()
    };
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS_CRM, JSON.stringify(saved));
      return true;
    } catch(e) {
      console.warn("[VIPDatabase] Erro ao salvar dados de CRM do cliente:", e);
      return false;
    }
  },

  getCustomerByIdCRM(id) {
    const list = this.getCustomersCRM();
    return list.find(c => c.id === id || c.cleanPhone === id) || null;
  },

  // ==============================================================================
  // IDENTIFICAÇÃO E MEMÓRIA INTELIGENTE DO CLIENTE (ZERO SENHAS / 1 ÚNICA VEZ)
  // ==============================================================================
  getCustomerProfile() {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMER_PROFILE);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },
  saveCustomerProfile(profile) {
    if (!profile) return;
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOMER_PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.warn("[VIPDatabase] Erro ao salvar perfil do cliente:", e);
    }
  },
  clearCustomerProfile() {
    localStorage.removeItem(STORAGE_KEYS.CUSTOMER_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.CUSTOMER_LAST_ORDER);
  },
  getCustomerLastOrder() {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMER_LAST_ORDER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },
  saveCustomerLastOrder(order) {
    if (!order) return;
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOMER_LAST_ORDER, JSON.stringify(order));
    } catch (e) {
      console.warn("[VIPDatabase] Erro ao salvar último pedido do cliente:", e);
    }
  },
  async lookupCustomerByPhone(phone) {
    if (!phone) {
      return { found: false, message: "Por favor, digite o número do seu WhatsApp." };
    }
    const cleanDigits = phone.replace(/\D/g, "");
    if (cleanDigits.length < 10) {
      return { found: false, message: "Digite o DDD e o número completo (ex: 21 98765-4321)." };
    }

    // 1. Verificar perfil salvo localmente
    const localProfile = this.getCustomerProfile();
    if (localProfile && localProfile.phone && localProfile.phone.replace(/\D/g, "") === cleanDigits) {
      const lastOrder = this.getCustomerLastOrder();
      return { found: true, profile: localProfile, lastOrder: lastOrder };
    }

    // 2. Verificar histórico de pedidos local
    const orders = this.getOrders();
    const matchingOrder = orders.find(o => o.customer && o.customer.phone && o.customer.phone.replace(/\D/g, "") === cleanDigits);
    if (matchingOrder) {
      const profile = {
        name: matchingOrder.customer.name || "Cliente VIP",
        phone: matchingOrder.customer.phone || phone,
        cep: matchingOrder.customer.cep || "",
        street: matchingOrder.customer.street || "",
        number: matchingOrder.customer.number || "",
        neighborhood: matchingOrder.customer.neighborhood || "",
        city: matchingOrder.customer.city || "Nova Iguaçu",
        complement: matchingOrder.customer.complement || "",
        fulfillment: matchingOrder.fulfillment || "Entrega",
        lastUpdated: Date.now()
      };
      const lastOrder = {
        id: matchingOrder.id || matchingOrder.orderId,
        createdAt: matchingOrder.createdAt || Date.now(),
        dateFormatted: matchingOrder.createdAt ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(matchingOrder.createdAt)) : "Recente",
        items: matchingOrder.items || [],
        subtotal: matchingOrder.subtotal || 0,
        deliveryFee: matchingOrder.deliveryFee || 0,
        totalAmount: matchingOrder.totalAmount || matchingOrder.total || 0,
        fulfillment: matchingOrder.fulfillment || "Entrega"
      };
      this.saveCustomerProfile(profile);
      if (lastOrder.items.length > 0) {
        this.saveCustomerLastOrder(lastOrder);
      }
      return { found: true, profile, lastOrder };
    }

    // 3. Consultar no Supabase na nuvem se disponível
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb.from("orders").select("*").order("created_at", { ascending: false }).limit(60);
        if (!error && Array.isArray(data)) {
          const cloudMatch = data.find(o => o.customer && o.customer.phone && o.customer.phone.replace(/\D/g, "") === cleanDigits);
          if (cloudMatch) {
            const profile = {
              name: cloudMatch.customer.name || "Cliente VIP",
              phone: cloudMatch.customer.phone || phone,
              cep: cloudMatch.customer.cep || "",
              street: cloudMatch.customer.street || "",
              number: cloudMatch.customer.number || "",
              neighborhood: cloudMatch.customer.neighborhood || "",
              city: cloudMatch.customer.city || "Nova Iguaçu",
              complement: cloudMatch.customer.complement || "",
              fulfillment: cloudMatch.fulfillment || "Entrega",
              lastUpdated: Date.now()
            };
            const lastOrder = {
              id: cloudMatch.order_id || cloudMatch.id,
              createdAt: cloudMatch.created_at || Date.now(),
              dateFormatted: cloudMatch.created_at ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(cloudMatch.created_at)) : "Recente",
              items: cloudMatch.items || [],
              subtotal: Number(cloudMatch.subtotal) || 0,
              deliveryFee: Number(cloudMatch.delivery_fee) || 0,
              totalAmount: Number(cloudMatch.total_amount) || 0,
              fulfillment: cloudMatch.fulfillment || "Entrega"
            };
            this.saveCustomerProfile(profile);
            if (lastOrder.items.length > 0) {
              this.saveCustomerLastOrder(lastOrder);
            }
            return { found: true, profile, lastOrder };
          }
        }
      } catch (err) {
        console.warn("[VIPDatabase] Erro ao buscar pedidos por telefone no Supabase:", err);
      }
    }

    return { 
      found: false, 
      message: "Não encontramos pedidos anteriores com este número. Ao fazer seu primeiro pedido, seus dados serão salvos automaticamente!" 
    };
  },

  // Configurações de Impressão e Alertas
  getPrinterConfig() {
    const raw = localStorage.getItem(STORAGE_KEYS.PRINTER);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_PRINTER_CONFIG));
    try {
      const parsed = JSON.parse(raw);
      // Migração suave: se estiver configurado com bobina padrão 80mm com larguras legadas (70mm ou 75mm), atualiza para 76mm com margens 2mm & 2mm para economia máxima
      if ((!parsed.paperWidth || parsed.paperWidth === "80mm") && (parsed.printableWidthMm === 70 || parsed.printableWidthMm === 75 || !parsed.printableWidthMm)) {
        parsed.printableWidthMm = 76;
        if (parsed.marginSideMm === 4 || parsed.marginSideMm === 3 || !parsed.marginSideMm) {
          parsed.marginSideMm = 2;
        }
      }
      return { ...DEFAULT_PRINTER_CONFIG, ...parsed };
    } catch (e) {
      return DEFAULT_PRINTER_CONFIG;
    }
  },
  savePrinterConfig(cfg) {
    const merged = { ...DEFAULT_PRINTER_CONFIG, ...cfg };
    try {
      localStorage.setItem(STORAGE_KEYS.PRINTER, JSON.stringify(merged));
    } catch (e) {
      console.warn("[VIPDatabase] Erro ao salvar impressora no localStorage:", e);
    }
    return this.pushSettingToSupabase("printer", merged);
  },

  // Configurações e Cálculo de Taxa de Entrega por Distância / Região / Bairro
  getDeliveryConfig() {
    const raw = localStorage.getItem(STORAGE_KEYS.DELIVERY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_DELIVERY_CONFIG));
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.tiers || !Array.isArray(parsed.tiers) || parsed.tiers.length === 0) {
        parsed.tiers = DEFAULT_DELIVERY_TIERS;
      }
      if (!parsed.neighborhoods || !Array.isArray(parsed.neighborhoods) || parsed.neighborhoods.length === 0) {
        parsed.neighborhoods = DEFAULT_NEIGHBORHOODS;
      }
      if (!parsed.maxRadiusKm) parsed.maxRadiusKm = 15.0;
      if (!parsed.pricingMode) parsed.pricingMode = "distance";
      if (!parsed.defaultFee) parsed.defaultFee = 8.00;
      if (!parsed.storeCoords || Math.abs(parsed.storeCoords.lng - (-43.47254)) > 0.005) {
        parsed.storeCoords = { lat: -22.75735, lng: -43.47254 };
      }
      if (!parsed.googleMapsApiKey) parsed.googleMapsApiKey = "";
      if (parsed.neighborhoods && !parsed.neighborhoods.some(n => (n.name || "").toLowerCase().includes("engenho pequeno"))) {
        parsed.neighborhoods.push({ id: "bairro-engenho-pequeno", name: "Engenho Pequeno", city: "Nova Iguaçu", km: 6.4, fee: 14.00, eta: "25-35 min", active: true, lat: -22.7531, lng: -43.4235 });
      }
      if (parsed.neighborhoods) {
        const vigaRef = parsed.neighborhoods.find(n => (n.name || "").toLowerCase().trim() === "viga");
        if (vigaRef) {
          vigaRef.km = 5.6;
          vigaRef.fee = 11.00;
          vigaRef.lat = -22.7415;
          vigaRef.lng = -43.4445;
        }
      }
      return parsed;
    } catch (e) {
      return DEFAULT_DELIVERY_CONFIG;
    }
  },
  saveDeliveryConfig(cfg) {
    try {
      localStorage.setItem(STORAGE_KEYS.DELIVERY, JSON.stringify(cfg));
    } catch (e) {
      console.warn("[VIPDatabase] Erro ao salvar delivery no localStorage:", e);
    }
    return this.pushSettingToSupabase("delivery", cfg);
  },

  // Cálculo por Faixa de Distância (Km)
  calculateDeliveryFee(distanceKm) {
    const cfg = this.getDeliveryConfig();
    const km = parseFloat(distanceKm);
    const formatCurrency = (val) => val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    if (isNaN(km) || km <= 0) {
      const first = (cfg.tiers && cfg.tiers[0]) ? cfg.tiers[0] : { price: 5.00, maxKm: 2.0 };
      return {
        allowed: true,
        fee: first.price,
        tier: first,
        distanceKm: 1.0,
        formattedFee: formatCurrency(first.price),
        eta: first.eta || "20-30 min"
      };
    }

    const maxRad = parseFloat(cfg.maxRadiusKm) || 15.0;
    if (km > maxRad) {
      return {
        allowed: false,
        fee: 0,
        distanceKm: km,
        reason: `Distância de ${km.toFixed(1)} km excede o raio máximo atendido pela loja (${maxRad} km).`,
        formattedFee: "Fora da área",
        eta: "--"
      };
    }

    const sortedTiers = [...(cfg.tiers || [])].sort((a, b) => a.maxKm - b.maxKm);
    const matched = sortedTiers.find(t => km <= t.maxKm);
    if (matched) {
      return {
        allowed: true,
        fee: matched.price,
        tier: matched,
        distanceKm: km,
        formattedFee: formatCurrency(matched.price),
        eta: matched.eta || "25-35 min"
      };
    }

    const last = sortedTiers[sortedTiers.length - 1];
    const fee = last ? last.price : 26.00;
    return {
      allowed: true,
      fee: fee,
      tier: last,
      distanceKm: km,
      formattedFee: formatCurrency(fee),
      eta: last ? last.eta : "45-60 min"
    };
  },

  // Cálculo Inteligente por Bairro Digitado (Automático ao Digitar)
  calculateDeliveryByNeighborhoodOrText(neighborhoodInput, cityInput = "Nova Iguaçu") {
    const cfg = this.getDeliveryConfig();
    const formatCurrency = (val) => val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const rawText = (neighborhoodInput || "").trim();

    if (!rawText || rawText.length < 2) {
      return {
        allowed: true,
        matched: false,
        fee: 0,
        formattedFee: "R$ 0,00",
        distanceKm: null,
        eta: "",
        badgeText: "Digite seu bairro para calcular o frete",
        status: "empty"
      };
    }

    // Normalizador de texto (sem acentos e minúsculo)
    const norm = (str) => (str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const searchNorm = norm(rawText);
    const neighborhoods = cfg.neighborhoods || [];

    // 1. Tentar busca exata por nome
    let found = neighborhoods.find(n => norm(n.name) === searchNorm);

    // 2. Se não encontrou, tentar busca se o nome contém ou é contido
    if (!found) {
      found = neighborhoods.find(n => {
        const nNorm = norm(n.name);
        return nNorm.includes(searchNorm) || (searchNorm.length >= 3 && searchNorm.includes(nNorm));
      });
    }

    // 3. Se encontrou o bairro no catálogo
    if (found) {
      if (found.active === false) {
        return {
          allowed: false,
          matched: true,
          neighborhood: found,
          fee: 0,
          formattedFee: "Indisponível",
          distanceKm: found.km,
          reason: `No momento não atendemos entregas no bairro ${found.name}.`,
          badgeText: `Bairro ${found.name} indisponível no momento`,
          status: "unavailable"
        };
      }

      // Cálculo 100% dinâmico baseado na distância do bairro em relação à loja e nas faixas configuradas
      const distCalc = this.calculateDeliveryFee(found.km);
      if (!distCalc.allowed) {
        return {
          allowed: false,
          matched: true,
          neighborhood: found,
          fee: 0,
          formattedFee: "Fora da área",
          distanceKm: found.km,
          reason: distCalc.reason || `O bairro ${found.name} (~${found.km.toFixed(1)} km) ultrapassa o raio máximo de entrega de ${cfg.maxRadiusKm || 15} km.`,
          badgeText: `Bairro fora do raio máximo de atendimento (${found.km.toFixed(1)} km)`,
          status: "out_of_radius"
        };
      }

      return {
        allowed: true,
        matched: true,
        neighborhood: found,
        neighborhoodName: found.name,
        cityName: found.city || cityInput || "Nova Iguaçu",
        fee: distCalc.fee,
        formattedFee: distCalc.formattedFee,
        distanceKm: found.km,
        eta: distCalc.eta || found.eta || "25-35 min",
        tier: distCalc.tier,
        badgeText: `🛵 Entrega para ${found.name}: ${distCalc.formattedFee} (~${found.km.toFixed(1)} km • ${distCalc.eta || '25-35 min'})`,
        status: "matched"
      };
    }

    // 4. Bairro não cadastrado na lista de referência rápida: calcula pela faixa padrão estimada (~3.5 km)
    const fallbackCalc = this.calculateDeliveryFee(3.5);
    const defaultFee = fallbackCalc.fee;
    return {
      allowed: true,
      matched: false,
      neighborhoodName: rawText,
      cityName: cityInput || "Nova Iguaçu",
      fee: defaultFee,
      formattedFee: formatCurrency(defaultFee),
      distanceKm: 4.5,
      eta: fallbackCalc.eta || "25-35 min",
      tier: fallbackCalc.tier,
      badgeText: `🛵 Taxa de Entrega estimada: ${formatCurrency(defaultFee)} (${rawText})`,
      status: "default_fallback"
    };
  },

  // Cache em memória de distâncias calculadas por rota
  _routeDistanceCache: {},
  _gmapsLoadingPromise: null,

  // Carregador assíncrono do SDK Oficial do Google Maps JavaScript (com bibliotecas modernas)
  // Source: Google Maps Platform Code Assist
  loadGoogleMapsScript(apiKey) {
    if (window.google && window.google.maps) {
      return Promise.resolve(window.google.maps);
    }
    if (this._gmapsLoadingPromise) {
      return this._gmapsLoadingPromise;
    }
    const key = (apiKey || this.getDeliveryConfig().googleMapsApiKey || "").trim();
    if (!key) {
      return Promise.reject(new Error("Chave do Google Maps não informada"));
    }
    this._gmapsLoadingPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      if (existingScript) {
        existingScript.addEventListener("load", () => {
          if (window.google && window.google.maps) resolve(window.google.maps);
          else reject(new Error("Google Maps falhou na inicialização."));
        });
        existingScript.addEventListener("error", (e) => reject(e));
        return;
      }
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&libraries=routes,places,marker,geometry&loading=async`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google && window.google.maps) {
          resolve(window.google.maps);
        } else {
          reject(new Error("Google Maps carregado, mas objeto indisponível."));
        }
      };
      script.onerror = () => {
        this._gmapsLoadingPromise = null;
        reject(new Error("Erro de rede ao carregar Google Maps API."));
      };
      document.head.appendChild(script);
    });
    return this._gmapsLoadingPromise;
  },

  // Cálculo de Rota Real de Condução (Google Maps Routes API JS SDK ou OSRM/OpenStreetMap Calibrado)
  async calculateRealRouteDistance(params = {}) {
    const cfg = this.getDeliveryConfig();
    const storeCoords = cfg.storeCoords || { lat: -22.75735, lng: -43.47254 };
    const storeAddress = cfg.storeOriginAddress || "Rua Isabel Pedrosa, 31, Da Luz, Nova Iguaçu - RJ";

    const cep = (params.cep || "").replace(/\D/g, "");
    const street = (params.street || "").trim();
    const number = (params.number || "").trim();
    const neighborhood = (params.neighborhood || "").trim();
    const city = (params.city || "Nova Iguaçu").trim();

    // REGRA DE NEGÓCIO: O frete só é calculado após a digitação do número da residência!
    if (params.requireNumber && !number) {
      return {
        allowed: false,
        status: "waiting_number",
        fee: 0,
        formattedFee: "Informe o Nº",
        distanceKm: 0,
        duration: "Aguardando número",
        reason: "Digite o número da sua residência no campo acima para calcular o frete exato.",
        badgeText: "Aguardando número da residência"
      };
    }

    // Chave de cache precisa considerar o número da residência para evitar distâncias defasadas
    const cacheKey = `${street}|${number}|${neighborhood}|${city}|${cep}`.toLowerCase();
    if (this._routeDistanceCache[cacheKey]) {
      return this._routeDistanceCache[cacheKey];
    }

    let calculatedKm = null;
    let routeDuration = null;
    let sourceUsed = "fallback";
    let routePath = null;
    let destinationCoords = null;

    // Normalizador auxiliar de strings
    const norm = (str) => (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    // Identifica bairro no catálogo de referência de Nova Iguaçu
    let catalogRef = null;
    if (neighborhood) {
      const nNorm = norm(neighborhood);
      catalogRef = (cfg.neighborhoods || []).find(n => {
        const normItem = norm(n.name);
        return normItem === nNorm || normItem.includes(nNorm) || nNorm.includes(normItem);
      });
    }

    // =========================================================================
    // 1. Google Maps Platform: Routes API v2 via JS SDK Moderno (Sem bloqueio de CORS)
    // Source: Google Maps Platform Code Assist
    // =========================================================================
    if (cfg.googleMapsApiKey && cfg.googleMapsApiKey.trim().length > 10) {
      try {
        await this.loadGoogleMapsScript(cfg.googleMapsApiKey);
        if (window.google && window.google.maps && typeof google.maps.importLibrary === "function") {
          const { Route } = await google.maps.importLibrary("routes");
          if (Route && typeof Route.computeRoutes === "function") {
            const destParts = [];
            if (street) destParts.push(street + (number ? `, Nº ${number}` : ""));
            else if (number) destParts.push(`Nº ${number}`);
            if (neighborhood) destParts.push(neighborhood);
            destParts.push(city);
            destParts.push("RJ, Brasil");
            if (cep) destParts.push(`CEP ${cep}`);

            const request = {
              origin: { lat: storeCoords.lat, lng: storeCoords.lng },
              destination: destParts.join(", "),
              travelMode: "DRIVING",
              fields: ["path", "legs", "distanceMeters", "durationMillis", "viewport"],
              internalUsageAttributionIds: ["gmp_mcp_codeassist_v0.1_github"]
            };

            const response = await Route.computeRoutes(request);
            if (response && response.routes && response.routes.length > 0) {
              const r = response.routes[0];
              const leg = r.legs?.[0];
              const meters = leg?.distanceMeters ?? leg?.distance?.value;
              if (meters && meters > 0) {
                calculatedKm = Math.round((meters / 1000) * 10) / 10;
                const durMillis = leg?.durationMillis ?? (leg?.duration?.value ? leg.duration.value * 1000 : null);
                if (durMillis) {
                  const mins = Math.max(1, Math.round(durMillis / 60000));
                  routeDuration = `${mins} min`;
                }
                sourceUsed = "google_maps";
                if (r.path) {
                  routePath = r.path.map(p => ({
                    lat: typeof p.lat === "function" ? p.lat() : p.lat,
                    lng: typeof p.lng === "function" ? p.lng() : p.lng
                  }));
                  if (routePath.length > 0) {
                    destinationCoords = routePath[routePath.length - 1];
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("Google Maps Routes SDK falhou (chave inválida/cota), alternando para motor web:", err);
      }
    }

    // =========================================================================
    // 2. Motor de Rotas de Tráfego Real na Web (OSRM + Nominatim Geocoding Calibrado)
    // =========================================================================
    if (!calculatedKm) {
      try {
        let targetLat = null;
        let targetLng = null;

        // Se o bairro tem coordenadas oficiais mapeadas, guardamos como âncora prioritária
        if (catalogRef && catalogRef.lat && catalogRef.lng) {
          targetLat = catalogRef.lat;
          targetLng = catalogRef.lng;
        }

        // Variações e normalizações inteligentes do nome da rua (remove preposições e prefixos)
        const streetWithoutPrep = street
          .replace(/\b(do|da|dos|das|de)\b\s*/gi, "")
          .replace(/\s+/g, " ")
          .trim();

        const coreStreet = street
          .replace(/^(rua|avenida|av\.?|travessa|trav\.?|estrada|est\.?|rodovia|rod\.?|praca|praça|alameda|alam\.?)\s+/i, "")
          .trim();

        const coreStreetWithoutPrep = coreStreet
          .replace(/\b(do|da|dos|das|de)\b\s*/gi, "")
          .replace(/\s+/g, " ")
          .trim();

        // Constrói queries com restrição estrita de bairro para evitar homônimos (ex: Viga vs Ambaí)
        const queries = [];
        if (neighborhood) {
          if (number) {
            queries.push(`${street}, ${number}, ${neighborhood}, Nova Iguaçu, RJ, Brasil`);
            if (streetWithoutPrep && streetWithoutPrep !== street) {
              queries.push(`${streetWithoutPrep}, ${number}, ${neighborhood}, Nova Iguaçu, RJ, Brasil`);
            }
          }
          queries.push(`${street}, ${neighborhood}, Nova Iguaçu, RJ, Brasil`);
          if (streetWithoutPrep && streetWithoutPrep !== street) {
            queries.push(`${streetWithoutPrep}, ${neighborhood}, Nova Iguaçu, RJ, Brasil`);
          }
          if (coreStreetWithoutPrep && coreStreetWithoutPrep !== streetWithoutPrep) {
            queries.push(`${coreStreetWithoutPrep}, ${neighborhood}, Nova Iguaçu, RJ, Brasil`);
          }
          // Centroide do próprio bairro no OpenStreetMap como garantia local
          queries.push(`${neighborhood}, Nova Iguaçu, RJ, Brasil`);
        } else {
          if (street && number) queries.push(`${street}, ${number}, Nova Iguaçu, RJ, Brasil`);
          if (street) queries.push(`${street}, Nova Iguaçu, RJ, Brasil`);
        }

        const nNorm = neighborhood ? norm(neighborhood) : "";
        const otherBairros = (cfg.neighborhoods || [])
          .map(nb => norm(nb.name))
          .filter(nb => nb !== nNorm && nb.length >= 4);

        for (const q of queries) {
          try {
            const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=1&countrycodes=br`;
            const geoResp = await fetch(geoUrl, {
              headers: { "Accept": "application/json" }
            });
            if (geoResp.ok) {
              const geoArr = await geoResp.json();
              if (geoArr && geoArr.length > 0) {
                const item = geoArr[0];
                // Desconsiderar se o retorno for apenas o polígono/centroide do município inteiro
                if (item.addresstype === "municipality" || item.type === "administrative" || item.class === "boundary") {
                  continue;
                }

                // Validação de colisão de bairro: Se o cliente é Viga, rejeita se o item retornado for de outro bairro (ex: Ambaí)
                if (neighborhood) {
                  const itemDisplayName = norm(item.display_name);
                  const itemAddr = item.address || {};
                  const itemSuburb = norm(itemAddr.suburb || itemAddr.neighbourhood || itemAddr.quarter || itemAddr.district || "");

                  const isOtherBairro = otherBairros.some(ob =>
                    (itemSuburb && itemSuburb.includes(ob)) ||
                    (itemDisplayName.includes(ob) && !itemDisplayName.includes(nNorm))
                  );
                  if (isOtherBairro) {
                    continue; // Pula resultado homônimo de outro bairro!
                  }
                }

                const candLat = parseFloat(item.lat);
                const candLng = parseFloat(item.lon);
                // Sanity check: validar se está no quadrante geográfico da Baixada Fluminense / Nova Iguaçu (-22.88 a -22.58 lat, -43.65 a -43.30 lng)
                if (candLat >= -22.88 && candLat <= -22.58 && candLng >= -43.65 && candLng <= -43.30) {
                  targetLat = candLat;
                  targetLng = candLng;
                  break;
                }
              }
            }
          } catch (e) {}
        }

        // Se a busca por rua/número não obteve ponto GPS específico, mantém o centroide calibrado do bairro (ex: Viga)
        if ((!targetLat || !targetLng) && catalogRef && catalogRef.lat && catalogRef.lng) {
          targetLat = catalogRef.lat;
          targetLng = catalogRef.lng;
        }

        // Se encontrou coordenadas GPS de destino válidas, calcula rota real de condução via OSRM
        if (targetLat && targetLng) {
          destinationCoords = { lat: targetLat, lng: targetLng };
          try {
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${storeCoords.lng},${storeCoords.lat};${targetLng},${targetLat}?overview=full&geometries=geojson`;
            const osrmResp = await fetch(osrmUrl);
            if (osrmResp.ok) {
              const osrmData = await osrmResp.json();
              if (osrmData.code === "Ok" && osrmData.routes && osrmData.routes.length > 0) {
                const meters = osrmData.routes[0].distance;
                calculatedKm = Math.round((meters / 1000) * 10) / 10;
                const durSecs = osrmData.routes[0].duration;
                if (durSecs) {
                  routeDuration = `${Math.max(1, Math.round(durSecs / 60))} min`;
                }
                sourceUsed = "osrm_route";
                if (osrmData.routes[0].geometry?.coordinates) {
                  routePath = osrmData.routes[0].geometry.coordinates.map(coord => ({ lat: coord[1], lng: coord[0] }));
                }
              }
            }
          } catch (e) {}

          // Se OSRM falhar ou rate-limitar, aplica distância geodésica Haversine * fator urbano viário de Nova Iguaçu (1.28x)
          if (!calculatedKm) {
            const straightKm = this._haversineDistance(storeCoords.lat, storeCoords.lng, targetLat, targetLng);
            calculatedKm = Math.round((straightKm * 1.28) * 10) / 10;
            sourceUsed = "gps_haversine";
          }
        }
      } catch (err) {
        console.warn("Motor web de rotas indisponível:", err);
      }
    }

    // =========================================================================
    // 3. Fallback no Catálogo com distâncias reais mapeadas de Nova Iguaçu
    // =========================================================================
    if (!calculatedKm && catalogRef && catalogRef.km) {
      calculatedKm = catalogRef.km;
      sourceUsed = "catalog_reference";
      if (catalogRef.eta) routeDuration = catalogRef.eta;
      if (catalogRef.lat && catalogRef.lng) destinationCoords = { lat: catalogRef.lat, lng: catalogRef.lng };
    }

    if (!calculatedKm) {
      calculatedKm = 4.5;
      sourceUsed = "default_fallback";
    }

    const feeInfo = this.calculateDeliveryFee(calculatedKm);
    const result = {
      ...feeInfo,
      distanceKm: calculatedKm,
      duration: routeDuration || feeInfo.eta || "25-35 min",
      sourceUsed: sourceUsed,
      isRealRoute: (sourceUsed === "google_maps" || sourceUsed === "osrm_route"),
      destinationCoords: destinationCoords,
      routePath: routePath
    };

    this._routeDistanceCache[cacheKey] = result;
    return result;
  },

  // Distância esférica em km (Haversine)
  _haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  // CRUD de Bairros / Regiões
  addNeighborhood(bairroObj) {
    const cfg = this.getDeliveryConfig();
    if (!cfg.neighborhoods) cfg.neighborhoods = [];
    const newBairro = {
      id: "bairro-" + Date.now(),
      name: bairroObj.name.trim(),
      city: bairroObj.city ? bairroObj.city.trim() : "Nova Iguaçu",
      km: parseFloat(bairroObj.km) || 2.0,
      fee: parseFloat(bairroObj.fee) || 8.00,
      eta: bairroObj.eta ? bairroObj.eta.trim() : "25-35 min",
      active: bairroObj.active !== false,
      lat: parseFloat(bairroObj.lat) || null,
      lng: parseFloat(bairroObj.lng) || null
    };
    cfg.neighborhoods.push(newBairro);
    this.saveDeliveryConfig(cfg);
    return newBairro;
  },
  updateNeighborhood(id, bairroObj) {
    const cfg = this.getDeliveryConfig();
    const idx = (cfg.neighborhoods || []).findIndex(n => n.id === id);
    if (idx !== -1) {
      cfg.neighborhoods[idx] = {
        ...cfg.neighborhoods[idx],
        name: bairroObj.name.trim(),
        city: bairroObj.city ? bairroObj.city.trim() : "Nova Iguaçu",
        km: parseFloat(bairroObj.km) || cfg.neighborhoods[idx].km,
        fee: parseFloat(bairroObj.fee) ?? cfg.neighborhoods[idx].fee,
        eta: bairroObj.eta ? bairroObj.eta.trim() : cfg.neighborhoods[idx].eta,
        active: bairroObj.active !== false,
        lat: bairroObj.lat !== undefined ? parseFloat(bairroObj.lat) : cfg.neighborhoods[idx].lat,
        lng: bairroObj.lng !== undefined ? parseFloat(bairroObj.lng) : cfg.neighborhoods[idx].lng
      };
      this.saveDeliveryConfig(cfg);
      return cfg.neighborhoods[idx];
    }
    return null;
  },
  deleteNeighborhood(id) {
    const cfg = this.getDeliveryConfig();
    cfg.neighborhoods = (cfg.neighborhoods || []).filter(n => n.id !== id);
    this.saveDeliveryConfig(cfg);
  },

  // ==============================================================================
  // SINCRONIZAÇÃO E REALTIME COM O SUPABASE (BANCO DE DADOS EM NUVEM)
  // ==============================================================================
  initSupabase() {
    if (window._vipSupabaseInitPromise) return window._vipSupabaseInitPromise;
    window._vipSupabaseInitPromise = (async () => {
      const sb = getSupabaseClient();
      if (!sb) {
        console.info("[Supabase] Cliente não carregado ou offline. Operando em modo LocalStorage.");
        return false;
      }

      try {
        console.log("[Supabase] Conectando e sincronizando dados com a nuvem...");

        // 1. Configurações da Loja e Delivery
        const { data: settingsData } = await sb.from("store_settings").select("*");
        if (settingsData && settingsData.length > 0) {
          settingsData.forEach(row => {
            if (row.id === "config" && row.value) localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(row.value));
            if (row.id === "delivery" && row.value) localStorage.setItem(STORAGE_KEYS.DELIVERY, JSON.stringify(row.value));
            if (row.id === "printer" && row.value) localStorage.setItem(STORAGE_KEYS.PRINTER, JSON.stringify(row.value));
            if (row.id === "catalog_order" && row.value) localStorage.setItem(STORAGE_KEYS.CATALOG_ORDER, JSON.stringify(row.value));
            // Credenciais nunca são salvas localmente
            localStorage.removeItem(STORAGE_KEYS.AUTH);
          });
        }

        const activeCatalogOrder = this.getCatalogOrder();

        // 2. Kits
        const { data: kitsData } = await sb.from("kits").select("*");
        if (kitsData && kitsData.length > 0) {
          let mappedKits = kitsData.map(k => ({
            ...k,
            passo_quantidade: k.passo_quantidade || 10,
            image: (k.image && k.image.trim()) ? k.image : (DEFAULT_KITS.find(d => d.id === k.id)?.image || DEFAULT_IMAGE_PLACEHOLDERS.kit)
          }));
          mappedKits = applyCatalogOrder(mappedKits, activeCatalogOrder.kits);
          try { localStorage.setItem(STORAGE_KEYS.KITS, JSON.stringify(mappedKits)); } catch(e) {}
        }

        // 3. Sabores
        const { data: flavorsData } = await sb.from("flavors").select("*");
        if (flavorsData && flavorsData.length > 0) {
          let mappedFlavors = flavorsData.map(f => ({
            ...f,
            image: (f.image && f.image.trim()) ? f.image : (DEFAULT_FLAVORS.find(d => d.id === f.id)?.image || DEFAULT_IMAGE_PLACEHOLDERS.flavor)
          }));
          mappedFlavors = applyCatalogOrder(mappedFlavors, activeCatalogOrder.flavors);
          try { localStorage.setItem(STORAGE_KEYS.FLAVORS, JSON.stringify(mappedFlavors)); } catch(e) {}
        }

        // 4. Molhos
        const { data: saucesData } = await sb.from("sauces").select("*");
        if (saucesData && saucesData.length > 0) {
          let mappedSauces = saucesData.map(s => ({
            ...s,
            image: (s.image && s.image.trim()) ? s.image : (DEFAULT_SAUCES.find(d => d.id === s.id)?.image || (s.id === "sem-molho" ? "" : DEFAULT_IMAGE_PLACEHOLDERS.sauce))
          }));
          mappedSauces = applyCatalogOrder(mappedSauces, activeCatalogOrder.sauces);
          try { localStorage.setItem(STORAGE_KEYS.SAUCES, JSON.stringify(mappedSauces)); } catch(e) {}
        }

        // 5. Categorias
        const { data: catData } = await sb.from("categories").select("*");
        if (catData && catData.length > 0) {
          const orderedCats = applyCatalogOrder(catData, activeCatalogOrder.categories);
          try { localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(orderedCats)); } catch(e) {}
        }

        // 6. Produtos
        const { data: prodsData } = await sb.from("products").select("*");
        if (prodsData && prodsData.length > 0) {
          let mappedProds = prodsData.map(p => ({
            ...p,
            categoryId: p.category_id || p.categoryId,
            image: (p.image && p.image.trim()) ? p.image : (DEFAULT_PRODUCTS.find(d => d.id === p.id)?.image || DEFAULT_IMAGE_PLACEHOLDERS.product)
          }));
          mappedProds = applyCatalogOrder(mappedProds, activeCatalogOrder.products);
          try { localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(mappedProds)); } catch(e) {}
        }

        // 7. Combos
        const { data: combosData } = await sb.from("combos").select("*");
        if (combosData && combosData.length > 0) {
          let mappedCombos = combosData.map(c => ({
            ...c,
            regularPrice: parseFloat(c.regular_price || c.regularPrice || 0),
            price: parseFloat(c.price || 0),
            discountPercent: parseFloat(c.discount_percent || c.discountPercent || 0),
            image: (c.image && c.image.trim()) ? c.image : (DEFAULT_COMBOS.find(d => d.id === c.id)?.image || DEFAULT_IMAGE_PLACEHOLDERS.combo)
          }));
          mappedCombos = applyCatalogOrder(mappedCombos, activeCatalogOrder.combos);
          try { localStorage.setItem(STORAGE_KEYS.COMBOS, JSON.stringify(mappedCombos)); } catch(e) {}
        }

        // 8. Pedidos
        const { data: ordersData } = await sb.from("orders").select("*").order("created_at", { ascending: false });
        if (ordersData && ordersData.length > 0) {
          const mappedOrders = ordersData.map(o => ({
            ...o,
            id: o.id || o.order_id,
            orderId: o.order_id || o.id,
            createdAt: parseInt(o.created_at) || Date.now(),
            subtotal: parseFloat(o.subtotal || 0),
            deliveryFee: parseFloat(o.delivery_fee || 0),
            totalAmount: parseFloat(o.total_amount || 0),
            total: parseFloat(o.total_amount || 0),
            paymentMethod: o.payment_method,
            cashChangeFor: o.cash_change_for,
            pixCode: o.pix_code || o.pixCode || null,
            timingType: o.timing_type,
            scheduledDate: o.scheduled_date,
            scheduledTime: o.scheduled_time,
            scheduledDateTimeFormatted: o.scheduled_date_time_formatted,
            printedAt: o.printed_at ? parseInt(o.printed_at) : null
          }));
          localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(mappedOrders));
        }

        // 9. Registrar Canal Realtime no Supabase
        this.subscribeRealtimeOrders();

        window.dispatchEvent(new CustomEvent("vip_supabase_synced", { detail: { success: true } }));
        console.log("[Supabase] Sincronização inicial concluída com sucesso!");
        return true;
      } catch (err) {
        console.warn("[Supabase] Erro ao sincronizar dados com Supabase:", err);
        window._vipSupabaseInitPromise = null; // permite tentar novamente se falhou
        return false;
      }
    })();
    return window._vipSupabaseInitPromise;
  },

  subscribeRealtimeOrders() {
    const sb = getSupabaseClient();
    if (!sb || _supabaseChannel) return;

    try {
      _supabaseChannel = sb.channel("vip_realtime_orders")
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
          this.handleRealtimeOrderPayload(payload);
        })
        .subscribe((status) => {
          console.log("[Supabase Realtime] Status do canal:", status);
          window.dispatchEvent(new CustomEvent("vip_supabase_status", { detail: { status } }));
        });
    } catch (e) {
      console.warn("[Supabase Realtime] Falha ao assinar canal:", e);
    }
  },

  handleRealtimeOrderPayload(payload) {
    if (!payload) return;
    const { eventType, new: rowNew, old: rowOld } = payload;
    let orders = this.getOrders();

    if (eventType === "INSERT") {
      const order = {
        ...rowNew,
        id: rowNew.id || rowNew.order_id,
        orderId: rowNew.order_id || rowNew.id,
        createdAt: parseInt(rowNew.created_at) || Date.now(),
        subtotal: parseFloat(rowNew.subtotal || 0),
        deliveryFee: parseFloat(rowNew.delivery_fee || 0),
        totalAmount: parseFloat(rowNew.total_amount || 0),
        total: parseFloat(rowNew.total_amount || 0),
        paymentMethod: rowNew.payment_method,
        cashChangeFor: rowNew.cash_change_for,
        pixCode: rowNew.pix_code || rowNew.pixCode || null,
        timingType: rowNew.timing_type,
        scheduledDate: rowNew.scheduled_date,
        scheduledTime: rowNew.scheduled_time,
        scheduledDateTimeFormatted: rowNew.scheduled_date_time_formatted,
        printedAt: rowNew.printed_at ? parseInt(rowNew.printed_at) : null
      };

      if (!orders.some(o => o.id === order.id)) {
        orders.unshift(order);
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
        window.dispatchEvent(new CustomEvent("vip_order_received", { detail: order }));
        window.dispatchEvent(new CustomEvent("vip_orders_updated", { detail: { order, event: "INSERT" } }));
      }
    } else if (eventType === "UPDATE") {
      const idx = orders.findIndex(o => (o.id === rowNew.id || o.orderId === rowNew.id));
      if (idx !== -1) {
        orders[idx] = {
          ...orders[idx],
          ...rowNew,
          id: rowNew.id || rowNew.order_id,
          orderId: rowNew.order_id || rowNew.id,
          createdAt: parseInt(rowNew.created_at) || orders[idx].createdAt,
          subtotal: parseFloat(rowNew.subtotal ?? orders[idx].subtotal),
          deliveryFee: parseFloat(rowNew.delivery_fee ?? orders[idx].deliveryFee),
          totalAmount: parseFloat(rowNew.total_amount ?? orders[idx].totalAmount),
          total: parseFloat(rowNew.total_amount ?? orders[idx].total),
          paymentMethod: rowNew.payment_method || orders[idx].paymentMethod,
          cashChangeFor: rowNew.cash_change_for ?? orders[idx].cashChangeFor,
          timingType: rowNew.timing_type || orders[idx].timingType,
          scheduledDate: rowNew.scheduled_date ?? orders[idx].scheduledDate,
          scheduledTime: rowNew.scheduled_time ?? orders[idx].scheduledTime,
          scheduledDateTimeFormatted: rowNew.scheduled_date_time_formatted ?? orders[idx].scheduledDateTimeFormatted,
          printedAt: rowNew.printed_at ? parseInt(rowNew.printed_at) : orders[idx].printedAt
        };
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
        window.dispatchEvent(new CustomEvent("vip_orders_updated", { detail: { order: orders[idx], event: "UPDATE" } }));
      }
    } else if (eventType === "DELETE") {
      orders = orders.filter(o => o.id !== rowOld.id && o.orderId !== rowOld.id);
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
      window.dispatchEvent(new CustomEvent("vip_orders_updated", { detail: { id: rowOld.id, event: "DELETE" } }));
    }
  },

  pushSettingToSupabase(key, value) {
    const sb = getSupabaseClient();
    if (!sb) return Promise.resolve();
    return sb.from("store_settings").upsert({
      id: key,
      value: value,
      updated_at: new Date().toISOString()
    }).then(({ error }) => {
      if (error) {
        console.warn(`[Supabase] Erro ao salvar setting '${key}':`, error);
        throw error;
      }
    });
  },

  async pushOrderToSupabase(order) {
    const sb = getSupabaseClient();
    if (!sb) {
      console.warn("[Supabase] Cliente não inicializado para envio de pedido.");
      return null;
    }

    const payload = {
      id: order.id,
      order_id: order.orderId || order.id,
      created_at: order.createdAt || Date.now(),
      customer: order.customer || {},
      fulfillment: order.fulfillment || "Entrega",
      items: order.items || [],
      subtotal: parseFloat(order.subtotal || 0),
      delivery_fee: parseFloat(order.deliveryFee || 0),
      total_amount: parseFloat(order.totalAmount || order.total || 0),
      payment_method: order.paymentMethod || "Não informado",
      cash_change_for: order.cashChangeFor || null,
      pix_code: order.pixCode || null,
      delivery_man: order.deliveryMan || null,
      status: order.status || "novo",
      printed: !!order.printed,
      printed_at: order.printedAt || null,
      timing_type: order.timingType || "imediato",
      scheduled_date: order.scheduledDate || null,
      scheduled_time: order.scheduledTime || null,
      scheduled_date_time_formatted: order.scheduledDateTimeFormatted || null,
      history: order.history || []
    };

    try {
      const { data, error } = await sb.from("orders").upsert(payload).select().single();
      if (error) {
        console.warn("[Supabase] Aviso no envio do pedido, tentando payload seguro:", error);
        const safePayload = { ...payload };
        delete safePayload.pix_code;
        delete safePayload.delivery_man;
        const { data: fbData, error: fbErr } = await sb.from("orders").upsert(safePayload).select().single();
        if (fbErr) {
          console.error("[Supabase] Erro ao salvar pedido na nuvem:", fbErr);
          return null;
        }
        return fbData;
      }
      console.log("[Supabase] Pedido sincronizado na nuvem com sucesso:", order.id);
      return data;
    } catch (err) {
      console.error("[Supabase] Exceção ao salvar pedido na nuvem:", err);
      return null;
    }
  },

  async syncOrdersFromSupabase() {
    const sb = getSupabaseClient();
    if (!sb) return this.getOrders();

    try {
      const { data: ordersData, error } = await sb
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.warn("[Supabase] Falha ao sincronizar pedidos:", error);
        return this.getOrders();
      }

      if (ordersData && Array.isArray(ordersData)) {
        const localOrders = this.getOrders();
        const localMap = new Map(localOrders.map(o => [o.id, o]));
        let hasChanges = false;
        let newOrdersFound = [];

        ordersData.forEach(o => {
          const mapped = {
            ...o,
            id: o.id || o.order_id,
            orderId: o.order_id || o.id,
            createdAt: parseInt(o.created_at) || Date.now(),
            subtotal: parseFloat(o.subtotal || 0),
            deliveryFee: parseFloat(o.delivery_fee || 0),
            totalAmount: parseFloat(o.total_amount || 0),
            total: parseFloat(o.total_amount || 0),
            paymentMethod: o.payment_method,
            cashChangeFor: o.cash_change_for,
            pixCode: o.pix_code || o.pixCode || null,
            deliveryMan: o.delivery_man || o.deliveryMan || null,
            timingType: o.timing_type || "imediato",
            scheduledDate: o.scheduled_date,
            scheduledTime: o.scheduled_time,
            scheduledDateTimeFormatted: o.scheduled_date_time_formatted,
            printedAt: o.printed_at ? parseInt(o.printed_at) : null
          };

          if (!localMap.has(mapped.id)) {
            hasChanges = true;
            newOrdersFound.push(mapped);
            localMap.set(mapped.id, mapped);
          } else {
            const existing = localMap.get(mapped.id);
            if (existing.status !== mapped.status || (mapped.deliveryMan && !existing.deliveryMan)) {
              hasChanges = true;
              localMap.set(mapped.id, { ...existing, ...mapped });
            }
          }
        });

        if (hasChanges) {
          const mergedList = Array.from(localMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(mergedList));

          if (newOrdersFound.length > 0) {
            newOrdersFound.forEach(newOrd => {
              window.dispatchEvent(new CustomEvent("vip_order_received", { detail: newOrd }));
            });
          }
          window.dispatchEvent(new CustomEvent("vip_orders_updated", { detail: { event: "SYNC" } }));
        }
      }
      return this.getOrders();
    } catch (e) {
      console.warn("[Supabase] Erro ao sincronizar pedidos:", e);
      return this.getOrders();
    }
  },

  pushOrderStatusToSupabase(orderId, status, history, deliveryMan) {
    const sb = getSupabaseClient();
    if (!sb) return;
    const updates = {
      status: status,
      history: history || []
    };
    if (deliveryMan !== undefined) {
      updates.delivery_man = deliveryMan;
    }
    sb.from("orders").update(updates).eq("id", orderId).then(({ error }) => {
      if (error) console.warn("[Supabase] Erro ao atualizar status:", error);
    });
  },

  pushOrderPrintedToSupabase(orderId, printedAt) {
    const sb = getSupabaseClient();
    if (!sb) return;
    sb.from("orders").update({
      printed: true,
      printed_at: printedAt || Date.now()
    }).eq("id", orderId).then(({ error }) => {
      if (error) console.warn("[Supabase] Erro ao marcar impresso:", error);
    });
  },

  syncKitsToSupabase(kits) {
    const sb = getSupabaseClient();
    if (!sb || !Array.isArray(kits)) return Promise.resolve();
    return sb.from("kits").upsert(kits.map(k => ({
      id: k.id,
      name: k.name,
      quantity: k.quantity,
      price: k.price,
      passo_quantidade: k.passo_quantidade || 10,
      active: k.active !== false,
      image: k.image || null
    }))).then(({ error }) => {
      if (error) {
        console.warn("[Supabase] Erro ao salvar kits:", error);
        throw error;
      }
    });
  },

  syncFlavorsToSupabase(flavors) {
    const sb = getSupabaseClient();
    if (!sb || !Array.isArray(flavors)) return Promise.resolve();
    return sb.from("flavors").upsert(flavors.map(f => ({
      id: f.id,
      name: f.name,
      adicional_por_10: f.adicional_por_10,
      limite_quantidade: f.limite_quantidade,
      active: f.active !== false,
      image: f.image || null
    }))).then(({ error }) => {
      if (error) {
        console.warn("[Supabase] Erro ao salvar sabores:", error);
        throw error;
      }
    });
  },

  syncSaucesToSupabase(sauces) {
    const sb = getSupabaseClient();
    if (!sb || !Array.isArray(sauces)) return Promise.resolve();
    return sb.from("sauces").upsert(sauces.map(s => ({
      id: s.id,
      name: s.name,
      price: s.price,
      active: s.active !== false,
      image: s.image || null
    }))).then(({ error }) => {
      if (error) {
        console.warn("[Supabase] Erro ao salvar molhos:", error);
        throw error;
      }
    });
  },

  syncCategoriesToSupabase(categories) {
    const sb = getSupabaseClient();
    if (!sb || !Array.isArray(categories)) return Promise.resolve();
    return sb.from("categories").upsert(categories.map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon || "fa-box",
      description: c.description || "",
      active: c.active !== false
    }))).then(({ error }) => {
      if (error) {
        console.warn("[Supabase] Erro ao salvar categorias:", error);
        throw error;
      }
    });
  },

  syncProductsToSupabase(products) {
    const sb = getSupabaseClient();
    if (!sb || !Array.isArray(products)) return Promise.resolve();
    return sb.from("products").upsert(products.map(p => ({
      id: p.id,
      category_id: p.categoryId,
      name: p.name,
      price: p.price,
      description: p.description || "",
      active: p.active !== false,
      image: p.image || null
    }))).then(({ error }) => {
      if (error) {
        console.warn("[Supabase] Erro ao salvar produtos:", error);
        throw error;
      }
    });
  },

  syncCombosToSupabase(combos) {
    const sb = getSupabaseClient();
    if (!sb || !Array.isArray(combos)) return Promise.resolve();
    return sb.from("combos").upsert(combos.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description || "",
      badge: c.badge || "",
      items: c.items || [],
      regular_price: c.regularPrice,
      price: c.price,
      discount_percent: c.discountPercent || 0,
      active: c.active !== false,
      image: c.image || null
    }))).then(({ error }) => {
      if (error) {
        console.warn("[Supabase] Erro ao salvar combos:", error);
        throw error;
      }
    });
  },

  // Upload direto para o Banco de Imagens do Supabase Storage
  async uploadImageToSupabase(fileOrBlob, prefix = "item") {
    const sb = getSupabaseClient();
    if (!sb) throw new Error("Cliente Supabase não está inicializado.");

    if (!fileOrBlob) return "";

    // Se já é uma URL HTTP/HTTPS (ex: já hospedada no Supabase ou Unsplash), não precisa reenviar
    if (typeof fileOrBlob === "string") {
      if (fileOrBlob.startsWith("http://") || fileOrBlob.startsWith("https://")) {
        return fileOrBlob;
      }
    }

    let blob = fileOrBlob;
    let mimeType = "image/jpeg";

    if (typeof fileOrBlob === "string" && fileOrBlob.startsWith("data:")) {
      const parts = fileOrBlob.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);
      mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      blob = new Blob([u8arr], { type: mimeType });
    } else if (fileOrBlob && fileOrBlob.type) {
      mimeType = fileOrBlob.type;
    }

    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const cleanPrefix = (prefix || "item").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    const filePath = `${cleanPrefix}_${timestamp}_${random}.${ext}`;

    const { data, error } = await sb.storage
      .from("cardapio-images")
      .upload(filePath, blob, {
        cacheControl: "31536000",
        upsert: true,
        contentType: mimeType
      });

    if (error) {
      console.error("[Supabase Storage] Erro no upload:", error);
      throw error;
    }

    const { data: urlData } = sb.storage
      .from("cardapio-images")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  },

  async testSupabaseConnection() {
    const sb = getSupabaseClient();
    if (!sb) {
      return { success: false, message: "Cliente Supabase não está inicializado." };
    }
    try {
      const { data, error } = await sb.from("orders").select("id").limit(1);
      if (error) {
        return { success: false, message: error.message };
      }
      return { success: true, message: "Conectado ao Supabase com sucesso!", data };
    } catch (e) {
      return { success: false, message: e.message };
    }
  },

  // Restaurar dados originais de fábrica
  resetAll() {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(DEFAULT_CONFIG));
    localStorage.setItem(STORAGE_KEYS.KITS, JSON.stringify(DEFAULT_KITS));
    localStorage.setItem(STORAGE_KEYS.FLAVORS, JSON.stringify(DEFAULT_FLAVORS));
    localStorage.setItem(STORAGE_KEYS.SAUCES, JSON.stringify(DEFAULT_SAUCES));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
    localStorage.setItem(STORAGE_KEYS.COMBOS, JSON.stringify(DEFAULT_COMBOS));
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(DEFAULT_ORDERS));
    localStorage.setItem(STORAGE_KEYS.PRINTER, JSON.stringify(DEFAULT_PRINTER_CONFIG));
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    localStorage.setItem(STORAGE_KEYS.DELIVERY, JSON.stringify(DEFAULT_DELIVERY_CONFIG));
  }
};
