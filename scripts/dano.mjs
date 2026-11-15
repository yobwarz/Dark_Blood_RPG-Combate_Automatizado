import {MODULO,config} from './constantes.mjs';
import {aplicarEfeitoCritico} from './efeitos.mjs';
import {esc,flag,serial,principal,exigirGM,dono,guardar,danoDoCenario,cenario,motivoManual} from './util.mjs';
import {solicitarAplicacao} from './solicitacoes.mjs';
export function calcularDano(ator,dados){const total=Number(dados.total);if(!Number.isFinite(total)||total<0||total>1000000)throw Error('Dano inválido.');let pr=dados.ignorarPR?0:Math.max(0,Number(ator.system.pr??0));const fisico=['Contundente','Cortante','Perfurante'].includes(dados.tipoDano);if(!dados.ignorarPR&&cenario()==='the-last-of-us'&&!fisico)pr=Math.max(0,pr-Number(ator.flags?.['sangue-escuro-the-last-of-us']?.prFisica??0));if(dados.efeito==='Perfuração')pr=Math.max(0,pr-2);const dano=Math.max(0,total-pr)+(dados.efeito==='Ferimento Profundo'?2:0);return {dano,pr};}
/** Aplica uma ocorrência somente uma vez por ator; somente o Mestre ativo grava PV. */
export async function aplicarDano(dados,alvoUuids,{mensagem=null}={}){
 exigirGM();if(danoDoCenario(dados))throw Error('Dead Space usa o botão próprio de aplicação e desmembramento.');
 if(!Array.isArray(alvoUuids)||!alvoUuids.length||alvoUuids.length>100)throw Error('Selecione alvos válidos.');
 return serial(mensagem?.uuid??'aplicacao-manual',async()=>{const results=[],vistos=new Set();
 for(const uuid of alvoUuids){const doc=await fromUuid(uuid),ator=doc?.actor??doc;if(!ator?.system?.pv)throw Error('Alvo indisponível.');if(vistos.has(ator.uuid))continue;vistos.add(ator.uuid);
 await serial('pv:'+ator.uuid,async()=>{
 const vinculado=dados.re4Arsenal?.raio?null:dados.ocorrencia?.alvo??dados.re4?.alvo;if(vinculado&&vinculado!==ator.uuid)throw Error('Este cartão pertence ao alvo registrado no ataque.');
 const ledger={...flag(mensagem,'aplicacoes',{})};if(ledger[ator.uuid]?.estado==='emAplicacao')throw Error('Uma aplicação anterior requer conferência do Mestre. Confira os PV antes de continuar; o dano não será repetido.');if(ledger[ator.uuid]){results.push({ator:ator.uuid,repetido:true});return;}
 const calc=calcularDano(ator,dados),antes=Number(ator.system.pv.value),novo=Math.max(0,antes-calc.dano);const evento={dados:{...dados},dano:calc.dano,pr:calc.pr,novoPV:novo};
 if(Hooks.call('sangueEscuroCombate.preAplicarDano',ator,evento)===false)return;
 if(mensagem){ledger[ator.uuid]={estado:'emAplicacao',antes,dano:calc.dano};await mensagem.setFlag(MODULO,'aplicacoes',ledger);}
 try{if(ator.receberDano)await ator.receberDano(calc.dano,{critico:!!dados.critico,causa:dados.nome??'ataque'});else await ator.update({'system.pv.value':novo});}catch(e){if(mensagem){delete ledger[ator.uuid];await mensagem.setFlag(MODULO,'aplicacoes',ledger);}throw e;}
 if(mensagem){ledger[ator.uuid]={estado:'aplicado',antes,depois:novo,dano:calc.dano,pr:calc.pr};await mensagem.setFlag(MODULO,'aplicacoes',ledger);}
 // Metadados das expansões são preservados integralmente. O hook é emitido uma vez.
 Hooks.callAll('sangueEscuroCombate.danoAplicado',ator,evento);
 if(dados.critico&&dados.efeito&&config('autoEfeitos'))await aplicarEfeitoCritico(ator,dados);
 await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:ator}),content:`<div class="se-flavor sec-cartao"><h3>Dano aplicado</h3><p>${esc(ator.name)} sofre <strong>${calc.dano}</strong>${dados.tipoDano?' de dano '+esc(dados.tipoDano):''}.</p><small>Dano bruto ${esc(dados.total)} · PR efetiva ${calc.pr} · PV ${novo}/${ator.system.pv.max}</small></div>`});results.push({ator:ator.uuid,...calc,novoPV:novo});
 });
 }return results;});
}
export function dadosDaMensagem(m){return m?.getFlag?.('sangue-escuro','dano')??m?.flags?.['sangue-escuro']?.dano;}
export async function aplicarMensagem(m,alvos,{ignorarPR=false,confirmar=true}={}){exigirGM();const d=dadosDaMensagem(m);if(!d)throw Error('Cartão de dano indisponível.');if(confirmar){const nomes=[];for(const uuid of alvos){const doc=await fromUuid(uuid);nomes.push(esc((doc?.actor??doc)?.name??'Alvo indisponível'));}const ok=await foundry.applications.api.DialogV2.confirm({window:{title:'Confirmar aplicação de dano'},content:`<p>Dano bruto: <strong>${esc(d.total)}</strong> ${esc(d.tipoDano)}.</p><p>Alvos: ${nomes.join(', ')}.</p><p>${ignorarPR?'A PR será ignorada.':'A PR e os efeitos aplicáveis serão considerados.'}</p>${d.re4Arsenal?.raio?'<p>Confira área e testes de resistência antes de escolher dano completo ou metade.</p>':''}`});if(!ok)return;}
 return aplicarDano({...d,ignorarPR},alvos,{mensagem:m});}
export function alvosDoCartao(d){const vinculado=d.re4Arsenal?.raio?null:d.ocorrencia?.alvo??d.re4?.alvo;return vinculado?[vinculado]:[...(game.user.targets??[])].map(t=>t.document?.uuid??t.actor?.uuid).filter(Boolean);}
export function registrarBotoesDano(){
 Hooks.on('createChatMessage',guardar(async m=>{const d=dadosDaMensagem(m);if(!d?.ocorrencia||config('modoResolucao')!=='automatico'||motivoManual(d)||m.author?.id!==game.user.id)return;const alvos=alvosDoCartao(d);if(alvos.length)await solicitarAplicacao(m,alvos,{automatico:true});}));
 Hooks.on('renderChatMessageHTML',guardar(async(m,html)=>{const dano=dadosDaMensagem(m);if(!dano||danoDoCenario(dano))return;const origem=await fromUuid(dano.origem);if(!dono(origem))return;const raiz=html?.querySelector?html:html?.[0],area=raiz?.querySelector('.message-content');if(!area||area.querySelector('.sec-aplicar'))return;const bloco=document.createElement('div');bloco.className='se-flavor sec-aplicar';bloco.innerHTML=`<div class="se-botoes"><button type="button" data-sec="aplicar">Aplicar dano</button><button type="button" data-sec="semPR">Ignorar PR</button></div><p class="se-nota">${dano.ocorrencia?.alvo||dano.re4?.alvo?'Alvo preservado do ataque.':'Marque os alvos antes de confirmar.'} Cada cartão é aplicado uma vez por ator.</p>`;area.appendChild(bloco);
 for(const btn of bloco.querySelectorAll('button'))btn.addEventListener('click',guardar(async ev=>{ev.preventDefault();const alvos=alvosDoCartao(dano);if(!alvos.length)throw Error('Selecione ao menos um alvo.');btn.disabled=true;try{await solicitarAplicacao(m,alvos,{ignorarPR:btn.dataset.sec==='semPR'});}finally{btn.disabled=false;}}));}));
}
