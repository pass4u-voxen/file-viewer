// 파일 뷰어: 드롭한 파일의 실제 형식을 바이트로 판별해 알맞은 뷰어로 연다. 파일은 브라우저 밖으로 나가지 않는다.
const CDN = {
  xlsx: 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs',
  cpexcel: 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/cpexcel.full.mjs',
  pdf: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs',
  pdfWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs',
  jszip: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  docx: 'https://cdn.jsdelivr.net/npm/docx-preview@0.3.5/dist/docx-preview.min.js',
  chart: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  pptx: 'https://cdn.jsdelivr.net/npm/pptxviewjs@1.1.9/dist/PptxViewJS.min.js',
  heic: 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js',
  utif: 'https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js',
  rhwp: 'https://cdn.jsdelivr.net/npm/@rhwp/core@0.8.7/rhwp.js',
  rhwpWasm: 'https://cdn.jsdelivr.net/npm/@rhwp/core@0.8.7/rhwp_bg.wasm',
};
const CAFE = 'https://cafe.naver.com/comfixnow';
const ASK = 'https://cafe.naver.com/f-e/cafes/31647359/menus/9'; // 'PC 고장 질문' 게시판
// 형식별로 이어 읽을 카페 글 (가입 없이 읽기 가능한 연재 게시판 '오피스·문서 파일 기초')
const ART = (n) => `${CAFE}/${n}`;
const GUIDE = {
  xlsx: [ART(27), '엑셀이 없어도 파일 여는 법, 무료로 고치는 법'],
  xls: [ART(27), '엑셀이 없어도 파일 여는 법, 무료로 고치는 법'],
  ods: [ART(27), '엑셀이 없어도 파일 여는 법, 무료로 고치는 법'],
  csv: [ART(27), '엑셀이 없어도 파일 여는 법, 무료로 고치는 법'],
  numbers: [ART(27), '엑셀이 없어도 파일 여는 법, 무료로 고치는 법'],
  docx: [ART(27), '워드가 없어도 파일 여는 법, 무료로 고치는 법'],
  pptx: [ART(27), '파워포인트가 없어도 파일 여는 법'],
  hwp: [ART(30), '한글 파일을 무료로 열고 고치는 법'],
  hwpx: [ART(30), '한글 파일을 무료로 열고 고치는 법'],
  pdf: [ART(32), 'PDF가 안 열릴 때 확인할 것 (비밀번호·손상된 파일)'],
  exe: [ART(28), '파일 이름 끝의 확장자 보는 법 (가짜 파일 구별하기)'],
};
import { isMember, tryPassword } from './member.js';
import { track } from './count.js';
const NativeFileReader = window.FileReader; // PptxViewJS가 전역 FileReader를 덮어써서 원래 것을 보관

const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  for (const k of kids) if (k != null) e.append(k);
  return e;
};

const scripts = {};
const loadScript = (src) => scripts[src] ??= new Promise((ok, no) => {
  const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('라이브러리를 불러오지 못했어요: ' + src)); document.head.append(s);
});

// ---------- 카페 회원 확인 (수정 기능) ----------
if (isMember()) document.querySelector('.top').append(el('p', { class: 'member ok' }, '✏️ 카페 회원 — PDF를 열면 "수정하기"를 쓸 수 있어요.'));

// ---------- 입력 ----------
const drop = $('#drop'), pick = $('#pick');
pick.addEventListener('change', () => pick.files[0] && openFile(pick.files[0]));
['dragenter', 'dragover'].forEach((t) => document.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((t) => document.addEventListener(t, (e) => { e.preventDefault(); if (t === 'drop' || e.target === drop) drop.classList.remove('over'); }));
document.addEventListener('drop', (e) => { const f = e.dataTransfer?.files?.[0]; if (f) openFile(f); });

// ---------- 형식 판별 ----------
const extOf = (name) => (name.match(/\.([^.]+)$/)?.[1] || '').toLowerCase();
const LABEL = { xlsx: '엑셀', xls: '엑셀(옛 형식)', csv: 'CSV 표', ods: '오픈오피스 표', numbers: '넘버스 표', pdf: 'PDF', docx: '워드', pptx: '파워포인트', hwp: '한글', hwpx: '한글(hwpx)', image: '사진', heic: '아이폰 사진(HEIC)', tiff: 'TIFF 사진', text: '글자 파일', audio: '소리', video: '영상', zip: '압축 파일', exe: '실행 프로그램', doc: '옛 워드(.doc)', ppt: '옛 파워포인트(.ppt)', unknown: '알 수 없는 형식' };
const EXT_GROUP = {
  xlsx: ['xlsx', 'xlsm', 'xlsb', 'xltx', 'xltm'], xls: ['xls', 'xlt'], csv: ['csv', 'tsv'], ods: ['ods', 'fods'], numbers: ['numbers'], pdf: ['pdf'],
  docx: ['docx', 'docm', 'dotx'], pptx: ['pptx', 'ppsx', 'potx'], hwp: ['hwp'], hwpx: ['hwpx'], heic: ['heic', 'heif'], tiff: ['tif', 'tiff'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif'], text: ['txt', 'md', 'json', 'xml', 'log', 'ini', 'html', 'htm'],
  audio: ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac'], video: ['mp4', 'webm', 'mov', 'm4v'], zip: ['zip'], exe: ['exe', 'msi', 'bat', 'cmd', 'scr', 'com', 'apk', 'dmg', 'js', 'vbs', 'jar'],
  doc: ['doc', 'dot'], ppt: ['ppt', 'pps', 'pot'],
};
const groupOfExt = (ext) => Object.keys(EXT_GROUP).find((g) => EXT_GROUP[g].includes(ext)) || 'unknown';
const startsWith = (b, arr, off = 0) => arr.every((v, i) => b[off + i] === v);
const ascii = (b, from, to) => String.fromCharCode(...b.slice(from, to));

async function detect(file, buf) {
  const b = new Uint8Array(buf.slice(0, 64));
  const ext = extOf(file.name);
  if (ascii(b, 0, 5) === '%PDF-') return 'pdf';
  if (startsWith(b, [0x4d, 0x5a])) return 'exe';
  if (startsWith(b, [0x7f, 0x45, 0x4c, 0x46])) return 'exe';
  if (ascii(b, 4, 8) === 'ftyp') {
    const brand = ascii(b, 8, 12);
    if (/hei|hev|mif1|msf1/.test(brand)) return 'heic';
    if (/avif/.test(brand)) return 'image';
    if (/M4A /.test(brand)) return 'audio';
    return 'video';
  }
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47]) || startsWith(b, [0xff, 0xd8, 0xff]) || ascii(b, 0, 4) === 'GIF8' || (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') || ascii(b, 0, 2) === 'BM') return 'image';
  if (ascii(b, 0, 4) === 'II*\0' || ascii(b, 0, 4) === 'MM\0*') return 'tiff';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WAVE') return 'audio';
  if (ascii(b, 0, 3) === 'ID3' || startsWith(b, [0xff, 0xfb]) || ascii(b, 0, 4) === 'fLaC' || ascii(b, 0, 4) === 'OggS') return 'audio';
  if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return 'video';
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04])) return detectZip(buf, ext);
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0])) {
    const g = groupOfExt(ext);
    return ['xls', 'hwp', 'doc', 'ppt'].includes(g) ? g : 'ole';
  }
  const g = groupOfExt(ext);
  if (['csv', 'text', 'image', 'audio', 'video', 'xlsx', 'ods'].includes(g)) return g; // svg, fods, 오래된 xml 엑셀 등
  if (looksLikeText(new Uint8Array(buf.slice(0, 4096)))) return 'text';
  return g === 'exe' ? 'exe' : 'unknown';
}

async function detectZip(buf, ext) {
  await loadScript(CDN.jszip);
  let zip;
  try { zip = await JSZip.loadAsync(buf); } catch { return 'zip'; }
  const mt = zip.file('mimetype') ? (await zip.file('mimetype').async('string')).trim() : '';
  if (/hwp\+zip/.test(mt) || zip.file('Contents/content.hpf')) return 'hwpx';
  if (/opendocument\.spreadsheet/.test(mt)) return 'ods';
  if (zip.file('AndroidManifest.xml')) return 'exe';
  if (zip.file('Index/Document.iwa') || ext === 'numbers') return 'numbers';
  const ct = zip.file('[Content_Types].xml') ? await zip.file('[Content_Types].xml').async('string') : '';
  if (/wordprocessingml|\/word\//.test(ct)) return 'docx';
  if (/presentationml|\/ppt\//.test(ct)) return 'pptx';
  if (/spreadsheetml|\/xl\//.test(ct)) return 'xlsx';
  return 'zip';
}

function looksLikeText(b) {
  if (!b.length) return false;
  let bad = 0;
  for (const c of b) if (c === 0 || (c < 9) || (c > 13 && c < 32 && c !== 27)) bad++;
  return bad / b.length < 0.02;
}

function decodeText(buf) {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch { return new TextDecoder('euc-kr').decode(b); }
}

// ---------- 화면 ----------
const view = $('#viewer');
function note(kind, title, body) {
  $('#warn').append(el('div', { class: 'msg' + (kind === 'danger' ? ' danger' : '') }, el('b', {}, title), body || ''));
}
const sizeText = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB';

let history = [];
async function openFile(file, fromZip) {
  if (!fromZip) history = [];
  $('#result').hidden = false; $('#warn').innerHTML = ''; $('#guide').innerHTML = ''; view.innerHTML = '';
  view.append(el('div', { class: 'loading' }, '파일을 확인하는 중이에요…'));
  $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  const buf = await file.arrayBuffer();
  let type;
  try { type = await detect(file, buf); } catch { type = 'unknown'; }
  if (!fromZip) track('open-' + type);
  const ext = extOf(file.name);
  const info = $('#info'); info.innerHTML = '';
  info.append(el('span', { class: 'name' }, file.name), el('span', { class: 'tag' }, LABEL[type] || LABEL.unknown), el('span', {}, sizeText(file.size)));
  if (history.length) info.append(el('button', { class: 'tag', onclick: () => { const p = history.pop(); openFile(p, true); } }, '← 압축 파일로 돌아가기'));

  // 확장자와 실제 형식이 다를 때
  const extGroup = groupOfExt(ext);
  const parts = file.name.toLowerCase().split('.');
  if (type === 'exe') {
    note('danger', '⚠️ 이 파일은 문서가 아니라 "프로그램(실행 파일)"이에요.', extGroup !== 'exe'
      ? `이름은 .${ext} 처럼 보이지만 실제로는 프로그램이에요. 문서로 위장한 악성 파일일 수 있으니 절대 실행하지 마세요.`
      : '모르는 곳에서 받은 프로그램은 실행하지 마세요. 이 뷰어는 프로그램 파일을 열지 않아요.');
    view.innerHTML = ''; guide('exe'); return;
  }
  if (parts.length > 2 && EXT_GROUP.exe.includes(parts.at(-1)) ) note('danger', '⚠️ 이름 끝에 프로그램 확장자가 붙어 있어요.', '문서처럼 보이게 이름을 꾸민 파일일 수 있어요. 실행하지 마세요.');
  const same = (a, b) => a === b || (a === 'xlsx' && ['xls', 'csv', 'ods'].includes(b)) || (a === 'image' && b === 'image');
  if (ext && extGroup !== 'unknown' && !same(type, extGroup) && !['unknown', 'ole', 'text'].includes(type))
    note('', `ℹ️ 파일 이름은 .${ext} 인데 실제 내용은 '${LABEL[type]}' 형식이에요.`, '이름과 상관없이 실제 내용에 맞춰 열었어요.');

  try {
    view.innerHTML = '';
    await (RENDER[type] || RENDER.unknown)(file, buf, type, ext);
    guide(type);
  } catch (err) {
    console.error(err);
    view.innerHTML = '';
    note('danger', '이 파일은 여기서 열지 못했어요.', String(err?.message || err).slice(0, 200));
    view.append(helpBox(type));
  }
}

// 수정은 카페 회원 전용 안내
function gate(onOk) {
  $('#warn').innerHTML = '';
  note('', '✏️ 수정은 컴픽스NOW 카페 회원 전용이에요.', '');
  const box = $('#warn').lastElementChild;
  const inp = el('input', { type: 'password', autocomplete: 'off', placeholder: '여기에 붙여넣기', class: 'pw' });
  const msg = el('span', { class: 'pwmsg' });
  const go = async () => {
    if (await tryPassword(inp.value)) { track('edit-unlock'); $('#warn').innerHTML = ''; onOk(); }
    else { msg.textContent = '비밀번호가 맞지 않아요. 비밀번호가 바뀌었을 수 있으니 회원 전용 도구 게시판에서 새 비밀번호를 복사해 주세요.'; inp.select(); }
  };
  inp.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  box.append('카페 \'회원 전용 도구\' 게시판 글의 비밀번호를 복사해서 붙여넣어 주세요. 비밀번호는 자주 바뀌어요. 바뀌면 새 비밀번호를 다시 넣어야 해요.', el('br'),
    inp, ' ', el('button', { class: 'pwbtn', onclick: go }, '확인'), ' ', msg, el('br'),
    '아직 회원이 아니라면 → ', el('a', { href: 'https://cafe.naver.com/comfixnow', target: '_blank', rel: 'noopener' }, '카페 가입하러 가기'), ' (보기는 가입 없이 누구나 쓸 수 있어요)');
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  inp.focus();
}

function guide(type) {
  const g = GUIDE[type]; const box = $('#guide'); box.innerHTML = '';
  if (!g) return;
  box.append(el('a', { href: g[0], target: '_blank', rel: 'noopener' }, '📖 ' + g[1]), el('span', {}, ' · 컴픽스NOW 카페 글, 가입 없이 읽을 수 있어요'));
}

function helpBox(type) {
  const tips = {
    hwp: '한글 파일은 한컴 공식 "한컴오피스 뷰어"나 인터넷에서 쓰는 "한컴독스"로 열면 원래 모양대로 보여요.',
    hwpx: '한글 파일은 한컴 공식 "한컴오피스 뷰어"나 인터넷에서 쓰는 "한컴독스"로 열면 원래 모양대로 보여요.',
    doc: '옛 워드(.doc) 파일은 여기서 열 수 없어요. 보낸 분께 .docx 나 PDF로 다시 보내 달라고 하거나, 원드라이브(Word 웹)에 올려서 열어 보세요.',
    ppt: '옛 파워포인트(.ppt) 파일은 여기서 열 수 없어요. 보낸 분께 .pptx 나 PDF로 다시 보내 달라고 해 주세요.',
    zip: '압축이 깨졌거나 암호가 걸린 압축 파일일 수 있어요. 반디집 같은 압축 프로그램으로 풀어 보세요.',
  };
  return el('div', { class: 'msg' }, el('b', {}, '이렇게 해 보세요'), tips[type] || '파일이 덜 내려받아졌거나 손상됐을 수 있어요. 다시 내려받아 보거나, 어떤 파일인지 카페에 물어봐 주세요.', el('br'), el('a', { href: ASK, target: '_blank', rel: 'noopener' }, '👉 카페 \'PC 고장 질문\'에 물어보기'), ' (질문 글은 카페 가입 후 쓸 수 있어요)', el('br'), el('small', {}, '파일을 올릴 땐 주민번호·계좌 같은 개인정보가 든 파일은 빼고, 화면 캡처로 보여 주세요.'));
}

// ---------- 형식별 뷰어 ----------
let XLSX;
async function sheetjs() {
  if (XLSX) return XLSX;
  XLSX = await import(CDN.xlsx);
  const cp = await import(CDN.cpexcel); XLSX.set_cptable(cp);
  return XLSX;
}

const MAX_ROWS = 3000;
async function renderWorkbook(wb) {
  const X = await sheetjs();
  const tabs = el('div', { class: 'tabs' }), box = el('div', { class: 'sheet' });
  view.append(tabs, box);
  const show = (name) => {
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.textContent === name));
    const ws = { ...wb.Sheets[name] };
    box.innerHTML = '';
    if (!ws['!ref']) { box.append(el('p', {}, '빈 시트예요.')); return; }
    const r = X.utils.decode_range(ws['!ref']);
    if (r.e.r - r.s.r + 1 > MAX_ROWS) {
      box.append(el('div', { class: 'msg' }, `행이 ${(r.e.r - r.s.r + 1).toLocaleString()}개라 앞의 ${MAX_ROWS.toLocaleString()}행만 보여 드려요.`));
      r.e.r = r.s.r + MAX_ROWS - 1; ws['!ref'] = X.utils.encode_range(r);
    }
    const holder = el('div'); holder.innerHTML = X.utils.sheet_to_html(ws, { editable: false, header: '', footer: '' });
    box.append(holder);
  };
  wb.SheetNames.forEach((n) => tabs.append(el('button', { onclick: () => show(n) }, n)));
  if (wb.SheetNames.length < 2) tabs.hidden = true;
  show(wb.SheetNames[0]);
}

const RENDER = {
  async xlsx(file, buf) { const X = await sheetjs(); await renderWorkbook(X.read(buf, { cellDates: true, dense: false })); },
  async xls(file, buf) { return RENDER.xlsx(file, buf); },
  async ods(file, buf) { return RENDER.xlsx(file, buf); },
  async numbers(file, buf) { return RENDER.xlsx(file, buf); },
  async csv(file, buf, type, ext) {
    const X = await sheetjs();
    const text = decodeText(buf);
    await renderWorkbook(X.read(text, { type: 'string', FS: ext === 'tsv' ? '\t' : undefined, raw: true }));
  },

  async pdf(file, buf) {
    const pdfjs = await import(CDN.pdf);
    pdfjs.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;
    const task = pdfjs.getDocument({ data: new Uint8Array(buf), cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/', cMapPacked: true, standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/standard_fonts/' });
    let locked = false;
    task.onPassword = (update, reason) => {
      locked = true;
      view.innerHTML = '';
      const inp = el('input', { type: 'password', placeholder: '비밀번호', style: 'padding:8px;font-size:16px' });
      const go = () => { update(inp.value); view.innerHTML = '<div class="loading">여는 중…</div>'; };
      inp.addEventListener('keydown', (e) => e.key === 'Enter' && go());
      view.append(el('div', { class: 'msg' }, el('b', {}, reason === 2 ? '비밀번호가 맞지 않아요. 다시 넣어 주세요.' : '🔑 비밀번호가 걸린 PDF예요.'),
        '명세서·보험 서류는 보낸 곳 안내문(메일·문자)에 비밀번호 규칙이 있어요. 생년월일 6자리인 경우가 많아요.', el('br'), inp, ' ', el('button', { onclick: go }, '열기')));
      inp.focus();
    };
    const doc = await task.promise;
    view.innerHTML = '';
    let scale = 1.4;
    const bar = el('div', { class: 'bar' }, `${doc.numPages}쪽`, el('button', { onclick: () => { scale = Math.max(0.6, scale - 0.2); draw(); } }, '－ 작게'), el('button', { onclick: () => { scale = Math.min(3, scale + 0.2); draw(); } }, '＋ 크게'),
      el('button', { class: 'edit', onclick: async () => {
        const run = async () => {
        if (locked) return note('', '비밀번호가 걸린 PDF는 수정할 수 없어요.', '보낸 곳에 비밀번호 없는 파일을 요청하거나, 인쇄 → PDF로 저장한 뒤 고쳐 보세요.');
        gen++; const { editPdf } = await import('./edit-pdf.js'); await editPdf({ file, buf, doc, view, el, loadScript });
        };
        track(isMember() ? 'edit-member' : 'edit-gate');
        isMember() ? run() : gate(run);
      } }, '✏️ 수정하기 (서명·글자·쪽 정리)'));
    const pages = el('div');
    view.append(bar, pages);
    let gen = 0;
    async function draw() {
      const my = ++gen; pages.innerHTML = '';
      const limit = Math.min(doc.numPages, 60);
      for (let i = 1; i <= limit; i++) {
        if (my !== gen) return;
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: scale * (window.devicePixelRatio > 1 ? 1.5 : 1) });
        const c = el('canvas', { class: 'page' }); c.width = vp.width; c.height = vp.height;
        c.style.width = (vp.width / (window.devicePixelRatio > 1 ? 1.5 : 1)) + 'px';
        pages.append(c);
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      }
      if (doc.numPages > limit) pages.append(el('div', { class: 'msg' }, `앞의 ${limit}쪽까지만 보여 드려요.`));
    }
    await draw();
  },

  async docx(file, buf) {
    await loadScript(CDN.jszip); await loadScript(CDN.docx);
    const box = el('div'); view.append(box);
    await window.docx.renderAsync(buf, box, null, { inWrapper: true, ignoreLastRenderedPageBreak: true, experimental: true });
  },

  async pptx(file) {
    await loadScript(CDN.jszip); await loadScript(CDN.chart); await loadScript(CDN.pptx);
    window.FileReader = NativeFileReader;
    const canvas = el('canvas', { class: 'page', width: 1280, height: 720 });
    const status = el('span');
    const viewer = new window.PptxViewJS.PPTXViewer({ canvas });
    const upd = () => { status.textContent = ` ${viewer.getCurrentSlideIndex() + 1} / ${viewer.getSlideCount()} 장 `; };
    const bar = el('div', { class: 'bar' }, el('button', { onclick: async () => { await viewer.previousSlide(); upd(); } }, '◀ 이전'), status, el('button', { onclick: async () => { await viewer.nextSlide(); upd(); } }, '다음 ▶'));
    view.append(bar, canvas);
    await viewer.loadFile(file);
    await viewer.render();
    upd();
  },

  async hwp(file, buf) {
    view.append(el('div', { class: 'loading' }, '한글 파일 여는 도구를 준비하는 중이에요… (처음 한 번은 10초쯤 걸릴 수 있어요)'));
    const mod = await import(CDN.rhwp);
    if (!window.__rhwpReady) {
      let ctx = null, last = '';
      globalThis.measureTextWidth = (font, text) => { if (!ctx) ctx = document.createElement('canvas').getContext('2d'); if (font !== last) { ctx.font = font; last = font; } return ctx.measureText(text).width; };
      await mod.default({ module_or_path: CDN.rhwpWasm });
      window.__rhwpReady = true;
    }
    const doc = new mod.HwpDocument(new Uint8Array(buf));
    const n = doc.pageCount();
    view.innerHTML = '';
    note('', 'ℹ️ 한글 파일 "간단 보기"예요.', '글꼴이나 복잡한 서식은 원본과 다르게 보일 수 있어요. 원래 모양이 꼭 필요하면 한컴오피스 뷰어나 한컴독스로 열어 주세요.');
    view.append(el('div', { class: 'bar' }, `${n}쪽`));
    const limit = Math.min(n, 40);
    for (let i = 0; i < limit; i++) {
      const holder = el('div'); holder.innerHTML = doc.renderPageSvg(i); view.append(holder);
      if (i % 3 === 2) await new Promise((r) => setTimeout(r));
    }
    if (n > limit) view.append(el('div', { class: 'msg' }, `앞의 ${limit}쪽까지만 보여 드려요.`));
  },
  async hwpx(file, buf) { return RENDER.hwp(file, buf); },

  async image(file) {
    const url = URL.createObjectURL(file);
    view.append(el('img', { src: url, alt: file.name }));
  },
  async heic(file) {
    view.append(el('div', { class: 'loading' }, '아이폰 사진을 바꾸는 중이에요…'));
    await loadScript(CDN.heic);
    let out = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
    if (Array.isArray(out)) out = out[0];
    view.innerHTML = '';
    const url = URL.createObjectURL(out);
    view.append(el('div', { class: 'bar' }, el('a', { href: url, download: file.name.replace(/\.[^.]+$/, '') + '.jpg' }, '⬇ JPG로 저장')), el('img', { src: url, alt: file.name }));
  },
  async tiff(file, buf) {
    await loadScript(CDN.utif);
    const ifds = window.UTIF.decode(buf);
    const bar = el('div', { class: 'bar' }, `${ifds.length}장`); view.append(bar);
    ifds.slice(0, 30).forEach((ifd, i) => {
      window.UTIF.decodeImage(buf, ifd);
      const rgba = window.UTIF.toRGBA8(ifd);
      const c = el('canvas', { class: 'page' }); c.width = ifd.width; c.height = ifd.height;
      c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer), ifd.width, ifd.height), 0, 0);
      view.append(c);
      if (i === 0) c.toBlob((b) => bar.append(' ', el('a', { href: URL.createObjectURL(b), download: file.name.replace(/\.[^.]+$/, '') + '.jpg' }, '⬇ 첫 장 JPG로 저장')), 'image/jpeg', 0.92);
    });
  },
  async text(file, buf) {
    const t = decodeText(buf);
    view.append(el('pre', {}, t.length > 500000 ? t.slice(0, 500000) + '\n…(너무 길어서 앞부분만 보여 드려요)' : t));
  },
  async audio(file) { view.append(el('audio', { controls: '', src: URL.createObjectURL(file), style: 'width:100%' })); },
  async video(file) {
    const v = el('video', { controls: '', src: URL.createObjectURL(file) });
    v.addEventListener('error', () => note('', '이 영상은 이 브라우저에서 재생되지 않아요.', '아이폰 .mov 영상은 크롬에서 안 될 수 있어요. 사파리나 다른 플레이어로 열어 보세요.'));
    view.append(v);
  },
  async zip(file, buf) {
    await loadScript(CDN.jszip);
    const zip = await JSZip.loadAsync(buf, { decodeFileName: (bytes) => { try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return new TextDecoder('euc-kr').decode(bytes); } } });
    const files = Object.values(zip.files).filter((f) => !f.dir);
    view.append(el('div', { class: 'bar' }, `안에 파일 ${files.length}개 — 이름을 누르면 바로 열어요`));
    const ul = el('ul', { class: 'ziplist' });
    files.slice(0, 500).forEach((f) => ul.append(el('li', {}, el('button', { onclick: async () => {
      const blob = await f.async('blob');
      history.push(file);
      openFile(new File([blob], f.name.split('/').pop(), { lastModified: f.date?.getTime() }), true);
    } }, '📄 ' + f.name))));
    view.append(ul);
  },
  async doc() { view.append(helpBox('doc')); },
  async ppt() { view.append(helpBox('ppt')); },
  async ole(file, buf) { const X = await sheetjs(); await renderWorkbook(X.read(buf)); },
  async unknown(file) { note('', '어떤 형식의 파일인지 알아내지 못했어요.'); view.append(helpBox('unknown')); },
};
