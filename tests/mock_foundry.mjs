/**
 * Simulação mínima do Foundry para testar a lógica de módulos em Node (sem Foundry).
 *
 * Uso nos testes:
 *   import { instalarMock, criarAtor, criarItem, ganchos, mensagens, avisos, dados } from "./mock_foundry.mjs";
 *   const ctx = instalarMock({ modulo: "sangue-escuro-meucenario", cenario: "meu-cenario",
 *                              configuracoes: { parteExemplo: true } });
 *   const { SEApi } = await import("<caminho>/sangue-escuro/module/api.mjs");   // o código REAL da API
 *   ctx.usarApi(new SEApi(), (api) => api.registrarCenario({ id: "meu-cenario", nome: "Meu" }));
 *   const meuModulo = await import("<caminho>/scripts/combate.mjs");
 *   meuModulo.ganchosCombate();                      // registra os ganchos no Hooks simulado
 *   Hooks.call("sangueEscuro.preAtaque", ator, item) // dispara
 *   dados([50, 3]);                                  // valores forçados para as próximas rolagens (Roll)
 *   assert.equal(mensagens.length, 1);               // cartões de chat criados
 *
 * Limites: valida lógica, não a integração com a interface do Foundry. Diga isso ao usuário.
 */
export const ganchos = {};
export const mensagens = [];
export const avisos = [];
let valoresRoll = [];
export const dados = (lista) => { valoresRoll = [...lista]; };

const get = (o, p) => p.split(".").reduce((x, k) => x?.[k], o);
export const definir = (o, p, v) => {
  const ks = p.split("."); const u = ks.pop();
  ks.reduce((x, k) => (x[k] ??= {}), o)[u] = v;
};

export function instalarMock({ modulo, cenario, configuracoes = {}, gm = true } = {}) {
  globalThis.Hooks = {
    on: (n, f) => (ganchos[n] ??= []).push(f),
    once: (n, f) => (ganchos[n] ??= []).push(f),
    call(n, ...a) { for (const f of ganchos[n] ?? []) if (f(...a) === false) return false; return true; },
    callAll(n, ...a) { for (const f of ganchos[n] ?? []) f(...a); }
  };
  const cfg = { "sangue-escuro": { cenario }, [modulo]: { ...configuracoes } };
  globalThis.game = {
    settings: { get: (m, k) => cfg[m]?.[k], set: async (m, k, v) => { (cfg[m] ??= {})[k] = v; } },
    combat: { started: false, combatants: [] },
    user: { isGM: gm, targets: { first: () => null } },
    users: { activeGM: { isSelf: true } },
    socket: { emit() {}, on() {} }
  };
  globalThis.ChatMessage = { create: async (d) => mensagens.push(d), getSpeaker: () => ({}) };
  globalThis.ui = { notifications: { warn: (t) => avisos.push(t), info: (t) => avisos.push(t) } };
  globalThis.Roll = class {
    constructor(f) { this.f = f; }
    async evaluate() { this.total = valoresRoll.length ? valoresRoll.shift() : 1; return this; }
    async toMessage(d) { mensagens.push(d); }
  };
  globalThis.foundry = {
    utils: { deepClone: (o) => JSON.parse(JSON.stringify(o)), getRoute: (x) => x },
    applications: { api: {}, ux: {} }
  };
  globalThis.CONFIG = { SE: { CONDICOES: {} } };
  globalThis.fromUuid = async () => null;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });

  return {
    usarApi(api, registro) {                     // registra cenário/condições etc. e congela, como o sistema faz
      game.sangueEscuro = { api };
      registro?.(api);
      api._congelar();
      return api;
    },
    configuracoes: cfg[modulo]
  };
}

/** Ator simulado. `extra.system` sobrescreve campos de system; flags ficam em ator.flags[modulo]. */
export function criarAtor(modulo, tipo = "character", extra = {}) {
  const o = {
    id: "a" + Math.random().toString(36).slice(2), uuid: "Actor." + Math.random().toString(36).slice(2),
    name: extra.name ?? "Teste", type: tipo, flags: { [modulo]: {} }, items: [],
    system: {
      condicoes: {}, pv: { value: 10, max: 10 }, ps: { value: 10, max: 10 }, exaustao: { value: 0 }, exaustaoTotal: 0,
      atributos: { for: { mod: 0 }, agi: { mod: 0 }, con: { mod: 0 }, int: { mod: 0 }, sab: { mod: 0 }, san: { mod: 0 }, car: { mod: 0 } },
      turno: { acoes: 3, reacao: 1, bonus: 1 }, morte: {}, ...(extra.system ?? {})
    },
    isOwner: true,
    getFlag: (m, k) => o.flags[m]?.[k],
    setFlag: async (m, k, v) => { (o.flags[m] ??= {})[k] = v; },
    unsetFlag: async (m, k) => { delete o.flags[m]?.[k]; },
    async update(d) { for (const [k, v] of Object.entries(d)) definir(o, k.startsWith("flags.") ? k.replace(/^flags\./, "flags.") : k, v); },
    async gastarAcoes(n = 1) { o.system.turno.acoes = Math.max(0, o.system.turno.acoes - n); return true; },
    rolarTeste: async () => ({ total: valoresRoll.length ? valoresRoll.shift() : 10 }),
    rolarVontade: async () => ({ total: valoresRoll.length ? valoresRoll.shift() : 10 })
  };
  return o;
}

export function criarItem(tipo, system = {}, flags = {}, modulo = "") {
  const it = {
    type: tipo, name: "Item", system, flags: { [modulo]: flags },
    getFlag: (m, k) => it.flags[m]?.[k],
    async update(d) { for (const [k, v] of Object.entries(d)) definir(it, k, v); }
  };
  return it;
}
