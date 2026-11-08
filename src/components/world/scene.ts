import { Application, Container, Graphics, Sprite, Text, Texture, TextureStyle } from "pixi.js";
import mapData from "@/data/brazil-map.json";
import type { GeoCity } from "@/lib/geo/cities";
import { darknessFor, sunElevation } from "@/lib/sun";

/**
 * Mapa do Brasil em pixel art (1 pixel = 0,1 grau). Mostra as capitais,
 * as cidades que já têm moradores e, com zoom, todos os municípios.
 */
export type ActiveInfo = { slug: string; houses: number; mayorHandle: string | null };

type Callbacks = { onCityTap: (slug: string | null) => void };

const REGION_COLORS: Record<string, number[]> = {
  Norte: [0x3f9a46, 0x4aa34c, 0x379043],
  Nordeste: [0xc9b36a, 0xbfa95e, 0xd2bd74],
  "Centro-Oeste": [0x9fb04f, 0x95a848, 0xa9b958],
  Sudeste: [0x6fae52, 0x79b65a, 0x66a64b],
  Sul: [0x5f9e62, 0x68a86a, 0x58965b],
};

const shade = (color: number, f: number) => {
  const ch = (s: number) => Math.min(255, Math.max(0, Math.round(((color >> s) & 255) * f)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

export class WorldScene {
  private app!: Application;
  private camera = new Container();
  private nightLayer = new Sprite();
  private dotsAll = new Graphics();
  private markers = new Container();
  private labels = new Container();
  private zoom = 1;
  private minZoom = 0.5;
  private maxZoom = 40;
  private W = mapData.w;
  private H = mapData.h;
  private grid: Uint8Array;
  private active = new Map<string, ActiveInfo>();
  private labelPool = new Map<string, Text>();
  private selected: string | null = null;
  private destroyed = false;
  private cleanup: (() => void)[] = [];
  private pointers = new Map<number, { x: number; y: number }>();
  private gesture: { sx: number; sy: number; moved: boolean; dist?: number; zoom?: number } | null = null;
  private nightTimer: ReturnType<typeof setInterval> | null = null;
  private dirty = true;

  private constructor(
    private host: HTMLElement,
    private cities: GeoCity[],
    private cb: Callbacks,
  ) {
    this.grid = new Uint8Array(this.W * this.H);
    mapData.rows.forEach((row, y) => {
      let x = 0;
      for (let i = 0; i < row.length; i += 2) {
        this.grid.fill(row[i], y * this.W + x, y * this.W + x + row[i + 1]);
        x += row[i + 1];
      }
    });
  }

  static async create(host: HTMLElement, cities: GeoCity[], cb: Callbacks) {
    const s = new WorldScene(host, cities, cb);
    await s.init();
    return s;
  }

  // posição de uma cidade no mapa (em pixels do mapa)
  private px(lng: number, lat: number) {
    return { x: (lng - mapData.lngMin) / mapData.cell, y: (mapData.latMax - lat) / mapData.cell };
  }

  private async init() {
    TextureStyle.defaultOptions.scaleMode = "nearest";
    this.app = new Application();
    await this.app.init({
      resizeTo: this.host,
      background: 0x2a5d9c,
      antialias: false,
      roundPixels: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    if (this.destroyed) return;
    this.host.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = "none";
    this.app.canvas.style.display = "block";

    this.camera.addChild(this.buildLand(), this.nightLayer, this.dotsAll, this.markers);
    this.app.stage.addChild(this.camera, this.labels);
    this.buildDots();
    this.drawNight();
    this.nightTimer = setInterval(() => this.drawNight(), 60_000);
    this.fit();
    this.bindInput();
    this.app.ticker.add(() => this.frame());
    this.app.renderer.on("resize", () => {
      this.clamp();
      this.dirty = true;
    });
  }

  destroy() {
    this.destroyed = true;
    if (this.nightTimer) clearInterval(this.nightTimer);
    this.cleanup.forEach((f) => f());
    try {
      this.app?.destroy(true, { children: true, texture: true, textureSource: true });
    } catch {
      /* ok */
    }
  }

  // ------------------------------------------------------------- desenho

  private buildLand() {
    const { W, H, grid } = this;
    const states = mapData.states;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(W, H);
    const put = (x: number, y: number, color: number, alpha = 255) => {
      const i = (y * W + x) * 4;
      img.data[i] = (color >> 16) & 255;
      img.data[i + 1] = (color >> 8) & 255;
      img.data[i + 2] = color & 255;
      img.data[i + 3] = alpha;
    };
    const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y * W + x] : 0);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = grid[y * W + x];
        if (!v) {
          // oceano transparente (o fundo da tela é o mar, sem emenda), com
          // água rasa clareando aos poucos perto da costa
          let dist = 99;
          for (let dy = -4; dy <= 4; dy++)
            for (let dx = -4; dx <= 4; dx++) if (at(x + dx, y + dy)) dist = Math.min(dist, Math.max(Math.abs(dx), Math.abs(dy)));
          const alpha = [0, 235, 170, 110, 55][dist] ?? 0;
          if (alpha) put(x, y, 0x3a78b8, alpha);
          continue;
        }
        const st = states[v - 1];
        const palette = REGION_COLORS[st.region] ?? [0x5fae4e];
        let color = palette[v % palette.length];
        const right = at(x + 1, y);
        const down = at(x, y + 1);
        if (!right || !down || !at(x - 1, y) || !at(x, y - 1)) color = 0xe6d39a; // praia
        else if (right !== v || down !== v) color = shade(color, 0.72); // fronteira
        else if (((x * 31 + y * 17) ^ (x * y)) % 23 === 0) color = shade(color, 0.9);
        put(x, y, color);
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = Texture.from({ resource: canvas, scaleMode: "nearest" });
    return new Sprite(tex);
  }

  /**
   * Noite de verdade: escurece onde o sol já se pôs. Cobre muito além do
   * mapa (para não aparecer "borda") e é desenhada em baixa resolução com
   * suavização, virando um degradê contínuo.
   */
  private drawNight() {
    const step = 12;
    const margin = 1200;
    const cols = Math.ceil((this.W + margin * 2) / step);
    const rows = Math.ceil((this.H + margin * 2) / step);
    const canvas = document.createElement("canvas");
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(cols, rows);
    const now = new Date();
    for (let j = 0; j < rows; j++) {
      const lat = Math.max(-89, Math.min(89, mapData.latMax - (j * step - margin + step / 2) * mapData.cell));
      for (let i = 0; i < cols; i++) {
        const lng = mapData.lngMin + (i * step - margin + step / 2) * mapData.cell;
        const d = darknessFor(sunElevation(lat, lng, now));
        const k = (j * cols + i) * 4;
        img.data[k] = 10;
        img.data[k + 1] = 16;
        img.data[k + 2] = 48;
        img.data[k + 3] = Math.round(d * 0.5 * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    const old = this.nightLayer.texture;
    this.nightLayer.texture = Texture.from({ resource: canvas, scaleMode: "linear" });
    if (old && old !== Texture.EMPTY) old.destroy(true);
    this.nightLayer.scale.set(step);
    this.nightLayer.position.set(-margin, -margin);
  }

  private buildDots() {
    const g = this.dotsAll;
    for (const c of this.cities) {
      if (c.capital) continue;
      const p = this.px(c.lng, c.lat);
      g.rect(p.x - 0.2, p.y - 0.2, 0.4, 0.4).fill({ color: 0x1f1d2b, alpha: 0.55 });
    }
    this.drawMarkers();
  }

  private drawMarkers() {
    this.markers.removeChildren().forEach((c) => c.destroy());
    const g = new Graphics();
    for (const c of this.cities) {
      const info = this.active.get(c.slug);
      if (!c.capital && !info) continue;
      const p = this.px(c.lng, c.lat);
      if (info) {
        // casinha amarela
        g.rect(p.x - 1.5, p.y - 1, 3, 2).fill(0xffcc33).stroke({ color: 0x1f1d2b, width: 0.4 });
        g.poly([p.x - 2, p.y - 1, p.x, p.y - 2.6, p.x + 2, p.y - 1]).fill(0xc0483a).stroke({ color: 0x1f1d2b, width: 0.4 });
      } else {
        g.rect(p.x - 1, p.y - 1, 2, 2).fill(0xffffff).stroke({ color: 0x1f1d2b, width: 0.5 });
      }
      if (c.slug === this.selected) g.circle(p.x, p.y, 4).stroke({ color: 0xffe14f, width: 0.8 });
    }
    this.markers.addChild(g);
    this.dirty = true;
  }

  setActive(list: ActiveInfo[]) {
    this.active = new Map(list.map((a) => [a.slug, a]));
    if (this.app?.renderer) this.drawMarkers();
  }

  select(slug: string | null, focus = false) {
    this.selected = slug;
    if (!this.app?.renderer) return;
    this.drawMarkers();
    if (focus && slug) {
      const c = this.cities.find((x) => x.slug === slug);
      if (c) this.centerOn(c, Math.max(this.zoom, 10));
    }
  }

  // ------------------------------------------------------------ rótulos

  private frame() {
    this.dotsAll.visible = this.zoom >= 4;
    if (!this.dirty) return;
    this.dirty = false;
    const wanted = new Map<string, { text: string; x: number; y: number; color: number }>();
    const vw = this.viewW;
    const vh = this.viewH;
    const showAllNames = this.zoom >= 12;
    let budget = 80;
    for (const c of this.cities) {
      const info = this.active.get(c.slug);
      const important = c.capital || !!info || c.slug === this.selected;
      if (!important && !showAllNames) continue;
      if (c.capital && !info && this.zoom < 1.6 && c.slug !== this.selected) continue;
      const p = this.px(c.lng, c.lat);
      const sx = p.x * this.zoom + this.camera.x;
      const sy = p.y * this.zoom + this.camera.y;
      if (sx < -60 || sy < -20 || sx > vw + 60 || sy > vh + 20) continue;
      if (!important && budget-- <= 0) continue;
      const text = info ? `${c.name} · ${info.houses}🏠` : c.name;
      wanted.set(c.slug, { text, x: sx, y: sy - (info ? 3 : 2) * Math.max(1, this.zoom * 0.6), color: info ? 0xffe14f : 0xffffff });
    }
    for (const [slug, label] of this.labelPool) {
      if (!wanted.has(slug)) {
        label.destroy();
        this.labelPool.delete(slug);
      }
    }
    for (const [slug, w] of wanted) {
      let label = this.labelPool.get(slug);
      if (!label) {
        label = new Text({
          text: w.text,
          style: {
            fontFamily: "ui-monospace, Menlo, Consolas, monospace",
            fontSize: 11,
            fontWeight: "bold",
            fill: w.color,
            stroke: { color: 0x1a1a2a, width: 3 },
          },
        });
        label.anchor.set(0.5, 1);
        this.labels.addChild(label);
        this.labelPool.set(slug, label);
      }
      label.text = w.text;
      label.x = Math.round(w.x);
      label.y = Math.round(w.y);
    }
  }

  // ------------------------------------------------------------- câmera

  private get viewW() {
    return this.app.renderer.screen.width;
  }
  private get viewH() {
    return this.app.renderer.screen.height;
  }

  private fit() {
    const fit = Math.min(this.viewW / this.W, this.viewH / this.H) * 0.95;
    this.minZoom = fit * 0.8;
    this.zoom = fit;
    this.camera.scale.set(fit);
    this.camera.x = (this.viewW - this.W * fit) / 2;
    this.camera.y = (this.viewH - this.H * fit) / 2;
  }

  private centerOn(c: GeoCity, zoom: number) {
    const p = this.px(c.lng, c.lat);
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, zoom));
    this.camera.scale.set(this.zoom);
    this.camera.x = this.viewW / 2 - p.x * this.zoom;
    this.camera.y = this.viewH / 2 - p.y * this.zoom;
    this.clamp();
  }

  private zoomAt(sx: number, sy: number, z: number) {
    z = Math.min(this.maxZoom, Math.max(this.minZoom, z));
    const wx = (sx - this.camera.x) / this.zoom;
    const wy = (sy - this.camera.y) / this.zoom;
    this.zoom = z;
    this.camera.scale.set(z);
    this.camera.x = sx - wx * z;
    this.camera.y = sy - wy * z;
    this.clamp();
  }

  zoomBy(f: number) {
    this.zoomAt(this.viewW / 2, this.viewH / 2, this.zoom * f);
  }

  private clamp() {
    const pad = 60;
    this.camera.x = Math.min(this.viewW - pad, Math.max(pad - this.W * this.zoom, this.camera.x));
    this.camera.y = Math.min(this.viewH - pad, Math.max(pad - this.H * this.zoom, this.camera.y));
    this.dirty = true;
  }

  private bindInput() {
    const el = this.app.canvas;
    const local = (e: PointerEvent | WheelEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      const p = local(e);
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 1) this.gesture = { sx: p.x, sy: p.y, moved: false };
      else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.gesture = { sx: p.x, sy: p.y, moved: true, dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom };
      }
    };
    const move = (e: PointerEvent) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev || !this.gesture) return;
      const p = local(e);
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size >= 2 && this.gesture.dist) {
        const [a, b] = [...this.pointers.values()];
        this.camera.x += (p.x - prev.x) / 2;
        this.camera.y += (p.y - prev.y) / 2;
        this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, this.gesture.zoom! * (Math.hypot(a.x - b.x, a.y - b.y) / this.gesture.dist));
        return;
      }
      if (Math.hypot(p.x - this.gesture.sx, p.y - this.gesture.sy) > 6) this.gesture.moved = true;
      if (this.gesture.moved) {
        this.camera.x += p.x - prev.x;
        this.camera.y += p.y - prev.y;
        this.clamp();
      }
    };
    const up = (e: PointerEvent) => {
      if (!this.pointers.delete(e.pointerId)) return;
      if (this.gesture && !this.gesture.moved && this.pointers.size === 0) {
        const p = local(e);
        this.tap(p.x, p.y);
      }
      if (this.pointers.size === 0) this.gesture = null;
      else {
        const [rest] = [...this.pointers.values()];
        this.gesture = { sx: rest.x, sy: rest.y, moved: true };
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      this.zoomAt(p.x, p.y, this.zoom * Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    this.cleanup.push(() => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    });
  }

  /** Toque: escolhe a cidade mais perto do dedo. */
  private tap(sx: number, sy: number) {
    const all = this.zoom >= 4;
    let best: { slug: string; d: number } | null = null;
    for (const c of this.cities) {
      if (!all && !c.capital && !this.active.has(c.slug)) continue;
      const p = this.px(c.lng, c.lat);
      const d = Math.hypot(p.x * this.zoom + this.camera.x - sx, p.y * this.zoom + this.camera.y - sy);
      const bonus = this.active.has(c.slug) || c.capital ? 6 : 0;
      if (d - bonus < 22 && (!best || d - bonus < best.d)) best = { slug: c.slug, d: d - bonus };
    }
    this.cb.onCityTap(best?.slug ?? null);
  }
}
