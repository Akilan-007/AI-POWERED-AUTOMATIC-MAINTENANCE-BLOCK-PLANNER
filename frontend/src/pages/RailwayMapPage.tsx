import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Network, Cpu, Info, ShieldCheck, Wrench, Layers } from 'lucide-react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { api } from '../services/api';
import { NetworkData, StationNode, SectionEdge, Asset } from '../types';

export const RailwayMapPage: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [network, setNetwork] = useState<NetworkData | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedStation, setSelectedStation] = useState<StationNode | null>(null);
  const [selectedSection, setSelectedSection] = useState<SectionEdge | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadNetwork();
  }, []);

  const loadNetwork = async () => {
    setLoading(true);
    try {
      const data = await api.getNetwork();
      setNetwork(data);
    } catch (err) {
      console.error('Failed to load network topology', err);
    } finally {
      setLoading(false);
    }
  };

  // Initialize and render Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || !network) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Center map around Tamil Nadu Chennai-Salem corridor mid-point
    const map = L.map(mapContainerRef.current, {
      center: [12.45, 79.20],
      zoom: 8,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    // Dark sleek tile layer (CartoDB Dark Matter)
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    ).addTo(map);

    // Render Track Sections as Polyline tracks
    network.sections.forEach((sec) => {
      const latlngs: [number, number][] = [
        [sec.from_lat, sec.from_lng],
        [sec.to_lat, sec.to_lng],
      ];

      // Track background line
      L.polyline(latlngs, {
        color: '#1e293b',
        weight: 6,
        opacity: 0.9,
      }).addTo(map);

      // Track active line
      const trackLine = L.polyline(latlngs, {
        color: sec.active_blocks > 0 ? '#06b6d4' : '#3b82f6',
        weight: 3,
        dashArray: sec.active_blocks > 0 ? '6, 6' : undefined,
        opacity: 0.9,
      }).addTo(map);

      trackLine.on('click', () => {
        setSelectedSection(sec);
      });

      // Assets on this section
      sec.assets.forEach((asset) => {
        const pos = asset.position_on_section ?? 0.5;
        const assetLat = sec.from_lat + (sec.to_lat - sec.from_lat) * pos;
        const assetLng = sec.from_lng + (sec.to_lng - sec.from_lng) * pos;

        // Custom circular marker
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
          setSelectedAsset(asset);
          setSelectedSection(sec);
        });
      });
    });

    // Render Station Nodes
    network.stations.forEach((stn) => {
      const stationIcon = L.divIcon({
        className: 'custom-station-marker',
        html: `<div style="background: #0f172a; color: #f8fafc; border: 2px solid #3b82f6; border-radius: 6px; padding: 2px 6px; font-size: 10px; font-weight: bold; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                ${stn.code}
               </div>`,
        iconSize: [40, 20],
        iconAnchor: [20, 10],
      });

      const marker = L.marker([stn.lat, stn.lng], { icon: stationIcon }).addTo(map);
      marker.on('click', () => {
        setSelectedStation(stn);
      });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [network]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Network className="w-4 h-4" />
            </span>
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">
              Corridor Network Map & Geospatial Assets
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Geographical corridor representation: Chennai Central (MAS) to Salem Jn (SA) via Katpadi (KPD) with real Tamil Nadu coordinates and positioned rail assets.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-slate-300">Operational Asset</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span className="text-slate-300">Degraded</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="text-slate-300">Failed / Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-cyan-400 border-b border-dashed border-cyan-400"></span>
            <span className="text-slate-300">Active Block</span>
          </div>
        </div>
      </div>

      {/* Map + Detail Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Map Container (8 cols) */}
        <div className="lg:col-span-8">
          <Card className="p-2 overflow-hidden">
            <div
              ref={mapContainerRef}
              className="w-full h-[620px] rounded-lg overflow-hidden bg-slate-950"
            />
          </Card>
        </div>

        {/* Side Inspector (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {selectedAsset ? (
            <Card title="Asset Details" subtitle="Geospatial inventory item">
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-mono font-bold text-sm text-slate-100">
                    {selectedAsset.asset_code}
                  </span>
                  <Badge
                    variant={
                      selectedAsset.status === 'Operational'
                        ? 'success'
                        : selectedAsset.status === 'Degraded'
                        ? 'warning'
                        : 'critical'
                    }
                    size="sm"
                  >
                    {selectedAsset.status}
                  </Badge>
                </div>

                <div>
                  <span className="text-slate-400 text-[11px]">Asset Name</span>
                  <div className="font-semibold text-slate-200 mt-0.5">{selectedAsset.name}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-slate-400">Type</span>
                    <div className="font-semibold text-slate-200 mt-0.5">
                      {selectedAsset.asset_type}
                    </div>
                  </div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-slate-400">Department</span>
                    <div className="font-semibold text-slate-200 mt-0.5">
                      {selectedAsset.department_name}
                    </div>
                  </div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-slate-400">Condition</span>
                    <div className="font-semibold font-mono text-cyan-400 mt-0.5">
                      {selectedAsset.condition_score}/100
                    </div>
                  </div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-slate-400">Availability</span>
                    <div className="font-semibold font-mono text-emerald-400 mt-0.5">
                      {selectedAsset.availability}%
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-slate-400 text-[11px]">Section Location</span>
                  <div className="font-mono text-slate-200 font-semibold mt-0.5">
                    {selectedAsset.section_code}
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card title="Inspector Panel" subtitle="Click any asset dot or station on the map">
              <div className="p-8 text-center text-slate-400 text-xs">
                <Info className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                Select any rail asset, station, or track section along the corridor to inspect condition and maintenance windows.
              </div>
            </Card>
          )}

          {/* Corridor Topology Summary */}
          <Card title="Corridor Topology" subtitle="Chennai - Salem Mainline (Southern Railway, Tamil Nadu)">
            <div className="space-y-2 text-xs">
              {network?.stations.map((stn, idx) => (
                <div
                  key={stn.code}
                  className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800/80 font-mono text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-blue-900/50 text-blue-400 flex items-center justify-center font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-200">{stn.code}</span>
                    <span className="text-slate-400 font-sans text-xs">{stn.name}</span>
                  </div>
                  <span className="text-slate-400 text-[10px]">
                    {stn.lat.toFixed(2)}, {stn.lng.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
