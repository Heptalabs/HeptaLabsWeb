import React from 'react';
import { Pressable, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

type ReceiveQrCardProps = {
  qrValue: string;
  address: string;
  emptyHint: string;
  copyLabel: string;
  shareLabel: string;
  styles: any;
  onCopy: () => void;
  onShare: () => void;
};

export const ReceiveQrCard = ({ qrValue, address, emptyHint, copyLabel, shareLabel, styles, onCopy, onShare }: ReceiveQrCardProps) => {
  const hasQr = Boolean(qrValue);
  return (
    <>
      <View style={styles.qrBox}>
        {hasQr ? (
          <View style={styles.qrImageFrame}>
            <QRCode
              value={qrValue}
              size={210}
              backgroundColor="transparent"
              color="#111111"
              quietZone={12}
            />
          </View>
        ) : (
          <Text style={styles.qrEmptyText}>{emptyHint}</Text>
        )}
      </View>
      <Text style={styles.receiveAddress}>{address || ' '}</Text>
      <Pressable style={styles.receiveQrActionBtn ?? styles.secondaryBtn} onPress={onCopy}>
        <Text style={styles.receiveQrActionBtnText ?? styles.secondaryBtnText}>{copyLabel}</Text>
      </Pressable>
      <Pressable style={styles.receiveQrActionBtn ?? styles.secondaryBtn} onPress={onShare}>
        <Text style={styles.receiveQrActionBtnText ?? styles.secondaryBtnText}>{shareLabel}</Text>
      </Pressable>
    </>
  );
};
