import { Protocol } from "lending-apy-fetcher-ts";
import { AaveEthProtocol, AavePolygonProtocol, AaveArbitrumProtocol, AaveOptimismProtocol } from "lending-apy-fetcher-ts";

export const allProtocols: Protocol[] = [
  // new AaveEthProtocol(),
  new AavePolygonProtocol(),
  new AaveArbitrumProtocol(),
  new AaveOptimismProtocol(),
];