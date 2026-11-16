import { Bell, ExternalLink, MessageSquareText, Radio } from 'lucide-react';
import { SurgeAlertsButton } from './SurgeAlertsDialog';

const TEXT_ALERTS_HREF = 'sms:8773222299?body=JOIN';
const TEXT_REPORT_HREF = 'sms:8773222299?body=REPORT';
const SIGNAL_GROUPS_HREF = 'https://stopice.net/signal/';

export function RapidAlertChannels() {
  return (
    <section
      id="alert-channels"
      aria-labelledby="ice-alert-channels-title"
      className="mx-auto max-w-7xl scroll-mt-28 px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20"
    >
      <div className="border-t border-foreground/20 pt-8">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-10">
          <div>
            <p className="civic-section-index">Alert channels</p>
            <h2
              id="ice-alert-channels-title"
              className="mt-2 max-w-lg font-display text-4xl font-semibold leading-[0.95] tracking-[-0.045em] sm:text-5xl"
            >
              Choose how you hear about a surge.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              This chapter runs email and browser alerts. The national Stop ICE Alerts Network runs
              text and Signal alerts. They are separate services, so review their privacy and
              security terms before joining.
            </p>
          </div>

          <div className="grid gap-px border border-border bg-border sm:grid-cols-3">
            <div className="flex flex-col bg-surface-card p-4 sm:p-5">
              <Bell className="size-4 text-accent" aria-hidden="true" />
              <h3 className="mt-3 font-display text-lg font-semibold leading-tight tracking-[-0.02em]">
                Email + browser
              </h3>
              <p className="mt-1.5 flex-1 text-[11px] leading-relaxed text-muted-foreground">
                City-level surge alerts from this chapter, with email confirmation and one-click
                unsubscribe.
              </p>
              <div className="mt-3">
                <SurgeAlertsButton />
              </div>
            </div>

            <div className="flex flex-col bg-surface-card p-4 sm:p-5">
              <MessageSquareText className="size-4 text-accent" aria-hidden="true" />
              <h3 className="mt-3 font-display text-lg font-semibold leading-tight tracking-[-0.02em]">
                Text alerts
              </h3>
              <p className="mt-1.5 flex-1 text-[11px] leading-relaxed text-muted-foreground">
                Receive national alerts by SMS, or report a sighting to the national network. Never
                send names, plates, or addresses.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
                <a
                  href={TEXT_ALERTS_HREF}
                  className="inline-flex min-h-11 items-center font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Text JOIN
                </a>
                <a
                  href={TEXT_REPORT_HREF}
                  className="inline-flex min-h-11 items-center font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Text REPORT
                </a>
              </div>
              <p className="mt-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                877-322-2299
              </p>
            </div>

            <a
              href={SIGNAL_GROUPS_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col bg-surface-card p-4 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:p-5"
            >
              <Radio className="size-4 text-accent" aria-hidden="true" />
              <h3 className="mt-3 font-display text-lg font-semibold leading-tight tracking-[-0.02em]">
                Signal alerts
              </h3>
              <p className="mt-1.5 flex-1 text-[11px] leading-relaxed text-muted-foreground">
                Find the nationwide or local read-only alert group run by Stop ICE. Review the
                network&apos;s security notes before joining.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2">
                Find your group
                <ExternalLink className="size-2.5" aria-hidden="true" />
              </span>
            </a>
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-[10px] leading-relaxed text-muted-foreground">
          The text and Signal links leave this site. Indivisible Fair Oaks-Carmichael does not
          operate or monitor those national channels and does not receive the messages you send
          there. This page does not collect reports.
        </p>
      </div>
    </section>
  );
}

export { TEXT_ALERTS_HREF, TEXT_REPORT_HREF, SIGNAL_GROUPS_HREF };
