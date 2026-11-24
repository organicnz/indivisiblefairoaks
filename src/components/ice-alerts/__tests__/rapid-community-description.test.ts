// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { communityDescription } from '@/components/ice-alerts/rapid-community-description';

describe('communityDescription', () => {
  it('describes a community response and the reported outcome', () => {
    expect(
      communityDescription({
        kind: 'enforcement',
        comments:
          'ICE agents were at a warehouse. Community members stayed until the agents drove away. No one was taken into custody.',
      })
    ).toBe(
      'Reporters described ICE agents at or near a business or workplace. Community members or observers responded. No one was reported taken into custody, and the reported agents later left the area.'
    );
  });

  it('describes a checkpoint and a public place category', () => {
    expect(
      communityDescription({
        kind: 'checkpoint',
        comments: 'Checkpoint reported near the courthouse.',
      })
    ).toBe('Reporters described a checkpoint or roadblock near a courthouse.');
  });

  it('describes reported confrontation and a support request without quoting the source', () => {
    expect(
      communityDescription({
        kind: 'enforcement',
        comments:
          'ICE is reportedly assaulting legal observers outside Twin Towers. Community support request; please show up and document.',
      })
    ).toBe(
      'Reporters described ICE agents near a jail or detention facility. Agents were described confronting or assaulting observers, and community support was requested.'
    );
  });

  it('falls back to a place-level description when the report has no usable detail', () => {
    expect(
      communityDescription({
        kind: 'enforcement',
        comments: 'A report was received about an address on a local street.',
      })
    ).toBe(
      'Reporters described a community sighting of enforcement activity on a public street or in a public area.'
    );
  });

  it('uses a fixed place category from the fetched location when the comments lack one', () => {
    const description = communityDescription({
      kind: 'enforcement',
      location: 'IL53 and Normantown Rd Romeoville IL 60446',
      comments: 'ICE activity reported.',
    });

    expect(description).toBe(
      'Reporters described ICE activity on a public street or in a public area.'
    );
    expect(description).not.toContain('Normantown');
    expect(description).not.toContain('60446');
  });

  it('still produces a description when the fetched report text is empty', () => {
    expect(communityDescription({ kind: 'enforcement', comments: '' })).toBe(
      'Reporters described a community sighting of enforcement activity in the area.'
    );
  });

  it('never returns names, plates, phone numbers, or street addresses from the source', () => {
    const description = communityDescription({
      kind: 'detention',
      comments:
        'Three ICE vehicles at 62 Civic Center Plaza. Plate 8LHN072. Jane Doe was detained near the jail. Call 213-444-6562.',
    });

    expect(description).toBe(
      'Reporters described multiple ICE vehicles near a jail or detention facility. Reporters said at least one person was taken into custody.'
    );
    expect(description).not.toContain('Civic Center');
    expect(description).not.toContain('8LHN072');
    expect(description).not.toContain('Jane Doe');
    expect(description).not.toContain('213-444-6562');
  });
});
