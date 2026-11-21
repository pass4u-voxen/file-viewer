#!/bin/zsh
# usage: tools/newcode.sh  — (비정기) 수정 코드를 새로 만들고 member.js의 해시를 바꾼다(이전 비밀번호는 즉시 무효).
# 출력된 비밀번호를 카페 회원 전용 도구 게시판(33번 글)에 적는다. 그다음 git commit/push.
cd "$(dirname "$0")/.."
CODE=$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 24)
HASH=$(printf %s "$CODE" | shasum -a 256 | cut -d' ' -f1)
python3 - "$HASH" "$(date +%Y-%m)" <<'PY'
import sys,re
h,ym=sys.argv[1],sys.argv[2]
s=open('member.js').read()
a=s.index('// newcode:begin')+len('// newcode:begin'); b=s.index('  // newcode:end')
old=[]  # 비밀번호가 바뀌면 이전 비밀번호로 열린 기기도 바로 잠김
new="\n  '%s', // %s\n"%(h,ym)+''.join('  '+l.strip()+'\n' for l in old)
open('member.js','w').write(s[:a]+new+s[b:])
PY
echo "새 비밀번호: $CODE  (카페 회원 전용 도구 33번 글에 적기)"
