// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decodeBase64 } from '@/lib/base64';
import { measureImageSize } from '@/lib/image-size';

/**
 * Intrinsic dimensions read from an image's own bytes.
 *
 * ## Why the fixtures are real files
 *
 * Every fixture below is the header of a genuine encoding, produced with macOS
 * `sips` and `cwebp`, with the expected value taken from `sips`' own decoder
 * rather than from this module. That distinction matters more than it looks: a
 * hand-written header only proves the reader agrees with the *author's* idea of
 * the format. It caught exactly that during development — the VP8L bit packing
 * in an earlier hand-built fixture was wrong, and a test written against it
 * would have "proved" the reader wrong too.
 *
 * Dimensions are 640x360, 360x640 and 1023x767 as well as 8x6, so a reader that
 * transposes width and height cannot pass on every case. JPEG is the format that
 * actually stores height *before* width, and it is where that bug lived.
 *
 * Fixtures are header prefixes, which is how `uploadContentImage` calls the
 * reader: it slices rather than reading the whole upload. Odd widths (1023) are
 * included because a reader that assumes byte alignment fails on them.
 */

/** base64 -> bytes, so the fixtures stay readable in source. */
function b64(value: string): Uint8Array {
  return decodeBase64(value) as Uint8Array;
}

const FIXTURES: Record<string, { bytes: Uint8Array; type: string }> = {
  'png-8x6': {
    type: 'image/png',
    bytes: b64(
      'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAJUlEQVR4nGNgYGCQk5OzsbGJioqqqKiYNm3ali1bLl26xDCQEgBFbjsRUdjdPwAAAABJRU5ErkJggg=='
    ),
  },
  'jpeg-8x6': {
    type: 'image/jpeg',
    bytes: b64(
      '/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAACKADAAQAAAABAAAABgAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgABgAIAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A8j/4J3f8wz/gFftJX4t/8E7v+YZ/wCv2koA//9k='
    ),
  },
  'gif-8x6': {
    type: 'image/gif',
    bytes: b64(
      'R0lGODdhCAAGALMAAAAAAB4eHjw8PFpaWnh4eJaWlrS0tNLS0v///wAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAQAAAAALAAAAAAIAAYAAAQSEAQxSDFHUot1vdn0dSIXbmAEADs='
    ),
  },
  'webp-lossy-8x6': {
    type: 'image/webp',
    bytes: b64('UklGRjAAAABXRUJQVlA4ICQAAACQAQCdASoIAAYAAUAmJaQAAp1HI1AA/v0p8ZlP5DtiUHAAAAA='),
  },
  'webp-lossless-8x6': {
    type: 'image/webp',
    bytes: b64('UklGRjIAAABXRUJQVlA4TCYAAAAvB0ABAD8gEEgi2R90iPEYj/lPbAdhtpHCWMYylvN/HkJE/wPbBw=='),
  },
  'webp-lossless-640x360': {
    type: 'image/webp',
    bytes: b64(
      'UklGRnQAAABXRUJQVlA4TGgAAAAvf8JZAM1VIKL/AbVt2zDZ8v/pnRGRkd0X/Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn/9lAw=='
    ),
  },
  'webp-lossless-360x640': {
    type: 'image/webp',
    bytes: b64(
      'UklGRnYAAABXRUJQVlA4TGkAAAAvZ8GfAM1VIKL/AcVt20b5Zf/Nz5YRkZFVDv7zn//85z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c//cQYA'
    ),
  },
  'webp-lossless-1023x767': {
    type: 'image/webp',
    bytes: b64(
      'UklGRi4BAABXRUJQVlA4TCIBAAAv/oO/AM1VIKL/AbVt2zDe/P/tKYyITIc//Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+839/Aw=='
    ),
  },
  'webp-lossy-640x360': {
    type: 'image/webp',
    bytes: b64(
      'UklGRmIGAABXRUJQVlA4IFYGAABQlwCdASqAAmgBLkUwmEwiJCKihABES0t3C535N//B/eA8+c2Uf/AZ+XfzH8qv6N9/5gLoA6QD3A/gH0C94/oB+AGzh//9oBfgH4AbIH8A/gHEA/gH4Abv+ShiSkhtlxRFDwLdzeUJ9Lw6c5z4maRtBU08/ODiK0et+DOTy0CuIlN6D02xsq1fpjzt8+236UI/G2XfStTrLprdX3V8iO8i6ney5SCeueDA/qtuGqLaW0m0nlUfa9H+mYhWAl82aQjgQ8Na5z8bZd9K1Osumt1fdXyI7yLqd7LlIJ654MaCHI/vkdoTBZ9K/RoKKbNdh2d93yh5wupEbE3rFEdfte47UGKUICvoYKMYitI0wQ3giuSE6qPQYvBcW74KC/zm61fYYSqGrI2WLUjSBjkRMhNZoPt2E45Lc3nbYUoj4q65Ot0UJmuSPJbm88GnLkjt+TtE1HO2zCb3lCKGEP2tqpbfiann6wY5ah3w7YvpqQx0Z2LC+pwenX7WmR9SLVuby6hxpFQYbqgs5FdoOf/ySoasOgoxErnltCv2ttBz/8bWDdUFnIp6n85QMGUhjozspueS1s8lYjpX5WN60Mi/r2g5/+S3N5a2eSsR0r81dCOuySX9G5TNe7nRP5JUNWHQUYiu+XB706DmHQUYn/1HOvd0IWdLyViOlfmroR12SS/o3KZr3c6J/JKhqw6CjEV3y4PenQcw6CjE/+o517uhCzpeSsR0r81dCOuySX9G5TNe7nRP5JUNWHQUYiu+XB706DmHQUYn/1HOvd0IWdLyViOlfmroR12SS/o3KZr3c6J/JKhqw6CjEV3y4PenQcw6CjE/+o517uhCzpeSsR0r81dCOuySX9G5TNe7nRP5JUNWHQUYiu+XB706DmHQUYn/1HOvd0IWdLyViOlfmroR12SS/o3KZr3c6J/JKhqw6CjEV3y4PenQcw6CjE/+o517uhCzpeSsR0r81dCOuySX9G5TNe7nRP5JUNWHQUYiu+XB706DmHQUYn/1HOvd0IWdLyViOlfmroR12SS/o3KZr3c6J/JKhqw6CjEV3y4PenQcw6CjE/+o517uhCzpeSsR0r81dCOuySX9G5TNe7nRP5JUNWHQUYiu+XB706DmHQUYn/1HOvd0IWdLyViOlfmroR12SS/o3KZr3c6J/JKhqw6CjEV3y4PenQcw6CjE/+o517uhCzpeSsR0r81dCOuySX9G5TNe7nRP5JUNWHQUYiu+XB706DmHQUYn/1HOvd0IWdLyViOlfmroR12SS/o3KZr3c6J/JKhqw6CjEV3y4PenQcw6CjE/+o517uhCzpeSsR0r81dCOuySX9G5TA=='
    ),
  },
  'webp-lossy-360x640': {
    type: 'image/webp',
    bytes: b64(
      'UklGRuQFAABXRUJQVlA4INgFAADwjgCdASpoAYACPlkijEUjoiEfSXwYOAWEtLdwuugS//yDaFtf+toj/pmSH/o/22qP/TX/MPf+GB/APoF7y+gDZxewB+AGuAcIB9gG9/hFxAefe1adQRJmMQ6bjcqVQZKWQToHOiu4J9/Vod1W1X8udYzIEdnK+6HsvQ2Z94lOsHpwBSG239HA3WiYTUESZjEOm43KlUGSlkE6vk0VjlvFDTmT6NTNMklbW8bF7b3mK5b494oOYE6ORZphcC4FL+6DkrXT107S/+pwuzlv8JzJj6XApf3Qcla6fusfzYPrnYn781fxL40c7liNE/AR/lg4MN107E/fmr+JfGjncsRfY3rFTeAmcYXOZWsU9/WRlRFXHMqM9y1FanawPuahTRaOUfzK1inv6zJzlqhTDZdFkoI/Bk7fqcLuul5K9XcP1wzPk77ctUKYbLoslBH4Mnb9Thd10vJXq7h+uIry3WegvctRWp2sD7moU0WjlH8ytYp7+syc5aoUw2XRZKCPwZO36nC7rpeSvV3D9cRXlus9Be5aitTtYH3NQpotHKP5laxT39Zk5y1QphsuiyUEfgydv1OF3XS8leruH64ivLdZ6C9y1FanawPuahTRaOUfzK1inv6zJzlqhTDZdFkoI/Bk7fqcLuul5K9XcP1xFeW6z0F7lqK1O1gfc1Cmi0co/mVrFPf1mTnLVCmGy6LJQR+DJ2/U4XddLyV6u4fd9y1LU5aoUw2XRZKCPwZO36nC7rpeSvV3D7vuWpanLVCmGy6LJQR+DJ2/U4XddLyV6u4fd9y1LU5aoUw2XRZKCPwZO36nC7rpeSvV3D7vuWpanLVCmGy6LJQR+DJ2/U4XddLyV6u4fd9y1LU5aoUw2XRZKCPwZO36nC7rpeSvV3D7vuWpanLVCmGy6LJQR+DJ2/U4XddLyV6u4fd9y1LU5aoUw2XRZKCPwZO36nC7rpeSvV3D7vuWpanLVCmGy6LJQR+DJ2/U4XddLyV6u4fd9y1LU5aoUw2XRZKCPwZO36nC7rpeSvV3D7vuWpanLVCmGy6LJQR+DJ2/U4XddLyV6u4fd9y1LU5aoUw2XRZKCPwZO36nC7rpeSvV3D7vuWpanLVCmGy6LJQR+DJ2/U4XddLyV6u4fd9y1LU5aoUw2XRZKCPwZO36nC7rpeSvV3D7vuWpanLVCmGy6LJQR+DJ2/U4XddLyV6u4fd9y1LU5aoUw2XRZKCPwZO36nC7rpeSvV3D7vuWpanLVCmGy6LJQR+DJ2/U4XddLyV6u4fd9y1LU5aoUw2XRZKCPwZO36nC7rpeSvV3D7vuWpanLVCmGy6LJQR+DJ2/U4XddLyV6g=='
    ),
  },
  'jpeg-640x360': {
    type: 'image/jpeg',
    bytes: b64(
      '/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAACgKADAAQAAAABAAABaAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgBaAKAAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAKP/aAAwDAQACEQMRAD8A/GH4f/8ALP8ACvuD4f8A/LP8K+H/AIf/APLP8K+4Ph//AMs/woA+4Ph//wAs/wAK+4Ph/wD8s/wr4f8Ah/8A8s/wr7g+H/8Ayz/CgD5f/wCCtv8Ayax4R/7HOw/9N2o1+L/w/wD+Wf4V+0H/AAVt/wCTWPCP/Y52H/pu1Gvxf+H/APyz/CgD7g+H/wDyz/CvuD4f/wDLP8K+H/h//wAs/wAK+4Ph/wD8s/woA+4Ph/8A8s/wr+d//goR/wAn2fEj/uC/+meyr+iD4f8A/LP8K/nf/wCChH/J9nxI/wC4L/6Z7KgDn/h//wAs/wAK+4Ph/wD8s/wr4f8Ah/8A8s/wr7g+Hw=='
    ),
  },
  'jpeg-360x640': {
    type: 'image/jpeg',
    bytes: b64(
      '/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAABaKADAAQAAAABAAACgAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgCgAFoAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAF//aAAwDAQACEQMRAD8A/GH4f/8ALP8ACvuD4f8A/LP8K+H/AIf/APLP8K+4Ph//AMs/woA+4Ph//wAs/wAK+4Ph/wD8s/wr4f8Ah/8A8s/wr7g+H/8Ayz/CgD5f/wCCtv8Ayax4R/7HOw/9N2o1+L/w/wD+Wf4V+0H/AAVt/wCTWPCP/Y52H/pu1Gvxf+H/APyz/CgD7g+H/wDyz/CvuD4f/wDLP8K+H/h//wAs/wAK+4Ph/wD8s/woA+4Ph/8A8s/wr+d//goR/wAn2fEj/uC/+meyr+iD4f8A/LP8K/nf/wCChH/J9nxI/wC4L/6Z7KgDn/h//wAs/wAK+4Ph/wD8s/wr4f8Ah/8A8s/wr7g+Hw=='
    ),
  },
  'jpeg-1023x767': {
    type: 'image/jpeg',
    bytes: b64(
      '/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAD/6ADAAQAAAABAAAC/wAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgC/wP/AwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAQP/aAAwDAQACEQMRAD8A/GH4f/8ALP8ACvuD4f8A/LP8K+H/AIf/APLP8K+4Ph//AMs/woA+4Ph//wAs/wAK+4Ph/wD8s/wr4f8Ah/8A8s/wr7g+H/8Ayz/CgD5f/wCCtv8Ayax4R/7HOw/9N2o1+L/w/wD+Wf4V+0H/AAVt/wCTWPCP/Y52H/pu1Gvxf+H/APyz/CgD7g+H/wDyz/CvuD4f/wDLP8K+H/h//wAs/wAK+4Ph/wD8s/woA+4Ph/8A8s/wr+d//goR/wAn2fEj/uC/+meyr+iD4f8A/LP8K/nf/wCChH/J9nxI/wC4L/6Z7KgDn/h//wAs/wAK+4Ph/wD8s/wr4f8Ah/8A8s/wr7g+Hw=='
    ),
  },
  'png-640x360': {
    type: 'image/png',
    bytes: b64(
      'iVBORw0KGgoAAAANSUhEUgAAAoAAAAFoCAIAAABIUN0GAAATkklEQVR4nO3VZxsQAgCF0RIq7WSlZRQaspOkskJZRWiojCKhUhSljOwiq0kokVVkNDWNhhZCZjuV1dTCz/Dhnt9wz/PeAgUKFChcuHDJkiUPOuigChUqHHXUUdWrVz/xxBNPP/30Bg0anH/++RdffPEVV1zRqlWr66677uabb+7Spctdd91177339u/f/4knnnjmmWeGDRv28ssvv/766+PGjfvwww+nTZs2Z86c+fPnL1269Lvvvvvll1/WrVv3+++/b9u2bc+ePYUKFTrggAPKlClz6KGHVq5cuVq1arVq1TrllFPq1at39tlnX3jhhZdddtlVV1117bXX3njjjZ07d77jjjvuvvvu++6775FHHnnyySeff/75F154YfTo0W+++eZ77703adKkGTNmfPbZZwsXLvz6669/+OGHVatWbdiw4a+//vr777///fff/fffv0SJEuXKlTv88MOPPPLI44477oQTTqhTp85ZZ5113nnnNW3atHnz5i1btmzfvv1NN910++2333nnnX369HnwwQcff/zxp59+eujQoS+99NJrr732zjvvfPDBB1OnTp09e/a8efOWLFny7bff/vzzz2vXrv3tt9+2bt26e/fuffbZp2jRoqVLlz7kkEMqVapUtWrVmjVrnnzyyWeccUajRo0uuOCCSy+9tEWLFm3atLnhhhtuueWWbt269erVq1+/fg8//PDAgQOfe+65ESNGjBo16o033nj33XcnTpw4ffr0Tz/99Isvvvjqq6++//77lStX/vrrr3/++eeOHTv++eef/fbbr3jx4gceeGD58uWPOOKIY489tnbt2qeddlr9+vXPPffcJk2aNGvW7JprrmnXrl3Hjh1vu+22Hj169O7d+4EHHnjssccGDRo0ZMiQkSNHjhkz5u23337//fenTJkya9asuXPnLl68+Jtvvvnpp5/WrFmzadOmLVu27Nq1q2DBgkWKFClVqtTBBx9csWLFo48+ukaNGieddFLdunUbNmzYuHHjSy655Morr2zduvX111/fqVOnrl279uzZs2/fvg899NCAAQOeffbZ4cOHv/LKK2PHjh0/fvxHH3308ccff/LJJwsWLPjyyy+XL1++YsWK9evX//HHH9u3b9+7d+++++5brFixsmXLHnbYYVWqVDnmmGOOP/74U0899cwzzzznnHMuuuiiyy+//Oqrr27btm2HDh1uvfXW7t2733PPPffff/+jjz761FNPDR48+MUXX3z11VffeuutCRMmTJ48eebMmZ9//vmiRYuWLVv2448/rl69euPGjZs3b965cyf//PPP/w=='
    ),
  },
  'webp-extended-640x360': {
    type: 'image/webp',
    bytes: b64(
      'UklGRg4CAABXRUJQVlA4WAoAAAAQAAAAfwIAZwEAQUxQSBoAAAABBxARERASJP4fbyWi/xn/+c9//vOf//y/AFZQOCDOAQAAsDQAnQEqgAJoAT6RSKFNJaQjIiAIALASCWlu4XdhG0AJ7APfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2OAAD+/94IqOuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    ),
  },
  'webp-extended-360x640': {
    type: 'image/webp',
    bytes: b64(
      'UklGRg4CAABXRUJQVlA4WAoAAAAQAAAAZwEAfwIAQUxQSBoAAAABBxARERASJP4fbyWi/xn/+c9//vOf//y/AFZQOCDOAQAAsDQAnQEqaAGAAj6RSKFNJaQjIiAIALASCWlu4XdhG0AJ7APfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99snIe+2OAAD+/94IsWgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    ),
  },
  'gif-640x360': {
    type: 'image/gif',
    bytes: b64(
      'R0lGODdhgAJoAcQAAAAAAAwMDBMTExwcHCQkJCsrKzMzMzw8PEREREtLS1RUVFxcXGNjY2tra3R0dHx8fIODg4yMjJSUlJubm6Ojo6ysrLS0tLu7u8TExMzMzNPT09vb2+Tk5Ozs7PPz8////yH5BAQAAAAALAAAAACAAmgBAAX/IAAEwkAUxnEgibIwjeM8UCRNVFVZF5ZpGw6n4/mMSibUquWCzWo23K7nAw6LRlLSkGI1GzFalJLjVTdBYlZQOnUTrVcYUruVL71f2lM8JpVeL05iN1JmP1ZqI1puK4GDhIaHiYqMjYFyTzZ2Uz56V0Z+jUtfMpE5nZ+gflukpWJjnWega1tvX3Njd2d7a22AcK90sTx5iXy1J8BNg3UThsbHWYyAj2GnO5NplW2XcZmEnIefiqJKpJmanKlWq1qtXsIRxFTkWOZc6DC5drt6vUd+vYkzSAS1FPpiqJPCLog7JN4UyKOHYZaaZChuyeGHwx8QgCQELiE4x9kdY3v6/1BbJogjtCrSFolEYG0GNgvahnAzEXEBuDri8tgLdVBFzYWocj4cAI/Jz3lBKw7FmM8aRzINQbJpSvKJySkor6j8xZJBsygvEYEsSrPrg5s5O+wk0POphKgZhhoUmdDU14ZCdjaV+JSixXsHNe5D6hHNw5nBwO1t1RepDqWCI06MevgDVcVgGGd9zFXY12KHx/5RfLaQx5gB2NZ8ezru3Lqt8erFZ7SrZcBLB29+2flzwquNtUJ2OyxoWCKqlbF2+XrtzNlwn99maVd3TN6VsQHPvGz4ruL4QCMfzW35q8mjjorHrFp4Yc5T0x8XrU156Z+n4ZEaRmW19kx17sjmVv92Fm2nUXdp7VZUeH/RV4t9ZxmWX2L7nZIcad4wF+BzyJhTIHXswKbgKwyS4yA6EPojIV/yVRhWcJrdR9yGAqnHH0r+hfgeeDXGMl59OWaInzTGWfUjLyACIyI9JEZXwIkLpaWBitctWJt20eHGj3cAEenbfDeSd4t5svBoS4cmfdjef82MOKCJ02WJYCUrgtMiJWFyl1uE301Y5DoWspJkLhoyqZ+THrI3lnuSmVnKb4m+s6gmjfbSJEnr9RflQKZReedKeUaiJZfwYPdlg4E+OKiMhdJ4po2z4Fiejue56YaPkYo6p5AAmmqPlViquqdKfULyqouxwjhrKjNSdij/Q5lCtKuSOzrKIaRxSuoLnWHAd861SaWJ5LaMLunpo6A++c+oI5Xq3KlkperMqta16iUxtkWLybTj1GrtrUZmy9SmsLhLC7y4yPsRvSxMee+xBOqL1rLTdMnis4AmI6Y6ZK5iaTpo5qqmK7y26W2PcOoibkDkzmAuQuhepu6FDA=='
    ),
  },
  'gif-360x640': {
    type: 'image/gif',
    bytes: b64(
      'R0lGODdhaAGAAsQAAAAAAAwMDBMTExwcHCQkJCsrKzMzMzw8PEREREtLS1RUVFxcXGNjY2tra3R0dHx8fIODg4yMjJSUlJubm6Ojo6ysrLS0tLu7u8TExMzMzNPT09vb2+Pj4+zs7PPz8////yH5BAQAAAAALAAAAABoAYACAAX/IAAEwkAUxnEgibIwjeM8UCRNVFVZF5ZpGw6n4/mMSibUquWCzWo23K7nAw6LRlLSkGI1GzFalJLjVTdBYlZQOnUTrVcYUruVL71f2lM8JpVeL05iN1JmP1ZqI1puK4GDhIaHiYqMjYFyTzZ2Uz56V0Z+jUtfMpE5nZ+gflukpWJjnWega1tvX3Njd1UijEqkmZqcqVarWq1er1CcZrNqtW63crl2u3p7a22AcMp1hnjOfNAF202D3t9ViX0Bvl2PYac7k2mVbZdxmYTMeZ+Kor/gmfKGip4QewOQMdG3LF24D+O4AINBDYc1Db20pZgYQ5gUYkGMIcGnQFmEWM38/2EBKBFeRTIgsR3RuCTOOYJT8qxjp62coIrpEMlsRxOBwAfyLBjsgJAAyQUMNwVVGcqdCoEeC+oMiVBhyagoqVCNKI1i1osZW3EcGAvkQZ4JSZoMi+EhWY4vL6IRWZQbQ5w8tl6Be8Ing3NRgmpYl8WqUZvxAC9t+jSqBH6eGKcdhVWeW5Fxy83FbJdlWTBniW0OCJntMIOgvY52ONY03tT0hrJR2JoGYHAqCZMri7jQRc1EkR1NOplw5eKYM1BdvbEzzs9d5YIlXdvd6byqWV5tnVUH7Oyit9NmfNcl7q26+/amE1YwEeGGi09QjNzxcsn2UeaTZdFNJ95a5WEHl/9s6u1Smne3nYLWgda1dd6C2iFG14MafffeGfHx1k194eBHHFDHDeVfb8wF6NyA0E2lGYXkeXZhLQxqyB17trknYXhWIWijYLFlmMuG3XUYIUF6hYjPfL/ZJw5A+aFITH9F/YdSc9A8R02BMwZZ4WtEonfLbA4macuSugBJk5DX3ciKkZogySOEPjIZE18i/kVicONU6RF/KmbJIoDOCCgNgTLKRGMpCcp5DJ2w7IhNe5CBNwl140E65CxFpqfjepf2mOmH1/D55Ij8SGniRPoRasyKr7SY6IuLxmiNgWLWGGeZGIp6pKW0mIoLqhg9GsynqpjpSoOyqBkNm9XsaY//fKx+42qgJw6a4qyG1oqoP4oCw+iuYb455keSjiRsncQ+Y+w0yHIKp4XA4khpQ2neqWSebeam6jZQ/rkTt7BaOQmWyh26pYtdwvhlo6so60Sk+c75bqWkFovnqT9uanFHzBbjbDLQpuTvmgBXK/C1fd5k8B6vPhLrt5XQqo+t5A=='
    ),
  },
};

/** What the OS decoder reports for each fixture. Asserted, not assumed. */
const EXPECTED: Record<string, { width: number; height: number }> = {
  'png-8x6': { width: 8, height: 6 },
  'jpeg-8x6': { width: 8, height: 6 },
  'gif-8x6': { width: 8, height: 6 },
  'webp-lossy-8x6': { width: 8, height: 6 },
  'webp-lossless-8x6': { width: 8, height: 6 },
  'webp-lossless-640x360': { width: 640, height: 360 },
  'webp-lossless-360x640': { width: 360, height: 640 },
  'webp-lossless-1023x767': { width: 1023, height: 767 },
  'webp-extended-640x360': { width: 640, height: 360 },
  'webp-extended-360x640': { width: 360, height: 640 },
  'webp-lossy-640x360': { width: 640, height: 360 },
  'webp-lossy-360x640': { width: 360, height: 640 },
  'jpeg-640x360': { width: 640, height: 360 },
  'jpeg-360x640': { width: 360, height: 640 },
  'jpeg-1023x767': { width: 1023, height: 767 },
  'png-640x360': { width: 640, height: 360 },
  'gif-640x360': { width: 640, height: 360 },
  'gif-360x640': { width: 360, height: 640 },
};

describe('measureImageSize, against real encodings', () => {
  for (const [name, fixture] of Object.entries(FIXTURES)) {
    it(`reads ${name}`, () => {
      expect(measureImageSize(fixture.bytes, fixture.type)).toEqual(EXPECTED[name]);
    });
  }

  it('covers every format the uploader accepts', () => {
    const formats = new Set(Object.values(FIXTURES).map((f) => f.type));
    expect([...formats].sort()).toEqual(['image/gif', 'image/jpeg', 'image/png', 'image/webp']);
  });

  it('never transposes: landscape, portrait and odd cases are all distinct', () => {
    // A swapped reader returns a correct-looking pair for a square image and a
    // wrong one everywhere else, so a single fixture proves very little.
    for (const name of Object.keys(EXPECTED)) {
      const expected = EXPECTED[name];
      const fixture = FIXTURES[name];
      if (!expected || !fixture) throw new Error(`missing fixture ${name}`);
      const { width, height } = expected;
      expect(measureImageSize(fixture.bytes, fixture.type)).toEqual({
        width,
        height,
      });
    }
  });
});

/**
 * The guards, on synthetic bytes.
 *
 * These paths are unreachable with a real file — which is the point: an upload
 * has already passed the MIME allowlist and been written to the bucket by the
 * time the reader runs, so every case here has to fail closed rather than
 * produce a number that reserves the wrong box.
 */
const bytes = (...values: number[]) => new Uint8Array(values);

function pngHeader(width: number, height: number): Uint8Array {
  const out = new Uint8Array(24);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  new DataView(out.buffer).setUint32(8, 13, false);
  out.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(out.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return out;
}

function gifHeader(width: number, height: number): Uint8Array {
  const out = new Uint8Array(13);
  out.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0);
  const view = new DataView(out.buffer);
  view.setUint16(6, width, true);
  view.setUint16(8, height, true);
  return out;
}

/** A JPEG with a junk segment of `padding` bytes before the frame header. */
function jpegHeader(width: number, height: number, padding = 0): Uint8Array {
  const segments: number[] = [0xff, 0xd8];
  if (padding > 0) {
    segments.push(0xff, 0xe1, (padding + 2) >> 8, (padding + 2) & 0xff);
    for (let i = 0; i < padding; i += 1) segments.push(i & 0xff);
  }
  segments.push(
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff
  );
  return bytes(...segments);
}

describe('measureImageSize, guards', () => {
  it('refuses a PNG whose signature is wrong', () => {
    const notPng = pngHeader(10, 10);
    notPng[1] = 0x51;
    expect(measureImageSize(notPng, 'image/png')).toBeNull();
  });

  it('refuses a PNG whose IHDR tag is wrong', () => {
    const wrong = pngHeader(10, 10);
    wrong[12] = 0x4a;
    expect(measureImageSize(wrong, 'image/png')).toBeNull();
  });

  it('refuses a zero dimension rather than reporting one', () => {
    // `width="0"` renders nothing at all. Unknown is strictly safer than a value.
    expect(measureImageSize(pngHeader(0, 100), 'image/png')).toBeNull();
    expect(measureImageSize(gifHeader(0, 10), 'image/gif')).toBeNull();
  });

  it('refuses a header cut short', () => {
    expect(measureImageSize(pngHeader(100, 100).subarray(0, 20), 'image/png')).toBeNull();
    expect(measureImageSize(gifHeader(100, 100).subarray(0, 6), 'image/gif')).toBeNull();
  });

  it('accepts GIF87a as well as GIF89a', () => {
    const old = gifHeader(320, 240);
    old.set([0x47, 0x49, 0x46, 0x38, 0x37, 0x61], 0);
    expect(measureImageSize(old, 'image/gif')).toEqual({ width: 320, height: 240 });
  });

  it('skips past an EXIF segment rather than reading its bytes as the size', () => {
    // Not exotic: a camera JPEG routinely carries a thumbnail in APP1, so the
    // SOFn can sit tens of kilobytes in. A fixed offset yields a plausible wrong
    // number rather than an obvious failure.
    expect(measureImageSize(jpegHeader(4032, 3024, 24_000), 'image/jpeg')).toEqual({
      width: 4032,
      height: 3024,
    });
  });

  it('does not mistake DHT for a frame header', () => {
    // 0xC4 shares the SOFn marker range and is not one. Reading it as one
    // returns a Huffman table's bytes as a size.
    const withDht = [
      0xff,
      0xd8,
      0xff,
      0xc4,
      0x00,
      0x14,
      ...Array.from({ length: 18 }, () => 0x11),
      0xff,
      0xc0,
      0x00,
      0x11,
      0x08,
      0x01,
      0x2c,
      0x02,
      0x58,
    ];
    expect(measureImageSize(bytes(...withDht), 'image/jpeg')).toEqual({
      width: 600,
      height: 300,
    });
  });

  it('gives up at the start of scan rather than reading entropy data', () => {
    // Past SOS the bytes are Huffman-coded pixels, so any size read there is
    // noise. `null` is the honest answer.
    expect(
      measureImageSize(bytes(0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 1, 2, 3, 4), 'image/jpeg')
    ).toBe(null);
  });

  it('refuses something that is not an image at all', () => {
    expect(measureImageSize(bytes(0x89, 0x50, 0x4e, 0x47), 'image/jpeg')).toBeNull();
    expect(
      measureImageSize(bytes(0x52, 0x49, 0x46, 0x46, 0x57, 0x41, 0x56, 0x45), 'image/webp')
    ).toBeNull();
  });

  it('sniffs the format when the declared type is wrong', () => {
    // A mislabelled upload is common enough that losing its dimensions over it
    // would be its own bug. The declared type is a hint, not the authority.
    expect(measureImageSize(pngHeader(640, 480), 'image/jpeg')).toEqual({
      width: 640,
      height: 480,
    });
    expect(measureImageSize(jpegHeader(640, 480), 'image/png')).toEqual({
      width: 640,
      height: 480,
    });
  });

  it('tolerates a declared type carrying parameters', () => {
    expect(measureImageSize(pngHeader(10, 20), 'image/png; charset=binary')).toEqual({
      width: 10,
      height: 20,
    });
  });

  it('returns null for an unknown format rather than guessing', () => {
    expect(measureImageSize(bytes(1, 2, 3, 4, 5, 6, 7, 8), 'image/svg+xml')).toBeNull();
    expect(measureImageSize(bytes(1, 2, 3, 4), 'image/avif')).toBeNull();
  });

  it('returns null for no input at all', () => {
    expect(measureImageSize(new Uint8Array(0), 'image/png')).toBeNull();
    expect(measureImageSize(bytes(1, 2, 3, 4), '')).toBeNull();
    expect(measureImageSize(bytes(1, 2, 3, 4), null)).toBeNull();
  });

  it('survives a hostile header without throwing', () => {
    // A truncated or adversarial header must not fail an upload that has already
    // been validated and written.
    expect(() =>
      measureImageSize(bytes(0xff, 0xd8, 0xff, 0xc0, 0x00, 0x00), 'image/jpeg')
    ).not.toThrow();
  });

  it('gives up on a JPEG that carries no frame header', () => {
    // SOI then a quantisation table and nothing else. The marker walk runs off
    // the end without ever meeting an SOFn, so there is no size to report. The
    // tempting alternative is to treat the last segment length as the size,
    // which returns a confident number that is entirely invented.
    expect(
      measureImageSize(bytes(0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x00, 0x00), 'image/jpeg')
    ).toBeNull();
  });

  it('gives up on a WebP whose first chunk holds no dimensions', () => {
    // A valid RIFF/WEBP container carrying only auxiliary metadata: an ALPH
    // chunk is real, and reading a size out of it would be nonsense. `ANIM` and
    // `ICCP` behave the same way.
    const riff = [
      0x52, 0x49, 0x46, 0x46, 0x0c, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x41, 0x4c, 0x50,
      0x48, 0x00, 0x00, 0x00, 0x00,
    ];
    expect(measureImageSize(bytes(...riff), 'image/webp')).toBeNull();
  });

  it('returns null rather than throwing when handed something that is not a view', () => {
    // The `try` exists for exactly this: a future caller passes a plain array,
    // which has no `buffer`, and `new DataView(undefined)` throws. Dimension
    // detection is an optimisation on top of an upload that already succeeded,
    // so it must degrade to `null` and never take the upload down with it.
    //
    // The header is a *valid* PNG so the reader gets all the way to constructing
    // its `DataView` — a too-short array would be rejected by a length guard
    // first and would prove nothing about the `catch`.
    const notAView = [...pngHeader(640, 480)] as unknown as Uint8Array;
    (notAView as unknown as { buffer?: unknown }).buffer = undefined;
    expect(measureImageSize(notAView, 'image/png')).toBeNull();
  });

  it('refuses input that is absent rather than throwing on it', () => {
    // The parameter is typed, so this only happens from a JS caller — which is
    // exactly why the guard is there and why it needs a test.
    expect(measureImageSize(null as unknown as Uint8Array, 'image/png')).toBeNull();
    expect(measureImageSize(undefined as unknown as Uint8Array, 'image/png')).toBeNull();
  });

  it('refuses a header shorter than the format signature', () => {
    // Two bytes cannot be a JPEG, and the length check short-circuits before
    // the magic number is even read.
    expect(measureImageSize(bytes(0xff, 0xd8), 'image/jpeg')).toBeNull();
  });
});

/**
 * The JPEG marker walk.
 *
 * `jpegSize` is the only reader here with no fixed offset — it has to walk
 * segment headers to find a frame header — so it is also the only one with a
 * meaningful amount of control flow to get wrong. Each case below is a segment
 * the walk has to handle correctly, and each one previously had no coverage at
 * all, which is how a reader can pass every format test and still be wrong on a
 * real camera JPEG.
 */
function u16(value: number): [number, number] {
  return [(value >> 8) & 0xff, value & 0xff];
}

describe('measureImageSize, the JPEG marker walk', () => {
  /** SOI, then each supplied segment in order. */
  const jpeg = (...segments: number[][]): Uint8Array => bytes(0xff, 0xd8, ...segments.flat());

  /** An SOFn frame header carrying the given size. */
  const frame = (width: number, height: number): number[] => [
    0xff,
    0xc0,
    ...u16(17),
    0x08,
    ...u16(height),
    ...u16(width),
  ];

  it('skips a standalone marker, which carries no length field', () => {
    // 0x01 (TEM) and 0xd0-0xd9 (RSTn) are two bytes with no segment length
    // after them. Reading a length that is not there walks the walk off the
    // rails and returns nothing at all.
    expect(measureImageSize(jpeg([0xff, 0x01], frame(640, 360)), 'image/jpeg')).toEqual({
      width: 640,
      height: 360,
    });
  });

  it('skips a restart marker, which is also standalone', () => {
    expect(measureImageSize(jpeg([0xff, 0xd0], frame(320, 240)), 'image/jpeg')).toEqual({
      width: 320,
      height: 240,
    });
  });

  it('resynchronises past bytes that are not a marker', () => {
    // Some encoders emit padding between segments. Giving up here would lose the
    // size of a perfectly readable image, so the walk advances a byte and retries.
    const padded = jpeg([0x00, 0x00, 0x00], [...frame(800, 600), 0x00, 0x00]);
    expect(measureImageSize(padded, 'image/jpeg')).toEqual({ width: 800, height: 600 });
  });

  it('refuses a frame header cut short rather than reading past the end', () => {
    // The SOFn is present but its dimension fields are not. `pairAt` has to
    // bounds-check, because reading past the buffer yields a confident number
    // that was never in the file.
    const truncated = jpeg([0xff, 0xc0, ...u16(17), 0x08]);
    expect(measureImageSize(truncated, 'image/jpeg')).toBeNull();
  });

  it('refuses a frame header whose dimensions are zero', () => {
    // `width="0"` renders nothing at all, so unknown is strictly safer.
    expect(measureImageSize(jpeg(frame(0, 300)), 'image/jpeg')).toBeNull();
    expect(measureImageSize(jpeg(frame(300, 0)), 'image/jpeg')).toBeNull();
  });

  it('refuses a segment claiming an impossible length', () => {
    // A length below 2 would make the walk run backwards, so it is rejected
    // rather than trusted.
    expect(
      measureImageSize(jpeg([0xff, 0xc0, ...u16(1), 0x08, 0x00, 0x0a, 0x02, 0x58]), 'image/jpeg')
    ).toBeNull();
  });

  it('does not mistake DHT, JPG or DAC for a frame header', () => {
    // All three share the 0xC0-0xCF range and none of them carries a size. Only
    // the real SOFn markers do. 0xCF is *not* one of them to exclude — it is
    // SOF15, a differential arithmetic-coded frame header, and is covered below.
    for (const marker of [0xc4, 0xc8, 0xcc]) {
      const noise = [0xff, marker, ...u16(20), ...Array.from({ length: 18 }, () => 0x11)];
      expect(measureImageSize(jpeg(noise, frame(64, 48)), 'image/jpeg')).toEqual({
        width: 64,
        height: 48,
      });
    }
  });

  it('accepts every real frame header, not just SOF0', () => {
    // The set is 0xC0-0xC3, 0xC5-0xC7, 0xC9-0xCB and 0xCD-0xCF. Progressive,
    // arithmetic-coded and differential variants are what phones and editors
    // emit routinely, so gating on 0xC0 alone would return nothing for them.
    const sofMarkers = [
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ];
    expect(sofMarkers).toHaveLength(13);
    for (const marker of sofMarkers) {
      const sof = [0xff, marker, ...u16(17), 0x08, ...u16(200), ...u16(100)];
      expect(measureImageSize(jpeg(sof), 'image/jpeg')).toEqual({ width: 100, height: 200 });
    }
  });
});

/**
 * The WebP container.
 *
 * A WebP is a RIFF box whose *first chunk* determines where the size lives, so a
 * reader that guesses the variant reserves the wrong box for a file it can
 * otherwise open. These cover the rejection paths, which the real-encoding
 * fixtures above never reach — every fixture is a well-formed image.
 */
function riff(chunkId: string, payload: number[]): Uint8Array {
  const header = [
    ...[...'RIFF'].map((c) => c.charCodeAt(0)),
    0,
    0,
    0,
    0,
    ...[...'WEBP'].map((c) => c.charCodeAt(0)),
    ...[...chunkId].map((c) => c.charCodeAt(0)),
    0,
    0,
    0,
    0,
    ...payload,
  ];
  return bytes(...header);
}

describe('measureImageSize, the WebP container', () => {
  it('refuses a box too short to hold a canvas field', () => {
    // 16 bytes: the tags are all present and the chunk says VP8X, but the
    // 24-bit canvas fields at 24-29 are not. Reading them would be reading
    // whatever followed.
    expect(measureImageSize(riff('VP8X', []), 'image/webp')).toBeNull();
  });

  it('refuses a box that is not RIFF, or is RIFF but not WEBP', () => {
    const webp = [
      ...riff(
        'VP8X',
        Array.from({ length: 10 }, () => 0)
      ),
    ];
    expect(measureImageSize(bytes(...webp.map((b, i) => (i === 0 ? 0x58 : b))), 'image/webp')).toBe(
      null
    );
    const notWebp = [
      ...riff(
        'VP8X',
        Array.from({ length: 10 }, () => 0)
      ),
    ];
    notWebp[8] = 0x58;
    expect(measureImageSize(bytes(...notWebp), 'image/webp')).toBeNull();
  });

  it('refuses a first chunk that carries no dimensions', () => {
    // `ALPH`, `ICCP` and `ANIM` can all legitimately come first. The box is
    // valid and 30+ bytes long, so this is the case that distinguishes "the
    // chunk is unknown" from "the file is too short" — the earlier ALPH test
    // passed only because its box was 20 bytes.
    for (const chunkId of ['ALPH', 'ICCP', 'ANIM', 'JUNK']) {
      expect(
        measureImageSize(
          riff(
            chunkId,
            Array.from({ length: 14 }, () => 0)
          ),
          'image/webp'
        )
      ).toBeNull();
    }
  });

  it('refuses a lossy frame whose sync code is wrong', () => {
    // Offsets are absolute within the file: the RIFF/WEBP/chunk preamble is 20
    // bytes, so the frame tag is 20-22, the sync code 23-25 and the two
    // dimensions 26-29. The 14-bit fields are only meaningful after `9d 01 2a`.
    const frame = [0, 0, 0, 0x9d, 0x01, 0x2e, 0x40, 0x02, 0x00, 0x00];
    expect(measureImageSize(riff('VP8 ', frame), 'image/webp')).toBeNull();
  });

  it('refuses a lossy frame whose 14-bit dimensions are zero', () => {
    const frame = [0, 0, 0, 0x9d, 0x01, 0x2a, 0x00, 0x00, 0x00, 0x00];
    expect(measureImageSize(riff('VP8 ', frame), 'image/webp')).toBeNull();
  });

  it('reads a lossy frame, masking off the 14-bit fields', () => {
    // The top two bits of each uint16 are not part of the dimension. Both bytes
    // are 0xff here, so an unmasked read reports 65535x65535 — a size no encoder
    // can produce, and one that would reserve a box four times too large. The
    // mask is what turns it into the largest real dimension, 16383.
    const frame = [0, 0, 0, 0x9d, 0x01, 0x2a, 0xff, 0xff, 0x02, 0x00];
    expect(measureImageSize(riff('VP8 ', frame), 'image/webp')).toEqual({
      width: 0x3fff,
      height: 2,
    });
  });

  it('refuses a lossless frame whose signature byte is wrong', () => {
    // 0x2f is the VP8L signature at offset 20; the packed 32-bit word of
    // dimensions follows it. Reading without checking the signature would
    // interpret the frame tag as a size.
    expect(
      measureImageSize(riff('VP8L', [0x2e, 0x34, 0x12, 0xbc, 0x0a, 0]), 'image/webp')
    ).toBeNull();
  });

  it('reads a lossless frame, unpacking the two 14-bit fields across bytes', () => {
    /*
     * Hand-checkable on purpose. The 32-bit little-endian word at offset 21 is
     * 0x0ABC1234, so:
     *
     *   width-1  = word & 0x3fff            = 0x1234 = 4660
     *   height-1 = (word >>> 14) & 0x3fff   = 0x2AF0 = 10992
     *
     * 0x0ABC sits at bits 16-27, so shifting down 14 leaves it at bits 2-13
     * with the two bits below it coming from the top of 0x1234 — which are both
     * zero here. That is the whole reason this is read as one word: unpacked per
     * byte, `height`'s low bits share a byte with `width`'s high bits, and
     * getting that shift wrong yields a small plausible number rather than a
     * failure.
     *
     * The fixture is 30 bytes because the container guard rejects anything
     * shorter, and a shorter fixture would pass for the wrong reason.
     */
    const frame = [0x2f, 0x34, 0x12, 0xbc, 0x0a, 0, 0, 0, 0, 0];
    expect(measureImageSize(riff('VP8L', frame), 'image/webp')).toEqual({
      width: 0x1234 + 1,
      height: 0x2af0 + 1,
    });
  });
});
