// Conductor material — carries the inferred zero-resistance temperature
// used for the linear temperature-resistance correction (IEEE 141 values).

export const ConductorMaterial = Object.freeze({
  copper: 'copper',
  aluminum: 'aluminum',
});

/** Inferred zero-resistance temperature (°C) for the material. */
export function inferredZeroTemperatureC(material) {
  switch (material) {
    case ConductorMaterial.aluminum:
      return 228.0;
    case ConductorMaterial.copper:
    default:
      return 234.5;
  }
}
