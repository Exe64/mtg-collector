import { create } from 'zustand';

// Store global pour la modale de détail carte, ouvrable depuis n'importe où.
export const useCardModal = create((set) => ({
  scryfallId: null,
  open: (scryfallId) => set({ scryfallId }),
  close: () => set({ scryfallId: null }),
}));
