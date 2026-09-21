import content from "./legal-document-content.json";
import { cancellationRescheduleRefundPolicyV2 } from "./cancellation-reschedule-refund-policy-v2";

import type { LegalDocumentKey } from "./legal-registry";

type LegalDocumentContentEntry = {
  paragraphs: string[];
  sourceFile: string;
};

type LegalDocumentContentRegistry = {
  documents: Partial<Record<LegalDocumentKey, LegalDocumentContentEntry>>;
  generatedAt: string;
};

const termsOfUse = content.documents["terms-of-use"];
const termsOfUseV3Additions = [
  "Ao concluir a contratação por meio da Plataforma, o usuário poderá optar pelo agendamento e realização do atendimento antes do término do prazo de 7 (sete) dias previsto no artigo 49 do Código de Defesa do Consumidor. Nessa hipótese, declara ciência de que está solicitando o início imediato da prestação do serviço, observando-se a Política de Cancelamento, Reagendamento e Reembolso e a legislação aplicável.",
  "Cláusula 6.10 – Agendamentos realizados dentro das 24 (vinte e quatro) horas anteriores ao atendimento",
  "Quando o usuário realizar o agendamento para ocorrer dentro das 24 (vinte e quatro) horas seguintes, a cobrança será realizada imediatamente, condicionada à aprovação da operação pelo responsável pelo processamento do pagamento. Após a confirmação, o cancelamento ou reagendamento pelo usuário não estarão disponíveis pelo fluxo regular da Plataforma quando o próprio agendamento tiver sido realizado nesse período. Esta regra não se aplica quando a impossibilidade de realização for atribuível ao terapeuta ou ao TES e não afasta direitos assegurados ao usuário por norma legal de caráter cogente. Situações excepcionais e suas consequências financeiras observarão estes Termos, a Política de Cancelamento, Reagendamento e Reembolso e a legislação aplicável.",
  "Cláusula 6.10-A – Reagendamento solicitado pelo terapeuta",
  "O terapeuta poderá solicitar o reagendamento de atendimento previamente agendado somente enquanto faltarem mais de 48 (quarenta e oito) horas para o horário previsto. Após esse prazo, a solicitação não estará disponível. Realizada a solicitação dentro do prazo, o atendimento aguardará a resposta do usuário por 23 (vinte e três) horas. Caso aceite, caberá ao usuário selecionar uma nova data e horário dentre aqueles disponibilizados pelo terapeuta, que não poderá definir unilateralmente o novo horário.",
  "Com a escolha do novo horário pelo usuário, o agendamento original será cancelado e será realizado novo agendamento. Se o novo atendimento estiver previsto para ocorrer em prazo superior a 24 (vinte e quatro) horas, a cobrança será realizada 24 (vinte e quatro) horas antes; se ocorrer dentro das 24 (vinte e quatro) horas seguintes, a cobrança será imediata, condicionada à aprovação do pagamento. Caso o usuário recuse expressamente, o atendimento original e a cobrança futura serão cancelados, sem cobrança. Caso não haja manifestação em 23 (vinte e três) horas, o atendimento original e a cobrança futura serão automaticamente cancelados. A ausência de resposta não será considerada aceite, cancelamento solicitado pelo usuário ou falta, e não poderá gerar penalização financeira. A solicitação, manifestação, eventual expiração e seus efeitos deverão permanecer registrados na Plataforma.",
  "Cláusula 6.11 – Cancelamento, reagendamento e reembolso",
  "As regras aplicáveis ao cancelamento, reagendamento e reembolso observarão estes Termos e a Política de Cancelamento, Reagendamento e Reembolso do TES. Na aplicação conjunta, serão consideradas as condições específicas da ocorrência, incluindo o momento em que ocorrer, a parte que iniciou a solicitação, o estado do atendimento e, quando aplicável, o estado financeiro da contratação. Nenhuma disposição destes Termos ou da Política poderá afastar direitos assegurados ao usuário por norma legal de caráter cogente.",
];

const legalDocumentContent: LegalDocumentContentRegistry = {
  ...content,
  generatedAt: "2026-09-21",
  documents: {
    ...content.documents,
    "cancellation-reschedule-refund-policy":
      cancellationRescheduleRefundPolicyV2,
    "terms-of-use": termsOfUse
      ? {
          ...termsOfUse,
          sourceFile: "TERMOS DE USO V3 (1).pdf",
          paragraphs: termsOfUse.paragraphs.flatMap((paragraph) => {
            const updatedParagraph = paragraph
              .replace(
                "III – Contrato de Adesão do Terapeuta (quando aplicável); ",
                "",
              )
              .replace(
                /V – Atendimento:.*$/,
                "V – Atendimento: sessão ou atividade realizada entre usuário e terapeuta exclusivamente online, conforme serviço disponibilizado pelo profissional e contratado pelo usuário.",
              )
              .replace(
                "XI – Sessão: período de atendimento contratado pelo usuário junto ao terapeuta, realizado mediante os recursos disponibilizados pela plataforma ou por outro meio expressamente informado pelo profissional.",
                "XI – Sessão: período de atendimento contratado pelo usuário junto ao terapeuta, realizado online mediante os recursos disponibilizados pela plataforma.",
              );

            if (updatedParagraph.startsWith("Cláusula 6.1 –")) {
              return [
                "Cláusula 6.1 – Contratação e cobrança dos serviços Os serviços disponibilizados na Plataforma poderão ser contratados diretamente pelos usuários mediante as funcionalidades do TES, observadas a disponibilidade do terapeuta, a data e horário selecionados e as regras de pagamento aplicáveis. Quando o atendimento for agendado com antecedência superior a 24 (vinte e quatro) horas, a cobrança será realizada automaticamente 24 (vinte e quatro) horas antes do horário agendado. Quando for agendado para ocorrer dentro das 24 (vinte e quatro) horas seguintes, a cobrança será realizada imediatamente, condicionada à aprovação do pagamento. O agendamento, por si só, não confirma o pagamento; o atendimento somente será considerado pago após a confirmação da cobrança. O processamento, a disponibilização de valores e os repasses observarão estes Termos e as condições do meio de pagamento utilizado.",
              ];
            }

            if (updatedParagraph.startsWith("Cláusula 6.5 –")) {
              return [
                "Cláusula 6.5 – Comissão da Plataforma e Repasses Financeiros Pela utilização da Plataforma para intermediação dos atendimentos, o TES fará jus à comissão de 15% (quinze por cento) do valor efetivamente cobrado, cabendo ao terapeuta 85% (oitenta e cinco por cento). A comissão será descontada antes da disponibilização do valor ao terapeuta. Como regra geral, as tarifas cobradas pelo responsável pelo processamento do pagamento serão suportadas pelo TES e não serão deduzidas do percentual de 85% destinado ao terapeuta. Quando o cancelamento for realizado pelo terapeuta, as tarifas relacionadas à operação serão de sua responsabilidade; quando realizado pelo usuário, serão suportadas pelo TES, observadas as demais regras de cancelamento, reembolso, estorno, reversão e compensação.",
                "Os valores e critérios das tarifas serão os definidos pelo respectivo responsável pelo pagamento. Após a confirmação da cobrança, o TES criará a transferência correspondente a 85% do valor efetivamente cobrado para a conta conectada vinculada ao terapeuta. A criação da transferência não significa disponibilidade imediata para utilização ou recebimento bancário. Os prazos de liquidação, disponibilização e depósito poderão variar conforme o meio de pagamento, origem da transação, fins de semana, feriados, procedimentos de segurança, análise de risco, prevenção a fraudes, regras do responsável pelo pagamento e procedimentos da instituição bancária destinatária.",
                "Em cancelamento, reembolso, estorno, reversão, chargeback, contestação, duplicidade, erro operacional ou outra ocorrência que exija ajuste, o TES poderá adotar as medidas necessárias à regularização. Caso a transferência ao terapeuta já tenha sido criada, poderá ser revertida total ou parcialmente conforme a responsabilidade financeira atribuída. Quando não for possível recuperar integralmente o valor devido mediante reversão, o saldo constituirá obrigação financeira do terapeuta perante o TES e poderá ser compensado em recebimentos futuros, com registro individualizado. Reembolso ao usuário e recuperação de valores de responsabilidade do terapeuta são operações distintas e podem ser processadas e conciliadas separadamente. A confirmação da cobrança, a transferência, a disponibilização de saldo e o depósito bancário são etapas distintas. Cada parte permanecerá responsável pelas obrigações tributárias que lhe forem legalmente atribuídas.",
              ];
            }

            if (updatedParagraph.startsWith("Ao concluir a contratação")) {
              return termsOfUseV3Additions;
            }

            return [updatedParagraph];
          }),
        }
      : undefined,
  },
};

export function getLegalDocumentContent(documentKey: LegalDocumentKey) {
  return legalDocumentContent.documents[documentKey];
}
