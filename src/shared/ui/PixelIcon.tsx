import type { SVGProps } from 'react';

/** 12×12 像素风图标，只用矩形拼接，保持与像素字体一致的颗粒感。 */
type IconName = 'volume' | 'volume-mute' | 'settings' | 'palette' | 'close' | 'check' | 'lock' | 'arrow-left' | 'arrow-right' | 'reset';

const PATHS: Record<IconName, string> = {
  volume: 'M1 4h2v4H1zM3 3h2v6H3zM5 1h2v10H5zM8 4h1v4H8zM10 2h1v8h-1z',
  'volume-mute': 'M1 4h2v4H1zM3 3h2v6H3zM5 1h2v10H5zM8 3h1v1H8zM9 4h1v1H9zM10 5h1v2h-1zM9 7h1v1H9zM8 8h1v1H8zM10 3h1v1h-1zM8 7h1v1H8zM9 6h1v1H9zM8 5h1v1H8zM10 8h1v1h-1z',
  settings: 'M5 0h2v2H5zM5 10h2v2H5zM0 5h2v2H0zM10 5h2v2h-2zM1 1h2v2H1zM9 1h2v2H9zM1 9h2v2H1zM9 9h2v2H9zM3 3h6v6H3zM5 5h2v2H5z',
  palette: 'M2 1h8v1H2zM1 2h1v8H1zM10 2h1v5h-1zM2 10h4v1H2zM3 3h2v2H3zM7 3h2v2H7zM3 6h2v2H3zM7 7h4v4H7z',
  close: 'M1 1h2v2H1zM3 3h2v2H3zM5 5h2v2H5zM7 7h2v2H7zM9 9h2v2H9zM9 1h2v2H9zM7 3h2v2H7zM3 7h2v2H3zM1 9h2v2H1z',
  check: 'M1 6h2v2H1zM3 8h2v2H3zM5 6h2v2H5zM7 4h2v2H7zM9 2h2v2H9z',
  lock: 'M3 1h6v1H3zM2 2h2v3H2zM8 2h2v3H8zM1 5h10v6H1zM5 7h2v2H5z',
  'arrow-left': 'M8 1H6v2h2zM6 3H4v2h2zM4 5H2v2h2zM6 7H4v2h2zM8 9H6v2h2z',
  'arrow-right': 'M4 1h2v2H4zM6 3h2v2H6zM8 5h2v2H8zM6 7h2v2H6zM4 9h2v2H4z',
  reset: 'M3 2h6v1H3zM2 3h1v2H2zM9 3h1v5H9zM2 8h1v1H2zM3 9h6v1H3zM1 5h3v1H1zM2 6h1v1H2zM7 1h2v1H7z',
};

interface PixelIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export default function PixelIcon({ name, size = 14, ...rest }: PixelIconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" width={size} height={size} shapeRendering="crispEdges" {...rest}>
      <path d={PATHS[name]} fill="currentColor" />
    </svg>
  );
}
