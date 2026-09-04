import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { NetworkData, StationNode, SectionEdge, Asset } from '../types';
import { useDisruption } from './DisruptionController';

interface CorridorMapProps {
  network: NetworkData | null;
  selectedSection?: SectionEdge | null;
  highlightedSectionCode?: string | null;
  onSelectAsset?: (asset: Asset) => void;
  onSelectStation?: (station: StationNode) => void;
  onSelectSection?: (section: SectionEdge) => void;
  height?: string;
}

export const CorridorMap: React.FC<CorridorMapProps> = ({
  network,
  selectedSection,
  highlightedSectionCode,
  onSelectAsset,
  onSelectStation,
  onSelectSection,
  height = '620px',
}) => {
  const { activeDisruption } = useDisruption();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || !network) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [12.0, 79.0],
      zoom: 7,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    ).addTo(map);

    network.sections.forEach((sec) => {
      const latlngs: [number, number][] = [
        [sec.from_lat, sec.from_lng],
        [sec.to_lat, sec.to_lng],
      ];

      // Highlight logic
      const isHighlighted = highlightedSectionCode === sec.section_code || selectedSection?.id === sec.id;
      
      // Track background line
      L.polyline(latlngs, {
        color: isHighlighted ? '#a855f7' : '#1e293b', // Purple for highlighted
        weight: isHighlighted ? 8 : 6,
        opacity: isHighlighted ? 1 : 0.9,
      }).addTo(map);

      // Track active line
      const trackLine = L.polyline(latlngs, {
        color: sec.active_blocks > 0 ? '#0ea5e9' : '#3b82f6',
        weight: isHighlighted ? 5 : 4,
        dashArray: sec.active_blocks > 0 ? '10, 15' : undefined,
        className: sec.active_blocks > 0 ? 'animate-track-flow' : '',
        opacity: 0.9,
      }).addTo(map);

      trackLine.on('click', () => {
        if (onSelectSection) onSelectSection(sec);
      });

      // Assets on this section
      sec.assets.forEach((asset) => {
        const pos = asset.position_on_section ?? 0.5;
        const assetLat = sec.from_lat + (sec.to_lat - sec.from_lat) * pos;
        const assetLng = sec.from_lng + (sec.to_lng - sec.from_lng) * pos;

        const markerColor =
          asset.status === 'Operational'
            ? '#10b981'
            : asset.status === 'Degraded'
              ? '#f59e0b'
              : '#ef4444';

        const assetIcon = L.divIcon({
          className: 'custom-asset-marker',
          html: `<div style="background-color: ${markerColor}; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #0f172a; box-shadow: 0 0 6px ${markerColor};"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });

        const marker = L.marker([assetLat, assetLng], { icon: assetIcon }).addTo(map);
        marker.on('click', () => {
          if (onSelectAsset) onSelectAsset(asset);
          if (onSelectSection) onSelectSection(sec);
        });
      });
    });

    network.stations.forEach((stn) => {
      const isDisrupted = activeDisruption && stn.code === activeDisruption.assetId;
      const ringColor = isDisrupted ? 'bg-red-500' : 'bg-blue-500';
      const coreColor = isDisrupted ? 'bg-red-400' : 'bg-blue-400';
      const borderColor = isDisrupted ? '#ef4444' : '#3b82f6';
      const glowColor = isDisrupted ? 'rgba(239,68,68,0.7)' : 'rgba(59,130,246,0.5)';
      const textColor = isDisrupted ? '#fca5a5' : '#f8fafc';

      const stationIcon = L.divIcon({
        className: 'custom-station-marker',
        html: `<div class="relative flex items-center justify-center">
                 <div class="absolute w-4 h-4 ${ringColor} rounded-full animate-ping opacity-75"></div>
                 <div class="absolute w-2 h-2 ${coreColor} rounded-full"></div>
                 <div style="background: #0f172a; color: ${textColor}; border: 1px solid ${borderColor}; border-radius: 4px; padding: 2px 4px; font-size: 9px; font-weight: bold; white-space: nowrap; box-shadow: 0 0 10px ${glowColor}; margin-top: 24px;" class="relative z-10">
                  ${stn.code}
                 </div>
               </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([stn.lat, stn.lng], { icon: stationIcon }).addTo(map);
      marker.on('click', () => {
        if (onSelectStation) onSelectStation(stn);
      });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [network, selectedSection, highlightedSectionCode, onSelectAsset, onSelectStation, onSelectSection]);

  return (
    <div className="relative w-full rounded-lg overflow-hidden bg-slate-950">
      <style>
        {`
          .leaflet-tile-pane { 
            filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); 
          }
          @keyframes trackFlow {
            to { stroke-dashoffset: -30; }
          }
          .animate-track-flow {
            animation: trackFlow 1.5s linear infinite;
          }
        `}
      </style>
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ height }}
      />
    </div>
  );
};
