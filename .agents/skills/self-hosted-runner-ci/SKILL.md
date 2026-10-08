---
name: self-hosted-runner-ci
description: >-
  Strict operational rules and optimization patterns for GitHub Actions CI running on the self-hosted rootless Podman runner fleet (ghrunner). Enforces self-hosted runner retention (never switch to ubuntu-latest), SWAP memory tuning, Next.js build timeouts, and single-worker concurrency.
---

# Self-Hosted Runner CI Operations & Optimizations

## Core Rule: Never Switch to `ubuntu-latest`
All repository CI workflows must run on the self-hosted runner fleet (`runs-on: [self-hosted, linux, <role>-runner]`).
**Under no circumstances should any job be changed to `ubuntu-latest`.**
The runner fleet runs as rootless Podman + Quadlet units on our own server (`ghrunner`), reached over Tailscale.

## Host Topology & Resource Reality
- The host runs on a resource-constrained VPS with physical RAM (~1 GB) backed by expanded SWAP (4–6 GB).
- Container memory is bounded by cgroups (`Memory=1024M`, `MemorySwap=4096M`).
- Ephemeral runners register per job, run the workflow, deregister, and exit cleanly.

## Optimization Strategy for Memory & Concurrency

### 1. Allocate V8 Memory to Use Host SWAP
Do not artificially starve V8 of heap memory. With expanded host swap, Node/Bun can comfortably use memory up to the cgroup swap limit:
```yaml
env:
  NODE_OPTIONS: --max-old-space-size=3584
```
This prevents V8 from spending excessive CPU cycles on "Ineffective mark-compacts" or aggressive garbage collection passes.

### 2. Next.js Static Prerender Tuning (`next.config.ts`)
On a memory-constrained host, compiling pages in parallel causes multiple V8 compiler processes to fight for RAM, which thrashes swap and exceeds default timeouts.
For CI throwaway/E2E builds:
```ts
const isE2EBuild = process.env.NEXT_E2E_BUILD === 'true';

const nextConfig: NextConfig = {
  // Prevent Next.js from failing prerenders that momentarily touch swap:
  staticPageGenerationTimeout: 180,
  experimental: {
    exposeTestingApiInProductionBuild: isE2EBuild,
    // Cap to 1 worker so pages generate sequentially without memory contention:
    ...(isE2EBuild ? { cpus: 1 } : {}),
  },
  typescript: {
    // Skip redundant type check in throwaway build (gated in lint job):
    ignoreBuildErrors: isE2EBuild,
  },
};
```
- **Sequential generation is fast**: A single worker compiles all 66 static pages in ~1.5 seconds.
- **Timeout protection**: The default 60s timeout causes Next.js to retry failed pages 3 times (180s per page), creating hour-long build hangs.

### 3. Playwright Concurrency (`--workers=1`)
Never pass `--workers=2` or higher on self-hosted runners:
- Two Chromium browser processes + Next.js server (`next start`) + Mock server exceed physical RAM.
- Always use `--workers=1` on CI (configured in `playwright.config.ts` or explicitly passed in the workflow step).

### 4. Dependency & Browser Caching
Ephemeral runners get fresh containers. Cache package files and browser binaries rather than node_modules:
- **Bun cache**: `~/.bun/install/cache` keyed on `bun.lock`.
- **Playwright browsers**: `~/.cache/ms-playwright` keyed on `bun.lock`.
- **Next.js cache**: `.next/cache` keyed on `bun.lock`.
