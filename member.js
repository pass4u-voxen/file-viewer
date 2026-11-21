// 수정 기능은 카페 회원만: 회원 전용 게시판(menuId=13) 글에 적힌 비밀번호를 넣어야 열린다.
// 비밀번호 원문은 소스에 두지 않고 SHA-256만 둔다. 코드 교체: tools/newcode.sh
const HASHES = [
  // newcode:begin
  '6dabe1449c66e7d38daa0efbc6031ceaa854a8581249520effadd9d70d806d54', // 2026-11
  // newcode:end
];
const KEY = 'fvMember';
const DAYS = 180; // 코드는 비정기로 바뀜. 코드가 목록에서 빠지면 그때 다시 잠김

async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 비밀번호(회원 전용 게시판 글에 공지)를 넣으면 이 기기에서 수정 기능이 열린다.
export async function tryPassword(pw) {
  const h = await sha256(String(pw).replace(/\s/g, ''));
  if (!HASHES.includes(h)) return false;
  sessionOk = true; // 저장소가 막힌 브라우저(사생활 보호 모드)라도 이번 방문 동안은 열림
  try { localStorage.setItem(KEY, JSON.stringify({ h, until: Date.now() + DAYS * 864e5 })); } catch {}
  return true;
}

let sessionOk = false;
export function isMember() {
  if (sessionOk) return true;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return !!v && HASHES.includes(v.h) && v.until > Date.now();
  } catch { return false; }
}
