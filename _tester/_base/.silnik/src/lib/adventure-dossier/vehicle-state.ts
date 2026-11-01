import type { Message } from '@/lib/types';

export interface CampaignVehicleState {
  vehicleId: string;
  currentBuild: number;
  maxBuild: number;
  passengerCharacterIds: string[];
  lastResolutionId: string;
  updatedAt: string;
}

/** Reconstructs latest vehicle state from saved, typed local collision results. */
export function getCampaignVehicleStates(messages: Message[]): CampaignVehicleState[] {
  const states = new Map<string, CampaignVehicleState>();

  for (const message of messages) {
    const timestamp = new Date(message.timestamp).getTime();
    const recordedAt = new Date(Number.isFinite(timestamp) ? timestamp : 0).toISOString();
    const events = Array.isArray(message.mechanicsContext?.vehicleCollisionResolutions)
      ? message.mechanicsContext.vehicleCollisionResolutions
      : [];
    for (const event of events) {
      if (
        !event ||
        event.source !== 'local_vehicle_collision' ||
        typeof event.vehicleId !== 'string' ||
        !event.vehicleId.trim() ||
        typeof event.resolutionId !== 'string' ||
        !event.resolutionId.trim() ||
        !Number.isInteger(event.remainingBuild) ||
        !Number.isInteger(event.maxBuild) ||
        event.remainingBuild < 0 ||
        event.maxBuild <= 0 ||
        event.remainingBuild > event.maxBuild
      ) continue;

      const prior = states.get(event.vehicleId);
      if (prior && Date.parse(prior.updatedAt) > Date.parse(recordedAt)) continue;
      states.set(event.vehicleId, {
        vehicleId: event.vehicleId,
        currentBuild: event.remainingBuild,
        maxBuild: event.maxBuild,
        passengerCharacterIds: Array.isArray(event.passengers)
          ? [...new Set(event.passengers.map((passenger) => passenger.characterId).filter((id) => typeof id === 'string'))]
          : [],
        lastResolutionId: event.resolutionId,
        updatedAt: recordedAt,
      });
    }
  }

  return [...states.values()];
}
