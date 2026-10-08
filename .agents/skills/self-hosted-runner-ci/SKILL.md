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

### 1. V8 Heap Memory Tuning (`--max-old-space-size=2048`)
Do not set `NODE_OPTIONS: --max-old-space-size=3584` or higher on an 887 MB host.
- **The Swap-Thrashing Trap**: When V8 is given 3584 MB, it defers garbage collection and allows its heap to balloon across swap (1.75 GB virtual memory). During heap traversal and GC, this generates >1,100 page faults every 2 seconds (>110 MB/s swap I/O), pinning the CPU at **91% I/O wait (`wa: 91%`)**.
- **The 2048 MB Sweet Spot**: Setting `--max-old-space-size=2048` prompts timely young-generation GCs, keeping the active working set compact and hot in physical RAM while providing ample headroom against OOMs.
```yaml
env:
  NODE_OPTIONS: --max-old-space-size=2048
  NEXT_TELEMETRY_DISABLED: "1"
```

### 2. Next.js Static Prerender Tuning & Slug Pruning (`next.config.ts` & queries)
On a memory-constrained host, compiling pages in parallel causes multiple V8 compiler processes to fight for RAM, which thrashes swap and exceeds default timeouts.
For CI throwaway/E2E builds:
1. **Prune E2E Prerender Slugs**: Dynamic routes (`/[slug]`, `/products/[slug]`) default to `dynamicParams = true`. During `NEXT_E2E_BUILD === 'true'`, return only 1–2 test fixture slugs instead of querying all 66+ catalog products and CMS articles over the network.
2. **Single CPU Worker & Asset Compression (`compress: !isE2EBuild`)**:
```ts
const isE2EBuild = process.env.NEXT_E2E_BUILD === 'true';

const nextConfig: NextConfig = {
  compress: !isE2EBuild,
  staticPageGenerationTimeout: 180,
  experimental: {
    exposeTestingApiInProductionBuild: isE2EBuild,
    ...(isE2EBuild ? { cpus: 1 } : {}),
  },
  typescript: {
    ignoreBuildErrors: isE2EBuild,
  },
};
```
- **Sequential generation is fast**: A single worker compiles the pruned fixture routes in seconds without swap thrashing.
- **Timeout protection**: The 180s timeout prevents Next.js from failing during momentary I/O peaks.

### 3. Playwright Concurrency (`--workers=1`) & Multi-Viewport Timeouts
Never pass `--workers=2` or higher on self-hosted runners:
- Two Chromium browser processes + Next.js server (`next start`) + Mock server exceed physical RAM.
- Always use `--workers=1` on CI (configured in `playwright.config.ts` or explicitly passed in the workflow step).
- In tests that iterate over a matrix of 8+ viewport sizes sequentially (e.g. `header-fit.spec.ts`), declare `test.slow()` so that serial single-worker execution does not exceed the standard 60s timeout.

### 4. Dependency & Volume Caching
- **Quadlet Host Volumes**: On self-hosted runners, `~/.bun/install/cache` is backed by a host-mounted Quadlet volume (`%h/dev/ghrunner/cache/bun`) on NVMe SSD.
- **Skip Redundant WAN Cache**: Downloading and re-uploading the 1.5 GB bun cache over the internet is redundant on self-hosted runners. Gate the step with `if: "!contains(runner.labels, 'self-hosted')"`.
- **Playwright browsers**: `~/.cache/ms-playwright` is cached via `actions/cache@v4` keyed on `bun.lock`.
- **Next.js cache**: `.next/cache` keyed on `bun.lock`.
