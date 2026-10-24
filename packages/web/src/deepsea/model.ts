export type Vec = { x: number; y: number };

export type Prey = Vec & { drift: number; phase: number; size: number; alive: boolean };
export type Jelly = Vec & { phase: number; drift: number; size: number; hue: number; pulse: number };
export type Angler = Vec & { phase: number; facing: -1 | 1; resting: number; hunger: number };
export type Octopus = Vec & { phase: number; drift: number; size: number; tint: number };
export type Squid = Vec & { phase: number; drift: number; size: number; tint: number };
export type Whale = Vec & { phase: number; drift: number; size: number };
export type Shark = Vec & { phase: number; drift: number; size: number; facing: -1 | 1 };
export type DeepSeaModel = { rng: () => number; prey: Prey[]; jellies: Jelly[]; octopuses: Octopus[]; squids: Squid[]; sharks: Shark[]; whale: Whale; angler: Angler; detritus: Vec[]; time: number };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** A compact deterministic ecology vignette. Positions and velocities are normalized to the canvas. */
export function createDeepSeaModel(seed: number, encounterDensity: number): DeepSeaModel {
  let state = (seed >>> 0) || 0x6d2b79f5;
  const rng = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
  const count = Math.round(9 + clamp(encounterDensity, 0, 1) * 19);
  const angler: Angler = { x: .54, y: .79, phase: rng() * 6, facing: -1, resting: 0, hunger: .72 };
  const detritus = Array.from({ length: 5 }, (_, index) => ({ x: .16 + rng() * .67, y: .27 + rng() * .56 + index * .012 }));
  const prey = Array.from({ length: count }, (_, index) => {
    const patch = detritus[index % detritus.length];
    return { x: clamp(patch.x + (rng() - .5) * .26, .06, .94), y: clamp(patch.y + (rng() - .5) * .2, .1, .9), drift: .012 + rng() * .022, phase: rng() * 20, size: 1.4 + rng() * 2.7, alive: true };
  });
  const jellies = Array.from({ length: 4 }, (_, index) => ({ x: .16 + rng() * .68, y: .16 + index * .105 + rng() * .04, phase: rng() * 6, drift: .006 + rng() * .01, size: .045 + rng() * .023, hue: [178, 315, 48, 198][index], pulse: .7 + rng() * .3 }));
  const octopusCount = 9 + Math.round(clamp(encounterDensity, 0, 1) * 5);
  const octopuses = Array.from({ length: octopusCount }, (_, index) => ({ x: .08 + rng() * .84, y: .2 + rng() * .68, phase: rng() * 6, drift: .006 + rng() * .012, size: .022 + rng() * .014, tint: [180, 306, 48, 200][index % 4] }));
  const squids = Array.from({ length: 2 }, (_, index) => ({ x: index === 0 ? .86 : .13, y: .48 + rng() * .12, phase: rng() * 6, drift: .003 + rng() * .004, size: .37 + rng() * .09, tint: index === 0 ? 196 : 285 }));
  const whale: Whale = { x: .48, y: .45, phase: rng() * 6, drift: .0025 + rng() * .002, size: .137 + rng() * .014 };
  const sharks = [
    { x: .16 + rng() * .08, y: .29 + rng() * .05 },
    { x: .76 + rng() * .08, y: .34 + rng() * .04 },
    { x: .79 + rng() * .08, y: .76 + rng() * .04 },
  ].map((position) => ({ ...position, phase: rng() * 6, drift: .008 + rng() * .008, size: .024 + rng() * .009, facing: (rng() > .5 ? 1 : -1) as -1 | 1 }));
  return { rng, prey, jellies, octopuses, squids, sharks, whale, angler, detritus, time: 0 };
}

export function stepDeepSeaModel(model: DeepSeaModel, dt: number, currentStrength: number, encounterDensity: number) {
  const step = clamp(dt, 0, .04);
  const current = clamp(currentStrength, 0, 1);
  const a = model.angler;
  model.time += step;
  a.phase += step;
  a.resting = Math.max(0, a.resting - step);
  a.hunger = clamp(a.hunger + step * .008, 0, 1);
  // All particles share a slow diagonal current; local eddies perturb it without losing the flow.
  for (const mote of model.detritus) {
    mote.x += (current * .010) * step;
    mote.y += (current * .004 + Math.sin(model.time * .3 + mote.x * 8) * .002) * step;
    if (mote.x > 1.04) { mote.x = -.04; mote.y = .15 + model.rng() * .7; }
  }
  for (const jelly of model.jellies) {
    jelly.phase += step * (1.1 + jelly.pulse);
    jelly.x += Math.sin(jelly.phase * .29) * jelly.drift * step + current * .004 * step;
    jelly.y += (Math.sin(jelly.phase) * .006 - .001) * step;
    if (jelly.x > 1.08) jelly.x = -.08;
    jelly.y = clamp(jelly.y, .08, .9);
  }
  for (const creature of model.octopuses) {
    creature.phase += step * 1.3;
    creature.x += (Math.sin(creature.phase * .31) * creature.drift + current * .003) * step;
    creature.y += Math.cos(creature.phase * .54) * creature.drift * .6 * step;
    if (creature.x > 1.06) creature.x = -.06;
    creature.y = clamp(creature.y, .12, .9);
  }
  for (const squid of model.squids) {
    squid.phase += step * .7;
    squid.x += (Math.sin(squid.phase * .23) * squid.drift + current * .002) * step;
    squid.y += Math.cos(squid.phase * .31) * squid.drift * .45 * step;
    squid.y = clamp(squid.y, .24, .75);
  }
  model.whale.phase += step * .56;
  model.whale.x += Math.sin(model.whale.phase * .17) * model.whale.drift * step;
  model.whale.y += Math.sin(model.whale.phase * .29) * model.whale.drift * .32 * step;
  model.whale.y = clamp(model.whale.y, .44, .69);
  for (const shark of model.sharks) {
    shark.phase += step * 1.1;
    shark.x += shark.facing * shark.drift * step + current * .002 * step;
    shark.y += Math.sin(shark.phase * .35) * shark.drift * .5 * step;
    if (shark.x < .04 || shark.x > .96) shark.facing = shark.facing === 1 ? -1 : 1;
    shark.x = clamp(shark.x, .04, .96);
  }
  for (const particle of model.prey) {
    if (!particle.alive) continue;
    particle.phase += step;
    const dx = a.x - particle.x;
    const dy = a.y - particle.y;
    const distance = Math.hypot(dx, dy);
    // Small swimmers part gently around the whale's body as they follow the same current.
    const whaleDx = particle.x - model.whale.x;
    const whaleDy = particle.y - model.whale.y;
    const whaleDistance = Math.hypot(whaleDx, whaleDy);
    const wakeRadius = .19;
    const deflection = whaleDistance < wakeRadius && whaleDistance > 0 ? (1 - whaleDistance / wakeRadius) * .012 : 0;
    // Only prey inside the lure's local field orient toward it. Farther prey remain in their detritus patch.
    const lureRadius = .25 + a.hunger * .10;
    const attraction = distance < lureRadius ? (1 - distance / lureRadius) * (.018 + a.hunger * .014) : 0;
    particle.x += (current * .006 + Math.sin(particle.phase * .8) * particle.drift + (distance ? dx / distance * attraction : 0) + (whaleDistance ? whaleDx / whaleDistance * deflection : 0)) * step;
    particle.y += (current * .002 + Math.cos(particle.phase * .63) * particle.drift * .65 + (distance ? dy / distance * attraction : 0) + (whaleDistance ? whaleDy / whaleDistance * deflection : 0)) * step;
    if (particle.x > 1.04) { particle.x = -.03; particle.y = .15 + model.rng() * .7; }
    if (particle.x < -.04) particle.x = 1.02;
    if (distance < .047 && a.resting <= 0) {
      particle.alive = false;
      a.resting = 3.2;
      a.hunger = Math.max(0, a.hunger - .48);
    }
  }
  const wanted = Math.round(9 + clamp(encounterDensity, 0, 1) * 19);
  if (model.prey.filter((particle) => particle.alive).length < wanted && model.rng() < step * .14) {
    model.prey.push({ x: .04 + model.rng() * .92, y: .2 + model.rng() * .68, drift: .01 + model.rng() * .02, phase: model.rng() * 20, size: 1.4 + model.rng() * 2.7, alive: true });
  }
  if (Math.abs(a.x - .53) > .14) a.facing = a.x > .53 ? -1 : 1;
  a.x += (Math.sin(a.phase * .11) * .003) * step;
  a.y += (Math.sin(a.phase * .19) * .002) * step;
}
