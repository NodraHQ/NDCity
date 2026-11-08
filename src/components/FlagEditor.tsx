"use client";

import { useState } from "react";
import { STATE_FLAG_UFS, blankFlag, stateFlag } from "@/lib/flags";
import { FLAG_H, FLAG_W, PALETTE } from "@/lib/styles";

/**
 * Bandeira: nenhuma, a de um estado, ou desenhada à mão pintando os
 * quadradinhos (12x8). Qualquer bandeira pode ser editada depois.
 */
export default function FlagEditor({
  value,
  defaultUf,
  onChange,
}: {
  value: string | undefined;
  defaultUf: string | null;
  onChange: (flag: string | undefined) => void;
}) {
  const [color, setColor] = useState(21);
  const [uf, setUf] = useState(defaultUf && STATE_FLAG_UFS.includes(defaultUf) ? defaultUf : "SP");
  const [painting, setPainting] = useState(false);

  function paint(i: number) {
    const base = value ?? blankFlag();
    const ch = color.toString(36);
    if (base[i] === ch) return;
    onChange(base.slice(0, i) + ch + base.slice(i + 1));
  }

  return (
    <div className="flag-editor">
      <div className="row wrap left">
        <button type="button" className={`btn tiny ${!value ? "primary" : ""}`} onClick={() => onChange(undefined)}>Sem bandeira</button>
        <select value={uf} onChange={(e) => { setUf(e.target.value); onChange(stateFlag(e.target.value) ?? undefined); }}>
          {STATE_FLAG_UFS.map((u) => <option key={u} value={u}>Bandeira de {u}</option>)}
        </select>
        <button type="button" className="btn tiny" onClick={() => onChange(stateFlag(uf) ?? undefined)}>Usar</button>
        <button type="button" className="btn tiny" onClick={() => onChange(blankFlag())}>Desenhar do zero</button>
      </div>
      {value && (
        <>
          <div
            className="flag-grid"
            style={{ gridTemplateColumns: `repeat(${FLAG_W}, 1fr)` }}
            onPointerDown={() => setPainting(true)}
            onPointerUp={() => setPainting(false)}
            onPointerLeave={() => setPainting(false)}
          >
            {Array.from({ length: FLAG_W * FLAG_H }, (_, i) => (
              <button
                type="button"
                key={i}
                aria-label={`quadradinho ${i + 1}`}
                style={{ background: PALETTE[parseInt(value[i], 36)] }}
                onPointerDown={(e) => { (e.target as HTMLElement).releasePointerCapture(e.pointerId); paint(i); }}
                onPointerEnter={() => painting && paint(i)}
              />
            ))}
          </div>
          <div className="palette small">
            {PALETTE.map((c, i) => (
              <button type="button" key={c} className={`swatch ${color === i ? "on" : ""}`} style={{ background: c }} aria-label={`cor ${c}`} onClick={() => setColor(i)} />
            ))}
          </div>
          <p className="muted">Escolha uma cor e toque (ou arraste o dedo) nos quadradinhos.</p>
        </>
      )}
    </div>
  );
}
