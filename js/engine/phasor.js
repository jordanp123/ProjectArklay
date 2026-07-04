// Sinusoidal steady-state quantity (voltage or current) as a complex
// phasor real + j·imaginary. Same shape as Impedance but represents
// volts/amps rather than ohms; kept separate to avoid cross-mixing.

export class Phasor {
  constructor(real, imaginary) {
    this.real = real;
    this.imaginary = imaginary;
  }

  static zero() {
    return new Phasor(0, 0);
  }

  get magnitude() {
    return Math.sqrt(this.real * this.real + this.imaginary * this.imaginary);
  }

  /** Angle in radians, CCW from the positive real axis. 0 for the zero phasor. */
  get angle() {
    if (this.real === 0 && this.imaginary === 0) return 0;
    return Math.atan2(this.imaginary, this.real);
  }

  /** Polar-form constructor: |P| ∠ θ (radians). */
  static from(magnitude, angle) {
    return new Phasor(magnitude * Math.cos(angle), magnitude * Math.sin(angle));
  }

  /** This phasor rotated 90° CCW — i.e. multiplied by j. */
  get rotatedBy90() {
    return new Phasor(-this.imaginary, this.real);
  }

  add(o) {
    return new Phasor(this.real + o.real, this.imaginary + o.imaginary);
  }

  sub(o) {
    return new Phasor(this.real - o.real, this.imaginary - o.imaginary);
  }

  scale(k) {
    return new Phasor(this.real * k, this.imaginary * k);
  }

  /** Ohm's law: V = I·Z. Current phasor × impedance → voltage phasor. */
  timesImpedance(z) {
    return new Phasor(
      this.real * z.resistance - this.imaginary * z.reactance,
      this.real * z.reactance + this.imaginary * z.resistance,
    );
  }
}
