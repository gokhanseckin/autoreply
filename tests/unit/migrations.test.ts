import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.resolve(__dirname, '../../supabase/migrations');
const migrations = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .map((file) => ({ file, sql: readFileSync(path.join(dir, file), 'utf8') }));

describe('supabase migrations', () => {
  it("allows the 'failed' email_subscribers status the email step records on provider outages", () => {
    const constraintMigrations = migrations.filter(
      (m) => /alter table email_subscribers/i.test(m.sql) && /'failed'/.test(m.sql),
    );
    expect(constraintMigrations.length).toBeGreaterThan(0);
  });
});
