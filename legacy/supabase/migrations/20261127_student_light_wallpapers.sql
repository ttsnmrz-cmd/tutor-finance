begin;
alter table public.student_appearance drop constraint if exists student_appearance_wallpaper_check;
alter table public.student_appearance add constraint student_appearance_wallpaper_check check (wallpaper in ('default','cars','space','animals','gaming','wallpaper-cars','wallpaper-space','wallpaper-animals','wallpaper-gaming','wallpaper-city-light','wallpaper-luxury-light','wallpaper-gaming-light'));
commit;