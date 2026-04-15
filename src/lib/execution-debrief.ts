/**
 * Execution Debrief Engine
 *
 * Compares planned passage with actual execution to generate
 * actionable debrief summary.
 */

export interface DebriefSummary {
  durationDelta: { planned: number; actual: number; deltaH: number; faster: boolean };
  comfortMatch: { planned: string; actual: string | null; matched: boolean };
  windMatch: { planned: number; observed: number | null; closerThanExpected: boolean | null };
  waveMatch: { planned: number; observed: number | null; closerThanExpected: boolean | null };
  keyInsights: string[];
  lessonsLearned: string[];
}

interface ExecutionData {
  startedAt: string | null;
  endedAt: string | null;
  checkpoints: { type: string; title: string; recordedAt: string }[];
  observations: { comfort: string | null; observedWindKt: number | null; observedWaveM: number | null; note: string | null; recordedAt: string }[];
}

export function buildDebrief(
  plannedHours: number,
  plannedMaxWind: number,
  plannedMaxWave: number,
  plannedComfort: string,
  execution: ExecutionData,
): DebriefSummary {
  const actualH = execution.startedAt && execution.endedAt
    ? (new Date(execution.endedAt).getTime() - new Date(execution.startedAt).getTime()) / 3600000
    : null;

  const deltaH = actualH != null ? actualH - plannedHours : 0;
  const faster = deltaH < 0;

  // Observed conditions
  const windObs = execution.observations.filter(o => o.observedWindKt != null).map(o => o.observedWindKt!);
  const waveObs = execution.observations.filter(o => o.observedWaveM != null).map(o => o.observedWaveM!);
  const comfortObs = execution.observations.filter(o => o.comfort).map(o => o.comfort!);
  const maxObsWind = windObs.length > 0 ? Math.max(...windObs) : null;
  const maxObsWave = waveObs.length > 0 ? Math.max(...waveObs) : null;
  const lastComfort = comfortObs.length > 0 ? comfortObs[comfortObs.length - 1] : null;

  const insights: string[] = [];
  const lessons: string[] = [];

  // Duration
  if (actualH != null) {
    if (Math.abs(deltaH) < 0.5) insights.push("Duration matched plan closely");
    else if (faster) insights.push(`Arrived ${Math.abs(deltaH).toFixed(1)}h faster than planned`);
    else insights.push(`Arrived ${deltaH.toFixed(1)}h later than planned`);
  }

  // Wind
  if (maxObsWind != null) {
    if (maxObsWind > plannedMaxWind + 5) {
      insights.push(`Wind was stronger than forecast (+${(maxObsWind - plannedMaxWind).toFixed(0)}kt)`);
      lessons.push("Forecast underestimated wind — add margin next time");
    } else if (maxObsWind < plannedMaxWind - 5) {
      insights.push("Wind was lighter than forecast — more motoring needed");
    } else {
      insights.push("Wind roughly matched forecast");
    }
  }

  // Waves
  if (maxObsWave != null) {
    if (maxObsWave > plannedMaxWave + 0.5) {
      insights.push(`Seas were rougher than forecast (+${(maxObsWave - plannedMaxWave).toFixed(1)}m)`);
      lessons.push("Consider higher wave margin for this route");
    } else if (maxObsWave < plannedMaxWave - 0.5) {
      insights.push("Seas were calmer than forecast");
    }
  }

  // Comfort
  if (lastComfort) {
    const comfortRank: Record<string, number> = { comfortable: 1, moderate: 2, bumpy: 3, demanding: 4, hard_work: 5 };
    const plannedRank = comfortRank[plannedComfort.toLowerCase()] ?? 2;
    const actualRank = comfortRank[lastComfort] ?? 2;
    if (actualRank > plannedRank + 1) {
      insights.push("Passage was harder than expected");
      lessons.push("Comfort scoring was optimistic — adjust thresholds");
    } else if (actualRank < plannedRank - 1) {
      insights.push("Passage was easier than expected");
    }
  }

  // Checkpoints
  if (execution.checkpoints.length > 0) {
    insights.push(`${execution.checkpoints.length} checkpoints logged`);
  }
  if (execution.observations.length > 0) {
    insights.push(`${execution.observations.length} observations recorded`);
  }

  // General lessons
  if (deltaH > 2) lessons.push("Consider earlier departure or faster expected SOG");
  if (execution.checkpoints.some(c => c.type === "reef_in")) lessons.push("Reefing was needed — plan for it");
  if (execution.checkpoints.some(c => c.type === "bailout_decision")) lessons.push("Bailout was considered — review decision triggers");

  return {
    durationDelta: { planned: plannedHours, actual: actualH ?? 0, deltaH, faster },
    comfortMatch: { planned: plannedComfort, actual: lastComfort, matched: lastComfort?.toLowerCase() === plannedComfort.toLowerCase() },
    windMatch: { planned: plannedMaxWind, observed: maxObsWind, closerThanExpected: maxObsWind != null ? Math.abs(maxObsWind - plannedMaxWind) < 3 : null },
    waveMatch: { planned: plannedMaxWave, observed: maxObsWave, closerThanExpected: maxObsWave != null ? Math.abs(maxObsWave - plannedMaxWave) < 0.5 : null },
    keyInsights: insights,
    lessonsLearned: lessons,
  };
}
