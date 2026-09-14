// What separates one J from another — step L.1, round five.
//
// The owner chose the arrangement, so the arrangement stops moving: one grid,
// written once, and three sets of surface decisions on top of it. Copying the
// layout into three files would let them drift, and a comparison between three
// grids that are not the same grid answers nothing.
//
// Everything here is a *surface* decision. Nothing changes where a tile is or
// how large it is — that is the part already chosen.

export interface Skin {
  /** Tailwind radius class for a tile. */
  readonly radius: string;
  /** Gap between tiles. */
  readonly gap: string;
  /** Padding inside one. */
  readonly pad: string;
  /** Whether a tile draws a hairline. Off means the fill does the separating. */
  readonly bordered: boolean;
  /**
   * How a secondary tile is filled: the raised surface, or the page itself.
   *
   * `page` gives a flatter screen where only Play is an object; `surface` gives
   * the card look, where every tile is one.
   */
  readonly fill: 'surface' | 'page';
  /** Scale for the headline figures — density is most of the difference. */
  readonly figure: string;
  readonly label: string;
  readonly body: string;
}
