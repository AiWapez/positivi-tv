import { useEffect } from “react”;
import {
MapContainer,
TileLayer,
useMap,
Marker,
Tooltip,
} from “react-leaflet”;
import L from “leaflet”;
import { CATEGORY_MAP } from “../data/categories”;
import type { Story } from “../types”;

// Creates a glowing circular marker icon for a given category color
function createMarkerIcon(color: string, isSelected: boolean): L.DivIcon {
const size = isSelected ? 16 : 12;
const glowSize = isSelected ? 24 : 16;

return L.divIcon({
className: “”,
iconSize: [size, size],
iconAnchor: [size / 2, size / 2],
html: `<div style="position:relative;width:${size}px;height:${size}px;"> <div class="marker-pulse" style=" position:absolute; top:${-(glowSize - size) / 2}px; left:${-(glowSize - size) / 2}px; width:${glowSize}px; height:${glowSize}px; border-radius:50%; background:${color}; opacity:0.3; "></div> <div class="marker-dot" style=" position:relative; width:${size}px; height:${size}px; background:${color}; border:${isSelected ? "2px solid #fff" :`1px solid ${color}`}; --marker-color:${color}; --marker-color-dim:${color}60; "></div> </div> `,
});
}

// Sub-component that handles flying to selected story
function FlyToSelected({ story }: { story: Story | null }) {
const map = useMap();

useEffect(() => {
if (story && story.lat !== 0 && story.lng !== 0) {
map.flyTo([story.lat, story.lng], Math.max(map.getZoom(), 4), {
duration: 0.8,
});
}
}, [story, map]);

return null;
}

interface MapViewProps {
stories: Story[];
selectedStory: Story | null;
onSelectStory: (story: Story) => void;
}

export default function MapView({
stories,
selectedStory,
onSelectStory,
}: MapViewProps) {
return (
<MapContainer
center={[25, 10]}
zoom={2}
minZoom={2}
maxZoom={10}
worldCopyJump={true}
zoomControl={true}
attributionControl={false}
className=“h-full w-full”
style={{ background: “#000000” }}
>
{/* Dark base map WITHOUT labels */}
<TileLayer
url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
subdomains="abcd"
/>
{/* English-only labels on top */}
<TileLayer
url="https://tiles.stadiamaps.com/tiles/stamen_toner_labels/{z}/{x}/{y}{r}.png"
subdomains=""
opacity={0.35}
/>

```
  <FlyToSelected story={selectedStory} />

  {stories.map((story) => {
    // Skip stories with no resolved coordinates
    if (story.lat === 0 && story.lng === 0) return null;

    const cat = CATEGORY_MAP[story.category];
    if (!cat) return null;

    const isSelected = selectedStory?.id === story.id;

    return (
      <Marker
        key={story.id}
        position={[story.lat, story.lng]}
        icon={createMarkerIcon(cat.color, isSelected)}
        eventHandlers={{
          click: () => onSelectStory(story),
        }}
      >
        <Tooltip
          direction="top"
          offset={[0, -10]}
          opacity={1}
          className="positivity-tooltip"
        >
          <div>
            <div
              className="font-bold text-[11px] leading-snug"
              style={{ color: cat.color }}
            >
              {story.title}
            </div>
            <div className="text-[9px] text-white/40 mt-0.5">
              {story.locationName}
            </div>
          </div>
        </Tooltip>
      </Marker>
    );
  })}
</MapContainer>
```

);
}