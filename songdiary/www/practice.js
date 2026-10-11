/* 노래일기 — 노래 전 루틴 from Singing for the Stars (Seth Riggs), plus the lecture's 발음 찾기, 노래할 때 기억할 것, 멈춤 규칙.
   히싱·개호흡 keep the lecture's numbers; everything else in the routine follows the book. */
(function () {
'use strict';

const STOP_RULES = [
  '목이 긁히거나 따끔하면 그날은 끝',
  '끝난 후 목 상태가 5점 이하면 다음 날은 루틴 ①~③단계만',
  '20~25분 부르면 5~10분 완전히 쉬기, 물 자주 마시기',
  '쉰 목소리·통증이 2주 이상이면 이비인후과(음성 전문) 방문'
];

/* the routine's steps, from Singing for the Stars (Seth Riggs). ②'s 히싱·개호흡 are the user's own items, kept as they were.
   light: still done on a day after a sore throat (멈춤 규칙 2) — the book's warm-ups */
const GROUPS = [
  { k: 'r1', n: '①', no: 1, name: '준비', min: 2, light: true },
  { k: 'r2', n: '②', no: 2, name: '호흡', min: 6, light: true },
  { k: 'r3', n: '③', no: 3, name: '립롤·혀 트릴', min: 6, light: true },
  { k: 'r4', n: '④', no: 4, name: '책 진도', min: 8 },
  { k: 'r5', n: '⑤', no: 5, name: '노래에 적용', min: 5 },
  { k: 'rx', n: '', no: 0, name: '그 밖의 연습', min: 0 }
];

/* routine items as 기초 연습 entries. ph: what each check is, in order ([label, count]); pats: the book exercise for
   each of those checks; book: plays the exercise you are on (책 진도); song: 3부 (27~30번) on your own song */
const ITEMS = [
  { id: 'rs_ready', g: 'r1', name: '자세·긴장 풀기', target: 1, memo: '머리·가슴·골반 한 줄로 · 심호흡·스트레칭 · 조용한 곳' },
  { id: 'rs_lip', g: 'r3', name: '립롤', target: 2, memo: '“어” 입술 떨기로 오르내리기 · 1번 → 3번', ph: [['1번 1.5옥타브', 1], ['3번 도약', 1]], pats: ['b01', 'b03'], keys: true },
  { id: 'rs_trill', g: 'r3', name: '혀 트릴', target: 2, memo: '“어” 혀 떨기로 오르내리기 · 2번 → 4번', ph: [['2번 1.5옥타브', 1], ['4번 도약', 1]], pats: ['b02', 'b04'], keys: true },
  { id: 'rs_book', g: 'r4', name: '책 진도 연습', target: 3, memo: '지금 진도의 연습을 오르내리기 ×3', book: true, keys: true },
  { id: 'rs_song', g: 'r5', name: '연습곡 고음에 적용', target: 4, memo: '막히는 음 한 곳에 27~30번을 하나씩', ph: [['몸 숙이기 (27번)', 1], ['살짝 울먹임 (28번)', 1], ['모음 바꾸기 (29번)', 1], ['키 올려 부르기 (30번)', 1]], song: true }
];
const BY_ID = {};
ITEMS.forEach(d => { BY_ID[d.id] = d; });
/* the order inside 기초 연습; @hiss / @pant are the user's own 히싱 and 개호흡 items */
const ORDER = ['rs_ready', '@hiss', '@pant', 'rs_lip', 'rs_trill', 'rs_book', 'rs_song'];
/* the lecture routine this one replaced: its items are swapped for these when the app opens */
const LEGACY_IDS = ['rt_warm', 'rt_elastic', 'rt_straw', 'rt_siren', 'rt_link', 'rt_pa', 'rt_pb', 'rt_pc', 'rt_thumb', 'rt_oh', 'rt_far', 'rt_hsing', 'rt_rec'];
/* its steps ①~③ (몸 풀기·호흡·빨대 발성): what still counted on a light day back then */
const LEGACY_LIGHT = ['rt_warm', 'rt_elastic', 'rt_straw', 'rt_siren'];
const HISS_MEMO = '“스—” 30~50% 힘으로 ×5', PANT_MEMO = '20초×2 (어지러우면 중단)';
const HISS_SEC = [20, 25, 30, 35], PANT_SEC = 20;
/* 책 진도 starts after the warm-ups (1~4번 are in ③ every day) */
const BOOK_FIRST = 5, BOOK_LAST = 26;

/* the whole routine, for 루틴 안내 (' / ' splits a step into its parts) */
const STEPS = [
  { name: '준비', min: 2, text: '바른 자세: 머리·가슴·골반이 한 줄로, 짝다리·구부정하게 서지 않기 / 심호흡·스트레칭으로 몸과 마음의 긴장 풀기 / 조용한 곳에서, 된다고 믿고' },
  { name: '호흡', min: 6, text: '히싱 “스—” 30~50% 힘으로 ×5 (1주 20초→2주 25초→3주 30초→4주 35초) / 개호흡 20초×2 (어지러우면 중단)' },
  { name: '립롤·혀 트릴', min: 6, text: '립롤: 1번(1.5옥타브) → 3번(도약)을 오르내리기 / 혀 트릴: 2번 → 4번 / 1~4번은 책에서도 계속 쓰는 워밍업이에요' },
  { name: '책 진도', min: 8, text: '지금 진도의 연습을 오르내리기 ×3 (5번부터 26번까지 차례로) / 바르게 되면 ‘해냈어요’ → 다음 번호로 / 성구가 이미 이어지면 12·13번은 건너뛰어도 돼요' },
  { name: '노래에 적용', min: 5, text: '연습곡에서 막히는 음 한 곳을 골라 / 27번 몸 숙이기 → 28번 살짝 울먹임 → 29번 모음 바꾸기 → 30번 키 올려 부르기' }
];

/* 3부 기술 유지: the book's ways to keep speech-level singing inside a song */
const SONG = [
  { no: 27, name: '몸 숙이기', text: '막히는 음에 다가갈 때 몸을 앞으로 숙이고, 그 음이 끝나면 다시 서요. 다가오는 바닥 때문에 ‘올라간다’보다 ‘내려간다’고 느껴져 겁이 줄어요.' },
  { no: 28, name: '살짝 울먹임', text: '소리에 살짝 ‘울먹임’을 넣어 바깥 근육이 끼어들지 않게 해요. 필요 없다는 걸 몸에 잠깐 상기시키는 용도로만.' },
  { no: 29, name: '모음 바꾸기', text: '그 음의 모음이 낮은 음역에 묶여 안 올라가면, 아래 표의 다른 모음으로 그 음을 시작했다가 같은 자리에서 원래 모음으로 바꿔요.' },
  { no: 30, name: '키 올려 부르기', text: '노래를 원래보다 높게 옮겨 불러요. 한 음역에 갇히지 않게, 문제없는 노래도 가끔 확인용으로.' }
];
/* 29번: if the problem vowel is … try … */
const VOWEL_SUB = [
  ['에이 (may)', '이 (we)'], ['애 (cat)', '에 (let)'], ['에 (let)', '짧은 이 (sit)'], ['짧은 이 (sit)', '이 (we)'],
  ['아 (father)', '어 (mother)'], ['어 (mother)', '짧은 우 (foot)'], ['짧은 우 (foot)', '우 (toot)']
];
/* 실전 연습 전 주의 사항 and the author's answers */
const CAUTIONS = [
  '말하는 높이(스피치 레벨)를 잃거나, 흉성-두성 연결이 끊기거나, 힘들고 애쓰는 느낌이 들면 그 연습은 바로 멈추기',
  '목이 조금이라도 상하는 느낌이면 계속하지 말고 병원부터',
  '피아노 끝까지 올라갈 필요 없어요. 꼭대기 음은 편하게 이어지는 데까지만',
  '크게 부르지 않기: 가장 커도 중간 세기(메조포르테), 고른 비브라토가 유지되는 만큼만',
  '한 연습이 바르게 될 때까지 하고 다음으로. 빠르게는 보통 빠르기에서 한 음씩 깨끗해진 다음에',
  '감기·피로처럼 몸이 안 좋은 날은 쉬기. 노래 전엔 먹지 않기, 헛기침·센 기침 피하기'
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

window.Practice = { STOP_RULES, GROUPS, ITEMS, BY_ID, ORDER, LEGACY_IDS, LEGACY_LIGHT, HISS_MEMO, PANT_MEMO, HISS_SEC, PANT_SEC, BOOK_FIRST, BOOK_LAST, STEPS, SONG, VOWEL_SUB, CAUTIONS, PRON, CUES, CUE_ONE, V, C, syl, shiftVowels };
})();
