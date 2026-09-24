import { CRMSubNav } from '@/components/admin/crm/CRMSubNav';

// Deliberate Cache Components opt-out (Block): inherits the admin session gate.
export const instant = false;

export default function CRMMetaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <CRMSubNav />
      {children}
    </div>
  );
}
