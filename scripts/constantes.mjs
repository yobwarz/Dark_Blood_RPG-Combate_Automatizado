export const MODULO = "sangue-escuro-combate";
export const CANAL = `module.${MODULO}`;
export const config = (chave) => game.settings.get(MODULO, chave);
