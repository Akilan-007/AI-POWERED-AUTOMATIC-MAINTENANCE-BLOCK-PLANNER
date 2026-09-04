import React, { useState, useEffect } from 'react';
import { Cpu, CheckCircle2, AlertTriangle, XCircle, Search, History, X } from 'lucide-react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { StatCard } from '../components/StatCard';
import { api } from '../services/api';
import { Asset, MaintenanceHistoryItem } from '../types';

export const AssetsPage: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [history, setHistory] = useState<MaintenanceHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const data = await api.getAssets();
      setAssets(data);
    } catch (err) {
      console.error('Failed to load assets', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInspectAsset = async (asset: Asset) => {
    setSelectedAsset(asset);
    setLoadingHistory(true);
    try {
      const hData = await api.getAssetHistory(asset.id);
      setHistory(hData);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredAssets = assets.filter((a) => {
    if (selectedDept !== 'ALL' && a.department_name && !a.department_name.toUpperCase().includes(selectedDept)) {
      return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (
        !a.asset_code.toLowerCase().includes(q) &&
        !a.name.toLowerCase().includes(q) &&
        !a.asset_type.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const avgCondition =
    assets.length > 0
      ? Math.round(assets.reduce((acc, a) => acc + a.condition_score, 0) / assets.length)
      : 0;

  const avgAvailability =
    assets.length > 0
      ? (assets.reduce((acc, a) => acc + a.availability, 0) / assets.length).toFixed(1)
      : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 tracking-tight">
          Railway Assets & Availability
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Corridor infrastructure assets: Tracks, Turnout Switches, OHE Catenary, Substations,
          Signaling relays, and Telecommunications.
        </p>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Monitored Assets"
          value={assets.length}
          unit="units"
          icon={<Cpu className="w-5 h-5" />}
          accentColor="blue"
          subtext="Tamil Nadu corridor"
        />
        <StatCard
          title="Average Asset Availability"
          value={avgAvailability}
          unit="%"
          change="+4.8% target"
          changeType="positive"
          icon={<CheckCircle2 className="w-5 h-5" />}
          accentColor="emerald"
          subtext="across all departments"
        />
        <StatCard
          title="Average Condition Score"
          value={`${avgCondition} / 100`}
          change="Fair/Good threshold"
          changeType="neutral"
          icon={<AlertTriangle className="w-5 h-5" />}
          accentColor="cyan"
          subtext="sensor-estimated health"
        />
        <StatCard
          title="Degraded / Failed Assets"
          value={assets.filter((a) => a.status === 'Degraded' || a.status === 'Failed').length}
          change="Requires priority window"
          changeType="negative"
          icon={<XCircle className="w-5 h-5" />}
          accentColor="rose"
          subtext="urgent maintenance needed"
        />
      </div>

      {/* Search & Filter */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search assets by code, name, or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Department:</span>
            {['ALL', 'ENGINEERING', 'TRACTION', 'SIGNAL'].map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDept(d)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedDept === d
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Assets Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Asset Code</th>
                <th className="py-3 px-4">Asset Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Section</th>
                <th className="py-3 px-4">Condition Score</th>
                <th className="py-3 px-4">Availability</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAssets.map((asset) => (
                <tr
                  key={asset.id}
                  onClick={() => handleInspectAsset(asset)}
                  className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4 font-mono font-bold text-slate-100">
                    {asset.asset_code}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-200">{asset.name}</td>
                  <td className="py-3 px-4 text-slate-300">{asset.asset_type}</td>
                  <td className="py-3 px-4 text-slate-400">{asset.department_name}</td>
                  <td className="py-3 px-4 font-mono text-slate-300">{asset.section_code}</td>
                  <td className="py-3 px-4">
                    <div className="w-32">
                      <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
                        <span
                          className={
                            asset.condition_score >= 75
                              ? 'text-emerald-400'
                              : asset.condition_score >= 50
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }
                        >
                          {asset.condition_score}
                        </span>
                        <span className="text-slate-400">/ 100</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            asset.condition_score >= 75
                              ? 'bg-emerald-500'
                              : asset.condition_score >= 50
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${asset.condition_score}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-200">
                    {asset.availability}%
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        asset.status === 'Operational'
                          ? 'success'
                          : asset.status === 'Degraded'
                          ? 'warning'
                          : asset.status === 'Failed'
                          ? 'critical'
                          : 'default'
                      }
                      size="sm"
                    >
                      {asset.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 justify-end">
                      <History className="w-3 h-3" />
                      <span>Log</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Asset History Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 relative">
            <button
              onClick={() => setSelectedAsset(null)}
              className="absolute right-4 top-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <span className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Cpu className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {selectedAsset.asset_code}: {selectedAsset.name}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedAsset.asset_type} &bull; {selectedAsset.department_name} &bull; Section{' '}
                  {selectedAsset.section_code}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Historical Maintenance & Interventions ({history.length})
              </h4>
              {loadingHistory ? (
                <div className="p-6 text-center text-xs text-slate-400">Loading history logs...</div>
              ) : history.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-900 rounded-lg">
                  No previous maintenance logs recorded.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">{h.completed_date}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Downtime: {h.downtime_minutes} minutes
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-mono">
                          Condition: <span className="text-amber-400">{h.condition_before}</span> &rarr;{' '}
                          <span className="text-emerald-400 font-bold">{h.condition_after}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedAsset(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
