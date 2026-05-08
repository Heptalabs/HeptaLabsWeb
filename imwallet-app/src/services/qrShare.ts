import { ChainCode, chainLabelMap } from '../domain/wallet-domain';

export const createQrImageUrl = (value: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=640x640&format=png&margin=28&data=${encodeURIComponent(value)}`;

export const createReceiveShareText = (chain: ChainCode, receiveLabel: string, address: string) =>
  `${chainLabelMap[chain]} ${receiveLabel}\n${address}`;
