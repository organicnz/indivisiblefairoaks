import { Bell, ExternalLink, MessageSquareText, Radio } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';
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
            <p className="civic-section-index">
              <DataPoint name="ice.rapid.channels.eyebrow">Alert channels</DataPoint>
            </p>
            <DataPoint
              as="h2"
              id="ice-alert-channels-title"
              name="ice.rapid.channels.title"
              className="mt-2 max-w-lg font-display text-4xl font-semibold leading-[0.95] tracking-[-0.045em] sm:text-5xl"
            >
              Choose how you hear about a surge.
            </DataPoint>
            <DataPoint
              as="p"
              name="ice.rapid.channels.intro"
              className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground"
            >
              This chapter runs email and browser alerts. The national Stop ICE Alerts Network runs
              text and Signal alerts. They are separate services, so review their privacy and
              security terms before joining.
            </DataPoint>
          </div>

          <div className="grid gap-px border border-border bg-border sm:grid-cols-3">
            <div className="flex flex-col bg-surface-card p-4 sm:p-5">
              <Bell className="size-4 text-accent" aria-hidden="true" />
              <DataPoint
                as="h3"
                name="ice.rapid.channels.email.title"
                className="mt-3 font-display text-lg font-semibold leading-tight tracking-[-0.02em]"
              >
                Email + browser
              </DataPoint>
              <DataPoint
                as="p"
                name="ice.rapid.channels.email.body"
                className="mt-1.5 flex-1 text-[11px] leading-relaxed text-muted-foreground"
              >
                City-level surge alerts from this chapter, with email confirmation and one-click
                unsubscribe.
              </DataPoint>
              <div className="mt-3">
                <SurgeAlertsButton />
              </div>
            </div>

            <div className="flex flex-col bg-surface-card p-4 sm:p-5">
              <MessageSquareText className="size-4 text-accent" aria-hidden="true" />
              <DataPoint
                as="h3"
                name="ice.rapid.channels.text.title"
                className="mt-3 font-display text-lg font-semibold leading-tight tracking-[-0.02em]"
              >
                Text alerts
              </DataPoint>
              <DataPoint
                as="p"
                name="ice.rapid.channels.text.body"
                className="mt-1.5 flex-1 text-[11px] leading-relaxed text-muted-foreground"
              >
                Receive national alerts by SMS, or report a sighting to the national network. Never
                send names, plates, or addresses.
              </DataPoint>
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
              <DataPoint
                as="h3"
                name="ice.rapid.channels.signal.title"
                className="mt-3 font-display text-lg font-semibold leading-tight tracking-[-0.02em]"
              >
                Signal alerts
              </DataPoint>
              <DataPoint
                as="p"
                name="ice.rapid.channels.signal.body"
                className="mt-1.5 flex-1 text-[11px] leading-relaxed text-muted-foreground"
              >
                Find the nationwide or local read-only alert group run by Stop ICE. Review the
                network&apos;s security notes before joining.
              </DataPoint>
              <span className="mt-3 inline-flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.09em] text-foreground underline underline-offset-2">
                Find your group
                <ExternalLink className="size-2.5" aria-hidden="true" />
              </span>
            </a>
          </div>
        </div>

        <DataPoint
          as="p"
          name="ice.rapid.channels.footnote"
          className="mt-4 max-w-3xl text-[10px] leading-relaxed text-muted-foreground"
        >
          The text and Signal links leave this site. Indivisible Fair Oaks-Carmichael does not
          operate or monitor those national channels and does not receive the messages you send
          there. This chapter accepts private reports only through its intake form. Raw reports are
          never published; a unique, low-risk report may publish only a generated city-level
          summary, and similar reports are combined.
        </DataPoint>
      </div>
    </section>
  );
}

export { TEXT_ALERTS_HREF, TEXT_REPORT_HREF, SIGNAL_GROUPS_HREF };
