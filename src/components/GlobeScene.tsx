import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { Story } from '../types';
export interface GlobeControls { zoom: (factor: number) => void; reset: () => void; flyTo: (lat: number, lng: number, distance?: number) => void; redraw: () => void }
interface Props { stories: Story[]; read: Record<string, string>; selected: string | null; mode: 'globe' | 'list'; onSelect: (id: string) => void; onReady: (ready: boolean) => void; onError: () => void }
const GlobeScene = forwardRef<GlobeControls, Props>(function GlobeScene(props, ref) {
  const stage = useRef<HTMLDivElement>(null), host = useRef<HTMLDivElement>(null), markers = useRef<HTMLDivElement>(null), touch = useRef<HTMLDivElement>(null);
  const controller = useRef<(GlobeControls & { update: (items: Story[], selected: string | null, read: Record<string, string>) => void; dispose: () => void }) | null>(null);
  const latest = useRef(props); latest.current = props;
  const [ready, setReady] = useState(false);
  useImperativeHandle(ref, () => ({ zoom: factor => controller.current?.zoom(factor), reset: () => controller.current?.reset(), flyTo: (lat, lng, distance) => controller.current?.flyTo(lat, lng, distance), redraw: () => controller.current?.redraw() }), []);
  useEffect(() => {
    let cancelled = false;
    import('../lib/globe.js').then(({ createGlobe }) => createGlobe({ host: host.current!, stage: stage.current!, markerHost: markers.current!, touchHost: touch.current!, getMode: () => latest.current.mode,
      onSelect: (id: string) => latest.current.onSelect(id), onError: () => { if (!cancelled) { controller.current?.dispose(); controller.current = null; setReady(false); latest.current.onReady(false); latest.current.onError(); } },
    })).then(value => { if (cancelled) value.dispose(); else { controller.current = value; value.update(latest.current.stories, latest.current.selected, latest.current.read); setReady(true); latest.current.onReady(true); } })
      .catch(() => { if (!cancelled) { latest.current.onError(); latest.current.onReady(false); } });
    return () => { cancelled = true; controller.current?.dispose(); controller.current = null; };
  }, []);
  useEffect(() => { controller.current?.update(props.stories, props.selected, props.read); controller.current?.redraw(); }, [props.stories, props.selected, props.read, props.mode, ready]);
  return <div className="globe-stage" ref={stage} hidden={props.mode === 'list'}><div id="globe" ref={host} role="region" aria-label="Earth globe. Drag to rotate; pinch or scroll to zoom. Every story is also accessible in the list." /><div className="globe-touch-clip" aria-hidden="true"><div className="globe-touch" ref={touch} /></div><div id="markers" ref={markers} /></div>;
});
export default GlobeScene;
