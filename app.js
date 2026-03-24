(() => {
  "use strict";

  const STORAGE_KEYS = {
    theme: "heptalabs_theme",
    lang: "heptalabs_lang",
    content: "heptalabs_content_v1",
    adminSession: "heptalabs_admin_session_v1",
    noticeSeen: "heptalabs_notice_seen_v1",
    qnaLastSubmitAt: "heptalabs_qna_last_submit_at_v1"
  };

  const SUPPORTED_LANGS = ["ko", "en", "zh"];
  const SUPPORTED_THEMES = ["day", "night"];
  const PRIMARY_MENU_IDS = ["about", "business", "infos", "help"];
  const QNA_MIN_SUBMIT_INTERVAL_MS = 30000;
  const LOCALE_BY_LANG = {
    ko: "ko-KR",
    en: "en-US",
    zh: "zh-CN"
  };

  const ADMIN_AUTH = {
    usernames: ["heptalabs", "heptalabs@gmail.com"],
    passwordHash: "cdc018604758228f4c6fdcb5b908ad5144b03f86d71cd1efababad46f74400b4",
    passwordFallback: "HeptaLabs@2026"
  };

  const UI_TEXT = {
    nav: {
      ko: { about: "회사소개", business: "비즈니스", infos: "정보", help: "도움말" },
      en: { about: "About", business: "Business", infos: "Infos", help: "Help" },
      zh: { about: "关于", business: "业务", infos: "资讯", help: "帮助" }
    },
    homeCards: {
      ko: ["핵심 비즈니스", "솔루션 스택", "운영 철학"],
      en: ["Core Business", "Solution Stack", "Operating Principles"],
      zh: ["核心业务", "方案栈", "运营理念"]
    },
    homeCardCta: {
      ko: "자세히 보기",
      en: "Explore",
      zh: "查看详情"
    },
    detail: {
      ko: {
        menuCaption: "Menu",
        pathPrefix: "현재 위치",
        contactCta: "문의하기",
        newsEmpty: "등록된 뉴스가 없습니다.",
        newsReadMore: "자세히 보기",
        noticeEmpty: "등록된 공지사항이 없습니다.",
        noticePopupBadge: "팝업 공지",
        qnaFormTitle: "문의 등록",
        qnaNameLabel: "이름",
        qnaPhoneLabel: "전화번호",
        qnaEmailLabel: "이메일",
        qnaQuestionLabel: "문의 내용",
        qnaSubmit: "문의 등록",
        qnaSuccess: "문의가 등록되었습니다. 빠르게 확인 후 답변드리겠습니다.",
        qnaListTitle: "문의 / 답변",
        qnaAnonymous: "익명",
        qnaPending: "답변 준비중",
        qnaNoEntries: "아직 등록된 문의가 없습니다.",
        qnaInvalidName: "이름을 2자 이상 입력해 주세요.",
        qnaInvalidPhone: "전화번호 형식이 올바르지 않습니다.",
        qnaInvalidEmail: "이메일 형식이 올바르지 않습니다.",
        qnaInvalidQuestion: "문의 내용은 5자 이상 입력해 주세요.",
        qnaSubmitCooldown: "연속 등록은 30초 후 다시 시도해 주세요.",
        popupLabel: "중요 공지",
        popupClose: "닫기",
        popupView: "공지 확인"
      },
      en: {
        menuCaption: "Menu",
        pathPrefix: "Path",
        contactCta: "Contact Us",
        newsEmpty: "No news posts available yet.",
        newsReadMore: "Read More",
        noticeEmpty: "No notices available yet.",
        noticePopupBadge: "Popup Notice",
        qnaFormTitle: "Submit an Inquiry",
        qnaNameLabel: "Name",
        qnaPhoneLabel: "Phone",
        qnaEmailLabel: "Email",
        qnaQuestionLabel: "Inquiry",
        qnaSubmit: "Send Inquiry",
        qnaSuccess: "Your inquiry has been submitted.",
        qnaListTitle: "Inquiries / Answers",
        qnaAnonymous: "Anonymous",
        qnaPending: "Answer pending",
        qnaNoEntries: "No inquiries yet.",
        qnaInvalidName: "Please enter at least 2 characters for your name.",
        qnaInvalidPhone: "Please enter a valid phone number.",
        qnaInvalidEmail: "Please enter a valid email address.",
        qnaInvalidQuestion: "Please enter at least 5 characters for your inquiry.",
        qnaSubmitCooldown: "Please wait 30 seconds before submitting again.",
        popupLabel: "Important Notice",
        popupClose: "Close",
        popupView: "View Notice"
      },
      zh: {
        menuCaption: "菜单",
        pathPrefix: "当前位置",
        contactCta: "联系我们",
        newsEmpty: "暂无新闻内容。",
        newsReadMore: "查看详情",
        noticeEmpty: "暂无公告。",
        noticePopupBadge: "弹窗公告",
        qnaFormTitle: "提交咨询",
        qnaNameLabel: "姓名",
        qnaPhoneLabel: "电话",
        qnaEmailLabel: "邮箱",
        qnaQuestionLabel: "咨询内容",
        qnaSubmit: "提交咨询",
        qnaSuccess: "咨询已提交，我们会尽快回复。",
        qnaListTitle: "咨询 / 回复",
        qnaAnonymous: "匿名",
        qnaPending: "待回复",
        qnaNoEntries: "暂无咨询记录。",
        qnaInvalidName: "姓名请至少输入 2 个字符。",
        qnaInvalidPhone: "请输入有效的电话号码。",
        qnaInvalidEmail: "请输入有效的邮箱地址。",
        qnaInvalidQuestion: "咨询内容请至少输入 5 个字符。",
        qnaSubmitCooldown: "请在 30 秒后再次提交。",
        popupLabel: "重要公告",
        popupClose: "关闭",
        popupView: "查看公告"
      }
    },
    admin: {
      ko: {
        title: "Hepta Labs Content Admin",
        subtitle: "로컬 CMS로 메뉴별 다국어 콘텐츠를 편집하고 즉시 반영할 수 있습니다.",
        homeLink: "홈",
        detailLink: "상세 미리보기",
        selectHeading: "콘텐츠 선택",
        labelMenu: "메뉴",
        labelItem: "항목",
        labelLanguage: "편집 언어",
        preview: "선택 항목 미리보기",
        editHeading: "콘텐츠 편집",
        labelTitle: "제목",
        labelSubtitle: "부제",
        labelFeatureImage: "대표 이미지 URL",
        labelFeatureAlt: "대표 이미지 ALT",
        labelFeatureUpload: "대표 이미지 업로드",
        sectionsHeading: "섹션",
        sectionHeadingLabel: "섹션 제목",
        sectionBodyLabel: "섹션 본문",
        sectionImageLabel: "섹션 이미지 URL",
        sectionImageUploadLabel: "섹션 이미지 업로드",
        addSection: "섹션 추가",
        save: "저장",
        resetItem: "현재 항목 초기화",
        resetAll: "전체 초기화",
        export: "JSON 내보내기",
        import: "JSON 가져오기",
        jsonHeading: "현재 언어 JSON",
        statusSaved: "저장되었습니다.",
        statusResetItem: "현재 항목이 기본값으로 복원되었습니다.",
        statusResetAll: "전체 콘텐츠가 기본값으로 복원되었습니다.",
        statusImportOk: "JSON을 성공적으로 불러왔습니다.",
        statusImportFail: "유효하지 않은 JSON 형식입니다.",
        statusExport: "JSON 파일을 내보냈습니다.",
        confirmResetAll: "전체 콘텐츠를 기본값으로 되돌릴까요?",
        logout: "로그아웃",
        authTitle: "관리자 로그인",
        authSubtitle: "어드민 페이지는 ID와 비밀번호 인증 후 접근할 수 있습니다.",
        authIdLabel: "아이디",
        authPasswordLabel: "비밀번호",
        authSubmit: "로그인",
        authNote: "권한이 없는 경우 관리자에게 계정을 문의하세요.",
        authInvalid: "아이디 또는 비밀번호가 올바르지 않습니다.",
        authLoggedOut: "로그아웃되었습니다.",
        advancedHeading: "고급 CMS 모듈",
        advancedSubtitle: "뉴스/공지/QnA/홈 콘텐츠를 별도 모듈로 운영합니다.",
        moduleNews: "News",
        moduleNotice: "Notice",
        moduleQna: "QnA",
        moduleSite: "Site",
        moduleSaved: "모듈 내용이 저장되었습니다.",
        moduleDeleted: "항목이 삭제되었습니다.",
        moduleCreated: "새 항목이 생성되었습니다.",
        newsSelectLabel: "뉴스 선택",
        newsCreate: "새 뉴스",
        newsDelete: "뉴스 삭제",
        newsDateLabel: "게시 일시",
        newsImageLabel: "이미지 URL",
        newsImageAltLabel: "이미지 ALT",
        newsImageUploadLabel: "이미지 업로드",
        newsTitleLabel: "뉴스 제목",
        newsExcerptLabel: "요약",
        newsBodyLabel: "본문",
        newsSave: "뉴스 저장",
        newsEmpty: "뉴스가 없습니다. 새 뉴스를 생성하세요.",
        noticeSelectLabel: "공지 선택",
        noticeCreate: "새 공지",
        noticeDelete: "공지 삭제",
        noticeDateLabel: "게시 일시",
        noticeImageLabel: "이미지 URL",
        noticeImageAltLabel: "이미지 ALT",
        noticeImageUploadLabel: "이미지 업로드",
        noticeTitleLabel: "공지 제목",
        noticeBodyLabel: "공지 내용",
        noticePopupLabel: "첫 접속 팝업에 노출",
        noticeSave: "공지 저장",
        noticeEmpty: "공지가 없습니다. 새 공지를 생성하세요.",
        qnaSelectLabel: "문의 선택",
        qnaEmpty: "등록된 문의가 없습니다.",
        qnaNameLabel: "이름",
        qnaPhoneLabel: "전화번호",
        qnaEmailLabel: "이메일",
        qnaQuestionLabel: "문의 내용",
        qnaAnswerLabel: "답변",
        qnaCreatedAtLabel: "문의 일시",
        qnaAnsweredAtLabel: "답변 일시",
        qnaSaveAnswer: "답변 저장",
        qnaDelete: "문의 삭제",
        siteHeroHeading: "홈 히어로",
        siteKickerLabel: "키커",
        siteTitleLabel: "메인 타이틀",
        siteLine1Label: "본문 1",
        siteLine2Label: "본문 2",
        siteLine3Label: "본문 3",
        sitePrimaryCtaLabel: "메인 CTA",
        siteSecondaryCtaLabel: "보조 CTA",
        siteHeroImageLabel: "홈 이미지 URL",
        siteHeroImageAltLabel: "홈 이미지 ALT",
        siteHeroImageUploadLabel: "홈 이미지 업로드",
        siteFooterHeading: "푸터",
        siteFooterCopyrightLabel: "저작권 문구",
        siteFooterCommunityLabel: "커뮤니티 문구",
        siteSave: "홈/푸터 저장"
      },
      en: {
        title: "Hepta Labs Content Admin",
        subtitle: "Edit multilingual menu content with a local CMS and apply changes instantly.",
        homeLink: "Home",
        detailLink: "Detail Preview",
        selectHeading: "Content Selection",
        labelMenu: "Menu",
        labelItem: "Item",
        labelLanguage: "Edit Language",
        preview: "Preview Selected Item",
        editHeading: "Content Editor",
        labelTitle: "Title",
        labelSubtitle: "Subtitle",
        labelFeatureImage: "Feature Image URL",
        labelFeatureAlt: "Feature Image ALT",
        labelFeatureUpload: "Upload Feature Image",
        sectionsHeading: "Sections",
        sectionHeadingLabel: "Section Heading",
        sectionBodyLabel: "Section Body",
        sectionImageLabel: "Section Image URL",
        sectionImageUploadLabel: "Upload Section Image",
        addSection: "Add Section",
        save: "Save",
        resetItem: "Reset Current Item",
        resetAll: "Reset All",
        export: "Export JSON",
        import: "Import JSON",
        jsonHeading: "Current Language JSON",
        statusSaved: "Saved successfully.",
        statusResetItem: "Current item was restored to default.",
        statusResetAll: "All content was restored to default.",
        statusImportOk: "JSON was imported successfully.",
        statusImportFail: "Invalid JSON format.",
        statusExport: "JSON file exported.",
        confirmResetAll: "Reset all content to defaults?",
        logout: "Logout",
        authTitle: "Admin Sign In",
        authSubtitle: "Access to the admin page requires a valid ID and password.",
        authIdLabel: "ID",
        authPasswordLabel: "Password",
        authSubmit: "Sign In",
        authNote: "If you need access, contact an administrator.",
        authInvalid: "Invalid ID or password.",
        authLoggedOut: "You have been logged out.",
        advancedHeading: "Advanced CMS Modules",
        advancedSubtitle: "Operate News / Notice / QnA / Home content with dedicated modules.",
        moduleNews: "News",
        moduleNotice: "Notice",
        moduleQna: "QnA",
        moduleSite: "Site",
        moduleSaved: "Module content saved.",
        moduleDeleted: "Entry deleted.",
        moduleCreated: "New entry created.",
        newsSelectLabel: "Select News",
        newsCreate: "New News",
        newsDelete: "Delete",
        newsDateLabel: "Published At",
        newsImageLabel: "Image URL",
        newsImageAltLabel: "Image ALT",
        newsImageUploadLabel: "Upload Image",
        newsTitleLabel: "Title",
        newsExcerptLabel: "Excerpt",
        newsBodyLabel: "Body",
        newsSave: "Save News",
        newsEmpty: "No news posts yet. Create one.",
        noticeSelectLabel: "Select Notice",
        noticeCreate: "New Notice",
        noticeDelete: "Delete",
        noticeDateLabel: "Published At",
        noticeImageLabel: "Image URL",
        noticeImageAltLabel: "Image ALT",
        noticeImageUploadLabel: "Upload Image",
        noticeTitleLabel: "Title",
        noticeBodyLabel: "Body",
        noticePopupLabel: "Show as first-visit popup",
        noticeSave: "Save Notice",
        noticeEmpty: "No notices yet. Create one.",
        qnaSelectLabel: "Select Inquiry",
        qnaEmpty: "No inquiries yet.",
        qnaNameLabel: "Name",
        qnaPhoneLabel: "Phone",
        qnaEmailLabel: "Email",
        qnaQuestionLabel: "Question",
        qnaAnswerLabel: "Answer",
        qnaCreatedAtLabel: "Asked At",
        qnaAnsweredAtLabel: "Answered At",
        qnaSaveAnswer: "Save Answer",
        qnaDelete: "Delete Inquiry",
        siteHeroHeading: "Home Hero",
        siteKickerLabel: "Kicker",
        siteTitleLabel: "Main Title",
        siteLine1Label: "Line 1",
        siteLine2Label: "Line 2",
        siteLine3Label: "Line 3",
        sitePrimaryCtaLabel: "Primary CTA",
        siteSecondaryCtaLabel: "Secondary CTA",
        siteHeroImageLabel: "Home Image URL",
        siteHeroImageAltLabel: "Home Image ALT",
        siteHeroImageUploadLabel: "Upload Home Image",
        siteFooterHeading: "Footer",
        siteFooterCopyrightLabel: "Copyright",
        siteFooterCommunityLabel: "Community",
        siteSave: "Save Home/Footer"
      },
      zh: {
        title: "Hepta Labs 内容管理",
        subtitle: "通过本地 CMS 编辑多语言菜单内容并即时应用。",
        homeLink: "首页",
        detailLink: "详情预览",
        selectHeading: "内容选择",
        labelMenu: "菜单",
        labelItem: "条目",
        labelLanguage: "编辑语言",
        preview: "预览当前条目",
        editHeading: "内容编辑",
        labelTitle: "标题",
        labelSubtitle: "副标题",
        labelFeatureImage: "主图 URL",
        labelFeatureAlt: "主图 ALT",
        labelFeatureUpload: "上传主图",
        sectionsHeading: "段落",
        sectionHeadingLabel: "段落标题",
        sectionBodyLabel: "段落内容",
        sectionImageLabel: "段落图片 URL",
        sectionImageUploadLabel: "上传段落图片",
        addSection: "新增段落",
        save: "保存",
        resetItem: "重置当前条目",
        resetAll: "全部重置",
        export: "导出 JSON",
        import: "导入 JSON",
        jsonHeading: "当前语言 JSON",
        statusSaved: "已保存。",
        statusResetItem: "当前条目已恢复默认值。",
        statusResetAll: "全部内容已恢复默认值。",
        statusImportOk: "JSON 导入成功。",
        statusImportFail: "JSON 格式无效。",
        statusExport: "JSON 文件已导出。",
        confirmResetAll: "确定将全部内容重置为默认值吗？",
        logout: "退出登录",
        authTitle: "管理员登录",
        authSubtitle: "访问管理页面前需要通过账号和密码验证。",
        authIdLabel: "账号",
        authPasswordLabel: "密码",
        authSubmit: "登录",
        authNote: "如需权限，请联系管理员。",
        authInvalid: "账号或密码不正确。",
        authLoggedOut: "已退出登录。",
        advancedHeading: "高级 CMS 模块",
        advancedSubtitle: "通过独立模块管理 News / Notice / QnA / 首页内容。",
        moduleNews: "News",
        moduleNotice: "Notice",
        moduleQna: "QnA",
        moduleSite: "Site",
        moduleSaved: "模块内容已保存。",
        moduleDeleted: "条目已删除。",
        moduleCreated: "已创建新条目。",
        newsSelectLabel: "选择新闻",
        newsCreate: "新增新闻",
        newsDelete: "删除",
        newsDateLabel: "发布时间",
        newsImageLabel: "图片 URL",
        newsImageAltLabel: "图片 ALT",
        newsImageUploadLabel: "上传图片",
        newsTitleLabel: "标题",
        newsExcerptLabel: "摘要",
        newsBodyLabel: "正文",
        newsSave: "保存新闻",
        newsEmpty: "暂无新闻，请先新增。",
        noticeSelectLabel: "选择公告",
        noticeCreate: "新增公告",
        noticeDelete: "删除",
        noticeDateLabel: "发布时间",
        noticeImageLabel: "图片 URL",
        noticeImageAltLabel: "图片 ALT",
        noticeImageUploadLabel: "上传图片",
        noticeTitleLabel: "标题",
        noticeBodyLabel: "内容",
        noticePopupLabel: "首访弹窗展示",
        noticeSave: "保存公告",
        noticeEmpty: "暂无公告，请先新增。",
        qnaSelectLabel: "选择咨询",
        qnaEmpty: "暂无咨询记录。",
        qnaNameLabel: "姓名",
        qnaPhoneLabel: "电话",
        qnaEmailLabel: "邮箱",
        qnaQuestionLabel: "咨询内容",
        qnaAnswerLabel: "回复",
        qnaCreatedAtLabel: "咨询时间",
        qnaAnsweredAtLabel: "回复时间",
        qnaSaveAnswer: "保存回复",
        qnaDelete: "删除咨询",
        siteHeroHeading: "首页 Hero",
        siteKickerLabel: "前导语",
        siteTitleLabel: "主标题",
        siteLine1Label: "正文 1",
        siteLine2Label: "正文 2",
        siteLine3Label: "正文 3",
        sitePrimaryCtaLabel: "主 CTA",
        siteSecondaryCtaLabel: "次 CTA",
        siteHeroImageLabel: "首页图片 URL",
        siteHeroImageAltLabel: "首页图片 ALT",
        siteHeroImageUploadLabel: "上传首页图片",
        siteFooterHeading: "页脚",
        siteFooterCopyrightLabel: "版权文案",
        siteFooterCommunityLabel: "社区文案",
        siteSave: "保存首页/页脚"
      }
    }
  };

  const defaults = window.HeptaContentDefaults;
  if (!defaults || !Array.isArray(defaults.menus)) {
    return;
  }

  const deepClone = (value) => JSON.parse(JSON.stringify(value));
  const asString = (value) => (typeof value === "string" ? value : "");
  const nowIso = () => new Date().toISOString();

  const toHex = (buffer) =>
    Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

  const normalizeAdminId = (value) => String(value || "").trim().toLowerCase();
  const normalizeAdminPassword = (value) => String(value || "").trim();

  const createEntryId = (prefix) =>
    `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const ensureLangMap = (value, fallback = {}) => {
    const source = value && typeof value === "object" ? value : {};
    const fallbackMap = fallback && typeof fallback === "object" ? fallback : {};

    return {
      ko: asString(source.ko || fallbackMap.ko || ""),
      en: asString(source.en || fallbackMap.en || ""),
      zh: asString(source.zh || fallbackMap.zh || "")
    };
  };

  const normalizeDateIso = (value, fallback = null) => {
    if (value) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    if (fallback) {
      const fallbackDate = new Date(fallback);
      if (!Number.isNaN(fallbackDate.getTime())) {
        return fallbackDate.toISOString();
      }
    }

    return nowIso();
  };

  const ensureSection = (value, fallback = {}) => {
    const source = value && typeof value === "object" ? value : {};
    const fallbackSection = fallback && typeof fallback === "object" ? fallback : {};

    return {
      heading: asString(source.heading || fallbackSection.heading),
      body: asString(source.body || fallbackSection.body),
      image: asString(source.image || fallbackSection.image || "")
    };
  };

  const ensureItemTranslation = (value, fallback = {}) => {
    const source = value && typeof value === "object" ? value : {};
    const fallbackTranslation = fallback && typeof fallback === "object" ? fallback : {};

    const sourceSections = Array.isArray(source.sections) ? source.sections : null;
    const fallbackSections = Array.isArray(fallbackTranslation.sections)
      ? fallbackTranslation.sections
      : [];
    const sectionsToUse = sourceSections || fallbackSections;

    return {
      title: asString(source.title || fallbackTranslation.title),
      subtitle: asString(source.subtitle || fallbackTranslation.subtitle),
      featureImage: asString(source.featureImage || fallbackTranslation.featureImage || ""),
      featureImageAlt: ensureLangMap(source.featureImageAlt, fallbackTranslation.featureImageAlt),
      sections: sectionsToUse.map((section, index) =>
        ensureSection(section, fallbackSections[index] || {})
      )
    };
  };

  const ensurePostTranslation = (value, fallback = {}) => {
    const source = value && typeof value === "object" ? value : {};
    const fallbackTranslation = fallback && typeof fallback === "object" ? fallback : {};

    return {
      title: asString(source.title || fallbackTranslation.title),
      excerpt: asString(source.excerpt || fallbackTranslation.excerpt),
      body: asString(source.body || fallbackTranslation.body)
    };
  };

  const ensurePostTranslations = (value, fallback = {}) => {
    const source = value && typeof value === "object" ? value : {};
    const fallbackMap = fallback && typeof fallback === "object" ? fallback : {};

    return {
      ko: ensurePostTranslation(source.ko, fallbackMap.ko),
      en: ensurePostTranslation(source.en, fallbackMap.en),
      zh: ensurePostTranslation(source.zh, fallbackMap.zh)
    };
  };

  const makeDefaultDynamic = () => ({
    newsPosts: [
      {
        id: "news-infra-202603",
        createdAt: "2026-03-20T09:00:00.000Z",
        updatedAt: "2026-03-20T09:00:00.000Z",
        image: "",
        imageAlt: {
          ko: "인프라 운영 업데이트",
          en: "Infrastructure operations update",
          zh: "基础设施运营更新"
        },
        translations: {
          ko: {
            title: "운영 자동화 체계 고도화",
            excerpt: "AI 트레이딩 운영지표와 리스크 모니터링 체계를 업데이트했습니다.",
            body:
              "Hepta Labs는 AI 트레이딩 운영 대시보드의 지표 체계를 개편했습니다.\\n리스크 신호를 더 빠르게 감지하도록 알림 구조를 재설계했고, 운영 대응 시간을 단축했습니다."
          },
          en: {
            title: "Operations Automation Upgrade",
            excerpt: "We upgraded AI trading metrics and risk monitoring workflows.",
            body:
              "Hepta Labs updated the metric architecture of its AI trading operations dashboard.\\nBy redesigning alert flows for faster risk detection, we reduced operational response time."
          },
          zh: {
            title: "运营自动化体系升级",
            excerpt: "我们更新了 AI 交易指标与风控监控流程。",
            body:
              "Hepta Labs 完成了 AI 交易运维看板指标体系升级。\\n通过优化风险告警流程，我们显著缩短了运营响应时间。"
          }
        }
      },
      {
        id: "news-storage-202603",
        createdAt: "2026-03-12T04:20:00.000Z",
        updatedAt: "2026-03-12T04:20:00.000Z",
        image: "",
        imageAlt: {
          ko: "스토리지 인프라 확장",
          en: "Storage infrastructure expansion",
          zh: "存储基础设施扩展"
        },
        translations: {
          ko: {
            title: "Web3.0 스토리지 확장 프로젝트 진행",
            excerpt: "분산 스토리지 처리량과 복구 자동화 범위를 확대했습니다.",
            body:
              "Web3.0 스토리지 운영 프로젝트에서 처리량을 개선하고 복구 자동화를 확장했습니다.\\n대규모 데이터 운영 환경에서도 안정적인 가용성을 유지할 수 있도록 운영 시나리오를 고도화했습니다."
          },
          en: {
            title: "Web3.0 Storage Expansion in Progress",
            excerpt: "Throughput and automated recovery coverage were expanded.",
            body:
              "In our Web3.0 storage operations program, we improved throughput and expanded automated recovery scope.\\nOperational scenarios were refined to maintain consistent availability under high data workloads."
          },
          zh: {
            title: "Web3.0 存储扩展项目推进中",
            excerpt: "处理能力与自动恢复覆盖范围已进一步提升。",
            body:
              "在 Web3.0 存储运营项目中，我们提升了处理性能并扩大了自动恢复范围。\\n通过优化运维场景，确保在大规模数据负载下保持稳定可用性。"
          }
        }
      }
    ],
    notices: [
      {
        id: "notice-maintenance-202603",
        createdAt: "2026-03-18T01:00:00.000Z",
        updatedAt: "2026-03-18T01:00:00.000Z",
        popup: true,
        image: "",
        imageAlt: {
          ko: "정기 점검 공지",
          en: "Maintenance notice",
          zh: "维护公告"
        },
        translations: {
          ko: {
            title: "정기 점검 안내",
            excerpt: "서비스 안정성 확보를 위한 점검 일정 안내",
            body:
              "서비스 안정성 향상을 위해 정기 점검이 진행됩니다.\\n점검 시간 동안 일부 기능이 일시 제한될 수 있으며, 완료 즉시 정상화됩니다."
          },
          en: {
            title: "Scheduled Maintenance Notice",
            excerpt: "Maintenance schedule for service stability improvement",
            body:
              "Scheduled maintenance will be performed to improve service stability.\\nSome features may be temporarily limited during the window and will be restored immediately after completion."
          },
          zh: {
            title: "定期维护通知",
            excerpt: "为提升服务稳定性安排的维护计划",
            body:
              "为提升服务稳定性，我们将进行定期维护。\\n维护期间部分功能可能暂时受限，维护完成后将立即恢复。"
          }
        }
      }
    ],
    inquiries: []
  });

  const normalizeNewsPost = (value, fallback = {}) => {
    const source = value && typeof value === "object" ? value : {};
    const fallbackPost = fallback && typeof fallback === "object" ? fallback : {};

    return {
      id: asString(source.id || fallbackPost.id) || createEntryId("news"),
      createdAt: normalizeDateIso(source.createdAt, fallbackPost.createdAt),
      updatedAt: normalizeDateIso(source.updatedAt, source.createdAt || fallbackPost.updatedAt),
      image: asString(source.image || fallbackPost.image || ""),
      imageAlt: ensureLangMap(source.imageAlt, fallbackPost.imageAlt),
      translations: ensurePostTranslations(source.translations, fallbackPost.translations)
    };
  };

  const normalizeNoticePost = (value, fallback = {}) => {
    const source = value && typeof value === "object" ? value : {};
    const fallbackNotice = fallback && typeof fallback === "object" ? fallback : {};

    return {
      id: asString(source.id || fallbackNotice.id) || createEntryId("notice"),
      createdAt: normalizeDateIso(source.createdAt, fallbackNotice.createdAt),
      updatedAt: normalizeDateIso(source.updatedAt, source.createdAt || fallbackNotice.updatedAt),
      popup:
        typeof source.popup === "boolean"
          ? source.popup
          : typeof fallbackNotice.popup === "boolean"
            ? fallbackNotice.popup
            : false,
      image: asString(source.image || fallbackNotice.image || ""),
      imageAlt: ensureLangMap(source.imageAlt, fallbackNotice.imageAlt),
      translations: ensurePostTranslations(source.translations, fallbackNotice.translations)
    };
  };

  const normalizeInquiry = (value) => {
    const source = value && typeof value === "object" ? value : {};
    const answers = ensureLangMap(source.answers);

    if (!answers.ko && typeof source.answer === "string") {
      answers.ko = source.answer;
    }

    const hasAnswer = SUPPORTED_LANGS.some((lang) => answers[lang].trim().length > 0);

    return {
      id: asString(source.id) || createEntryId("qna"),
      name: asString(source.name),
      phone: asString(source.phone),
      email: asString(source.email),
      question: asString(source.question),
      lang: SUPPORTED_LANGS.includes(source.lang) ? source.lang : "ko",
      createdAt: normalizeDateIso(source.createdAt),
      answers,
      answeredAt: hasAnswer ? normalizeDateIso(source.answeredAt) : "",
      status: hasAnswer ? "answered" : "pending"
    };
  };

  const normalizeMenus = (menus) => {
    const fallbackMenus = Array.isArray(defaults.menus) ? defaults.menus : [];
    const sourceMenus = Array.isArray(menus) ? menus : [];
    const menuMap = new Map(sourceMenus.map((menu) => [menu.id, menu]));

    return fallbackMenus.map((fallbackMenu) => {
      const sourceMenu = menuMap.get(fallbackMenu.id) || {};
      const sourceItems = Array.isArray(sourceMenu.items) ? sourceMenu.items : [];
      const itemMap = new Map(sourceItems.map((item) => [item.id, item]));

      const items = fallbackMenu.items.map((fallbackItem) => {
        const sourceItem = itemMap.get(fallbackItem.id) || {};
        const sourceTranslations =
          sourceItem.translations && typeof sourceItem.translations === "object"
            ? sourceItem.translations
            : {};
        const fallbackTranslations =
          fallbackItem.translations && typeof fallbackItem.translations === "object"
            ? fallbackItem.translations
            : {};

        const translations = {};
        SUPPORTED_LANGS.forEach((lang) => {
          translations[lang] = ensureItemTranslation(sourceTranslations[lang], fallbackTranslations[lang]);
        });

        return {
          id: fallbackItem.id,
          labels: ensureLangMap(sourceItem.labels, fallbackItem.labels),
          translations
        };
      });

      return {
        id: fallbackMenu.id,
        labels: ensureLangMap(sourceMenu.labels, fallbackMenu.labels),
        items
      };
    });
  };

  const normalizeSite = (site) => {
    const source = site && typeof site === "object" ? site : {};
    const fallback = defaults.site && typeof defaults.site === "object" ? defaults.site : {};

    const hero = {};
    const footer = {};

    SUPPORTED_LANGS.forEach((lang) => {
      const sourceHero = source.hero && source.hero[lang] ? source.hero[lang] : {};
      const fallbackHero = fallback.hero && fallback.hero[lang] ? fallback.hero[lang] : {};
      const sourceLines = Array.isArray(sourceHero.lines) ? sourceHero.lines : null;
      const fallbackLines = Array.isArray(fallbackHero.lines) ? fallbackHero.lines : [];

      hero[lang] = {
        kicker: asString(sourceHero.kicker || fallbackHero.kicker),
        title: asString(sourceHero.title || fallbackHero.title),
        lines: [0, 1, 2].map((index) =>
          asString((sourceLines && sourceLines[index]) || fallbackLines[index] || "")
        ),
        ctaPrimary: asString(sourceHero.ctaPrimary || fallbackHero.ctaPrimary),
        ctaSecondary: asString(sourceHero.ctaSecondary || fallbackHero.ctaSecondary)
      };

      const sourceFooter = source.footer && source.footer[lang] ? source.footer[lang] : {};
      const fallbackFooter = fallback.footer && fallback.footer[lang] ? fallback.footer[lang] : {};

      footer[lang] = {
        copyright: asString(sourceFooter.copyright || fallbackFooter.copyright),
        community: asString(sourceFooter.community || fallbackFooter.community)
      };
    });

    const sourceMedia = source.media && typeof source.media === "object" ? source.media : {};
    const fallbackMedia = fallback.media && typeof fallback.media === "object" ? fallback.media : {};

    return {
      hero,
      footer,
      media: {
        heroImage: asString(sourceMedia.heroImage || fallbackMedia.heroImage || ""),
        heroImageAlt: ensureLangMap(sourceMedia.heroImageAlt, fallbackMedia.heroImageAlt)
      }
    };
  };

  const normalizeDynamic = (dynamic) => {
    const defaultDynamic = makeDefaultDynamic();
    const source = dynamic && typeof dynamic === "object" ? dynamic : {};

    const hasNewsPosts =
      Object.prototype.hasOwnProperty.call(source, "newsPosts") && Array.isArray(source.newsPosts);
    const hasNotices =
      Object.prototype.hasOwnProperty.call(source, "notices") && Array.isArray(source.notices);

    const sourceNews = hasNewsPosts ? source.newsPosts : defaultDynamic.newsPosts;
    const sourceNotices = hasNotices ? source.notices : defaultDynamic.notices;

    const newsFallback = defaultDynamic.newsPosts;
    const noticeFallback = defaultDynamic.notices;

    const normalizedNews = sourceNews.map((post, index) =>
      normalizeNewsPost(post, newsFallback[index] || {})
    );

    const normalizedNotices = sourceNotices.map((notice, index) =>
      normalizeNoticePost(notice, noticeFallback[index] || {})
    );

    const sourceInquiries = Array.isArray(source.inquiries) ? source.inquiries : [];

    return {
      newsPosts: normalizedNews,
      notices: normalizedNotices,
      inquiries: sourceInquiries.map((entry) => normalizeInquiry(entry))
    };
  };

  const normalizeContentShape = (value) => {
    const source = value && typeof value === "object" ? value : {};

    return {
      version: Number(source.version || defaults.version || 1),
      site: normalizeSite(source.site),
      menus: normalizeMenus(source.menus),
      dynamic: normalizeDynamic(source.dynamic)
    };
  };

  const isValidContent = (value) => {
    if (!value || typeof value !== "object" || !Array.isArray(value.menus)) {
      return false;
    }

    for (const menu of value.menus) {
      if (!menu || typeof menu.id !== "string" || !Array.isArray(menu.items)) {
        return false;
      }

      for (const item of menu.items) {
        if (!item || typeof item.id !== "string" || typeof item.translations !== "object") {
          return false;
        }

        for (const lang of SUPPORTED_LANGS) {
          const translation = item.translations[lang];
          if (!translation || typeof translation.title !== "string" || !Array.isArray(translation.sections)) {
            return false;
          }
        }
      }
    }

    return true;
  };

  const getPreferredTheme = () => {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    if (SUPPORTED_THEMES.includes(stored)) {
      return stored;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";
  };

  const getPreferredLang = () => {
    const stored = localStorage.getItem(STORAGE_KEYS.lang);
    if (SUPPORTED_LANGS.includes(stored)) {
      return stored;
    }
    return "ko";
  };

  const sha256Hex = async (value) => {
    if (!window.crypto || !window.crypto.subtle) {
      return null;
    }

    const encoded = new TextEncoder().encode(value);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", encoded);
    return toHex(hashBuffer);
  };

  const isAdminAuthenticated = () => {
    try {
      return sessionStorage.getItem(STORAGE_KEYS.adminSession) === "1";
    } catch (error) {
      return false;
    }
  };

  const setAdminAuthenticated = (active) => {
    try {
      if (active) {
        sessionStorage.setItem(STORAGE_KEYS.adminSession, "1");
      } else {
        sessionStorage.removeItem(STORAGE_KEYS.adminSession);
      }
    } catch (error) {
      return;
    }
  };

  const verifyAdminCredentials = async (id, password) => {
    const normalizedId = normalizeAdminId(id);
    const normalizedPassword = normalizeAdminPassword(password);
    if (!ADMIN_AUTH.usernames.includes(normalizedId)) {
      return false;
    }

    try {
      const hash = await sha256Hex(normalizedPassword);
      if (hash) {
        return hash === ADMIN_AUTH.passwordHash;
      }
    } catch (error) {
      return normalizedPassword === ADMIN_AUTH.passwordFallback;
    }

    return normalizedPassword === ADMIN_AUTH.passwordFallback;
  };

  const getContent = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.content);
      if (!raw) {
        return normalizeContentShape(deepClone(defaults));
      }

      const parsed = JSON.parse(raw);
      if (!isValidContent(parsed)) {
        return normalizeContentShape(deepClone(defaults));
      }

      return normalizeContentShape(parsed);
    } catch (error) {
      return normalizeContentShape(deepClone(defaults));
    }
  };

  let state = {
    theme: getPreferredTheme(),
    lang: getPreferredLang(),
    content: getContent()
  };

  const getLangText = (group, key = null) => {
    const byLang = group[state.lang] || group.en || group.ko;
    return key ? byLang[key] : byLang;
  };

  const encodeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const richText = (value) => encodeHtml(value).replaceAll("\n", "<br />");

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("file_read_failed"));
      reader.readAsDataURL(file);
    });

  const setTheme = (theme) => {
    state.theme = SUPPORTED_THEMES.includes(theme) ? theme : "day";
    document.documentElement.setAttribute("data-theme", state.theme);
    localStorage.setItem(STORAGE_KEYS.theme, state.theme);

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.textContent = state.theme === "night" ? "☼" : "◐";
      button.setAttribute(
        "aria-label",
        state.theme === "night" ? "Switch to day mode" : "Switch to night mode"
      );
    });
  };

  const setLang = (lang) => {
    state.lang = SUPPORTED_LANGS.includes(lang) ? lang : "ko";
    document.documentElement.lang = state.lang;
    localStorage.setItem(STORAGE_KEYS.lang, state.lang);

    document.querySelectorAll("[data-lang]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.lang === state.lang);
    });

    document.dispatchEvent(new CustomEvent("hepta:langchange", { detail: state.lang }));
  };

  const saveContent = (content) => {
    const normalized = normalizeContentShape(content);
    state.content = normalized;
    localStorage.setItem(STORAGE_KEYS.content, JSON.stringify(normalized));
  };

  const getMenu = (menuId) => state.content.menus.find((menu) => menu.id === menuId) || null;
  const getPublicMenus = () =>
    PRIMARY_MENU_IDS.map((menuId) => getMenu(menuId)).filter((menu) => Boolean(menu));

  const getItem = (menuId, itemId) => {
    const menu = getMenu(menuId);
    if (!menu) {
      return null;
    }
    return menu.items.find((item) => item.id === itemId) || null;
  };

  const isAdminRoutePath = /\/admin\/?$/.test(window.location.pathname);
  const routePrefix = isAdminRoutePath ? "../" : "./";

  const buildDetailUrl = (menuId, itemId, extraParams = null) => {
    const params = new URLSearchParams({
      menu: menuId,
      item: itemId
    });

    if (extraParams && typeof extraParams === "object") {
      Object.entries(extraParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined && String(value).trim() !== "") {
          params.set(key, String(value));
        }
      });
    }

    return `${routePrefix}detail.html?${params.toString()}`;
  };

  const toDatetimeLocalValue = (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hour}:${minute}`;
  };

  const fromDatetimeLocalValue = (value) => {
    if (!value) {
      return nowIso();
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return nowIso();
    }

    return date.toISOString();
  };

  const formatDisplayDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const locale = LOCALE_BY_LANG[state.lang] || "en-US";
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  };

  const sortByDateDesc = (a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return timeB - timeA;
  };

  const getPostTranslation = (post) =>
    (post.translations && (post.translations[state.lang] || post.translations.en || post.translations.ko)) || {
      title: "",
      excerpt: "",
      body: ""
    };

  const getLocalizedLabel = (value) =>
    asString((value && (value[state.lang] || value.en || value.ko)) || "");

  const getLocalizedAnswer = (entry) => {
    if (!entry || !entry.answers) {
      return "";
    }

    const preferred = asString(entry.answers[state.lang]);
    if (preferred) {
      return preferred;
    }

    const english = asString(entry.answers.en);
    if (english) {
      return english;
    }

    const korean = asString(entry.answers.ko);
    if (korean) {
      return korean;
    }

    return "";
  };

  const maskEmail = (email) => {
    const source = asString(email).trim();
    if (!source.includes("@")) {
      return source ? "***" : "";
    }

    const [local, domain] = source.split("@");
    if (!local || !domain) {
      return "***";
    }

    const localMasked =
      local.length <= 2
        ? `${local.slice(0, 1)}*`
        : `${local.slice(0, 1)}${"*".repeat(Math.max(local.length - 2, 2))}${local.slice(-1)}`;

    return `${localMasked}@${domain}`;
  };

  const maskPhone = (phone) => {
    const source = asString(phone).trim();
    if (!source) {
      return "";
    }

    const digits = source.replace(/\D/g, "");
    if (digits.length < 8) {
      return "***-***";
    }

    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}**-**${digits.slice(-2)}`;
  };

  const maskName = (name) => {
    const source = asString(name).trim();
    if (!source) {
      return "";
    }

    const chars = Array.from(source);
    if (chars.length === 1) {
      return `${chars[0]}*`;
    }

    if (chars.length === 2) {
      return `${chars[0]}*`;
    }

    return `${chars[0]}${"*".repeat(Math.max(chars.length - 2, 1))}${chars[chars.length - 1]}`;
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(asString(email).trim());

  const isValidPhone = (phone) => {
    const digits = asString(phone).replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15;
  };

  const getNoticeSeenIds = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.noticeSeen);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
    } catch (error) {
      return [];
    }
  };

  const markNoticeSeen = (noticeId) => {
    if (!noticeId) {
      return;
    }

    const ids = getNoticeSeenIds();
    if (ids.includes(noticeId)) {
      return;
    }

    ids.push(noticeId);
    localStorage.setItem(STORAGE_KEYS.noticeSeen, JSON.stringify(ids));
  };

  const initThemeAndLangControls = () => {
    setTheme(state.theme);
    setLang(state.lang);

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", () => setTheme(state.theme === "day" ? "night" : "day"));
    });

    document.querySelectorAll("[data-lang]").forEach((button) => {
      button.addEventListener("click", () => setLang(button.dataset.lang));
    });
  };

  const renderPrimaryNav = () => {
    const navText = getLangText(UI_TEXT.nav);
    const params = new URLSearchParams(window.location.search);
    const activeMenu = params.get("menu");
    const publicMenus = getPublicMenus();

    document.querySelectorAll("[data-primary-nav]").forEach((nav) => {
      nav.innerHTML = "";

      publicMenus.forEach((menu) => {
        const firstItem = menu.items[0];
        if (!firstItem) {
          return;
        }

        const anchor = document.createElement("a");
        anchor.href = buildDetailUrl(menu.id, firstItem.id);
        anchor.textContent = navText[menu.id] || menu.labels[state.lang] || menu.labels.en;

        if (activeMenu && activeMenu === menu.id) {
          anchor.classList.add("is-active");
        }

        nav.append(anchor);
      });
    });
  };

  const isAdminHref = (value) => {
    const href = asString(value).trim();
    if (!href) {
      return false;
    }

    try {
      const url = new URL(href, window.location.origin);
      const pathname = asString(url.pathname).toLowerCase();
      return pathname === "/admin" || pathname === "/admin/" || pathname.endsWith("/admin.html");
    } catch (error) {
      const normalized = href.toLowerCase().replace(/\?.*$/, "").replace(/#.*$/, "");
      return (
        normalized === "/admin" ||
        normalized === "/admin/" ||
        normalized === "./admin" ||
        normalized === "./admin/" ||
        normalized === "admin" ||
        normalized === "admin/" ||
        normalized === "admin.html" ||
        normalized.endsWith("/admin") ||
        normalized.endsWith("/admin/") ||
        normalized.endsWith("/admin.html")
      );
    }
  };

  const removePublicAdminEntryPoints = () => {
    if (document.body.dataset.page === "admin") {
      return;
    }

    const directTargets = document.querySelectorAll(
      ".site-header .admin-chip, .site-header [data-admin-link]"
    );
    directTargets.forEach((node) => node.remove());

    document.querySelectorAll(".site-header a").forEach((anchor) => {
      const href = anchor.getAttribute("href");
      const label = asString(anchor.textContent).trim().toLowerCase();
      if (isAdminHref(href) || label === "admin") {
        anchor.remove();
      }
    });
  };

  const renderFooter = () => {
    const footerText = state.content.site.footer[state.lang] || state.content.site.footer.en;
    const publicMenus = getPublicMenus();

    document.querySelectorAll("[data-footer-copyright]").forEach((element) => {
      element.textContent = footerText.copyright;
    });

    document.querySelectorAll("[data-footer-community]").forEach((element) => {
      element.textContent = footerText.community;
    });

    document.querySelectorAll("[data-footer-columns]").forEach((container) => {
      container.innerHTML = "";

      publicMenus.forEach((menu) => {
        const block = document.createElement("section");
        block.className = "footer-col";

        const heading = document.createElement("h3");
        heading.textContent = menu.labels[state.lang] || menu.labels.en;
        block.append(heading);

        const list = document.createElement("ul");
        menu.items.forEach((item) => {
          const li = document.createElement("li");
          const link = document.createElement("a");
          link.href = buildDetailUrl(menu.id, item.id);
          link.textContent = item.labels[state.lang] || item.labels.en;
          li.append(link);
          list.append(li);
        });

        block.append(list);
        container.append(block);
      });
    });
  };

  const renderHome = () => {
    const hero = state.content.site.hero[state.lang] || state.content.site.hero.en;

    const setText = (selector, value) => {
      const target = document.querySelector(selector);
      if (target) {
        target.textContent = value;
      }
    };

    setText("[data-home-kicker]", hero.kicker);
    setText("[data-home-title]", hero.title);
    setText("[data-home-line1]", hero.lines[0] || "");
    setText("[data-home-line2]", hero.lines[1] || "");
    setText("[data-home-line3]", hero.lines[2] || "");
    setText("[data-home-cta-primary]", hero.ctaPrimary);
    setText("[data-home-cta-secondary]", hero.ctaSecondary);

    const homeMediaWrap = document.querySelector("[data-home-media-wrap]");
    const homeMediaImg = document.querySelector("[data-home-media-img]");
    if (homeMediaWrap && homeMediaImg) {
      const imageUrl = asString(state.content.site.media.heroImage).trim();
      if (imageUrl) {
        homeMediaImg.src = imageUrl;
        homeMediaImg.alt = getLocalizedLabel(state.content.site.media.heroImageAlt) || hero.title;
        homeMediaWrap.hidden = false;
      } else {
        homeMediaImg.removeAttribute("src");
        homeMediaImg.alt = "";
        homeMediaWrap.hidden = true;
      }
    }

    const cards = document.querySelector("[data-home-cards]");
    if (!cards) {
      return;
    }

    const cardTitles = getLangText(UI_TEXT.homeCards);
    const cardCta = getLangText(UI_TEXT.homeCardCta);
    const businessMenu = getMenu("business");
    const aboutMenu = getMenu("about");
    const infoMenu = getMenu("infos");

    const businessLabels = businessMenu
      ? businessMenu.items.map((item) => item.labels[state.lang] || item.labels.en)
      : [];
    const aboutVisionLabel =
      aboutMenu && aboutMenu.items[1]
        ? aboutMenu.items[1].labels[state.lang] || aboutMenu.items[1].labels.en
        : "";
    const infoNewsLabel =
      infoMenu && infoMenu.items[0]
        ? infoMenu.items[0].labels[state.lang] || infoMenu.items[0].labels.en
        : "";

    const cardData = [
      {
        title: cardTitles[0],
        description: businessLabels.slice(0, 3).join(" · "),
        link: buildDetailUrl("business", "mining")
      },
      {
        title: cardTitles[1],
        description: businessLabels.slice(1).join(" · "),
        link: buildDetailUrl("business", "development")
      },
      {
        title: cardTitles[2],
        description: [aboutVisionLabel, infoNewsLabel].filter(Boolean).join(" · "),
        link: buildDetailUrl("about", "vision")
      }
    ];

    cards.innerHTML = "";
    cardData.forEach((card) => {
      const article = document.createElement("article");
      article.className = "spotlight-card";
      article.innerHTML = `<h2>${encodeHtml(card.title)}</h2><p>${encodeHtml(card.description)}</p><a href="${encodeHtml(
        card.link
      )}">${encodeHtml(cardCta)}</a>`;
      cards.append(article);
    });
  };

  const resolveDetailParams = () => {
    const params = new URLSearchParams(window.location.search);
    let menuId = params.get("menu");
    let itemId = params.get("item");
    const postId = params.get("post");

    const publicMenus = getPublicMenus();
    const firstMenu = publicMenus[0];

    if (!firstMenu) {
      return { menuId: "about", itemId: "hepta-labs", postId };
    }

    if (!menuId || !publicMenus.some((menu) => menu.id === menuId)) {
      menuId = firstMenu.id;
    }

    const selectedMenu = getMenu(menuId);
    if (!itemId || !getItem(menuId, itemId)) {
      itemId = selectedMenu.items[0].id;
    }

    return { menuId, itemId, postId };
  };

  const appendFeatureImage = (translation, target) => {
    const imageUrl = asString(translation.featureImage).trim();
    if (!imageUrl) {
      return;
    }

    const featureImage = document.createElement("img");
    featureImage.className = "detail-feature-image";
    featureImage.src = imageUrl;
    featureImage.alt = getLocalizedLabel(translation.featureImageAlt) || asString(translation.title);
    featureImage.loading = "lazy";
    target.append(featureImage);
  };

  const appendTranslationSections = (translation, target) => {
    translation.sections.forEach((section) => {
      const block = document.createElement("section");
      block.className = "detail-section";

      const imageUrl = asString(section.image).trim();
      block.innerHTML = `${
        imageUrl
          ? `<img class="detail-section-image" src="${encodeHtml(imageUrl)}" alt="${encodeHtml(
              section.heading || translation.title
            )}" loading="lazy" />`
          : ""
      }<h2>${encodeHtml(section.heading)}</h2><p>${richText(section.body)}</p>`;
      target.append(block);
    });
  };

  const truncateText = (value, length = 140) => {
    const plain = asString(value).replace(/\s+/g, " ").trim();
    if (plain.length <= length) {
      return plain;
    }
    return `${plain.slice(0, length)}...`;
  };

  const renderNewsDetail = (translation, target, selectedPostId) => {
    const detailText = getLangText(UI_TEXT.detail);

    appendFeatureImage(translation, target);

    const posts = [...state.content.dynamic.newsPosts].sort(sortByDateDesc);
    if (!posts.length) {
      const empty = document.createElement("p");
      empty.className = "detail-subtitle";
      empty.textContent = detailText.newsEmpty;
      target.append(empty);
      return;
    }

    const selected = posts.find((post) => post.id === selectedPostId) || posts[0];

    const grid = document.createElement("div");
    grid.className = "post-grid";

    posts.forEach((post) => {
      const postTranslation = getPostTranslation(post);
      const excerpt = postTranslation.excerpt || truncateText(postTranslation.body);
      const article = document.createElement("article");
      article.className = "post-card";
      if (selected.id === post.id) {
        article.classList.add("is-active");
      }

      article.innerHTML = `
        <a class="post-card-link" href="${encodeHtml(
          buildDetailUrl("infos", "news", { post: post.id })
        )}">
          ${
            post.image
              ? `<img class="post-card-cover" src="${encodeHtml(post.image)}" alt="${encodeHtml(
                  getLocalizedLabel(post.imageAlt) || postTranslation.title
                )}" loading="lazy" />`
              : ""
          }
          <div class="post-card-body">
            <p class="post-card-meta">${encodeHtml(formatDisplayDate(post.createdAt))}</p>
            <h3 class="post-card-title">${encodeHtml(postTranslation.title)}</h3>
            <p class="post-card-excerpt">${encodeHtml(excerpt)}</p>
            <span class="post-card-link-text">${encodeHtml(detailText.newsReadMore)}</span>
          </div>
        </a>
      `;

      grid.append(article);
    });

    target.append(grid);

    const selectedTranslation = getPostTranslation(selected);
    const expanded = document.createElement("article");
    expanded.className = "post-expanded";
    expanded.innerHTML = `
      <p class="post-card-meta">${encodeHtml(formatDisplayDate(selected.createdAt))}</p>
      <h2 class="post-card-title">${encodeHtml(selectedTranslation.title)}</h2>
      <p class="post-card-excerpt">${richText(selectedTranslation.body)}</p>
    `;
    target.append(expanded);
  };

  const renderNoticeDetail = (translation, target, selectedPostId) => {
    const detailText = getLangText(UI_TEXT.detail);

    appendFeatureImage(translation, target);

    const notices = [...state.content.dynamic.notices].sort(sortByDateDesc);
    if (!notices.length) {
      const empty = document.createElement("p");
      empty.className = "detail-subtitle";
      empty.textContent = detailText.noticeEmpty;
      target.append(empty);
      return;
    }

    const selected = notices.find((notice) => notice.id === selectedPostId) || notices[0];

    const grid = document.createElement("div");
    grid.className = "post-grid";

    notices.forEach((notice) => {
      const postTranslation = getPostTranslation(notice);
      const excerpt = postTranslation.excerpt || truncateText(postTranslation.body);
      const article = document.createElement("article");
      article.className = "post-card";
      if (selected.id === notice.id) {
        article.classList.add("is-active");
      }

      article.innerHTML = `
        <a class="post-card-link" href="${encodeHtml(
          buildDetailUrl("infos", "notice", { post: notice.id })
        )}">
          ${
            notice.image
              ? `<img class="post-card-cover" src="${encodeHtml(notice.image)}" alt="${encodeHtml(
                  getLocalizedLabel(notice.imageAlt) || postTranslation.title
                )}" loading="lazy" />`
              : ""
          }
          <div class="post-card-body">
            <p class="post-card-meta">${encodeHtml(formatDisplayDate(notice.createdAt))}</p>
            <h3 class="post-card-title">${encodeHtml(postTranslation.title)}</h3>
            <p class="post-card-excerpt">${encodeHtml(excerpt)}</p>
            ${
              notice.popup
                ? `<span class="post-card-badge">${encodeHtml(detailText.noticePopupBadge)}</span>`
                : ""
            }
          </div>
        </a>
      `;

      grid.append(article);
    });

    target.append(grid);

    const selectedTranslation = getPostTranslation(selected);
    const expanded = document.createElement("article");
    expanded.className = "post-expanded";
    expanded.innerHTML = `
      <p class="post-card-meta">${encodeHtml(formatDisplayDate(selected.createdAt))}</p>
      <h2 class="post-card-title">${encodeHtml(selectedTranslation.title)}</h2>
      <p class="post-card-excerpt">${richText(selectedTranslation.body)}</p>
    `;

    target.append(expanded);
  };

  const renderQnaPublicList = (target) => {
    const detailText = getLangText(UI_TEXT.detail);
    const entries = [...state.content.dynamic.inquiries].sort(sortByDateDesc);

    target.innerHTML = "";

    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "admin-inline-meta";
      empty.textContent = detailText.qnaNoEntries;
      target.append(empty);
      return;
    }

    entries.forEach((entry) => {
      const article = document.createElement("article");
      article.className = "qna-item";

      const answerText = getLocalizedAnswer(entry);
      const maskedName = maskName(entry.name) || detailText.qnaAnonymous;
      const maskedPhone = maskPhone(entry.phone);
      const maskedEmail = maskEmail(entry.email);
      const contactText = [maskedEmail, maskedPhone].filter(Boolean).join(" · ");
      article.innerHTML = `
        <div class="qna-item-head">
          <span class="qna-item-name">${encodeHtml(maskedName)}</span>
          <span class="qna-item-date">${encodeHtml(formatDisplayDate(entry.createdAt))}</span>
        </div>
        ${contactText ? `<p class="qna-item-contact">${encodeHtml(contactText)}</p>` : ""}
        <p class="qna-item-question">${richText(entry.question)}</p>
        <p class="qna-item-answer"><strong>A.</strong> ${
          answerText ? richText(answerText) : encodeHtml(detailText.qnaPending)
        }</p>
      `;

      target.append(article);
    });
  };

  const renderQnaDetail = (translation, target) => {
    const detailText = getLangText(UI_TEXT.detail);

    appendFeatureImage(translation, target);

    const form = document.createElement("form");
    form.className = "qna-form";
    form.innerHTML = `
      <h3>${encodeHtml(detailText.qnaFormTitle)}</h3>
      <div class="qna-form-grid">
        <div class="field-group">
          <label for="qna-name">${encodeHtml(detailText.qnaNameLabel)}</label>
          <input id="qna-name" name="name" type="text" required />
        </div>
        <div class="field-group">
          <label for="qna-phone">${encodeHtml(detailText.qnaPhoneLabel)}</label>
          <input id="qna-phone" name="phone" type="text" required />
        </div>
        <div class="field-group">
          <label for="qna-email">${encodeHtml(detailText.qnaEmailLabel)}</label>
          <input id="qna-email" name="email" type="email" required />
        </div>
      </div>
      <div class="field-group">
        <label for="qna-question">${encodeHtml(detailText.qnaQuestionLabel)}</label>
        <textarea id="qna-question" name="question" rows="6" required></textarea>
      </div>
      <button class="cta primary" type="submit">${encodeHtml(detailText.qnaSubmit)}</button>
      <p class="qna-submit-status" aria-live="polite"></p>
    `;

    const listHeading = document.createElement("h2");
    listHeading.textContent = detailText.qnaListTitle;
    listHeading.className = "post-card-title";

    const listWrap = document.createElement("div");
    listWrap.className = "qna-list";

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const status = form.querySelector(".qna-submit-status");
      const showStatus = (message, isError = false) => {
        if (!status) {
          return;
        }
        status.textContent = message;
        status.classList.toggle("is-error", isError);
      };

      const formData = new FormData(form);
      const name = asString(formData.get("name")).trim();
      const phone = asString(formData.get("phone")).trim();
      const email = asString(formData.get("email")).trim();
      const question = asString(formData.get("question")).trim();

      if (name.length < 2) {
        showStatus(detailText.qnaInvalidName, true);
        return;
      }

      if (!isValidPhone(phone)) {
        showStatus(detailText.qnaInvalidPhone, true);
        return;
      }

      if (!isValidEmail(email)) {
        showStatus(detailText.qnaInvalidEmail, true);
        return;
      }

      if (question.length < 5) {
        showStatus(detailText.qnaInvalidQuestion, true);
        return;
      }

      try {
        const lastSubmittedAt = Number(localStorage.getItem(STORAGE_KEYS.qnaLastSubmitAt) || 0);
        if (Date.now() - lastSubmittedAt < QNA_MIN_SUBMIT_INTERVAL_MS) {
          showStatus(detailText.qnaSubmitCooldown, true);
          return;
        }
      } catch (error) {
        // Continue without cooldown when storage access is blocked.
      }

      const newEntry = normalizeInquiry({
        id: createEntryId("qna"),
        name,
        phone,
        email,
        question,
        lang: state.lang,
        createdAt: nowIso(),
        answers: {
          ko: "",
          en: "",
          zh: ""
        }
      });

      state.content.dynamic.inquiries.unshift(newEntry);
      saveContent(state.content);

      try {
        localStorage.setItem(STORAGE_KEYS.qnaLastSubmitAt, String(Date.now()));
      } catch (error) {
        // Ignore storage failures for this best-effort guard.
      }

      form.reset();
      showStatus(detailText.qnaSuccess, false);

      renderQnaPublicList(listWrap);
    });

    target.append(form);
    target.append(listHeading);
    target.append(listWrap);
    renderQnaPublicList(listWrap);
  };

  const renderDetail = () => {
    const pathText = getLangText(UI_TEXT.detail);
    const { menuId, itemId, postId } = resolveDetailParams();

    const menu = getMenu(menuId);
    const item = getItem(menuId, itemId);
    if (!menu || !item) {
      return;
    }

    const translation = item.translations[state.lang] || item.translations.en;

    const menuLabel = menu.labels[state.lang] || menu.labels.en;
    const itemLabel = item.labels[state.lang] || item.labels.en;

    const menuLabelElement = document.querySelector("[data-detail-menu-label]");
    const listElement = document.querySelector("[data-detail-item-list]");
    const pathElement = document.querySelector("[data-detail-path]");
    const titleElement = document.querySelector("[data-detail-title]");
    const subtitleElement = document.querySelector("[data-detail-subtitle]");
    const sectionsElement = document.querySelector("[data-detail-sections]");
    const ctaElement = document.querySelector("[data-detail-cta]");

    if (menuLabelElement) {
      menuLabelElement.textContent = `${pathText.menuCaption}: ${menuLabel}`;
    }

    if (listElement) {
      listElement.innerHTML = "";
      menu.items.forEach((menuItem) => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = buildDetailUrl(menu.id, menuItem.id);
        link.textContent = menuItem.labels[state.lang] || menuItem.labels.en;
        if (menuItem.id === item.id) {
          link.classList.add("is-active");
        }
        li.append(link);
        listElement.append(li);
      });
    }

    if (pathElement) {
      pathElement.textContent = `${pathText.pathPrefix} · ${menuLabel} / ${itemLabel}`;
    }

    if (titleElement) {
      titleElement.textContent = translation.title;
    }

    if (subtitleElement) {
      subtitleElement.textContent = translation.subtitle;
    }

    if (sectionsElement) {
      sectionsElement.innerHTML = "";

      if (menuId === "infos" && itemId === "news") {
        renderNewsDetail(translation, sectionsElement, postId);
      } else if (menuId === "infos" && itemId === "notice") {
        renderNoticeDetail(translation, sectionsElement, postId);
      } else if (menuId === "help" && itemId === "qna") {
        renderQnaDetail(translation, sectionsElement);
      } else {
        appendFeatureImage(translation, sectionsElement);
        appendTranslationSections(translation, sectionsElement);
      }
    }

    if (ctaElement) {
      ctaElement.textContent = pathText.contactCta;
    }
  };

  const clearNoticePopup = () => {
    document.querySelectorAll("[data-notice-popup]").forEach((node) => node.remove());
  };

  const renderNoticePopup = () => {
    const page = document.body.dataset.page;
    if (page === "admin") {
      clearNoticePopup();
      return;
    }

    clearNoticePopup();

    const detailText = getLangText(UI_TEXT.detail);
    const seenIds = getNoticeSeenIds();

    const popupNotices = [...state.content.dynamic.notices]
      .filter((notice) => notice.popup)
      .sort(sortByDateDesc);

    const candidate = popupNotices.find((notice) => !seenIds.includes(notice.id));
    if (!candidate) {
      return;
    }

    const postTranslation = getPostTranslation(candidate);

    const overlay = document.createElement("div");
    overlay.className = "notice-popup-overlay";
    overlay.dataset.noticePopup = "1";
    overlay.innerHTML = `
      <div class="notice-popup-card">
        <p class="post-card-meta">${encodeHtml(detailText.popupLabel)}</p>
        <h3>${encodeHtml(postTranslation.title)}</h3>
        <p>${encodeHtml(postTranslation.excerpt || truncateText(postTranslation.body, 180))}</p>
        <div class="notice-popup-actions">
          <button type="button" class="cta ghost small" data-popup-close>${encodeHtml(
            detailText.popupClose
          )}</button>
          <a class="cta primary small" href="${encodeHtml(
            buildDetailUrl("infos", "notice", { post: candidate.id })
          )}" data-popup-view>${encodeHtml(detailText.popupView)}</a>
        </div>
      </div>
    `;

    const closeButton = overlay.querySelector("[data-popup-close]");
    const viewButton = overlay.querySelector("[data-popup-view]");

    if (closeButton) {
      closeButton.addEventListener("click", () => {
        markNoticeSeen(candidate.id);
        overlay.remove();
      });
    }

    if (viewButton) {
      viewButton.addEventListener("click", () => {
        markNoticeSeen(candidate.id);
      });
    }

    document.body.append(overlay);
  };

  const initReveal = () => {
    const revealNodes = document.querySelectorAll(".reveal");
    if (!revealNodes.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );

    revealNodes.forEach((node) => observer.observe(node));
  };

  const initOrbParallax = () => {
    const orbs = document.querySelectorAll(".orb");
    if (!orbs.length) {
      return;
    }

    window.addEventListener("pointermove", (event) => {
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;

      orbs.forEach((orb) => {
        const depth = Number(orb.dataset.depth || 18);
        orb.style.setProperty("--parallax-x", `${x * depth}px`);
        orb.style.setProperty("--parallax-y", `${y * depth}px`);
      });
    });
  };

  const initAdmin = () => {
    if (document.body.dataset.page !== "admin") {
      return;
    }

    const adminState = {
      content: normalizeContentShape(deepClone(state.content)),
      menuId: state.content.menus[0].id,
      itemId: state.content.menus[0].items[0].id,
      editLang: state.lang,
      activeModule: "news",
      selectedNewsId: "",
      selectedNoticeId: "",
      selectedInquiryId: ""
    };

    const menuSelect = document.getElementById("admin-menu");
    const itemSelect = document.getElementById("admin-item");
    const titleInput = document.getElementById("admin-title-input");
    const subtitleInput = document.getElementById("admin-subtitle-input");
    const featureImageInput = document.getElementById("admin-feature-image-input");
    const featureImageAltInput = document.getElementById("admin-feature-image-alt-input");
    const featureImageFileInput = document.getElementById("admin-feature-image-file");
    const sectionsWrap = document.getElementById("admin-sections");
    const statusElement = document.getElementById("admin-status");
    const jsonElement = document.getElementById("admin-json");
    const previewLink = document.getElementById("admin-preview");

    const moduleTabsWrap = document.getElementById("admin-module-tabs");
    const moduleContentWrap = document.getElementById("admin-module-content");

    const authWrap = document.getElementById("admin-auth-wrap");
    const adminMain = document.getElementById("admin-main");
    const authStatusElement = document.getElementById("admin-auth-status");
    const loginForm = document.getElementById("admin-login-form");
    const loginIdInput = document.getElementById("admin-login-id");
    const loginPasswordInput = document.getElementById("admin-login-password");
    const logoutButton = document.getElementById("admin-logout");

    const adminText = () => getLangText(UI_TEXT.admin);
    let authGranted = isAdminAuthenticated();

    const showAuthStatus = (message) => {
      if (authStatusElement) {
        authStatusElement.textContent = message || "";
      }
    };

    const showStatus = (message) => {
      if (statusElement) {
        statusElement.textContent = message || "";
      }
    };

    const showModuleStatus = (message) => {
      if (!moduleContentWrap) {
        return;
      }
      const status = moduleContentWrap.querySelector("[data-admin-module-status]");
      if (status) {
        status.textContent = message || "";
      }
    };

    const setAdminAccess = (granted) => {
      authGranted = granted;
      if (adminMain) {
        adminMain.hidden = !granted;
      }
      if (authWrap) {
        authWrap.hidden = granted;
      }
      if (logoutButton) {
        logoutButton.hidden = !granted;
      }
      document.body.dataset.adminAuth = granted ? "granted" : "locked";
    };

    const persistAdminContent = (mainMessage = "", moduleMessage = "") => {
      saveContent(adminState.content);
      document.dispatchEvent(new CustomEvent("hepta:contentchange"));
      if (mainMessage) {
        showStatus(mainMessage);
      }
      if (moduleMessage) {
        showModuleStatus(moduleMessage);
      }
    };

    const getCurrentMenu = () =>
      adminState.content.menus.find((menu) => menu.id === adminState.menuId) ||
      adminState.content.menus[0];

    const getCurrentItem = () => {
      const menu = getCurrentMenu();
      return menu.items.find((item) => item.id === adminState.itemId) || menu.items[0];
    };

    const getDefaultItem = (menuId, itemId) => {
      const menu = defaults.menus.find((entry) => entry.id === menuId);
      if (!menu) {
        return null;
      }
      return menu.items.find((entry) => entry.id === itemId) || null;
    };

    const ensureTranslation = () => {
      const item = getCurrentItem();
      const defaultItem = getDefaultItem(adminState.menuId, adminState.itemId);
      const fallbackTranslation =
        defaultItem && defaultItem.translations ? defaultItem.translations[adminState.editLang] : {};

      item.translations[adminState.editLang] = ensureItemTranslation(
        item.translations[adminState.editLang],
        fallbackTranslation
      );

      return item.translations[adminState.editLang];
    };

    const getDynamic = () => {
      adminState.content.dynamic = normalizeDynamic(adminState.content.dynamic);
      return adminState.content.dynamic;
    };

    const ensureNewsSelection = () => {
      const posts = getDynamic().newsPosts;
      if (!posts.length) {
        adminState.selectedNewsId = "";
        return null;
      }
      if (!adminState.selectedNewsId || !posts.some((post) => post.id === adminState.selectedNewsId)) {
        adminState.selectedNewsId = posts[0].id;
      }
      return posts.find((post) => post.id === adminState.selectedNewsId) || posts[0];
    };

    const ensureNoticeSelection = () => {
      const notices = getDynamic().notices;
      if (!notices.length) {
        adminState.selectedNoticeId = "";
        return null;
      }
      if (
        !adminState.selectedNoticeId ||
        !notices.some((notice) => notice.id === adminState.selectedNoticeId)
      ) {
        adminState.selectedNoticeId = notices[0].id;
      }
      return notices.find((notice) => notice.id === adminState.selectedNoticeId) || notices[0];
    };

    const ensureInquirySelection = () => {
      const entries = getDynamic().inquiries;
      if (!entries.length) {
        adminState.selectedInquiryId = "";
        return null;
      }
      if (
        !adminState.selectedInquiryId ||
        !entries.some((entry) => entry.id === adminState.selectedInquiryId)
      ) {
        adminState.selectedInquiryId = entries[0].id;
      }
      return entries.find((entry) => entry.id === adminState.selectedInquiryId) || entries[0];
    };

    const renderAdminLabels = () => {
      const text = adminText();
      const map = {
        "[data-admin-title]": text.title,
        "[data-admin-subtitle]": text.subtitle,
        "[data-admin-home-link]": text.homeLink,
        "[data-admin-detail-link]": text.detailLink,
        "[data-admin-select-heading]": text.selectHeading,
        "[data-admin-label-menu]": text.labelMenu,
        "[data-admin-label-item]": text.labelItem,
        "[data-admin-label-language]": text.labelLanguage,
        "[data-admin-preview]": text.preview,
        "[data-admin-edit-heading]": text.editHeading,
        "[data-admin-label-title]": text.labelTitle,
        "[data-admin-label-subtitle]": text.labelSubtitle,
        "[data-admin-label-feature-image]": text.labelFeatureImage,
        "[data-admin-label-feature-alt]": text.labelFeatureAlt,
        "[data-admin-label-feature-upload]": text.labelFeatureUpload,
        "[data-admin-sections-heading]": text.sectionsHeading,
        "[data-admin-add-section]": text.addSection,
        "[data-admin-save]": text.save,
        "[data-admin-reset-item]": text.resetItem,
        "[data-admin-reset-all]": text.resetAll,
        "[data-admin-export]": text.export,
        "[data-admin-import]": text.import,
        "[data-admin-json-heading]": text.jsonHeading,
        "[data-admin-logout]": text.logout,
        "[data-admin-auth-title]": text.authTitle,
        "[data-admin-auth-subtitle]": text.authSubtitle,
        "[data-admin-auth-id-label]": text.authIdLabel,
        "[data-admin-auth-password-label]": text.authPasswordLabel,
        "[data-admin-login-submit]": text.authSubmit,
        "[data-admin-auth-note]": text.authNote,
        "[data-admin-advanced-heading]": text.advancedHeading,
        "[data-admin-advanced-subtitle]": text.advancedSubtitle,
        '[data-admin-module="news"]': text.moduleNews,
        '[data-admin-module="notice"]': text.moduleNotice,
        '[data-admin-module="qna"]': text.moduleQna,
        '[data-admin-module="site"]': text.moduleSite
      };

      Object.entries(map).forEach(([selector, value]) => {
        document.querySelectorAll(selector).forEach((node) => {
          node.textContent = value;
        });
      });
    };

    const renderMenuSelect = () => {
      if (!menuSelect) {
        return;
      }

      menuSelect.innerHTML = "";
      adminState.content.menus.forEach((menu) => {
        const option = document.createElement("option");
        option.value = menu.id;
        option.textContent = menu.labels[state.lang] || menu.labels.en;
        menuSelect.append(option);
      });
      menuSelect.value = adminState.menuId;
    };

    const renderItemSelect = () => {
      if (!itemSelect) {
        return;
      }

      const menu = getCurrentMenu();
      itemSelect.innerHTML = "";
      menu.items.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.labels[state.lang] || item.labels.en;
        itemSelect.append(option);
      });
      itemSelect.value = adminState.itemId;
    };

    const renderLangTabs = () => {
      document.querySelectorAll("[data-admin-lang]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.adminLang === adminState.editLang);
      });
    };

    const renderPreviewLink = () => {
      if (previewLink) {
        previewLink.href = buildDetailUrl(adminState.menuId, adminState.itemId);
      }
    };

    const syncJsonPreview = () => {
      if (!jsonElement) {
        return;
      }
      const translation = ensureTranslation();
      jsonElement.textContent = JSON.stringify(translation, null, 2);
    };

    const updateSectionHandlers = () => {
      const text = adminText();

      sectionsWrap.querySelectorAll("[data-remove-section]").forEach((button) => {
        button.addEventListener("click", () => {
          const translation = ensureTranslation();
          const index = Number(button.dataset.removeSection);
          translation.sections.splice(index, 1);
          renderEditor();
        });
      });

      sectionsWrap.querySelectorAll("input[data-section-heading]").forEach((input) => {
        input.addEventListener("input", () => {
          const translation = ensureTranslation();
          const index = Number(input.dataset.sectionHeading);
          translation.sections[index].heading = input.value;
          syncJsonPreview();
        });
      });

      sectionsWrap.querySelectorAll("textarea[data-section-body]").forEach((input) => {
        input.addEventListener("input", () => {
          const translation = ensureTranslation();
          const index = Number(input.dataset.sectionBody);
          translation.sections[index].body = input.value;
          syncJsonPreview();
        });
      });

      sectionsWrap.querySelectorAll("input[data-section-image]").forEach((input) => {
        input.addEventListener("input", () => {
          const translation = ensureTranslation();
          const index = Number(input.dataset.sectionImage);
          translation.sections[index].image = input.value;
          syncJsonPreview();
        });
      });

      sectionsWrap.querySelectorAll("input[data-section-image-file]").forEach((input) => {
        input.addEventListener("change", async () => {
          const file = input.files && input.files[0] ? input.files[0] : null;
          if (!file) {
            return;
          }

          try {
            const dataUrl = await fileToDataUrl(file);
            const translation = ensureTranslation();
            const index = Number(input.dataset.sectionImageFile);
            translation.sections[index].image = dataUrl;
            renderEditor();
            showStatus(text.statusSaved);
          } catch (error) {
            showStatus(text.statusImportFail);
          }

          input.value = "";
        });
      });
    };

    const renderEditor = () => {
      const text = adminText();
      const translation = ensureTranslation();

      titleInput.value = translation.title;
      subtitleInput.value = translation.subtitle;

      if (featureImageInput) {
        featureImageInput.value = translation.featureImage || "";
      }
      if (featureImageAltInput) {
        featureImageAltInput.value = getLocalizedLabel(translation.featureImageAlt);
      }

      sectionsWrap.innerHTML = "";
      translation.sections.forEach((section, index) => {
        const sectionCard = document.createElement("article");
        sectionCard.className = "section-editor";
        sectionCard.innerHTML = `
          <div class="section-editor-head">
            <strong>Section ${index + 1}</strong>
            <button type="button" class="icon-btn mini" data-remove-section="${index}">×</button>
          </div>
          <label>${encodeHtml(text.sectionHeadingLabel)}</label>
          <input type="text" data-section-heading="${index}" value="${encodeHtml(section.heading)}" />
          <label>${encodeHtml(text.sectionBodyLabel)}</label>
          <textarea rows="4" data-section-body="${index}">${encodeHtml(section.body)}</textarea>
          <label>${encodeHtml(text.sectionImageLabel)}</label>
          <input type="url" data-section-image="${index}" value="${encodeHtml(section.image || "")}" />
          <label>${encodeHtml(text.sectionImageUploadLabel)}</label>
          <input type="file" accept="image/*" data-section-image-file="${index}" />
        `;
        sectionsWrap.append(sectionCard);
      });

      renderLangTabs();
      renderPreviewLink();
      syncJsonPreview();
      updateSectionHandlers();
    };

    const renderModuleTabs = () => {
      if (!moduleTabsWrap) {
        return;
      }

      moduleTabsWrap.querySelectorAll("[data-admin-module]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.adminModule === adminState.activeModule);
      });
    };

    const renderNewsModule = () => {
      const text = adminText();
      const dynamic = getDynamic();
      const selected = ensureNewsSelection();
      const translation = selected ? getPostTranslation(selected) : { title: "", excerpt: "", body: "" };

      if (!selected) {
        moduleContentWrap.innerHTML = `
          <div class="admin-module-wrap">
            <p class="admin-inline-meta">${encodeHtml(text.newsEmpty)}</p>
            <div class="admin-module-actions">
              <button class="cta ghost small" type="button" id="admin-news-new">${encodeHtml(
                text.newsCreate
              )}</button>
            </div>
            <p class="admin-status-inline" data-admin-module-status></p>
          </div>
        `;

        const createOnlyButton = document.getElementById("admin-news-new");
        if (createOnlyButton) {
          createOnlyButton.addEventListener("click", () => {
            const newPost = normalizeNewsPost({
              id: createEntryId("news"),
              createdAt: nowIso(),
              updatedAt: nowIso(),
              image: "",
              imageAlt: { ko: "", en: "", zh: "" },
              translations: {
                ko: { title: "", excerpt: "", body: "" },
                en: { title: "", excerpt: "", body: "" },
                zh: { title: "", excerpt: "", body: "" }
              }
            });
            getDynamic().newsPosts.unshift(newPost);
            adminState.selectedNewsId = newPost.id;
            persistAdminContent(text.statusSaved, text.moduleCreated);
            renderAdminModule();
          });
        }
        return;
      }

      moduleContentWrap.innerHTML = `
        <div class="admin-module-wrap">
          <div class="field-group">
            <label for="admin-news-select">${encodeHtml(text.newsSelectLabel)}</label>
            <select id="admin-news-select">
              ${dynamic.newsPosts
                .slice()
                .sort(sortByDateDesc)
                .map((post) => {
                  const title = getPostTranslation(post).title || post.id;
                  return `<option value="${encodeHtml(post.id)}" ${
                    post.id === selected.id ? "selected" : ""
                  }>${encodeHtml(title)}</option>`;
                })
                .join("")}
            </select>
          </div>
          <div class="admin-module-actions">
            <button class="cta ghost small" type="button" id="admin-news-new">${encodeHtml(
              text.newsCreate
            )}</button>
            <button class="cta ghost small" type="button" id="admin-news-delete">${encodeHtml(
              text.newsDelete
            )}</button>
          </div>
          <div class="admin-module-grid two">
            <div class="field-group">
              <label for="admin-news-date">${encodeHtml(text.newsDateLabel)}</label>
              <input id="admin-news-date" type="datetime-local" value="${encodeHtml(
                toDatetimeLocalValue(selected.createdAt)
              )}" />
            </div>
            <div class="field-group">
              <label for="admin-news-image">${encodeHtml(text.newsImageLabel)}</label>
              <input id="admin-news-image" type="url" value="${encodeHtml(selected.image || "")}" />
            </div>
            <div class="field-group">
              <label for="admin-news-image-alt">${encodeHtml(text.newsImageAltLabel)}</label>
              <input id="admin-news-image-alt" type="text" value="${encodeHtml(
                getLocalizedLabel(selected.imageAlt)
              )}" />
            </div>
            <div class="field-group">
              <label for="admin-news-image-file">${encodeHtml(text.newsImageUploadLabel)}</label>
              <input id="admin-news-image-file" type="file" accept="image/*" />
            </div>
          </div>
          <div class="field-group">
            <label for="admin-news-title">${encodeHtml(text.newsTitleLabel)}</label>
            <input id="admin-news-title" type="text" value="${encodeHtml(translation.title)}" />
          </div>
          <div class="field-group">
            <label for="admin-news-excerpt">${encodeHtml(text.newsExcerptLabel)}</label>
            <textarea id="admin-news-excerpt" rows="3">${encodeHtml(translation.excerpt)}</textarea>
          </div>
          <div class="field-group">
            <label for="admin-news-body">${encodeHtml(text.newsBodyLabel)}</label>
            <textarea id="admin-news-body" rows="8">${encodeHtml(translation.body)}</textarea>
          </div>
          <div class="admin-module-actions">
            <button class="cta primary" type="button" id="admin-news-save">${encodeHtml(
              text.newsSave
            )}</button>
          </div>
          <p class="admin-status-inline" data-admin-module-status></p>
        </div>
      `;

      const select = document.getElementById("admin-news-select");
      const createButton = document.getElementById("admin-news-new");
      const deleteButton = document.getElementById("admin-news-delete");
      const saveButton = document.getElementById("admin-news-save");
      const imageFileInput = document.getElementById("admin-news-image-file");

      if (select) {
        select.addEventListener("change", () => {
          adminState.selectedNewsId = select.value;
          renderAdminModule();
        });
      }

      if (createButton) {
        createButton.addEventListener("click", () => {
          const newPost = normalizeNewsPost({
            id: createEntryId("news"),
            createdAt: nowIso(),
            updatedAt: nowIso(),
            image: "",
            imageAlt: { ko: "", en: "", zh: "" },
            translations: {
              ko: { title: "", excerpt: "", body: "" },
              en: { title: "", excerpt: "", body: "" },
              zh: { title: "", excerpt: "", body: "" }
            }
          });
          getDynamic().newsPosts.unshift(newPost);
          adminState.selectedNewsId = newPost.id;
          renderAdminModule();
          showModuleStatus(text.moduleCreated);
        });
      }

      if (deleteButton) {
        deleteButton.addEventListener("click", () => {
          const posts = getDynamic().newsPosts;
          const index = posts.findIndex((post) => post.id === adminState.selectedNewsId);
          if (index < 0) {
            return;
          }
          posts.splice(index, 1);
          adminState.selectedNewsId = posts[0] ? posts[0].id : "";
          persistAdminContent(text.statusSaved, text.moduleDeleted);
          renderAdminModule();
        });
      }

      if (imageFileInput) {
        imageFileInput.addEventListener("change", async () => {
          const file = imageFileInput.files && imageFileInput.files[0] ? imageFileInput.files[0] : null;
          if (!file) {
            return;
          }
          try {
            const dataUrl = await fileToDataUrl(file);
            const imageInput = document.getElementById("admin-news-image");
            if (imageInput) {
              imageInput.value = dataUrl;
            }
          } catch (error) {
            showModuleStatus(text.statusImportFail);
          }
          imageFileInput.value = "";
        });
      }

      if (saveButton) {
        saveButton.addEventListener("click", () => {
          const post = ensureNewsSelection();
          if (!post) {
            return;
          }
          post.createdAt = fromDatetimeLocalValue(document.getElementById("admin-news-date").value);
          post.updatedAt = nowIso();
          post.image = asString(document.getElementById("admin-news-image").value).trim();
          post.imageAlt[adminState.editLang] = asString(
            document.getElementById("admin-news-image-alt").value
          ).trim();

          post.translations[adminState.editLang] = ensurePostTranslation({
            title: asString(document.getElementById("admin-news-title").value).trim(),
            excerpt: asString(document.getElementById("admin-news-excerpt").value).trim(),
            body: asString(document.getElementById("admin-news-body").value).trim()
          });

          persistAdminContent(text.statusSaved, text.moduleSaved);
          renderAdminModule();
        });
      }
    };

    const renderNoticeModule = () => {
      const text = adminText();
      const dynamic = getDynamic();
      const selected = ensureNoticeSelection();
      const translation = selected ? getPostTranslation(selected) : { title: "", excerpt: "", body: "" };

      if (!selected) {
        moduleContentWrap.innerHTML = `
          <div class="admin-module-wrap">
            <p class="admin-inline-meta">${encodeHtml(text.noticeEmpty)}</p>
            <div class="admin-module-actions">
              <button class="cta ghost small" type="button" id="admin-notice-new">${encodeHtml(
                text.noticeCreate
              )}</button>
            </div>
            <p class="admin-status-inline" data-admin-module-status></p>
          </div>
        `;

        const createOnlyButton = document.getElementById("admin-notice-new");
        if (createOnlyButton) {
          createOnlyButton.addEventListener("click", () => {
            const newNotice = normalizeNoticePost({
              id: createEntryId("notice"),
              createdAt: nowIso(),
              updatedAt: nowIso(),
              popup: false,
              image: "",
              imageAlt: { ko: "", en: "", zh: "" },
              translations: {
                ko: { title: "", excerpt: "", body: "" },
                en: { title: "", excerpt: "", body: "" },
                zh: { title: "", excerpt: "", body: "" }
              }
            });
            getDynamic().notices.unshift(newNotice);
            adminState.selectedNoticeId = newNotice.id;
            persistAdminContent(text.statusSaved, text.moduleCreated);
            renderAdminModule();
          });
        }
        return;
      }

      moduleContentWrap.innerHTML = `
        <div class="admin-module-wrap">
          <div class="field-group">
            <label for="admin-notice-select">${encodeHtml(text.noticeSelectLabel)}</label>
            <select id="admin-notice-select">
              ${dynamic.notices
                .slice()
                .sort(sortByDateDesc)
                .map((notice) => {
                  const title = getPostTranslation(notice).title || notice.id;
                  return `<option value="${encodeHtml(notice.id)}" ${
                    notice.id === selected.id ? "selected" : ""
                  }>${encodeHtml(title)}</option>`;
                })
                .join("")}
            </select>
          </div>
          <div class="admin-module-actions">
            <button class="cta ghost small" type="button" id="admin-notice-new">${encodeHtml(
              text.noticeCreate
            )}</button>
            <button class="cta ghost small" type="button" id="admin-notice-delete">${encodeHtml(
              text.noticeDelete
            )}</button>
          </div>
          <div class="admin-module-grid two">
            <div class="field-group">
              <label for="admin-notice-date">${encodeHtml(text.noticeDateLabel)}</label>
              <input id="admin-notice-date" type="datetime-local" value="${encodeHtml(
                toDatetimeLocalValue(selected.createdAt)
              )}" />
            </div>
            <div class="field-group">
              <label for="admin-notice-image">${encodeHtml(text.noticeImageLabel)}</label>
              <input id="admin-notice-image" type="url" value="${encodeHtml(selected.image || "")}" />
            </div>
            <div class="field-group">
              <label for="admin-notice-image-alt">${encodeHtml(text.noticeImageAltLabel)}</label>
              <input id="admin-notice-image-alt" type="text" value="${encodeHtml(
                getLocalizedLabel(selected.imageAlt)
              )}" />
            </div>
            <div class="field-group">
              <label for="admin-notice-image-file">${encodeHtml(text.noticeImageUploadLabel)}</label>
              <input id="admin-notice-image-file" type="file" accept="image/*" />
            </div>
          </div>
          <label class="admin-checkbox-row" for="admin-notice-popup">
            <input id="admin-notice-popup" type="checkbox" ${selected.popup ? "checked" : ""} />
            ${encodeHtml(text.noticePopupLabel)}
          </label>
          <div class="field-group">
            <label for="admin-notice-title">${encodeHtml(text.noticeTitleLabel)}</label>
            <input id="admin-notice-title" type="text" value="${encodeHtml(translation.title)}" />
          </div>
          <div class="field-group">
            <label for="admin-notice-body">${encodeHtml(text.noticeBodyLabel)}</label>
            <textarea id="admin-notice-body" rows="8">${encodeHtml(translation.body)}</textarea>
          </div>
          <div class="admin-module-actions">
            <button class="cta primary" type="button" id="admin-notice-save">${encodeHtml(
              text.noticeSave
            )}</button>
          </div>
          <p class="admin-status-inline" data-admin-module-status></p>
        </div>
      `;

      const select = document.getElementById("admin-notice-select");
      const createButton = document.getElementById("admin-notice-new");
      const deleteButton = document.getElementById("admin-notice-delete");
      const saveButton = document.getElementById("admin-notice-save");
      const imageFileInput = document.getElementById("admin-notice-image-file");

      if (select) {
        select.addEventListener("change", () => {
          adminState.selectedNoticeId = select.value;
          renderAdminModule();
        });
      }

      if (createButton) {
        createButton.addEventListener("click", () => {
          const newNotice = normalizeNoticePost({
            id: createEntryId("notice"),
            createdAt: nowIso(),
            updatedAt: nowIso(),
            popup: false,
            image: "",
            imageAlt: { ko: "", en: "", zh: "" },
            translations: {
              ko: { title: "", excerpt: "", body: "" },
              en: { title: "", excerpt: "", body: "" },
              zh: { title: "", excerpt: "", body: "" }
            }
          });
          getDynamic().notices.unshift(newNotice);
          adminState.selectedNoticeId = newNotice.id;
          renderAdminModule();
          showModuleStatus(text.moduleCreated);
        });
      }

      if (deleteButton) {
        deleteButton.addEventListener("click", () => {
          const notices = getDynamic().notices;
          const index = notices.findIndex((notice) => notice.id === adminState.selectedNoticeId);
          if (index < 0) {
            return;
          }
          notices.splice(index, 1);
          adminState.selectedNoticeId = notices[0] ? notices[0].id : "";
          persistAdminContent(text.statusSaved, text.moduleDeleted);
          renderAdminModule();
        });
      }

      if (imageFileInput) {
        imageFileInput.addEventListener("change", async () => {
          const file = imageFileInput.files && imageFileInput.files[0] ? imageFileInput.files[0] : null;
          if (!file) {
            return;
          }
          try {
            const dataUrl = await fileToDataUrl(file);
            const imageInput = document.getElementById("admin-notice-image");
            if (imageInput) {
              imageInput.value = dataUrl;
            }
          } catch (error) {
            showModuleStatus(text.statusImportFail);
          }
          imageFileInput.value = "";
        });
      }

      if (saveButton) {
        saveButton.addEventListener("click", () => {
          const notice = ensureNoticeSelection();
          if (!notice) {
            return;
          }
          notice.createdAt = fromDatetimeLocalValue(document.getElementById("admin-notice-date").value);
          notice.updatedAt = nowIso();
          notice.popup = Boolean(document.getElementById("admin-notice-popup").checked);
          notice.image = asString(document.getElementById("admin-notice-image").value).trim();
          notice.imageAlt[adminState.editLang] = asString(
            document.getElementById("admin-notice-image-alt").value
          ).trim();

          const bodyValue = asString(document.getElementById("admin-notice-body").value).trim();
          notice.translations[adminState.editLang] = ensurePostTranslation({
            title: asString(document.getElementById("admin-notice-title").value).trim(),
            excerpt: truncateText(bodyValue, 140),
            body: bodyValue
          });

          persistAdminContent(text.statusSaved, text.moduleSaved);
          renderAdminModule();
        });
      }
    };

    const renderQnaModule = () => {
      const text = adminText();
      const entries = getDynamic().inquiries;
      const selected = ensureInquirySelection();

      if (!selected) {
        moduleContentWrap.innerHTML = `
          <div class="admin-module-wrap">
            <p class="admin-inline-meta">${encodeHtml(text.qnaEmpty)}</p>
            <p class="admin-status-inline" data-admin-module-status></p>
          </div>
        `;
        return;
      }

      moduleContentWrap.innerHTML = `
        <div class="admin-module-wrap">
          <div class="field-group">
            <label for="admin-qna-select">${encodeHtml(text.qnaSelectLabel)}</label>
            <select id="admin-qna-select">
              ${entries
                .slice()
                .sort(sortByDateDesc)
                .map((entry) =>
                  `<option value="${encodeHtml(entry.id)}" ${
                    entry.id === selected.id ? "selected" : ""
                  }>${encodeHtml(`${entry.name || "Anonymous"} · ${truncateText(entry.question, 42)}`)}</option>`
                )
                .join("")}
            </select>
          </div>
          <div class="admin-module-grid two">
            <p class="admin-inline-meta"><strong>${encodeHtml(text.qnaNameLabel)}:</strong> ${encodeHtml(
              selected.name
            )}</p>
            <p class="admin-inline-meta"><strong>${encodeHtml(text.qnaPhoneLabel)}:</strong> ${encodeHtml(
              selected.phone
            )}</p>
            <p class="admin-inline-meta"><strong>${encodeHtml(text.qnaEmailLabel)}:</strong> ${encodeHtml(
              selected.email
            )}</p>
            <p class="admin-inline-meta"><strong>${encodeHtml(
              text.qnaCreatedAtLabel
            )}:</strong> ${encodeHtml(formatDisplayDate(selected.createdAt))}</p>
            <p class="admin-inline-meta"><strong>${encodeHtml(
              text.qnaAnsweredAtLabel
            )}:</strong> ${encodeHtml(selected.answeredAt ? formatDisplayDate(selected.answeredAt) : "-")}</p>
          </div>
          <div class="field-group">
            <label>${encodeHtml(text.qnaQuestionLabel)}</label>
            <textarea rows="6" readonly>${encodeHtml(selected.question)}</textarea>
          </div>
          <div class="field-group">
            <label for="admin-qna-answer">${encodeHtml(text.qnaAnswerLabel)}</label>
            <textarea id="admin-qna-answer" rows="6">${encodeHtml(
              asString(selected.answers[adminState.editLang])
            )}</textarea>
          </div>
          <div class="admin-module-actions">
            <button class="cta primary" type="button" id="admin-qna-save">${encodeHtml(
              text.qnaSaveAnswer
            )}</button>
            <button class="cta ghost" type="button" id="admin-qna-delete">${encodeHtml(
              text.qnaDelete
            )}</button>
          </div>
          <p class="admin-status-inline" data-admin-module-status></p>
        </div>
      `;

      const select = document.getElementById("admin-qna-select");
      const saveButton = document.getElementById("admin-qna-save");
      const deleteButton = document.getElementById("admin-qna-delete");

      if (select) {
        select.addEventListener("change", () => {
          adminState.selectedInquiryId = select.value;
          renderAdminModule();
        });
      }

      if (saveButton) {
        saveButton.addEventListener("click", () => {
          const entry = ensureInquirySelection();
          if (!entry) {
            return;
          }

          entry.answers[adminState.editLang] = asString(
            document.getElementById("admin-qna-answer").value
          ).trim();

          const hasAnswer = SUPPORTED_LANGS.some((lang) => asString(entry.answers[lang]).trim());
          entry.status = hasAnswer ? "answered" : "pending";
          entry.answeredAt = hasAnswer ? nowIso() : "";

          persistAdminContent(text.statusSaved, text.moduleSaved);
          renderAdminModule();
        });
      }

      if (deleteButton) {
        deleteButton.addEventListener("click", () => {
          const list = getDynamic().inquiries;
          const index = list.findIndex((entry) => entry.id === adminState.selectedInquiryId);
          if (index < 0) {
            return;
          }
          list.splice(index, 1);
          adminState.selectedInquiryId = list[0] ? list[0].id : "";
          persistAdminContent(text.statusSaved, text.moduleDeleted);
          renderAdminModule();
        });
      }
    };

    const renderSiteModule = () => {
      const text = adminText();

      const hero = adminState.content.site.hero[adminState.editLang];
      const footer = adminState.content.site.footer[adminState.editLang];
      const media = adminState.content.site.media;

      moduleContentWrap.innerHTML = `
        <div class="admin-module-wrap">
          <h3 class="post-card-title">${encodeHtml(text.siteHeroHeading)}</h3>
          <div class="admin-module-grid two">
            <div class="field-group">
              <label for="admin-site-kicker">${encodeHtml(text.siteKickerLabel)}</label>
              <input id="admin-site-kicker" type="text" value="${encodeHtml(hero.kicker)}" />
            </div>
            <div class="field-group">
              <label for="admin-site-title">${encodeHtml(text.siteTitleLabel)}</label>
              <input id="admin-site-title" type="text" value="${encodeHtml(hero.title)}" />
            </div>
            <div class="field-group">
              <label for="admin-site-line1">${encodeHtml(text.siteLine1Label)}</label>
              <input id="admin-site-line1" type="text" value="${encodeHtml(hero.lines[0] || "")}" />
            </div>
            <div class="field-group">
              <label for="admin-site-line2">${encodeHtml(text.siteLine2Label)}</label>
              <input id="admin-site-line2" type="text" value="${encodeHtml(hero.lines[1] || "")}" />
            </div>
            <div class="field-group">
              <label for="admin-site-line3">${encodeHtml(text.siteLine3Label)}</label>
              <input id="admin-site-line3" type="text" value="${encodeHtml(hero.lines[2] || "")}" />
            </div>
            <div class="field-group">
              <label for="admin-site-cta1">${encodeHtml(text.sitePrimaryCtaLabel)}</label>
              <input id="admin-site-cta1" type="text" value="${encodeHtml(hero.ctaPrimary)}" />
            </div>
            <div class="field-group">
              <label for="admin-site-cta2">${encodeHtml(text.siteSecondaryCtaLabel)}</label>
              <input id="admin-site-cta2" type="text" value="${encodeHtml(hero.ctaSecondary)}" />
            </div>
            <div class="field-group">
              <label for="admin-site-image">${encodeHtml(text.siteHeroImageLabel)}</label>
              <input id="admin-site-image" type="url" value="${encodeHtml(media.heroImage || "")}" />
            </div>
            <div class="field-group">
              <label for="admin-site-image-alt">${encodeHtml(text.siteHeroImageAltLabel)}</label>
              <input id="admin-site-image-alt" type="text" value="${encodeHtml(
                getLocalizedLabel(media.heroImageAlt)
              )}" />
            </div>
            <div class="field-group">
              <label for="admin-site-image-file">${encodeHtml(text.siteHeroImageUploadLabel)}</label>
              <input id="admin-site-image-file" type="file" accept="image/*" />
            </div>
          </div>
          <h3 class="post-card-title">${encodeHtml(text.siteFooterHeading)}</h3>
          <div class="admin-module-grid two">
            <div class="field-group">
              <label for="admin-site-footer-copyright">${encodeHtml(
                text.siteFooterCopyrightLabel
              )}</label>
              <input id="admin-site-footer-copyright" type="text" value="${encodeHtml(
                footer.copyright
              )}" />
            </div>
            <div class="field-group">
              <label for="admin-site-footer-community">${encodeHtml(
                text.siteFooterCommunityLabel
              )}</label>
              <input id="admin-site-footer-community" type="text" value="${encodeHtml(
                footer.community
              )}" />
            </div>
          </div>
          <div class="admin-module-actions">
            <button class="cta primary" type="button" id="admin-site-save">${encodeHtml(
              text.siteSave
            )}</button>
          </div>
          <p class="admin-status-inline" data-admin-module-status></p>
        </div>
      `;

      const saveButton = document.getElementById("admin-site-save");
      const imageFileInput = document.getElementById("admin-site-image-file");

      if (imageFileInput) {
        imageFileInput.addEventListener("change", async () => {
          const file = imageFileInput.files && imageFileInput.files[0] ? imageFileInput.files[0] : null;
          if (!file) {
            return;
          }
          try {
            const dataUrl = await fileToDataUrl(file);
            const imageInput = document.getElementById("admin-site-image");
            if (imageInput) {
              imageInput.value = dataUrl;
            }
          } catch (error) {
            showModuleStatus(text.statusImportFail);
          }
          imageFileInput.value = "";
        });
      }

      if (saveButton) {
        saveButton.addEventListener("click", () => {
          const heroContent = adminState.content.site.hero[adminState.editLang];
          const footerContent = adminState.content.site.footer[adminState.editLang];

          heroContent.kicker = asString(document.getElementById("admin-site-kicker").value).trim();
          heroContent.title = asString(document.getElementById("admin-site-title").value).trim();
          heroContent.lines = [
            asString(document.getElementById("admin-site-line1").value).trim(),
            asString(document.getElementById("admin-site-line2").value).trim(),
            asString(document.getElementById("admin-site-line3").value).trim()
          ];
          heroContent.ctaPrimary = asString(document.getElementById("admin-site-cta1").value).trim();
          heroContent.ctaSecondary = asString(document.getElementById("admin-site-cta2").value).trim();

          adminState.content.site.media.heroImage = asString(
            document.getElementById("admin-site-image").value
          ).trim();
          adminState.content.site.media.heroImageAlt[adminState.editLang] = asString(
            document.getElementById("admin-site-image-alt").value
          ).trim();

          footerContent.copyright = asString(
            document.getElementById("admin-site-footer-copyright").value
          ).trim();
          footerContent.community = asString(
            document.getElementById("admin-site-footer-community").value
          ).trim();

          persistAdminContent(text.statusSaved, text.moduleSaved);
          renderAdminModule();
        });
      }
    };

    const renderAdminModule = () => {
      if (!moduleContentWrap) {
        return;
      }

      renderModuleTabs();

      if (adminState.activeModule === "news") {
        renderNewsModule();
      } else if (adminState.activeModule === "notice") {
        renderNoticeModule();
      } else if (adminState.activeModule === "qna") {
        renderQnaModule();
      } else {
        renderSiteModule();
      }
    };

    titleInput.addEventListener("input", () => {
      const translation = ensureTranslation();
      translation.title = titleInput.value;
      syncJsonPreview();
    });

    subtitleInput.addEventListener("input", () => {
      const translation = ensureTranslation();
      translation.subtitle = subtitleInput.value;
      syncJsonPreview();
    });

    if (featureImageInput) {
      featureImageInput.addEventListener("input", () => {
        const translation = ensureTranslation();
        translation.featureImage = featureImageInput.value;
        syncJsonPreview();
      });
    }

    if (featureImageAltInput) {
      featureImageAltInput.addEventListener("input", () => {
        const translation = ensureTranslation();
        translation.featureImageAlt[adminState.editLang] = featureImageAltInput.value;
        syncJsonPreview();
      });
    }

    if (featureImageFileInput) {
      featureImageFileInput.addEventListener("change", async () => {
        const file = featureImageFileInput.files && featureImageFileInput.files[0] ? featureImageFileInput.files[0] : null;
        if (!file) {
          return;
        }

        try {
          const dataUrl = await fileToDataUrl(file);
          const translation = ensureTranslation();
          translation.featureImage = dataUrl;
          renderEditor();
          showStatus(adminText().statusSaved);
        } catch (error) {
          showStatus(adminText().statusImportFail);
        }

        featureImageFileInput.value = "";
      });
    }

    const addSectionButton = document.getElementById("admin-add-section");
    if (addSectionButton) {
      addSectionButton.addEventListener("click", () => {
        const translation = ensureTranslation();
        translation.sections.push({
          heading: "",
          body: "",
          image: ""
        });
        renderEditor();
      });
    }

    document.querySelectorAll("[data-admin-lang]").forEach((button) => {
      button.addEventListener("click", () => {
        adminState.editLang = button.dataset.adminLang;
        renderEditor();
        renderAdminModule();
      });
    });

    if (menuSelect) {
      menuSelect.addEventListener("change", () => {
        adminState.menuId = menuSelect.value;
        adminState.itemId = getCurrentMenu().items[0].id;
        renderItemSelect();
        renderEditor();
      });
    }

    if (itemSelect) {
      itemSelect.addEventListener("change", () => {
        adminState.itemId = itemSelect.value;
        renderEditor();
      });
    }

    const saveButton = document.getElementById("admin-save");
    if (saveButton) {
      saveButton.addEventListener("click", () => {
        persistAdminContent(adminText().statusSaved);
      });
    }

    const resetItemButton = document.getElementById("admin-reset-item");
    if (resetItemButton) {
      resetItemButton.addEventListener("click", () => {
        const currentItem = getCurrentItem();
        const defaultItem = getDefaultItem(adminState.menuId, adminState.itemId);

        if (!defaultItem) {
          return;
        }

        currentItem.translations[adminState.editLang] = ensureItemTranslation(
          deepClone(defaultItem.translations[adminState.editLang]),
          defaultItem.translations[adminState.editLang]
        );

        renderEditor();
        showStatus(adminText().statusResetItem);
      });
    }

    const resetAllButton = document.getElementById("admin-reset-all");
    if (resetAllButton) {
      resetAllButton.addEventListener("click", () => {
        if (!window.confirm(adminText().confirmResetAll)) {
          return;
        }

        adminState.content = normalizeContentShape(deepClone(defaults));
        adminState.menuId = adminState.content.menus[0].id;
        adminState.itemId = adminState.content.menus[0].items[0].id;
        adminState.editLang = state.lang;
        adminState.selectedNewsId = "";
        adminState.selectedNoticeId = "";
        adminState.selectedInquiryId = "";

        persistAdminContent(adminText().statusResetAll);
        renderMenuSelect();
        renderItemSelect();
        renderEditor();
        renderAdminModule();
      });
    }

    const exportButton = document.getElementById("admin-export");
    if (exportButton) {
      exportButton.addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(adminState.content, null, 2)], {
          type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "heptalabs-content.json";
        anchor.click();
        URL.revokeObjectURL(url);
        showStatus(adminText().statusExport);
      });
    }

    const importInput = document.getElementById("admin-import");
    if (importInput) {
      importInput.addEventListener("change", async (event) => {
        const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
        if (!file) {
          return;
        }

        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          if (!isValidContent(parsed)) {
            throw new Error("invalid");
          }

          adminState.content = normalizeContentShape(parsed);
          adminState.menuId = adminState.content.menus[0].id;
          adminState.itemId = adminState.content.menus[0].items[0].id;
          adminState.editLang = state.lang;
          adminState.selectedNewsId = "";
          adminState.selectedNoticeId = "";
          adminState.selectedInquiryId = "";

          persistAdminContent(adminText().statusImportOk);
          renderMenuSelect();
          renderItemSelect();
          renderEditor();
          renderAdminModule();
        } catch (error) {
          showStatus(adminText().statusImportFail);
        }

        event.target.value = "";
      });
    }

    if (moduleTabsWrap) {
      moduleTabsWrap.querySelectorAll("[data-admin-module]").forEach((button) => {
        button.addEventListener("click", () => {
          adminState.activeModule = button.dataset.adminModule;
          renderAdminModule();
        });
      });
    }

    if (loginForm) {
      loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const userId = loginIdInput ? loginIdInput.value : "";
        const userPassword = loginPasswordInput ? loginPasswordInput.value : "";
        const valid = await verifyAdminCredentials(userId, userPassword);

        if (!valid) {
          showAuthStatus(adminText().authInvalid);
          if (loginPasswordInput) {
            loginPasswordInput.value = "";
            loginPasswordInput.focus();
          }
          return;
        }

        setAdminAuthenticated(true);
        setAdminAccess(true);
        showAuthStatus("");
        if (loginPasswordInput) {
          loginPasswordInput.value = "";
        }
      });
    }

    if (logoutButton) {
      logoutButton.addEventListener("click", () => {
        setAdminAuthenticated(false);
        setAdminAccess(false);
        showAuthStatus(adminText().authLoggedOut);
        if (loginPasswordInput) {
          loginPasswordInput.value = "";
        }
        if (loginIdInput) {
          loginIdInput.focus();
        }
      });
    }

    document.addEventListener("hepta:langchange", () => {
      adminState.editLang = state.lang;
      renderAdminLabels();
      renderMenuSelect();
      renderItemSelect();
      renderEditor();
      renderAdminModule();
    });

    renderAdminLabels();
    renderMenuSelect();
    renderItemSelect();
    renderEditor();
    renderAdminModule();
    setAdminAccess(authGranted);

    if (!authGranted && loginIdInput) {
      loginIdInput.focus();
    }
  };

  const rerenderPage = () => {
    renderPrimaryNav();
    removePublicAdminEntryPoints();
    renderFooter();

    if (document.body.dataset.page === "home") {
      renderHome();
    }

    if (document.body.dataset.page === "detail") {
      renderDetail();
    }

    renderNoticePopup();
  };

  const init = () => {
    initThemeAndLangControls();
    initReveal();
    initOrbParallax();
    rerenderPage();
    initAdmin();

    document.addEventListener("hepta:langchange", rerenderPage);
    document.addEventListener("hepta:contentchange", () => {
      state.content = getContent();
      rerenderPage();
    });
  };

  init();
})();
