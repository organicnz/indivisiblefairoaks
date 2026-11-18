export type EventRow = {
  slug: string;
  title: string;
  date_label: string;
  time_label: string;
  location_name: string;
  starts_at: string | null;
  ends_at: string | null;
};
export type ContentRow = {
  id: number;
  title: string;
  slug: string;
  status: string | null;
  type: string | null;
  updated_at: string | null;
};
