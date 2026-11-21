// 수정 기능은 카페 회원만: 회원 전용 게시판 글의 링크(?m=코드)를 '카페 안에서' 눌러 들어온 경우에만 연다.
// 코드 원문은 소스에 두지 않고 SHA-256만 둔다. 코드 교체: tools/newcode.sh
const HASHES = [
  // newcode:begin
  '33b5e5395d71ea379f5629d1e16ed206708c46ef52f9697d5824997432d5c9dc', // 2026-11
  // newcode:end
];
const CAFE_REF = /^https:\/\/(m\.)?cafe\.naver\.com\/(.*cafes\/31647359\b|comfixnow\b|.*clubid=31647359\b)/;
const KEY = 'fvMember';
const DAYS = 40;

async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 반환: 'ok'(방금 확인됨) | 'bad-ref'(코드는 맞지만 카페 밖에서 열림) | 'bad-code' | null(코드 없음)
export async function initMember() {
  const u = new URL(location.href);
  const m = u.searchParams.get('m');
  if (!m) return null;
  u.searchParams.delete('m');
  history.replaceState(null, '', u.pathname + u.search + u.hash);
  const h = await sha256(m.trim());
  if (!HASHES.includes(h)) return 'bad-code';
  if (!CAFE_REF.test(document.referrer)) return 'bad-ref';
  sessionOk = true; // 저장소가 막힌 브라우저(사생활 보호 모드)라도 이번 방문 동안은 열림
  try { localStorage.setItem(KEY, JSON.stringify({ h, until: Date.now() + DAYS * 864e5 })); } catch {}
  return 'ok';
}

let sessionOk = false;
export function isMember() {
  if (sessionOk) return true;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return !!v && HASHES.includes(v.h) && v.until > Date.now();
  } catch { return false; }
}
