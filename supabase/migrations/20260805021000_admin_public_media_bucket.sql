-- Public media uploaded by TES admins for catalog and Match surfaces.
-- Reads are public; writes remain restricted to authenticated admin profiles.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-public-media',
  'admin-public-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public admin media is readable"
  on storage.objects;
create policy "Public admin media is readable"
on storage.objects
for select
using (bucket_id = 'admin-public-media');

drop policy if exists "Admins manage admin public media"
  on storage.objects;
create policy "Admins manage admin public media"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'admin-public-media'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  bucket_id = 'admin-public-media'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

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
