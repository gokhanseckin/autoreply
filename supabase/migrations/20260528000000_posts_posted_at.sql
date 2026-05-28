alter table posts add column if not exists posted_at timestamptz;
create index if not exists posts_posted_at_idx on posts (posted_at desc);
