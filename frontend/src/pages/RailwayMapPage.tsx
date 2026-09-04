import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Network, Cpu, Info, ShieldCheck, Wrench, Layers } from 'lucide-react';
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { CorridorMap } from '../components/CorridorMap';
import { api } from '../services/api';
import { NetworkData, StationNode, SectionEdge, Asset } from '../types';
import { useDisruption } from '../components/DisruptionController';

export const RailwayMapPage: React.FC = () => {
  const { activeDisruption } = useDisruption();
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
            <CorridorMap
              network={network}
              selectedSection={selectedSection}
              onSelectAsset={setSelectedAsset}
              onSelectSection={setSelectedSection}
              onSelectStation={setSelectedStation}
              height="620px"
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
              {network?.stations.map((stn: any, idx: number) => {
                const isDisrupted = activeDisruption && stn.code === activeDisruption.assetId;
                return (
                  <div
                    key={stn.code}
                    className={`flex items-center justify-between p-2 rounded border font-mono text-[11px] transition-colors ${
                      isDisrupted 
                        ? 'bg-red-950/40 border-red-500/50 text-red-200' 
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] ${
                        isDisrupted ? 'bg-red-900/50 text-red-400' : 'bg-blue-900/50 text-blue-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-bold">{stn.code}</span>
                      <span className={`font-sans text-xs ${isDisrupted ? 'text-red-300' : 'text-slate-400'}`}>
                        {stn.name}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] ${isDisrupted ? 'text-red-400' : 'text-slate-400'}`}>
                        {stn.lat.toFixed(2)}, {stn.lng.toFixed(2)}
                      </span>
                      {isDisrupted && (
                        <span className="animate-pulse text-[9px] font-bold text-red-500 uppercase tracking-widest">
                          {activeDisruption.severity}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
