#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const appPath = path.resolve(process.cwd(), 'App.tsx');
const source = await fs.readFile(appPath, 'utf8');

const failures = [];
const infos = [];

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const include = (needle) => source.includes(needle);

const backdropExprMatch = source.match(/const isAnyDropdownBackdropActive\s*=\s*([\s\S]*?);/);
assert(Boolean(backdropExprMatch), 'isAnyDropdownBackdropActive 식을 찾지 못했습니다.');

if (backdropExprMatch) {
  const expr = backdropExprMatch[1];
  const expectedFlags = [
    'showWalletMenu',
    'showLangMenu',
    'showAutoLockMenu',
    'showLockMethodMenu',
    'showBiometricTypeMenu',
    'showDiscoverBriefingWeekMenu',
    'showAddressBookEditModal',
    'showRecipientBookModal',
    'showSaveRecipientModal',
    'showScanMethodModal',
    'showHomeAssetLayoutModal',
    'showHistoryDateRangeModal',
    'showHistoryDateCalendarModal',
    'showRecentSendDropdown',
    'showNftRecentSendDropdown'
  ];

  expectedFlags.forEach((flag) => {
    assert(expr.includes(flag), `isAnyDropdownBackdropActive 누락: ${flag}`);
  });
}

const requiredOverlayRenderers = [
  'const renderRecentSendOverlay = () => {',
  'const renderRecipientActionTriggerOverlay = (',
  'const renderHomeLayoutTriggerOverlay = () => {',
  'const renderHomeScanTriggerOverlay = () => {',
  'const renderHistoryRangeTriggerOverlay = () => {',
  'const renderSettingsLangOverlay = () => {',
  'const renderDiscoverBriefingWeekOverlay = () => {'
];
requiredOverlayRenderers.forEach((snippet) => assert(include(snippet), `오버레이 렌더러 누락: ${snippet}`));

const dropdownModals = [
  'showRecipientBookModal',
  'showSaveRecipientModal',
  'showAddressBookEditModal',
  'showScanMethodModal',
  'showHomeAssetLayoutModal',
  'showHistoryDateRangeModal',
  'showHistoryDateCalendarModal'
];

for (const modalFlag of dropdownModals) {
  const pattern = new RegExp(
    `Modal\\s+visible=\\{${modalFlag}\\}[\\s\\S]{0,260}?style=\\{\\[styles\\.modalBackdrop,\\s*styles\\.dropdownModalBackdrop\\]\\}`,
    'm'
  );
  assert(pattern.test(source), `드롭다운 모달 배경 정책 누락: ${modalFlag} (transparent dropdown backdrop 필요)`);
}

const globalScrimMatches = source.match(/style=\{styles\.globalDropdownScrim\}/g) || [];
assert(globalScrimMatches.length >= 3, `globalDropdownScrim 사용 수가 너무 적습니다: ${globalScrimMatches.length}`);

const globalLayerMatches = source.match(/style=\{styles\.globalDropdownLayer\}/g) || [];
assert(globalLayerMatches.length >= 4, `globalDropdownLayer 사용 수가 너무 적습니다: ${globalLayerMatches.length}`);

assert(include('style={[styles.modalBackdrop, styles.dropdownModalBackdrop]}'), 'dropdownModalBackdrop 조합이 존재하지 않습니다.');
assert(include('style={styles.modalScrimTap}'), 'modalScrimTap이 존재하지 않습니다.');

const localScrimCount = (source.match(/style=\{styles\.walletMenuScrim\}/g) || []).length;
infos.push(`walletMenuScrim references: ${localScrimCount}`);

const headerBackdropGuardCount = (source.match(/isAnyDropdownBackdropActive \? null : renderHeaderBackdrop\(\)/g) || []).length;
infos.push(`header backdrop guards: ${headerBackdropGuardCount}`);
assert(headerBackdropGuardCount >= 2, `헤더 백드롭 가드가 부족합니다: ${headerBackdropGuardCount}`);

if (failures.length) {
  console.error('[check-dropdown-policy] FAIL');
  failures.forEach((msg) => console.error(` - ${msg}`));
  infos.forEach((msg) => console.error(` * ${msg}`));
  process.exit(1);
}

console.log('[check-dropdown-policy] PASS');
infos.forEach((msg) => console.log(` - ${msg}`));
