'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '../../../lib/api';
import { THEME } from '@/theme';

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
      <div className={THEME.classes.panel} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent"></span>
        <span className={THEME.classes.textMuted}>Loading global credit policy...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={THEME.classes.panel}>
        <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>⚠ Error: {error}</p>
      </div>
    );
  }

  return (
    <div className={THEME.classes.panel} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <p className={THEME.classes.subtitle}>Global Credit Policy</p>
        <h2 className={THEME.classes.title} style={{ marginTop: 4 }}>Penalty Rates &amp; Grace Periods Settings</h2>
        <p className={THEME.classes.textMuted} style={{ marginTop: 4, lineHeight: 1.6 }}>
          Configure systemic variables governing late payment fees, penalty accumulation cycles, and borrower payment extension grace thresholds.
        </p>
      </div>

      <form onSubmit={saveSettings} style={{ border: '1px solid #000', padding: '1.5rem', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: '0.75rem', borderBottom: '1px solid #e4e4e7' }}>Late Penalty Variables</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className={THEME.classes.textMuted} style={{ display: 'block', marginBottom: 6 }}>Grace Period (Days)</label>
            <input
              type="number"
              value={penaltyConfig.gracePeriod}
              onChange={(e) => setPenaltyConfig({ ...penaltyConfig, gracePeriod: parseInt(e.target.value) || 0 })}
              className={THEME.classes.input}
              min="0"
              required
            />
          </div>

          <div>
            <label className={THEME.classes.textMuted} style={{ display: 'block', marginBottom: 6 }}>Late Penalty Fee (%)</label>
            <input
              type="number"
              value={penaltyConfig.penaltyPercentage}
              onChange={(e) => setPenaltyConfig({ ...penaltyConfig, penaltyPercentage: parseFloat(e.target.value) || 0 })}
              className={THEME.classes.input}
              min="0"
              max="100"
              required
            />
          </div>
        </div>

        <div>
          <label className={THEME.classes.textMuted} style={{ display: 'block', marginBottom: 6 }}>Penalty Type</label>
          <select
            value={penaltyConfig.frequency}
            onChange={(e) => setPenaltyConfig({ ...penaltyConfig, frequency: e.target.value })}
            className={THEME.classes.input}
            required
          >
            <option value="ONCE">Flat fee on overdue (One-time)</option>
            <option value="DAILY">Daily compounding accrual</option>
            <option value="WEEKLY">Weekly compounding accrual</option>
          </select>
        </div>

        <div style={{ paddingTop: '1rem', borderTop: '1px solid #e4e4e7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {settingsSaved ? (
            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>✓ Policy settings updated successfully!</span>
          ) : (
            <span className={THEME.classes.textMuted}>Applies to all active and new loans upon due date arrival.</span>
          )}
          <button
            type="submit"
            disabled={saving}
            className={THEME.classes.btnPrimary}
          >
            {saving ? 'Saving...' : 'Save Policy Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}
