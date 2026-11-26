begin;
create table if not exists public.student_appearance (
 student_id uuid primary key references public.students(id) on delete cascade,
 theme text not null check(theme in ('light','dark')),
 wallpaper text not null check(wallpaper in ('default','cars','space','animals','gaming','wallpaper-cars','wallpaper-space','wallpaper-animals','wallpaper-gaming')),
 language text not null check(language in ('ru','en'))
);
alter table public.student_appearance enable row level security;
revoke all on public.student_appearance from public,anon,authenticated;
create or replace function public.get_student_appearance(p_student_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('theme',a.theme,'wallpaper',a.wallpaper,'language',a.language)
 from public.student_appearance a join public.students s on s.id=a.student_id
 where s.id=p_student_id and not s.archived;
$$;
create or replace function public.save_student_appearance(p_student_id uuid,p_theme text,p_wallpaper text,p_language text,p_initialize boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.students where id=p_student_id and not archived) then raise exception 'Cabinet unavailable'; end if;
 insert into public.student_appearance(student_id,theme,wallpaper,language) values(p_student_id,p_theme,p_wallpaper,p_language)
 on conflict(student_id) do update set theme=excluded.theme,wallpaper=excluded.wallpaper,language=excluded.language where not p_initialize;
end;
$$;
revoke all on function public.get_student_appearance(uuid) from public;
revoke all on function public.save_student_appearance(uuid,text,text,text,boolean) from public;
grant execute on function public.get_student_appearance(uuid) to anon,authenticated;
grant execute on function public.save_student_appearance(uuid,text,text,text,boolean) to anon,authenticated;
notify pgrst,'reload schema';
commit;
