import { useEffect, useRef } from "react";
import p5 from "p5";
import { createDeepSeaModel, stepDeepSeaModel, type DeepSeaModel } from "./model";

export type DeepSeaProps = {
  seed: number;
  currentStrength: number;
  encounterDensity: number;
  texture: number;
  paused: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function DeepSeaSketch({ seed, currentStrength, encounterDensity, texture, paused }: DeepSeaProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const valuesRef = useRef({ seed, currentStrength, encounterDensity, texture, paused });
  useEffect(() => { valuesRef.current = { seed, currentStrength, encounterDensity, texture, paused }; }, [seed, currentStrength, encounterDensity, texture, paused]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let model: DeepSeaModel = createDeepSeaModel(seed, encounterDensity);
    let previousSeed = seed;
    let sketch: p5;
    const instance = (p: p5) => {
      let rng = () => 0;
      let visualSeed = seed >>> 0;
      const resetArtRandom = () => {
        let state = visualSeed || 0x6d2b79f5;
        rng = () => {
          state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
          return (state >>> 0) / 0x1_0000_0000;
        };
      };
      const drawPencilLine = (x1: number, y1: number, x2: number, y2: number, color: string, weight: number, passes = 3) => {
        p.noFill(); p.stroke(color); p.strokeWeight(weight);
        for (let i = 0; i < passes; i += 1) {
          const wobble = (rng() - .5) * weight * .8;
          p.line(x1 + wobble, y1 + wobble, x2 - wobble, y2 + wobble);
        }
      };
      const scribble = (x: number, y: number, length: number, angle: number, color: string, weight: number, count: number) => {
        p.noFill(); p.stroke(color); p.strokeWeight(weight); p.strokeCap(p.ROUND);
        for (let pass = 0; pass < count; pass += 1) {
          const offset = (pass - count / 2) * weight * .72;
          const x1 = x + Math.cos(angle + Math.PI / 2) * offset;
          const y1 = y + Math.sin(angle + Math.PI / 2) * offset;
          const bend = (rng() - .5) * 12;
          p.beginShape(); p.vertex(x1, y1);
          p.quadraticVertex(x1 + Math.cos(angle) * length * .48 + bend, y1 + Math.sin(angle) * length * .48 - bend, x1 + Math.cos(angle) * length, y1 + Math.sin(angle) * length);
          p.endShape();
        }
      };

      p.setup = () => {
        const rect = host.getBoundingClientRect();
        p.createCanvas(Math.max(1, rect.width), Math.max(1, rect.height));
        p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
        p.frameRate(30);
        p.noiseSeed(seed);
      };
      p.draw = () => {
        const settings = valuesRef.current;
        if (settings.seed !== previousSeed) { model = createDeepSeaModel(settings.seed, settings.encounterDensity); previousSeed = settings.seed; visualSeed = settings.seed >>> 0; p.noiseSeed(settings.seed); }
        // Pencil grain and contour wobble stay fixed between frames; only the creatures move.
        resetArtRandom();
        const w = p.width; const h = p.height; const unit = Math.min(w, h);
        const dt = Math.min(.04, p.deltaTime / 1000);
        if (!settings.paused) stepDeepSeaModel(model, dt, settings.currentStrength, settings.encounterDensity);
        p.background(29, 18, 62);
        // Directional violet graphite marks suggest a water column with a prevailing current.
        p.push(); p.blendMode(p.BLEND);
        for (let i = 0; i < 31; i += 1) {
          const y = ((i * 67 + 20) % (h + 90)) - 35;
          const x = ((i * 113 + 17) % (w + 100)) - 40;
          const drift = Math.sin(model.time * .12 + i) * 8;
          scribble(x + drift, y, unit * (.12 + (i % 4) * .018), -.19, i % 3 ? "rgba(127,94,174,0.10)" : "rgba(91,72,147,0.13)", 1.1, 2);
        }
        // A quiet low-frequency current field gives the drawing an ecological direction.
        for (let i = 0; i < 9; i += 1) {
          const y = h * (.22 + i * .075);
          p.noFill(); p.stroke("rgba(125,180,185,0.055)"); p.strokeWeight(1);
          p.bezier(-w * .08, y - 15, w * .3, y + 24, w * .7, y - 26, w * 1.08, y + 7);
        }
        p.pop();

        // Detrital material settles and streams together; prey distributions cluster around these patches.
        model.detritus.forEach((patch, index) => {
          const x = patch.x * w; const y = patch.y * h;
          for (let j = 0; j < 9; j += 1) {
            const sway = Math.sin(model.time * .18 + j + index) * unit * .009;
            const px = x + sway + (j - 4) * unit * .008;
            const py = y + j * unit * .009;
            p.noStroke(); p.fill(j % 3 ? "rgba(140,185,168,0.26)" : "rgba(241,177,103,0.28)");
            p.ellipse(px, py, unit * (.003 + j % 2 * .001), unit * (.005 + j % 3 * .001));
          }
          scribble(x, y, unit * .09, .18, "rgba(176,164,153,0.14)", 1, 2);
        });
        model.squids.forEach((squid) => {
          const x = squid.x * w; const y = squid.y * h; const s = squid.size * unit;
          const pulse = Math.sin(squid.phase * .48);
          const tint = squid.tint === 196 ? [139, 207, 238] : [194, 151, 226];
          const ink = (alpha: number) => `rgba(${tint[0]},${tint[1]},${tint[2]},${alpha})`;
          // Large translucent squid silhouettes sit at the edge of the composition, like passing depth.
          p.noStroke(); p.fill(ink(.07)); p.ellipse(x, y, s * .86, s * 2.2);
          p.stroke(ink(.64)); p.strokeWeight(1.5); p.fill(ink(.14));
          p.beginShape(); p.vertex(x, y - s * 1.16); p.bezierVertex(x + s * .47, y - s * .72, x + s * .38, y + s * .28, x, y + s * .62); p.bezierVertex(x - s * .38, y + s * .28, x - s * .47, y - s * .72, x, y - s * 1.16); p.endShape(p.CLOSE);
          p.noFill(); p.stroke(ink(.6)); p.strokeWeight(1.1);
          p.bezier(x - s * .14, y + s * .5, x - s * .43, y + s * .93, x - s * .26 + pulse * s * .08, y + s * 1.5, x - s * .52, y + s * 2.05);
          p.bezier(x - s * .04, y + s * .54, x - s * .08, y + s * 1.06, x + s * .1 + pulse * s * .06, y + s * 1.45, x + s * .02, y + s * 2.16);
          p.bezier(x + s * .08, y + s * .52, x + s * .35, y + s * .92, x + s * .26 - pulse * s * .06, y + s * 1.52, x + s * .48, y + s * 2.0);
          p.stroke(ink(.36)); p.strokeWeight(.75); p.line(x - s * .13, y - s * .8, x, y + s * .42); p.line(x + s * .13, y - s * .8, x, y + s * .42);
          p.noStroke(); p.fill("rgba(246,204,170,0.58)");
          for (let spot = 0; spot < 11; spot += 1) {
            const spotY = y - s * .58 + spot * s * .09;
            const halfWidth = s * .34 * Math.sin((spot + 2) / 13 * Math.PI);
            p.ellipse(x + Math.sin(spot * 8.7 + squid.phase) * halfWidth, spotY, 1.5, 1.5);
          }
          p.noFill(); p.stroke(ink(.65)); p.strokeWeight(1); p.arc(x + s * .17, y + s * .34, s * .18, s * .15, 0, p.PI);
        });
        // Sparse marine snow shares the flow, with finer particles to preserve negative space.
        for (let i = 0; i < 42; i += 1) {
          const phase = model.time * (.04 + (i % 5) * .009) + i * 7.31;
          const x = ((i * 173 + Math.sin(phase) * 22 + w) % w);
          const y = ((i * 239 + phase * unit * .16 + h) % h);
          p.noStroke(); p.fill(i % 7 ? "rgba(193,201,208,0.34)" : "rgba(252,200,121,0.5)");
          p.ellipse(x, y, i % 8 === 0 ? 2.1 : 1.2, i % 8 === 0 ? 2.1 : 1.2);
        }
        model.prey.forEach((particle) => {
          if (!particle.alive) return;
          const x = particle.x * w; const y = particle.y * h; const s = particle.size * unit / 390;
          p.noStroke(); p.fill("rgba(253,203,142,0.72)"); p.ellipse(x, y, s * 2, s * 1.45);
          p.stroke("rgba(252,232,189,0.43)"); p.strokeWeight(.7); p.line(x - s * 2, y + s, x - s * 3.5, y + s * 1.7);
        });

        model.jellies.forEach((jelly) => {
          const x = jelly.x * w; const y = jelly.y * h; const s = jelly.size * unit;
          const pulse = .9 + Math.max(0, Math.sin(jelly.phase)) * .16;
          const hueColor = jelly.hue === 315 ? [237, 117, 215] : jelly.hue === 48 ? [255, 202, 108] : jelly.hue === 198 ? [103, 222, 223] : [158, 142, 255];
          const color = (alpha: number) => `rgba(${hueColor[0]},${hueColor[1]},${hueColor[2]},${alpha})`;
          // Glow appears only around the living bell and its pulse.
          p.noStroke(); p.fill(color(.06)); p.ellipse(x, y, s * 2.6 * pulse, s * 2.1 * pulse);
          p.stroke(color(.88)); p.strokeWeight(1.5); p.fill(color(.2));
          p.beginShape(); p.vertex(x - s, y); p.bezierVertex(x - s * .93, y - s * .98, x + s * .88, y - s * .98, x + s, y); p.bezierVertex(x + s * .68, y + s * .3, x - s * .72, y + s * .32, x - s, y); p.endShape(p.CLOSE);
          p.noFill(); p.stroke(color(.53)); p.strokeWeight(.8);
          for (let rib = -2; rib <= 2; rib += 1) p.arc(x + rib * s * .25, y, s * .52, s * .8, p.PI, p.TWO_PI);
          for (let tentacle = -2; tentacle <= 2; tentacle += 1) {
            const tx = x + tentacle * s * .33; const length = s * (1.5 + .45 * Math.sin(jelly.phase + tentacle));
            const lag = Math.sin(jelly.phase * .74 + tentacle * 1.7) * s * .22;
            p.stroke(color(.65)); p.strokeWeight(tentacle === 0 ? 1.2 : .8); p.noFill();
            p.bezier(tx, y + s * .17, tx + lag, y + length * .32, tx - lag * .7, y + length * .68, tx + lag, y + length);
            if (tentacle === 0) { p.stroke(color(.32)); p.strokeWeight(.65); p.line(tx, y + s * .25, tx + lag * .6, y + length * .9); }
          }
          p.noStroke(); p.fill(color(.86)); p.ellipse(x, y - s * .16, s * .12, s * .12);
        });

        // Small dumbo-like octopuses drift between the larger forms, each with independently lagging arms.
        model.octopuses.forEach((octopus) => drawOctopus(p, octopus, w, h, unit));
        model.sharks.forEach((shark) => drawShark(p, shark, w, h, unit));
        drawBabyWhale(p, model.whale, w, h, unit, scribble, drawPencilLine);

        drawAngler(p, model, w, h, unit, scribble, drawPencilLine);
        // Fine texture is an adjustable material treatment, kept off the darkest open water.
        const grainCount = Math.round(clamp(settings.texture, 0, 1) * 430);
        for (let i = 0; i < grainCount; i += 1) {
          const x = rng() * w; const y = rng() * h;
          p.noStroke(); p.fill(i % 3 ? "rgba(247,207,179,0.09)" : "rgba(126,205,207,0.10)"); p.ellipse(x, y, .7, 1.4);
        }
      };
      p.windowResized = () => {
        const rect = host.getBoundingClientRect(); p.resizeCanvas(Math.max(1, rect.width), Math.max(1, rect.height));
      };
    };
    sketch = new p5(instance, host);
    const observer = new ResizeObserver(() => {
      const rect = host.getBoundingClientRect(); sketch.resizeCanvas(Math.max(1, rect.width), Math.max(1, rect.height));
    });
    observer.observe(host);
    return () => { observer.disconnect(); sketch.remove(); };
  }, []);

  return <div ref={hostRef} className="deepsea-sketch" aria-label="A living deep sea ecology illustration" style={{ width: "100%", height: "100%", overflow: "hidden" }} />;
}

function drawAngler(
  p: p5,
  model: DeepSeaModel,
  w: number,
  h: number,
  unit: number,
  scribble: (x: number, y: number, length: number, angle: number, color: string, weight: number, count: number) => void,
  pencil: (x1: number, y1: number, x2: number, y2: number, color: string, weight: number, passes?: number) => void,
) {
  const fish = model.angler; const x = fish.x * w; const y = fish.y * h; const s = unit * .26;
  const breathe = 1 + Math.sin(fish.phase * .7) * .012;
  p.push(); p.translate(x, y); p.scale(fish.facing * breathe, breathe);
  // Tapered fins and tail create one readable silhouette before the interior pencil marks.
  p.noStroke(); p.fill("rgba(13,13,43,0.54)"); p.ellipse(0, s * .12, s * 2.32, s * 1.44);
  p.fill("rgba(28,22,69,0.94)"); p.stroke("rgba(121,102,186,0.9)"); p.strokeWeight(2);
  p.beginShape(); p.vertex(-s * .65, -s * .08); p.vertex(-s * 1.55, -s * .7); p.vertex(-s * 1.35, s * .28); p.vertex(-s * 1.65, s * .77); p.vertex(-s * .54, s * .5); p.endShape(p.CLOSE);
  p.fill("rgba(52,30,91,0.98)"); p.beginShape(); p.vertex(-s * .28, -s * .42); p.bezierVertex(s * .1, -s * 1.02, s * .9, -s * .95, s * 1.02, -s * .39); p.bezierVertex(s * 1.49, -s * .16, s * 1.45, s * .36, s * .95, s * .49); p.bezierVertex(s * .43, s * .83, -s * .34, s * .55, -s * .63, s * .27); p.endShape(p.CLOSE);
  // Lower jaw and tooth comb remain visible in the small mobile composition.
  p.fill("rgba(37,24,73,0.98)"); p.beginShape(); p.vertex(s * .55, s * .26); p.quadraticVertex(s * .97, s * .72, s * 1.3, s * .27); p.vertex(s * 1.05, s * .1); p.endShape(p.CLOSE);
  p.stroke("rgba(196,174,231,0.9)"); p.strokeWeight(1.25);
  for (let tooth = 0; tooth < 7; tooth += 1) { const tx = s * (.65 + tooth * .092); p.line(tx, s * .23, tx - s * .03, s * (.35 + (tooth % 2) * .03)); }
  // Head and flank hatching: repeated imperfect strokes make the creature read as colored pencil.
  for (let hatch = 0; hatch < 9; hatch += 1) {
    const hx = -s * .48 + hatch * s * .12;
    pencil(hx, -s * .35, hx + s * .11, s * .13, hatch % 2 ? "rgba(165,119,220,0.48)" : "rgba(243,144,197,0.34)", 1, 2);
  }
  for (let fin = 0; fin < 7; fin += 1) pencil(-s * (.58 + fin * .1), s * .23, -s * (.82 + fin * .1), s * (.54 + fin * .03), "rgba(134,193,208,0.48)", 1.1, 2);
  p.noFill(); p.stroke("rgba(237,163,205,0.72)"); p.strokeWeight(1.2); p.arc(s * .36, -s * .14, s * 1.12, s * .62, p.PI * 1.08, p.PI * 1.84);
  p.noStroke(); p.fill("rgba(246,211,159,0.98)"); p.ellipse(s * .73, -s * .19, s * .095, s * .095);
  p.fill("rgba(13,10,34,0.94)"); p.ellipse(s * .75, -s * .19, s * .04, s * .06);
  p.pop();

  // The arched lure sways with a slow lag; its point light is the main luminous cue.
  const lureX = x + fish.facing * s * .28; const lureY = y - s * .4;
  const sway = Math.sin(fish.phase * .54) * s * .2;
  const tipX = x + fish.facing * s * .05 + sway;
  const tipY = y - s * 1.64 + Math.sin(fish.phase * .36) * s * .09;
  p.noFill(); p.stroke("rgba(197,162,216,0.92)"); p.strokeWeight(2.1);
  p.bezier(lureX, lureY, lureX + fish.facing * s * .08, y - s * 1.06, tipX - fish.facing * s * .42, tipY - s * .1, tipX, tipY);
  p.stroke("rgba(230,190,224,0.44)"); p.strokeWeight(.75); p.bezier(lureX + 2, lureY, lureX + fish.facing * s * .1, y - s * 1.04, tipX - fish.facing * s * .38, tipY - s * .08, tipX + 1, tipY);
  const glow = fish.resting > 0 ? .62 : .88;
  p.noStroke(); p.fill(`rgba(255,198,117,${glow * .11})`); p.ellipse(tipX, tipY, s * .47, s * .47);
  p.fill(`rgba(255,202,124,${glow})`); p.ellipse(tipX, tipY, s * .105, s * .14);
  p.fill("rgba(255,240,194,0.92)"); p.ellipse(tipX - 1, tipY - 1, s * .035, s * .045);
  scribble(x - s * .7, y + s * .45, s * .25, .52, "rgba(94,197,194,0.28)", 1, 2);
}

function drawOctopus(p: p5, octopus: DeepSeaModel["octopuses"][number], w: number, h: number, unit: number) {
  const x = octopus.x * w; const y = octopus.y * h; const s = octopus.size * unit;
  const phase = octopus.phase;
  const palette = octopus.tint === 306 ? [242, 132, 218] : octopus.tint === 48 ? [244, 193, 124] : octopus.tint === 200 ? [119, 217, 218] : [183, 155, 248];
  const ink = (alpha: number) => `rgba(${palette[0]},${palette[1]},${palette[2]},${alpha})`;
  p.noStroke(); p.fill(ink(.12)); p.ellipse(x, y + s * .12, s * 2.8, s * 2.9);
  p.stroke(ink(.82)); p.strokeWeight(1.05); p.fill(ink(.34));
  p.beginShape(); p.vertex(x - s * .62, y - s * .04); p.bezierVertex(x - s * .95, y - s * .78, x + s * .92, y - s * .8, x + s * .62, y - s * .04); p.quadraticVertex(x, y + s * .42, x - s * .62, y - s * .04); p.endShape(p.CLOSE);
  // Dumbo fins flutter beside the mantle while eight short arms curl below it.
  p.fill(ink(.3)); p.beginShape(); p.vertex(x - s * .52, y - s * .32); p.bezierVertex(x - s * 1.38, y - s * .8 + Math.sin(phase) * s * .1, x - s * 1.23, y - s * .04, x - s * .55, y + s * .03); p.endShape(p.CLOSE);
  p.beginShape(); p.vertex(x + s * .52, y - s * .32); p.bezierVertex(x + s * 1.38, y - s * .8 + Math.sin(phase + 1) * s * .1, x + s * 1.23, y - s * .04, x + s * .55, y + s * .03); p.endShape(p.CLOSE);
  p.noFill(); p.stroke(ink(.83)); p.strokeWeight(.78);
  for (let arm = 0; arm < 8; arm += 1) {
    const side = arm < 4 ? -1 : 1; const lane = arm % 4;
    const startX = x + (lane - 1.5) * s * .23;
    const length = s * (.52 + lane * .11);
    const curl = Math.sin(phase * .8 + arm * 1.4) * s * .22;
    const endX = startX + side * (s * .12 + Math.abs(lane - 1.5) * s * .12) + curl;
    const endY = y + length;
    p.bezier(startX, y + s * .18, startX + curl * .35, y + length * .44, endX - curl * .4, endY - s * .08, endX + curl, endY);
    p.noStroke(); p.fill(ink(.62));
    for (let sucker = 1; sucker <= 3; sucker += 1) p.ellipse(startX + (endX - startX) * sucker / 4, y + s * .18 + length * sucker / 4, 1.1, 1.1);
    p.noFill(); p.stroke(ink(.83));
  }
  p.noStroke(); p.fill("rgba(255,231,206,0.92)"); p.ellipse(x - s * .2, y - s * .13, s * .15, s * .15); p.ellipse(x + s * .2, y - s * .13, s * .15, s * .15);
  p.fill("rgba(34,20,56,0.95)"); p.ellipse(x - s * .2, y - s * .13, s * .07, s * .085); p.ellipse(x + s * .2, y - s * .13, s * .07, s * .085);
}

function drawBabyWhale(
  p: p5,
  whale: DeepSeaModel["whale"],
  w: number,
  h: number,
  unit: number,
  scribble: (x: number, y: number, length: number, angle: number, color: string, weight: number, count: number) => void,
  pencil: (x1: number, y1: number, x2: number, y2: number, color: string, weight: number, passes?: number) => void,
) {
  const x = whale.x * w; const y = whale.y * h; const s = whale.size * unit;
  const bob = Math.sin(whale.phase * .7) * s * .018;
  // A pale watercolor pocket separates the baby from the dark water without making it glow.
  p.noStroke(); p.fill("rgba(137,197,226,0.075)"); p.ellipse(x, y + bob, s * 4.0, s * 2.48);
  scribble(x - s * 1.45, y + s * .35 + bob, s * 1.0, .08, "rgba(111,206,219,0.3)", 1.5, 3);
  scribble(x + s * 1.0, y - s * .56 + bob, s * .74, .03, "rgba(240,157,191,0.25)", 1.3, 2);

  p.push(); p.translate(x, y + bob); p.scale(1 + Math.sin(whale.phase * .7) * .008, 1);
  // Tail sits left; broad forehead and short snout make the juvenile whale friendly and unmistakable.
  p.noStroke(); p.fill("rgba(103,132,199,0.26)"); p.ellipse(0, s * .12, s * 2.92, s * 1.87);
  p.stroke("rgba(62,79,142,0.94)"); p.strokeWeight(2.4); p.fill("rgba(194,207,244,0.98)");
  p.beginShape();
  p.vertex(-s * 1.13, -s * .14);
  p.bezierVertex(-s * 1.04, -s * .86, -s * .4, -s * 1.02, s * .35, -s * .84);
  p.bezierVertex(s * .87, -s * .77, s * 1.06, -s * .44, s * 1.35, -s * .33);
  p.bezierVertex(s * 1.7, -s * .22, s * 1.67, s * .04, s * 1.42, s * .19);
  p.bezierVertex(s * 1.14, s * .34, s * .65, s * .28, s * .3, s * .48);
  p.bezierVertex(-s * .27, s * .69, -s * .87, s * .45, -s * 1.13, -s * .14);
  p.endShape(p.CLOSE);
  // Cream belly patch, tail flukes, and fins use separate shapes so the contour reads at phone size.
  p.noStroke(); p.fill("rgba(255,235,214,0.98)");
  p.beginShape(); p.vertex(-s * .78, s * .29); p.bezierVertex(-s * .38, s * .48, s * .24, s * .35, s * .72, s * .22); p.bezierVertex(s * .27, s * .65, -s * .35, s * .72, -s * .78, s * .29); p.endShape(p.CLOSE);
  p.stroke("rgba(62,79,142,0.94)"); p.strokeWeight(2); p.fill("rgba(164,184,232,0.98)");
  p.beginShape(); p.vertex(-s * 1.1, -s * .08); p.bezierVertex(-s * 1.55, -s * .36, -s * 1.65, -s * .52, -s * 1.83, -s * .44); p.vertex(-s * 1.72, -s * .17); p.bezierVertex(-s * 1.83, s * .01, -s * 1.71, s * .19, -s * 1.51, s * .14); p.vertex(-s * 1.1, s * .2); p.endShape(p.CLOSE);
  p.fill("rgba(160,181,234,0.98)"); p.beginShape(); p.vertex(s * .05, s * .29); p.bezierVertex(-s * .2, s * .79, -s * .66, s * .78, -s * .76, s * .61); p.bezierVertex(-s * .39, s * .56, -s * .13, s * .39, s * .05, s * .29); p.endShape(p.CLOSE);
  p.fill("rgba(178,193,239,0.98)"); p.beginShape(); p.vertex(s * .46, -s * .72); p.quadraticVertex(s * .55, -s * .99, s * .83, -s * .81); p.quadraticVertex(s * .65, -s * .75, s * .46, -s * .72); p.endShape(p.CLOSE);
  // Rose cheeks and soft snout dots, then a big friendly eye and curved smile.
  p.noStroke(); p.fill("rgba(244,151,174,0.52)"); p.ellipse(s * .99, -s * .18, s * .24, s * .14);
  p.fill("rgba(250,192,189,0.82)"); p.ellipse(s * .96, -s * .31, s * .035, s * .035); p.ellipse(s * 1.14, -s * .26, s * .03, s * .03);
  p.fill("rgba(255,249,229,1)"); p.ellipse(s * .78, -s * .42, s * .25, s * .28);
  p.fill("rgba(47,47,80,1)"); p.ellipse(s * .81, -s * .42, s * .105, s * .14);
  p.fill("rgba(255,255,242,1)"); p.ellipse(s * .83, -s * .46, s * .036, s * .04);
  p.noFill(); p.stroke("rgba(69,67,111,0.95)"); p.strokeWeight(2); p.arc(s * 1.21, -s * .02, s * .25, s * .19, .12, p.PI * .76);
  // Fine broken contours and blue/rose pencil hatch keep the pale fill tactile.
  p.noFill(); p.stroke("rgba(255,250,230,0.74)"); p.strokeWeight(1.2); p.arc(-s * .05, -s * .13, s * 1.58, s * 1.13, p.PI * 1.04, p.PI * 1.76);
  for (let stroke = 0; stroke < 7; stroke += 1) {
    const hx = -s * .45 + stroke * s * .14;
    pencil(hx, -s * .58, hx + s * .12, -s * .22, stroke % 2 ? "rgba(104,140,203,0.46)" : "rgba(246,149,177,0.35)", 1.1, 2);
  }
  pencil(-s * .29, s * .47, -s * .1, s * .31, "rgba(176,132,164,0.4)", 1, 2);
  p.pop();

  // A little stern pole carries a flag bearing the baby's straw hat emblem.
  const poleX = x - s * .28; const poleY = y - s * .78 + bob;
  p.stroke("rgba(91,69,105,0.92)"); p.strokeWeight(1.8); p.line(poleX, poleY, poleX - s * .02, poleY - s * .56);
  p.stroke("rgba(255,221,151,0.88)"); p.strokeWeight(.9); p.noFill(); p.line(poleX + 1, poleY - s * .49, poleX + s * .42, poleY - s * .39);
  p.noStroke(); p.fill("rgba(192,74,100,0.96)");
  p.beginShape(); p.vertex(poleX + 1, poleY - s * .49); p.vertex(poleX + s * .43, poleY - s * .4); p.vertex(poleX + s * .34, poleY - s * .16); p.vertex(poleX + 1, poleY - s * .22); p.endShape(p.CLOSE);
  p.fill("rgba(241,195,113,1)"); p.ellipse(poleX + s * .19, poleY - s * .34, s * .2, s * .07);
  p.fill("rgba(209,157,86,1)"); p.rect(poleX + s * .1, poleY - s * .39, s * .18, s * .04, s * .02);
  p.fill("rgba(190,64,79,1)"); p.rect(poleX + s * .11, poleY - s * .355, s * .16, s * .025);
}

function drawShark(p: p5, shark: DeepSeaModel["sharks"][number], w: number, h: number, unit: number) {
  const x = shark.x * w; const y = shark.y * h; const s = shark.size * unit;
  p.push(); p.translate(x, y); p.scale(shark.facing, 1);
  p.noStroke(); p.fill("rgba(139,163,193,0.9)");
  p.beginShape(); p.vertex(-s * .72, 0); p.vertex(-s * 1.14, -s * .31); p.vertex(-s * 1.08, s * .26); p.vertex(-s * .7, s * .16);
  p.bezierVertex(-s * .53, -s * .27, s * .42, -s * .29, s * .75, -s * .06); p.vertex(s * 1.13, -s * .12); p.vertex(s * .87, s * .06); p.bezierVertex(s * .5, s * .3, -s * .35, s * .29, -s * .72, 0); p.endShape(p.CLOSE);
  p.fill("rgba(111,139,175,0.96)"); p.beginShape(); p.vertex(-s * .16, -s * .2); p.vertex(s * .03, -s * .62); p.vertex(s * .29, -s * .16); p.endShape(p.CLOSE);
  p.beginShape(); p.vertex(-s * .38, s * .15); p.vertex(-s * .08, s * .51); p.vertex(s * .2, s * .18); p.endShape(p.CLOSE);
  p.stroke("rgba(67,88,124,0.74)"); p.strokeWeight(.9); p.line(s * .41, -s * .03, s * .5, s * .08);
  p.noStroke(); p.fill("rgba(255,244,219,0.96)"); p.ellipse(s * .48, -s * .12, s * .12, s * .12);
  p.fill("rgba(40,52,74,0.98)"); p.ellipse(s * .5, -s * .12, s * .058, s * .065);
  p.pop();
}

