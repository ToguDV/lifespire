import { DECOR, DECOR_ASPECT, MIST, RIDGE, type DecorItem, type DecorKind } from '../lib/mapDecor'

/** Each artwork keeps its own drawing box; the baseline is the bottom edge. */
const VIEWBOX: Record<DecorKind, string> = {
  pine: '0 0 24 24',
  birch: '0 0 24 24',
  fern: '0 0 24 24',
  rock: '0 0 24 24',
  mushroom: '0 0 24 24',
  tuft: '0 0 24 24',
  fox: '0 0 32 24',
  bear: '0 0 36 24',
}

/**
 * Stroke-only plates for the flora. The stroke width comes from the plane
 * that uses them.
 */
const ARTWORK: Record<DecorKind, string[]> = {
  pine: ['M12 2.5 8.2 8.8h2.2l-4.2 6.6h4.6V21h2.4v-5.6h4.6l-4.2-6.6h2.2z'],
  birch: [
    'M10.5 21c-.3-6 .3-11.5 2.2-18',
    'M11.6 7 8 4.6',
    'M12.6 10.4 16.6 7.6',
    'M11 15 7.6 12.6',
  ],
  fern: [
    'M10 21c-.6-6 1.6-11.6 6.6-16.6',
    'M11.4 17.8 8.2 18.4M12.2 15 9 15.2M13.2 12.2 10.2 12M14.4 9.4 11.8 8.8',
    'M11.4 17.8l3.6-1.2M12.2 15l3.4-1.2M13.2 12.2l3.2-1.4M14.4 9.4l2.8-1.6',
  ],
  rock: ['M3 19l3-6 4-3 5 1.5 3.5 4.5L20 19z', 'M10 10l2 5 4 2'],
  mushroom: [
    'M4.6 11.4c0-3.4 3.3-6.2 7.4-6.2s7.4 2.8 7.4 6.2z',
    'M10 11.4v6.4c0 1.5 1 2.6 2 2.6s2-1.1 2-2.6v-6.4',
  ],
  tuft: [
    'M12 21c-1.4-4-3.2-7-6-9.4',
    'M12 21c-.2-5 .8-8.6 3-11.6',
    'M12 21c1.4-4 3.4-6.6 6-8.4',
  ],
  // The animals are solid plates: at map scale a silhouette reads where a
  // contour would blur into the undergrowth.
  fox: [
    'M27.8 11.6 25 9 24.2 5.8 22.6 8.8 21.4 5.4 19.8 9 20.3 12.4 24.8 13.4Z',
    'M18.8 10.8 21.4 13.6 21 15.8 21.6 20.8 12.8 20.8 11.6 17.4 13.8 13.4Z',
    'M14 20.6C7.6 21.4 3 18 3.4 13.2 3.8 9 7.8 7.4 10.6 9.6 7 10.6 6.4 13.8 8 16.2 9.4 18.4 11.4 19.8 14 20.6Z',
  ],
  bear: [
    'M4.8 14C4.6 10.6 7.4 8.4 11 7.8 14.6 7.2 18.6 7.8 21.6 8.8 23.8 9.5 25 11 25.6 13L26.4 16C26.6 17.4 25.6 18.4 24.2 18.4L9 18.4C6.4 18.4 4.9 16.4 4.8 14Z',
    'M23.8 10.6C24.6 8 27.2 6.8 29.8 7.6 31.8 8.4 32.8 10 33 11.8L34.8 12.4C35.6 12.8 35.6 14 34.6 14.6 32.6 15.6 29.8 15.4 27.6 14.2 25.6 13.2 24.2 12.4 23.8 10.6Z',
    'M27 7C28.6 6.4 30 7.4 30 8.8 30 10.2 28.8 11 27.4 10.8 26.2 10.6 26 8.2 27 7Z',
    'M7.6 17 11 17 10.6 21.6 7 21.6Z',
    'M13.2 17.6 16.4 17.6 16.2 21.6 12.8 21.6Z',
    'M21.6 17 24.8 17 24.8 21.6 21.4 21.6Z',
    'M26.2 16.4 29.2 16.4 29.4 21.6 26 21.6Z',
  ],
}

function itemsOf(plane: DecorItem['plane']): DecorItem[] {
  return DECOR.filter((item) => item.plane === plane)
}

function Artwork({ item }: { item: DecorItem }) {
  const width = item.size * DECOR_ASPECT[item.kind]
  const mirror = item.flip ? 2 * item.x + width : null
  return (
    <use
      href={`#map-${item.kind}`}
      x={item.x - width / 2}
      y={item.y - item.size}
      width={width}
      height={item.size}
      transform={mirror ? `translate(${mirror} 0) scale(-1 1)` : undefined}
    />
  )
}

/**
 * The forest that backs the day map: a distant treeline, a middle plane of
 * trees along the margins and a near plane of undergrowth with two animals.
 *
 * It is drawn inside the map SVG, behind the contours and the paths, and it
 * never carries information: the whole SVG is hidden from assistive tech.
 */
export function MapBackdrop() {
  const near = itemsOf('near')
  const fauna = near.filter((item) => item.kind === 'fox' || item.kind === 'bear')
  const flora = near.filter((item) => item.kind !== 'fox' && item.kind !== 'bear')

  return (
    <g className="map-backdrop">
      <defs>
        {(Object.keys(ARTWORK) as DecorKind[]).map((kind) => (
          <symbol key={kind} id={`map-${kind}`} viewBox={VIEWBOX[kind]}>
            {ARTWORK[kind].map((d) => (
              <path key={d} d={d} vectorEffect="non-scaling-stroke" />
            ))}
          </symbol>
        ))}
        <radialGradient id="map-haze">
          <stop offset="0" stopColor="var(--ink-soft)" stopOpacity="0.12" />
          <stop offset="0.55" stopColor="var(--ink-soft)" stopOpacity="0.05" />
          <stop offset="1" stopColor="var(--ink-soft)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className="map-backdrop__mist">
        {MIST.map((patch) => (
          <ellipse
            key={`${patch.x}-${patch.y}`}
            cx={patch.x}
            cy={patch.y}
            rx={patch.rx}
            ry={patch.ry}
          />
        ))}
      </g>

      <g className="map-backdrop__far">
        <path className="map-backdrop__ridge" d={RIDGE} vectorEffect="non-scaling-stroke" />
        {itemsOf('far').map((item) => (
          <Artwork key={`${item.kind}-${item.x}`} item={item} />
        ))}
      </g>

      <g className="map-backdrop__mid">
        {itemsOf('mid').map((item) => (
          <Artwork key={`${item.kind}-${item.x}`} item={item} />
        ))}
      </g>

      <g className="map-backdrop__near">
        {flora.map((item) => (
          <Artwork key={`${item.kind}-${item.x}`} item={item} />
        ))}
      </g>

      <g className="map-backdrop__fauna">
        {fauna.map((item) => (
          <Artwork key={`${item.kind}-${item.x}`} item={item} />
        ))}
      </g>
    </g>
  )
}
