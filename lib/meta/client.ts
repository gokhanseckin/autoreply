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

// `commentId`, when set, addresses the message to a comment instead of a user.
// This is how the first DM to a commenter is initiated (`recipient.comment_id`);
// it goes to the same /me/messages endpoint and carries the full message body,
// so buttons/templates work on that opening reply just like a normal DM.
function recipientFor(args: { igUserId?: string; commentId?: string }) {
  return args.commentId ? { comment_id: args.commentId } : { id: args.igUserId };
}

export async function sendText(args: { pageAccessToken: string; igUserId?: string; text: string; commentId?: string }) {
  const body: Record<string, unknown> = {
    recipient: recipientFor(args),
    message: { text: args.text },
  };
  if (!args.commentId) body.messaging_type = 'RESPONSE';
  return call(args.pageAccessToken, '/me/messages', body);
}

export async function sendButtons(args: {
  pageAccessToken: string;
  igUserId?: string;
  text: string;
  buttons: Button[];
  commentId?: string;
}) {
  if (args.buttons.length > 3) throw new Error('Meta allows at most 3 buttons per template');
  const body: Record<string, unknown> = {
    recipient: recipientFor(args),
    message: {
      attachment: {
        type: 'template',
        payload: { template_type: 'button', text: args.text, buttons: args.buttons },
      },
    },
  };
  if (!args.commentId) body.messaging_type = 'RESPONSE';
  return call(args.pageAccessToken, '/me/messages', body);
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
