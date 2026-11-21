// PDF 수정(카페 회원 전용): 글자·서명 넣기, 쪽 빼기·순서 바꾸기 → 새 PDF로 저장
// 글자와 서명은 그림(PNG)으로 넣는다(한글 글꼴 파일을 따로 받지 않아도 되게).
const PDFLIB = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
const MAX_PAGES = 60;
const FONT = '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';

export async function editPdf({ file, buf, doc, view, el, loadScript }) {
  view.innerHTML = '';
  let mode = null; // 'text' | 'sign' | null
  let signUrl = null;
  let fontSize = 16;
  const pages = []; // { n, wrap, layer, cssW, cssH, removed }

  const hint = el('span', { class: 'hint' }, '아래 단추를 고른 뒤 쪽 위를 눌러 넣으세요.');
  const btnText = el('button', { onclick: () => setMode(mode === 'text' ? null : 'text') }, '🔤 글자 넣기');
  const btnSign = el('button', { onclick: () => openPad() }, '✍️ 서명 넣기');
  const size = el('select', { title: '글자 크기', onchange: (e) => { fontSize = +e.target.value; } },
    ...[12, 16, 20, 28].map((n) => el('option', n === 16 ? { value: n, selected: '' } : { value: n }, n + 'pt')));
  const btnSave = el('button', { class: 'primary', onclick: () => save() }, '💾 새 PDF로 저장');
  const bar = el('div', { class: 'bar sticky' }, btnText, size, btnSign, btnSave, hint);
  const list = el('div', { class: 'edit-pages' });
  view.append(bar, list);

  function setMode(m) {
    mode = m;
    btnText.classList.toggle('on', m === 'text');
    btnSign.classList.toggle('on', m === 'sign');
    hint.textContent = m === 'text' ? '글자를 넣을 곳을 누르세요.' : m === 'sign' ? '서명을 넣을 곳을 누르세요.' : '아래 단추를 고른 뒤 쪽 위를 눌러 넣으세요.';
    list.classList.toggle('placing', !!m);
  }

  // ---- 쪽 그리기 ----
  const limit = Math.min(doc.numPages, MAX_PAGES);
  for (let n = 1; n <= limit; n++) {
    const page = await doc.getPage(n);
    const ratio = window.devicePixelRatio > 1 ? 2 : 1;
    const base = page.getViewport({ scale: 1 });
    const cssW = Math.min(800, view.clientWidth - 40, base.width * 1.4);
    const vp = page.getViewport({ scale: (cssW / base.width) * ratio });
    const c = el('canvas', { class: 'page' }); c.width = vp.width; c.height = vp.height;
    const cssH = vp.height / ratio;
    c.style.width = cssW + 'px'; c.style.height = cssH + 'px';
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    const layer = el('div', { class: 'layer' });
    const wrap = el('div', { class: 'pwrap', style: `width:${cssW}px;height:${cssH}px` }, c, layer);
    const p = { n, wrap, layer, cssW, cssH, removed: false, rot: page.rotate || 0, px: cssW / base.width };
    const label = el('span', {}, `${n}쪽`);
    const ctl = el('div', { class: 'pctl' }, label,
      el('button', { onclick: () => move(p, -1) }, '▲ 위로'),
      el('button', { onclick: () => move(p, 1) }, '▼ 아래로'),
      el('button', { onclick: (e) => { p.removed = !p.removed; p.box.classList.toggle('removed', p.removed); e.target.textContent = p.removed ? '↩ 되살리기' : '🗑 이 쪽 빼기'; } }, '🗑 이 쪽 빼기'));
    p.box = el('div', { class: 'pbox' }, ctl, wrap);
    layer.addEventListener('click', (e) => place(p, e));
    pages.push(p); list.append(p.box);
  }
  if (doc.numPages > limit) list.append(el('div', { class: 'msg' }, `앞의 ${limit}쪽까지만 고칠 수 있어요. 나머지 쪽은 저장할 때 그대로 뒤에 붙어요.`));

  function move(p, d) {
    const i = pages.indexOf(p), j = i + d;
    if (j < 0 || j >= pages.length) return;
    [pages[i], pages[j]] = [pages[j], pages[i]];
    pages.forEach((q) => list.insertBefore(q.box, list.lastElementChild?.classList.contains('msg') ? list.lastElementChild : null));
    p.box.scrollIntoView({ block: 'center' });
  }

  // ---- 글자·서명 놓기 ----
  function place(p, e) {
    if (!mode || e.target !== p.layer) return;
    const r = p.layer.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (mode === 'text') {
      const t = el('div', { class: 'otext', contenteditable: 'true', style: `font-size:${fontSize * p.px}px` });
      t.dataset.pt = fontSize;
      addItem(p, t, x, y - 10);
      t.focus();
    } else if (mode === 'sign' && signUrl) {
      const img = el('img', { class: 'osign', src: signUrl, draggable: 'false' });
      addItem(p, img, x - 75, y - 30);
    }
    setMode(null);
  }

  function addItem(p, node, x, y) {
    const handle = el('span', { class: 'ohandle', title: '끌어서 옮기기' }, '✥');
    const del = el('span', { class: 'odel', title: '지우기', onclick: () => item.remove() }, '×');
    const item = el('div', { class: 'oitem', style: `left:${Math.max(0, x)}px;top:${Math.max(0, y)}px` }, handle, del, node);
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault(); handle.setPointerCapture(e.pointerId);
      const sx = e.clientX - item.offsetLeft, sy = e.clientY - item.offsetTop;
      const mv = (ev) => { item.style.left = ev.clientX - sx + 'px'; item.style.top = ev.clientY - sy + 'px'; };
      handle.addEventListener('pointermove', mv);
      handle.addEventListener('pointerup', () => handle.removeEventListener('pointermove', mv), { once: true });
    });
    p.layer.append(item);
  }

  // ---- 서명 그리기 창 ----
  function openPad() {
    const cv = el('canvas', { class: 'pad', width: 600, height: 220 });
    const ctx = cv.getContext('2d');
    ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
    let drawing = false, drew = false;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
    cv.addEventListener('pointerdown', (e) => { drawing = true; drew = true; cv.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); });
    cv.addEventListener('pointermove', (e) => { if (drawing) { ctx.lineTo(...pos(e)); ctx.stroke(); } });
    cv.addEventListener('pointerup', () => { drawing = false; });
    const close = () => box.remove();
    const box = el('div', { class: 'modal' }, el('div', { class: 'modal-in' },
      el('b', {}, '✍️ 서명을 그려 주세요 (마우스나 손가락으로)'), cv,
      el('div', { class: 'bar' },
        el('button', { onclick: () => { ctx.clearRect(0, 0, cv.width, cv.height); drew = false; } }, '다시 그리기'),
        el('button', { onclick: close }, '닫기'),
        el('button', { class: 'primary', onclick: () => { if (!drew) return; signUrl = trim(cv); close(); setMode('sign'); } }, '이 서명 쓰기'))));
    document.body.append(box);
  }

  function trim(cv) { // 빈 여백을 잘라 낸 서명 그림
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const o = document.createElement('canvas'); o.width = x1 - x0 + 10; o.height = y1 - y0 + 10;
    o.getContext('2d').drawImage(cv, x0 - 5, y0 - 5, o.width, o.height, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  }

  // 글자 상자를 그림으로
  function textPng(node, scale) {
    const lines = node.innerText.replace(/\n$/, '').split('\n');
    const px = parseFloat(node.style.fontSize) * scale;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = `${px}px ${FONT}`;
    c.width = Math.ceil(Math.max(1, ...lines.map((l) => ctx.measureText(l).width))) + 4;
    c.height = Math.ceil(px * 1.3 * lines.length) + 4;
    ctx.font = `${px}px ${FONT}`; ctx.fillStyle = '#000'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, 2, 2 + i * px * 1.3));
    return { url: c.toDataURL('image/png'), w: c.width / scale, h: c.height / scale };
  }

  // ---- 저장 ----
  async function save() {
    btnSave.disabled = true; btnSave.textContent = '저장하는 중…';
    try {
      await loadScript(PDFLIB);
      const { PDFDocument } = window.PDFLib;
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true }); // buf는 pdf.js가 작업자로 넘겨 비어 있음
      const out = await PDFDocument.create();
      const keep = pages.filter((p) => !p.removed);
      const order = [...keep.map((p) => p.n - 1)];
      for (let i = limit; i < src.getPageCount(); i++) order.push(i);
      const copied = await out.copyPages(src, order);
      let rotated = false;
      for (let k = 0; k < copied.length; k++) {
        const pg = out.addPage(copied[k]);
        const p = keep[k];
        if (!p) continue;
        const items = [...p.layer.querySelectorAll('.oitem')];
        if (!items.length) continue;
        if (p.rot % 360) { rotated = true; }
        const { width: W, height: H } = pg.getSize();
        const s = W / p.cssW; // 화면 px → PDF pt
        for (const it of items) {
          const node = it.querySelector('.otext, .osign');
          const left = it.offsetLeft + node.offsetLeft, top = it.offsetTop + node.offsetTop;
          let url, w, h;
          if (node.classList.contains('otext')) {
            if (!node.innerText.trim()) continue;
            ({ url, w, h } = textPng(node, 3));
          } else { url = node.src; w = node.offsetWidth; h = node.offsetHeight; }
          const png = await out.embedPng(url);
          pg.drawImage(png, { x: left * s, y: H - (top + h) * s, width: w * s, height: h * s });
        }
      }
      const bytes = await out.save();
      const a = el('a', { href: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), download: file.name.replace(/\.pdf$/i, '') + '_수정.pdf' });
      document.body.append(a); a.click(); a.remove();
      hint.textContent = rotated ? '저장했어요. 돌려진 쪽은 넣은 위치가 어긋날 수 있으니 확인해 주세요.' : '저장했어요. 내려받은 파일을 확인해 주세요.';
    } catch (err) {
      console.error(err);
      hint.textContent = '저장하지 못했어요: ' + String(err?.message || err).slice(0, 120);
    } finally {
      btnSave.disabled = false; btnSave.textContent = '💾 새 PDF로 저장';
    }
  }
}
