import { afterEach } from "vitest";

// Évite qu'un test de composant laisse du contenu dans le DOM pour le suivant.
afterEach(() => {
  document.body.replaceChildren();
});
