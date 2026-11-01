const BACKEND_VERIFICATION_NAME = 'backend verification probe'

export function isBackendVerificationProbe(name: string, message: string): boolean {
  return (
    name.trim().toLowerCase() === BACKEND_VERIFICATION_NAME &&
    /\bprobe for cleanup\b/i.test(message)
  )
}

export function resolveContactNotificationRecipient(input: {
  name: string
  message: string
  defaultRecipient: string
  verificationRecipient?: string
}): string | null {
  if (!isBackendVerificationProbe(input.name, input.message)) {
    return input.defaultRecipient
  }

  const recipient = input.verificationRecipient?.trim()
  return recipient && recipient.includes('@') ? recipient : null
}