import { CRMSubNav } from '@/components/admin/crm/CRMSubNav';
import { ClientOnly } from '@/components/ui/ClientOnly';

// Deliberate Cache Components opt-out (Block): inherits the admin session gate.
export const instant = false;

export default function CRMMetaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <ClientOnly fallback={<div className="-mt-4 mb-2 h-9" aria-hidden="true" />}>
        <CRMSubNav />
      </ClientOnly>
      {children}
    </div>
  );
}
