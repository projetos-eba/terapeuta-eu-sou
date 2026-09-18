# Ausência do paciente: HML e correção local

## Reprodução observada

Em 18/09/2026, a reserva `49dada35-0200-4d9c-9ede-7cc2b358fd86`
(`26S000160`), das 20h às 20h20 em São Paulo, foi acompanhada pelo IAB.
Somente o terapeuta entrou. O paciente não foi aberto na espera ou no vídeo.
As consultas remotas foram de leitura; nenhuma migration ou Function foi
publicada durante esta investigação.

- Chegada do terapeuta: 20:02:44; join confiável: 20:02:57.
- Paciente sem chegada ou join; terapeuta pontual confirmado pela evidência.
- Às 20:10:01, o finalizador criou `end_attendance_no_show`.
- Às 20:10:02, reserva `no_show_patient`, versão 4; job `done`, uma tentativa.
  A sala continuava `active`, com pedido `attendance_no_show` e sem confirmação
  de encerramento. A interface ainda mostrava “Aguardando paciente entrar”.
- O cron de maintenance estava ativo a cada minuto; o de confirmação, às
  XXh07. Não havia feedback ou confirmação individual nesta sessão.
- Às 20:20:02, `end_scheduled` foi concluído na primeira tentativa. Sala
  `ended`, encerramento confirmado, reserva ainda `no_show_patient`. Evidência
  final: paciente sem qualquer chegada/join, terapeuta pontual, sem joins
  bilaterais; feedback e confirmações permaneceram zerados. A sala mostrou
  recuperação genérica de acesso no fim; no detalhe, “Sessão não realizada”,
  orientação de suporte e avaliação indisponível.

## Causa e alteração

O RPC `reserve_video_session_control_jobs_v1` retorna os identificadores,
operação e tentativas, mas não `metadata`. O worker pressupunha esse campo e
comparava uma versão ausente com a versão da reserva. O job era descartado
como superado antes de chamar o provedor.

O worker agora consulta apenas `metadata` do job reservado, filtrando ID,
reserva, sala e estado `processing`. As verificações existentes de versão,
horário e motivo permanecem antes de encerrar o ID exato no Zoom. Falha na
consulta mantém o mecanismo de retry. O contrato SQL não foi alterado.

Na sala dedicada do terapeuta, uma fronteira de apresentação consulta o
endpoint autenticado de feedback a cada 15 segundos, sem escrever respostas.
Somente ausência autoritativa do paciente no mesmo horário, com terapeuta
pontual, substitui a chamada pelo aviso de não comparecimento. A desmontagem
usa a limpeza já existente do adapter, cujo arquivo permanece inalterado.
Entrada pontual do paciente na espera ou no vídeo interrompe a observação;
reentrada, autorização host-first e avaliação bilateral continuam existentes.
Erros de rede não interrompem a chamada. Listas/detalhes continuam neutros.

## Validação local

- Interface Zoom: 135 testes, incluindo ausência, entrada prévia, falha de
  rede, horário antigo e resposta depois da desmontagem.
- Worker e contratos compartilhados: 31 testes, incluindo o payload real sem
  metadata, sessão exata, fence antigo e retry.
- SQL local: 7 arquivos, 143 testes transacionais de presença, reentrada,
  qualidade, privacidade e confirmação (incluindo reembolsadas).
- Typecheck e lint aprovados.
- Build concluído com 131 páginas. A suíte completa de Zoom foi repetida e
  aprovada após corrigir uma espera do teste existente de avaliação: aguardar
  o botão “Sim”, que aparece depois da consulta, em vez de apenas o título.

## Publicação posterior

Publicar o frontend e a Function `zoom-video-session-maintenance` no HML.
Não há migration nova. Repetir uma sessão com paciente ausente e outra com
entrada pontual seguida de saída/reentrada para validar o SDK real com o
worker atualizado. Os testes locais não substituem essa prova pós-publicação.
