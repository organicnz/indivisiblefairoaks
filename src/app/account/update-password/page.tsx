'use client';

import { Loader2 } from 'lucide-react';
import { NewPasswordForm } from '@/components/account/NewPasswordForm';
import { PasswordStepUpPanel } from '@/components/account/PasswordStepUpPanel';
import { PasswordUpdatedPanel } from '@/components/account/PasswordUpdatedPanel';
import { usePasswordUpdate } from '@/components/account/use-password-update';

export default function UpdatePasswordPage() {
  const update = usePasswordUpdate();

  if (!update.sessionReady || update.needsStepUp === null) {
    return (
      <div className="civic-page min-h-screen bg-background flex items-center justify-center text-foreground transition-colors duration-300">
        <Loader2 className="w-8 h-8 text-primary dark:text-primary-on-dark animate-spin" />
      </div>
    );
  }

  if (update.needsStepUp) {
    return (
      <PasswordStepUpPanel
        dataPoints={update.dataPoints}
        onContinue={update.goToChallenge}
      />
    );
  }

  if (update.status === 'success') {
    return (
      <PasswordUpdatedPanel dataPoints={update.dataPoints} onContinue={update.goToAccount} />
    );
  }

  return (
    <NewPasswordForm
      dataPoints={update.dataPoints}
      password={update.password}
      confirm={update.confirm}
      showPassword={update.showPassword}
      showConfirm={update.showConfirm}
      status={update.status}
      message={update.message}
      onPasswordChange={update.setPassword}
      onConfirmChange={update.setConfirm}
      onTogglePassword={() => update.setShowPassword((value) => !value)}
      onToggleConfirm={() => update.setShowConfirm((value) => !value)}
      onSubmit={update.handleSubmit}
    />
  );
}
