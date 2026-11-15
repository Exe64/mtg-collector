import { z } from 'zod';

const FINISHES = ['nonfoil', 'foil', 'etched'];
const CONDITIONS = ['MT', 'NM', 'EX', 'GD', 'LP', 'PL', 'PO'];

export const collectionAddSchema = z.object({
  scryfall_id: z.guid({ message: 'scryfall_id invalide' }),
  quantity: z.coerce.number().int().min(1, 'quantité ≥ 1').default(1),
  finish: z.enum(FINISHES).optional(),
  foil: z.boolean().optional(),
  condition: z.enum(CONDITIONS, { message: 'condition invalide' }).default('NM'),
  language: z.string().min(2).max(5).default('en'),
  location: z.string().max(100).default(''),
  acquired_price: z.coerce.number().nonnegative().nullish(),
  notes: z.string().max(2000).nullish(),
});

export const collectionAdjustSchema = z.object({
  scryfall_id: z.guid({ message: 'scryfall_id invalide' }),
  delta: z.coerce.number().int().refine((d) => d !== 0, 'delta invalide'),
  finish: z.enum(FINISHES).default('nonfoil'),
  condition: z.enum(CONDITIONS).default('NM'),
  language: z.string().min(2).max(5).default('en'),
  location: z.string().max(100).default(''),
});

export const collectionPatchSchema = z.object({
  quantity: z.coerce.number().int().min(1).optional(),
  finish: z.enum(FINISHES).optional(),
  condition: z.enum(CONDITIONS).optional(),
  language: z.string().min(2).max(5).optional(),
  location: z.string().max(100).optional(),
  acquired_price: z.coerce.number().nonnegative().nullish(),
  acquired_at: z.iso.date({ message: 'date d\'acquisition invalide (AAAA-MM-JJ)' }).nullish(),
  notes: z.string().max(2000).nullish(),
}).refine((o) => Object.values(o).some((v) => v !== undefined), {
  message: 'aucun champ à modifier',
});

export const collectionBulkSchema = z.object({
  ids: z.array(z.coerce.number().int()).min(1, 'aucune carte sélectionnée'),
  patch: z.object({
    finish: z.enum(FINISHES).optional(),
    condition: z.enum(CONDITIONS).optional(),
    language: z.string().min(2).max(5).optional(),
    location: z.string().max(100).optional(),
  }).refine((o) => Object.keys(o).length > 0, { message: 'aucun champ à modifier' }),
});

// --- Decks (plan #31) ------------------------------------------------------
// Clés des légalités Scryfall ; `casual` : aucun contrôle.
export const DECK_FORMATS = [
  'commander', 'standard', 'pioneer', 'modern', 'legacy', 'vintage', 'pauper', 'paupercommander',
  'oathbreaker', 'brawl', 'standardbrawl', 'historic', 'timeless', 'premodern', 'predh',
  'oldschool', 'penny', 'duel', 'casual',
];
export const DECK_ZONES = ['commander', 'main', 'side', 'maybe'];

export const deckCreateSchema = z.object({
  name: z.string().trim().max(200).optional(),
  format: z.enum(DECK_FORMATS, { message: 'format invalide' }).optional(),
  notes: z.string().max(5000).nullish(),
  url: z.string().trim().max(500).optional(),
  text: z.string().max(200000).optional(),
});

export const deckPatchSchema = z.object({
  name: z.string().trim().min(1, 'nom requis').max(200).optional(),
  format: z.enum(DECK_FORMATS, { message: 'format invalide' }).optional(),
  notes: z.string().max(5000).nullish(),
  // Image de fond : impression choisie, `null` = choix par défaut (commandant, sinon la plus chère)
  cover_scryfall_id: z.guid({ message: 'scryfall_id invalide' }).nullable().optional(),
}).refine((o) => Object.values(o).some((v) => v !== undefined), { message: 'aucun champ à modifier' });

// `name` : impression choisie comme à l'import (possédée, sinon la moins chère) ;
// `scryfall_id` : impression imposée, ou repli si le nom est inconnu en base.
export const deckCardAddSchema = z.object({
  name: z.string().trim().min(1).max(500).optional(),
  scryfall_id: z.guid({ message: 'scryfall_id invalide' }).optional(),
  quantity: z.coerce.number().int().min(1).max(250).default(1),
  zone: z.enum(DECK_ZONES, { message: 'zone invalide' }).default('main'),
}).refine((o) => o.name || o.scryfall_id, { message: 'carte requise' });

export const deckCardPatchSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(250).optional(),
  zone: z.enum(DECK_ZONES, { message: 'zone invalide' }).optional(),
  scryfall_id: z.guid({ message: 'scryfall_id invalide' }).optional(),
}).refine((o) => Object.values(o).some((v) => v !== undefined), { message: 'aucun champ à modifier' });
