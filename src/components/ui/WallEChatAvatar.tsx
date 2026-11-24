'use client';

import Image from 'next/image';

export function WallEAvatar({
  small = false,
  inButton = false,
}: {
  small?: boolean;
  inButton?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      data-testid="walle-avatar"
      className={`inline-flex shrink-0 items-center justify-center ${
        inButton
          ? 'size-11 rounded-full bg-transparent p-0'
          : `rounded-sm bg-primary p-1 ring-2 ring-white/80 dark:bg-primary-bright dark:ring-white/20 ${small ? 'size-9' : 'size-12'}`
      }`}
    >
      <span
        className={`relative block aspect-[271/237] size-full overflow-hidden bg-white p-0.5 ${
          inButton ? 'rounded-full' : 'rounded-sm'
        }`}
      >
        <Image
          src="/walle-avatar.png"
          alt=""
          fill
          sizes={small ? '28px' : inButton ? '48px' : '40px'}
          className="object-cover"
          priority={!small}
        />
      </span>
    </span>
  );
}
