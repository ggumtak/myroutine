/* 노래일기 — the practice method from the lecture: 노래 전 루틴, 발음 찾기, 노래할 때 기억할 것, 멈춤 규칙.
   The words and numbers are the lecture's; only English terms were put into plain Korean. */
(function () {
'use strict';

const STOP_RULES = [
  '목이 긁히거나 따끔하면 그날은 끝',
  '끝난 후 목 상태가 5점 이하면 다음 날은 루틴 ①~③단계만',
  '20~25분 부르면 5~10분 완전히 쉬기, 물 자주 마시기',
  '쉰 목소리·통증이 2주 이상이면 이비인후과(음성 전문) 방문'
];

/* the routine's steps; 발음 찾기 comes right after step ④. light: still done on a day after a sore throat */
const GROUPS = [
  { k: 'r1', n: '①', no: 1, name: '몸 풀기', min: 3, light: true },
  { k: 'r2', n: '②', no: 2, name: '호흡', min: 6, light: true },
  { k: 'r3', n: '③', no: 3, name: '빨대 발성', min: 5, light: true },
  { k: 'r4', n: '④', no: 4, name: '성구 전환 연결', min: 6 },
  { k: 'rp', n: '', no: 0, name: '발음 찾기', min: 5, note: '루틴 4단계 뒤에' },
  { k: 'r5', n: '⑤', no: 5, name: '공명·턱', min: 5 },
  { k: 'r6', n: '⑥', no: 6, name: '노래로 옮기기', min: 3 },
  { k: 'rx', n: '', no: 0, name: '그 밖의 연습', min: 0 }
];

/* routine items as 기초 연습 entries. ph: what each check is, in order ([label, count]) */
const ITEMS = [
  { id: 'rt_warm', g: 'r1', name: '몸 풀기', target: 5, memo: '목·어깨 돌리기, 턱 마사지, 혀 내밀고 5초×3', ph: [['목·어깨 돌리기', 1], ['턱 마사지', 1], ['혀 내밀고 5초', 3]] },
  { id: 'rt_elastic', g: 'r2', name: '탄력 확인', target: 1, memo: '옆구리 버틴 채 고개 돌리기·웃기·코로 숨쉬기가 편하면 통과' },
  { id: 'rt_straw', g: 'r3', name: '빨대 “우~” 5음', target: 1, memo: '5음 오르내리기 (반음씩 올리기)', keys: true },
  { id: 'rt_siren', g: 'r3', name: '빨대 사이렌', target: 2, memo: '5회×2세트', ph: [['1세트 (5회)', 1], ['2세트 (5회)', 1]] },
  { id: 'rt_link', g: 'r4', name: '빨대 → “머~” 사이렌', target: 5, memo: '빨대 사이렌 → 빨대 빼고 “머~” 사이렌 ×5 (뒤집히면 볼륨 줄이기)' },
  { id: 'rt_pa', g: 'rp', name: '모음 찾기', target: 1, memo: '내가 막히는 음 근처에서 “머” 5음 스케일', keys: true, pron: 'A' },
  { id: 'rt_pb', g: 'rp', name: '자음 찾기', target: 1, memo: '찾은 모음으로 자음만 바꾸기', pron: 'B' },
  { id: 'rt_pc', g: 'rp', name: '가사에 입히기', target: 5, memo: '연습곡 고음 가사의 ㅐ/ㅏ/ㅓ를 바꾼 모음으로 ×3 → 원래 가사로 ×2 (바꾼 느낌 유지)', ph: [['바꾼 가사로', 3], ['원래 가사로', 2]], pron: 'C' },
  { id: 'rt_thumb', g: 'r5', name: '엄지 물고', target: 5, memo: '연습곡 고음 한 소절 — 엄지 물고 ×3 → 원래대로 ×2', ph: [['엄지 물고', 3], ['원래대로', 2]] },
  { id: 'rt_oh', g: 'r5', name: '‘오’ 입모양', target: 5, memo: '연습곡 고음 한 소절 — ‘오’ 입모양 ×3 → 원래대로 ×2', ph: [['‘오’ 입모양', 3], ['원래대로', 2]] },
  { id: 'rt_far', g: 'r6', name: '“어머니~” 멀리 부르기', target: 1, memo: '편한 음에서 조금씩 위로' },
  { id: 'rt_hsing', g: 'r6', name: '히싱 → 바로 노래', target: 3, memo: '소절 길이만큼 히싱 → 바로 노래 ×3' },
  { id: 'rt_rec', g: 'r6', name: '마지막 1회 녹음', target: 1, memo: '', rec: true }
];
const BY_ID = {};
ITEMS.forEach(d => { BY_ID[d.id] = d; });
/* the order inside 기초 연습; @hiss / @pant are the user's own 히싱 and 개호흡 items */
const ORDER = ['rt_warm', '@hiss', '@pant', 'rt_elastic', 'rt_straw', 'rt_siren', 'rt_link', 'rt_pa', 'rt_pb', 'rt_pc', 'rt_thumb', 'rt_oh', 'rt_far', 'rt_hsing', 'rt_rec'];
const HISS_MEMO = '“스—” 30~50% 힘으로 ×5', PANT_MEMO = '20초×2 (어지러우면 중단)';
const HISS_SEC = [20, 25, 30, 35], PANT_SEC = 20;

/* the whole routine as written, for 루틴 안내 (' / ' splits a step into its parts) */
const STEPS = [
  { name: '몸 풀기', min: 3, text: '목·어깨 돌리기, 턱 마사지, 혀 내밀고 5초×3' },
  { name: '호흡', min: 6, text: '히싱 “스—” 30~50% 힘으로 ×5 (1주 20초→2주 25초→3주 30초→4주 35초) / 개호흡 20초×2 (어지러우면 중단) / 탄력 확인 1회 (옆구리 버틴 채 고개 돌리기·웃기·코로 숨쉬기가 편하면 통과)' },
  { name: '빨대 발성', min: 5, text: '빨대 “우~” 5음 오르내리기 (반음씩 올리기) / 빨대 사이렌 5회×2세트' },
  { name: '성구 전환 연결', min: 6, text: '빨대 사이렌 → 빨대 빼고 “머~” 사이렌 ×5 (뒤집히면 볼륨 줄이기)' },
  { name: '공명·턱', min: 5, text: '연습곡 고음 한 소절 — 엄지 물고 ×3 → 원래대로 ×2 / ‘오’ 입모양 ×3 → 원래대로 ×2' },
  { name: '노래로 옮기기', min: 3, text: '“어머니~” 멀리 부르기 (편한 음에서 조금씩 위로) / 소절 길이만큼 히싱 → 바로 노래 ×3 / 마지막 1회 녹음' }
];

/* 발음 찾기 */
const PRON = {
  table: [
    ['모음 순서', 'ㅣ ㅔ ㅏ ㅓ ㅗ ㅜ', '앞 = 밝고 흉성 우세 / 뒤 = 둥글고 두성 우세'],
    ['자음 순서', 'ㄲ ㄱ ㅃ ㅂ ㅁ ㄴ ㅍ ㅎ', '앞 = 바람 끊김·진성 유도 / 뒤 = 바람 열림·가성 유도'],
    ['고음에서 모음 바꾸기', 'ㅐ→ㅔ, ㅏ→ㅓ, ㅓ→ㅗ', '']
  ],
  A: { title: '모음 찾기', lead: '내가 막히는 음 근처에서 “머” 5음 스케일', back: '조이고 질러지면 → 모 → 무 (뒤로 한 칸씩)', front: '뒤집히면 → 마 → 메 → 미 (앞으로 한 칸씩)', pick: '가장 편하게 진성 고음이 난 모음을 골라 적어요' },
  B: { title: '자음 찾기', lead: '모음 찾기에서 찾은 모음으로 자음만 바꾸기', back: '목에 힘 들어가고 음정 안 닿으면 → ㅁ에서 ㄴ → ㅍ → ㅎ (뒤로)', front: '바람 새고 가성 되면 → ㅁ에서 ㅂ → ㅃ → ㄱ → ㄲ (앞으로)', pick: '가장 편한 자음+모음 조합을 골라 적어요' },
  C: { title: '가사에 입히기', lead: '연습곡 고음 가사의 ㅐ/ㅏ/ㅓ를 바꾼 모음으로 ×3 → 원래 가사로 ×2 (바꾼 느낌 유지)' }
};

/* 노래할 때 기억할 것 */
const CUES = [
  ['숨 들이쉴 때', '옆구리가 넓어지는지만 확인'],
  ['부르는 동안', '배는 서서히 들어가되 딱딱하지 않게, 옆구리는 넓게 유지 (“스—”처럼 일정한 바람)'],
  ['고음', '배 넣는 속도만 빨라짐. 더 세게 짜지 않기, 바람 끊기지 않게'],
  ['호흡 방향', '배에서 입 앞으로 곧장 보내지 않기 → 위·뒤로 돌아서 앞으로'],
  ['혀뿌리', '누르지 않기 (들라는 정확한 의도는 선생님께 확인하기)'],
  ['입', '크게 벌리지 말고 작게, ‘오’ 모양 쪽으로'],
  ['턱', '흔들리지 않게 (엄지 물었을 때 느낌 기억)'],
  ['느낌', '멀리 있는 사람 부르듯 (“야~”, “어머니~”)']
];
const CUE_ONE = '한 번에 하나만 신경 쓰기: 오늘 집중할 것 1개 정하고 시작';

/* ---------- Hangul: syllables for the ladders, and the high-note vowel change for lyrics ---------- */
const V = ['ㅣ', 'ㅔ', 'ㅏ', 'ㅓ', 'ㅗ', 'ㅜ'], C = ['ㄲ', 'ㄱ', 'ㅃ', 'ㅂ', 'ㅁ', 'ㄴ', 'ㅍ', 'ㅎ'];
const V_JUNG = { 'ㅣ': 20, 'ㅔ': 5, 'ㅏ': 0, 'ㅓ': 4, 'ㅗ': 8, 'ㅜ': 13 };
const C_CHO = { 'ㄲ': 1, 'ㄱ': 0, 'ㅃ': 8, 'ㅂ': 7, 'ㅁ': 6, 'ㄴ': 2, 'ㅍ': 17, 'ㅎ': 18 };
const syl = (c, v) => String.fromCharCode(0xAC00 + (C_CHO[c] * 21 + V_JUNG[v]) * 28);
const SHIFT = { 1: 5, 0: 4, 4: 8 }; /* 중성 index: ㅐ→ㅔ, ㅏ→ㅓ, ㅓ→ㅗ — once, never ㅏ→ㅓ→ㅗ */
/* 사랑해 → 서렁헤; returns the text and which character positions changed */
function shiftVowels(text) {
  const chars = Array.from(String(text || '').normalize('NFC')), changed = [];
  const out = chars.map((ch, i) => {
    const code = ch.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return ch;
    const k = code - 0xAC00, jung = Math.floor(k % 588 / 28), to = SHIFT[jung];
    if (to == null) return ch;
    changed.push(i);
    return String.fromCharCode(0xAC00 + Math.floor(k / 588) * 588 + to * 28 + k % 28);
  });
  return { text: out.join(''), chars: out, changed };
}

window.Practice = { STOP_RULES, GROUPS, ITEMS, BY_ID, ORDER, HISS_MEMO, PANT_MEMO, HISS_SEC, PANT_SEC, STEPS, PRON, CUES, CUE_ONE, V, C, syl, shiftVowels };
})();
