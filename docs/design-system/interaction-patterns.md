# Interaction Patterns TES

Status: autoridade global de estados e feedback  
Versão: 2026-08-13

## Estados obrigatórios

Todo componente interativo aplicável deve definir:

- default, hover, focus-visible, pressed e disabled;
- loading sem mudança brusca de largura;
- success somente após confirmação real;
- error com impacto e próximo passo;
- empty, forbidden e unavailable como estados distintos.

## Feedback

- Responder imediatamente ao gesto com pressed, loading ou atualização local segura.
- Usar feedback inline quando pertence a um campo ou entidade; toast serve para resultado global breve.
- Não depender apenas de toast para falha que exige correção.
- Preservar dados digitados após erro recuperável.
- Não apresentar retorno de navegador como confirmação de pagamento, sessão, publicação ou integração assíncrona.

## Optimistic UI

Permitir apenas quando a ação for reversível, de baixo risco e tiver rollback
claro. Favoritar pode ser otimista; pagamento, cancelamento, publicação,
reagendamento e mudança de permissão exigem confirmação autoritativa.

## Loading

- Skeleton deve refletir a estrutura provável e não inventar conteúdo.
- Operação curta pode usar spinner no controle, preservando label quando possível.
- Em listas, manter filtros e contexto disponíveis durante reload.
- Timeout ou falha vira indisponibilidade explícita; nunca coleção vazia.

## Erros e vazio

| Estado           | Mensagem deve responder                              | Ação típica                                 |
| ---------------- | ---------------------------------------------------- | ------------------------------------------- |
| Empty real       | o que ainda não existe?                              | criar, descobrir ou aguardar                |
| Sem resultado    | quais filtros limitaram?                             | limpar ou ajustar filtros                   |
| Forbidden        | por que não está disponível em linguagem de produto? | voltar ou solicitar acesso quando aplicável |
| Unavailable      | o que não pôde ser carregado?                        | tentar novamente ou buscar suporte          |
| Validation error | o que precisa ser corrigido?                         | foco no primeiro campo inválido             |

## Movimento

- Movimento explica mudança de estado, relação espacial ou continuidade.
- Evitar animação ornamental recorrente em superfícies operacionais.
- Respeitar `prefers-reduced-motion`.
- Não bloquear interação esperando animação visual terminar.

## Foco, teclado e toque

- Usar `:focus-visible` com contraste suficiente e sem remover outline sem substituição.
- Ordem de tabulação segue leitura e prioridade, não posicionamento visual artificial.
- Icon buttons sempre recebem nome acessível.
- Alvo touch mínimo de `44px`, mesmo quando o ícone visível for menor.
- Dialogs usam `TESDialog`; não criar `role="dialog"` diretamente em features.
