import { useEffect, useMemo, useState } from 'react';
import { adminApiClient, setAdminBearerToken } from './api/client';
import { AuthProvider, useAdminAuth } from './auth/AuthContext';
import { AdminLayout } from './components/layout/AdminLayout';
import { AuditPage } from './pages/AuditPage';
import { ContentPage } from './pages/ContentPage';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { UsersPage } from './pages/UsersPage';
import { AdminNavKey, canAccessNav, getFirstNav, getRoleNav } from './security/accessControl';
import { contentRolePermissions } from './utils/contentPolicy';
import type {
  AdminContentItem,
  AdminRole,
  ContentActionType,
  ContentCategory,
  ContentSection,
  DiscoverClickLogItem,
  DiscoverClickSummary,
  DashboardPayload,
  WithdrawalValidationRequest
} from './types/admin';

type Language = 'ko' | 'en' | 'zh';

type AppCopy = {
  title: string;
  subtitle: string;
  roleLabel: string;
  logout: string;
  refresh: string;
  loading: string;
  noPermission: string;
  operationDone: string;
  operationFailed: string;
  nav: Record<AdminNavKey, string>;
  roleName: Record<AdminRole, string>;
  login: {
    title: string;
    subtitle: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    nextMfa: string;
    loading: string;
    challengeSentPrefix: string;
    challengeHint: string;
    mfaPlaceholder: string;
    verifyMfa: string;
    verifying: string;
  };
  overview: {
    operationsDashboard: string;
    adminConsole: string;
    totalExposure: string;
    acrossChains: string;
    users: string;
    activeProfiles: string;
    pendingQueue: string;
    needsReview: string;
    highRiskAlerts: string;
    riskOver70: string;
  };
  transactions: {
    title: string;
    runRiskScan: string;
    all: string;
    pending: string;
    manualReview: string;
    approved: string;
    blocked: string;
    id: string;
    user: string;
    flow: string;
    asset: string;
    amount: string;
    risk: string;
    status: string;
    withdrawalPrecheck: string;
    validateSample: string;
    validationResult: string;
  };
  users: {
    title: string;
    searchPlaceholder: string;
    user: string;
    tier: string;
    kyc: string;
    wallet: string;
    sendLimit: string;
    action: string;
    increaseLimit: string;
  };
  policies: {
    title: string;
    key: string;
    value: string;
    updatedAt: string;
    updatedBy: string;
    action: string;
    toggle: string;
  };
  audit: {
    title: string;
    id: string;
    action: string;
    actor: string;
    scope: string;
    summary: string;
    createdAt: string;
  };
  content: {
    title: string;
    subtitle: string;
    readOnlyHint: string;
    refreshAuto: string;
    uploadImage: string;
    uploadingImage: string;
    newItem: string;
    editItem: string;
    saveCreate: string;
    saveUpdate: string;
    cancelEdit: string;
    filterAll: string;
    statusDraft: string;
    statusPublished: string;
    fieldCategory: string;
    fieldSection: string;
    fieldStatus: string;
    fieldPinned: string;
    fieldPriority: string;
    fieldSourceName: string;
    fieldSourceUrl: string;
    fieldImageUrl: string;
    fieldCtaUrl: string;
    fieldActionType: string;
    fieldInternalTarget: string;
    actionTypeLabel: Record<ContentActionType, string>;
    fieldTags: string;
    fieldStartsAt: string;
    fieldEndsAt: string;
    fieldPublishedAt: string;
    fieldSchedule: string;
    scheduleScheduled: string;
    scheduleExpiring: string;
    scheduleExpired: string;
    fieldTitleKo: string;
    fieldTitleEn: string;
    fieldTitleZh: string;
    fieldSummaryKo: string;
    fieldSummaryEn: string;
    fieldSummaryZh: string;
    fieldCtaKo: string;
    fieldCtaEn: string;
    fieldCtaZh: string;
    listTitle: string;
    listEmpty: string;
    clickLogTitle: string;
    clickLogEmpty: string;
    clickSummaryTotal: string;
    clickSummarySuccess: string;
    clickSummaryWindow: string;
    clickSummaryTop: string;
    edit: string;
    remove: string;
    publish: string;
    draft: string;
    manual: string;
    auto: string;
    categoryLabel: Record<ContentCategory, string>;
    sectionLabel: Record<ContentSection, string>;
  };
};

const copy: Record<Language, AppCopy> = {
  ko: {
    title: '콘솔 코어',
    subtitle: '지갑 운영 및 리스크 제어 콘솔',
    roleLabel: '역할',
    logout: '로그아웃',
    refresh: '새로고침',
    loading: '데이터를 불러오는 중입니다.',
    noPermission: '현재 역할로 접근할 수 없는 메뉴입니다.',
    operationDone: '작업이 반영되었습니다.',
    operationFailed: '요청 처리 중 오류가 발생했습니다.',
    nav: {
      overview: '개요',
      transactions: '트랜잭션',
      users: '사용자',
      policies: '정책',
      audit: '감사 로그',
      content: '콘텐츠'
    },
    roleName: {
      viewer: '조회',
      operator: '운영',
      compliance: '컴플라이언스',
      admin: '관리자'
    },
    login: {
      title: 'IMWallet 콘솔 로그인',
      subtitle: '실서비스형 인증 흐름 (비밀번호 + MFA)',
      emailPlaceholder: '이메일',
      passwordPlaceholder: '비밀번호',
      nextMfa: '다음 (MFA)',
      loading: '처리 중...',
      challengeSentPrefix: '인증 코드가 발송되었습니다:',
      challengeHint: '등록된 OTP 앱 코드를 입력하세요.',
      mfaPlaceholder: 'MFA 코드',
      verifyMfa: 'MFA 검증',
      verifying: '검증 중...'
    },
    overview: {
      operationsDashboard: '운영 대시보드',
      adminConsole: 'IMWallet Console',
      totalExposure: '총 익스포저',
      acrossChains: '지원 체인 전체 기준',
      users: '사용자',
      activeProfiles: '활성 프로필',
      pendingQueue: '대기 큐',
      needsReview: '검토 필요',
      highRiskAlerts: '고위험 알림',
      riskOver70: '리스크 점수 70+'
    },
    transactions: {
      title: '트랜잭션 / 큐',
      runRiskScan: '리스크 스캔',
      all: '전체',
      pending: '대기',
      manualReview: '수동 검토',
      approved: '승인',
      blocked: '차단',
      id: 'ID',
      user: '사용자',
      flow: '플로우',
      asset: '자산',
      amount: '수량',
      risk: '리스크',
      status: '상태',
      withdrawalPrecheck: '출금 사전 검증',
      validateSample: '샘플 검증 실행',
      validationResult: '검증 결과'
    },
    users: {
      title: '사용자 제어',
      searchPlaceholder: '사용자 / ID / 등급 검색',
      user: '사용자',
      tier: '등급',
      kyc: 'KYC',
      wallet: '지갑',
      sendLimit: '송금 한도',
      action: '액션',
      increaseLimit: '+1,000'
    },
    policies: {
      title: '정책',
      key: '키',
      value: '값',
      updatedAt: '수정 시각',
      updatedBy: '수정자',
      action: '액션',
      toggle: '토글/수정'
    },
    audit: {
      title: '감사 로그',
      id: 'ID',
      action: '액션',
      actor: '행위자',
      scope: '범위',
      summary: '요약',
      createdAt: '생성 시각'
    },
    content: {
      title: '디스커버리 콘텐츠 운영',
      subtitle: '앱 둘러보기 탭에 노출될 콘텐츠를 수동으로 작성/수정/게시합니다.',
      readOnlyHint: '현재 역할은 조회 전용입니다. 작성/게시는 상위 권한에서 가능합니다.',
      refreshAuto: '최신 자동 콘텐츠 갱신',
      uploadImage: '이미지 업로드',
      uploadingImage: '업로드 중...',
      newItem: '새 항목',
      editItem: '항목 수정',
      saveCreate: '콘텐츠 생성',
      saveUpdate: '수정 저장',
      cancelEdit: '편집 취소',
      filterAll: '전체',
      statusDraft: '임시저장',
      statusPublished: '게시',
      fieldCategory: '카테고리',
      fieldSection: '노출 섹션',
      fieldStatus: '상태',
      fieldPinned: '핀 고정',
      fieldPriority: '우선순위',
      fieldSourceName: '출처 이름',
      fieldSourceUrl: '출처 URL',
      fieldImageUrl: '이미지 URL',
      fieldCtaUrl: 'CTA URL',
      fieldActionType: '버튼 동작',
      fieldInternalTarget: '내부 이동 대상',
      actionTypeLabel: {
        external: '외부 링크',
        internal: '앱 내부 이동',
        none: '동작 없음'
      },
      fieldTags: '태그 (콤마 구분)',
      fieldStartsAt: '노출 시작 (선택)',
      fieldEndsAt: '노출 종료 (선택)',
      fieldPublishedAt: '게시 시각 (선택)',
      fieldSchedule: '스케줄',
      scheduleScheduled: '예약',
      scheduleExpiring: '만료 임박',
      scheduleExpired: '만료됨',
      fieldTitleKo: '제목 (KO)',
      fieldTitleEn: '제목 (EN)',
      fieldTitleZh: '제목 (ZH)',
      fieldSummaryKo: '요약 (KO)',
      fieldSummaryEn: '요약 (EN)',
      fieldSummaryZh: '요약 (ZH)',
      fieldCtaKo: '버튼 문구 (KO)',
      fieldCtaEn: '버튼 문구 (EN)',
      fieldCtaZh: '버튼 문구 (ZH)',
      listTitle: '수동 콘텐츠 목록',
      listEmpty: '조건에 맞는 수동 콘텐츠가 없습니다.',
      clickLogTitle: '디스커버 클릭 로그',
      clickLogEmpty: '아직 클릭 로그가 없습니다.',
      clickSummaryTotal: '총 클릭',
      clickSummarySuccess: '성공 클릭',
      clickSummaryWindow: '집계 기간',
      clickSummaryTop: '최다 클릭 항목',
      edit: '수정',
      remove: '삭제',
      publish: '게시',
      draft: '임시저장',
      manual: '수동',
      auto: '자동',
      categoryLabel: {
        featured: '추천',
        dex: 'DEX',
        lending: '대출',
        yield: '수익',
        solana: '솔라나',
        market: '마켓',
        social: '소셜',
        games: '게임'
      },
      sectionLabel: {
        feature: '상단 피처',
        earn: 'Earn 카드',
        dapps: 'dApp 목록',
        watchlist: '관심 목록',
        sites: '사이트',
        latest: '최신 업데이트'
      }
    }
  },
  en: {
    title: 'Console Core',
    subtitle: 'Wallet operations and risk control cockpit',
    roleLabel: 'Role',
    logout: 'Logout',
    refresh: 'Refresh',
    loading: 'Loading dashboard data...',
    noPermission: 'Your role cannot access this menu.',
    operationDone: 'Operation applied.',
    operationFailed: 'Failed to process the request.',
    nav: {
      overview: 'Overview',
      transactions: 'Transactions',
      users: 'Users',
      policies: 'Policies',
      audit: 'Audit',
      content: 'Content'
    },
    roleName: {
      viewer: 'Viewer',
      operator: 'Operator',
      compliance: 'Compliance',
      admin: 'Console'
    },
    login: {
      title: 'IMWallet Console Login',
      subtitle: 'Production-like auth flow (password + MFA)',
      emailPlaceholder: 'Email',
      passwordPlaceholder: 'Password',
      nextMfa: 'Next (MFA)',
      loading: 'Loading...',
      challengeSentPrefix: 'Challenge sent to',
      challengeHint: 'Enter the code from your registered OTP app.',
      mfaPlaceholder: 'MFA code',
      verifyMfa: 'Verify MFA',
      verifying: 'Verifying...'
    },
    overview: {
      operationsDashboard: 'Operations Dashboard',
      adminConsole: 'IMWallet Console',
      totalExposure: 'Total Exposure',
      acrossChains: 'Across all supported chains',
      users: 'Users',
      activeProfiles: 'Active profiles',
      pendingQueue: 'Pending Queue',
      needsReview: 'Needs review',
      highRiskAlerts: 'High Risk Alerts',
      riskOver70: 'Risk score 70+'
    },
    transactions: {
      title: 'Transactions / Queue',
      runRiskScan: 'Run Risk Scan',
      all: 'All',
      pending: 'Pending',
      manualReview: 'Manual Review',
      approved: 'Approved',
      blocked: 'Blocked',
      id: 'ID',
      user: 'User',
      flow: 'Flow',
      asset: 'Asset',
      amount: 'Amount',
      risk: 'Risk',
      status: 'Status',
      withdrawalPrecheck: 'Withdrawal Pre-check',
      validateSample: 'Validate Sample Request',
      validationResult: 'Validation'
    },
    users: {
      title: 'User Controls',
      searchPlaceholder: 'Search user / ID / tier',
      user: 'User',
      tier: 'Tier',
      kyc: 'KYC',
      wallet: 'Wallet',
      sendLimit: 'Send Limit',
      action: 'Action',
      increaseLimit: '+1,000'
    },
    policies: {
      title: 'Policies',
      key: 'Key',
      value: 'Value',
      updatedAt: 'Updated At',
      updatedBy: 'Updated By',
      action: 'Action',
      toggle: 'Toggle / Update'
    },
    audit: {
      title: 'Audit Logs',
      id: 'ID',
      action: 'Action',
      actor: 'Actor',
      scope: 'Scope',
      summary: 'Summary',
      createdAt: 'Created At'
    },
    content: {
      title: 'Discovery Content Operations',
      subtitle: 'Create and manage manual content for the app discovery feed.',
      readOnlyHint: 'This role is read-only. Use a higher role to write/publish.',
      refreshAuto: 'Refresh auto feed',
      uploadImage: 'Upload image',
      uploadingImage: 'Uploading...',
      newItem: 'New item',
      editItem: 'Edit item',
      saveCreate: 'Create content',
      saveUpdate: 'Save changes',
      cancelEdit: 'Cancel edit',
      filterAll: 'All',
      statusDraft: 'Draft',
      statusPublished: 'Published',
      fieldCategory: 'Category',
      fieldSection: 'Display section',
      fieldStatus: 'Status',
      fieldPinned: 'Pinned',
      fieldPriority: 'Priority',
      fieldSourceName: 'Source name',
      fieldSourceUrl: 'Source URL',
      fieldImageUrl: 'Image URL',
      fieldCtaUrl: 'CTA URL',
      fieldActionType: 'Button action',
      fieldInternalTarget: 'Internal target',
      actionTypeLabel: {
        external: 'External link',
        internal: 'In-app route',
        none: 'No action'
      },
      fieldTags: 'Tags (comma-separated)',
      fieldStartsAt: 'Starts at (optional)',
      fieldEndsAt: 'Ends at (optional)',
      fieldPublishedAt: 'Published at (optional)',
      fieldSchedule: 'Schedule',
      scheduleScheduled: 'Scheduled',
      scheduleExpiring: 'Expiring soon',
      scheduleExpired: 'Expired',
      fieldTitleKo: 'Title (KO)',
      fieldTitleEn: 'Title (EN)',
      fieldTitleZh: 'Title (ZH)',
      fieldSummaryKo: 'Summary (KO)',
      fieldSummaryEn: 'Summary (EN)',
      fieldSummaryZh: 'Summary (ZH)',
      fieldCtaKo: 'CTA label (KO)',
      fieldCtaEn: 'CTA label (EN)',
      fieldCtaZh: 'CTA label (ZH)',
      listTitle: 'Manual content list',
      listEmpty: 'No manual content for this filter.',
      clickLogTitle: 'Discovery click logs',
      clickLogEmpty: 'No click logs yet.',
      clickSummaryTotal: 'Total clicks',
      clickSummarySuccess: 'Successful clicks',
      clickSummaryWindow: 'Window',
      clickSummaryTop: 'Top item',
      edit: 'Edit',
      remove: 'Delete',
      publish: 'Publish',
      draft: 'Draft',
      manual: 'Manual',
      auto: 'Auto',
      categoryLabel: {
        featured: 'Featured',
        dex: 'DEX',
        lending: 'Lending',
        yield: 'Yield',
        solana: 'Solana',
        market: 'Market',
        social: 'Social',
        games: 'Games'
      },
      sectionLabel: {
        feature: 'Top feature',
        earn: 'Earn card',
        dapps: 'dApp list',
        watchlist: 'Watchlist',
        sites: 'Sites',
        latest: 'Latest updates'
      }
    }
  },
  zh: {
    title: '管理核心',
    subtitle: '钱包运营与风控控制台',
    roleLabel: '角色',
    logout: '退出登录',
    refresh: '刷新',
    loading: '正在加载仪表盘数据...',
    noPermission: '当前角色无权访问该菜单。',
    operationDone: '操作已生效。',
    operationFailed: '请求处理失败。',
    nav: {
      overview: '概览',
      transactions: '交易',
      users: '用户',
      policies: '策略',
      audit: '审计',
      content: '内容'
    },
    roleName: {
      viewer: '查看者',
      operator: '运营',
      compliance: '合规',
      admin: '管理员'
    },
    login: {
      title: 'IMWallet 管理后台登录',
      subtitle: '生产式认证流程（密码 + MFA）',
      emailPlaceholder: '邮箱',
      passwordPlaceholder: '密码',
      nextMfa: '下一步（MFA）',
      loading: '处理中...',
      challengeSentPrefix: '验证码已发送至',
      challengeHint: '请输入已绑定 OTP 应用中的验证码。',
      mfaPlaceholder: 'MFA 验证码',
      verifyMfa: '验证 MFA',
      verifying: '验证中...'
    },
    overview: {
      operationsDashboard: '运营仪表盘',
      adminConsole: 'IMWallet 管理控制台',
      totalExposure: '总敞口',
      acrossChains: '覆盖所有支持链',
      users: '用户数',
      activeProfiles: '活跃资料',
      pendingQueue: '待处理队列',
      needsReview: '需要复核',
      highRiskAlerts: '高风险告警',
      riskOver70: '风险分 >= 70'
    },
    transactions: {
      title: '交易 / 队列',
      runRiskScan: '执行风控扫描',
      all: '全部',
      pending: '待处理',
      manualReview: '人工复核',
      approved: '已通过',
      blocked: '已拦截',
      id: 'ID',
      user: '用户',
      flow: '流程',
      asset: '资产',
      amount: '数量',
      risk: '风险',
      status: '状态',
      withdrawalPrecheck: '提现预校验',
      validateSample: '执行示例校验',
      validationResult: '校验结果'
    },
    users: {
      title: '用户控制',
      searchPlaceholder: '搜索用户 / ID / 等级',
      user: '用户',
      tier: '等级',
      kyc: 'KYC',
      wallet: '钱包',
      sendLimit: '转账限额',
      action: '操作',
      increaseLimit: '+1,000'
    },
    policies: {
      title: '策略',
      key: '键',
      value: '值',
      updatedAt: '更新时间',
      updatedBy: '更新人',
      action: '操作',
      toggle: '切换 / 更新'
    },
    audit: {
      title: '审计日志',
      id: 'ID',
      action: '动作',
      actor: '操作人',
      scope: '范围',
      summary: '摘要',
      createdAt: '创建时间'
    },
    content: {
      title: '发现页内容运营',
      subtitle: '人工创建/编辑/发布应用发现页内容。',
      readOnlyHint: '当前角色为只读，请使用更高权限角色进行编辑发布。',
      refreshAuto: '刷新自动内容',
      uploadImage: '上传图片',
      uploadingImage: '上传中...',
      newItem: '新建',
      editItem: '编辑',
      saveCreate: '创建内容',
      saveUpdate: '保存修改',
      cancelEdit: '取消编辑',
      filterAll: '全部',
      statusDraft: '草稿',
      statusPublished: '已发布',
      fieldCategory: '分类',
      fieldSection: '展示分区',
      fieldStatus: '状态',
      fieldPinned: '置顶',
      fieldPriority: '优先级',
      fieldSourceName: '来源名称',
      fieldSourceUrl: '来源链接',
      fieldImageUrl: '图片链接',
      fieldCtaUrl: 'CTA 链接',
      fieldActionType: '按钮动作',
      fieldInternalTarget: '内部跳转目标',
      actionTypeLabel: {
        external: '外部链接',
        internal: '应用内跳转',
        none: '无动作'
      },
      fieldTags: '标签（逗号分隔）',
      fieldStartsAt: '开始展示（可选）',
      fieldEndsAt: '结束展示（可选）',
      fieldPublishedAt: '发布时间（可选）',
      fieldSchedule: '排期',
      scheduleScheduled: '待生效',
      scheduleExpiring: '即将结束',
      scheduleExpired: '已结束',
      fieldTitleKo: '标题 (韩)',
      fieldTitleEn: '标题 (英)',
      fieldTitleZh: '标题 (中)',
      fieldSummaryKo: '摘要 (韩)',
      fieldSummaryEn: '摘要 (英)',
      fieldSummaryZh: '摘要 (中)',
      fieldCtaKo: '按钮文案 (韩)',
      fieldCtaEn: '按钮文案 (英)',
      fieldCtaZh: '按钮文案 (中)',
      listTitle: '手动内容列表',
      listEmpty: '当前筛选无手动内容。',
      clickLogTitle: '发现页点击日志',
      clickLogEmpty: '暂无点击日志。',
      clickSummaryTotal: '总点击',
      clickSummarySuccess: '成功点击',
      clickSummaryWindow: '统计窗口',
      clickSummaryTop: '最高点击项',
      edit: '编辑',
      remove: '删除',
      publish: '发布',
      draft: '草稿',
      manual: '手动',
      auto: '自动',
      categoryLabel: {
        featured: '推荐',
        dex: 'DEX',
        lending: '借贷',
        yield: '收益',
        solana: 'Solana',
        market: '市场',
        social: '社交',
        games: '游戏'
      },
      sectionLabel: {
        feature: '顶部焦点',
        earn: 'Earn 卡片',
        dapps: 'dApp 列表',
        watchlist: '关注列表',
        sites: '站点',
        latest: '最新更新'
      }
    }
  }
};

const languageLabel: Record<Language, string> = {
  ko: 'KO',
  en: 'EN',
  zh: '中'
};
const navOrder: AdminNavKey[] = ['overview', 'transactions', 'users', 'policies', 'audit', 'content'];

const AdminConsole = () => {
  const { session, logout } = useAdminAuth();
  const [language, setLanguage] = useState<Language>('ko');
  const [currentNav, setCurrentNav] = useState<AdminNavKey>('overview');
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [contentItems, setContentItems] = useState<AdminContentItem[]>([]);
  const [discoverClickLogs, setDiscoverClickLogs] = useState<DiscoverClickLogItem[]>([]);
  const [discoverClickSummary, setDiscoverClickSummary] = useState<DiscoverClickSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const text = copy[language];
  const allowedNav = session ? getRoleNav(session.role) : [];

  const navItems = useMemo(() => {
    if (!session) return [];
    return navOrder
      .filter((key) => canAccessNav(session.role, key))
      .map((key) => ({ key, label: text.nav[key] }));
  }, [session, text.nav]);

  useEffect(() => {
    if (!session) {
      setAdminBearerToken(null);
      setDashboard(null);
      setContentItems([]);
      setDiscoverClickLogs([]);
      setDiscoverClickSummary(null);
      setCurrentNav('overview');
      setError('');
      setNotice('');
      return;
    }

    setAdminBearerToken(session.token);
    setCurrentNav((prev) => (canAccessNav(session.role, prev) ? prev : getFirstNav(session.role)));
  }, [session]);

  const loadDashboard = async () => {
    if (!session) return;

    setLoading(true);
    setError('');
    try {
      const payload = await adminApiClient.getDashboard(session.token);
      setDashboard(payload);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : text.operationFailed);
    } finally {
      setLoading(false);
    }
  };

  const loadContent = async () => {
    if (!session) return;

    setContentLoading(true);
    setError('');
    try {
      const [items, clickLogs, clickSummary] = await Promise.all([
        adminApiClient.getContentItems(session.role),
        adminApiClient.getDiscoverClickLogs(80, session.role),
        adminApiClient.getDiscoverClickSummary(7, session.role)
      ]);
      setContentItems(items);
      setDiscoverClickLogs(clickLogs);
      setDiscoverClickSummary(clickSummary);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : text.operationFailed);
    } finally {
      setContentLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (currentNav === 'content') {
      await loadContent();
      return;
    }
    await loadDashboard();
  };

  useEffect(() => {
    if (!session) return;
    loadDashboard().catch(() => undefined);
  }, [session?.token]);

  useEffect(() => {
    if (!session) return;
    if (currentNav !== 'content') return;
    loadContent().catch(() => undefined);
  }, [session?.token, currentNav]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 2200);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleNavigate = (next: AdminNavKey) => {
    if (!session || !canAccessNav(session.role, next)) return;
    setCurrentNav(next);
    setError('');
  };

  const handleLogout = async () => {
    await logout();
  };

  const guardAction = async (task: () => Promise<void>) => {
    try {
      setError('');
      await task();
      setNotice(text.operationDone);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : text.operationFailed);
    }
  };

  if (!session) {
    return <LoginPage copy={text.login} />;
  }

  const topbar = (
    <header className="topbar">
      <div />
      <div className="topbar-actions">
        <div className="lang-switch">
          {(['ko', 'en', 'zh'] as const).map((item) => (
            <button
              key={item}
              className={language === item ? 'lang-btn active' : 'lang-btn'}
              onClick={() => setLanguage(item)}
              type="button"
            >
              {languageLabel[item]}
            </button>
          ))}
        </div>
        <button className="ghost-btn" onClick={() => void handleRefresh()} disabled={currentNav === 'content' ? contentLoading : loading}>
          {text.refresh}
        </button>
      </div>
    </header>
  );

  return (
    <AdminLayout
      title={text.title}
      subtitle={text.subtitle}
      role={session.role}
      roleLabel={text.roleLabel}
      logoutLabel={text.logout}
      navItems={navItems}
      currentNav={currentNav}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      topbar={topbar}
    >
      {error ? <p className="error-banner">{error}</p> : null}
      {notice ? <p className="notice-banner">{notice}</p> : null}

      {!dashboard && currentNav !== 'content' ? (
        <section className="panel">
          <p className="meta">{text.loading}</p>
        </section>
      ) : !allowedNav.includes(currentNav) ? (
        <section className="panel">
          <p className="meta">{text.noPermission}</p>
        </section>
      ) : currentNav === 'content' && contentLoading && !contentItems.length ? (
        <section className="panel">
          <p className="meta">{text.loading}</p>
        </section>
      ) : null}

      {dashboard && currentNav === 'overview' ? <OverviewPage dashboard={dashboard} copy={text.overview} /> : null}

      {dashboard && currentNav === 'transactions' ? (
        <TransactionsPage
          dashboard={dashboard}
          copy={text.transactions}
          onRunRiskScan={async () => {
            await guardAction(async () => {
              const nextQueue = await adminApiClient.runRiskScan(session.token);
              setDashboard((prev) => (prev ? { ...prev, queue: nextQueue } : prev));
            });
          }}
          onValidateWithdrawal={(payload: WithdrawalValidationRequest) => adminApiClient.validateWithdrawal(session.token, payload)}
        />
      ) : null}

      {dashboard && currentNav === 'users' ? (
        <UsersPage
          dashboard={dashboard}
          copy={text.users}
          onUpdateLimit={async (userId, limit) => {
            await guardAction(async () => {
              await adminApiClient.updateUserLimit(session.token, userId, limit);
              setDashboard((prev) =>
                prev
                  ? {
                      ...prev,
                      users: prev.users.map((user) => (user.id === userId ? { ...user, sendLimitUsd: limit } : user))
                    }
                  : prev
              );
            });
          }}
        />
      ) : null}

      {dashboard && currentNav === 'policies' ? (
        <PoliciesPage
          dashboard={dashboard}
          copy={text.policies}
          onUpdatePolicy={async (key, value) => {
            await guardAction(async () => {
              const updated = await adminApiClient.updatePolicy(session.token, key, value);
              setDashboard((prev) =>
                prev
                  ? {
                      ...prev,
                      policies: prev.policies.map((policy) => (policy.key === key ? updated : policy))
                    }
                  : prev
              );
            });
          }}
        />
      ) : null}

      {dashboard && currentNav === 'audit' ? <AuditPage dashboard={dashboard} copy={text.audit} /> : null}

      {currentNav === 'content' ? (
        <ContentPage
          items={contentItems}
          clickLogs={discoverClickLogs}
          clickSummary={discoverClickSummary}
          permissions={contentRolePermissions[session.role]}
          copy={text.content}
          onRefreshAuto={async () => {
            await guardAction(async () => {
              await adminApiClient.refreshContentFeed(session.role, session.email);
              await loadContent();
            });
          }}
          onCreate={async (payload) => {
            await guardAction(async () => {
              await adminApiClient.createContentItem(payload, session.role, session.email);
              await loadContent();
            });
          }}
          onUpdate={async (id, payload) => {
            await guardAction(async () => {
              await adminApiClient.updateContentItem(id, payload, session.role, session.email);
              await loadContent();
            });
          }}
          onDelete={async (id) => {
            await guardAction(async () => {
              await adminApiClient.deleteContentItem(id, session.role, session.email);
              await loadContent();
            });
          }}
          onUploadImage={async (file) => {
            const dataBase64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = typeof reader.result === 'string' ? reader.result : '';
                const payload = result.includes(',') ? result.split(',')[1] || '' : result;
                resolve(payload);
              };
              reader.onerror = () => reject(new Error('Failed to read file.'));
              reader.readAsDataURL(file);
            });
            const uploaded = await adminApiClient.uploadContentImage(
              {
                fileName: file.name || 'discover-image',
                mimeType: file.type || 'image/png',
                dataBase64
              },
              session.role,
              session.email
            );
            await guardAction(async () => {
              await loadContent();
            });
            return uploaded.imageUrl;
          }}
        />
      ) : null}
    </AdminLayout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AdminConsole />
    </AuthProvider>
  );
}
