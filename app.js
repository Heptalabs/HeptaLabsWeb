(() => {
  "use strict";

  const STORAGE_KEYS = {
    theme: "heptalabs_theme",
    lang: "heptalabs_lang",
    content: "heptalabs_content_v1",
    adminSession: "heptalabs_admin_session_v1",
    noticeSeen: "heptalabs_notice_seen_v1",
    qnaLastSubmitAt: "heptalabs_qna_last_submit_at_v1",
    newsSeeded: "heptalabs_news_seeded_v1",
    noticeSeeded: "heptalabs_notice_seeded_v1",
    qnaSeeded: "heptalabs_qna_seeded_v1"
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
        newsBackToList: "목록으로",
        pagePrev: "이전",
        pageNext: "다음",
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
        qnaShowAnswer: "답변 보기",
        qnaHideAnswer: "답변 숨기기",
        qnaAnonymous: "익명",
        qnaPending: "답변 대기중",
        qnaAnswered: "답변 완료",
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
        newsBackToList: "Back to List",
        pagePrev: "Previous",
        pageNext: "Next",
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
        qnaShowAnswer: "View Answer",
        qnaHideAnswer: "Hide Answer",
        qnaAnonymous: "Anonymous",
        qnaPending: "Answer pending",
        qnaAnswered: "Answered",
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
        newsBackToList: "返回列表",
        pagePrev: "上一页",
        pageNext: "下一页",
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
        qnaShowAnswer: "查看回复",
        qnaHideAnswer: "收起回复",
        qnaAnonymous: "匿名",
        qnaPending: "待回复",
        qnaAnswered: "已回复",
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
        labelFeatureMediaType: "대표 미디어 타입",
        labelFeatureImage: "대표 미디어 URL",
        labelFeatureAlt: "대표 미디어 ALT",
        labelFeatureUpload: "대표 미디어 업로드",
        sectionsHeading: "섹션",
        sectionHeadingLabel: "섹션 제목",
        sectionBodyLabel: "섹션 본문",
        sectionMediaTypeLabel: "섹션 미디어 타입",
        sectionImageLabel: "섹션 미디어 URL",
        sectionImageUploadLabel: "섹션 미디어 업로드",
        mediaTypeImage: "이미지 / GIF",
        mediaTypeVideo: "동영상",
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
        statusStorageLimit:
          "저장 용량 한도를 초과했습니다. 대용량 동영상은 URL 링크 방식 사용을 권장합니다.",
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
        siteSpotlightHeading: "메인 소개 박스 3개",
        siteSpotlightTitleLabel: "박스 제목",
        siteSpotlightDescriptionLabel: "박스 설명",
        siteSpotlightLinkLabel: "박스 링크 URL",
        siteFooterHeading: "푸터",
        siteFooterCopyrightLabel: "저작권 문구",
        siteFooterCommunityLabel: "커뮤니티 문구",
        siteSave: "홈/박스/푸터 저장"
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
        labelFeatureMediaType: "Feature Media Type",
        labelFeatureImage: "Feature Media URL",
        labelFeatureAlt: "Feature Media ALT",
        labelFeatureUpload: "Upload Feature Media",
        sectionsHeading: "Sections",
        sectionHeadingLabel: "Section Heading",
        sectionBodyLabel: "Section Body",
        sectionMediaTypeLabel: "Section Media Type",
        sectionImageLabel: "Section Media URL",
        sectionImageUploadLabel: "Upload Section Media",
        mediaTypeImage: "Image / GIF",
        mediaTypeVideo: "Video",
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
        statusStorageLimit:
          "Storage quota exceeded. For large videos, use URL links instead of file embedding.",
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
        siteSpotlightHeading: "Home Intro Cards (3)",
        siteSpotlightTitleLabel: "Card Title",
        siteSpotlightDescriptionLabel: "Card Description",
        siteSpotlightLinkLabel: "Card Link URL",
        siteFooterHeading: "Footer",
        siteFooterCopyrightLabel: "Copyright",
        siteFooterCommunityLabel: "Community",
        siteSave: "Save Home/Cards/Footer"
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
        labelFeatureMediaType: "主媒体类型",
        labelFeatureImage: "主媒体 URL",
        labelFeatureAlt: "主媒体 ALT",
        labelFeatureUpload: "上传主媒体",
        sectionsHeading: "段落",
        sectionHeadingLabel: "段落标题",
        sectionBodyLabel: "段落内容",
        sectionMediaTypeLabel: "段落媒体类型",
        sectionImageLabel: "段落媒体 URL",
        sectionImageUploadLabel: "上传段落媒体",
        mediaTypeImage: "图片 / GIF",
        mediaTypeVideo: "视频",
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
        statusStorageLimit: "存储空间不足。大型视频建议使用 URL 链接而非直接上传嵌入。",
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
        siteSpotlightHeading: "首页介绍卡片（3个）",
        siteSpotlightTitleLabel: "卡片标题",
        siteSpotlightDescriptionLabel: "卡片说明",
        siteSpotlightLinkLabel: "卡片链接 URL",
        siteFooterHeading: "页脚",
        siteFooterCopyrightLabel: "版权文案",
        siteFooterCommunityLabel: "社区文案",
        siteSave: "保存首页/卡片/页脚"
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

  const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "ogv", "avi", "mkv"]);
  const TOPIC_MEDIA_DEFAULTS = {
    about: {
      "hepta-labs": {
        url: "/assets/topic-media/about-hepta-labs.svg",
        alt: {
          ko: "Hepta Labs 회사 소개 대표 비주얼",
          en: "Hepta Labs company overview visual",
          zh: "Hepta Labs 公司介绍主视觉"
        }
      },
      vision: {
        url: "/assets/topic-media/about-vision.svg",
        alt: {
          ko: "Hepta Labs 비전 대표 비주얼",
          en: "Hepta Labs vision visual",
          zh: "Hepta Labs 愿景主视觉"
        }
      },
      greeting: {
        url: "/assets/topic-media/about-greeting.svg",
        alt: {
          ko: "Hepta Labs 인사말 대표 비주얼",
          en: "Hepta Labs greeting visual",
          zh: "Hepta Labs 致辞主视觉"
        }
      }
    },
    business: {
      mining: {
        url: "/assets/topic-media/business-mining.svg",
        alt: {
          ko: "마이닝 사업 대표 비주얼",
          en: "Mining business visual",
          zh: "矿业业务主视觉"
        }
      },
      "white-label": {
        url: "/assets/topic-media/business-white-label.svg",
        alt: {
          ko: "화이트라벨 사업 대표 비주얼",
          en: "White label business visual",
          zh: "白标业务主视觉"
        }
      },
      "crypto-exchange": {
        url: "/assets/topic-media/business-crypto-exchange.svg",
        alt: {
          ko: "가상자산 거래소 사업 대표 비주얼",
          en: "Crypto exchange business visual",
          zh: "加密交易所业务主视觉"
        }
      },
      "ai-trading-bot": {
        url: "/assets/topic-media/business-ai-trading-bot.svg",
        alt: {
          ko: "AI 트레이딩 봇 사업 대표 비주얼",
          en: "AI trading bot business visual",
          zh: "AI 交易机器人业务主视觉"
        }
      },
      development: {
        url: "/assets/topic-media/business-development.svg",
        alt: {
          ko: "개발 사업 대표 비주얼",
          en: "Development business visual",
          zh: "开发业务主视觉"
        }
      }
    }
  };

  const normalizeMediaType = (value, fallback = "image") => {
    const source = asString(value).trim().toLowerCase();
    if (source === "video") {
      return "video";
    }
    if (source === "image") {
      return "image";
    }
    return fallback === "video" ? "video" : "image";
  };

  const inferMediaTypeFromUrl = (value, fallback = "image") => {
    const source = asString(value).trim().toLowerCase();
    if (!source) {
      return normalizeMediaType(fallback);
    }

    if (source.startsWith("data:video/")) {
      return "video";
    }

    if (source.startsWith("data:image/")) {
      return "image";
    }

    const cleaned = source.split("?")[0].split("#")[0];
    const extension = cleaned.includes(".") ? cleaned.split(".").pop() : "";
    if (extension && VIDEO_EXTENSIONS.has(extension)) {
      return "video";
    }

    return normalizeMediaType(fallback);
  };

  const inferMediaTypeFromFile = (file, fallback = "image") => {
    const mime = asString(file && file.type ? file.type : "").toLowerCase();
    if (mime.startsWith("video/")) {
      return "video";
    }
    if (mime.startsWith("image/")) {
      return "image";
    }
    return inferMediaTypeFromUrl(asString(file && file.name ? file.name : ""), fallback);
  };

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
    const mediaUrl = asString(source.image || fallbackSection.image || "");
    const mediaType = normalizeMediaType(
      source.mediaType || fallbackSection.mediaType,
      inferMediaTypeFromUrl(mediaUrl, "image")
    );

    return {
      heading: asString(source.heading || fallbackSection.heading),
      body: asString(source.body || fallbackSection.body),
      image: mediaUrl,
      mediaType
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
    const featureMediaUrl = asString(source.featureImage || fallbackTranslation.featureImage || "");
    const featureMediaType = normalizeMediaType(
      source.featureMediaType || fallbackTranslation.featureMediaType,
      inferMediaTypeFromUrl(featureMediaUrl, "image")
    );

    return {
      title: asString(source.title || fallbackTranslation.title),
      subtitle: asString(source.subtitle || fallbackTranslation.subtitle),
      featureImage: featureMediaUrl,
      featureMediaType,
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

  const ensureSpotlightCard = (value, fallback = {}) => {
    const source = value && typeof value === "object" ? value : {};
    const fallbackCard = fallback && typeof fallback === "object" ? fallback : {};

    return {
      title: asString(source.title || fallbackCard.title),
      description: asString(source.description || fallbackCard.description),
      link: asString(source.link || fallbackCard.link)
    };
  };

  const makeDefaultDynamic = () => ({
    newsPosts: [
      {
        id: "news-20260324-infra-ops",
        createdAt: "2026-03-24T02:10:00.000Z",
        updatedAt: "2026-03-24T02:10:00.000Z",
        image: "/assets/news-media/news-01-infra-ops.svg",
        imageAlt: {
          ko: "인프라 운영 고도화 뉴스 대표 이미지",
          en: "Infrastructure operations upgrade news visual",
          zh: "基础设施运维升级新闻主视觉"
        },
        translations: {
          ko: {
            title: "인프라 관제 스택 고도화 완료",
            excerpt: "멀티 리전 서버 상태를 실시간 추적하는 신규 관제 스택을 운영에 반영했습니다.",
            body:
              "Hepta Labs는 한국/중국 거점의 서버 메트릭을 단일 보드에서 확인할 수 있도록 관제 스택을 고도화했습니다.\\n장애 신호 탐지 시간을 단축해 운영 대응 속도와 가용성 지표를 함께 개선했습니다."
          },
          en: {
            title: "Infrastructure Monitoring Stack Upgrade Completed",
            excerpt:
              "A new observability stack was deployed for real-time multi-region server tracking.",
            body:
              "Hepta Labs upgraded its monitoring stack so teams can manage Korea and China nodes from a unified dashboard.\\nThe rollout reduced incident detection time and improved service availability."
          },
          zh: {
            title: "基础设施监控体系升级完成",
            excerpt: "全新可观测性架构已上线，可实时追踪多地区服务器状态。",
            body:
              "Hepta Labs 完成了韩中节点统一监控体系升级，运维团队可在同一看板执行监控与响应。\\n本次升级显著缩短了故障感知时间并提升了整体可用性。"
          }
        }
      },
      {
        id: "news-20260323-ai-risk-engine",
        createdAt: "2026-03-23T07:40:00.000Z",
        updatedAt: "2026-03-23T07:40:00.000Z",
        image: "/assets/news-media/news-02-ai-risk.svg",
        imageAlt: {
          ko: "AI 리스크 엔진 업데이트 뉴스 대표 이미지",
          en: "AI risk engine update news visual",
          zh: "AI 风控引擎更新新闻主视觉"
        },
        translations: {
          ko: {
            title: "AI 리스크 엔진 2.1 릴리스",
            excerpt: "급격한 변동 구간을 더 빠르게 감지하는 리스크 시그널 엔진을 배포했습니다.",
            body:
              "새 리스크 엔진은 주문 체결 속도와 손실 제한 로직의 균형을 강화하는 데 중점을 두었습니다.\\n전략별 이상 패턴 분류 정확도를 높여 변동성 구간에서 안정적인 포지션 관리가 가능해졌습니다."
          },
          en: {
            title: "AI Risk Engine 2.1 Released",
            excerpt: "A faster risk-signal engine is now active for high-volatility windows.",
            body:
              "The new risk engine improves balance between execution speed and downside controls.\\nPattern classification for strategy anomalies was upgraded to support more stable position management."
          },
          zh: {
            title: "AI 风控引擎 2.1 正式发布",
            excerpt: "新引擎可在高波动区间更快识别风险信号。",
            body:
              "本次升级重点优化了成交速度与风控约束之间的平衡。\\n策略异常模式识别能力提升后，仓位控制的稳定性得到进一步加强。"
          }
        }
      },
      {
        id: "news-20260322-storage-zone",
        createdAt: "2026-03-22T04:25:00.000Z",
        updatedAt: "2026-03-22T04:25:00.000Z",
        image: "/assets/news-media/news-03-storage.svg",
        imageAlt: {
          ko: "Web3 스토리지 확장 뉴스 대표 이미지",
          en: "Web3 storage expansion news visual",
          zh: "Web3 存储扩容新闻主视觉"
        },
        translations: {
          ko: {
            title: "Web3 스토리지 고가용성 존 확장",
            excerpt: "신규 스토리지 존을 추가해 데이터 복원력과 처리량을 동시에 강화했습니다.",
            body:
              "Hepta Labs는 파일 분산 저장 운영 구간에 고가용성 존을 추가했습니다.\\n핵심 고객사의 장기 데이터 보관 시나리오를 기준으로 복구 자동화와 트래픽 분산 정책을 재정비했습니다."
          },
          en: {
            title: "Web3 Storage High-Availability Zones Expanded",
            excerpt: "New storage zones were added to improve resiliency and throughput together.",
            body:
              "Hepta Labs expanded high-availability zones across its distributed storage operations.\\nRecovery automation and traffic balancing policies were updated around long-term client workloads."
          },
          zh: {
            title: "Web3 存储高可用区域完成扩容",
            excerpt: "新增存储区域后，数据韧性与处理能力同步提升。",
            body:
              "Hepta Labs 在分布式存储服务中新增高可用区域。\\n围绕客户长期数据托管场景，我们同步优化了恢复自动化与流量分配策略。"
          }
        }
      },
      {
        id: "news-20260321-exchange-core",
        createdAt: "2026-03-21T09:30:00.000Z",
        updatedAt: "2026-03-21T09:30:00.000Z",
        image: "/assets/news-media/news-04-exchange.svg",
        imageAlt: {
          ko: "거래소 코어 성능 개선 뉴스 대표 이미지",
          en: "Exchange core performance update news visual",
          zh: "交易所核心性能升级新闻主视觉"
        },
        translations: {
          ko: {
            title: "자체 거래소 실행 코어 성능 개선",
            excerpt: "주문 라우팅 지연을 낮추고 체결 안정성을 높인 신규 실행 코어를 반영했습니다.",
            body:
              "주문 경로 재계산 주기를 최적화해 체결 지연을 줄였고, 순간 트래픽 급증 상황에서 큐 안정성을 개선했습니다.\\n운영 관점에서는 장애 탐지와 롤백 절차를 표준화해 대응 시간을 단축했습니다."
          },
          en: {
            title: "Proprietary Exchange Execution Core Improved",
            excerpt: "Routing latency was reduced while execution stability was increased.",
            body:
              "Order-routing recalculation windows were optimized to reduce execution delay, and queue stability was improved under peak traffic.\\nIncident detection and rollback playbooks were also standardized."
          },
          zh: {
            title: "自营交易所执行核心性能升级",
            excerpt: "订单路由延迟降低，成交稳定性进一步提升。",
            body:
              "通过优化订单路径重计算周期，我们降低了撮合延迟，并提升了高峰流量下的队列稳定性。\\n同时标准化了故障检测与回滚流程，响应效率明显提高。"
          }
        }
      },
      {
        id: "news-20260320-white-label",
        createdAt: "2026-03-20T06:20:00.000Z",
        updatedAt: "2026-03-20T06:20:00.000Z",
        image: "/assets/news-media/news-05-white-label.svg",
        imageAlt: {
          ko: "화이트라벨 신규 고객 온보딩 뉴스 대표 이미지",
          en: "White-label onboarding news visual",
          zh: "白标客户上线新闻主视觉"
        },
        translations: {
          ko: {
            title: "화이트라벨 거래소 신규 고객 온보딩",
            excerpt: "브랜딩/도메인/운영 모듈을 포함한 원스톱 온보딩 패키지를 적용했습니다.",
            body:
              "신규 고객사는 템플릿 기반 UI와 운영 모듈을 결합해 빠르게 런칭 준비를 마쳤습니다.\\n설정 자동화 범위를 넓혀 초기 세팅 리드타임을 기존 대비 단축했습니다."
          },
          en: {
            title: "New White-Label Exchange Client Onboarded",
            excerpt: "A one-stop onboarding package was delivered with branding and ops modules.",
            body:
              "The client prepared launch quickly by combining template UI with operations modules.\\nExpanded setup automation reduced initial onboarding lead-time compared to previous projects."
          },
          zh: {
            title: "白标交易所新客户完成上线准备",
            excerpt: "品牌、域名与运维模块打包的一站式方案已交付。",
            body:
              "新客户通过模板化前端与运维模块组合，快速完成上线准备。\\n我们进一步扩大了配置自动化范围，明显缩短了初始交付周期。"
          }
        }
      },
      {
        id: "news-20260319-dev-delivery",
        createdAt: "2026-03-19T11:05:00.000Z",
        updatedAt: "2026-03-19T11:05:00.000Z",
        image: "/assets/news-media/news-06-dev-team.svg",
        imageAlt: {
          ko: "개발 납기 성과 뉴스 대표 이미지",
          en: "Development delivery milestone news visual",
          zh: "开发交付里程碑新闻主视觉"
        },
        translations: {
          ko: {
            title: "개발 조직 분기 납기 지표 달성",
            excerpt: "Web/App 및 블록체인 프로젝트 3건을 예정 일정 내 동시 출시했습니다.",
            body:
              "프로덕트, 인프라, QA 스쿼드 간 공통 체크리스트를 적용해 병렬 개발 효율을 높였습니다.\\n릴리스 후 모니터링 구간에서도 주요 지표 안정화를 확인했습니다."
          },
          en: {
            title: "Development Team Hit Quarterly Delivery Milestone",
            excerpt: "Three Web/App and blockchain projects were launched on schedule.",
            body:
              "Shared checklists across product, infra, and QA squads improved parallel delivery efficiency.\\nPost-release monitoring confirmed stabilization of key service indicators."
          },
          zh: {
            title: "开发团队达成季度交付里程碑",
            excerpt: "3 个 Web/App 与区块链项目按计划同步上线。",
            body:
              "通过产品、基础设施与 QA 团队的统一清单机制，我们提升了并行交付效率。\\n上线后的监控阶段也确认了关键指标的稳定性。"
          }
        }
      },
      {
        id: "news-20260318-mining-efficiency",
        createdAt: "2026-03-18T03:50:00.000Z",
        updatedAt: "2026-03-18T03:50:00.000Z",
        image: "/assets/news-media/news-07-mining-eff.svg",
        imageAlt: {
          ko: "마이닝 효율 최적화 뉴스 대표 이미지",
          en: "Mining efficiency optimization news visual",
          zh: "矿业效率优化新闻主视觉"
        },
        translations: {
          ko: {
            title: "마이닝 전력 효율 최적화 업데이트",
            excerpt: "운영 스케줄링 개선으로 에너지 효율 지표를 상향 조정했습니다.",
            body:
              "채굴 장비 상태와 전력 단가를 함께 반영하는 스케줄링 규칙을 적용했습니다.\\n장비 운영 안정성을 유지하면서도 단위당 전력 효율을 개선했습니다."
          },
          en: {
            title: "Mining Power Efficiency Optimization Update",
            excerpt: "Energy efficiency metrics improved through revised scheduling logic.",
            body:
              "Scheduling rules now account for both rig condition and power cost in real time.\\nThe update improved energy efficiency while maintaining stable mining operations."
          },
          zh: {
            title: "矿业能效优化更新完成",
            excerpt: "通过调度策略升级，能效指标实现提升。",
            body:
              "我们已将设备状态与实时电价纳入同一调度规则。\\n在保障矿机稳定运行的同时，单位能耗效率得到持续优化。"
          }
        }
      },
      {
        id: "news-20260317-korea-china-node",
        createdAt: "2026-03-17T08:15:00.000Z",
        updatedAt: "2026-03-17T08:15:00.000Z",
        image: "/assets/news-media/news-08-kor-chn.svg",
        imageAlt: {
          ko: "한국-중국 노드 통합 운영 뉴스 대표 이미지",
          en: "Korea-China node integration news visual",
          zh: "韩中节点联动运维新闻主视觉"
        },
        translations: {
          ko: {
            title: "한국-중국 노드 통합 운영 대시보드 공개",
            excerpt: "복수 거점 노드 상태를 단일 화면에서 확인하는 운영 대시보드를 적용했습니다.",
            body:
              "지역별 운영 지표를 동일 기준으로 비교할 수 있도록 데이터 스키마를 표준화했습니다.\\n장애 대응 및 자원 배분 의사결정 속도가 개선되며 글로벌 운영 일관성이 높아졌습니다."
          },
          en: {
            title: "Unified Korea-China Node Operations Dashboard Launched",
            excerpt: "A single-pane dashboard now tracks node health across regions.",
            body:
              "Data schemas were standardized so operators can compare region-level metrics consistently.\\nFaster response and resource allocation decisions improved global operating consistency."
          },
          zh: {
            title: "韩中节点一体化运维看板上线",
            excerpt: "跨区域节点状态可在统一界面中实时查看。",
            body:
              "我们标准化了区域运维数据结构，使团队可以按同一口径比较关键指标。\\n故障响应与资源调度决策速度提升后，全球运维一致性进一步增强。"
          }
        }
      }
    ],
    notices: [
      {
        id: "notice-20260324-platform-window",
        createdAt: "2026-03-24T01:30:00.000Z",
        updatedAt: "2026-03-24T01:30:00.000Z",
        popup: true,
        image: "/assets/notice-media/notice-01-platform-window.svg",
        imageAlt: {
          ko: "플랫폼 점검 안내 공지 이미지",
          en: "Platform maintenance notice visual",
          zh: "平台维护通知主视觉"
        },
        translations: {
          ko: {
            title: "플랫폼 정기 점검 일정 안내",
            excerpt: "서비스 안정성 강화를 위한 정기 점검 시간이 공지되었습니다.",
            body:
              "Hepta Labs 플랫폼은 2026년 3월 27일 02:00~04:00(KST) 정기 점검을 진행합니다.\\n점검 시간에는 일부 조회 기능의 응답이 지연될 수 있으며, 점검 완료 즉시 정상화됩니다."
          },
          en: {
            title: "Scheduled Platform Maintenance Window",
            excerpt: "A maintenance window has been announced to improve service stability.",
            body:
              "Hepta Labs will run scheduled maintenance from 02:00 to 04:00 KST on March 27, 2026.\\nSome read-only features may respond slower during the window, then return to normal immediately after completion."
          },
          zh: {
            title: "平台定期维护时段公告",
            excerpt: "为提升服务稳定性，现发布定期维护安排。",
            body:
              "Hepta Labs 将于 2026 年 3 月 27 日 02:00~04:00（KST）进行例行维护。\\n维护期间部分查询功能可能出现短暂延迟，维护结束后将立即恢复。"
          }
        }
      },
      {
        id: "notice-20260323-risk-policy",
        createdAt: "2026-03-23T03:15:00.000Z",
        updatedAt: "2026-03-23T03:15:00.000Z",
        popup: false,
        image: "/assets/notice-media/notice-02-risk-policy.svg",
        imageAlt: {
          ko: "리스크 운영 정책 개정 공지 이미지",
          en: "Risk policy update notice visual",
          zh: "风控政策更新通知主视觉"
        },
        translations: {
          ko: {
            title: "리스크 운영 정책 v2.1 적용 안내",
            excerpt: "변동성 구간 대응 기준이 업데이트되었습니다.",
            body:
              "리스크 운영 정책이 v2.1로 개정되어 고변동 구간의 자동 방어 기준이 강화되었습니다.\\n고객사는 어드민의 정책 문서 탭에서 최신 기준을 확인할 수 있습니다."
          },
          en: {
            title: "Risk Operations Policy v2.1 Applied",
            excerpt: "Response standards for high-volatility windows have been updated.",
            body:
              "Risk operations policy has been updated to v2.1 with stronger automated defense thresholds in volatile markets.\\nClients can review the latest baseline from the policy document tab in admin."
          },
          zh: {
            title: "风控运营政策 v2.1 已生效",
            excerpt: "高波动区间的响应标准已完成更新。",
            body:
              "风控运营政策已升级至 v2.1，并强化了高波动行情下的自动防护阈值。\\n客户可在管理端政策文档页查看最新标准。"
          }
        }
      },
      {
        id: "notice-20260322-news-module",
        createdAt: "2026-03-22T05:20:00.000Z",
        updatedAt: "2026-03-22T05:20:00.000Z",
        popup: false,
        image: "/assets/notice-media/notice-03-news-module.svg",
        imageAlt: {
          ko: "뉴스 모듈 개선 공지 이미지",
          en: "News module enhancement notice visual",
          zh: "新闻模块优化通知主视觉"
        },
        translations: {
          ko: {
            title: "뉴스 모듈 UI/편집 기능 개선",
            excerpt: "이미지 중심 카드와 게시글 관리 흐름이 개선되었습니다.",
            body:
              "정보 > News 메뉴에서 카드형 목록과 상세 이동 UX가 개선되었습니다.\\n관리자 페이지에서는 이미지 업로드, 본문 편집, 게시 일자 조정이 더 직관적으로 동작합니다."
          },
          en: {
            title: "News Module UI and Editing Flow Updated",
            excerpt: "Image-first cards and post management flow were improved.",
            body:
              "The Infos > News area now has a cleaner card list and detail navigation experience.\\nIn admin, image uploads, body editing, and publish-date controls were streamlined."
          },
          zh: {
            title: "新闻模块界面与编辑流程升级",
            excerpt: "图片卡片展示与内容管理流程已优化。",
            body:
              "资讯 > News 现提供更清晰的卡片列表与详情浏览体验。\\n管理端的图片上传、正文编辑与发布时间调整也更直观。"
          }
        }
      },
      {
        id: "notice-20260321-admin-security",
        createdAt: "2026-03-21T07:40:00.000Z",
        updatedAt: "2026-03-21T07:40:00.000Z",
        popup: false,
        image: "/assets/notice-media/notice-04-admin-security.svg",
        imageAlt: {
          ko: "관리자 보안 정책 공지 이미지",
          en: "Admin security policy notice visual",
          zh: "管理后台安全策略通知主视觉"
        },
        translations: {
          ko: {
            title: "어드민 보안 정책 업데이트",
            excerpt: "관리자 접근 정책 및 세션 규칙이 업데이트되었습니다.",
            body:
              "관리자 로그인 세션 정책이 정비되어 보안 기준이 강화되었습니다.\\n공용 PC 사용 후에는 반드시 로그아웃을 실행하고, 비밀번호는 주기적으로 변경해 주세요."
          },
          en: {
            title: "Admin Security Policy Update",
            excerpt: "Access policy and session rules for admin were updated.",
            body:
              "Admin session controls were revised to improve security standards.\\nPlease always log out on shared devices and rotate passwords regularly."
          },
          zh: {
            title: "管理后台安全策略更新",
            excerpt: "后台访问策略与会话规则已完成更新。",
            body:
              "管理端会话控制已优化，以提升整体安全基线。\\n在公用设备上使用后请务必退出登录，并定期更换密码。"
          }
        }
      },
      {
        id: "notice-20260320-support-hours",
        createdAt: "2026-03-20T08:55:00.000Z",
        updatedAt: "2026-03-20T08:55:00.000Z",
        popup: false,
        image: "/assets/notice-media/notice-05-support-hours.svg",
        imageAlt: {
          ko: "고객 지원 운영시간 공지 이미지",
          en: "Support hours notice visual",
          zh: "客户支持时段通知主视觉"
        },
        translations: {
          ko: {
            title: "고객 지원 운영시간 조정 안내",
            excerpt: "글로벌 고객 대응 강화를 위해 운영시간이 확장됩니다.",
            body:
              "2026년 3월 25일부터 고객 지원 운영시간이 09:00~22:00(KST)로 확대됩니다.\\n긴급 이슈는 Help > Contact 채널을 통해 24시간 접수 가능합니다."
          },
          en: {
            title: "Customer Support Hours Extended",
            excerpt: "Support operation hours are expanded for global response coverage.",
            body:
              "Starting March 25, 2026, support hours will run from 09:00 to 22:00 KST.\\nUrgent issues can still be submitted 24/7 through Help > Contact."
          },
          zh: {
            title: "客户支持服务时段调整通知",
            excerpt: "为增强全球响应能力，服务时段将延长。",
            body:
              "自 2026 年 3 月 25 日起，客户支持时段调整为 09:00~22:00（KST）。\\n紧急事项仍可通过 Help > Contact 渠道 24 小时提交。"
          }
        }
      },
      {
        id: "notice-20260319-media-guideline",
        createdAt: "2026-03-19T10:10:00.000Z",
        updatedAt: "2026-03-19T10:10:00.000Z",
        popup: false,
        image: "/assets/notice-media/notice-06-media-guideline.svg",
        imageAlt: {
          ko: "콘텐츠 미디어 가이드 공지 이미지",
          en: "Media guideline notice visual",
          zh: "内容媒体规范通知主视觉"
        },
        translations: {
          ko: {
            title: "콘텐츠 업로드 미디어 가이드 배포",
            excerpt: "이미지/GIF/영상 업로드 권장 규격이 공지되었습니다.",
            body:
              "사이트 전반의 품질 일관성을 위해 미디어 업로드 가이드가 배포되었습니다.\\n권장 해상도, 용량 제한, 파일 포맷 규칙을 확인한 뒤 등록해 주세요."
          },
          en: {
            title: "Media Upload Guidelines Published",
            excerpt: "Recommended specs for image/GIF/video uploads are now available.",
            body:
              "To keep visual quality consistent, a media guideline has been published for all sections.\\nPlease check recommended resolution, file size limits, and format rules before upload."
          },
          zh: {
            title: "媒体上传规范已发布",
            excerpt: "图片/GIF/视频上传建议规格已公告。",
            body:
              "为保持站点视觉质量一致，我们已发布统一媒体上传规范。\\n上传前请确认推荐分辨率、容量限制与文件格式要求。"
          }
        }
      },
      {
        id: "notice-20260318-qna-response",
        createdAt: "2026-03-18T09:25:00.000Z",
        updatedAt: "2026-03-18T09:25:00.000Z",
        popup: false,
        image: "/assets/notice-media/notice-07-qna-response.svg",
        imageAlt: {
          ko: "QnA 답변 정책 공지 이미지",
          en: "QnA response policy notice visual",
          zh: "QnA 回复政策通知主视觉"
        },
        translations: {
          ko: {
            title: "QnA 답변 SLA 안내",
            excerpt: "문의 접수 후 답변 제공 기준 시간이 공지되었습니다.",
            body:
              "QnA 접수 건은 영업일 기준 24시간 이내 1차 답변을 원칙으로 운영합니다.\\n고난도 기술 문의는 분석 범위에 따라 추가 시간이 소요될 수 있습니다."
          },
          en: {
            title: "QnA Response SLA Notice",
            excerpt: "Standard response timelines are now published for inquiries.",
            body:
              "QnA submissions receive an initial response within 24 business hours by default.\\nComplex technical questions may require additional analysis time."
          },
          zh: {
            title: "QnA 回复时效说明",
            excerpt: "问询处理的标准回复时限已公布。",
            body:
              "QnA 提交后，原则上将在 24 个工作小时内提供首次回复。\\n复杂技术问题可能根据分析范围延长处理时间。"
          }
        }
      },
      {
        id: "notice-20260317-domain-https",
        createdAt: "2026-03-17T04:45:00.000Z",
        updatedAt: "2026-03-17T04:45:00.000Z",
        popup: false,
        image: "/assets/notice-media/notice-08-domain-https.svg",
        imageAlt: {
          ko: "도메인 HTTPS 적용 공지 이미지",
          en: "Domain HTTPS notice visual",
          zh: "域名 HTTPS 通知主视觉"
        },
        translations: {
          ko: {
            title: "커스텀 도메인 HTTPS 적용 완료",
            excerpt: "heptalabs.co.kr 도메인의 HTTPS 구성이 완료되었습니다.",
            body:
              "커스텀 도메인 구성이 완료되어 모든 접속 경로가 HTTPS로 제공됩니다.\\n브라우저 캐시가 남아 있는 경우 새로고침 후 최신 인증서를 확인해 주세요."
          },
          en: {
            title: "Custom Domain HTTPS Enabled",
            excerpt: "HTTPS provisioning for heptalabs.co.kr has been completed.",
            body:
              "Custom domain setup is complete and all traffic is now served over HTTPS.\\nIf your browser has stale cache, refresh once to fetch the latest certificate path."
          },
          zh: {
            title: "自定义域名 HTTPS 已启用",
            excerpt: "heptalabs.co.kr 的 HTTPS 配置已完成。",
            body:
              "自定义域名配置已完成，所有访问路径均通过 HTTPS 提供。\\n如浏览器缓存较旧，请刷新后再次确认最新证书。"
          }
        }
      },
      {
        id: "notice-20260316-language-sync",
        createdAt: "2026-03-16T06:05:00.000Z",
        updatedAt: "2026-03-16T06:05:00.000Z",
        popup: false,
        image: "/assets/notice-media/notice-09-language-sync.svg",
        imageAlt: {
          ko: "다국어 콘텐츠 동기화 공지 이미지",
          en: "Multilingual sync notice visual",
          zh: "多语言同步通知主视觉"
        },
        translations: {
          ko: {
            title: "한/영/중 콘텐츠 동기화 업데이트",
            excerpt: "핵심 메뉴의 다국어 콘텐츠 정합성이 개선되었습니다.",
            body:
              "회사소개/비즈니스/정보/도움말 전 영역의 다국어 표현을 재정비했습니다.\\n동일 의미 기준으로 톤을 맞춰 언어 전환 시 일관된 메시지를 제공합니다."
          },
          en: {
            title: "KO/EN/ZH Content Sync Update",
            excerpt: "Cross-language consistency has been improved across key menus.",
            body:
              "Language parity was refined across About, Business, Infos, and Help.\\nUsers now get consistent messaging semantics when switching languages."
          },
          zh: {
            title: "韩英中文内容同步更新",
            excerpt: "核心菜单的多语言一致性已完成优化。",
            body:
              "关于、业务、资讯、帮助等主要栏目已完成多语言语义对齐。\\n切换语言时可获得更一致的品牌表达体验。"
          }
        }
      },
      {
        id: "notice-20260315-admin-backup",
        createdAt: "2026-03-15T11:35:00.000Z",
        updatedAt: "2026-03-15T11:35:00.000Z",
        popup: false,
        image: "/assets/notice-media/notice-10-admin-backup.svg",
        imageAlt: {
          ko: "어드민 백업 정책 공지 이미지",
          en: "Admin backup policy notice visual",
          zh: "后台备份策略通知主视觉"
        },
        translations: {
          ko: {
            title: "어드민 데이터 백업 권장 절차 안내",
            excerpt: "운영 안정성을 위한 JSON 내보내기 백업 절차를 권장합니다.",
            body:
              "콘텐츠 변경 전후로 어드민의 JSON 내보내기 기능을 활용해 백업을 보관해 주세요.\\n예기치 않은 브라우저 저장소 이슈가 발생해도 빠르게 복원할 수 있습니다."
          },
          en: {
            title: "Recommended Admin Backup Procedure",
            excerpt: "JSON export backups are recommended for operational safety.",
            body:
              "Please export JSON backups before and after major content updates in admin.\\nThis allows fast recovery if browser storage issues occur unexpectedly."
          },
          zh: {
            title: "后台数据备份建议流程",
            excerpt: "建议使用 JSON 导出功能进行例行备份。",
            body:
              "建议在重要内容修改前后执行管理端 JSON 导出备份。\\n即使浏览器存储发生异常，也可快速恢复内容。"
          }
        }
      }
    ],
    inquiries: [
      {
        id: "qna-20260324-enterprise-onboarding",
        name: "김도현",
        phone: "010-9234-1120",
        email: "dohyun.kim@samplemail.com",
        question:
          "화이트라벨 거래소 구축을 검토 중입니다. 브랜드 커스텀 범위와 초기 오픈까지 평균 일정이 어느 정도인지 알고 싶습니다.",
        lang: "ko",
        createdAt: "2026-03-24T06:10:00.000Z",
        answeredAt: "2026-03-24T09:40:00.000Z",
        answers: {
          ko: "문의 감사합니다. 기본 패키지 기준 3~5주 내 MVP 오픈이 가능하며, 브랜딩/도메인/운영권한 설계는 초기 주차에 함께 확정합니다.",
          en: "Thanks for reaching out. For the base package, MVP launch is typically possible in 3-5 weeks, with branding, domain, and operation scopes aligned in week one.",
          zh: "感谢咨询。标准套餐通常可在 3-5 周内完成 MVP 上线，品牌、域名与运营权限范围会在首周一起确认。"
        }
      },
      {
        id: "qna-20260323-api-monitoring",
        name: "이수진",
        phone: "010-5582-9901",
        email: "sujin.lee@samplemail.com",
        question:
          "기존 백오피스가 있는데 Hepta Labs 모니터링 대시보드와 API로 연동 가능한지 궁금합니다.",
        lang: "ko",
        createdAt: "2026-03-23T04:30:00.000Z",
        answers: {
          ko: "",
          en: "",
          zh: ""
        }
      },
      {
        id: "qna-20260322-security-audit",
        name: "박현우",
        phone: "010-4142-7231",
        email: "hyunwoo.park@samplemail.com",
        question:
          "서비스 런칭 전 보안 점검 항목(계정 권한, 로그 감사, 인프라 취약점 점검)도 포함되는지 확인 부탁드립니다.",
        lang: "ko",
        createdAt: "2026-03-22T08:05:00.000Z",
        answeredAt: "2026-03-22T11:20:00.000Z",
        answers: {
          ko: "네, 가능합니다. 프리런치 단계에서 계정 권한 정책/감사로그/인프라 취약점 체크리스트를 포함한 보안 점검 패키지를 제공합니다.",
          en: "Yes. In the pre-launch phase, we provide a security checklist package covering account permissions, audit logs, and infrastructure vulnerability reviews.",
          zh: "可以。在上线前阶段，我们提供包含账号权限、审计日志与基础设施漏洞检查的安全审查包。"
        }
      },
      {
        id: "qna-20260321-sla-request",
        name: "정하늘",
        phone: "010-3371-4409",
        email: "haneul.jeong@samplemail.com",
        question:
          "장애 발생 시 1차 응답 SLA와 정기 리포트 제공 주기가 어떻게 되는지 안내 부탁드립니다.",
        lang: "ko",
        createdAt: "2026-03-21T02:55:00.000Z",
        answers: {
          ko: "",
          en: "",
          zh: ""
        }
      },
      {
        id: "qna-20260320-global-ops",
        name: "최민석",
        phone: "010-2851-6643",
        email: "minseok.choi@samplemail.com",
        question:
          "한국/중국 노드 동시 운영 시 대시보드에서 지역별 상태와 알림 우선순위를 개별 설정할 수 있나요?",
        lang: "ko",
        createdAt: "2026-03-20T10:45:00.000Z",
        answeredAt: "2026-03-20T13:35:00.000Z",
        answers: {
          ko: "가능합니다. 지역별 노드 그룹을 분리해 경보 임계치와 알림 우선순위를 각각 설정할 수 있으며, 통합 보드에서 동시 모니터링됩니다.",
          en: "Yes. You can split node groups by region and set independent alert thresholds and priorities while monitoring everything in one unified board.",
          zh: "支持。可按区域拆分节点组并分别配置告警阈值与优先级，同时在统一看板中集中监控。"
        }
      },
      {
        id: "qna-20260319-media-upload",
        name: "양지윤",
        phone: "010-7781-3312",
        email: "jiyoon.yang@samplemail.com",
        question:
          "어드민에서 영상 업로드 시 권장 파일 포맷과 최대 용량 기준이 있다면 공유 부탁드립니다.",
        lang: "ko",
        createdAt: "2026-03-19T07:25:00.000Z",
        answers: {
          ko: "",
          en: "",
          zh: ""
        }
      },
      {
        id: "qna-20260318-custom-domain",
        name: "오세훈",
        phone: "010-6192-7704",
        email: "sehun.oh@samplemail.com",
        question:
          "커스텀 도메인 연결 시 www 리다이렉트와 HTTPS 자동 갱신까지 일괄 지원되는지 궁금합니다.",
        lang: "ko",
        createdAt: "2026-03-18T05:40:00.000Z",
        answeredAt: "2026-03-18T08:55:00.000Z",
        answers: {
          ko: "네, DNS 설정 가이드와 함께 www 리다이렉트 및 HTTPS 인증서 적용 절차까지 지원합니다. 운영 중 갱신 정책도 함께 안내드립니다.",
          en: "Yes. We support DNS setup guidance, www redirection, and HTTPS certificate enablement as one flow, including certificate renewal policy notes.",
          zh: "是的，我们提供 DNS 配置指引，并支持 www 跳转与 HTTPS 证书配置的一体化流程，同时说明证书续期策略。"
        }
      },
      {
        id: "qna-20260317-kpi-dashboard",
        name: "배유진",
        phone: "010-5210-2046",
        email: "yujin.bae@samplemail.com",
        question:
          "뉴스/공지/QnA 반응을 내부 KPI로 보고 싶은데 조회수나 전환 관련 지표 확장 계획이 있는지요?",
        lang: "ko",
        createdAt: "2026-03-17T03:10:00.000Z",
        answers: {
          ko: "",
          en: "",
          zh: ""
        }
      },
      {
        id: "qna-20260316-launch-support",
        name: "문재영",
        phone: "010-8433-1198",
        email: "jaeyoung.moon@samplemail.com",
        question:
          "신규 서비스 오픈 당일에 장애 대응 대기 인력을 별도로 요청할 수 있는지 확인 부탁드립니다.",
        lang: "ko",
        createdAt: "2026-03-16T11:15:00.000Z",
        answeredAt: "2026-03-16T14:05:00.000Z",
        answers: {
          ko: "가능합니다. 오픈 데이 전용 온콜 플랜을 통해 모니터링/장애 대응 인력을 탄력적으로 배치할 수 있습니다.",
          en: "Yes. Through our launch-day on-call plan, dedicated monitoring and incident response resources can be allocated for your release window.",
          zh: "可以。通过上线日 on-call 方案，我们可在发布窗口内配置专门的监控与故障响应资源。"
        }
      },
      {
        id: "qna-20260315-content-workflow",
        name: "신아름",
        phone: "010-7001-5572",
        email: "areum.shin@samplemail.com",
        question:
          "운영팀과 마케팅팀이 동시에 콘텐츠 수정할 때 권장되는 작업 순서나 백업 방식이 있을까요?",
        lang: "ko",
        createdAt: "2026-03-15T02:30:00.000Z",
        answers: {
          ko: "",
          en: "",
          zh: ""
        }
      }
    ]
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
    const spotlights = {};
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

      const sourceSpotlights =
        source.spotlights && Array.isArray(source.spotlights[lang]) ? source.spotlights[lang] : [];
      const fallbackSpotlights =
        fallback.spotlights && Array.isArray(fallback.spotlights[lang])
          ? fallback.spotlights[lang]
          : [];

      spotlights[lang] = [0, 1, 2].map((index) =>
        ensureSpotlightCard(sourceSpotlights[index], fallbackSpotlights[index] || {})
      );

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
      spotlights,
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

  const applyTopicMediaDefaults = (content) => {
    if (!content || !Array.isArray(content.menus)) {
      return content;
    }

    content.menus.forEach((menu) => {
      const menuDefaults = TOPIC_MEDIA_DEFAULTS[menu.id];
      if (!menuDefaults || !Array.isArray(menu.items)) {
        return;
      }

      menu.items.forEach((item) => {
        const itemDefaults = menuDefaults[item.id];
        if (!itemDefaults || !item.translations) {
          return;
        }

        SUPPORTED_LANGS.forEach((lang) => {
          const translation = ensureItemTranslation(item.translations[lang], {});

          if (!asString(translation.featureImage).trim()) {
            translation.featureImage = itemDefaults.url;
          }

          translation.featureMediaType = normalizeMediaType(
            translation.featureMediaType,
            inferMediaTypeFromUrl(translation.featureImage || itemDefaults.url, "image")
          );

          translation.featureImageAlt = ensureLangMap(translation.featureImageAlt, itemDefaults.alt);
          item.translations[lang] = translation;
        });
      });
    });

    return content;
  };

  const normalizeContentShape = (value) => {
    const source = value && typeof value === "object" ? value : {};

    const normalized = {
      version: Number(source.version || defaults.version || 1),
      site: normalizeSite(source.site),
      menus: normalizeMenus(source.menus),
      dynamic: normalizeDynamic(source.dynamic)
    };

    return applyTopicMediaDefaults(normalized);
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
    try {
      localStorage.setItem(STORAGE_KEYS.content, JSON.stringify(normalized));
      return true;
    } catch (error) {
      return false;
    }
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

  const ensureSeededNewsPostsOnce = () => {
    try {
      if (localStorage.getItem(STORAGE_KEYS.newsSeeded) === "1") {
        return;
      }
    } catch (error) {
      return;
    }

    const seedPosts = makeDefaultDynamic().newsPosts.map((post) => normalizeNewsPost(post));
    const existingPosts =
      state.content &&
      state.content.dynamic &&
      Array.isArray(state.content.dynamic.newsPosts)
        ? state.content.dynamic.newsPosts.map((post) => normalizeNewsPost(post))
        : [];

    const merged = new Map(existingPosts.map((post) => [post.id, post]));
    let hasInsertedSeed = false;

    seedPosts.forEach((seed) => {
      if (!merged.has(seed.id)) {
        merged.set(seed.id, seed);
        hasInsertedSeed = true;
      }
    });

    if (hasInsertedSeed) {
      state.content.dynamic.newsPosts = [...merged.values()].sort(sortByDateDesc);
      saveContent(state.content);
    }

    try {
      localStorage.setItem(STORAGE_KEYS.newsSeeded, "1");
    } catch (error) {
      return;
    }
  };

  const ensureSeededNoticesOnce = () => {
    try {
      if (localStorage.getItem(STORAGE_KEYS.noticeSeeded) === "1") {
        return;
      }
    } catch (error) {
      return;
    }

    const seedNotices = makeDefaultDynamic().notices.map((notice) => normalizeNoticePost(notice));
    const existingNotices =
      state.content &&
      state.content.dynamic &&
      Array.isArray(state.content.dynamic.notices)
        ? state.content.dynamic.notices.map((notice) => normalizeNoticePost(notice))
        : [];

    const merged = new Map(existingNotices.map((notice) => [notice.id, notice]));
    let hasInsertedSeed = false;

    seedNotices.forEach((seed) => {
      if (!merged.has(seed.id)) {
        merged.set(seed.id, seed);
        hasInsertedSeed = true;
      }
    });

    if (hasInsertedSeed) {
      state.content.dynamic.notices = [...merged.values()].sort(sortByDateDesc);
      saveContent(state.content);
    }

    try {
      localStorage.setItem(STORAGE_KEYS.noticeSeeded, "1");
    } catch (error) {
      return;
    }
  };

  const ensureSeededInquiriesOnce = () => {
    try {
      if (localStorage.getItem(STORAGE_KEYS.qnaSeeded) === "1") {
        return;
      }
    } catch (error) {
      return;
    }

    const seedInquiries = makeDefaultDynamic().inquiries.map((entry) => normalizeInquiry(entry));
    const existingInquiries =
      state.content &&
      state.content.dynamic &&
      Array.isArray(state.content.dynamic.inquiries)
        ? state.content.dynamic.inquiries.map((entry) => normalizeInquiry(entry))
        : [];

    const merged = new Map(existingInquiries.map((entry) => [entry.id, entry]));
    let hasInsertedSeed = false;

    seedInquiries.forEach((seed) => {
      if (!merged.has(seed.id)) {
        merged.set(seed.id, seed);
        hasInsertedSeed = true;
      }
    });

    if (hasInsertedSeed) {
      state.content.dynamic.inquiries = [...merged.values()].sort(sortByDateDesc);
      saveContent(state.content);
    }

    try {
      localStorage.setItem(STORAGE_KEYS.qnaSeeded, "1");
    } catch (error) {
      return;
    }
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

    const localMasked = `${local.slice(0, 1)}${"*".repeat(Math.max(local.length - 1, 3))}`;
    const domainParts = domain.split(".");
    const domainHead = asString(domainParts.shift());
    const domainTail = asString(domainParts.join("."));
    const domainMasked = `${domainHead.slice(0, 1)}${"*".repeat(Math.max(domainHead.length - 1, 3))}`;

    return domainTail ? `${localMasked}@${domainMasked}.${domainTail}` : `${localMasked}@${domainMasked}`;
  };

  const maskPhone = (phone) => {
    const source = asString(phone).trim();
    if (!source) {
      return "";
    }

    const digits = source.replace(/\D/g, "");
    if (digits.length < 6) {
      return "***";
    }

    const head = digits.slice(0, 3);
    const tail = digits.slice(-2);
    const middleMask = "*".repeat(Math.max(digits.length - 5, 4));
    return `${head}-${middleMask}-${tail}`;
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

    const fallbackDescriptions = [
      businessLabels.slice(0, 3).join(" · "),
      businessLabels.slice(1).join(" · "),
      [aboutVisionLabel, infoNewsLabel].filter(Boolean).join(" · ")
    ];
    const fallbackLinks = [
      buildDetailUrl("business", "mining"),
      buildDetailUrl("business", "development"),
      buildDetailUrl("about", "vision")
    ];

    const siteSpotlights =
      (state.content.site.spotlights &&
        (state.content.site.spotlights[state.lang] || state.content.site.spotlights.en)) ||
      [];

    const cardData = [0, 1, 2].map((index) => {
      const source = siteSpotlights[index] || {};
      return {
        title: asString(source.title) || cardTitles[index] || `Card ${index + 1}`,
        description: asString(source.description) || fallbackDescriptions[index] || "",
        link: asString(source.link) || fallbackLinks[index]
      };
    });

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
    const pageRaw = Number.parseInt(params.get("page") || "1", 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

    const publicMenus = getPublicMenus();
    const firstMenu = publicMenus[0];

    if (!firstMenu) {
      return { menuId: "about", itemId: "hepta-labs", postId, page };
    }

    if (!menuId || !publicMenus.some((menu) => menu.id === menuId)) {
      menuId = firstMenu.id;
    }

    const selectedMenu = getMenu(menuId);
    if (!itemId || !getItem(menuId, itemId)) {
      itemId = selectedMenu.items[0].id;
    }

    return { menuId, itemId, postId, page };
  };

  const createDetailMediaNode = ({
    url,
    mediaType,
    alt,
    imageClassName,
    videoClassName,
    fallbackType = "image"
  }) => {
    const sourceUrl = asString(url).trim();
    if (!sourceUrl) {
      return null;
    }

    const resolvedType = normalizeMediaType(mediaType, inferMediaTypeFromUrl(sourceUrl, fallbackType));
    if (resolvedType === "video") {
      const video = document.createElement("video");
      video.className = videoClassName;
      video.src = sourceUrl;
      video.controls = true;
      video.preload = "metadata";
      video.playsInline = true;
      const label = asString(alt).trim();
      if (label) {
        video.setAttribute("title", label);
        video.setAttribute("aria-label", label);
      }
      return video;
    }

    const image = document.createElement("img");
    image.className = imageClassName;
    image.src = sourceUrl;
    image.alt = asString(alt);
    image.loading = "lazy";
    return image;
  };

  const appendFeatureImage = (translation, target) => {
    const featureAlt = getLocalizedLabel(translation.featureImageAlt) || asString(translation.title);
    const mediaNode = createDetailMediaNode({
      url: translation.featureImage,
      mediaType: translation.featureMediaType,
      alt: featureAlt,
      imageClassName: "detail-feature-image",
      videoClassName: "detail-feature-video",
      fallbackType: "image"
    });
    if (mediaNode) {
      target.append(mediaNode);
    }
  };

  const appendTranslationSections = (translation, target) => {
    translation.sections.forEach((section) => {
      const block = document.createElement("section");
      block.className = "detail-section";

      const mediaNode = createDetailMediaNode({
        url: section.image,
        mediaType: section.mediaType,
        alt: section.heading || translation.title,
        imageClassName: "detail-section-image",
        videoClassName: "detail-section-video",
        fallbackType: "image"
      });
      if (mediaNode) {
        block.append(mediaNode);
      }

      const heading = document.createElement("h2");
      heading.textContent = asString(section.heading);
      block.append(heading);

      const body = document.createElement("p");
      body.innerHTML = richText(section.body);
      block.append(body);

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

  const renderNewsDetail = (translation, target, selectedPostId, pageNumber = 1) => {
    const detailText = getLangText(UI_TEXT.detail);
    const postsPerPage = 4;

    appendFeatureImage(translation, target);

    const posts = [...state.content.dynamic.newsPosts].sort(sortByDateDesc);
    if (!posts.length) {
      const empty = document.createElement("p");
      empty.className = "detail-subtitle";
      empty.textContent = detailText.newsEmpty;
      target.append(empty);
      return;
    }

    const totalPages = Math.max(1, Math.ceil(posts.length / postsPerPage));
    const currentPage = Math.min(Math.max(Number(pageNumber) || 1, 1), totalPages);
    const selected = selectedPostId ? posts.find((post) => post.id === selectedPostId) : null;

    if (selected) {
      const selectedTranslation = getPostTranslation(selected);
      const postDetail = document.createElement("article");
      postDetail.className = "post-expanded news-post-detail";
      postDetail.innerHTML = `
        ${
          selected.image
            ? `<img class="news-post-cover" src="${encodeHtml(selected.image)}" alt="${encodeHtml(
                getLocalizedLabel(selected.imageAlt) || selectedTranslation.title
              )}" loading="lazy" />`
            : ""
        }
        <p class="post-card-meta">${encodeHtml(formatDisplayDate(selected.createdAt))}</p>
        <h2 class="post-card-title">${encodeHtml(selectedTranslation.title)}</h2>
        <p class="post-card-excerpt">${richText(selectedTranslation.body)}</p>
      `;
      target.append(postDetail);

      const backLink = document.createElement("a");
      backLink.className = "cta ghost small news-back-link";
      backLink.href = buildDetailUrl("infos", "news", { page: currentPage });
      backLink.textContent = detailText.newsBackToList;
      target.append(backLink);
      return;
    }

    const start = (currentPage - 1) * postsPerPage;
    const pagePosts = posts.slice(start, start + postsPerPage);

    const grid = document.createElement("div");
    grid.className = "news-grid";

    pagePosts.forEach((post) => {
      const postTranslation = getPostTranslation(post);
      const title = postTranslation.title || "Untitled";
      const mediaHtml = post.image
        ? `<img class="news-card-cover" src="${encodeHtml(post.image)}" alt="${encodeHtml(
            getLocalizedLabel(post.imageAlt) || title
          )}" loading="lazy" />`
        : `<div class="news-card-cover news-card-placeholder" aria-hidden="true"></div>`;

      const card = document.createElement("article");
      card.className = "news-card";
      card.innerHTML = `
        <a class="news-card-link" href="${encodeHtml(
          buildDetailUrl("infos", "news", { post: post.id, page: currentPage })
        )}">
          ${mediaHtml}
          <h3 class="news-card-title">${encodeHtml(title)}</h3>
        </a>
      `;
      grid.append(card);
    });

    target.append(grid);

    if (totalPages <= 1) {
      return;
    }

    const pagination = document.createElement("nav");
    pagination.className = "news-pagination";
    pagination.setAttribute("aria-label", "News pagination");

    if (currentPage > 1) {
      const prevLink = document.createElement("a");
      prevLink.className = "news-page-btn";
      prevLink.href = buildDetailUrl("infos", "news", { page: currentPage - 1 });
      prevLink.textContent = detailText.pagePrev;
      pagination.append(prevLink);
    }

    for (let page = 1; page <= totalPages; page += 1) {
      const pageLink = document.createElement("a");
      pageLink.className = "news-page-btn";
      if (page === currentPage) {
        pageLink.classList.add("is-active");
      }
      pageLink.href = buildDetailUrl("infos", "news", { page });
      pageLink.textContent = String(page);
      pagination.append(pageLink);
    }

    if (currentPage < totalPages) {
      const nextLink = document.createElement("a");
      nextLink.className = "news-page-btn";
      nextLink.href = buildDetailUrl("infos", "news", { page: currentPage + 1 });
      nextLink.textContent = detailText.pageNext;
      pagination.append(nextLink);
    }

    target.append(pagination);
  };

  const renderNoticeDetail = (translation, target, selectedPostId, pageNumber = 1) => {
    const detailText = getLangText(UI_TEXT.detail);
    const noticesPerPage = 5;

    appendFeatureImage(translation, target);

    const notices = [...state.content.dynamic.notices].sort(sortByDateDesc);
    if (!notices.length) {
      const empty = document.createElement("p");
      empty.className = "detail-subtitle";
      empty.textContent = detailText.noticeEmpty;
      target.append(empty);
      return;
    }

    const totalPages = Math.max(1, Math.ceil(notices.length / noticesPerPage));
    let currentPage = Math.min(Math.max(Number(pageNumber) || 1, 1), totalPages);

    const selectedIndex = selectedPostId ? notices.findIndex((notice) => notice.id === selectedPostId) : -1;
    const selected = selectedIndex >= 0 ? notices[selectedIndex] : null;

    if (selected) {
      currentPage = Math.floor(selectedIndex / noticesPerPage) + 1;
      const selectedTranslation = getPostTranslation(selected);
      const postDetail = document.createElement("article");
      postDetail.className = "post-expanded notice-post-detail";
      postDetail.innerHTML = `
        ${
          selected.image
            ? `<img class="news-post-cover" src="${encodeHtml(selected.image)}" alt="${encodeHtml(
                getLocalizedLabel(selected.imageAlt) || selectedTranslation.title
              )}" loading="lazy" />`
            : ""
        }
        <p class="post-card-meta">${encodeHtml(formatDisplayDate(selected.createdAt))}</p>
        <h2 class="post-card-title">${encodeHtml(selectedTranslation.title)}</h2>
        <p class="post-card-excerpt">${richText(selectedTranslation.body)}</p>
      `;
      target.append(postDetail);

      const backLink = document.createElement("a");
      backLink.className = "cta ghost small news-back-link";
      backLink.href = buildDetailUrl("infos", "notice", { page: currentPage });
      backLink.textContent = detailText.newsBackToList;
      target.append(backLink);
      return;
    }

    const start = (currentPage - 1) * noticesPerPage;
    const pageNotices = notices.slice(start, start + noticesPerPage);

    const grid = document.createElement("div");
    grid.className = "post-grid";

    pageNotices.forEach((notice) => {
      const postTranslation = getPostTranslation(notice);
      const excerpt = postTranslation.excerpt || truncateText(postTranslation.body);
      const article = document.createElement("article");
      article.className = "post-card notice-card";

      const thumbHtml = notice.image
        ? `<img class="notice-card-thumb" src="${encodeHtml(notice.image)}" alt="${encodeHtml(
            getLocalizedLabel(notice.imageAlt) || postTranslation.title
          )}" loading="lazy" />`
        : `<div class="notice-card-thumb notice-card-thumb-placeholder" aria-hidden="true"></div>`;

      article.innerHTML = `
        <a class="post-card-link" href="${encodeHtml(
          buildDetailUrl("infos", "notice", { post: notice.id, page: currentPage })
        )}">
          ${thumbHtml}
          <div class="post-card-body">
            <p class="post-card-meta">${encodeHtml(formatDisplayDate(notice.createdAt))}</p>
            <h3 class="post-card-title">${encodeHtml(postTranslation.title)}</h3>
            <p class="post-card-excerpt">${encodeHtml(excerpt)}</p>
          </div>
        </a>
      `;

      grid.append(article);
    });

    target.append(grid);

    if (totalPages > 1) {
      const pagination = document.createElement("nav");
      pagination.className = "news-pagination";
      pagination.setAttribute("aria-label", "Notice pagination");

      if (currentPage > 1) {
        const prevLink = document.createElement("a");
        prevLink.className = "news-page-btn";
        prevLink.href = buildDetailUrl("infos", "notice", { page: currentPage - 1 });
        prevLink.textContent = detailText.pagePrev;
        pagination.append(prevLink);
      }

      for (let page = 1; page <= totalPages; page += 1) {
        const pageLink = document.createElement("a");
        pageLink.className = "news-page-btn";
        if (page === currentPage) {
          pageLink.classList.add("is-active");
        }
        pageLink.href = buildDetailUrl("infos", "notice", { page });
        pageLink.textContent = String(page);
        pagination.append(pageLink);
      }

      if (currentPage < totalPages) {
        const nextLink = document.createElement("a");
        nextLink.className = "news-page-btn";
        nextLink.href = buildDetailUrl("infos", "notice", { page: currentPage + 1 });
        nextLink.textContent = detailText.pageNext;
        pagination.append(nextLink);
      }

      target.append(pagination);
    }
  };

  const renderQnaBoard = (target, selectedEntryId, pageNumber = 1, options = {}) => {
    const detailText = getLangText(UI_TEXT.detail);
    const entries = [...state.content.dynamic.inquiries].sort(sortByDateDesc);
    const entriesPerPage = 5;
    const onToggle = options && typeof options.onToggle === "function" ? options.onToggle : null;
    const onPageChange = options && typeof options.onPageChange === "function" ? options.onPageChange : null;

    target.innerHTML = "";

    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "admin-inline-meta";
      empty.textContent = detailText.qnaNoEntries;
      target.append(empty);
      return;
    }

    const totalPages = Math.max(1, Math.ceil(entries.length / entriesPerPage));
    let currentPage = Math.min(Math.max(Number(pageNumber) || 1, 1), totalPages);
    const selectedIndex = selectedEntryId ? entries.findIndex((entry) => entry.id === selectedEntryId) : -1;

    if (selectedIndex >= 0) {
      currentPage = Math.floor(selectedIndex / entriesPerPage) + 1;
    }

    const start = (currentPage - 1) * entriesPerPage;
    const pageEntries = entries.slice(start, start + entriesPerPage);

    const board = document.createElement("div");
    board.className = "post-grid qna-board";

    pageEntries.forEach((entry) => {
      const isExpanded = selectedEntryId === entry.id;
      const answerText = getLocalizedAnswer(entry);
      const hasAnswer = asString(answerText).trim().length > 0;
      const maskedName = maskName(entry.name) || detailText.qnaAnonymous;
      const maskedPhone = maskPhone(entry.phone);
      const maskedEmail = maskEmail(entry.email);
      const contactText = [maskedEmail, maskedPhone].filter(Boolean).join(" · ");
      const statusText = hasAnswer ? detailText.qnaAnswered : detailText.qnaPending;
      const statusClass = hasAnswer ? "is-answered" : "is-pending";

      const article = document.createElement("article");
      article.className = "post-card qna-post-card";
      if (isExpanded) {
        article.classList.add("is-active");
      }

      article.innerHTML = `
        <button class="post-card-link qna-post-link qna-toggle-btn" type="button" data-qna-toggle>
          <div class="post-card-body">
            <div class="qna-meta-row">
              <p class="post-card-meta">${encodeHtml(formatDisplayDate(entry.createdAt))}</p>
              <span class="qna-status-badge ${encodeHtml(statusClass)}">${encodeHtml(statusText)}</span>
            </div>
            <h3 class="post-card-title">${encodeHtml(maskedName)}</h3>
            ${contactText ? `<p class="qna-item-contact">${encodeHtml(contactText)}</p>` : ""}
            <p class="qna-item-question">${encodeHtml(truncateText(entry.question, 180))}</p>
            <span class="post-card-link-text">${encodeHtml(
              isExpanded ? detailText.qnaHideAnswer : detailText.qnaShowAnswer
            )}</span>
          </div>
        </button>
        ${
          isExpanded
            ? `<div class="qna-answer-panel">
                <p class="qna-item-answer"><strong>A.</strong> ${
                  answerText ? richText(answerText) : encodeHtml(detailText.qnaPending)
                }</p>
              </div>`
            : ""
        }
      `;

      const toggleButton = article.querySelector("[data-qna-toggle]");
      if (toggleButton) {
        toggleButton.addEventListener("click", () => {
          const nextEntryId = isExpanded ? null : entry.id;

          if (onToggle) {
            onToggle(nextEntryId, currentPage);
            return;
          }

          const nextUrl = nextEntryId
            ? buildDetailUrl("help", "qna", { post: nextEntryId, page: currentPage })
            : buildDetailUrl("help", "qna", { page: currentPage });
          window.history.replaceState({}, "", nextUrl);
          renderQnaBoard(target, nextEntryId, currentPage);
        });
      }

      board.append(article);
    });

    target.append(board);

    if (totalPages > 1) {
      const pagination = document.createElement("nav");
      pagination.className = "news-pagination";
      pagination.setAttribute("aria-label", "QnA pagination");

      if (currentPage > 1) {
        if (onPageChange) {
          const prevButton = document.createElement("button");
          prevButton.type = "button";
          prevButton.className = "news-page-btn";
          prevButton.textContent = detailText.pagePrev;
          prevButton.addEventListener("click", () => onPageChange(currentPage - 1));
          pagination.append(prevButton);
        } else {
          const prevLink = document.createElement("a");
          prevLink.className = "news-page-btn";
          prevLink.href = buildDetailUrl("help", "qna", { page: currentPage - 1 });
          prevLink.textContent = detailText.pagePrev;
          pagination.append(prevLink);
        }
      }

      for (let page = 1; page <= totalPages; page += 1) {
        if (onPageChange) {
          const pageButton = document.createElement("button");
          pageButton.type = "button";
          pageButton.className = "news-page-btn";
          if (page === currentPage) {
            pageButton.classList.add("is-active");
          }
          pageButton.textContent = String(page);
          if (page !== currentPage) {
            pageButton.addEventListener("click", () => onPageChange(page));
          }
          pagination.append(pageButton);
        } else {
          const pageLink = document.createElement("a");
          pageLink.className = "news-page-btn";
          if (page === currentPage) {
            pageLink.classList.add("is-active");
          }
          pageLink.href = buildDetailUrl("help", "qna", { page });
          pageLink.textContent = String(page);
          pagination.append(pageLink);
        }
      }

      if (currentPage < totalPages) {
        if (onPageChange) {
          const nextButton = document.createElement("button");
          nextButton.type = "button";
          nextButton.className = "news-page-btn";
          nextButton.textContent = detailText.pageNext;
          nextButton.addEventListener("click", () => onPageChange(currentPage + 1));
          pagination.append(nextButton);
        } else {
          const nextLink = document.createElement("a");
          nextLink.className = "news-page-btn";
          nextLink.href = buildDetailUrl("help", "qna", { page: currentPage + 1 });
          nextLink.textContent = detailText.pageNext;
          pagination.append(nextLink);
        }
      }

      target.append(pagination);
    }
  };

  const renderQnaDetail = (translation, target, selectedPostId, pageNumber = 1) => {
    const detailText = getLangText(UI_TEXT.detail);
    let expandedEntryId = asString(selectedPostId).trim() || null;
    let currentPage = Math.max(Number(pageNumber) || 1, 1);

    appendFeatureImage(translation, target);

    const listHeading = document.createElement("h2");
    listHeading.textContent = detailText.qnaListTitle;
    listHeading.className = "post-card-title";

    const listWrap = document.createElement("div");
    listWrap.className = "qna-list";

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
      expandedEntryId = null;
      currentPage = 1;
      window.history.replaceState({}, "", buildDetailUrl("help", "qna", { page: currentPage }));
      renderBoard();
    });

    const syncQnaUrl = () => {
      const params = { page: currentPage };
      if (expandedEntryId) {
        params.post = expandedEntryId;
      }
      window.history.replaceState({}, "", buildDetailUrl("help", "qna", params));
    };

    const renderBoard = () => {
      renderQnaBoard(listWrap, expandedEntryId, currentPage, {
        onToggle: (nextEntryId, resolvedPage) => {
          expandedEntryId = nextEntryId;
          currentPage = resolvedPage;
          syncQnaUrl();
          renderBoard();
        },
        onPageChange: (nextPage) => {
          currentPage = Math.max(Number(nextPage) || 1, 1);
          expandedEntryId = null;
          syncQnaUrl();
          renderBoard();
        }
      });
    };

    target.append(listHeading);
    target.append(listWrap);
    renderBoard();
    target.append(form);
  };

  const renderDetail = () => {
    const pathText = getLangText(UI_TEXT.detail);
    const { menuId, itemId, postId, page } = resolveDetailParams();

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
        renderNewsDetail(translation, sectionsElement, postId, page);
      } else if (menuId === "infos" && itemId === "notice") {
        renderNoticeDetail(translation, sectionsElement, postId, page);
      } else if (menuId === "help" && itemId === "qna") {
        renderQnaDetail(translation, sectionsElement, postId, page);
      } else {
        appendFeatureImage(translation, sectionsElement);
        appendTranslationSections(translation, sectionsElement);
      }
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
    const featureMediaTypeSelect = document.getElementById("admin-feature-media-type");
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
      const saved = saveContent(adminState.content);
      if (!saved) {
        const limitMessage = adminText().statusStorageLimit;
        showStatus(limitMessage);
        showModuleStatus(limitMessage);
        return;
      }
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
        "[data-admin-label-feature-media-type]": text.labelFeatureMediaType,
        "[data-admin-label-feature-image]": text.labelFeatureImage,
        "[data-admin-label-feature-alt]": text.labelFeatureAlt,
        "[data-admin-label-feature-upload]": text.labelFeatureUpload,
        "[data-admin-media-type-image]": text.mediaTypeImage,
        "[data-admin-media-type-video]": text.mediaTypeVideo,
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

      sectionsWrap.querySelectorAll("select[data-section-media-type]").forEach((input) => {
        input.addEventListener("change", () => {
          const translation = ensureTranslation();
          const index = Number(input.dataset.sectionMediaType);
          translation.sections[index].mediaType = normalizeMediaType(input.value, "image");
          syncJsonPreview();
        });
      });

      sectionsWrap.querySelectorAll("input[data-section-image]").forEach((input) => {
        input.addEventListener("input", () => {
          const translation = ensureTranslation();
          const index = Number(input.dataset.sectionImage);
          translation.sections[index].image = input.value;
          translation.sections[index].mediaType = inferMediaTypeFromUrl(
            input.value,
            translation.sections[index].mediaType
          );
          const typeSelect = sectionsWrap.querySelector(
            `select[data-section-media-type="${index}"]`
          );
          if (typeSelect) {
            typeSelect.value = translation.sections[index].mediaType;
          }
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
            translation.sections[index].mediaType = inferMediaTypeFromFile(
              file,
              translation.sections[index].mediaType
            );
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

      if (featureMediaTypeSelect) {
        featureMediaTypeSelect.value = normalizeMediaType(
          translation.featureMediaType,
          inferMediaTypeFromUrl(translation.featureImage, "image")
        );
      }

      if (featureImageInput) {
        featureImageInput.value = translation.featureImage || "";
      }
      if (featureImageAltInput) {
        featureImageAltInput.value = getLocalizedLabel(translation.featureImageAlt);
      }

      sectionsWrap.innerHTML = "";
      translation.sections.forEach((section, index) => {
        const sectionMediaType = normalizeMediaType(
          section.mediaType,
          inferMediaTypeFromUrl(section.image, "image")
        );
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
          <label>${encodeHtml(text.sectionMediaTypeLabel)}</label>
          <select data-section-media-type="${index}">
            <option value="image" ${sectionMediaType === "image" ? "selected" : ""}>${encodeHtml(
              text.mediaTypeImage
            )}</option>
            <option value="video" ${sectionMediaType === "video" ? "selected" : ""}>${encodeHtml(
              text.mediaTypeVideo
            )}</option>
          </select>
          <label>${encodeHtml(text.sectionImageLabel)}</label>
          <input type="url" data-section-image="${index}" value="${encodeHtml(section.image || "")}" />
          <label>${encodeHtml(text.sectionImageUploadLabel)}</label>
          <input type="file" accept="image/*,video/*" data-section-image-file="${index}" />
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
      if (!adminState.content.site.spotlights) {
        adminState.content.site.spotlights = { ko: [], en: [], zh: [] };
      }
      const spotlightCards = Array.isArray(adminState.content.site.spotlights[adminState.editLang])
        ? adminState.content.site.spotlights[adminState.editLang]
        : [];
      while (spotlightCards.length < 3) {
        spotlightCards.push({ title: "", description: "", link: "" });
      }
      adminState.content.site.spotlights[adminState.editLang] = spotlightCards;
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
          <h3 class="post-card-title">${encodeHtml(text.siteSpotlightHeading)}</h3>
          <div class="admin-module-grid two">
            ${[0, 1, 2]
              .map((index) => {
                const card = spotlightCards[index] || { title: "", description: "", link: "" };
                return `
                  <div class="field-group">
                    <label for="admin-site-spotlight-title-${index}">${encodeHtml(
                      `${text.siteSpotlightTitleLabel} ${index + 1}`
                    )}</label>
                    <input id="admin-site-spotlight-title-${index}" type="text" value="${encodeHtml(
                      card.title
                    )}" />
                  </div>
                  <div class="field-group">
                    <label for="admin-site-spotlight-description-${index}">${encodeHtml(
                      `${text.siteSpotlightDescriptionLabel} ${index + 1}`
                    )}</label>
                    <input id="admin-site-spotlight-description-${index}" type="text" value="${encodeHtml(
                      card.description
                    )}" />
                  </div>
                  <div class="field-group">
                    <label for="admin-site-spotlight-link-${index}">${encodeHtml(
                      `${text.siteSpotlightLinkLabel} ${index + 1}`
                    )}</label>
                    <input id="admin-site-spotlight-link-${index}" type="text" value="${encodeHtml(
                      card.link
                    )}" />
                  </div>
                `;
              })
              .join("")}
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
          const spotlightContent = adminState.content.site.spotlights[adminState.editLang];
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

          [0, 1, 2].forEach((index) => {
            const current = spotlightContent[index] || { title: "", description: "", link: "" };
            current.title = asString(
              document.getElementById(`admin-site-spotlight-title-${index}`).value
            ).trim();
            current.description = asString(
              document.getElementById(`admin-site-spotlight-description-${index}`).value
            ).trim();
            current.link = asString(
              document.getElementById(`admin-site-spotlight-link-${index}`).value
            ).trim();
            spotlightContent[index] = current;
          });

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
        translation.featureMediaType = inferMediaTypeFromUrl(
          featureImageInput.value,
          translation.featureMediaType
        );
        if (featureMediaTypeSelect) {
          featureMediaTypeSelect.value = translation.featureMediaType;
        }
        syncJsonPreview();
      });
    }

    if (featureMediaTypeSelect) {
      featureMediaTypeSelect.addEventListener("change", () => {
        const translation = ensureTranslation();
        translation.featureMediaType = normalizeMediaType(
          featureMediaTypeSelect.value,
          inferMediaTypeFromUrl(translation.featureImage, "image")
        );
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
          translation.featureMediaType = inferMediaTypeFromFile(
            file,
            translation.featureMediaType
          );
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
          image: "",
          mediaType: "image"
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
    ensureSeededNewsPostsOnce();
    ensureSeededNoticesOnce();
    ensureSeededInquiriesOnce();
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
