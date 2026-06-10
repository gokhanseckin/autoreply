-- findCommentFlow enters flow_posts by post_id (resolved from posts.ig_media_id,
-- which is already unique-indexed) and joins out to flows. The PK (flow_id, post_id)
-- doesn't serve a post_id-leading lookup; this composite covers the join and
-- replaces the narrower flow_posts_post_idx.
create index if not exists flow_posts_post_flow_idx on flow_posts(post_id, flow_id);
drop index if exists flow_posts_post_idx;
