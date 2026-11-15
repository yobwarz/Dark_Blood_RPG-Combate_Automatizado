# Revisão de automação — REA, Midi-QOL e DAE

Data: 12/11/2026. Alvos: pacote Sangue Escuro: Combate Automatizado 0.2.0 e candidato 0.3.0. Sem execução de código de terceiros dentro do Foundry.

## Método e identidade

Skill: [reverse-engineer-anything/SKILL.md](https://github.com/morluto/rea/blob/main/.agents/skills/reverse-engineer-anything/SKILL.md), lida no checkout REA `a8527d43b8439476f5c9d1497315dfe7dd5e1f38`. O pacote publicado foi conferido por SHA-256 `2658189c33a48adee3971517d595618616d32ad9abb6920470491fde03bdaf30` antes da extração. Não foi feita instalação de MCP nem troca de configuração global do agente; foi usado o CLI estático do REA com cache local.

Comando-base: `rea analyze-javascript-application <pasta-extraida> --detail summary --evidence_output <arquivo-novo> --format json`. As evidências completas permanecem no diretório de auditoria do projeto, fora do pacote instalável.

Análise 0.2.0: Evidence `ev_c5f032504be8e7b9d82fa328470f514aebbe7debf8da581473a6ea64c9038e8a`; resumo `ev_0005c2fa75d51e22b49b466abcad462afe8a861ac8900b69da2e1e50b09c1345`. Inventário: cinco arquivos relevantes, quatro JavaScript analisados, nenhuma falha de parsing. A cobertura semântica não é completa: o REA registrou 727 desconhecidos semânticos e relações dinâmicas não resolvidas. Portanto, a análise automática foi complementada por leitura dos hooks e testes controlados do código real.

## Observações e correções

1. O ataque nativo já consome munição e as expansões TLOU/X-64 podem consumir ações depois de `rolarAtaque`. O listener genérico também descontava ações. Correção: deixar as ações desses ataques com os controladores existentes e enfileirar as cobranças genéricas por ator.
2. A aplicação antiga lia a seleção de tokens somente no clique. Correção: um campo adicional no cartão registra o alvo efetivamente utilizado no ataque; o dano associado conserva esse UUID.
3. A aplicação antiga não possuía registro persistente por alvo, nem fila comum de PV para cartões diferentes. Correção: registro por mensagem/ator e serialização de gravações no Mestre ativo.
4. Dead Space resolve Resistência Estrutural e mutilação em seu próprio aplicador. Correção: recusar também a chamada genérica direta nesse cenário, não apenas interceptar um clique de DOM.
5. Fear & Hunger prepara metadados depois de uma gravação assíncrona no listener de ataque. Não há prova de que um listener novo observe esse estado concluído. Decisão: conservar seu fluxo manual.
6. RE4 exige Aparar antes da rolagem de dano; explosivos têm área e alternativas de dano completo/metade. Decisão: preservar a janela de reação e a conferência por alvo; não vincular explosões a uma única vítima.
7. A PR fúngica de TLOU é física. Correção: descontar somente a parcela aplicável, preservando as demais regras e deixando o contágio por mordida sujeito à confirmação explícita.
8. Solicitações remotas agora referenciam um cartão persistido e têm origem conferida com o autor do ChatMessage. O antigo envio livre de total de dano por socket não é usado.

Essas observações foram estabelecidas pela combinação do inventário REA com leitura estática das fontes; os testes simulados corroboram os casos exercitados. Elas não constituem certificação de compatibilidade num servidor Foundry real.

## Referências complementares

- [Midi-QOL — repositório oficial](https://github.com/tposney/midi-qol) e [página no Foundry](https://foundryvtt.com/packages/midi-qol): referências para etapas de ataque, dano, alvos e opções de automação. O sistema oficialmente listado é D&D 5e; não foi adicionada dependência a ele.
- [DAE — repositório oficial](https://github.com/tposney/dae). Foi consultado o manifesto da branch v13, revisão `cbe293ae3ebc5cfded6e33d609dc086c6d78542d`, versão 13.0.34: Foundry 13, sistema dnd5e 5.x, libWrapper e socketlib. Seus padrões de origem e ciclo de efeitos são referência; não foi copiado código nem anunciado suporte direto do DAE ao Sangue Escuro.

## Limites

O processo usa evidência estática e mocks locais do Foundry. Não avalia animações, módulos não presentes, todas as ordens possíveis de carregamento ou todas as formas de edição manual dos documentos. Quando o dado necessário não está garantido, a versão mantém confirmação do Mestre ou o fluxo da expansão. Uma execução real em mundo de teste permanece necessária antes de depender da aplicação automática numa sessão.
