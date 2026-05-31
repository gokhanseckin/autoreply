import bcrypt from 'bcryptjs';

export async function hashIp(ip: string): Promise<string> {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) throw new Error('IP_HASH_SALT env var missing');
  return bcrypt.hash(ip, salt);
}
