/**
 * Risk Assessment & Compound Calculation Engine
 * Replicates the multi-criteria compound impact algorithm for frontend simulation
 */

export function calculateCompoundRisk(params) {
  const {
    windSpeedKmh,        // e.g. 165
    rainfallMm24h,       // e.g. 240
    distanceFromEyeKm,   // e.g. 68
    elevationMeters,     // e.g. 3.2
    stormSurgeMeters,    // e.g. 4.2
    vulnerabilityScore,  // 0 - 100
    weights = { wind: 0.28, rain: 0.22, flood: 0.32, vuln: 0.18 }
  } = params;

  // 1. Wind Risk Score (Normalized 0 - 100 based on Saffir-Simpson/IMD thresholds)
  // 60 km/h is base gale, 220+ km/h is super cyclone
  let windScore = Math.min(100, Math.max(0, ((windSpeedKmh - 40) / (200 - 40)) * 100));

  // 2. Rain Risk Score (Normalized 0 - 100)
  // 30mm is moderate, 250+ mm is extreme torrential downpour
  let rainScore = Math.min(100, Math.max(0, ((rainfallMm24h - 20) / (260 - 20)) * 100));

  // 3. Flood & Surge Risk Score
  // Combined function of surge height over elevation, distance to coastline/eye, and high tide
  const effectiveInundationThreat = Math.max(0, (stormSurgeMeters * 1.5) - (elevationMeters * 0.4));
  let floodScore = Math.min(100, Math.max(0, (effectiveInundationThreat / 4.5) * 80 + (rainScore * 0.2)));

  // 4. Distance Decay Factor
  const distanceFactor = Math.max(0.2, 1 - (distanceFromEyeKm / 350));

  // Modulate wind & flood by distance factor
  const adjustedWindScore = Math.min(100, windScore * Math.min(1.1, distanceFactor * 1.15));
  const adjustedRainScore = Math.min(100, rainScore * (0.4 + 0.6 * distanceFactor));
  const adjustedFloodScore = Math.min(100, floodScore * (0.3 + 0.7 * distanceFactor));

  // 5. Compound Multi-Hazard Score
  const rawCompound = (
    (adjustedWindScore * weights.wind) +
    (adjustedRainScore * weights.rain) +
    (adjustedFloodScore * weights.flood) +
    (vulnerabilityScore * weights.vuln)
  );

  // Apply compound compounding synergy factor (when multiple hazards peak simultaneously, impact is non-linear)
  const simultaneousHazardsMultiplier = (adjustedWindScore > 75 && adjustedFloodScore > 75) ? 1.08 : 1.0;
  const finalCompoundScore = Math.min(100, Math.round(rawCompound * simultaneousHazardsMultiplier));

  return {
    windRiskScore: Math.round(adjustedWindScore),
    windRiskLevel: getRiskLevel(adjustedWindScore),
    rainRiskScore: Math.round(adjustedRainScore),
    rainRiskLevel: getRiskLevel(adjustedRainScore),
    floodRiskScore: Math.round(adjustedFloodScore),
    floodRiskLevel: getRiskLevel(adjustedFloodScore),
    vulnerabilityScore: Math.round(vulnerabilityScore),
    vulnerabilityLevel: getRiskLevel(vulnerabilityScore),
    compoundRiskScore: finalCompoundScore,
    compoundRiskLevel: getRiskLevel(finalCompoundScore),
    aiExplanation: generateAIExplanation({
      windScore: Math.round(adjustedWindScore),
      rainScore: Math.round(adjustedRainScore),
      floodScore: Math.round(adjustedFloodScore),
      vulnScore: Math.round(vulnerabilityScore),
      windSpeedKmh,
      rainfallMm24h,
      elevationMeters,
      stormSurgeMeters,
      distanceFromEyeKm
    })
  };
}

export function getRiskLevel(score) {
  if (score >= 85) return "Very High";
  if (score >= 70) return "High";
  if (score >= 40) return "Moderate";
  return "Low";
}

export function getRiskBadgeClasses(level) {
  switch (level) {
    case "Very High":
      return {
        badgeBg: "bg-red-500/20 border-red-500/50 text-red-400",
        barBg: "bg-red-500",
        ringColor: "#EF4444",
        textGradient: "from-red-400 to-rose-600",
        icon: "fa-triangle-exclamation",
        indicatorColor: "bg-red-500 shadow-red-500/50"
      };
    case "High":
      return {
        badgeBg: "bg-amber-500/20 border-amber-500/50 text-amber-400",
        barBg: "bg-amber-500",
        ringColor: "#F59E0B",
        textGradient: "from-amber-400 to-orange-500",
        icon: "fa-circle-exclamation",
        indicatorColor: "bg-amber-500 shadow-amber-500/50"
      };
    case "Moderate":
      return {
        badgeBg: "bg-yellow-500/20 border-yellow-500/50 text-yellow-300",
        barBg: "bg-yellow-400",
        ringColor: "#EAB308",
        textGradient: "from-yellow-300 to-yellow-500",
        icon: "fa-info-circle",
        indicatorColor: "bg-yellow-400 shadow-yellow-400/50"
      };
    case "Low":
    default:
      return {
        badgeBg: "bg-emerald-500/20 border-emerald-500/50 text-emerald-400",
        barBg: "bg-emerald-500",
        ringColor: "#10B981",
        textGradient: "from-emerald-400 to-teal-500",
        icon: "fa-shield-check",
        indicatorColor: "bg-emerald-500 shadow-emerald-500/50"
      };
  }
}

function generateAIExplanation({ windScore, rainScore, floodScore, vulnScore, windSpeedKmh, rainfallMm24h, elevationMeters, stormSurgeMeters, distanceFromEyeKm }) {
  const drivers = [];
  if (windScore >= 75) drivers.push(`high wind stress (${windSpeedKmh} km/h)`);
  if (floodScore >= 75) drivers.push(`critical storm surge (${stormSurgeMeters}m over ${elevationMeters}m ground elevation)`);
  if (rainScore >= 75) drivers.push(`torrential rainfall (${rainfallMm24h} mm/24h)`);
  if (vulnScore >= 75) drivers.push(`dense socio-economic exposure`);

  if (drivers.length >= 3) {
    return `Compound Critical Hazard: Co-occurrence of ${drivers.join(", ")} creates an extreme compounding multiplier. Inundation depth and wind loading severely compromise evacuation routes.`;
  } else if (drivers.length >= 1) {
    return `Compound Moderate-High Threat: Primarily driven by ${drivers.join(" and ")} at ${distanceFromEyeKm} km from storm center. Local elevation and localized drainage dictate peak vulnerability.`;
  } else {
    return `Marginal Compound Impact: Distance (${distanceFromEyeKm} km) and moderate topography buffer against catastrophic damage, though peripheral rainbands remain active.`;
  }
}
