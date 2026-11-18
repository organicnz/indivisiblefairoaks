import { Newspaper } from 'lucide-react';
import { MASTHEAD_INTRO, MASTHEAD_TITLE, PageMasthead } from '@/components/layout/PageMasthead';

export function NewsMasthead() {
  return (
      <PageMasthead
        icon={Newspaper}
        eyebrow="Chapter Newsroom"
        title={<h1 className={MASTHEAD_TITLE}>News &amp; Chapter Updates</h1>}
        intro={
          <p className={MASTHEAD_INTRO}>
            The latest reports, statements, and dispatches from our chapter organizers — published
            here first. Meeting minutes, printable handouts, bulletins, and ways to stay involved
            follow below.
          </p>
        }
      />
  );
}
