import os
import re

FRONTEND_DIR = r"c:\Users\Admin\Desktop\karibuInc\web-admin\app"

REPLACEMENTS = [
    # Replace glass-panel with standard card
    (r'className="glass-panel ', r'className="card '),
    (r"className='glass-panel ", r"className='card "),
    # Neutralize text colors that force dark mode
    (r'text-slate-400', r'text-slate-500'),
    (r'text-rose-400', r'text-red-600'),
    (r'text-emerald-400', r'text-emerald-600'),
    # Neutralize manual inline rgba backgrounds 
    (r"background: 'rgba\(255,255,255,([^)]+)\)'", r"background: 'var(--surface-2)'"),
    (r"border: '1px solid rgba\(255,255,255,([^)]+)\)'", r"border: '1px solid var(--border)'"),
    (r"background: 'rgba\(0,0,0,0.6\)'", r"background: 'rgba(0,0,0,0.4)'"),
    (r"background: 'rgba\(0,0,0,0.65\)'", r"background: 'rgba(0,0,0,0.45)'"),
    (r"rgba\(10, 13, 24,", r"rgba(255, 255, 255,"),
    (r"rgba\(255, 255, 255, 0.02\)", r"rgba(0, 0, 0, 0.02)"),
    (r"rgba\(255, 255, 255, 0.06\)", r"rgba(0, 0, 0, 0.06)"),
    (r"rgba\(255, 255, 255, 0.1\)", r"rgba(0, 0, 0, 0.1)"),
    (r"bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-\[0_0_6px_rgba\(16,185,129,0.1\)\]", r"bg-green-50 text-green-700 border-green-200"),
    (r"bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-\[0_0_6px_rgba\(244,63,94,0.1\)\]", r"bg-red-50 text-red-700 border-red-200"),
    (r"bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-\[0_0_6px_rgba\(245,158,11,0.1\)\]", r"bg-yellow-50 text-yellow-700 border-yellow-200"),
    (r"rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-\[11px\] font-semibold text-emerald-400 hover:bg-emerald-500/20 hover:shadow-\[0_0_10px_rgba\(16,185,129,0.15\)\]", r"rounded-lg bg-green-50 border border-green-200 px-3 py-1.5 text-[11px] font-semibold text-green-700 hover:bg-green-100"),
    (r"rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-\[11px\] font-semibold text-rose-400 hover:bg-rose-500/20 hover:shadow-\[0_0_10px_rgba\(244,63,94,0.15\)\]", r"rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100"),
    (r"bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-\[0_0_8px_rgba\(99,102,241,0.15\)\]", r"bg-blue-50 text-blue-700 border-blue-200"),
    (r"bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-\[0_0_8px_rgba\(16,185,129,0.15\)\]", r"bg-green-50 text-green-700 border-green-200"),
    (r"bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-\[0_0_8px_rgba\(245,158,11,0.15\)\]", r"bg-yellow-50 text-yellow-700 border-yellow-200"),
    (r"bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-\[0_0_8px_rgba\(239,68,68,0.15\)\]", r"bg-red-50 text-red-700 border-red-200"),
    (r"bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-\[0_0_8px_rgba\(6,182,212,0.15\)\]", r"bg-cyan-50 text-cyan-700 border-cyan-200"),
    (r"background: 'linear-gradient\([^)]+rgba\(99,102,241,0.12\)[^)]+\)'", r"background: 'var(--brand-light)'"),
    (r"border: '1px solid rgba\(99,102,241,0.15\)'", r"border: '1px solid var(--border)'"),
    (r"boxShadow: isActive \? '0 0 20px rgba\(99,102,241,0.12\)' : 'var\(--shadow-card\)'", r"boxShadow: isActive ? 'var(--shadow-md)' : 'var(--shadow-sm)'"),
    (r"background: 'rgba\(99,102,241,0.06\)'", r"background: 'var(--surface-2)'"),
]

def clean_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    for pattern, repl in REPLACEMENTS:
        content = re.sub(pattern, repl, content)
        
    if original != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Cleaned {filepath}")

for root, _, files in os.walk(FRONTEND_DIR):
    for fn in files:
        if fn.endswith('.tsx') or fn.endswith('.ts'):
            clean_file(os.path.join(root, fn))
