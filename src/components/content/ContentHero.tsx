import Image from 'next/image';

type ContentHeroProps = {
  src: string;
  priority: boolean;
};

export function ContentHero({ src, priority }: ContentHeroProps) {
  return (
    <div className="relative mb-12 aspect-[16/9] w-full overflow-hidden border border-border bg-surface-muted">
      <Image
        src={src}
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 896px"
        className="object-cover"
        priority={priority}
      />
    </div>
  );
}
