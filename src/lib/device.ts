/** Téléphone ou petite tablette en portrait (< 768 px) : on préfère les cartes aux tableaux. */
export const isSmallScreen = (): boolean => {
  try {
    return typeof window !== "undefined" && window.innerWidth < 768;
  } catch {
    return false;
  }
};
