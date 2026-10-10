import { ArrowLeft, Package } from 'lucide-react';
import Link from 'next/link';
import { ProductCreateForm } from '@/components/admin/ProductCreateForm';
import { requireAdmin } from '@/lib/admin-auth';

// Deliberate Cache Components opt-out (Block): admin surface behind requireAdmin() session gate.
export const instant = false;

export const metadata = {
  title: 'New Material / Resource — Admin · Indivisible Fair Oaks',
  robots: { index: false, follow: false },
};

export default async function AdminNewProductPage() {
  await requireAdmin();

  return (
    <div>
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-2 text-[11px] font-black text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft size={12} /> Back to Products
      </Link>

      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <Package size={14} className="text-foreground" />
          </div>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
            Admin Panel
          </span>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">
          New Product
        </h1>
        <div className="h-1.5 w-24 bg-primary mt-3" />
      </div>

      <section className="bg-surface-card border border-border rounded-3xl p-6 shadow-sm max-w-3xl">
        <h2 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.25em] mb-6">
          Product details
        </h2>
        <ProductCreateForm />
      </section>
    </div>
  );
}
