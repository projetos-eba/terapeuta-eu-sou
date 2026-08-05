-- Seeds the Match theme/refinement taxonomy reviewed in
-- "TECNICAS_FINAL CATEGORIA E REFINAMENTO (2).xlsx".
-- The migration is intentionally non-destructive: therapies, services,
-- bookings, weights and historical rows are preserved.

insert into public.matching_versions (
  id,
  status,
  version,
  published_at
)
select
  gen_random_uuid(),
  'published',
  coalesce((select max(version) from public.matching_versions), 0) + 1,
  now()
where not exists (
  select 1
  from public.matching_versions
  where status = 'published'
);

with source_themes(slug, name, description, image_url, sort_order) as (
  values
    ('emocoes-bem-estar', 'Emoções e Bem-Estar', 'Sentimentos, ansiedade, estresse e sobrecarga emocional apresentados como temas de cuidado e reflexão.', '/journey/emocoes-bem-estar.png', 1),
    ('autoconhecimento-transformacao', 'Autoconhecimento e Transformação', 'Perguntas sobre identidade, padrões, autoaceitação e desenvolvimento pessoal.', '/journey/autoconhecimento-transformacao.png', 2),
    ('relacionamentos', 'Relacionamentos', 'Vínculos familiares, amorosos e sociais observados com responsabilidade e sem promessa de resultado.', '/journey/relacionamentos.png', 3),
    ('autoestima-poder-pessoal', 'Autoestima e Poder Pessoal', 'Confiança, autoimagem, insegurança e amor próprio em linguagem acolhedora.', '/journey/autoestima-poder-pessoal.png', 4),
    ('proposito-direcao', 'Propósito e Direção', 'Clareza de vida, escolhas, vocação e recomeços tratados como caminhos de reflexão.', '/journey/proposito-direcao.png', 5),
    ('espiritualidade', 'Espiritualidade e Conexão Interior', 'Conexão espiritual, intuição e alinhamento interior sem prometer previsões ou garantias.', '/journey/espiritualidade.png', 6),
    ('energia-equilibrio-energetico', 'Energia e Equilíbrio Energético', 'Percepções de cansaço, bloqueio e equilíbrio energético dentro de práticas complementares.', '/journey/energia-equilibrio-energetico.png', 7),
    ('libertacao-renovacao', 'Libertação e Renovação', 'Encerramento de ciclos, passado, mágoas e abertura para novos caminhos.', '/journey/libertacao-renovacao.png', 8),
    ('corpo-relaxamento-qualidade-vida', 'Corpo, Relaxamento e Qualidade de Vida', 'Relaxamento, sono, tensões e reconexão corporal em contexto exclusivamente online.', '/journey/corpo-relaxamento-qualidade-vida.png', 9),
    ('vida-profissional-prosperidade', 'Vida Profissional e Prosperidade', 'Trabalho, carreira, prosperidade e relação com dinheiro sem aconselhamento financeiro.', '/journey/vida-profissional-prosperidade.png', 10)
)
insert into public.matching_themes (
  name,
  slug,
  description,
  image_url,
  sort_order,
  is_active
)
select
  name,
  slug,
  description,
  image_url,
  sort_order,
  true
from source_themes
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

with canonical_theme_slugs(slug) as (
  values
    ('emocoes-bem-estar'),
    ('autoconhecimento-transformacao'),
    ('relacionamentos'),
    ('autoestima-poder-pessoal'),
    ('proposito-direcao'),
    ('espiritualidade'),
    ('energia-equilibrio-energetico'),
    ('libertacao-renovacao'),
    ('corpo-relaxamento-qualidade-vida'),
    ('vida-profissional-prosperidade')
)
update public.matching_themes as theme
set
  is_active = false,
  updated_at = now()
where theme.slug not in (select slug from canonical_theme_slugs)
  and not exists (
    select 1
    from public.therapy_matching_themes as therapy_theme
    where therapy_theme.theme_id = theme.id
  )
  and not exists (
    select 1
    from public.therapist_service_matching_themes as service_theme
    where service_theme.theme_id = theme.id
  );

with source_interests(theme_slug, slug, name, sort_order) as (
  values
    ('emocoes-bem-estar', 'ansiedade', 'Ansiedade', 1),
    ('emocoes-bem-estar', 'estresse', 'Estresse', 2),
    ('emocoes-bem-estar', 'medo', 'Medo', 3),
    ('emocoes-bem-estar', 'tristeza', 'Tristeza', 4),
    ('emocoes-bem-estar', 'irritacao', 'Irritação', 5),
    ('emocoes-bem-estar', 'sobrecarga-emocional', 'Sobrecarga emocional', 6),
    ('emocoes-bem-estar', 'sensibilidade-excessiva', 'Sensibilidade excessiva', 7),
    ('autoconhecimento-transformacao', 'entender-a-si-mesmo', 'Entender a si mesmo', 1),
    ('autoconhecimento-transformacao', 'identificar-padroes', 'Identificar padrões', 2),
    ('autoconhecimento-transformacao', 'clareza-emocional', 'Clareza emocional', 3),
    ('autoconhecimento-transformacao', 'autoaceitacao', 'Autoaceitação', 4),
    ('autoconhecimento-transformacao', 'desenvolvimento-pessoal', 'Desenvolvimento pessoal', 5),
    ('relacionamentos', 'conflitos-familiares', 'Conflitos familiares', 1),
    ('relacionamentos', 'relacionamentos-amorosos', 'Relacionamentos amorosos', 2),
    ('relacionamentos', 'separacoes', 'Separações', 3),
    ('relacionamentos', 'dependencia-emocional', 'Dependência emocional', 4),
    ('relacionamentos', 'perdao', 'Perdão', 5),
    ('relacionamentos', 'solidao', 'Solidão', 6),
    ('relacionamentos', 'dificuldade-de-impor-limites', 'Dificuldade de impor limites', 7),
    ('autoestima-poder-pessoal', 'fortalecer-a-confianca', 'Fortalecer a confiança', 1),
    ('autoestima-poder-pessoal', 'melhorar-a-autoimagem', 'Melhorar a autoimagem', 2),
    ('autoestima-poder-pessoal', 'trabalhar-a-inseguranca', 'Trabalhar a insegurança', 3),
    ('autoestima-poder-pessoal', 'desenvolver-amor-proprio', 'Desenvolver amor próprio', 4),
    ('autoestima-poder-pessoal', 'superar-a-autocritica', 'Superar a autocrítica', 5),
    ('proposito-direcao', 'clareza-de-vida', 'Clareza de vida', 1),
    ('proposito-direcao', 'proposito', 'Propósito', 2),
    ('proposito-direcao', 'vocacao', 'Vocação', 3),
    ('proposito-direcao', 'decisoes-importantes', 'Decisões importantes', 4),
    ('proposito-direcao', 'recomecos', 'Recomeços', 5),
    ('espiritualidade', 'conexao-espiritual', 'Conexão espiritual', 1),
    ('espiritualidade', 'expansao-de-consciencia', 'Expansão de consciência', 2),
    ('espiritualidade', 'intuicao', 'Intuição', 3),
    ('espiritualidade', 'desenvolvimento-espiritual', 'Desenvolvimento espiritual', 4),
    ('espiritualidade', 'alinhamento-interior', 'Alinhamento interior', 5),
    ('energia-equilibrio-energetico', 'cansaco-energetico', 'Cansaço energético', 1),
    ('energia-equilibrio-energetico', 'bloqueios-energeticos', 'Bloqueios energéticos', 2),
    ('energia-equilibrio-energetico', 'sensacao-de-peso', 'Sensação de peso', 3),
    ('energia-equilibrio-energetico', 'desequilibrio-energetico', 'Desequilíbrio energético', 4),
    ('energia-equilibrio-energetico', 'necessidade-de-revitalizacao', 'Necessidade de revitalização', 5),
    ('energia-equilibrio-energetico', 'protecao-energetica', 'Proteção energética', 6),
    ('libertacao-renovacao', 'encerrar-ciclos', 'Encerrar ciclos', 1),
    ('libertacao-renovacao', 'soltar-o-passado', 'Soltar o passado', 2),
    ('libertacao-renovacao', 'liberar-crencas-limitantes', 'Liberar crenças limitantes', 3),
    ('libertacao-renovacao', 'trabalhar-magoas', 'Trabalhar mágoas', 4),
    ('libertacao-renovacao', 'superar-bloqueios-emocionais', 'Superar bloqueios emocionais', 5),
    ('libertacao-renovacao', 'abrir-espaco-para-o-novo', 'Abrir espaço para o novo', 6),
    ('corpo-relaxamento-qualidade-vida', 'relaxamento-profundo', 'Relaxamento profundo', 1),
    ('corpo-relaxamento-qualidade-vida', 'melhora-do-sono', 'Melhora do sono', 2),
    ('corpo-relaxamento-qualidade-vida', 'reducao-de-tensoes', 'Redução de tensões', 3),
    ('corpo-relaxamento-qualidade-vida', 'reconexao-corporal', 'Reconexão corporal', 4),
    ('corpo-relaxamento-qualidade-vida', 'presenca', 'Presença', 5),
    ('corpo-relaxamento-qualidade-vida', 'equilibrio-corpo-mente', 'Equilíbrio corpo-mente', 6),
    ('vida-profissional-prosperidade', 'prosperidade-e-abundancia', 'Prosperidade e abundância', 1),
    ('vida-profissional-prosperidade', 'bloqueios-financeiros', 'Bloqueios financeiros', 2),
    ('vida-profissional-prosperidade', 'relacao-com-dinheiro', 'Relação com dinheiro', 3),
    ('vida-profissional-prosperidade', 'crescimento-na-carreira', 'Crescimento na carreira', 4),
    ('vida-profissional-prosperidade', 'transicao-profissional', 'Transição profissional', 5),
    ('vida-profissional-prosperidade', 'produtividade', 'Produtividade', 6)
),
resolved as (
  select
    theme.id as theme_id,
    source_interests.slug,
    source_interests.name,
    source_interests.sort_order
  from source_interests
  join public.matching_themes as theme
    on theme.slug = source_interests.theme_slug
)
insert into public.matching_interests (
  theme_id,
  name,
  slug,
  sort_order,
  is_active
)
select
  theme_id,
  name,
  slug,
  sort_order,
  true
from resolved
on conflict (slug) do update
set
  name = excluded.name,
  theme_id = case
    when not exists (
      select 1
      from public.therapist_service_matching_interests as service_interest
      where service_interest.interest_id = matching_interests.id
    ) then excluded.theme_id
    else matching_interests.theme_id
  end,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

with canonical_interest_slugs(slug) as (
  values
    ('ansiedade'),
    ('estresse'),
    ('medo'),
    ('tristeza'),
    ('irritacao'),
    ('sobrecarga-emocional'),
    ('sensibilidade-excessiva'),
    ('entender-a-si-mesmo'),
    ('identificar-padroes'),
    ('clareza-emocional'),
    ('autoaceitacao'),
    ('desenvolvimento-pessoal'),
    ('conflitos-familiares'),
    ('relacionamentos-amorosos'),
    ('separacoes'),
    ('dependencia-emocional'),
    ('perdao'),
    ('solidao'),
    ('dificuldade-de-impor-limites'),
    ('fortalecer-a-confianca'),
    ('melhorar-a-autoimagem'),
    ('trabalhar-a-inseguranca'),
    ('desenvolver-amor-proprio'),
    ('superar-a-autocritica'),
    ('clareza-de-vida'),
    ('proposito'),
    ('vocacao'),
    ('decisoes-importantes'),
    ('recomecos'),
    ('conexao-espiritual'),
    ('expansao-de-consciencia'),
    ('intuicao'),
    ('desenvolvimento-espiritual'),
    ('alinhamento-interior'),
    ('cansaco-energetico'),
    ('bloqueios-energeticos'),
    ('sensacao-de-peso'),
    ('desequilibrio-energetico'),
    ('necessidade-de-revitalizacao'),
    ('protecao-energetica'),
    ('encerrar-ciclos'),
    ('soltar-o-passado'),
    ('liberar-crencas-limitantes'),
    ('trabalhar-magoas'),
    ('superar-bloqueios-emocionais'),
    ('abrir-espaco-para-o-novo'),
    ('relaxamento-profundo'),
    ('melhora-do-sono'),
    ('reducao-de-tensoes'),
    ('reconexao-corporal'),
    ('presenca'),
    ('equilibrio-corpo-mente'),
    ('prosperidade-e-abundancia'),
    ('bloqueios-financeiros'),
    ('relacao-com-dinheiro'),
    ('crescimento-na-carreira'),
    ('transicao-profissional'),
    ('produtividade')
)
update public.matching_interests as interest
set
  is_active = false,
  updated_at = now()
where interest.slug not in (select slug from canonical_interest_slugs)
  and not exists (
    select 1
    from public.therapist_service_matching_interests as service_interest
    where service_interest.interest_id = interest.id
  );
