// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  AUDIT_EXEMPTIONS,
  classifyAuditCoverage,
  hasAuditCall,
  isWriteCapable,
  main,
} from '../../../scripts/check-audit-coverage.mjs';

function file(path: string, source: string) {
  return { path, source };
}

function capture() {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    logs,
    errors,
    log: (message: string) => logs.push(message),
    error: (message: string) => errors.push(message),
  };
}

describe('audit coverage classification', () => {
  it('accepts direct and CRM-wrapped audit calls, and ignores writes in comments', () => {
    expect(hasAuditCall('await recordAdminAudit(client, entry);')).toBe(true);
    expect(hasAuditCall('await recordCRMAudit(adminClient, entry);')).toBe(true);
    expect(hasAuditCall('// recordAdminAudit(client, entry);')).toBe(false);

    expect(isWriteCapable("await client.from('t').update({ a: 1 });")).toBe(true);
    expect(isWriteCapable("await client.rpc('crm_stats');")).toBe(true);
    expect(isWriteCapable('// await client.from("t").delete().eq("id", id)')).toBe(false);
  });

  it('flags an unclassified writer and accepts a reasoned exemption', () => {
    const findings = classifyAuditCoverage({
      files: [
        file('src/app/api/admin/route.ts', "await db.from('t').insert(row);"),
        file('src/app/api/public/route.ts', "await db.from('t').update(row);"),
        file(
          'src/lib/actions/audited.ts',
          "await recordAdminAudit(db, {}); await db.from('t').delete();"
        ),
      ],
      exemptions: new Map([['src/app/api/public/route.ts', 'token-authorized public write']]),
    });

    expect(findings.unclassified).toEqual(['src/app/api/admin/route.ts']);
    expect(findings.staleExemptions).toEqual([]);
    expect(findings.missingReasons).toEqual([]);
  });

  it('requires an exemption to be removed once it stops being true', () => {
    const findings = classifyAuditCoverage({
      files: [
        file(
          'src/lib/actions/fixed.ts',
          "await recordAdminAudit(db, {}); await db.from('t').insert();"
        ),
        file('src/lib/actions/read.ts', "await db.from('t').select();"),
        file('src/lib/actions/gap.ts', "await db.from('t').insert();"),
      ],
      exemptions: new Map([
        ['src/lib/actions/fixed.ts', 'was a gap'],
        ['src/lib/actions/read.ts', 'was a gap'],
        ['src/lib/actions/gone.ts', 'was a gap'],
        ['src/lib/actions/gap.ts', '  '],
      ]),
    });

    expect(findings.staleExemptions).toEqual([
      'src/lib/actions/fixed.ts — now calls an audit recorder; remove the exemption',
      'src/lib/actions/gone.ts — exempted file no longer exists',
      'src/lib/actions/read.ts — no longer performs a write; remove the exemption',
    ]);
    expect(findings.missingReasons).toEqual(['src/lib/actions/gap.ts']);
  });
});

describe('audit coverage on this repository', () => {
  it('classifies every write-capable server file', async () => {
    const output = capture();

    expect(await main({ root: process.cwd(), ...output })).toBe(0);

    expect(output.logs.join('\n')).toMatch(/write-capable server files/);
    expect(output.errors).toEqual([]);
    expect(AUDIT_EXEMPTIONS.size).toBeGreaterThan(0);
  });
});
