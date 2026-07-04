// A three-phase load at a terminal node. Motor / realPower / apparentPower
// are constant-power (current rises as voltage sags — the conservative case
// for voltage-drop work). lockedRotor is constant-impedance (current falls
// as voltage sags — a stalled rotor), used by the motor-start analysis.

import { SQRT3 } from './constants.js';

const Kind = Object.freeze({
  motor: 'motor',
  realPower: 'realPower',
  apparentPower: 'apparentPower',
  lockedRotor: 'lockedRotor',
});

export class Load {
  constructor(kind, params) {
    this.kind = kind;
    Object.assign(this, params);
  }

  /** Mechanical HP: I = (HP·746) / (η·√3·V·PF). */
  static motor(hp, efficiency, powerFactor) {
    return new Load(Kind.motor, { hp, efficiency, powerFactor });
  }

  /** Active kW: I = (kW·1000) / (√3·V·PF). */
  static realPower(kW, powerFactor) {
    return new Load(Kind.realPower, { kW, powerFactor });
  }

  /** Apparent kVA: I = (kVA·1000) / (√3·V). PF sets phase, not magnitude. */
  static apparentPower(kVA, powerFactor) {
    return new Load(Kind.apparentPower, { kVA, powerFactor });
  }

  /** Locked-rotor inrush (constant impedance): I = amps·(V/V_rated). */
  static lockedRotor(amps, ratedVoltageLL, powerFactor) {
    return new Load(Kind.lockedRotor, { amps, ratedVoltageLL, powerFactor });
  }

  /**
   * Line current magnitude (A) at a terminal line-to-line voltage. Returns 0
   * for non-positive voltage or nameplate (avoids divide-by-zero / NaN).
   */
  currentMagnitude(atTerminalVoltageLL) {
    const v = atTerminalVoltageLL;
    if (!(v > 0 && Number.isFinite(v))) return 0;
    switch (this.kind) {
      case Kind.motor:
        if (!(this.hp > 0) || !(this.efficiency > 0) || !(this.powerFactor > 0)) return 0;
        return (this.hp * 746.0) / (this.efficiency * SQRT3 * v * this.powerFactor);
      case Kind.realPower:
        if (!(this.kW > 0) || !(this.powerFactor > 0)) return 0;
        return (this.kW * 1000.0) / (SQRT3 * v * this.powerFactor);
      case Kind.apparentPower:
        if (!(this.kVA > 0)) return 0;
        return (this.kVA * 1000.0) / (SQRT3 * v);
      case Kind.lockedRotor:
        if (!(this.amps > 0) || !(this.ratedVoltageLL > 0)) return 0;
        return this.amps * (v / this.ratedVoltageLL);
      default:
        return 0;
    }
  }
}

export { Kind as LoadKind };
