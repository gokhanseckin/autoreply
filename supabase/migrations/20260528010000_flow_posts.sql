create table if not exists flow_posts (
  flow_id uuid not null references flows(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (flow_id, post_id)
);
create index if not exists flow_posts_post_idx on flow_posts(post_id);

insert into flow_posts (flow_id, post_id)
select id, post_id from flows where post_id is not null
on conflict do nothing;

drop index if exists posts_ig_account_idx;
create index if not exists posts_ig_account_idx on posts(ig_account_id);

alter table flows drop column if exists post_id;
alter table posts drop column if exists monitored;
