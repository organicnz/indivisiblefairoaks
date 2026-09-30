/**
 * Intrinsic dimensions of an image, read from its own bytes.
 *
 * ## Why this exists
 *
 * `content.body` images are emitted as `<img src alt width height loading>`, and
 * the block model has carried `width` / `height` since the editor was written.
 * Nothing ever populated them, so every content image on the site shipped with
 * no intrinsic size — which is a guaranteed layout shift as the image arrives,
 * and a direct violation of AGENTS.md coding rule 5.
 *
 * The dimensions have to come from the bytes rather than from the browser. An
 * author-supplied width is a number nobody verifies, and the URL field is the
 * one path that produces a `src` with no `File` behind it at all. The bytes we
 * just wrote to the bucket are the one thing that cannot lie, and they are
 * already in hand at upload time.
 *
 * Every route into `ContentImageInput` that carries a file — the picker, the
 * drop target and the clipboard paste — goes through the same `upload()` call,
 * so all three are measured. Only a hand-typed or pasted *URL* is unmeasured,
 * and the editor clears the block's dimensions for that case rather than
 * leaving a stale pair describing the previous image.
 *
 * ## What it does not do
 *
 * It does not decode pixels, resize, or validate. It reads the header each format
 * already stores its size in — a few bytes in, a few bytes out — and returns
 * `null` for anything it does not recognise rather than guessing. A wrong
 * dimension is worse than no dimension: the browser reserves the wrong space and
 * the shift is still there, only now it also distorts the image.
 */

/** Formats the editor's uploader accepts, per `uploadContentImage`'s allowlist. */
export type MeasuredImageType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * A dimension of zero is not a dimension. Some encoders write it for a
 * degenerate image, and `width="0"` makes the browser render nothing at all.
 */
/** Read two uint16 big-endian values as `{ first, second }`, or `null`. */
function pairAt(data: Uint8Array, offset: number): [number, number] | null {
  if (offset + 4 > data.length) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const first = view.getUint16(offset, false);
  const second = view.getUint16(offset + 2, false);
  if (first === 0 || second === 0) return null;
  return [first, second];
}

/** PNG: an IHDR chunk at a fixed offset, both dimensions uint32 big-endian. */
function pngSize(data: Uint8Array): ImageDimensions | null {
  const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (data.length < 24) return null;
  for (let i = 0; i < SIGNATURE.length; i += 1) {
    if (data[i] !== SIGNATURE[i]) return null;
  }
  // 8-byte signature, then a 4-byte length and the 4-byte 'IHDR' tag.
  if (!(data[12] === 0x49 && data[13] === 0x48 && data[14] === 0x44 && data[15] === 0x52)) {
    return null;
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  if (width === 0 || height === 0) return null;
  return { width, height };
}

/** GIF: `GIF87a` / `GIF89a`, then the logical screen size as uint16 little-endian. */
function gifSize(data: Uint8Array): ImageDimensions | null {
  if (data.length < 10) return null;
  // `subarray` rather than six indexed reads: the length is already checked, so
  // the assertions a non-null operator would need are a style cost with no
  // safety benefit here.
  const header = String.fromCharCode(...data.subarray(0, 6));
  if (header !== 'GIF87a' && header !== 'GIF89a') return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  if (width === 0 || height === 0) return null;
  return { width, height };
}

/**
 * JPEG: no fixed offset. Walk the marker segments to the first frame header
 * (SOFn), which stores the size. 0xC4 (DHT), 0xC8 (JPG) and 0xCC (DAC) share the
 * 0xC0 range but are not frame headers, and treating one as one would read
 * garbage.
 */
function jpegSize(data: Uint8Array): ImageDimensions | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 2;

  while (offset + 4 <= data.length) {
    if (data[offset] !== 0xff) {
      // Not sitting on a marker. Resynchronising here rather than giving up
      // costs one byte of scanning and tolerates padding some encoders emit.
      offset += 1;
      continue;
    }
    // `subarray` past the bounds check rather than an indexed read: a marker
    // byte at the very end of a truncated file reads as `undefined`, which is
    // not `0xff`, so the resynchronisation below handles it correctly.
    const marker = data.subarray(offset + 1, offset + 2)[0] ?? 0;
    // Start of scan: entropy-coded data follows, so any size beyond it is
    // unreachable. Giving up is correct, not a limitation.
    if (marker === 0xda) return null;
    // Standalone markers carry no length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    if (offset + 4 > data.length) return null;
    const segmentLength = view.getUint16(offset + 2, false);
    if (segmentLength < 2) return null;

    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrameHeader) {
      // SOFn: marker(2) length(2) precision(1) **height(2) width(2)**.
      //
      // Height comes *before* width here — the reverse of every other format
      // here, and of the obvious reading. Getting it backwards does not fail;
      // it returns a confidently transposed pair, which reserves a portrait box
      // for a landscape image and vice versa.
      const pair = pairAt(data, offset + 5);
      return pair ? { width: pair[1], height: pair[0] } : null;
    }
    offset += 2 + segmentLength;
  }
  return null;
}

/**
 * WebP: a RIFF container whose first chunk says how the image is stored, so the
 * width lives at a different offset per variant. All three are little-endian.
 */
function webpSize(data: Uint8Array): ImageDimensions | null {
  if (data.length < 30) return null;
  if (String.fromCharCode(...data.subarray(0, 4)) !== 'RIFF') return null;
  if (String.fromCharCode(...data.subarray(8, 12)) !== 'WEBP') return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const chunk = String.fromCharCode(...data.subarray(12, 16));

  if (chunk === 'VP8X') {
    // Extended: 24-bit fields, stored as size-1 because 2^24 is not
    // representable. The payload starts at offset 20, so the canvas occupies
    // 24-29 — which the `>= 30` guard above has already established exists.
    // Read them directly rather than defensively: the bytes cannot be missing,
    // and a default here would document a truncation path that cannot occur.
    return {
      width: 1 + (data[24] | (data[25] << 8) | (data[26] << 16)),
      height: 1 + (data[27] | (data[28] << 8) | (data[29] << 16)),
    };
  }

  if (chunk === 'VP8 ') {
    // Lossy: a 3-byte frame tag, then a 3-byte sync code, then 14-bit dimensions.
    // No length guard: the one at the top of this function covers it.
    if (data[23] !== 0x9d || data[24] !== 0x01 || data[25] !== 0x2a) return null;
    const width = view.getUint16(26, true) & 0x3fff;
    const height = view.getUint16(28, true) & 0x3fff;
    if (width === 0 || height === 0) return null;
    return { width, height };
  }

  if (chunk === 'VP8L') {
    // Lossless: one signature byte, then two packed 14-bit fields in a 32-bit
    // little-endian word — `width-1` in bits 0-13, `height-1` in bits 14-27.
    //
    // Read it as the single word it is rather than as byte arithmetic. The
    // fields straddle byte boundaries, so unpacking per byte needs the reader to
    // know that `height`'s low bits share a byte with `width`'s high bits, and
    // getting that shift wrong yields a small plausible number rather than a
    // failure. `>>>` because bit 31 can be set and the shift must stay unsigned.
    //
    // No length guard and no second `DataView`: the one at the top of this
    // function already covers both, and a repeat of either would be a branch
    // that can never be taken.
    if (data[20] !== 0x2f) return null;
    const bits = view.getUint32(21, true);
    // No zero guard: both are `1 + …`, so the minimum is 1.
    const width = 1 + (bits & 0x3fff);
    const height = 1 + ((bits >>> 14) & 0x3fff);
    return { width, height };
  }

  return null;
}

/**
 * The intrinsic size of an image, or `null` when no format in scope is readable.
 * Callers must treat `null` as "reserve space some other way", not as a
 * dimension of zero.
 */
export function measureImageSize(
  bytes: Uint8Array,
  contentType: string | null | undefined
): ImageDimensions | null {
  if (!bytes || bytes.length === 0) return null;
  // No optional chain on `[0]`: `split` always yields at least one element, so
  // it could never be undefined and the branch would be untestable.
  const type = (contentType ?? '').split(';')[0].trim().toLowerCase();

  // Ordered most- to least-likely, because PNG and JPEG are what browsers and
  // phone cameras actually produce.
  const byType: Record<string, (data: Uint8Array) => ImageDimensions | null> = {
    'image/png': pngSize,
    'image/jpeg': jpegSize,
    'image/jpg': jpegSize,
    'image/webp': webpSize,
    'image/gif': gifSize,
  };

  try {
    const declared = byType[type];
    if (declared) {
      const measured = declared(bytes);
      // Fall through to sniffing rather than stopping here. A mislabelled upload
      // — a `.png` that is really a JPEG — is common enough that losing the
      // dimensions over it would be its own bug, and "the declared type is
      // recognised but the bytes are not it" is precisely the case worth
      // catching. An earlier version only sniffed for *unrecognised* types,
      // which meant the sniff could never help in the situation it was written
      // for.
      if (measured) return measured;
    }
    return pngSize(bytes) ?? jpegSize(bytes) ?? webpSize(bytes) ?? gifSize(bytes);
  } catch {
    // A truncated or hostile header must not fail an upload that has already
    // been validated and written.
    return null;
  }
}
