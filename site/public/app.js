const DATA_URL = './data/documents.json';
const DEADLINE_SOON_DAYS = 7;
const BADGE_TEXT = {
  'due-soon': '即將截止',
  active: '截止未到',
  expired: '已截止',
  'no-deadline': '無截止日',
};

const DEFAULT_STATUS_VALUES = ['due-soon', 'active'];

const state = {
  documents: [],
  filtered: [],
  filters: {
    search: '',
    sort: 'deadline-asc',
    statuses: new Set(DEFAULT_STATUS_VALUES),
  },
};

bootstrapLayout();

const elements = {
  status: document.getElementById('status'),
  documentList: document.getElementById('documentList'),
  searchInput: document.getElementById('search'),
  sortSelect: document.getElementById('sortSelect'),
  clearFilters: document.getElementById('clearFilters'),
  updatedAt: document.getElementById('updatedAt'),
};

const statusCheckboxes = Array.from(
  document.querySelectorAll('input[name="statusFilter"]'),
);

function syncStatusCheckboxes() {
  statusCheckboxes.forEach((checkbox) => {
    checkbox.checked = state.filters.statuses.has(checkbox.value);
  });
}

function resetStatusFilters() {
  state.filters.statuses = new Set(DEFAULT_STATUS_VALUES);
  syncStatusCheckboxes();
}

statusCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener('change', () => {
    const { value, checked } = checkbox;

    if (checked) {
      state.filters.statuses.add(value);
    } else {
      state.filters.statuses.delete(value);
      if (state.filters.statuses.size === 0) {
        state.filters.statuses.add(value);
        checkbox.checked = true;
        return;
      }
    }

    render();
  });
});

syncStatusCheckboxes();

elements.searchInput.addEventListener('input', (event) => {
  state.filters.search = event.target.value.trim();
  render();
});

elements.searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    if (elements.searchInput.value) {
      elements.searchInput.value = '';
      state.filters.search = '';
      render();
    }
  }
});


elements.sortSelect.addEventListener('change', (event) => {
  state.filters.sort = event.target.value;
  render();
});

elements.clearFilters.addEventListener('click', () => {
  const hasSearch = Boolean(state.filters.search);
  const hasSort = state.filters.sort !== 'deadline-asc';
  const hasStatusChange =
    state.filters.statuses.size !== DEFAULT_STATUS_VALUES.length ||
    DEFAULT_STATUS_VALUES.some((value) => !state.filters.statuses.has(value));

  if (!hasSearch && !hasSort && !hasStatusChange) {
    return;
  }

  state.filters.search = '';
  state.filters.sort = 'deadline-asc';
  resetStatusFilters();

  elements.searchInput.value = '';
  elements.sortSelect.value = 'deadline-asc';

  render();
});

loadDocuments();

function bootstrapLayout() {
  document.title = '高雄建築師公會公告快覽';
  const template = document.createElement('template');
  template.innerHTML = `
    <div class="top-bar shell">
      <div class="top-bar__search">
        <label class="sr-only" for="search">搜尋主旨或附件</label>
        <input
          id="search"
          type="search"
          placeholder="搜尋主旨或附件"
          autocomplete="off"
        />
      </div>
    </div>

    <header class="hero">
      <div class="shell hero__inner">
        <div class="hero__lede">
          <p class="hero__eyebrow"><span class="hero__eyebrow-abbr">KAA</span> 高雄建築師公會</p>
          <h1 class="hero__title">最新公告快訊</h1>
          <p class="hero__description">
            掌握高雄建築師公會最新公告，手機與平板皆可輕鬆瀏覽。
          </p>
          <div class="hero__actions">
            <a
              class="hero__link"
              href="https://www.kaa.org.tw/public_list_1.php?t=0&amp;search_input1=&amp;search_input2=&amp;search_input3=&amp;b=1"
              target="_blank"
              rel="noopener noreferrer"
            >
              前往公會網站
            </a>
          </div>
        </div>
      </div>
    </header>

    <main class="shell flow">
      <section class="controls" aria-label="篩選與排序">
        <fieldset class="status-group">
          <legend class="field-label">顯示截止狀態</legend>
          <label class="status-option">
            <input type="checkbox" name="statusFilter" value="due-soon" checked />
            <span>即將截止</span>
          </label>
          <label class="status-option">
            <input type="checkbox" name="statusFilter" value="active" checked />
            <span>截止未到</span>
          </label>
          <label class="status-option">
            <input type="checkbox" name="statusFilter" value="expired" />
            <span>已截止</span>
          </label>
        </fieldset>

        <div class="field-group">
          <label class="field-label" for="sortSelect">排序方式</label>
          <select id="sortSelect">
            <option value="deadline-asc">截止日期最接近</option>
            <option value="deadline-desc">截止日期最晚</option>
            <option value="date-desc">最新公告在前</option>
            <option value="date-asc">最早公告在前</option>
          </select>
        </div>

        <button id="clearFilters" type="button">重設條件</button>
      </section>

      <section aria-live="polite">
        <div id="status" class="status">資料載入中...</div>
        <div id="documentList" class="document-grid" hidden></div>
      </section>
    </main>

    <footer class="app-footer">
      <div class="shell footer-inner">
        <p class="footer-copy">
          資料來源：
          <a
            href="https://www.kaa.org.tw/"
            target="_blank"
            rel="noopener noreferrer"
          >高雄建築師公會</a>
          ｜GitHub Pages 自動佈署。
        </p>
        <p id="updatedAt" class="footer-updated" aria-live="polite">資料更新：尚未更新</p>
      </div>
    </footer>

    <script type="module" src="./app.js"></script>
  `;
  document.body.replaceChildren(template.content.cloneNode(true));
}

function formatUpdatedAt(isoString) {
  if (!isoString) return '資料更新：尚未更新';

  const formatter = new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Taipei',
  });

  try {
    return `資料更新：${formatter.format(new Date(isoString))}`;
  } catch {
    return `資料更新：${isoString}`;
  }
}


function parseDate(value) {
  if (!value) return null;

  const normalized = value.trim().replace(/\//g, '-');
  const isoCandidate =
    normalized.length === 10
      ? `${normalized}T00:00:00+08:00`
      : normalized;

  const parsed = new Date(isoCandidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const taipeiDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function getTaipeiToday() {
  const formatted = taipeiDateFormatter.format(Date.now());
  return parseDate(formatted);
}

function enrichDocument(doc) {
  const issuedDate = parseDate(doc.date);
  const deadlineDate = parseDate(doc.deadline);
  const today = getTaipeiToday();

  let deadlineCategory = 'no-deadline';
  let daysUntilDeadline = null;

  if (deadlineDate && today) {
    const diffDays = Math.floor(
      (deadlineDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
    );
    daysUntilDeadline = diffDays;

    if (diffDays < 0) {
      deadlineCategory = 'expired';
    } else if (diffDays <= DEADLINE_SOON_DAYS) {
      deadlineCategory = 'due-soon';
    } else {
      deadlineCategory = 'active';
    }
  }

  return {
    ...doc,
    issuedDate,
    deadlineDate,
    deadlineCategory,
    daysUntilDeadline,
  };
}

function formatDeadlineNote(doc) {
  if (doc.daysUntilDeadline == null) {
    return '無截止日';
  }

  if (doc.daysUntilDeadline < 0) {
    return `逾期 ${Math.abs(doc.daysUntilDeadline)} 天`;
  }

  if (doc.daysUntilDeadline === 0) {
    return '今天截止';
  }

  return `剩餘 ${doc.daysUntilDeadline} 天`;
}

function sortDocuments(documents) {
  const sorted = [...documents];

  const compareDate = (a, b, key, direction = 'desc') => {
    const aDate = a[key];
    const bDate = b[key];

    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;

    const diff = aDate.getTime() - bDate.getTime();
    return direction === 'asc' ? diff : -diff;
  };

  switch (state.filters.sort) {
    case 'deadline-asc':
      sorted.sort((a, b) => {
        if (!a.deadlineDate && !b.deadlineDate) {
          return compareDate(a, b, 'issuedDate', 'desc');
        }
        if (!a.deadlineDate) return 1;
        if (!b.deadlineDate) return -1;
        const diff = a.deadlineDate.getTime() - b.deadlineDate.getTime();
        return diff === 0
          ? compareDate(a, b, 'issuedDate', 'desc')
          : diff;
      });
      break;
    case 'deadline-desc':
      sorted.sort((a, b) => {
        if (!a.deadlineDate && !b.deadlineDate) {
          return compareDate(a, b, 'issuedDate', 'desc');
        }
        if (!a.deadlineDate) return 1;
        if (!b.deadlineDate) return -1;
        const diff = b.deadlineDate.getTime() - a.deadlineDate.getTime();
        return diff === 0
          ? compareDate(a, b, 'issuedDate', 'desc')
          : diff;
      });
      break;
    case 'date-asc':
      sorted.sort((a, b) => compareDate(a, b, 'issuedDate', 'asc'));
      break;
    case 'date-desc':
    default:
      sorted.sort((a, b) => compareDate(a, b, 'issuedDate', 'desc'));
      break;
  }

  return sorted;
}

function applyFilters() {
  const query = state.filters.search.toLowerCase();

  let results = state.documents;

  if (query) {
    results = results.filter((doc) => {
      const subject = doc.subject?.toLowerCase() ?? '';
      const url = doc.subjectUrl?.toLowerCase() ?? '';
      const attachments = (doc.attachments || [])
        .map(
          (attachment) =>
            `${attachment.label ?? ''} ${(attachment.url ?? '').toLowerCase()}`,
        )
        .join(' ');

      return (
        subject.includes(query) ||
        url.includes(query) ||
        attachments.includes(query) ||
        (doc.date ?? '').includes(query) ||
        (doc.deadline ?? '').includes(query)
      );
    });
  }

  if (state.filters.statuses.size) {
    results = results.filter((doc) =>
      state.filters.statuses.has(doc.deadlineCategory ?? 'no-deadline'),
    );
  }

  return sortDocuments(results);
}

function updateStatus(filtered, total) {
  elements.status.classList.remove('status--error');

  if (total === 0) {
    elements.status.textContent = '目前尚未取得公告，請稍候重試。';
    return;
  }

  if (filtered === 0) {
    elements.status.textContent = '沒有符合篩選條件的公告。';
    return;
  }

  elements.status.textContent = `共 ${filtered} 筆公告`;
}

function setDocumentListVisibility(hasResults) {
  elements.documentList.hidden = !hasResults;
}

function createMetaItem(label, content) {
  const wrapper = document.createElement('div');
  wrapper.className = 'meta-item';

  const dt = document.createElement('dt');
  dt.textContent = label;

  const dd = document.createElement('dd');
  if (typeof content === 'string') {
    dd.textContent = content;
  } else if (content instanceof Node) {
    dd.appendChild(content);
  }

  wrapper.append(dt, dd);
  return wrapper;
}

function createAttachmentList(doc) {
  if (!doc.attachments?.length) {
    const empty = document.createElement('span');
    empty.className = 'attachment-empty';
    empty.textContent = '無附件';
    return empty;
  }

  const list = document.createElement('div');
  list.className = 'attachment-list';

  doc.attachments?.forEach((attachment, index) => {
    const link = document.createElement('a');
    link.className = 'attachment-link';
    link.href = attachment.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent =
      attachment.label?.trim() || `附件 ${String(index + 1).padStart(2, '0')}`;
    list.appendChild(link);
  });

  return list;
}

function createDocumentCard(doc) {
  const card = document.createElement('article');
  card.className = `document-card document-card--${doc.deadlineCategory}`;

  const header = document.createElement('header');
  header.className = 'document-card__header';

  const badge = document.createElement('span');
  badge.className = `badge badge--${doc.deadlineCategory}`;
  badge.textContent = BADGE_TEXT[doc.deadlineCategory] ?? '狀態不明';
  header.appendChild(badge);

  if (doc.date) {
    const issued = document.createElement('span');
    issued.className = 'document-card__issued';

    const issuedLabel = document.createElement('span');
    issuedLabel.className = 'document-card__label';
    issuedLabel.textContent = '行文日期';

    const issuedTime = document.createElement('time');
    issuedTime.dateTime = doc.date;
    issuedTime.textContent = doc.date;

    issued.append(issuedLabel, issuedTime);
    header.appendChild(issued);
  }

  const title = document.createElement('h2');
  title.className = 'document-card__title';
  const subjectText = doc.subject?.trim() || '未提供主旨';

  if (doc.subjectUrl) {
    const link = document.createElement('a');
    link.href = doc.subjectUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = subjectText;
    title.appendChild(link);
  } else {
    title.textContent = subjectText;
  }

  const metaList = document.createElement('dl');
  metaList.className = 'document-card__meta';

  const deadlineContent = document.createElement('div');
  if (doc.deadline) {
    const deadlineTime = document.createElement('time');
    deadlineTime.dateTime = doc.deadline;
    deadlineTime.textContent = doc.deadline;

    const deadlineNote = document.createElement('span');
    deadlineNote.className = 'deadline-note';
    deadlineNote.textContent = formatDeadlineNote(doc);

    deadlineContent.className = 'deadline-wrapper';
    deadlineContent.append(deadlineTime, deadlineNote);
  } else {
    deadlineContent.className = 'deadline-wrapper';
    const deadlineNote = document.createElement('span');
    deadlineNote.className = 'deadline-note';
    deadlineNote.textContent = '無截止日';
    deadlineContent.append(deadlineNote);
  }

  metaList.append(
    createMetaItem('截止日期', deadlineContent),
    createMetaItem('附件', createAttachmentList(doc)),
  );

  card.append(header, title, metaList);
  return card;
}

function renderDocuments(documents) {
  elements.documentList.replaceChildren(
    ...documents.map((doc) => createDocumentCard(doc)),
  );
}

function render() {
  state.filtered = applyFilters();
  updateStatus(state.filtered.length, state.documents.length);
  setDocumentListVisibility(state.filtered.length > 0);

  if (state.filtered.length) {
    renderDocuments(state.filtered);
  }
}

async function loadDocuments() {
  try {
    const response = await fetch(DATA_URL, { cache: 'no-cache' });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const documents = payload.documents ?? [];

    state.documents = documents.map(enrichDocument);
    render();

    if (payload.updatedAt) {
      elements.updatedAt.textContent = formatUpdatedAt(payload.updatedAt);
    }

    setDocumentListVisibility(state.filtered.length > 0);
  } catch (error) {
    console.error('Unable to load documents', error);
    elements.status.textContent = '資料載入失敗，請檢查網路或稍後再試。';
    elements.status.classList.add('status--error');
  }
}
