import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import process from 'process';

type RuntimeScope = typeof globalThis & {
  Buffer?: typeof Buffer;
  process?: typeof process;
  global?: typeof globalThis;
};

const scope = globalThis as RuntimeScope;

if (!scope.global) {
  scope.global = scope;
}

if (!scope.Buffer) {
  scope.Buffer = Buffer;
}

if (!scope.process) {
  scope.process = process;
}

if (scope.process) {
  const processWithMutableFields = scope.process as typeof process & {
    version?: string;
    browser?: boolean;
  };
  if (typeof processWithMutableFields.version !== 'string' || processWithMutableFields.version.length === 0) {
    processWithMutableFields.version = 'v18.0.0';
  }
  if (typeof processWithMutableFields.browser !== 'boolean') {
    processWithMutableFields.browser = true;
  }
}
