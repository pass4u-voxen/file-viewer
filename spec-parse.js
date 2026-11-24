// DxDiag.txt(‘DirectX 진단 도구’ → ‘모든 정보 저장’)에서 사양만 뽑아 카페에 올릴 글로 만든다.
// 컴퓨터 이름·사용자 이름·Machine Id 같은 개인 정보는 처음부터 읽지 않는다(필요한 항목만 골라 씀).
// 항목 이름은 영어/한국어 둘 다 받는다(윈도우 언어에 따라 다름).

const KEYS = {
  os: ['Operating System', '운영 체제', '운영체제'],
  maker: ['System Manufacturer', '시스템 제조업체', '시스템 제조사'],
  model: ['System Model', '시스템 모델'],
  cpu: ['Processor', '프로세서'],
  mem: ['Memory', '메모리'],
  dx: ['DirectX Version', 'DirectX 버전'],
  card: ['Card name', '카드 이름'],
  dedicated: ['Dedicated Memory', '전용 메모리'],
  dispmem: ['Display Memory', '디스플레이 메모리'],
  mode: ['Current Mode', '현재 모드'],
  drvver: ['Driver Version', '드라이버 버전'],
  drvdate: ['Driver Date/Size', '드라이버 날짜/크기'],
  drive: ['Drive', '드라이브'],
  free: ['Free Space', '사용 가능한 공간', '여유 공간', '빈 공간'],
  total: ['Total Space', '전체 공간', '총 공간'],
  dmodel: ['Model', '모델'],
};
const norm = (s) => s.replace(/\s+/g, '').toLowerCase();
const KEYMAP = new Map();
for (const [k, names] of Object.entries(KEYS)) for (const n of names) KEYMAP.set(norm(n), k);

// 바이트 → 글자: UTF-16(BOM), UTF-8, 안 되면 한국어 윈도우 기본(EUC-KR/CP949)
export function decode(buf) {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b);
  // BOM 없는 UTF-16LE: 앞부분 홀수 자리 바이트가 대부분 0
  let zeros = 0; for (let i = 1; i < Math.min(b.length, 400); i += 2) if (b[i] === 0) zeros++;
  if (zeros > 100) return new TextDecoder('utf-16le').decode(b);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch { return new TextDecoder('euc-kr').decode(b); }
}

// 구역(------ 제목 ------)별로 나눠 "이름: 값" 줄을 모은다. 같은 이름이 여러 번 나오면(그래픽카드·드라이브 여러 개) 새 묶음을 시작한다.
function sections(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out = []; let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^-{4,}\s*$/.test(l) && i + 2 < lines.length && /^-{4,}\s*$/.test(lines[i + 2])) {
      cur = { title: lines[i + 1].trim(), items: [] }; out.push(cur); i += 2; continue;
    }
    const m = l.match(/^\s*([^:]{1,40}?)\s*:\s?(.*)$/);
    if (!m || !cur) continue;
    const k = KEYMAP.get(norm(m[1]));
    if (!k) continue;
    // 그래픽카드·드라이브는 '카드 이름'·'드라이브' 줄에서 새 묶음 시작. 나머지는 묶음 안 첫 값만 쓴다
    // (그래픽카드 구역 아래쪽에 옛 드라이버 목록이 또 나오므로 덮어쓰면 안 됨)
    let item = cur.items[cur.items.length - 1];
    if (!item || k === 'card' || k === 'drive') { item = {}; cur.items.push(item); }
    if (!(k in item)) item[k] = m[2].trim();
  }
  return out;
}

// 드라이버 날짜: 2024-08-14 / 8/14/2024(미국식) / 28/10/2020(일·월) 모두 받기. 일·월 구별이 안 되면 연·월만.
function ymd(s) {
  let m = s.match(/(\d{4})[-.\/]\s?(\d{1,2})[-.\/]\s?(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
  if (!m) return '';
  let [a, b] = [+m[1], +m[2]];
  if (a > 12) [a, b] = [b, a];
  else if (b <= 12 && a !== b) return `${m[3]}년`;
  return `${m[3]}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
}
const gb = (mb) => Math.round(mb / 1024);
const cleanCpu = (s) => s.replace(/\((R|TM|tm|r)\)/g, '').replace(/\s+CPU\s+@/, ' @').replace(/\s{2,}/g, ' ').trim();
const junk = (s) => !s || /to be filled|system manufacturer|system product name|default string|o\.e\.m|^n\/a$|^unknown$/i.test(s);

export function parse(text) {
  const secs = sections(text);
  const all = (k) => secs.flatMap((s) => s.items.filter((it) => k in it));
  const first = (k) => all(k)[0]?.[k] || '';
  const r = {};

  r.os = first('os').replace(/\s*\(\d+\.\d+,\s*/, ' (').replace(/\)\s*\(.*$/, ')');
  const maker = first('maker'), model = first('model');
  r.pc = [maker, model].filter((x) => !junk(x)).join(' ');
  const cpu = first('cpu');
  if (cpu) {
    const n = cpu.match(/\((\d+)\s*CPUs?\)/i);
    r.cpu = cleanCpu(cpu.replace(/\(\d+\s*CPUs?\).*$/i, '').replace(/,\s*~.*$/, '')) + (n ? ` (논리 프로세서 ${n[1]}개)` : '');
  }
  const mem = first('mem').match(/([\d,]+)\s*MB/i);
  if (mem) r.ram = `${gb(+mem[1].replace(/,/g, ''))}GB`;
  r.dx = first('dx');

  // 그래픽카드: 같은 이름이 모니터마다 반복될 수 있어 이름으로 합친다
  const gpus = new Map();
  for (const it of all('card')) {
    const name = cleanCpu(it.card || '');
    // 가상·원격 화면 장치는 빼기 (USB 모니터 어댑터, 원격 데스크톱 등)
    if (!name || /IDDCX|basic display|basic render|remote|virtual|parsec|displaylink|meta virtual/i.test(name)) continue;
    const g = gpus.get(name) || { name, modes: new Set() };
    const vm = (it.dedicated || '').match(/([\d,]+)\s*MB/i);
    if (vm && !g.vram) g.vram = gb(+vm[1].replace(/,/g, ''));
    if (it.drvver && !g.drv) g.drv = it.drvver;
    if (!g.date) g.date = ymd(it.drvdate || '');
    const md = (it.mode || '').match(/(\d+)\s*x\s*(\d+).*?\((\d+)\s*Hz\)/i);
    if (md) g.modes.add(`${md[1]}x${md[2]} ${md[3]}Hz`);
    gpus.set(name, g);
  }
  r.gpus = [...gpus.values()];

  // 저장장치: 드라이브 글자별 모델·용량·남은 공간
  r.drives = all('drive').filter((it) => /^[A-Z]:/i.test(it.drive)).map((it) => {
    const num = (s) => { const m = (s || '').match(/([\d.,]+)\s*([GT]B)/i); if (!m) return null; const v = parseFloat(m[1].replace(/,/g, '')); return m[2].toUpperCase() === 'TB' ? v * 1024 : v; };
    return { letter: it.drive.slice(0, 2).toUpperCase(), model: it.dmodel || '', total: num(it.total), free: num(it.free) };
  }).filter((d) => d.total);

  r.ok = !!(r.cpu || r.ram || r.gpus.length);
  return r;
}

export function toPost(r) {
  const L = ['[내 컴퓨터 사양]'];
  if (r.os) L.push(`- 윈도우: ${r.os}`);
  if (r.pc) L.push(`- 제조사·모델: ${r.pc}`);
  if (r.cpu) L.push(`- CPU: ${r.cpu}`);
  if (r.ram) L.push(`- 램: ${r.ram}`);
  for (const g of r.gpus) {
    const extra = [g.vram ? `그래픽 메모리 ${g.vram}GB` : '', g.drv ? `드라이버 ${g.drv}${g.date ? ` (${g.date})` : ''}` : ''].filter(Boolean).join(', ');
    L.push(`- 그래픽카드: ${g.name}${extra ? ` (${extra})` : ''}`);
  }
  const modes = [...new Set(r.gpus.flatMap((g) => [...g.modes]))];
  if (modes.length) L.push(`- 모니터: ${modes.join(' / ')}`);
  for (const d of r.drives) {
    const f = (v) => (v >= 1000 ? `${(v / 1024).toFixed(1)}TB` : `${Math.round(v)}GB`);
    const pct = d.free != null ? Math.round((d.free / d.total) * 100) : null;
    L.push(`- 저장장치 ${d.letter} ${d.model ? d.model + ' ' : ''}— 전체 ${f(d.total)}${d.free != null ? `, 남은 공간 ${f(d.free)} (${pct}%)` : ''}`);
  }
  if (r.dx) L.push(`- ${r.dx}`);
  L.push('', '[궁금한 점]', '- 증상 또는 하고 싶은 것: ', '- 주로 쓰는 용도(게임·문서·영상 등): ', '- 예산(업그레이드라면): ');
  L.push('', '(컴픽스NOW 사양 정리 도구로 만들었어요)');
  return L.join('\n');
}
