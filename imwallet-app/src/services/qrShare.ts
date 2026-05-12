import { ChainCode, chainLabelMap } from '../domain/wallet-domain';

export const createReceiveShareText = (chain: ChainCode, receiveLabel: string, address: string) =>
  `${chainLabelMap[chain]} ${receiveLabel}\n${address}`;
