-- Protege la base de Organización de Alimentos: solo el usuario de la app (organizacion@lachacra.app),
-- con sesión iniciada, puede leer o modificar. Aplica a TODAS las tablas de public.
-- Correr DESPUÉS de que la página nueva (login con Supabase Auth) esté publicada y probada.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo usuario app" on public.%I', t);
    execute format($p$create policy "solo usuario app" on public.%I for all to authenticated
                     using ((auth.jwt() ->> 'email') = 'organizacion@lachacra.app')
                     with check ((auth.jwt() ->> 'email') = 'organizacion@lachacra.app')$p$, t);
  end loop;
end $$;
