import type { FeatureKey } from './contracts';

/** Decorative drawings for the campus place headers and album empty state. */
export default function PlaceArtwork({ kind }: { kind: FeatureKey | 'album' }) {
  return <svg className={kind === 'album' ? 'gallery-art' : 'place-header-art'} viewBox="0 0 260 120" fill="none" stroke="#49654a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'library' && <>
      <path d="M23 92h109v16H23z" fill="#db9269" /><path d="M30 98h93m-93 5h93" stroke="#fff3cf" />
      <path d="M31 71h95v19H31z" fill="#92b59a" /><path d="M40 79h78" stroke="#fff8df" />
      <path d="M46 45q27-12 54 3 29-14 55-2l-8 43q-23-10-47 0-23-11-46-3z" fill="#fff6cf" />
      <path d="M100 48v41M57 54q18-5 31 3m-29 6q18-4 29 3m25-10q17-6 28-1m-29 10q17-6 27-1" strokeWidth="1.5" />
      <path d="M135 50v27l6-5 5 5V50" fill="#d8835a" stroke="none" />
      <path d="M169 71h34v24q0 15-17 15t-17-15z" fill="#f3cf6e" /><path d="M203 76h6q14 9 0 18h-6m-23-36q-7-5 0-11m11 11q-7-5 0-11" />
      <path d="m230 84-4 25h26l-5-25z" fill="#cf906a" /><path d="M239 84V59q-23 0-20-18 23-1 20 23 0-26 19-25 5 19-19 25" fill="#a6c481" />
    </>}
    {kind === 'teaching' && <>
      <path d="M42 25h143v67H42z" fill="#5f8161" /><path d="M49 32h129v53H49z" stroke="#cee1b8" />
      <path d="M65 48h55m-55 13h83m-83 13h40" stroke="#fff6dc" /><path d="m61 93-8 16m113-16 8 16" />
      <path d="M157 83h69v12h-69zm-8 13h80v12h-80z" fill="#e6b779" /><path d="m204 44 9-3 18 38-10 6z" fill="#f3ce6c" />
    </>}
    {kind === 'stadium' && <>
      <path d="M100 27h60v34q0 27-30 28-30-1-30-28z" fill="#f1ce70" /><path d="M100 35H84v14q0 22 22 22m54-36h16v14q0 22-22 22M130 89v15m-19 5h38" />
      <path d="m130 41 5 10 11 2-8 8 1 11-9-5-10 5 2-11-8-8 11-2z" fill="#fff4d0" />
      <circle cx="202" cy="91" r="18" fill="#fff4d0" /><path d="m202 78 8 8-3 11h-10l-5-11zm-10 8-7-2m12 13-4 9m14-9 6 8m-3-19 8-3" />
      <path d="M49 61v48m0-47 29 7-29 10" fill="#d78d69" />
    </>}
    {kind === 'canteen' && <>
      <path d="M65 69h116q-6 37-58 37T65 69z" fill="#edba73" /><path d="M78 79h91m-60-32q-13-11 0-23m25 27q-13-11 0-23m24 21q-13-11 0-23" />
      <path d="m172 57 44-30m-38 40 44-30" strokeWidth="5" /><path d="M43 53v54m-9-75v16q9 16 18 0V32m-9 0v21" />
    </>}
    {kind === 'dormitory' && <>
      <path d="M72 40h78v67H72z" fill="#f2d78f" /><path d="m61 40 50-25 50 25z" fill="#cd8f6d" />
      <path d="M85 51h14v14H85zm38 0h14v14h-14zM85 77h14v14H85zm30 5h21v25h-21z" fill="#c5d8ae" />
      <path d="M174 53h41v54h-41zm-7 0 27-22 28 22z" fill="#a6c38b" /><path d="M187 65h15v15h-15zm0 27h15v15h-15z" fill="#fff4cf" />
    </>}
    {kind === 'album' && <>
      <path d="m91 21 83-5 6 68-83 6z" fill="#b8cba5" /><path d="M101 33h82v68h-82z" fill="#fff9e8" />
      <path d="M109 40h66v44h-66z" fill="#c7ded2" /><circle cx="123" cy="51" r="5" fill="#f3cf6e" />
      <path d="m110 82 18-17 15 12 14-24 18 29z" fill="#98b779" /><path d="M116 93h32" stroke="#b7a873" />
    </>}
    <path d={kind === 'album' ? 'M187 37h14m-7-7v14M80 78l-5 4m124 13 5 3' : 'M14 61h8m-4-4v8M221 16h10m-5-5v10'} stroke="#c38c49" />
    {kind !== 'album' && <path d="M17 110h204" />}
  </svg>;
}
