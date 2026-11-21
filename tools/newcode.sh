#!/bin/zsh
# usage: tools/newcode.sh  — 이번 달 수정 코드를 새로 만들고 member.js에 해시를 넣는다(직전 코드 하나는 남김).
# 출력된 링크를 카페 회원 전용 게시판 글에 넣는다. 그다음 git commit/push.
cd "$(dirname "$0")/.."
CODE=$(LC_ALL=C tr -dc 'a-z0-9' < /dev/urandom | head -c 8)
HASH=$(printf %s "$CODE" | shasum -a 256 | cut -d' ' -f1)
python3 - "$HASH" "$(date +%Y-%m)" <<'PY'
import sys,re
h,ym=sys.argv[1],sys.argv[2]
s=open('member.js').read()
a=s.index('// newcode:begin')+len('// newcode:begin'); b=s.index('  // newcode:end')
old=[l for l in s[a:b].strip().splitlines() if l.strip()][:1]
new="\n  '%s', // %s\n"%(h,ym)+''.join('  '+l.strip()+'\n' for l in old)
open('member.js','w').write(s[:a]+new+s[b:])
PY
echo "코드: $CODE"
echo "링크: https://pass4u-voxen.github.io/file-viewer/?m=$CODE"
