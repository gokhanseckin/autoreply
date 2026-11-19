alter table flows
  add column public_reply_enabled boolean not null default false,
  add column public_reply_options jsonb not null
    default '[{"text":"Teşekkürler. Mesaj gönderildi","probability":100}]'::jsonb;
