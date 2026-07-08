import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Settings as SettingsIcon, Volume2 } from "lucide-react";

const COLOR_OPTIONS = [
  { id: "cyan", label: "Neon Cyan", swatch: "#00F0FF" },
  { id: "pink", label: "Hot Pink", swatch: "#FF00E6" },
  { id: "green", label: "Acid Green", swatch: "#00FF88" },
  { id: "rainbow", label: "Rainbow", swatch: "linear-gradient(90deg,#ff0055,#ffd400,#00ff88,#00f0ff,#a000ff)" },
];

export default function SettingsPanel({ settings, onChange }) {
  const update = (k, v) => onChange({ ...settings, [k]: v });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="flex items-center gap-2 px-3 py-2 border border-white/15 rounded-lg hover:border-[#00F0FF] hover:text-[#00F0FF] transition-all text-xs uppercase tracking-wider"
          data-testid="settings-button"
        >
          <SettingsIcon size={14} />
          Settings
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="glass-bright border-l border-white/10 text-white w-[380px]" data-testid="settings-panel">
        <SheetHeader>
          <SheetTitle className="font-heading text-2xl neon-cyan tracking-tight">Piano Settings</SheetTitle>
          <SheetDescription className="text-white/50 font-mono text-xs">
            Customize sound, visuals & behavior
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Volume */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/60">
                <Volume2 size={13} /> Volume
              </div>
              <span className="text-xs neon-cyan font-mono">{Math.round(settings.volume * 100)}%</span>
            </div>
            <Slider
              value={[settings.volume]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={(v) => update("volume", v[0])}
              data-testid="volume-slider"
            />
          </div>

          {/* Lookahead */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-[0.2em] text-white/60">Note Fall Time</div>
              <span className="text-xs neon-cyan font-mono">{settings.lookahead.toFixed(1)}s</span>
            </div>
            <Slider
              value={[settings.lookahead]}
              min={2}
              max={8}
              step={0.5}
              onValueChange={(v) => update("lookahead", v[0])}
              data-testid="lookahead-slider"
            />
          </div>

          {/* Note Color */}
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/60 mb-2">Note Color</div>
            <div className="grid grid-cols-2 gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => update("note_color", c.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs ${
                    settings.note_color === c.id
                      ? "border-[#00F0FF] bg-[#00F0FF]/10"
                      : "border-white/10 hover:border-white/25"
                  }`}
                  data-testid={`color-option-${c.id}`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-white/20"
                    style={{ background: c.swatch }}
                  />
                  <span className="uppercase tracking-wider">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Show labels */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Note Labels</div>
              <div className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Show C octave labels</div>
            </div>
            <Switch
              checked={settings.show_labels}
              onCheckedChange={(v) => update("show_labels", v)}
              data-testid="labels-switch"
            />
          </div>

          {/* Sustain */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Sustain</div>
              <div className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Longer note release</div>
            </div>
            <Switch
              checked={settings.sustain}
              onCheckedChange={(v) => update("sustain", v)}
              data-testid="sustain-switch"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Chord Tutorial</div>
              <div className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Floating chord shape above piano</div>
            </div>
            <Switch
              checked={settings.chord_tutorial !== false}
              onCheckedChange={(v) => update("chord_tutorial", v)}
              data-testid="chord-tutorial-switch"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
