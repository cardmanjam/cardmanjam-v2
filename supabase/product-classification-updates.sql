-- Normalize product classification values and allow Beckett (BGS) alongside PSA and CGC.

alter table public.products
  add column if not exists language text,
  add column if not exists grading_company text,
  add column if not exists grade text;

update public.products
set language = case
  when language is null or btrim(language) = '' then language
  when lower(btrim(language)) in ('english', 'en') then 'English'
  when lower(btrim(language)) in ('japanese', 'jp', 'jpn') then 'Japanese'
  when lower(btrim(language)) in ('korean', 'kr', 'kor') then 'Korean'
  when lower(btrim(language)) in ('chinese', 'cn', 'zh') then 'Chinese'
  when lower(btrim(language)) = 'other' then 'Other'
  else initcap(btrim(language))
end,
grading_company = case
  when grading_company is null or btrim(grading_company) = '' then grading_company
  when lower(btrim(grading_company)) = 'psa' then 'PSA'
  when lower(btrim(grading_company)) = 'cgc' then 'CGC'
  when lower(btrim(grading_company)) in ('bgs', 'beckett') then 'BGS'
  else upper(btrim(grading_company))
end,
grade = nullif(btrim(grade), '');

alter table public.products
  drop constraint if exists products_language_check,
  add constraint products_language_check
    check (language is null or language in ('English', 'Japanese', 'Korean', 'Chinese', 'Other')),
  drop constraint if exists products_grading_company_check,
  add constraint products_grading_company_check
    check (grading_company is null or grading_company in ('PSA', 'CGC', 'BGS'));

update public.products
set category = 'slab',
    grading_company = coalesce(
      case
        when grading_company in ('PSA', 'CGC', 'BGS') then grading_company
        when title ~* '(beckett|\bbgs\b)' then 'BGS'
        when title ~* '\bpsa\b' then 'PSA'
        when title ~* '\bcgc\b' then 'CGC'
        when condition ~* '(beckett|\bbgs\b)' then 'BGS'
        when condition ~* '\bpsa\b' then 'PSA'
        when condition ~* '\bcgc\b' then 'CGC'
      end,
      grading_company
    ),
    language = coalesce(
      case
        when language in ('English', 'Japanese', 'Korean', 'Chinese', 'Other') then language
        when title ~* '\bjapanese\b|\bjp\b|\bjpn\b' then 'Japanese'
        when title ~* '\bkorean\b|\bkr\b|\bkor\b' then 'Korean'
        when title ~* '\bchinese\b|\bcn\b|\bzh\b' then 'Chinese'
        when title ~* '\benglish\b|\ben\b' then 'English'
        when condition ~* '\bjapanese\b|\bjp\b|\bjpn\b' then 'Japanese'
        when condition ~* '\bkorean\b|\bkr\b|\bkor\b' then 'Korean'
        when condition ~* '\bchinese\b|\bcn\b|\bzh\b' then 'Chinese'
        when condition ~* '\benglish\b|\ben\b' then 'English'
      end,
      language
    ),
    updated_at = now()
where id = '6c3a1201-665a-45ca-8d8b-638e0aa65e24';