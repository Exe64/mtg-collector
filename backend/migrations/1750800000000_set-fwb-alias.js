/** Édition Cardmarket « Foreign White Border » : alias de Revised (3ed) côté Scryfall. */
export const up = (pgm) => {
  pgm.sql(`INSERT INTO sets (code, name, released_at, card_count, icon_uri, set_type, printed_size)
           SELECT 'fwb', 'Foreign White Border', released_at, card_count, icon_uri, set_type, printed_size
           FROM sets WHERE code = '3ed'
           ON CONFLICT (code) DO NOTHING;`);
};

export const down = (pgm) => {
  pgm.sql(`DELETE FROM sets WHERE code = 'fwb';`);
};
