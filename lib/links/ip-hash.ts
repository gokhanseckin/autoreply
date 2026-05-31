import { createHmac } from 'node:crypto';

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) throw new Error('IP_HASH_SALT env var missing');
  return createHmac('sha256', salt).update(ip).digest('hex');
}
