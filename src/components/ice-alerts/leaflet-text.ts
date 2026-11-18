/**
 * Leaflet treats string tooltip content as HTML. Pass a text node instead so
 * city names, source labels, and user-location labels are never interpreted as
 * markup.
 */
export function leafletText(text: string): HTMLSpanElement {
  const element = document.createElement('span');
  element.textContent = text;
  return element;
}
