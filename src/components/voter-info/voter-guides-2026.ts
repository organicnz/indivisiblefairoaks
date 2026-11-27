/**
 * Drive ids for the four 2026 voter documents that were moved from the voter
 * info page into the archive's 2026 section.
 *
 * The archive renders them in `VoterGuidesSection` mode="2026". They are still
 * rows in `legacy_public_documents` (the archive links to their hosted copies
 * through `legacyHref`), so the legacy article for `/voter-information` must
 * skip them or the same PDF appears twice on `/archive`.
 *
 * The keys name the cards, not their position: reordering the section must not
 * silently point a card at another document.
 */
export const VOTER_GUIDES_2026_DRIVE_IDS = {
  sacramentoGuide: '10XEUyMoyGUI_UktPVwB0RJo-6w3lN0Uy',
  ballotRecommendations: '1JW2rg5dVBZBqezG3hd9QBu0znt3XsMaN',
  handsOffToolkit: '11Cv8yyuI_jtNet_IFSYHDN5xFr1axfg2',
  keyDates: '1XyqCKsSKaQqrrzX7CSl3G3v0ChUtH98U',
} as const;

const MOVED_DRIVE_IDS = new Set<string>(Object.values(VOTER_GUIDES_2026_DRIVE_IDS));

/** True when a legacy document is one of the four moved 2026 voter guides. */
export function isMovedVoterGuide2026(driveId: string | null | undefined): boolean {
  return driveId ? MOVED_DRIVE_IDS.has(driveId) : false;
}
