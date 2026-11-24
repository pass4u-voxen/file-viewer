import { decode, parse, toPost } from './spec-parse.js';

const $ = (s) => document.querySelector(s);
const drop = $('#drop');

async function handle(file) {
  if (!file) return;
  $('#result').hidden = false;
  $('#warn').innerHTML = '';
  if (file.size > 20 * 1024 * 1024) return warn('파일이 너무 커요. dxdiag에서 저장한 DxDiag.txt 파일이 맞는지 확인해 주세요.');
  const r = parse(decode(await file.arrayBuffer()));
  if (!r.ok) {
    $('#out').value = '';
    return warn('사양을 찾지 못했어요. dxdiag 창에서 <b>모든 정보 저장</b>으로 만든 DxDiag.txt 파일인지 확인해 주세요.');
  }
  $('#out').value = toPost(r);
  if (!r.gpus.length) warn('그래픽카드 정보를 찾지 못했어요. 그대로 올려도 괜찮아요.', true);
  $('#out').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function warn(html, soft) {
  $('#warn').innerHTML = `<div class="msg${soft ? '' : ' danger'}">${html}</div>`;
}

$('#pick').addEventListener('change', (e) => handle(e.target.files[0]));
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); handle(e.dataTransfer.files[0]); });

$('#copy').addEventListener('click', async () => {
  const t = $('#out').value;
  try { await navigator.clipboard.writeText(t); } catch { $('#out').select(); document.execCommand('copy'); }
  $('#copied').textContent = '복사했어요! 카페 글쓰기 화면에 붙여넣기(Ctrl+V) 하세요.';
});
