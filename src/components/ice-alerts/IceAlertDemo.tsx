'use client';

import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Crosshair,
  Eye,
  FileWarning,
  Globe2,
  Info,
  Layers3,
  LocateFixed,
  MapPin,
  Minus,
  Phone,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  Siren,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';

type ReportKind = 'enforcement' | 'checkpoint' | 'detention' | 'community';
type ReportStatus = 'verified' | 'unconfirmed' | 'cleared';
type ReportFilter = 'all' | ReportKind;
type StatusFilter = 'all' | ReportStatus;
type MapView = 'sacramento' | 'nationwide' | 'free';

type CommunityReport = {
  id: string;
  kind: ReportKind;
  place: string;
  time: string;
  status: ReportStatus;
  note: string;
  lat: number;
  lng: number;
  isDraft?: boolean;
};

type MapPoint = {
  lat: number;
  lng: number;
};

// The default is regional, not street-level: the map opens wide enough to show
// the Sacramento metro, while zooming out and panning remains unrestricted so a
// preview pin can be placed anywhere in the U.S.
const SACRAMENTO_CENTER: [number, number] = [38.635, -121.328];
const SACRAMENTO_ZOOM = 10;
const NATIONWIDE_BOUNDS: [[number, number], [number, number]] = [
  [24.4, -125],
  [49.4, -66.9],
];
const MIN_ZOOM = 3;
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Approximate boxes for the states and territories. These keep a preview pin
// from landing in Canada or the ocean while still accepting Alaska, Hawaii,
// Puerto Rico, the U.S. Virgin Islands, Guam, the Northern Mariana Islands,
// and American Samoa.
const US_REGIONS = [
  { minLat: 24.4, maxLat: 49.4, minLng: -125, maxLng: -66.9 },
  { minLat: 51, maxLat: 71.5, minLng: -170, maxLng: -129 },
  { minLat: 18.9, maxLat: 22.3, minLng: -160.5, maxLng: -154.8 },
  { minLat: 17.6, maxLat: 18.6, minLng: -67.3, maxLng: -64.5 },
  { minLat: 13.2, maxLat: 13.7, minLng: 144.6, maxLng: 145 },
  { minLat: 14.9, maxLat: 15.3, minLng: 145.6, maxLng: 145.8 },
  { minLat: -14.4, maxLat: -14.1, minLng: -170.9, maxLng: -170.5 },
] as const;

function isUsPoint(lat: number, lng: number) {
  return US_REGIONS.some(
    (region) =>
      lat >= region.minLat &&
      lat <= region.maxLat &&
      lng >= region.minLng &&
      lng <= region.maxLng
  );
}

const TYPE_META: Record<
  ReportKind,
  {
    label: string;
    shortLabel: string;
    tone: string;
    badge: string;
    dot: string;
  }
> = {
  enforcement: {
    label: 'Enforcement activity',
    shortLabel: 'Enforcement',
    tone: 'enforcement',
    badge: 'border-accent/40 bg-accent/10 text-accent',
    dot: 'border-accent bg-accent',
  },
  checkpoint: {
    label: 'Checkpoint',
    shortLabel: 'Checkpoint',
    tone: 'checkpoint',
    badge: 'border-accent-gold/60 bg-accent-gold/15 text-foreground',
    dot: 'border-accent-gold bg-accent-gold',
  },
  detention: {
    label: 'Detention',
    shortLabel: 'Detention',
    tone: 'detention',
    badge: 'border-secondary/40 bg-secondary/10 text-foreground',
    dot: 'border-secondary bg-secondary',
  },
  community: {
    label: 'Community note',
    shortLabel: 'Community note',
    tone: 'community',
    badge: 'border-primary/40 bg-primary/10 text-primary dark:text-primary-on-dark',
    dot: 'border-primary bg-primary',
  },
};

const STATUS_META: Record<
  ReportStatus,
  { label: string; shortLabel: string; badge: string; icon: typeof ShieldCheck }
> = {
  verified: {
    label: 'Confirmed sample',
    shortLabel: 'Confirmed',
    badge: 'border-primary/40 bg-primary/10 text-primary dark:text-primary-on-dark',
    icon: ShieldCheck,
  },
  unconfirmed: {
    label: 'Unconfirmed sample',
    shortLabel: 'Unconfirmed',
    badge: 'border-accent/40 bg-accent/10 text-accent',
    icon: Eye,
  },
  cleared: {
    label: 'Cleared sample',
    shortLabel: 'Cleared',
    badge: 'border-border bg-surface-muted text-muted-foreground',
    icon: CheckCircle2,
  },
};

const SAMPLE_REPORTS: CommunityReport[] = [
  {
    id: 'sample-1',
    kind: 'enforcement',
    place: 'Fair Oaks Blvd & Manzanita Ave',
    time: '8:12 PM',
    status: 'unconfirmed',
    note: 'A reader reported several unmarked vehicles near the intersection. No further detail was confirmed in this sample scenario.',
    lat: 38.6421,
    lng: -121.3336,
  },
  {
    id: 'sample-2',
    kind: 'checkpoint',
    place: 'Madison Ave & Sunrise Blvd',
    time: '7:40 PM',
    status: 'verified',
    note: 'Sample checkpoint report. In a live version, a trained volunteer would confirm the location and time before pinning it.',
    lat: 38.6712,
    lng: -121.2724,
  },
  {
    id: 'sample-3',
    kind: 'detention',
    place: 'Watt Ave & El Camino Ave',
    time: '6:55 PM',
    status: 'unconfirmed',
    note: 'Sample detention report. The page would never ask for names, faces, plate numbers, or immigration status.',
    lat: 38.6257,
    lng: -121.3831,
  },
  {
    id: 'sample-4',
    kind: 'community',
    place: 'Carmichael Park',
    time: '5:30 PM',
    status: 'verified',
    note: 'Sample community note: a nearby gathering moved indoors. No enforcement activity was observed at the park.',
    lat: 38.6259,
    lng: -121.3318,
  },
  {
    id: 'sample-5',
    kind: 'enforcement',
    place: 'Fair Oaks Blvd & Hazel Ave',
    time: '4:05 PM',
    status: 'cleared',
    note: 'Sample report marked cleared. The map would show the last update time so old reports do not look current.',
    lat: 38.6411,
    lng: -121.2832,
  },
  {
    id: 'sample-6',
    kind: 'enforcement',
    place: 'Los Angeles, CA',
    time: '7:05 PM',
    status: 'unconfirmed',
    note: 'Nationwide sample. A report can be previewed at any U.S. location, not only in the chapter area.',
    lat: 34.0522,
    lng: -118.2437,
  },
  {
    id: 'sample-7',
    kind: 'checkpoint',
    place: 'Phoenix, AZ',
    time: '6:20 PM',
    status: 'verified',
    note: 'Nationwide sample checkpoint. A real version would require volunteer review before it appeared on the map.',
    lat: 33.4484,
    lng: -112.074,
  },
  {
    id: 'sample-8',
    kind: 'detention',
    place: 'Chicago, IL',
    time: '5:45 PM',
    status: 'unconfirmed',
    note: 'Nationwide sample report. No names, faces, plate numbers, or immigration status are collected.',
    lat: 41.8781,
    lng: -87.6298,
  },
  {
    id: 'sample-9',
    kind: 'community',
    place: 'New York, NY',
    time: '4:30 PM',
    status: 'verified',
    note: 'Nationwide community sample. The same short, safety-first report format works outside the chapter region.',
    lat: 40.7128,
    lng: -74.006,
  },
];

const KIND_FILTERS: { id: ReportFilter; label: string; shortLabel: string }[] = [
  { id: 'all', label: 'All reports', shortLabel: 'All' },
  { id: 'enforcement', label: 'Enforcement', shortLabel: 'Enforcement' },
  { id: 'checkpoint', label: 'Checkpoints', shortLabel: 'Checkpoint' },
  { id: 'detention', label: 'Detentions', shortLabel: 'Detention' },
  { id: 'community', label: 'Community notes', shortLabel: 'Community' },
];

const TIME_OPTIONS = [
  { value: 'just-now', label: 'Now' },
  { value: '30-minutes', label: '30 min ago' },
  { value: '2-hours', label: '2 hr ago' },
  { value: 'earlier', label: 'Earlier today' },
];

function statusFor(report: CommunityReport) {
  if (report.isDraft) {
    return {
      label: 'Your preview',
      shortLabel: 'Preview',
      badge: 'border-accent/40 bg-accent/10 text-accent',
      icon: Radio,
    };
  }
  return STATUS_META[report.status];
}

function pinLabelFor(report: CommunityReport, drafts: CommunityReport[]) {
  if (report.isDraft) {
    return `P${drafts.findIndex((item) => item.id === report.id) + 1}`;
  }
  return String(SAMPLE_REPORTS.findIndex((item) => item.id === report.id) + 1);
}

function countForFilter(reports: CommunityReport[], filter: ReportFilter) {
  return filter === 'all' ? reports.length : reports.filter((report) => report.kind === filter).length;
}

export function IceAlertDemo() {
  const [drafts, setDrafts] = useState<CommunityReport[]>([]);
  const [kindFilter, setKindFilter] = useState<ReportFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(SAMPLE_REPORTS[0].id);
  const [formOpen, setFormOpen] = useState(false);
  const [reportKind, setReportKind] = useState<ReportKind>('enforcement');
  const [placeInput, setPlaceInput] = useState('');
  const [timeInput, setTimeInput] = useState('just-now');
  const [noteInput, setNoteInput] = useState('');
  const [safe, setSafe] = useState(false);
  const [draftPoint, setDraftPoint] = useState<MapPoint | null>(null);
  const [pickingLocation, setPickingLocation] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mapView, setMapView] = useState<MapView>('sacramento');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const markerElementsRef = useRef<Record<string, HTMLElement>>({});
  const selectedIdRef = useRef(selectedId);
  const pickingRef = useRef(pickingLocation);
  const formRef = useRef<HTMLDivElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const [mapGeneration, setMapGeneration] = useState(0);

  const allReports = useMemo(() => [...drafts, ...SAMPLE_REPORTS], [drafts]);
  const visibleReports = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allReports.filter((report) => {
      if (kindFilter !== 'all' && report.kind !== kindFilter) return false;
      if (statusFilter !== 'all' && report.status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      const searchable = `${report.place} ${report.note} ${TYPE_META[report.kind].label}`.toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [allReports, kindFilter, query, statusFilter]);

  const selectedReport = allReports.find((report) => report.id === selectedId) ?? SAMPLE_REPORTS[0];
  const selectedMeta = TYPE_META[selectedReport.kind];
  const selectedStatus = statusFor(selectedReport);
  const SelectedStatusIcon = selectedStatus.icon;
  const selectedPin = pinLabelFor(selectedReport, drafts);
  const canPreview = Boolean(draftPoint);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    pickingRef.current = pickingLocation;
  }, [pickingLocation]);

  useEffect(() => {
    if (formOpen) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [formOpen]);

  useEffect(() => {
    if (visibleReports.length > 0 && !visibleReports.some((report) => report.id === selectedId)) {
      setSelectedId(visibleReports[0].id);
    }
  }, [selectedId, visibleReports]);

  useEffect(() => {
    let disposed = false;
    let map: LeafletMap | null = null;
    let resizeObserver: ResizeObserver | null = null;

    void (async () => {
      const L = (await import('leaflet')).default;
      if (disposed || !mapContainerRef.current || mapRef.current) return;

      map = L.map(mapContainerRef.current, {
        center: SACRAMENTO_CENTER,
        zoom: SACRAMENTO_ZOOM,
        minZoom: MIN_ZOOM,
        zoomControl: false,
        scrollWheelZoom: true,
        keyboard: true,
        attributionControl: true,
        worldCopyJump: true,
      });

      L.tileLayer(TILE_URL, {
        maxZoom: 19,
        attribution: TILE_ATTRIBUTION,
      }).addTo(map);

      markerLayerRef.current = L.layerGroup().addTo(map);

      map.on('click', (event) => {
        if (!pickingRef.current) return;
        if (!isUsPoint(event.latlng.lat, event.latlng.lng)) {
          setNotice(
            'Choose a point inside the United States. The preview pin cannot be placed outside U.S. locations.'
          );
          return;
        }
        setDraftPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
        setPlaceInput((current) =>
          current.trim() ? current : 'Pinned location (approximate)'
        );
        setPickingLocation(false);
        setNotice(null);
      });

      map.on('moveend', () => {
        const center = map?.getCenter();
        const zoom = map?.getZoom();
        if (!center || zoom === undefined) return;
        if (zoom <= 5) {
          setMapView('nationwide');
        } else if (
          center.lat >= 37.6 &&
          center.lat <= 39.4 &&
          center.lng >= -122.4 &&
          center.lng <= -120.2
        ) {
          setMapView('sacramento');
        } else {
          setMapView('free');
        }
      });

      resizeObserver = new ResizeObserver(() => {
        map?.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);

      mapRef.current = map;
      setMapGeneration((generation) => generation + 1);
      requestAnimationFrame(() => map?.invalidateSize());
    })();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      map?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      markerElementsRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (mapGeneration === 0) return;
    let disposed = false;

    void (async () => {
      const L = (await import('leaflet')).default;
      if (disposed) return;
      const layer = markerLayerRef.current;
      if (!layer) return;

      layer.clearLayers();
      markerElementsRef.current = {};

      for (const report of visibleReports) {
        const meta = TYPE_META[report.kind];
        const status = statusFor(report);
        const pin = pinLabelFor(report, drafts);
        const label = `Report ${pin}: ${meta.label} at ${report.place}, ${report.time}. ${status.label}.`;
        const classes = ['ice-map-pin', `ice-map-pin--${meta.tone}`];
        if (report.id === selectedIdRef.current) classes.push('is-selected');
        if (report.isDraft) classes.push('is-draft');
        if (report.status === 'cleared' && !report.isDraft) classes.push('is-cleared');

        const icon = L.divIcon({
          className: 'ice-map-marker',
          html: `<span class="${classes.join(' ')}">${pin}</span>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([report.lat, report.lng], {
          icon,
          keyboard: true,
          title: label,
          riseOnHover: true,
        }).addTo(layer);

        marker.on('click', () => setSelectedId(report.id));

        const element = marker.getElement();
        if (element) {
          element.setAttribute('aria-label', label);
          element.setAttribute('role', 'button');
          element.setAttribute('aria-pressed', String(report.id === selectedIdRef.current));
          markerElementsRef.current[report.id] = element;
        }
      }

      if (draftPoint) {
        const icon = L.divIcon({
          className: 'ice-map-marker',
          html: '<span class="ice-map-pin ice-map-pin--draft">+</span>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        L.marker([draftPoint.lat, draftPoint.lng], {
          icon,
          interactive: false,
          keyboard: false,
        }).addTo(layer);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [draftPoint, drafts, mapGeneration, visibleReports]);

  useEffect(() => {
    for (const [id, element] of Object.entries(markerElementsRef.current)) {
      const selected = id === selectedId;
      element.setAttribute('aria-pressed', String(selected));
      element.querySelector('.ice-map-pin')?.classList.toggle('is-selected', selected);
    }
  }, [selectedId]);

  const focusReport = (report: CommunityReport) => {
    setSelectedId(report.id);
    const map = mapRef.current;
    if (map) {
      map.flyTo([report.lat, report.lng], Math.max(map.getZoom(), 13), { duration: 0.45 });
    }
    if (window.matchMedia('(max-width: 1023px)').matches) {
      document
        .getElementById('ice-map-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const zoomMap = (direction: 'in' | 'out') => {
    if (direction === 'in') mapRef.current?.zoomIn();
    else mapRef.current?.zoomOut();
  };

  const focusMapView = (view: 'sacramento' | 'nationwide') => {
    const map = mapRef.current;
    if (!map) return;
    setMapView(view);
    if (view === 'sacramento') {
      map.flyTo(SACRAMENTO_CENTER, SACRAMENTO_ZOOM, { duration: 0.4 });
    } else {
      map.fitBounds(NATIONWIDE_BOUNDS, { padding: [24, 24], duration: 0.4 });
    }
  };

  const resetMap = () => {
    focusMapView('sacramento');
  };

  const toggleReportForm = () => {
    setFormOpen((current) => !current);
    if (formOpen) {
      setPickingLocation(false);
      requestAnimationFrame(() => launcherRef.current?.focus());
    }
  };

  const togglePicking = () => {
    const next = !pickingLocation;
    setPickingLocation(next);
    if (next && window.matchMedia('(max-width: 1023px)').matches) {
      document
        .getElementById('ice-map-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const clearFilters = () => {
    setKindFilter('all');
    setStatusFilter('all');
    setQuery('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draftPoint) {
      setNotice('Pick a point on the map to place the preview before adding it.');
      return;
    }

    const point = draftPoint;
    const time = TIME_OPTIONS.find((option) => option.value === timeInput)?.label ?? 'Now';

    const draft: CommunityReport = {
      id: `preview-${Date.now()}`,
      kind: reportKind,
      place: placeInput.trim() || 'Pinned location (approximate)',
      time,
      status: 'unconfirmed',
      note: noteInput.trim() || 'No description was added to this preview.',
      lat: point.lat,
      lng: point.lng,
      isDraft: true,
    };

    setDrafts((current) => [draft, ...current]);
    setSelectedId(draft.id);
    setKindFilter('all');
    setStatusFilter('all');
    setQuery('');
    setPickingLocation(false);
    setDraftPoint(null);
    setPlaceInput('');
    setNoteInput('');
    setSafe(false);
    setNotice('Preview added to the map and feed. Nothing was sent or stored.');
  };

  const clearPreviews = () => {
    setDrafts([]);
    if (selectedReport.isDraft) setSelectedId(SAMPLE_REPORTS[0].id);
    setNotice('All local preview reports cleared. Nothing was sent.');
  };

  const removePreview = (id: string) => {
    setDrafts((current) => current.filter((report) => report.id !== id));
    setSelectedId(SAMPLE_REPORTS[0].id);
    setNotice('Preview report removed from the map.');
  };

  return (
    <>
      <div className="border-b border-accent/40 bg-accent/10">
        <div className="mx-auto flex max-w-7xl items-start gap-2.5 px-4 py-2.5 sm:px-6 lg:px-8">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-foreground sm:text-[13px]">
            <strong className="font-semibold">This is a demo, not a live alert map.</strong> All
            reports are fictional sample data; nothing is collected, sent, or published. Immediate
            danger? Call{' '}
            <a href="tel:911" className="font-semibold underline underline-offset-2">
              911
            </a>
            .
          </p>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.42fr)_minmax(22rem,0.78fr)]">
          <div id="ice-map-panel" className="min-w-0 scroll-mt-28 lg:sticky lg:top-28 lg:self-start">
            <div className="overflow-hidden border border-border bg-surface-card">
              <div className="border-b border-border p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="civic-section-index inline-flex items-center gap-1.5">
                      <Layers3 className="size-3.5" aria-hidden="true" />
                      Sample alert map
                    </p>
                    <h2 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.035em] sm:text-3xl">
                      {mapView === 'nationwide'
                        ? 'Nationwide view'
                        : mapView === 'free'
                          ? 'Custom U.S. view'
                          : 'Sacramento region'}
                    </h2>
                    <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                      {mapView === 'nationwide'
                        ? 'Lower 48 overview. Pan to Alaska, Hawaii, or a territory, or switch back to Sacramento.'
                        : mapView === 'free'
                          ? 'A custom U.S. view. Pan or zoom anywhere, then pick a point to preview a report.'
                          : 'Regional view by default. Pan or zoom anywhere in the U.S. to preview a report.'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 text-right">
                    <span className="inline-flex items-center gap-1.5 border border-accent/40 bg-accent/10 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-accent">
                      <span className="size-1.5 bg-accent" aria-hidden="true" />
                      Demo snapshot
                    </span>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      {visibleReports.length} of {allReports.length} reports shown
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div
                    className="inline-flex border border-border"
                    role="group"
                    aria-label="Map coverage"
                  >
                    <button
                      type="button"
                      aria-pressed={mapView === 'sacramento'}
                      onClick={() => focusMapView('sacramento')}
                      className={`inline-flex min-h-8 items-center gap-1.5 border-r border-border px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                        mapView === 'sacramento'
                          ? 'bg-primary text-white'
                          : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                      }`}
                    >
                      <LocateFixed className="size-3.5" aria-hidden="true" />
                      Sacramento
                    </button>
                    <button
                      type="button"
                      aria-pressed={mapView === 'nationwide'}
                      onClick={() => focusMapView('nationwide')}
                      className={`inline-flex min-h-8 items-center gap-1.5 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                        mapView === 'nationwide'
                          ? 'bg-primary text-white'
                          : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                      }`}
                    >
                      <Globe2 className="size-3.5" aria-hidden="true" />
                      Nationwide
                    </button>
                  </div>
                  <span
                    className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground"
                    aria-live="polite"
                  >
                    {mapView === 'free'
                      ? 'Custom U.S. view'
                      : mapView === 'nationwide'
                        ? 'Lower 48 overview'
                        : 'Regional overview'}
                  </span>
                </div>

                <div
                  className="mt-4 flex flex-wrap gap-1.5"
                  role="group"
                  aria-label="Filter alerts by type"
                >
                  {KIND_FILTERS.map((filter) => {
                    const active = kindFilter === filter.id;
                    const count = countForFilter(allReports, filter.id);
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setKindFilter(filter.id)}
                        className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                          active
                            ? 'border-primary bg-primary text-white'
                            : 'border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                        }`}
                      >
                        <span className="sm:hidden">{filter.shortLabel}</span>
                        <span className="hidden sm:inline">{filter.label}</span>
                        <span
                          className={`hidden font-mono text-[9px] sm:inline ${
                            active ? 'text-white' : 'text-muted-foreground'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative">
                <div
                  ref={mapContainerRef}
                  role="region"
                  aria-label="Interactive sample alert map"
                  aria-describedby="ice-map-help"
                  className="h-[clamp(19.5rem,43vh,31rem)] w-full"
                />
                <p id="ice-map-help" className="sr-only">
                  Map of fictional sample reports around Sacramento with additional nationwide
                  examples. Select a numbered pin for details. Use the plus and minus buttons to
                  zoom, choose Sacramento or Nationwide for a preset view, and use the location
                  reset to return to the Sacramento region.
                </p>

                <div className="pointer-events-none absolute inset-0 z-[900]">
                  <div className="pointer-events-auto absolute right-3 top-3 flex flex-col border border-border bg-background/95">
                    <button
                      type="button"
                      onClick={() => zoomMap('in')}
                      aria-label="Zoom in"
                      className="flex size-10 items-center justify-center text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => zoomMap('out')}
                      aria-label="Zoom out"
                      className="flex size-10 items-center justify-center border-y border-border text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={resetMap}
                      aria-label="Reset map to the Sacramento region"
                      className="flex size-10 items-center justify-center text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                    >
                      <LocateFixed className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  {pickingLocation ? (
                    <div className="pointer-events-auto absolute left-3 right-3 top-3 flex items-start justify-between gap-3 border border-primary bg-background/95 p-3">
                      <p className="flex items-start gap-2 text-xs font-semibold leading-relaxed text-foreground">
                        <Crosshair className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                        Click anywhere on the map to place the preview pin.
                      </p>
                      <button
                        type="button"
                        onClick={() => setPickingLocation(false)}
                        aria-label="Cancel picking a location"
                        className="flex size-8 shrink-0 items-center justify-center border border-border text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}

                  <div className="pointer-events-none absolute bottom-3 left-3 border border-border bg-background/90 px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Sample pins · U.S. reporting preview
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-surface-muted px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground sm:px-5">
                {(Object.keys(TYPE_META) as ReportKind[]).map((kind) => (
                  <span key={kind} className="inline-flex items-center gap-1.5">
                    <span className={`size-2 border ${TYPE_META[kind].dot}`} aria-hidden="true" />
                    {TYPE_META[kind].shortLabel}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
                  <span className="size-2 border border-border bg-surface-card opacity-60" aria-hidden="true" />
                  Faded = cleared
                </span>
                <span className="ml-auto inline-flex items-center gap-1.5 normal-case tracking-normal">
                  <Info className="size-3.5" aria-hidden="true" />
                  No live feed connected.
                </span>
              </div>

              <div className="border-t border-border bg-surface-card p-4 sm:p-5" aria-live="polite">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${selectedMeta.badge}`}
                  >
                    <MapPin className="size-3" aria-hidden="true" />
                    {selectedMeta.shortLabel}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${selectedStatus.badge}`}
                  >
                    <SelectedStatusIcon className="size-3" aria-hidden="true" />
                    {selectedStatus.shortLabel}
                  </span>
                  {selectedReport.isDraft ? (
                    <span className="civic-stamp">Your preview</span>
                  ) : (
                    <span className="civic-stamp">Sample report</span>
                  )}
                  <span className="ml-auto font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    {selectedPin} / {selectedReport.time}
                  </span>
                </div>
                <h3 className="mt-2.5 font-display text-2xl font-semibold leading-tight tracking-[-0.03em] sm:text-3xl">
                  {selectedReport.place}
                </h3>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {selectedReport.note}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="size-3.5" aria-hidden="true" />
                    {selectedReport.time}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Eye className="size-3.5" aria-hidden="true" />
                    {selectedReport.isDraft
                      ? 'Local preview, not reviewed'
                      : 'Fictional sample, not a live report'}
                  </span>
                  {selectedReport.isDraft ? (
                    <button
                      type="button"
                      onClick={() => removePreview(selectedReport.id)}
                      className="ml-auto inline-flex min-h-8 items-center gap-1.5 border border-border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      <Trash2 className="size-3" aria-hidden="true" />
                      Remove preview
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            <div className="border border-accent/40 bg-accent/5 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="civic-section-index">Report preview</p>
                  <h2 className="mt-2 font-display text-2xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-3xl">
                    See something?
                  </h2>
                </div>
                <Siren className="size-6 shrink-0 text-accent" aria-hidden="true" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Add a sample report to see how a neighbor could flag an incident without naming
                anyone. No sign-in. Nothing leaves this tab.
              </p>
              <button
                ref={launcherRef}
                type="button"
                aria-expanded={formOpen}
                aria-controls="ice-report-form"
                onClick={toggleReportForm}
                className="mt-4 inline-flex min-h-10 w-full items-center justify-between gap-3 border border-primary bg-primary px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.13em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {formOpen ? 'Hide report form' : 'Start a preview report'}
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>

              {drafts.length > 0 ? (
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-accent/20 pt-3">
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {drafts.length} local preview{drafts.length === 1 ? '' : 's'} on the map.
                  </p>
                  <button
                    type="button"
                    onClick={clearPreviews}
                    className="inline-flex min-h-8 shrink-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-accent transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Trash2 className="size-3" aria-hidden="true" />
                    Clear
                  </button>
                </div>
              ) : null}

              {notice ? (
                <div
                  role="status"
                  className="mt-3 border border-primary/40 bg-primary/5 p-3 text-xs leading-relaxed text-foreground"
                >
                  <p className="flex items-start gap-2 font-semibold">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    {notice}
                  </p>
                </div>
              ) : null}
            </div>

            <div id="ice-report-form" ref={formRef} className="scroll-mt-28">
              {formOpen ? (
                <section
                  aria-labelledby="ice-form-title"
                  className="border border-border bg-surface-card p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="civic-section-index">New preview</p>
                      <h3
                        id="ice-form-title"
                        className="mt-2 font-display text-2xl font-semibold leading-tight tracking-[-0.035em]"
                      >
                        Report an incident
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={toggleReportForm}
                      aria-label="Close report form"
                      className="flex size-9 shrink-0 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  <a
                    href="tel:911"
                    className="mt-4 flex items-start gap-2.5 border border-accent/40 bg-accent/10 p-3 text-xs font-semibold leading-relaxed text-foreground transition-colors hover:border-accent"
                  >
                    <Phone className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                    <span>
                      Immediate danger? Call 911.
                      <span className="mt-0.5 block font-normal text-muted-foreground">
                        Do not approach, confront, or film enforcement activity.
                      </span>
                    </span>
                  </a>

                  <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
                    <div>
                      <label
                        htmlFor="ice-report-type"
                        className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
                      >
                        What are you reporting?
                      </label>
                      <select
                        id="ice-report-type"
                        name="type"
                        value={reportKind}
                        onChange={(event) => setReportKind(event.target.value as ReportKind)}
                        className="min-h-10 w-full border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                        <option value="enforcement">Enforcement activity</option>
                        <option value="checkpoint">Checkpoint</option>
                        <option value="detention">Detention</option>
                        <option value="community">Community note</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="ice-report-place"
                        className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
                      >
                        Cross streets, landmark, or city
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="ice-report-place"
                          name="place"
                          type="text"
                          required
                          value={placeInput}
                          onChange={(event) => setPlaceInput(event.target.value)}
                          placeholder="e.g. Fair Oaks Blvd & Manzanita Ave, or Chicago, IL"
                          className="min-h-10 min-w-0 flex-1 border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        />
                        <button
                          type="button"
                          aria-pressed={pickingLocation}
                          onClick={togglePicking}
                          className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 border px-2.5 py-2 text-[9px] font-bold uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                            pickingLocation
                              ? 'border-primary bg-primary text-white'
                              : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                          }`}
                        >
                          <Crosshair className="size-3.5" aria-hidden="true" />
                          {pickingLocation ? 'Cancel' : 'Pick map'}
                        </button>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        {draftPoint
                          ? 'Map point selected. The preview pin is approximate.'
                          : 'Anywhere in the U.S. Zoom in, then pick a point on the map. General locations only.'}
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="ice-report-time"
                        className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
                      >
                        When did you see it?
                      </label>
                      <select
                        id="ice-report-time"
                        name="time"
                        value={timeInput}
                        onChange={(event) => setTimeInput(event.target.value)}
                        className="min-h-10 w-full border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                        {TIME_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="ice-report-note"
                        className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
                      >
                        What did you see?
                      </label>
                      <textarea
                        id="ice-report-note"
                        name="note"
                        rows={3}
                        maxLength={320}
                        value={noteInput}
                        onChange={(event) => setNoteInput(event.target.value)}
                        placeholder="Describe vehicles, direction of travel, or a road closure. Do not include names, faces, or plate numbers."
                        className="w-full resize-none border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      />
                      <div className="mt-1.5 flex items-start justify-between gap-3 text-[10px] leading-relaxed text-muted-foreground">
                        <p>Never include names, faces, license plates, or immigration status.</p>
                        <span className="shrink-0 font-mono">{noteInput.length}/320</span>
                      </div>
                    </div>

                    <label className="flex items-start gap-2.5 text-xs leading-relaxed text-foreground">
                      <input
                        type="checkbox"
                        name="safe"
                        required
                        checked={safe}
                        onChange={(event) => setSafe(event.target.checked)}
                        className="mt-0.5 size-4 shrink-0 border-border accent-primary"
                      />
                      <span>I am in a safe place and did not intervene or confront anyone.</span>
                    </label>

                    {!canPreview ? (
                      <p className="text-[11px] leading-relaxed text-accent">
                        Pick a point on the map to enable the preview.
                      </p>
                    ) : null}

                    <button
                      type="submit"
                      disabled={!canPreview}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-primary bg-primary px-4 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-muted-foreground"
                    >
                      <Radio className="size-4" aria-hidden="true" />
                      Add preview to map
                    </button>

                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Preview only. No server, storage, or publishing. A live version would require
                      volunteer review before a report appears on the map.
                    </p>
                  </form>
                </section>
              ) : null}
            </div>

            <section
              aria-labelledby="ice-feed-title"
              className="border border-border bg-surface-card"
            >
              <div className="border-b border-border p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="civic-section-index">Alert feed</p>
                    <h2
                      id="ice-feed-title"
                      className="mt-2 font-display text-2xl font-semibold leading-tight tracking-[-0.035em] sm:text-3xl"
                    >
                      Recent reports
                    </h2>
                  </div>
                  <span className="civic-stamp">{visibleReports.length} shown</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Sacramento-region samples, nationwide examples, and local previews. Nothing here
                  is live.
                </p>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-0 flex-1">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <label htmlFor="ice-search" className="sr-only">
                      Search sample alerts
                    </label>
                    <input
                      id="ice-search"
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search street, place, or note"
                      className="min-h-10 w-full border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    />
                  </div>
                  <div>
                    <label htmlFor="ice-status-filter" className="sr-only">
                      Filter by status
                    </label>
                    <select
                      id="ice-status-filter"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                      className="min-h-10 w-full border border-border bg-background px-2.5 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
                    >
                      <option value="all">All statuses</option>
                      <option value="verified">Confirmed</option>
                      <option value="unconfirmed">Unconfirmed</option>
                      <option value="cleared">Cleared</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                {visibleReports.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="font-display text-xl font-semibold tracking-[-0.02em]">
                      No reports match those filters.
                    </p>
                    <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">
                      Try a street, a different type, or all statuses.
                    </p>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-4 inline-flex min-h-9 items-center justify-center border border-border px-3 py-2 text-[9px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  visibleReports.map((report) => {
                    const meta = TYPE_META[report.kind];
                    const status = statusFor(report);
                    const StatusIcon = status.icon;
                    const pin = pinLabelFor(report, drafts);
                    const selected = report.id === selectedId;

                    return (
                      <button
                        key={report.id}
                        type="button"
                        onClick={() => focusReport(report)}
                        aria-pressed={selected}
                        className={`flex w-full flex-col gap-1.5 border-b border-border p-4 text-left transition-colors last:border-b-0 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                          selected ? 'border-l-2 border-l-accent bg-accent/5' : ''
                        }`}
                      >
                        <span className="flex w-full items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                            <span className={`size-2.5 border ${meta.dot}`} aria-hidden="true" />
                            {pin} / {report.time}
                          </span>
                          <span
                            className={`inline-flex shrink-0 items-center gap-1 border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${status.badge}`}
                          >
                            <StatusIcon className="size-3" aria-hidden="true" />
                            {status.shortLabel}
                          </span>
                        </span>
                        <span className="flex flex-wrap items-baseline gap-2">
                          <span className="font-display text-lg font-semibold leading-tight tracking-[-0.02em]">
                            {report.place}
                          </span>
                          {report.isDraft ? <span className="civic-stamp">Your preview</span> : null}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                          {meta.shortLabel} &middot; {report.isDraft ? 'Added locally' : 'Sample report'}
                        </span>
                        <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {report.note}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20">
        <div className="grid gap-6 border-t border-foreground/20 pt-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-10">
          <div>
            <p className="civic-section-index">The proposed flow</p>
            <h2 className="mt-2 max-w-md font-display text-3xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-4xl">
              Fast to share. Checked before it shows.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              A community alert should help neighbors make a safety decision, not turn into a
              surveillance log. The design keeps reports short, locations general, and identity out
              of the map.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                number: '01',
                title: 'A neighbor reports',
                body: 'A time, a general location, and what they saw. No names, faces, or plates.',
              },
              {
                number: '02',
                title: 'A volunteer checks',
                body: 'A trained chapter volunteer reviews safety and accuracy before a pin is shown.',
              },
              {
                number: '03',
                title: 'The map updates',
                body: 'Neighbors see the last update time and whether a report is confirmed or cleared.',
              },
            ].map((step) => (
              <div key={step.number} className="border-t border-foreground/25 pt-3">
                <span className="font-mono text-[10px] font-bold tracking-[0.16em] text-accent">
                  {step.number}
                </span>
                <h3 className="mt-2 font-display text-xl font-semibold tracking-[-0.02em]">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-3">
          <div className="flex items-start gap-3 bg-surface-muted p-4 sm:p-5">
            <Users className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">
                Community-owned
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Built for neighbors to look out for one another, not to identify or track people.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-surface-muted p-4 sm:p-5">
            <Eye className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">
                Review before display
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                An unverified report would never look the same as a confirmed one.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-surface-muted p-4 sm:p-5">
            <FileWarning className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            <div>
              <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">
                Not an emergency service
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                The map cannot dispatch help. In an emergency, call 911.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 border-l-2 border-accent bg-accent/5 p-4 sm:p-5">
          <h3 className="flex items-center gap-2 font-display text-xl font-semibold tracking-[-0.02em]">
            <AlertTriangle className="size-4 text-accent" aria-hidden="true" />
            What this demo does not do
          </h3>
          <ul className="mt-2 grid gap-1.5 text-sm leading-relaxed text-muted-foreground sm:grid-cols-2">
            <li>
              No live reports, collection, or server storage; map tiles load from OpenStreetMap.
            </li>
            <li>No dispatch, legal advice, or immigration advice.</li>
            <li>No names, faces, plate numbers, or immigration status.</li>
            <li>No encouragement to approach or confront enforcement.</li>
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="border-y border-border bg-surface-muted p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div>
              <p className="civic-section-index">For early feedback</p>
              <h2 className="mt-2 max-w-xl font-display text-3xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-4xl">
                Would this help your community?
              </h2>
            </div>
            <div className="grid gap-3 text-sm leading-relaxed text-muted-foreground sm:grid-cols-3">
              <p>Can you find your neighborhood and understand a pin in a few seconds?</p>
              <p>What would make a report feel trustworthy without exposing anyone?</p>
              <p>What safety or language guidance is missing from this concept?</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
