// Base for "Instagram API with Instagram Login" (IGAA tokens).
// For legacy Page-based flow (EAAG tokens) use graph.facebook.com/v21.0 instead.
const GRAPH = 'https://graph.instagram.com/v23.0';

type MetaError = { code: number; type: string; message: string; fbtrace_id?: string };
export class MetaAPIError extends Error {
  constructor(public status: number, public payload: MetaError) {
    super(`Meta API ${status} ${payload.code}: ${payload.message}`);
  }
}

export type Button =
  | { type: 'postback'; title: string; payload: string }
  | { type: 'web_url'; title: string; url: string };

async function call(token: string, path: string, body: unknown) {
  const res = await fetch(`${GRAPH}${path}?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let parsed: { error?: MetaError } = {};
    try { parsed = JSON.parse(text); } catch {}
    throw new MetaAPIError(res.status, parsed.error ?? { code: 0, type: 'unknown', message: text });
  }
  return JSON.parse(text) as { message_id: string; recipient_id: string };
}

export async function sendText(args: { pageAccessToken: string; igUserId: string; text: string }) {
  return call(args.pageAccessToken, '/me/messages', {
    recipient: { id: args.igUserId },
    message: { text: args.text },
    messaging_type: 'RESPONSE',
  });
}

export async function sendButtons(args: {
  pageAccessToken: string;
  igUserId: string;
  text: string;
  buttons: Button[];
}) {
  if (args.buttons.length > 3) throw new Error('Meta allows at most 3 buttons per template');
  return call(args.pageAccessToken, '/me/messages', {
    recipient: { id: args.igUserId },
    message: {
      attachment: {
        type: 'template',
        payload: { template_type: 'button', text: args.text, buttons: args.buttons },
      },
    },
    messaging_type: 'RESPONSE',
  });
}

export async function sendPrivateReplyToComment(args: {
  pageAccessToken: string;
  commentId: string;
  text: string;
}) {
  return call(args.pageAccessToken, `/${args.commentId}/private_replies`, { message: args.text });
}

export type MeProfile = { id: string; user_id?: string; username?: string };

// Resolves the authenticated IG account's identity. `user_id` is the
// Instagram-scoped account id that webhook deliveries carry in `entry.id`.
export async function getMe(token: string): Promise<MeProfile> {
  const res = await fetch(`${GRAPH}/me?fields=id,user_id,username`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    let parsed: { error?: MetaError } = {};
    try { parsed = JSON.parse(text); } catch {}
    throw new MetaAPIError(res.status, parsed.error ?? { code: 0, type: 'unknown', message: text });
  }
  return JSON.parse(text) as MeProfile;
}
