import { Application, Container, Rectangle, Sprite, Text, Texture, TextureStyle, type Graphics } from "pixi.js";
import type { BuildingType } from "@/lib/buildings";
import { type CityLayout, loopLength, pointOnLoop } from "@/lib/city/generate";
import { hashString } from "@/lib/city/rng";
import {
  type Drawing,
  TH,
  TW,
  drawBuilding,
  drawCar,
  drawCityHall,
  drawDecoration,
  drawForSaleSign,
  drawGround,
  drawLotHighlight,
  drawPerson,
} from "./art";

export type House = { lotIndex: number; handle: string; type: BuildingType };

export type SceneState = {
  houses: House[];
  mayorHandle: string | null;
  mode: "view" | "pick";
  pickedLot: number | null;
  ghostType: BuildingType | null;
  focusLot: number | null;
};

export type SceneCallbacks = {
  onLotTap: (lotIndex: number, occupied: boolean) => void;
  onCityHallTap: () => void;
  onEmptyTap: () => void;
};

type Tex = { texture: Texture; ox: number; oy: number };

/** Altura aproximada (px) de cada construção, para posicionar o @. */
const LABEL_HEIGHT: Record<BuildingType, number> = { casa: 19, predio: 44, oficina: 19, padaria: 22, cabare: 27 };
const LABEL_MIN_ZOOM = 2.6;

type Mover = { sprite: Sprite; path: CityLayout["paths"][number]; length: number; t: number; tex: [Tex, Tex] | Tex };

export class CityScene {
  private app!: Application;
  private world = new Container();
  private highlights = new Container();
  private objects = new Container();
  private labels = new Container();
  private cache = new Map<string, Tex>();
  private ox = 0;
  private lotByTile = new Map<number, number>();
  private houseSprites = new Map<number, { sprite: Sprite; label: Text; house: House }>();
  private signSprites = new Map<number, Sprite>();
  private highlightSprites: Sprite[] = [];
  private ghost: Sprite | null = null;
  private hallSprite!: Sprite;
  private hallLabel!: Text;
  private movers: Mover[] = [];
  private state: SceneState = { houses: [], mayorHandle: null, mode: "view", pickedLot: null, ghostType: null, focusLot: null };
  private zoom = 2;
  private minZoom = 0.5;
  private maxZoom = 8;
  private pointers = new Map<number, { x: number; y: number }>();
  private gesture: { startX: number; startY: number; moved: boolean; pinchDist?: number; pinchZoom?: number } | null = null;
  private cleanupFns: (() => void)[] = [];
  private destroyed = false;
  private elapsed = 0;
  private worldW = 0;
  private worldH = 0;

  private constructor(
    private host: HTMLElement,
    private layout: CityLayout,
    public callbacks: SceneCallbacks,
  ) {}

  static async create(host: HTMLElement, layout: CityLayout, callbacks: SceneCallbacks) {
    const scene = new CityScene(host, layout, callbacks);
    await scene.init();
    return scene;
  }

  private async init() {
    TextureStyle.defaultOptions.scaleMode = "nearest";
    this.app = new Application();
    await this.app.init({
      resizeTo: this.host,
      background: 0x2f6e9e,
      antialias: false,
      roundPixels: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    if (this.destroyed) return;
    this.host.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = "none";
    this.app.canvas.style.display = "block";

    this.objects.sortableChildren = true;
    this.world.addChild(this.highlights, this.objects);
    this.app.stage.addChild(this.world, this.labels);

    this.buildGround();
    this.buildStatic();
    this.buildMovers();
    this.fitToScreen();
    this.bindInput();

    this.app.ticker.add((t) => this.tick(t.deltaMS / 1000));
    const onResize = () => this.clampCamera();
    this.app.renderer.on("resize", onResize);
  }

  destroy() {
    this.destroyed = true;
    this.cleanupFns.forEach((f) => f());
    try {
      this.app?.destroy(true, { children: true });
    } catch {
      /* já destruído */
    }
    this.cache.forEach((t) => t.texture.destroy(true));
    this.cache.clear();
  }

  // ------------------------------------------------------------ texturas

  private bake(d: Drawing): Tex {
    const texture = this.app.renderer.generateTexture({
      target: d.g,
      frame: new Rectangle(0, 0, d.width, d.height),
      resolution: 1,
      antialias: false,
      textureSourceOptions: { scaleMode: "nearest" },
    });
    d.g.destroy();
    return { texture, ox: d.ox, oy: d.oy };
  }

  private tex(key: string, draw: () => Drawing): Tex {
    let t = this.cache.get(key);
    if (!t) {
      t = this.bake(draw());
      this.cache.set(key, t);
    }
    return t;
  }

  // ------------------------------------------------------- coordenadas

  /** Canto de cima (vértice norte) do tile (r, c) no mundo. */
  private wx(r: number, c: number) {
    return (c - r) * (TW / 2) + this.ox;
  }
  private wy(r: number, c: number) {
    return (c + r) * (TH / 2);
  }

  private place(sprite: Sprite, t: Tex, r: number, c: number) {
    sprite.texture = t.texture;
    sprite.x = Math.round(this.wx(r, c) - t.ox);
    sprite.y = Math.round(this.wy(r, c) - t.oy);
  }

  // ------------------------------------------------------------ montagem

  private buildGround() {
    const { g, ox, width, height } = drawGround(this.layout);
    this.ox = ox;
    this.worldW = width;
    this.worldH = height;
    const t = this.bake({ g: g as Graphics, width, height, ox: 0, oy: 0 });
    this.cache.set("ground", t);
    const ground = new Sprite(t.texture);
    this.world.addChildAt(ground, 0);
    for (const lot of this.layout.lots) this.lotByTile.set(lot.row * this.layout.width + lot.col, lot.index);
  }

  private buildStatic() {
    for (const d of this.layout.decorations) {
      const t = this.tex(`deco:${d.kind}:${d.variant}`, () => drawDecoration(d.kind, d.variant));
      const s = new Sprite();
      this.place(s, t, d.row, d.col);
      s.zIndex = d.row + d.col + 1;
      this.objects.addChild(s);
    }
    const h = this.layout.cityHall;
    const ht = this.tex("cityhall", drawCityHall);
    this.hallSprite = new Sprite();
    this.place(this.hallSprite, ht, h.row, h.col);
    this.hallSprite.zIndex = h.row + h.col + 2;
    this.objects.addChild(this.hallSprite);
    this.hallLabel = this.makeLabel("", 0xffe14f);
    this.labels.addChild(this.hallLabel);

    const sign = this.tex("sign", drawForSaleSign);
    for (const lot of this.layout.lots) {
      const s = new Sprite();
      this.place(s, sign, lot.row, lot.col);
      s.zIndex = lot.row + lot.col + 1;
      this.objects.addChild(s);
      this.signSprites.set(lot.index, s);
    }
  }

  private buildMovers() {
    for (const p of this.layout.paths) {
      const sprite = new Sprite();
      const tex: Mover["tex"] =
        p.kind === "car"
          ? [
              this.tex(`car:${p.variant}:r`, () => drawCar(p.variant, "r")),
              this.tex(`car:${p.variant}:c`, () => drawCar(p.variant, "c")),
            ]
          : this.tex(`person:${p.variant}`, () => drawPerson(p.variant));
      this.objects.addChild(sprite);
      this.movers.push({ sprite, path: p, length: loopLength(p.points), t: p.offset, tex });
    }
  }

  private makeLabel(text: string, color = 0xffffff) {
    const label = new Text({
      text,
      style: {
        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
        fontSize: 12,
        fontWeight: "bold",
        fill: color,
        stroke: { color: 0x1a1a2a, width: 3 },
      },
    });
    label.anchor.set(0.5, 1);
    label.visible = false;
    return label;
  }

  // ------------------------------------------------------- atualização

  update(next: SceneState) {
    if (this.destroyed || !this.hallSprite) {
      this.state = next;
      return;
    }
    const prev = this.state;
    this.state = next;
    const lots = this.layout.lots;

    // casinhas
    const wanted = new Map(next.houses.map((h) => [h.lotIndex, h]));
    for (const [idx, entry] of this.houseSprites) {
      const h = wanted.get(idx);
      if (!h || h.type !== entry.house.type || h.handle !== entry.house.handle) {
        entry.sprite.destroy();
        entry.label.destroy();
        this.houseSprites.delete(idx);
      }
    }
    for (const h of next.houses) {
      if (this.houseSprites.has(h.lotIndex)) continue;
      const lot = lots[h.lotIndex];
      if (!lot) continue;
      const variant = hashString(h.handle) % 5;
      const t = this.tex(`b:${h.type}:${variant}`, () => drawBuilding(h.type, variant));
      const sprite = new Sprite();
      this.place(sprite, t, lot.row, lot.col);
      sprite.zIndex = lot.row + lot.col + 1;
      this.objects.addChild(sprite);
      const label = this.makeLabel(`@${h.handle}`);
      this.labels.addChild(label);
      this.houseSprites.set(h.lotIndex, { sprite, label, house: h });
    }
    for (const [idx, s] of this.signSprites) s.visible = !wanted.has(idx);

    this.applyPopulation(next.houses.length);

    this.hallLabel.text = next.mayorHandle ? `🏛 @${next.mayorHandle}` : "🔒 Prefeitura livre";

    // modo de escolha de lote
    this.highlightSprites.forEach((s) => s.destroy());
    this.highlightSprites = [];
    this.ghost?.destroy();
    this.ghost = null;
    if (next.mode === "pick") {
      const free = this.tex("hl:free", () => drawLotHighlight(0xffe14f));
      const picked = this.tex("hl:picked", () => drawLotHighlight(0x4fff7a));
      for (const lot of lots) {
        if (wanted.has(lot.index)) continue;
        const s = new Sprite();
        this.place(s, lot.index === next.pickedLot ? picked : free, lot.row, lot.col);
        (s as Sprite & { __picked?: boolean }).__picked = lot.index === next.pickedLot;
        this.highlights.addChild(s);
        this.highlightSprites.push(s);
      }
      if (next.pickedLot != null && next.ghostType && lots[next.pickedLot] && !wanted.has(next.pickedLot)) {
        const lot = lots[next.pickedLot];
        const t = this.tex(`b:${next.ghostType}:0`, () => drawBuilding(next.ghostType!, 0));
        this.ghost = new Sprite();
        this.place(this.ghost, t, lot.row, lot.col);
        this.ghost.zIndex = lot.row + lot.col + 1.5;
        this.ghost.alpha = 0.8;
        this.objects.addChild(this.ghost);
        const sign = this.signSprites.get(lot.index);
        if (sign) sign.visible = false;
      }
    }

    if (next.focusLot != null && next.focusLot !== prev.focusLot && lots[next.focusLot]) {
      const lot = lots[next.focusLot];
      this.centerOn(lot.row + 0.5, lot.col + 0.5, Math.max(this.zoom, 3.5));
    }
  }

  /**
   * Quanto mais casas, mais gente na rua: cidade vazia tem 2 carros e 3
   * pessoas; cada casa nova traz mais movimento (até o limite da reserva).
   */
  private applyPopulation(houses: number) {
    const cars = Math.min(2 + Math.ceil(houses * 0.6), 42);
    const people = Math.min(3 + Math.ceil(houses * 1.2), 80);
    let c = 0;
    let p = 0;
    for (const m of this.movers) {
      if (m.path.kind === "car") m.sprite.visible = c++ < cars;
      else m.sprite.visible = p++ < people;
    }
  }

  // ------------------------------------------------------------ animação

  private tick(dt: number) {
    if (this.destroyed) return;
    this.elapsed += dt;
    for (const m of this.movers) {
      if (!m.sprite.visible) continue;
      m.t += (dt * m.path.speed) / m.length;
      const p = pointOnLoop(m.path.points, m.t);
      let t: Tex;
      if (Array.isArray(m.tex)) t = m.tex[p.dr !== 0 ? 0 : 1];
      else t = m.tex;
      this.place(m.sprite, t, p.r - 0.5, p.c - 0.5);
      if (m.path.kind === "person") m.sprite.y -= Math.floor(this.elapsed * 6 + m.path.offset * 10) % 2;
      m.sprite.zIndex = p.r + p.c + 0.01;
    }
    const pulse = 0.55 + 0.45 * Math.sin(this.elapsed * 5);
    for (const s of this.highlightSprites) s.alpha = (s as Sprite & { __picked?: boolean }).__picked ? 1 : pulse;
    this.updateLabels();
  }

  private updateLabels() {
    const showHouses = this.zoom >= LABEL_MIN_ZOOM;
    for (const { label, house } of this.houseSprites.values()) {
      const lot = this.layout.lots[house.lotIndex];
      if (!showHouses || !lot) {
        label.visible = false;
        continue;
      }
      const x = this.wx(lot.row + 0.5, lot.col + 0.5);
      const y = this.wy(lot.row + 0.5, lot.col + 0.5) - LABEL_HEIGHT[house.type];
      label.x = Math.round(x * this.zoom + this.world.x);
      label.y = Math.round(y * this.zoom + this.world.y);
      label.visible = true;
    }
    const h = this.layout.cityHall;
    this.hallLabel.x = Math.round(this.wx(h.row + 1, h.col + 1) * this.zoom + this.world.x);
    this.hallLabel.y = Math.round((this.wy(h.row + 1, h.col + 1) - 56) * this.zoom + this.world.y);
    this.hallLabel.visible = this.zoom >= 1.2;
  }

  // ------------------------------------------------------------- câmera

  private get viewW() {
    return this.app.renderer.screen.width;
  }
  private get viewH() {
    return this.app.renderer.screen.height;
  }

  private fitToScreen() {
    const fit = Math.min(this.viewW / this.worldW, this.viewH / this.worldH);
    this.minZoom = Math.max(0.4, fit * 0.8);
    const h = this.layout.cityHall;
    this.centerOn(h.row + 1, h.col + 1, Math.max(fit * 1.6, Math.min(2.5, this.viewW / 400)));
  }

  private centerOn(r: number, c: number, zoom: number) {
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, zoom));
    this.world.scale.set(this.zoom);
    this.world.x = this.viewW / 2 - this.wx(r, c) * this.zoom;
    this.world.y = this.viewH / 2 - this.wy(r, c) * this.zoom;
    this.clampCamera();
  }

  private zoomAt(sx: number, sy: number, newZoom: number) {
    const z = Math.min(this.maxZoom, Math.max(this.minZoom, newZoom));
    const wxp = (sx - this.world.x) / this.zoom;
    const wyp = (sy - this.world.y) / this.zoom;
    this.zoom = z;
    this.world.scale.set(z);
    this.world.x = sx - wxp * z;
    this.world.y = sy - wyp * z;
    this.clampCamera();
  }

  private clampCamera() {
    const w = this.worldW * this.zoom;
    const h = this.worldH * this.zoom;
    const pad = 80;
    this.world.x = Math.min(this.viewW - pad, Math.max(pad - w, this.world.x));
    this.world.y = Math.min(this.viewH - pad, Math.max(pad - h, this.world.y));
  }

  zoomBy(factor: number) {
    this.zoomAt(this.viewW / 2, this.viewH / 2, this.zoom * factor);
  }

  // ------------------------------------------------------------ toques

  private bindInput() {
    const el = this.app.canvas;
    const local = (e: PointerEvent | WheelEvent) => {
      const rect = el.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      const p = local(e);
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 1) {
        this.gesture = { startX: p.x, startY: p.y, moved: false };
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.gesture = {
          startX: p.x,
          startY: p.y,
          moved: true,
          pinchDist: Math.hypot(a.x - b.x, a.y - b.y),
          pinchZoom: this.zoom,
        };
      }
    };
    const move = (e: PointerEvent) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev || !this.gesture) return;
      const p = local(e);
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size >= 2 && this.gesture.pinchDist) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        // arrasta junto com o meio dos dedos
        this.world.x += (p.x - prev.x) / 2;
        this.world.y += (p.y - prev.y) / 2;
        this.zoomAt(mid.x, mid.y, this.gesture.pinchZoom! * (dist / this.gesture.pinchDist));
        return;
      }
      if (Math.hypot(p.x - this.gesture.startX, p.y - this.gesture.startY) > 6) this.gesture.moved = true;
      if (this.gesture.moved) {
        this.world.x += p.x - prev.x;
        this.world.y += p.y - prev.y;
        this.clampCamera();
      }
    };
    const up = (e: PointerEvent) => {
      const had = this.pointers.delete(e.pointerId);
      if (!had) return;
      if (this.gesture && !this.gesture.moved && this.pointers.size === 0) {
        const p = local(e);
        this.handleTap(p.x, p.y);
      }
      if (this.pointers.size === 0) this.gesture = null;
      else if (this.gesture) {
        // sobrou um dedo depois da pinça: continua arrastando sem "tocar"
        const [rest] = [...this.pointers.values()];
        this.gesture = { startX: rest.x, startY: rest.y, moved: true };
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
    this.cleanupFns.push(() => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    });
  }

  private handleTap(sx: number, sy: number) {
    const x = (sx - this.world.x) / this.zoom;
    const y = (sy - this.world.y) / this.zoom;

    if (this.state.mode === "view") {
      // primeiro, prédios altos (o toque pode cair no telhado)
      let best: { idx: number; z: number } | null = null;
      for (const [idx, { sprite, house }] of this.houseSprites) {
        const lot = this.layout.lots[idx];
        const left = this.wx(lot.row + 1, lot.col);
        const right = this.wx(lot.row, lot.col + 1);
        const top = this.wy(lot.row, lot.col) - LABEL_HEIGHT[house.type] + 4;
        const bottom = this.wy(lot.row + 1, lot.col + 1);
        if (x >= left && x <= right && y >= top && y <= bottom && (!best || sprite.zIndex > best.z))
          best = { idx, z: sprite.zIndex };
      }
      const h = this.layout.cityHall;
      const inHall =
        x >= this.wx(h.row + 2, h.col) &&
        x <= this.wx(h.row, h.col + 2) &&
        y >= this.wy(h.row, h.col) - 40 &&
        y <= this.wy(h.row + 2, h.col + 2);
      if (inHall && (!best || this.hallSprite.zIndex > best.z)) return this.callbacks.onCityHallTap();
      if (best) return this.callbacks.onLotTap(best.idx, true);
    }

    // depois, o chão
    const X = (x - this.ox) / (TW / 2);
    const Y = y / (TH / 2);
    const c = Math.floor((X + Y) / 2);
    const r = Math.floor((Y - X) / 2);
    const lotIdx = this.lotByTile.get(r * this.layout.width + c);
    if (lotIdx != null && c >= 0 && c < this.layout.width) {
      const occupied = this.state.houses.some((hh) => hh.lotIndex === lotIdx);
      return this.callbacks.onLotTap(lotIdx, occupied);
    }
    const h = this.layout.cityHall;
    if (r >= h.row && r < h.row + h.size && c >= h.col && c < h.col + h.size) return this.callbacks.onCityHallTap();
    this.callbacks.onEmptyTap();
  }
}
