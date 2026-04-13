/**
 * NearbyPlace seed data for all 8 port areas.
 * Distances are approximate walking distances from the main marina.
 * Ratings from public sources (Google Maps, TripAdvisor) as of early 2026.
 */

export interface NearbyPlaceSeed {
  portAreaSlug: string;
  marinaSlug?: string; // if marina-specific
  name: string;
  category: string;
  subcategory?: string;
  description?: string;
  address?: string;
  phone?: string;
  hours?: string;
  distanceMeters?: number;
  walkMinutes?: number;
  rating?: number;
  reviewCount?: number;
  priceLevel?: string;
  isRecommended?: boolean;
  bestFor?: string;
  sourceName?: string;
  confidence?: string;
  notes?: string;
}

export const NEARBY_PLACES: NearbyPlaceSeed[] = [
  // ═══════ GIJÓN ═══════
  // Restaurants
  { portAreaSlug: "gijon", name: "Restaurante Auga", category: "restaurant", description: "Michelin-recommended creative seafood with marina views.", phone: "+34 985 168 186", hours: "13:30-16:00, 20:30-23:00", address: "Marina, Claudio Alvargonzález", distanceMeters: 100, walkMinutes: 1, rating: 4.4, reviewCount: 520, priceLevel: "$$$", isRecommended: true, bestFor: "special dinner", sourceName: "Google Maps", confidence: "curated" },
  { portAreaSlug: "gijon", name: "La Galana", category: "restaurant", description: "Traditional Asturian cuisine in old town. Famous for fabada.", phone: "+34 985 172 429", hours: "12:00-16:00, 19:30-23:30", address: "Plaza Mayor 10", distanceMeters: 800, walkMinutes: 10, rating: 4.5, reviewCount: 890, priceLevel: "$$", bestFor: "traditional dinner", sourceName: "Google Maps", confidence: "curated" },
  { portAreaSlug: "gijon", name: "Sidrería Tierra Astur", category: "restaurant", subcategory: "cider_house", description: "Authentic cider house on Cider Boulevard. Cheese boards.", phone: "+34 985 350 424", hours: "12:00-00:00", address: "C/ Gascona 1", distanceMeters: 900, walkMinutes: 12, rating: 4.3, reviewCount: 2100, priceLevel: "$$", isRecommended: true, bestFor: "local experience", sourceName: "Google Maps", confidence: "curated" },
  { portAreaSlug: "gijon", name: "El Puerto", category: "restaurant", description: "Waterfront seafood, fresh catch. Reasonable prices.", phone: "+34 985 340 996", hours: "13:00-16:00, 20:00-23:30", address: "Av. Claudio Alvargonzález", distanceMeters: 200, walkMinutes: 3, rating: 4.2, reviewCount: 340, priceLevel: "$$", bestFor: "quick waterfront meal", sourceName: "Google Maps", confidence: "curated" },
  // Chandlery
  { portAreaSlug: "gijon", marinaSlug: "puerto-deportivo-gijon", name: "REPNAVAL", category: "chandlery", description: "Since 1968. Full sailing gear, electronics, safety equipment.", phone: "+34 985 327 580", hours: "09:30-13:30, 16:30-20:00", address: "C/ Marqués de San Esteban 14", distanceMeters: 600, walkMinutes: 8, sourceName: "Local knowledge", confidence: "curated" },
  { portAreaSlug: "gijon", marinaSlug: "puerto-deportivo-gijon", name: "Astur-Náutica", category: "chandlery", subcategory: "sailmaker", description: "Chandlery at marina. Repairs, sailmaker, rigging.", phone: "+34 985 151 616", hours: "10:00-14:00, 17:00-20:00", address: "Puerto Deportivo", distanceMeters: 50, walkMinutes: 1, isRecommended: true, sourceName: "Local knowledge", confidence: "curated" },
  // Grocery
  { portAreaSlug: "gijon", name: "Mercadona", category: "grocery", description: "Large supermarket, good provisions.", hours: "09:00-21:30", address: "C/ Velázquez 54", distanceMeters: 1200, walkMinutes: 15, sourceName: "Google Maps", confidence: "curated" },
  { portAreaSlug: "gijon", name: "Carrefour Express", category: "grocery", description: "City-center convenience store.", hours: "08:00-22:00", address: "C/ Corrida 35", distanceMeters: 700, walkMinutes: 9, sourceName: "Google Maps", confidence: "curated" },
  // Services
  { portAreaSlug: "gijon", name: "Farmacia Marina", category: "pharmacy", hours: "09:30-21:30", address: "Near marina", distanceMeters: 400, walkMinutes: 5, confidence: "estimated" },
  { portAreaSlug: "gijon", name: "ATM CaixaBank", category: "atm", address: "Av. Claudio Alvargonzález", distanceMeters: 300, walkMinutes: 4, confidence: "estimated" },
  { portAreaSlug: "gijon", name: "Lavandería Express", category: "laundry", hours: "08:00-22:00", address: "C/ Corrida area", distanceMeters: 800, walkMinutes: 10, confidence: "estimated" },

  // ═══════ LUARCA ═══════
  { portAreaSlug: "luarca", name: "La Dársena de Luarca", category: "restaurant", description: "Waterfront dining, fresh local catch. Merluza a la sidra.", phone: "+34 985 470 672", hours: "13:00-16:00, 20:00-23:00", address: "Paseo del Muelle 11", distanceMeters: 100, walkMinutes: 1, rating: 4.2, reviewCount: 736, priceLevel: "$$", isRecommended: true, bestFor: "waterfront dinner", sourceName: "Google Maps", confidence: "curated" },
  { portAreaSlug: "luarca", name: "La Mariña de Luarca", category: "restaurant", description: "Traditional Asturian. Cozy atmosphere.", phone: "+34 985 640 115", hours: "12:30-16:00, 20:00-23:00", address: "C/ Rivero 14", distanceMeters: 300, walkMinutes: 4, rating: 4.4, reviewCount: 119, priceLevel: "$$", sourceName: "Google Maps", confidence: "curated" },
  { portAreaSlug: "luarca", name: "Alimerka", category: "grocery", description: "Local supermarket, good fresh produce.", hours: "09:00-21:00", address: "C/ Crucero 2", distanceMeters: 400, walkMinutes: 5, sourceName: "Google Maps", confidence: "curated" },
  { portAreaSlug: "luarca", name: "Farmacia Luarca", category: "pharmacy", hours: "09:30-21:00", address: "Town center", distanceMeters: 350, walkMinutes: 4, confidence: "estimated" },

  // ═══════ RIBADEO ═══════
  { portAreaSlug: "ribadeo", name: "Restaurante Marinero", category: "restaurant", description: "Fresh Galician seafood. Excellent pulpo and percebes.", phone: "+34 982 130 218", hours: "Tue-Sun 08:00-23:00", address: "C/ San Roque 12", distanceMeters: 500, walkMinutes: 6, rating: 4.3, reviewCount: 280, priceLevel: "$$", sourceName: "Google Maps", confidence: "curated" },
  { portAreaSlug: "ribadeo", name: "Gadis", category: "grocery", description: "Regional supermarket.", hours: "09:00-21:30", address: "Town center", distanceMeters: 600, walkMinutes: 8, sourceName: "Google Maps", confidence: "curated" },
  { portAreaSlug: "ribadeo", name: "Farmacia Ribadeo", category: "pharmacy", hours: "09:30-21:00", address: "C/ San Roque", distanceMeters: 500, walkMinutes: 6, confidence: "estimated" },

  // ═══════ VIVEIRO ═══════
  { portAreaSlug: "viveiro", name: "Restaurante Nito", category: "restaurant", description: "Highly rated Galician cuisine. Try the empanada.", phone: "+34 982 560 987", hours: "13:00-16:00, 20:30-23:00", address: "Av. Cervantes", distanceMeters: 800, walkMinutes: 10, rating: 4.5, reviewCount: 320, priceLevel: "$$", isRecommended: true, sourceName: "Google Maps", confidence: "curated" },
  { portAreaSlug: "viveiro", name: "Gadis Viveiro", category: "grocery", hours: "09:00-21:30", address: "Town center", distanceMeters: 1000, walkMinutes: 12, confidence: "curated" },
  { portAreaSlug: "viveiro", name: "Farmacia Viveiro", category: "pharmacy", hours: "09:30-21:00", address: "Av. Cervantes", distanceMeters: 900, walkMinutes: 11, confidence: "estimated" },

  // ═══════ CEDEIRA ═══════
  { portAreaSlug: "cedeira", name: "Bar Náutico", category: "restaurant", description: "Simple harbor-side bar. Fresh fish.", hours: "12:00-23:00", address: "Puerto de Cedeira", distanceMeters: 100, walkMinutes: 1, rating: 4.0, priceLevel: "$", sourceName: "Local knowledge", confidence: "curated" },
  { portAreaSlug: "cedeira", name: "Supermercado Cedeira", category: "grocery", hours: "09:00-21:00", address: "Town center", distanceMeters: 500, walkMinutes: 6, confidence: "estimated" },

  // ═══════ FERROL ═══════
  { portAreaSlug: "ferrol", name: "A Gabeira", category: "restaurant", description: "Excellent Galician cuisine. Famous for caldeirada.", phone: "+34 981 351 447", hours: "13:00-16:00, 20:30-23:00", address: "C/ Dolores 44", distanceMeters: 1200, walkMinutes: 15, rating: 4.4, reviewCount: 450, priceLevel: "$$", isRecommended: true, sourceName: "Google Maps", confidence: "curated" },
  { portAreaSlug: "ferrol", name: "Mercadona Ferrol", category: "grocery", hours: "09:00-21:30", address: "C/ Real", distanceMeters: 1500, walkMinutes: 18, sourceName: "Google Maps", confidence: "curated" },
  { portAreaSlug: "ferrol", name: "Farmacia Ferrol", category: "pharmacy", hours: "09:30-21:00", address: "C/ Real", distanceMeters: 1400, walkMinutes: 17, confidence: "estimated" },

  // ═══════ LA CORUÑA ═══════
  { portAreaSlug: "la-coruna", marinaSlug: "marina-coruna", name: "Adega O Bebedeiro", category: "restaurant", description: "Outstanding Galician cuisine. Excellent wine cellar. Reservations recommended.", phone: "+34 981 210 609", hours: "13:30-15:30, 21:00-23:00", address: "C/ Angel Rebollo 34", distanceMeters: 800, walkMinutes: 10, rating: 4.5, reviewCount: 680, priceLevel: "$$$", isRecommended: true, bestFor: "special dinner", sourceName: "Google Maps", confidence: "curated" },
  { portAreaSlug: "la-coruna", marinaSlug: "marina-coruna", name: "Pablo Gallego", category: "restaurant", description: "Michelin-recommended. Creative Galician with harbor views.", phone: "+34 981 208 888", hours: "13:30-15:30, 21:00-23:00", address: "Av. de la Marina", distanceMeters: 400, walkMinutes: 5, rating: 4.6, reviewCount: 520, priceLevel: "$$$", sourceName: "Google Maps", confidence: "curated" },
  { portAreaSlug: "la-coruna", name: "Mesón do Pulpo", category: "restaurant", description: "Best pulpo in town. Simple but excellent. No reservations.", phone: "+34 981 201 147", hours: "12:00-16:00, 19:30-23:00", address: "C/ Franja 9-11", distanceMeters: 1000, walkMinutes: 12, rating: 4.1, reviewCount: 890, priceLevel: "$", bestFor: "quick cheap lunch", sourceName: "Google Maps", confidence: "curated" },
  { portAreaSlug: "la-coruna", marinaSlug: "marina-coruna", name: "Tienda del Mar", category: "chandlery", description: "4000+ nautical products. Charts, electronics, safety.", phone: "+34 981 228 420", hours: "10:00-14:00, 16:30-20:00", address: "Av. de la Marina", distanceMeters: 500, walkMinutes: 6, isRecommended: true, sourceName: "Local knowledge", confidence: "curated" },
  { portAreaSlug: "la-coruna", name: "Naval Chicolino", category: "chandlery", description: "Ropes, cables, marine safety equipment.", phone: "+34 981 205 658", hours: "09:00-13:30, 16:00-19:30", address: "Muelle de San Diego", distanceMeters: 300, walkMinutes: 4, sourceName: "Local knowledge", confidence: "curated" },
  { portAreaSlug: "la-coruna", marinaSlug: "marina-coruna", name: "Mercadona", category: "grocery", description: "Large supermarket for provisioning.", hours: "09:00-21:30", address: "C/ Juan Flórez", distanceMeters: 1200, walkMinutes: 15, sourceName: "Google Maps", confidence: "curated" },
  { portAreaSlug: "la-coruna", name: "Mercado de San Agustín", category: "market", description: "Traditional market. Fresh fish, meat, local cheeses.", hours: "Mon-Sat 08:00-15:00", address: "C/ San Agustín", distanceMeters: 900, walkMinutes: 11, rating: 4.3, reviewCount: 320, isRecommended: true, bestFor: "fresh provisioning", sourceName: "Google Maps", confidence: "curated" },
  { portAreaSlug: "la-coruna", name: "Farmacia Marina", category: "pharmacy", hours: "09:30-21:30", address: "Near marina", distanceMeters: 400, walkMinutes: 5, confidence: "estimated" },
  { portAreaSlug: "la-coruna", name: "ATM Santander", category: "atm", address: "Av. de la Marina", distanceMeters: 300, walkMinutes: 4, confidence: "estimated" },
  { portAreaSlug: "la-coruna", name: "Lavandería La Marina", category: "laundry", hours: "08:00-22:00", address: "C/ San Andrés", distanceMeters: 700, walkMinutes: 9, confidence: "estimated" },
  { portAreaSlug: "la-coruna", name: "Hospital Universitario A Coruña", category: "hospital", phone: "+34 981 178 000", address: "Jubias de Arriba", distanceMeters: 5000, walkMinutes: 60, notes: "Major hospital. Taxi recommended.", confidence: "official" },

  // ═══════ SADA ═══════
  { portAreaSlug: "sada", name: "O Cuncheiro", category: "restaurant", description: "Excellent seafood on the beach. Fresh percebes.", phone: "+34 981 620 823", hours: "13:00-16:00, 21:00-23:00", address: "Playa de Sada", distanceMeters: 300, walkMinutes: 4, rating: 4.4, reviewCount: 210, priceLevel: "$$", isRecommended: true, sourceName: "Google Maps", confidence: "curated" },
  { portAreaSlug: "sada", name: "Gadis Sada", category: "grocery", hours: "09:00-21:30", address: "C/ Marina", distanceMeters: 400, walkMinutes: 5, confidence: "curated" },
];
