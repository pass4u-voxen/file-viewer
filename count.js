// 방문 기록: GoatCounter(쿠키 없음). 파일 이름·내용은 보내지 않고 '어떤 종류를 열었는지'만 센다.
// 통계 화면: https://comfixnow.goatcounter.com  (localhost에서는 세지 않음)
const s = document.createElement('script');
s.async = true;
s.src = 'https://gc.zgo.at/count.js';
s.dataset.goatcounter = 'https://comfixnow.goatcounter.com/count';
document.head.append(s);

export const track = (name) => {
  try { window.goatcounter?.count?.({ path: name, title: name, event: true }); } catch {}
};

// 카페로 가는 링크 클릭 (질문 게시판 menus/9 = ask, 그 밖 = cafe)
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href*="cafe.naver.com"]');
  if (a) track('go-' + (a.href.includes('/menus/9') ? 'ask' : 'cafe'));
});
