-- Public media uploaded by TES admins for catalog and Match surfaces.
-- Reads are public; writes remain restricted to authenticated admin profiles.

-- The bucket is declared in config.toml. Storage policies are applied only
-- after the Storage service initializes its platform-owned schema.

update public.matching_themes
set image_url = case slug
  when 'emocoes-bem-estar' then '/journey/emocoes-bem-estar.png'
  when 'relacionamentos' then '/journey/relacionamentos.png'
  when 'autoconhecimento-transformacao' then '/journey/autoconhecimento-transformacao.png'
  when 'proposito-direcao' then '/journey/proposito-direcao.png'
  when 'autoestima-poder-pessoal' then '/journey/autoestima-poder-pessoal.png'
  when 'espiritualidade' then '/journey/espiritualidade-conexao-interior.png'
  when 'energia-equilibrio-energetico' then '/journey/energia-equilibrio.png'
  when 'libertacao-renovacao' then '/journey/libertacao-renovacao.png'
  when 'corpo-relaxamento-qualidade-vida' then '/journey/corpo-relaxamento.png'
  when 'vida-profissional-prosperidade' then '/journey/vida-profissional-prosperidade.png'
  else image_url
end,
updated_at = now()
where slug in (
  'emocoes-bem-estar',
  'relacionamentos',
  'autoconhecimento-transformacao',
  'proposito-direcao',
  'autoestima-poder-pessoal',
  'espiritualidade',
  'energia-equilibrio-energetico',
  'libertacao-renovacao',
  'corpo-relaxamento-qualidade-vida',
  'vida-profissional-prosperidade'
);
