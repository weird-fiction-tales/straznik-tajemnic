import type {
  VehicleCollisionPassengerResolution,
  VehicleCollisionResolutionContext,
} from '@/lib/parsers/types';
import type { VehicleCollisionResolution } from '@/lib/hazards-engine';

/** Builds the compact, typed event sent from the local collision resolver to chat/RAG. */
export function buildVehicleCollisionResolutionContext(
  vehicleId: string,
  resolutionId: string,
  resolution: VehicleCollisionResolution,
  maxBuild: number,
  passengers: VehicleCollisionPassengerResolution[] = [],
): VehicleCollisionResolutionContext {
  return {
    source: 'local_vehicle_collision',
    resolutionId,
    vehicleId,
    severity: resolution.severity,
    initialBuild: resolution.initialBuild,
    maxBuild,
    buildDamage: resolution.buildDamage,
    remainingBuild: resolution.remainingBuild,
    passengers,
    destroyedInSingleEvent: resolution.destroyedInSingleEvent,
  };
}
