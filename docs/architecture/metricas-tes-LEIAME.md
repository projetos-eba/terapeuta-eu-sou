SISTEMA DE MÉTRICAS
Painel do Terapeuta — guia para o desenvolvedor
Explicação sucinta de como o sistema funciona
Sistema de Métricas · TES · guia do desenvolvedor · 1

1. Princípios que governam tudo
   São regras invioláveis. Toda métrica e todo texto da tela obedecem a elas.
   • Número nunca aparece sozinho. Todo valor exibido vem acompanhado de um direcionamento
   (texto de ação). Se não há direcionamento, o número não vai para a tela.
   • Comparação só com o próprio histórico. Nunca comparar um terapeuta com outros. Sem ranking,
   sem média do mercado, sem pagar para subir (pay-to-rank).
   • Trava de acúmulo. Métricas que dependem de volume só aparecem a partir de 10 atendimentos
   (favoritos: 10 favoritos). Antes disso, exibir um estado de espera — nunca um número parcial
   enganoso.
   • Plano vem da assinatura. Premium ou Premium Plus é lido da assinatura (Stripe). O terapeuta
   nunca escolhe; o sistema só lê.
   • Fala Humana em todo texto. Todo texto segue o documento “Fala Humana do TES”: fala de
   pessoas, sem jargão, sem culpar nem exagerar.
2. Eventos que o sistema precisa capturar
   Tudo no painel deriva destes eventos. Cada um guarda, no mínimo, o terapeuta, a pessoa (de forma
   anônima), técnica/tema quando houver, e o horário.
   Evento O que registrar
   Aparição O perfil apareceu num resultado de busca/caminho. Guardar tema(s) e técnica(s)
   daquele resultado.
   Abertura de perfil Clique que abre o perfil para conhecer melhor.
   Clique em agendar A pessoa seguiu para marcar.
   Agendamento Encontro marcado (com a técnica).
   Sessão realizada Encontro concluído (duração, técnica, cliente).
   Favoritar A pessoa salvou o perfil (botão no perfil do terapeuta).
   Sentimento pós-sessão Seleção de sentimento(s) — apenas positivos e neutros, nunca negativos.
   Avaliação Nota (estrelas) e texto opcional.
   Procura sem disponibilidade Busca que casou com o terapeuta num dia/horário em que a agenda dele estava
   fechada. Alimenta o mapa de horários.
3. Contadores (topo do painel, nos dois planos, sem trava)
   Contador Cálculo
   Pessoas atendidas COUNT(DISTINCT cliente). Cada pessoa conta uma vez, mesmo com várias
   sessões.
   Sessões realizadas COUNT(sessões). Total de encontros; a mesma pessoa pode somar várias.
   Tempo de atendimento SUM(duração das sessões), em horas.
   Sistema de Métricas · TES · guia do desenvolvedor · 2
4. Catálogo de métricas
   Premium — a fotografia (números do presente).
   Métrica Cálculo Unidade Trava
   Quantas pessoas te viram Pessoas para quem o perfil apareceu no período,
   com comparação ao período anterior
   pessoas —
   Quantas quiseram te
   Nº de aberturas de perfil pessoas —
   conhecer melhor
   Quantas seguiram para
   agendar
   Nº de cliques em agendar pessoas —
   Por quais temas você é
   Aparições por tema (uma pessoa pode contar em
   pessoas/tema —
   encontrado
   vários)
   Quais técnicas suas mais
   aparecem
   Aparições por técnica pessoas/técnica —
   O carinho que você recebeu Contagem de sentimentos pós-sessão (positivos
   pessoas/sentimento 10
   e neutros; nunca negativos)
   Suas avaliações Distribuição de notas + temas agregados do
   retorno (inclui o crítico, anônimo). Privado.
   privado 10
   Premium Plus — a leitura (padrão, vínculo e tempo). Inclui tudo do Premium e
   mais:
   Métrica Cálculo Unidade Trava
   Clientes que voltaram Pessoas distintas com 2 ou mais sessões pessoas 10
   Quais técnicas mais geram
   Por técnica: aparições × agendamentos (visibilidade
   por técnica 10 + guarda
   agendamentos
   × conversão)
   Sua trajetória Série temporal, mês a mês (recorte a definir — ver
   §9)
   série 10
   Quantas vezes foi favoritado COUNT(favoritar) pessoas 10
   Favoritos que viraram
   encontro
   Favoritadores que agendaram ÷ total de
   favoritadores
   proporção 10
   Em qual técnica as pessoas
   Retornos por técnica (soma ≤ clientes que
   pessoas/técnica 10 + guarda
   mais voltam
   voltaram)
   Seus horários: procura e
   agenda
   Mapa dia×período: procura que veio ao próprio
   terapeuta × disponibilidade dele; com filtro por
   técnica
   mapa 10
5. Agenda: lógica de oferta e demanda (lacuna)
   O ponto mais sensível do sistema. A regra existe para evitar efeito manada.
   • O destaque de “oportunidade” é a lacuna. Lacuna = procura − oferta naquele dia/horário/técnica,
   ancorada no sinal do PRÓPRIO terapeuta (procuraram ele e a agenda estava fechada). Não é
   demanda bruta.
   • Autocorrigível. Ao abrir o horário, a oferta sobe, a lacuna fecha, e o sistema deixa de sinalizar — a
   procura se regula sozinha.
   • Nunca demanda agregada igual para todos. Mostrar “tal horário está quente” para todos os
   terapeutas da técnica faz todos abrirem o mesmo horário e a oportunidade se autodestrói. Se um
   dia usar agregado, sempre como lacuna e com escalonamento/rotação do sinal.
   Sistema de Métricas · TES · guia do desenvolvedor · 3
   • Nunca prometer cliente. A copy fala de procura observada (“procuraram você aqui”), nunca de
   garantia de agendamento.
6. Privacidade (LGPD)
   • Exibir só dados agregados. Nunca o comentário ou o retorno literal de um cliente.
   • Não permitir combinação de filtros que reconstrua quem é a pessoa (sobretudo em baixo volume).
   • Respeitar a trava de 10 (e o volume mínimo da guarda) antes de exibir qualquer leitura qualitativa.
   • Consentimento e anonimização conforme já definido no sistema de Match.
7. Salvaguardas de exibição
   • Trava de acúmulo. Ver a coluna “Trava”. Abaixo do limiar, exibir estado de espera (“fica disponível
   a partir de N…”), nunca um número parcial.
   • Guarda de amostra pequena. Abaixo de um volume mínimo, não afirmar comparação nem causa
   (“X converte melhor que Y”). Descrever como tendência a observar.
   • Copy por direção. O texto de cada número varia conforme subiu, ficou estável ou caiu. Nunca um
   texto celebratório fixo que vira deboche quando o número cai.
8. Fora do painel e só-admin
   • Cuidando do seu perfil. Orientação (completude do perfil + próximo passo), não é métrica.
   Aparece nos dois planos.
   • Tendência de demanda. Quais temas estão em alta no portal. Uso interno (admin). NÃO exibir ao
   terapeuta — exibir incentivaria inflar o cadastro para caçar cliques.
9. Dependências e o que calibrar
   • Dependências (confirmadas). Botão de favoritar no perfil do terapeuta; rastreio de “procura sem
   disponibilidade” para o mapa de horários.
   • A calibrar com dados reais. O limiar de acúmulo (hoje 10), o volume mínimo da guarda de
   amostra, as janelas de período (mês/semana) e o recorte da métrica “Sua trajetória”.
   Referências: este guia anda junto com a especificação do Match, o protótipo do painel (HTML) e o
   documento “Fala Humana do TES”.
   Sistema de Métricas · TES · guia do desenvolvedor
