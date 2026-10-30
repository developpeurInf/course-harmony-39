/** Registre des scènes de physique, chimie et SVT (renvoie un message d'erreur éventuel) */
import type { Builder } from "./buildScene";
import type { Params } from "./templates";
import * as P from "./sciencePhysics";
import * as C from "./scienceChem";
import * as S from "./scienceSvt";

type Fn = (B: Builder, p: Params) => string | void;
export const SCIENCE_BUILDERS: Record<string, Fn> = {
  pendulum: P.pendulum, spring: P.spring, projectile: P.projectile, fall: P.fall, orbit: P.orbit, wave: P.wave,
  lens: P.lens, dispersion: P.dispersion, magnet: P.magnet, incline: P.incline, lever: P.lever, rc: P.rc, rlc: P.rlc,
  decay: P.decay, gas: P.gas,
  molecule: C.molecule, atom: C.atom, crystal: C.crystal, titration: C.titration, kinetics: C.kinetics, electrochem: C.electrochem,
  cell: S.cell, organelle: S.organelle, dna: S.dna, division: S.division, punnett: S.punnett, neuron: S.neuron,
  geology: S.geology, ecopyramid: S.ecopyramid, flower: S.flower,
};
