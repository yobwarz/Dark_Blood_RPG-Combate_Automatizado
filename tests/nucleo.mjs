import assert from 'node:assert/strict';
import {instalarMock,criarAtor,criarItem,definir,ganchos} from './mock_foundry.mjs';
const ID='sangue-escuro-combate';instalarMock({modulo:ID,configuracoes:{autoAcoes:true,autoEfeitos:false,autoContinuos:false,modoResolucao:'automatico'}});const pending=[];
Hooks.callAll=(name,...args)=>{for(const f of ganchos[name]??[]){const result=f(...args);if(result?.then)pending.push(result);}};
const flush=async()=>{while(pending.length)await Promise.all(pending.splice(0));};
globalThis.Actor=class{};globalThis.Item=class{};globalThis.Combatant=class{};
game.system={id:'sangue-escuro'};game.user={id:'gm',isGM:true};game.users=new Map([['gm',game.user]]);game.users.activeGM={isSelf:true};game.sangueEscuro={api:{cenarioAtivo:'base'}};game.combat={started:true};
const refs=new Map(),messages=[];let seq=0,numero=15,total=15;globalThis.fromUuid=async id=>refs.get(id)??null;
ChatMessage.create=async data=>{const m={...data,id:String(++seq),uuid:'ChatMessage.'+seq,flags:data.flags??{},author:game.user,getFlag:(s,k)=>m.flags[s]?.[k],setFlag:async(s,k,v)=>{(m.flags[s]??={})[k]=v;}};refs.set(m.uuid,m);messages.push(m);Hooks.callAll('createChatMessage',m);return m;};
foundry.applications.api.DialogV2={confirm:async()=>true};
globalThis.Roll=class{constructor(formula,data={}){this.formula=formula;this.data=data;}async evaluate(){this.total=this.formula.includes('d20')?total:8;this.dice=[{results:[{active:true,result:numero}]}];return this;}async toMessage(d){return ChatMessage.create({...d,rolls:[this]});}};
const {SEActor}=await import('../../revisao-sangue-escuro/atualizado/sangue-escuro/module/documents.mjs');
const a=criarAtor(ID),b=criarAtor(ID),c=criarAtor(ID);a.name='Atacante';b.name='Alvo';a.system.pericias={armasBrancas:{bonus:0},armasFogo:{bonus:0}};a.system.estresse={value:0};a.system.sorte={value:1};a.system.atributos.agi.mod=0;a.penalidades=()=>({partes:[],total:0});b.system.na=10;b.system.pr=2;a.rolarDano=(i,o)=>SEActor.prototype.rolarDano.call(a,i,o);a.testUserPermission=u=>u.isGM;
for(const actor of [a,b,c]){Object.setPrototypeOf(actor,SEActor.prototype);refs.set(actor.uuid,actor);}
const w=criarItem('arma',{categoria:'fogo',atributo:'agi',capacidade:10,municaoAtual:5,travada:false,margemCritico:20,somaAtributoDano:false,dano:'1d6',tipoDano:'Perfurante',bonusCritico:'',efeitoCritico:'',acoesPorAtaque:1}, {},ID);w.id='w';w.name='Pistola';w.uuid=a.uuid+'.Item.w';w.parent=a;Object.defineProperty(w,'carregador',{get:()=>w.system.municaoAtual});refs.set(w.uuid,w);game.user.targets={first:()=>({actor:b})};
const {registrarEfeitos}=await import('../scripts/efeitos.mjs');const {registrarFluxo}=await import('../scripts/fluxo.mjs');const {registrarBotoesDano}=await import('../scripts/dano.mjs');registrarEfeitos();registrarFluxo();registrarBotoesDano();let applied=0;Hooks.on('sangueEscuroCombate.danoAplicado',()=>applied++);
// Executa os métodos reais do núcleo, com o alvo mudando depois do ataque.
const roll=await SEActor.prototype.rolarAtaque.call(a,w,{});game.user.targets={first:()=>({actor:c})};await flush();assert.equal(roll.total,15);assert.equal(w.system.municaoAtual,4);assert.equal(a.system.turno.acoes,2);assert.equal(b.system.pv.value,4);assert.equal(c.system.pv.value,10);assert.equal(applied,1);
const attack=messages.find(m=>m.flags['sangue-escuro']?.teste?.kind==='ataque'),damage=messages.find(m=>m.flags['sangue-escuro']?.dano);assert.equal(attack.flags['sangue-escuro'].teste.alvo,b.uuid);assert.equal(damage.flags['sangue-escuro'].dano.ocorrencia.ataqueUuid,attack.uuid);
// Erro, travamento e Segunda Chance não criam aplicações indevidas nem novo gasto.
numero=1;total=1;const before=messages.filter(m=>m.flags['sangue-escuro']?.dano).length;await SEActor.prototype.rolarAtaque.call(a,w,{});await flush();assert.equal(messages.filter(m=>m.flags['sangue-escuro']?.dano).length,before);assert.equal(w.system.travada,true);const ammo=w.system.municaoAtual,actions=a.system.turno.acoes;w.system.travada=false;numero=15;total=15;await SEActor.prototype.rolarAtaque.call(a,w,{}, {repetido:true});await flush();assert.equal(w.system.municaoAtual,ammo);assert.equal(a.system.turno.acoes,actions);
console.log('OK: métodos reais do núcleo + automação aplicam PV no alvo original, gastam uma ação e uma munição, mantêm retorno Roll e ignoram erro/travamento; Segunda Chance não cobra novamente.');
// Assistido prepara sem descontar PV; não é necessário marcar novamente o alvo.
await game.settings.set(ID,'modoResolucao','assistido');w.system.travada=false;numero=15;total=15;game.user.targets={first:()=>({actor:c})};const beforeHp=c.system.pv.value;await SEActor.prototype.rolarAtaque.call(a,w,{});await flush();assert.equal(c.system.pv.value,beforeHp);assert.ok(messages.at(-1).flags['sangue-escuro']?.dano?.ocorrencia);
console.log('OK: modo assistido prepara o dano com ocorrência original e mantém PV até a confirmação.');
a.system.turno.reacao=1;a.system.turno.acoes=2;game.combat.started=true;game.user.targets={first:()=>({actor:b})};w.system.travada=false;w.system.municaoAtual=3;
const actionBefore=a.system.turno.acoes;await SEActor.prototype.rolarAtaque.call(a,w,{}, {contextoAcao:'oportunidade'});await flush();assert.equal(a.system.turno.acoes,actionBefore);assert.equal(a.system.turno.reacao,0);assert.equal(w.system.municaoAtual,2);
a.system.turno.reacao=1;w.system.municaoAtual=0;await SEActor.prototype.rolarAtaque.call(a,w,{}, {contextoAcao:'oportunidade'});await flush();assert.equal(a.system.turno.reacao,1);
console.log('OK DRS: ataque de oportunidade consome somente Reação e munição; arma vazia não consome Reação.');
