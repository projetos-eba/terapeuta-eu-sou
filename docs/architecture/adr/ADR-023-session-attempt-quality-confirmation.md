# ADR-023 — Tentativa da sessão, qualidade e confirmação independente

Data: 2026-09-17  
Status: evolução do envio único implementada localmente em 2026-09-17; PR manual e reteste HML pendentes.

## Decisão

Cada reserva possui um identificador de tentativa. Mudanças de status não o
trocam; reagendamento efetivo troca e preserva o histórico anterior. Chegada
autenticada ou join próprio até T+10 exato contam como presença pontual. Após
T+10, a primeira execução do finalizador classifica ausência de cliente,
terapeuta ou ambos, sem aguardar o encerramento físico da sala. Ambos chegarem
sem joins bilaterais até o fim exige análise técnica, não avaliação.
Se os dois joins confiáveis forem registrados posteriormente, o Admin pode
encerrar essa análise técnica com justificativa; isso não confirma em nome das
pessoas nem altera pagamento ou Transfer.

Realização deriva exclusivamente da presença confiável bilateral na tentativa
atual e do encerramento; Transfer e declaração de formulário não são prova.
O formulário privado pergunta “Essa sessão foi bem-sucedida?”: “Sim” exige
1–5 estrelas; “Não” exige somente problema de internet, problema técnico de
áudio/vídeo ou outro. Observações são opcionais até 500 caracteres. Resposta
negativa mantém a sessão realizada, cria relato e ticket privados do autor,
com prazo de cinco dias corridos a partir do envio. Só resposta pública do TES
no ticket correto conclui o relato; nota interna e mudança de status não contam.
Relatos dos dois participantes têm tickets e prazos independentes.
A lista privada do terapeuta exibe apenas suas próprias respostas, inclusive
as históricas; não projeta o comentário privado do cliente.

Enquanto qualquer relato ainda estiver sem resposta e dentro dos cinco dias,
novas confirmações automáticas pausam. Ao responder todos, a apresentação é
“Realizada (confirmada)”, sem inventar confirmações individuais. Após o prazo,
“Realizada, em análise” e alerta Admin persistem, mas a automação retoma.
Vencimentos de confirmação continuam os originais: sete dias do fim previsto
para cliente, trinta para terapeuta. A automação revalida a presença atual,
nunca confirma “Não realizada”, registra autoria do sistema e não cria nota ou
opinião em nome das pessoas. Confirmações prévias não são reescritas.

Qualidade, classificação e confirmação não criam nem alteram pagamento,
Transfer, Reversal ou Refund. O leitor V10 jamais infere confirmação do Transfer
nem reintroduz lote semanal ou período de segurança. Reembolso por ausência do
terapeuta, sozinho ou junto do cliente, é exclusivamente integral, autorizado
pelo Admin no comando financeiro próprio com justificativa; não há reagendamento.
A análise de qualidade não oferece decisão financeira.

O contrato `/api/session-feedback` versão 2 exige perfil solicitante, tentativa,
sucesso, motivo, nota, comentário e request ID. O perfil escolhe exclusivamente
seu próprio cookie, mesmo quando há duas sessões no navegador; a identidade,
vínculo, presença e versão são
validados no servidor. Contrato antigo ou tentativa desatualizada não alteram
a atual. Relatos legados ficam em seção histórica, sem conversão silenciosa.

### Envio único de avaliação e confirmação individual

Para evitar duas respostas da mesma pessoa, o envio da avaliação privada da
tentativa atual registra, na mesma transação, a confirmação individual de que
essa pessoa participou da sessão. Tanto “Sim” quanto “Não” confirmam a
participação; “Não” continua sendo uma avaliação negativa da experiência, não
uma declaração de ausência. A identidade, os dois joins confiáveis, o
encerramento e a tentativa atual são revalidados pelo servidor. A confirmação
da outra pessoa permanece independente. Repetições preservam a resposta e a
confirmação já registradas; conflito ou falha desfazem ambas as escritas.
Esta união é somente da ação de interface: avaliação, confirmação, presença e
financeiro continuam como registros e decisões separados.

Uma migração progressiva regulariza somente avaliações já persistidas na
tentativa atual que ainda não tinham confirmação individual, com presença
bilateral e encerramento comprovados, sem ocorrência aberta e com pagamento em
estado elegível. Não inventa respostas para formulários que não foram gravados.

Para o Histórico da Jornada do Premium Plus, a mesma evidência operacional
inclui a sessão passada realizada mesmo quando não houver resumo compartilhado.
O histórico mostra a confirmação como pendente ou confirmada sem usar estado
financeiro como substituto de presença. A seleção privada de até três temas
fechados fica disponível ao terapeuta após sua avaliação positiva da tentativa
atual, presença bilateral confiável e encerramento; a confirmação independente
continua sem ser requisito para os temas.

## Operação e liberação

Gate registrado em 2026-09-17: a evolução do read model privado da jornada e
da RPC de temas foi aprovada antes da migration. A mudança não cria tabelas,
não altera RLS existente e não muda pagamentos, repasses, Aura, métricas ou
exportações.

O finalizador filtra candidatos antes do limite. A manutenção da sala exclui
jobs existentes antes do limite, respeita `next_run_at`, registra dead letters
para intervenção e encerra apenas por ID persistido ou correspondência exata
única. Testes usam banco local isolado com rollback e preservam snapshots
financeiros. Nenhuma migração deste ADR deve ser aplicada a HML/produção sem
etapa separada de inspeção de divergências, implantação supervisionada e
revisão da sessão HML original.

Resolver a ocorrência de ausência ou autorizar seu reembolso não invalida o
encerramento físico pendente da sala. O trabalho permanece limitado à tentativa
atual e ao horário correspondente; o reagendamento concorrente invalida esse
encerramento. Alterar apenas o fuso de apresentação não cria nova tentativa.

### Reentrada técnica com identificador reutilizado

O identificador remoto do Zoom não substitui a tentativa da reserva nem pode
ser tratado como identidade permanente de uma sala. Uma reentrada posterior ao
fechamento técnico abre uma época operacional sanitizada dentro da mesma
tentativa, inclusive quando o provider reutiliza o identificador. A presença
atual é derivada apenas da época aberta mais recente; eventos anteriores não
podem retirar presença, reabrir encerramento terminal ou alterar a classificação
operacional, qualidade, confirmação ou financeiro.
