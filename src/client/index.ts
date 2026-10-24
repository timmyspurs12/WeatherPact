import { config, hasPublicContractConfig } from '../config';
import type { WeatherPactClient } from '../types/weatherpact';
import { GenLayerWeatherPactClient } from './genlayer-client';
import { getNetworkProfile } from './network';
import { PreviewWeatherPactClient } from './preview-client';

function createWeatherPactClient(): WeatherPactClient {
  const profile = getNetworkProfile(config.network);
  if (
    hasPublicContractConfig &&
    profile &&
    config.contractAddress &&
    config.rpcUrl &&
    config.chainId === String(profile.chainId)
  ) {
    try {
      return new GenLayerWeatherPactClient({
        contractAddress: config.contractAddress,
        rpcUrl: config.rpcUrl,
        chainName: config.chainName,
        profile,
      });
    } catch {
      // Invalid public configuration must never enable genuine writes.
    }
  }
  return new PreviewWeatherPactClient();
}

/** Pages depend on capabilities, never on the mere presence of env variables. */
export const weatherPactClient: WeatherPactClient = createWeatherPactClient();
