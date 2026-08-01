-- pgvector <=> operator returns double precision, but the functions
-- declared similarity as real, causing RPC error 42804:
-- "Returned type double precision does not match expected type real"

create or replace function search_chunks(
  query_embedding vector(768),
  match_material_id uuid,
  match_count int default 8
) returns table (
  id uuid,
  material_id uuid,
  page int,
  chunk_index int,
  text text,
  similarity double precision
) language plpgsql as $$
begin
  return query
  select
    chunks.id,
    chunks.material_id,
    chunks.page,
    chunks.chunk_index,
    chunks.text,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  where chunks.material_id = match_material_id
    and chunks.embedding is not null
  order by chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;

create or replace function search_semcache(
  query_embedding vector(768),
  match_threshold float default 0.95
) returns table (
  id uuid,
  question text,
  answer text,
  similarity double precision
) language plpgsql as $$
begin
  return query
  select
    semcache.id,
    semcache.question,
    semcache.answer,
    1 - (semcache.embedding <=> query_embedding) as similarity
  from semcache
  where 1 - (semcache.embedding <=> query_embedding) > match_threshold
  order by semcache.embedding <=> query_embedding
  limit 1;
end;
$$;
