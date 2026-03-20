(() => {
  "use strict";

  const STORAGE_KEYS = {
    theme: "heptalabs_theme",
    lang: "heptalabs_lang",
    content: "heptalabs_content_v1"
  };

  const SUPPORTED_LANGS = ["ko", "en", "zh"];
  const SUPPORTED_THEMES = ["day", "night"];

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
    detail: {
      ko: {
        menuCaption: "Menu",
        pathPrefix: "현재 위치",
        contactCta: "문의하기"
      },
      en: {
        menuCaption: "Menu",
        pathPrefix: "Path",
        contactCta: "Contact Us"
      },
      zh: {
        menuCaption: "菜单",
        pathPrefix: "当前位置",
        contactCta: "联系我们"
      }
    },
    admin: {
      ko: {
        title: "Hepta Labs Content Admin",
        subtitle:
          "로컬 CMS로 메뉴별 다국어 콘텐츠를 편집하고 즉시 반영할 수 있습니다.",
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
        sectionsHeading: "섹션",
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
        confirmResetAll: "전체 콘텐츠를 기본값으로 되돌릴까요?"
      },
      en: {
        title: "Hepta Labs Content Admin",
        subtitle:
          "Edit multilingual menu content with a local CMS and apply changes instantly.",
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
        sectionsHeading: "Sections",
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
        confirmResetAll: "Reset all content to defaults?"
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
        sectionsHeading: "内容段落",
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
        confirmResetAll: "确定将全部内容重置为默认值吗？"
      }
    }
  };

  const defaults = window.HeptaContentDefaults;
  if (!defaults || !Array.isArray(defaults.menus)) {
    return;
  }

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

  const deepClone = (value) => JSON.parse(JSON.stringify(value));

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

  const getContent = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.content);
      if (!raw) {
        return deepClone(defaults);
      }
      const parsed = JSON.parse(raw);
      if (!isValidContent(parsed)) {
        return deepClone(defaults);
      }
      return parsed;
    } catch (error) {
      return deepClone(defaults);
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

  const setTheme = (theme) => {
    state.theme = SUPPORTED_THEMES.includes(theme) ? theme : "day";
    document.documentElement.setAttribute("data-theme", state.theme);
    localStorage.setItem(STORAGE_KEYS.theme, state.theme);

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.textContent = state.theme === "night" ? "☼" : "◐";
      button.setAttribute("aria-label", state.theme === "night" ? "Switch to day mode" : "Switch to night mode");
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
    state.content = content;
    localStorage.setItem(STORAGE_KEYS.content, JSON.stringify(content));
  };

  const getMenu = (menuId) => state.content.menus.find((menu) => menu.id === menuId);

  const getItem = (menuId, itemId) => {
    const menu = getMenu(menuId);
    if (!menu) {
      return null;
    }
    return menu.items.find((item) => item.id === itemId) || null;
  };

  const firstMenu = state.content.menus[0];
  const buildDetailUrl = (menuId, itemId) => `./detail.html?menu=${encodeURIComponent(menuId)}&item=${encodeURIComponent(itemId)}`;

  const encodeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const richText = (value) => encodeHtml(value).replaceAll("\n", "<br />");

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

    document.querySelectorAll("[data-primary-nav]").forEach((nav) => {
      nav.innerHTML = "";

      state.content.menus.forEach((menu) => {
        const anchor = document.createElement("a");
        anchor.href = buildDetailUrl(menu.id, menu.items[0].id);
        anchor.textContent = navText[menu.id] || menu.labels[state.lang] || menu.labels.en;
        if (activeMenu && activeMenu === menu.id) {
          anchor.classList.add("is-active");
        }
        nav.append(anchor);
      });
    });
  };

  const renderFooter = () => {
    const footerText = state.content.site.footer[state.lang] || state.content.site.footer.en;

    document.querySelectorAll("[data-footer-copyright]").forEach((element) => {
      element.textContent = footerText.copyright;
    });

    document.querySelectorAll("[data-footer-community]").forEach((element) => {
      element.textContent = footerText.community;
    });

    document.querySelectorAll("[data-footer-columns]").forEach((container) => {
      container.innerHTML = "";

      state.content.menus.forEach((menu) => {
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

    const cards = document.querySelector("[data-home-cards]");
    if (!cards) {
      return;
    }

    const cardTitles = getLangText(UI_TEXT.homeCards);
    const businessMenu = getMenu("business");
    const aboutMenu = getMenu("about");
    const infoMenu = getMenu("infos");

    const cardData = [
      {
        title: cardTitles[0],
        description: businessMenu.items
          .slice(0, 3)
          .map((item) => item.labels[state.lang] || item.labels.en)
          .join(" · "),
        link: buildDetailUrl("business", "mining")
      },
      {
        title: cardTitles[1],
        description: ["Infrastructure", "Exchange SaaS", "AI Trading", "Custom Development"].join(" · "),
        link: buildDetailUrl("business", "development")
      },
      {
        title: cardTitles[2],
        description: (aboutMenu.items[1].labels[state.lang] || aboutMenu.items[1].labels.en) +
          " · " +
          (infoMenu.items[0].labels[state.lang] || infoMenu.items[0].labels.en),
        link: buildDetailUrl("about", "vision")
      }
    ];

    cards.innerHTML = "";
    cardData.forEach((card) => {
      const article = document.createElement("article");
      article.className = "spotlight-card";
      article.innerHTML = `<h2>${encodeHtml(card.title)}</h2><p>${encodeHtml(card.description)}</p><a href="${encodeHtml(
        card.link
      )}">Explore</a>`;
      cards.append(article);
    });
  };

  const resolveDetailParams = () => {
    const params = new URLSearchParams(window.location.search);
    let menuId = params.get("menu");
    let itemId = params.get("item");

    if (!menuId || !getMenu(menuId)) {
      menuId = firstMenu.id;
    }

    const selectedMenu = getMenu(menuId);
    if (!itemId || !getItem(menuId, itemId)) {
      itemId = selectedMenu.items[0].id;
    }

    return { menuId, itemId };
  };

  const renderDetail = () => {
    const pathText = getLangText(UI_TEXT.detail);
    const { menuId, itemId } = resolveDetailParams();
    const menu = getMenu(menuId);
    const item = getItem(menuId, itemId);
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
      translation.sections.forEach((section) => {
        const block = document.createElement("section");
        block.className = "detail-section";
        block.innerHTML = `<h2>${encodeHtml(section.heading)}</h2><p>${richText(section.body)}</p>`;
        sectionsElement.append(block);
      });
    }

    if (ctaElement) {
      ctaElement.textContent = pathText.contactCta;
    }
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
    const page = document.body.dataset.page;
    if (page !== "admin") {
      return;
    }

    const adminState = {
      content: deepClone(state.content),
      menuId: state.content.menus[0].id,
      itemId: state.content.menus[0].items[0].id,
      editLang: state.lang
    };

    const menuSelect = document.getElementById("admin-menu");
    const itemSelect = document.getElementById("admin-item");
    const titleInput = document.getElementById("admin-title-input");
    const subtitleInput = document.getElementById("admin-subtitle-input");
    const sectionsWrap = document.getElementById("admin-sections");
    const statusElement = document.getElementById("admin-status");
    const jsonElement = document.getElementById("admin-json");
    const previewLink = document.getElementById("admin-preview");

    const adminText = () => getLangText(UI_TEXT.admin);

    const showStatus = (message) => {
      if (statusElement) {
        statusElement.textContent = message;
      }
    };

    const getCurrentMenu = () => adminState.content.menus.find((menu) => menu.id === adminState.menuId);
    const getCurrentItem = () => getCurrentMenu().items.find((item) => item.id === adminState.itemId);

    const ensureTranslation = () => {
      const item = getCurrentItem();
      if (!item.translations[adminState.editLang]) {
        item.translations[adminState.editLang] = {
          title: "",
          subtitle: "",
          sections: []
        };
      }
      if (!Array.isArray(item.translations[adminState.editLang].sections)) {
        item.translations[adminState.editLang].sections = [];
      }
      return item.translations[adminState.editLang];
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
        "[data-admin-sections-heading]": text.sectionsHeading,
        "[data-admin-add-section]": text.addSection,
        "[data-admin-save]": text.save,
        "[data-admin-reset-item]": text.resetItem,
        "[data-admin-reset-all]": text.resetAll,
        "[data-admin-export]": text.export,
        "[data-admin-import]": text.import,
        "[data-admin-json-heading]": text.jsonHeading
      };

      Object.entries(map).forEach(([selector, value]) => {
        document.querySelectorAll(selector).forEach((node) => {
          node.textContent = value;
        });
      });
    };

    const renderMenuSelect = () => {
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
      previewLink.href = buildDetailUrl(adminState.menuId, adminState.itemId);
    };

    const syncJsonPreview = () => {
      const translation = ensureTranslation();
      jsonElement.textContent = JSON.stringify(translation, null, 2);
    };

    const updateSectionHandlers = () => {
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
    };

    const renderEditor = () => {
      const translation = ensureTranslation();
      titleInput.value = translation.title;
      subtitleInput.value = translation.subtitle;

      sectionsWrap.innerHTML = "";
      translation.sections.forEach((section, index) => {
        const sectionCard = document.createElement("article");
        sectionCard.className = "section-editor";
        sectionCard.innerHTML = `
          <div class="section-editor-head">
            <strong>Section ${index + 1}</strong>
            <button type="button" class="icon-btn mini" data-remove-section="${index}">×</button>
          </div>
          <label>Heading</label>
          <input type="text" data-section-heading="${index}" value="${encodeHtml(section.heading)}" />
          <label>Body</label>
          <textarea rows="4" data-section-body="${index}">${encodeHtml(section.body)}</textarea>
        `;
        sectionsWrap.append(sectionCard);
      });

      renderLangTabs();
      renderPreviewLink();
      syncJsonPreview();
      updateSectionHandlers();
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

    document.getElementById("admin-add-section").addEventListener("click", () => {
      const translation = ensureTranslation();
      translation.sections.push({ heading: "", body: "" });
      renderEditor();
    });

    document.querySelectorAll("[data-admin-lang]").forEach((button) => {
      button.addEventListener("click", () => {
        adminState.editLang = button.dataset.adminLang;
        renderEditor();
      });
    });

    menuSelect.addEventListener("change", () => {
      adminState.menuId = menuSelect.value;
      adminState.itemId = getCurrentMenu().items[0].id;
      renderItemSelect();
      renderEditor();
    });

    itemSelect.addEventListener("change", () => {
      adminState.itemId = itemSelect.value;
      renderEditor();
    });

    document.getElementById("admin-save").addEventListener("click", () => {
      saveContent(adminState.content);
      showStatus(adminText().statusSaved);
      document.dispatchEvent(new CustomEvent("hepta:contentchange"));
    });

    document.getElementById("admin-reset-item").addEventListener("click", () => {
      const currentItem = getCurrentItem();
      const defaultMenu = defaults.menus.find((menu) => menu.id === adminState.menuId);
      const defaultItem = defaultMenu
        ? defaultMenu.items.find((item) => item.id === adminState.itemId) || null
        : null;

      if (!defaultItem) {
        return;
      }

      currentItem.translations[adminState.editLang] = deepClone(defaultItem.translations[adminState.editLang]);
      renderEditor();
      showStatus(adminText().statusResetItem);
    });

    document.getElementById("admin-reset-all").addEventListener("click", () => {
      if (!window.confirm(adminText().confirmResetAll)) {
        return;
      }

      adminState.content = deepClone(defaults);
      adminState.menuId = adminState.content.menus[0].id;
      adminState.itemId = adminState.content.menus[0].items[0].id;
      adminState.editLang = state.lang;

      saveContent(adminState.content);
      renderMenuSelect();
      renderItemSelect();
      renderEditor();
      showStatus(adminText().statusResetAll);
      document.dispatchEvent(new CustomEvent("hepta:contentchange"));
    });

    document.getElementById("admin-export").addEventListener("click", () => {
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

    document.getElementById("admin-import").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!isValidContent(parsed)) {
          throw new Error("invalid");
        }

        adminState.content = parsed;
        adminState.menuId = parsed.menus[0].id;
        adminState.itemId = parsed.menus[0].items[0].id;
        adminState.editLang = state.lang;

        saveContent(adminState.content);
        renderMenuSelect();
        renderItemSelect();
        renderEditor();
        showStatus(adminText().statusImportOk);
        document.dispatchEvent(new CustomEvent("hepta:contentchange"));
      } catch (error) {
        showStatus(adminText().statusImportFail);
      }

      event.target.value = "";
    });

    document.addEventListener("hepta:langchange", () => {
      adminState.editLang = state.lang;
      renderAdminLabels();
      renderMenuSelect();
      renderItemSelect();
      renderEditor();
    });

    renderAdminLabels();
    renderMenuSelect();
    renderItemSelect();
    renderEditor();
  };

  const rerenderPage = () => {
    renderPrimaryNav();
    renderFooter();

    const page = document.body.dataset.page;
    if (page === "home") {
      renderHome();
    }
    if (page === "detail") {
      renderDetail();
    }
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
