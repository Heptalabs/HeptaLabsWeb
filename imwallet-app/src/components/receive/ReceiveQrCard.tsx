import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

type ReceiveQrCardProps = {
  qrUri: string;
  address: string;
  emptyHint: string;
  copyLabel: string;
  shareLabel: string;
  styles: any;
  onCopy: () => void;
  onShare: () => void;
};

export const ReceiveQrCard = ({ qrUri, address, emptyHint, copyLabel, shareLabel, styles, onCopy, onShare }: ReceiveQrCardProps) => {
  const hasQr = Boolean(qrUri);
  return (
    <>
      <View style={styles.qrBox}>
        {hasQr ? (
          <View style={styles.qrImageFrame}>
            <Image source={{ uri: qrUri }} style={styles.qrImage} resizeMode="contain" />
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
