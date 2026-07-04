// A length of cable with per-unit-length impedance at a reference
// temperature. Resistance is temperature-corrected at calc time;
// reactance is treated as temperature-independent.

import { Impedance } from './impedance.js';
import { ConductorMaterial } from './conductorMaterial.js';
import { correctResistance } from './temperatureCorrection.js';

export class CableSegment {
  constructor({
    label = 'Cable',
    lengthFeet,
    resistancePerKFTAtReference,
    referenceTemperatureC = 25.0,
    reactancePerKFT,
    maxOperatingTemperatureC = 90.0,
    conductorMaterial = ConductorMaterial.copper,
    parallelCount = 1,
  }) {
    this.label = label;
    this.lengthFeet = lengthFeet;
    this.resistancePerKFTAtReference = resistancePerKFTAtReference;
    this.referenceTemperatureC = referenceTemperatureC;
    this.reactancePerKFT = reactancePerKFT;
    this.maxOperatingTemperatureC = maxOperatingTemperatureC;
    this.conductorMaterial = conductorMaterial;
    this.parallelCount = parallelCount;
  }

  /**
   * Impedance at an arbitrary temperature. Bad input (non-finite / non-positive
   * length, negative per-kft, parallelCount < 1) → infinite impedance
   * (→ zero downstream fault current → conservative verdict). A zero-length
   * cable is the dangerous case: without the guard it would read as zero
   * impedance, over-stating fault current.
   *
   * Parallel conductors: R and X are each divided by parallelCount (IEEE 141 §3).
   */
  impedanceAt(temperatureC) {
    if (!(this.lengthFeet > 0 && Number.isFinite(this.lengthFeet)) ||
        !(this.resistancePerKFTAtReference >= 0 && Number.isFinite(this.resistancePerKFTAtReference)) ||
        !(this.reactancePerKFT >= 0 && Number.isFinite(this.reactancePerKFT)) ||
        !(this.parallelCount >= 1)) {
      return new Impedance(Infinity, 0);
    }
    const lengthKFT = this.lengthFeet / 1000.0;
    const rRef = this.resistancePerKFTAtReference * lengthKFT;
    const r = correctResistance(rRef, this.referenceTemperatureC, temperatureC, this.conductorMaterial);
    const x = this.reactancePerKFT * lengthKFT;
    const n = this.parallelCount;
    return new Impedance(r / n, x / n);
  }

  get impedanceAtReference() {
    return this.impedanceAt(this.referenceTemperatureC);
  }

  get impedanceAtMaxTemperature() {
    return this.impedanceAt(this.maxOperatingTemperatureC);
  }
}
