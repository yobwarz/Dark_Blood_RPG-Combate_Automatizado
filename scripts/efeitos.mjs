import {acoesDaExpansao,serial} from './util.mjs';
import {solicitarRemocao} from './solicitacoes.mjs';
import { MODULO, CANAL, config } from "./constantes.mjs";

const falar = (ator, titulo, corpo) => ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor: ator }),
  content: `<div class="se-flavor"><h3>${titulo}</h3>${corpo}</div>`
});

/* ------------------------------ ações ------------------------------------ */

/** Desconta ações do turno (somente com combate em andamento). `n`: custo em ações. */
function gastarAcao(ator, n = 1) {
  if (!config("autoAcoes") || !ator?.gastarAcoes || !ator.isOwner || !game.combat?.started) return;
  return serial('acoes:'+ator.uuid,()=>ator.gastarAcoes(n));
}

async function limparCondicao(ator, condicao, executor) {
  return solicitarRemocao(ator, condicao, executor);
}

/* ------------------------- efeitos de acerto crítico --------------------- */

async function testeCon(ator, cd, rotulo) {
  if (ator.type === "character") {
    const roll = await ator.rolarTeste({ chave: "con", rotulo, cd });
    return roll.total >= cd;
  }
  const roll = await new Roll("1d20 + @m", { m: ator.system.atributos?.con?.mod ?? 0 }).evaluate();
  const ok = roll.total >= cd;
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: ator }),
    flavor: `<div class="se-flavor"><h3>${rotulo}</h3><p class="se-resultado ${ok ? "ok" : "falha"}">CD ${cd}: ${ok ? "Sucesso" : "Falha"}</p></div>`
  });
  return ok;
}

export async function aplicarEfeitoCritico(ator, dados) {
  switch (dados.efeito) {
    case "Sangramento":
      if (ator.type === "criatura" && ator.system.semCirculacao) {
        return falar(ator, "Sangramento", `<p>${ator.name} não possui circulação sanguínea funcional e é imune ao Sangramento.</p>`);
      }
      await ator.update({ "system.condicoes.sangramento": true });
      return falar(ator, "Sangramento", `<p>${ator.name} sofre 1 de dano no início de cada turno até receber primeiros socorros (Medicina CD 12, 1 Ação).</p>`);

    case "Atordoamento":
      if (!(await testeCon(ator, 12, "Atordoamento (CON CD 12)"))) {
        await ator.update({ "system.condicoes.atordoado": true });
        await falar(ator, "Atordoado", `<p>${ator.name} fica Atordoado até o final do próximo turno: sem Reações até o início desse turno, −2 em testes de Agilidade e perde 1 Ação no próximo turno.</p>`);
      }
      return;

    case "Incêndio":
      await ator.update({ "system.condicoes.incendiado": true });
      return falar(ator, "Incendiado", `<p>${ator.name} pega fogo: 1d4 de dano de Fogo no início de cada turno (ignora o PR). Apagar custa 1 Ação.</p>`);
  }
}

/* -------------------------- dano contínuo e turnos ------------------------ */

async function danoContinuo(ator, total, titulo, botao) {
  const max = ator.system.pv.max;
  const novo = Math.max(0, ator.system.pv.value - total);
  if (ator.receberDano) await ator.receberDano(total,{causa:titulo});
  else await ator.update({ "system.pv.value": novo });
  await falar(ator, titulo, `<p>${ator.name} sofre <strong>${total}</strong> de dano (ignora o PR). PV ${novo}/${max}.</p>
    <div class="se-botoes">${botao}</div>`);
}

async function inicioTurno(ator) {
  if (!game.users.activeGM?.isSelf || !ator?.system?.condicoes) return;
  const c = ator.system.condicoes;

  if (config("autoContinuos")) {
    if (c.sangramento) {
      await danoContinuo(ator, 1, "Sangramento",
        `<button type="button" data-sec="estancar" data-actor="${ator.uuid}">Estancar (Medicina CD 12)</button>`);
    }
    if (c.incendiado) {
      const roll = await new Roll("1d4").evaluate();
      await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: ator }), flavor: `<div class="se-flavor"><h3>Incendiado: dano de Fogo</h3></div>` });
      const protecao = Math.max(0,...Array.from(ator.items??[]).filter(i=>i.type==="protecao"&&i.system.vestida).map(i=>Number(i.flags?.["sangue-escuro"]?.protecaoFogo??0)));
      await danoContinuo(ator, Math.max(0,roll.total-protecao), "Incendiado",
        `<button type="button" data-sec="apagar" data-actor="${ator.uuid}">Apagar as chamas (1 Ação)</button>`);
    }

  }
}

/* ------------------------------- registro -------------------------------- */

export function registrarEfeitos() {
  Hooks.on("sangueEscuro.ataque", (ator, item, dados) => { if (!dados.repetido && !dados.acaoGerenciada && (!dados.contextoAcao || dados.contextoAcao === "normal") && !acoesDaExpansao(ator, item)) return gastarAcao(ator, item?.system?.acoesPorAtaque ?? 1); });
  Hooks.on("sangueEscuro.recarregar", (ator) => gastarAcao(ator));
  Hooks.on("sangueEscuro.destravar", (ator) => gastarAcao(ator));
  Hooks.on("sangueEscuro.inicioTurno", inicioTurno);


  // Botões dos cartões de dano contínuo.
  Hooks.on("renderChatMessageHTML", (mensagem, html) => {
    html.querySelectorAll("button[data-sec='estancar'], button[data-sec='apagar']").forEach((botao) => {
      botao.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const alvo = await fromUuid(botao.dataset.actor);
        if (!alvo) return;
        const executor = canvas.tokens?.controlled[0]?.actor ?? game.user.character;
        if (!executor && !game.user.isGM) return ui.notifications.warn("Controle um token ou defina seu personagem.");
        botao.disabled = true;

        if (botao.dataset.sec === "estancar") {
          if (executor?.type !== "character") return ui.notifications.warn("Selecione o personagem que vai prestar os primeiros socorros.");
          const roll = await executor.rolarTeste({
            chave: "int", rotulo: "Estancar sangramento (Medicina CD 12)",
            bonus: executor.system.pericias.medicina.bonus, cd: 12
          });
          await gastarAcao(executor);
          if (roll.total >= 12) {
            await limparCondicao(alvo, "sangramento", executor);
            await falar(alvo, "Sangramento estancado", `<p>${alvo.name} deixa de sangrar.</p>`);
          }
        } else {
          const quem=executor??alvo;
          if (!quem.podeAgir?.()) { botao.disabled=false; return ui.notifications.warn("Selecione um personagem capaz de ajudar."); }
          const metodo=await foundry.applications.api.DialogV2.wait({window:{title:"Apagar chamas"},content:"<p>Confirme alcance e método. Água suficiente, cobertor apropriado, areia ou extintor eficaz dispensam teste. Improvisar exige AGI CD 12.</p>",rejectClose:false,buttons:[{action:"eficaz",label:"Recurso eficaz disponível"},{action:"improvisar",label:"Improvisar · AGI CD 12"}]});
          if (!metodo) {botao.disabled=false;return;}
          if (game.combat?.started && await quem.gastarAcoes(1)===false) {botao.disabled=false;return;}
          const sucesso=metodo==="eficaz" || (await quem.rolarTeste({chave:"agi",rotulo:"Apagar chamas",cd:12})).total>=12;
          if(sucesso){await limparCondicao(alvo,"incendiado",quem);await falar(alvo,"Chamas apagadas","<p>A condição Incendiado termina. Uma fonte contínua de fogo pode reaplicá-la.</p>");}
          else {await falar(alvo,"Chamas persistem","<p>A tentativa consumiu a Ação; o personagem continua Incendiado.</p>");botao.disabled=false;}

        }
      });
    });
  });
}
