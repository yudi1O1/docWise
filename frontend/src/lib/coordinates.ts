export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  width: number;
  height: number;
}

export function pageToCssRect(rect: Rect, zoom: number): Rect {
  return {
    x: rect.x * zoom,
    y: rect.y * zoom,
    width: rect.width * zoom,
    height: rect.height * zoom,
  };
}

export function cssToPagePoint(point: Point, zoom: number): Point {
  return {
    x: point.x / zoom,
    y: point.y / zoom,
  };
}

export function pageToCssLength(value: number, zoom: number): number {
  return value * zoom;
}
