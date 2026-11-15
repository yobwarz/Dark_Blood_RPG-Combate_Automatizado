import {MODULO} from './constantes.mjs';
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const filas=new Map();export function serial(k,fn){const p=(filas.get(k)??Promise.resolve()).catch(()=>{}).then(fn);filas.set(k,p);return p.finally(()=>{if(filas.get(k)===p)filas.delete(k);});}
export const flag=(d,k,fallback=null)=>d?.getFlag?.(MODULO,k)??d?.flags?.[MODULO]?.[k]??fallback;
export const principal=()=>game.user.isGM&&(!game.users.activeGM||game.users.activeGM.isSelf);
export function exigirGM(){if(!principal())throw Error('A aplicação exige o Mestre ativo.');}
export const dono=(a,u=game.user)=>u?.isGM||a?.testUserPermission?.(u,'OWNER')||u?.id===game.user.id&&a?.isOwner;
export const guardar=fn=>async(...args)=>{try{return await fn(...args);}catch(e){console.error(MODULO,e);ui.notifications.warn(e.message);}};
export const cenario=()=>game.sangueEscuro?.api?.cenarioAtivo??'base';
export const parteCenario=(id,nome)=>cenario()===id&&game.settings.get({'dead-space':'sangue-escuro-dead-space','fh':'sangue-escuro-fear-and-hunger','fear-and-hunger':'sangue-escuro-fear-and-hunger'}[id]??id,`parte${nome}`)!==false;
export function danoDoCenario(d){return !!d?.ds||parteCenario('dead-space','Combate');}
export function acoesDaExpansao(a,i){return cenario()==='the-last-of-us'&&game.settings.get('sangue-escuro-the-last-of-us','parteOficina')!==false&&['arco','besta'].includes(i?.flags?.['sangue-escuro-the-last-of-us']?.tipo)||cenario()==='projeto-x64'&&game.settings.get('sangue-escuro-projeto-x64','parteTecnologia')!==false&&i?.flags?.['sangue-escuro-projeto-x64']?.tecnologia==='l80';}
export function motivoManual(d={}){if(danoDoCenario(d))return 'Dead Space aplica dano pelo seu controle de desmembramento.';if(['fear-and-hunger','fh'].includes(cenario())&&game.settings.get('sangue-escuro-fear-and-hunger','parteCombate')!==false)return 'Fear & Hunger conclui a declaração de ataque letal pelo fluxo próprio.';if(cenario()==='resident-evil-4'&&game.settings.get('sangue-escuro-resident-evil-4','parteCombate')!==false)return 'Resident Evil 4 preserva a janela de Aparar antes da rolagem de dano.';if(d.re4Arsenal?.raio||d.re4Arsenal?.modoMina)return 'Ataques em área exigem conferir cada alvo e seu teste de resistência.';return null;}
