import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';

type NewPasswordFormProps = {
  dataPoints: Record<string, string>;
  password: string;
  confirm: string;
  showPassword: boolean;
  showConfirm: boolean;
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  onTogglePassword: () => void;
  onToggleConfirm: () => void;
  onSubmit: (event: React.FormEvent) => void;
};

export function NewPasswordForm({
  dataPoints,
  password,
  confirm,
  showPassword,
  showConfirm,
  status,
  message,
  onPasswordChange,
  onConfirmChange,
  onTogglePassword,
  onToggleConfirm,
  onSubmit,
}: NewPasswordFormProps) {
  return (
    <div className="civic-page relative overflow-hidden min-h-screen bg-background flex flex-col items-center justify-center px-4 pt-(--header-clearance) pb-16 text-foreground transition-colors duration-300">
      <VgpuCivicConstellation className="pointer-events-none opacity-25" />
      <div className="relative z-10 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="mb-6 inline-flex items-center gap-3 border border-primary/20 bg-primary/5 px-5 py-2.5 dark:border-white/10 dark:bg-white/5">
            <ShieldCheck className="w-3.5 h-3.5 text-primary dark:text-accent-gold" />
            <span className="text-primary dark:text-accent-gold font-bold uppercase tracking-[0.4em] text-[10px]">
              <DataPoint name="account.password.reset_badge" as="span" initialData={dataPoints}>
                Secure Reset
              </DataPoint>
            </span>
          </div>
          <h1 className="mb-3 font-display text-4xl font-semibold leading-none tracking-[-0.03em] text-foreground">
            <DataPoint name="account.password.new_title" initialData={dataPoints}>
              New <span className="text-primary italic dark:text-primary-on-dark">password</span>
            </DataPoint>
          </h1>
          <p className="text-muted-foreground font-bold uppercase tracking-[0.15em] text-[10px]">
            <DataPoint name="account.password.new_desc" initialData={dataPoints}>
              Choose a strong password for your account
            </DataPoint>
          </p>
        </div>

        <div className="civic-panel overflow-hidden">
          <form onSubmit={onSubmit} className="p-10 space-y-6">
            {/* New Password */}
            <div className="group">
              <label
                htmlFor="new-password"
                className="ml-1 mb-3 block text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground transition-colors group-focus-within:text-primary dark:text-ink-muted-on-dark dark:group-focus-within:text-primary-on-dark"
              >
                <DataPoint name="account.password.new_label" as="span" initialData={dataPoints}>
                  New Password
                </DataPoint>
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary dark:group-focus-within:text-primary-on-dark transition-colors pointer-events-none"
                  size={16}
                />
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  required
                  minLength={8}
                  placeholder={
                    dataPoints['account.password.new_placeholder'] || 'Min. 8 characters'
                  }
                  className="w-full pl-12 pr-12 py-5 bg-surface-muted border border-border rounded-sm focus:ring-4 focus:ring-primary/20 focus:bg-surface-card focus:border-primary dark:focus:border-primary-bright outline-none transition-all font-bold text-foreground text-sm placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={onTogglePassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="group">
              <label
                htmlFor="confirm-password"
                className="ml-1 mb-3 block text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground transition-colors group-focus-within:text-primary dark:text-ink-muted-on-dark dark:group-focus-within:text-primary-on-dark"
              >
                <DataPoint name="account.password.confirm_label" as="span" initialData={dataPoints}>
                  Confirm Password
                </DataPoint>
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary dark:group-focus-within:text-primary-on-dark transition-colors pointer-events-none"
                  size={16}
                />
                <input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => onConfirmChange(e.target.value)}
                  required
                  placeholder={
                    dataPoints['account.password.confirm_placeholder'] || 'Repeat your password'
                  }
                  className="w-full pl-12 pr-12 py-5 bg-surface-muted border border-border rounded-sm focus:ring-4 focus:ring-primary/20 focus:bg-surface-card focus:border-primary dark:focus:border-primary-bright outline-none transition-all font-bold text-foreground text-sm placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={onToggleConfirm}
                  aria-label={
                    showConfirm ? 'Hide password confirmation' : 'Show password confirmation'
                  }
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Match indicator */}
              {confirm.length > 0 && (
                <p
                  className={`mt-2 ml-1 text-[10px] font-bold uppercase tracking-widest ${password === confirm ? 'text-emerald-500' : 'text-rose-500'}`}
                >
                  {password === confirm ? (
                    <DataPoint
                      name="account.password.match_success"
                      as="span"
                      initialData={dataPoints}
                    >
                      ✓ Passwords match
                    </DataPoint>
                  ) : (
                    <DataPoint
                      name="account.password.match_error"
                      as="span"
                      initialData={dataPoints}
                    >
                      ✗ Passwords do not match
                    </DataPoint>
                  )}
                </p>
              )}
            </div>

            {/* Error message */}
            {status === 'error' && (
              <div
                role="alert"
                className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 rounded-sm text-[10px] font-bold uppercase tracking-widest text-center"
              >
                ❌ {message}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-primary dark:bg-primary-bright text-white font-bold rounded-sm py-5 hover:bg-primary-light transition-all uppercase tracking-[0.3em] text-xs flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
            >
              {status === 'loading' ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <DataPoint name="account.password.btn_update" as="span" initialData={dataPoints}>
                  Set New Password
                </DataPoint>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
