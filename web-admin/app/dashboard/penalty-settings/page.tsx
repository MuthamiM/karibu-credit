'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '../../../lib/api';

type PenaltyConfig = {
  gracePeriod: number;
  penaltyPercentage: number;
  frequency: string;
};

export default function PenaltySettingsPage() {
  const [penaltyConfig, setPenaltyConfig] = useState<PenaltyConfig>({
    gracePeriod: 3,
    penaltyPercentage: 10,
    frequency: 'ONCE',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await fetchApi('/penalty-settings/');
        setPenaltyConfig({
          gracePeriod: data.grace_period,
          penaltyPercentage: data.penalty_percentage,
          frequency: data.frequency,
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load penalty settings');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await fetchApi('/penalty-settings/', {
        method: 'PUT',
        body: JSON.stringify({
          grace_period: penaltyConfig.gracePeriod,
          penalty_percentage: penaltyConfig.penaltyPercentage,
          frequency: penaltyConfig.frequency,
        }),
      });
      setPenaltyConfig({
        gracePeriod: updated.grace_period,
        penaltyPercentage: updated.penalty_percentage,
        frequency: updated.frequency,
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (err: unknown) {
      alert(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card rounded-3xl p-8 text-slate-500 flex items-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent"></span>
        Loading global credit policy...
      </div>
    );
  }

  if (error) {
    return (
      <div className="card rounded-3xl p-8 text-red-600">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="card rounded-[28px] p-6 space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">Global Credit Policy</p>
        <h2 className="text-xl font-bold tracking-tight text-white mt-1">Penalty Rates &amp; Grace Periods Settings</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Configure systemic variables governing late payment fees, penalty accumulation cycles, and borrower payment extension grace thresholds.
        </p>
      </div>

      <form onSubmit={saveSettings} className="space-y-5 rounded-2xl border border-white/5 bg-white/[0.02] p-6 max-w-xl">
        <h3 className="text-sm font-semibold text-white border-b border-white/5 pb-3">Late Penalty Variables</h3>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Grace Period (Days)</label>
            <input
              type="number"
              value={penaltyConfig.gracePeriod}
              onChange={(e) => setPenaltyConfig({ ...penaltyConfig, gracePeriod: parseInt(e.target.value) || 0 })}
              className="premium-input w-full rounded-xl px-4 py-3 text-sm outline-none"
              min="0"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Late Penalty Fee (%)</label>
            <input
              type="number"
              value={penaltyConfig.penaltyPercentage}
              onChange={(e) => setPenaltyConfig({ ...penaltyConfig, penaltyPercentage: parseFloat(e.target.value) || 0 })}
              className="premium-input w-full rounded-xl px-4 py-3 text-sm outline-none"
              min="0"
              max="100"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Penalty Type</label>
          <select
            value={penaltyConfig.frequency}
            onChange={(e) => setPenaltyConfig({ ...penaltyConfig, frequency: e.target.value })}
            className="premium-select w-full rounded-xl px-4 py-3 text-sm outline-none"
            required
          >
            <option value="ONCE">Flat fee on overdue (One-time)</option>
            <option value="DAILY">Daily compounding accrual</option>
            <option value="WEEKLY">Weekly compounding accrual</option>
          </select>
        </div>

        <div className="pt-4 border-t border-white/5 flex items-center justify-between">
          {settingsSaved ? (
            <span className="text-emerald-600 text-xs font-semibold flex items-center gap-1.5">
              ✓ Policy settings updated successfully!
            </span>
          ) : (
            <span className="text-slate-500 text-[10px]">Applies to all active and new loans upon due date arrival.</span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-desert-500 hover:from-amber-600 hover:to-desert-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all duration-200 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Policy Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}
