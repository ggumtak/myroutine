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
  { k: 'r3', n: '③', no: 3, name: '입술 떨기·혀 굴리기', min: 6, light: true },
  { k: 'r4', n: '④', no: 4, name: '단계 연습', min: 8 },
  { k: 'r5', n: '⑤', no: 5, name: '노래에 적용', min: 5 },
  { k: 'rx', n: '', no: 0, name: '그 밖의 연습', min: 0 }
];

/* routine items as 기초 연습 entries. ph: what each check is, in order ([label, count]); pats: the book exercise for
   each of those checks; book: plays the exercise you are on (책 진도); song: 3부 (27~30번) on your own song */
const ITEMS = [
  { id: 'rs_ready', g: 'r1', name: '자세·긴장 풀기', target: 1, memo: '머리·가슴·골반 한 줄로 · 심호흡·스트레칭 · 조용한 곳' },
  { id: 'rs_lip', g: 'r3', name: '입술 떨기 (립롤)', target: 2, memo: '“어~” 하며 입술 부르르 · 1번 → 3번', ph: [['1번 1옥타브 반', 1], ['3번 크게 뛰기', 1]], pats: ['b01', 'b03'], keys: true },
  { id: 'rs_trill', g: 'r3', name: '혀 굴리기 (트릴)', target: 2, memo: '“드르르” 혀 떨며 “어~” · 2번 → 4번', ph: [['2번 1옥타브 반', 1], ['4번 크게 뛰기', 1]], pats: ['b02', 'b04'], keys: true },
  { id: 'rs_book', g: 'r4', name: '오늘의 단계 연습', target: 3, memo: '앱이 골라 준 연습 1개를 피아노 따라 오르내리기 ×3', book: true, keys: true },
  { id: 'rs_song', g: 'r5', name: '연습곡 고음에 적용', target: 4, memo: '노래에서 막히는 음 한 곳에 4가지 방법을 하나씩', ph: [['몸 숙이기 (27번)', 1], ['살짝 울먹이기 (28번)', 1], ['모음 바꾸기 (29번)', 1], ['키 올려 부르기 (30번)', 1]], song: true }
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
/* 단계 연습 (the book's exercises one after another) starts after the warm-ups (1~4번 are in ③ every day) */
const BOOK_FIRST = 5, BOOK_LAST = 26;

/* the whole routine, for 루틴 안내 (' / ' splits a step into its parts); why: what the step is for */
const STEPS = [
  { name: '준비', min: 2, text: '바르게 서기: 머리·가슴·골반이 한 줄로, 짝다리·구부정 X / 숨을 크게 세 번 / 목·어깨 천천히 돌리기', why: '몸에 힘이 들어가 있으면 그 힘이 목으로 가요. 긴장을 풀고 시작해야 나머지 연습이 제대로 돼요.' },
  { name: '호흡', min: 6, text: '히싱 “스—” 30~50% 힘으로 ×5 (1주 20초→2주 25초→3주 30초→4주 35초) / 개호흡 20초×2 (어지러우면 중단)', why: '숨을 고르고 길게 내보내는 힘을 길러요. 원래 하던 그대로예요.' },
  { name: '입술 떨기·혀 굴리기', min: 6, text: '입술 떨기(립롤): 1번 → 3번 / 혀 굴리기(트릴): 2번 → 4번 / 피아노가 반음씩 올라갔다 내려와요', why: '목에 힘을 안 주고 낮은 음부터 높은 음까지 이어 부르는 몸풀기예요. 책에서도 매일 하라고 해요.' },
  { name: '단계 연습', min: 8, text: '앱이 골라 준 연습 1개를 피아노 따라 ×3 / 편해지면 ‘이제 잘 돼요’ → 다음 연습으로', why: '책의 5~26번을 쉬운 것부터 하나씩 익혀요. 매일 하나만 하면 돼요.' },
  { name: '노래에 적용', min: 5, text: '연습곡에서 막히는 음 한 곳 / 몸 숙이기 → 살짝 울먹이기 → 모음 바꾸기 → 키 올려 부르기 (책 27~30번)', why: '연습에서 익힌 걸 실제 노래에 옮겨요.' }
];
/* how to practise, in plain words (루틴 안내 맨 위, 따라 하기 첫 화면) */
const PLAN = [
  '매일 같은 순서로 5단계, 약 27분이에요. ‘오늘 연습 따라 하기’를 누르면 한 단계씩 화면이 안내해요.',
  '책에는 1~30번이 있지만 매일 다 하지 않아요. 매일 하는 건 ① 몸풀기 1~4번, ② 앱이 골라 주는 단계 연습 1개, ③ 노래에 적용(27~30번)이에요.',
  '단계 연습은 5번부터 26번까지 쉬운 것부터 하나씩이에요. 지금 연습이 편해지면(목에 힘 안 들어가고, 처음부터 끝까지 소리가 안 끊기면) ‘이제 잘 돼요’를 눌러 다음 번호로 넘어가요. 하루 만에 넘어가도, 1~2주 걸려도 괜찮아요.',
  '5~13번은 가슴소리와 머리소리가 “이어지는 느낌”을 익히는 연습이에요. 이미 고음이 끊기거나 뒤집히지 않고 이어지면 ‘14번부터 하기’로 건너뛰어도 돼요.',
  '힘들거나 목이 조금이라도 아프면 바로 멈춰요. 크게 부를 필요 없어요.'
];
/* 단계 연습 in groups, so it's clear where you are */
const STAGES = [
  { from: 5, to: 11, name: '이어지는 느낌 익히기', text: '가슴소리→머리소리가 끊기지 않게 잇는 느낌을 처음 배워요' },
  { from: 12, to: 13, name: '가성으로 길 내기', text: '그래도 안 이어질 때만 해요. 이어지면 건너뛰어요' },
  { from: 14, to: 18, name: '“끼익” 소리로 말하는 높이 찾기', text: '작은 끼익 소리로, 말할 때처럼 편한 목으로 높이 가는 법을 익혀요' },
  { from: 19, to: 22, name: '끼익 빼고 진짜 소리로', text: '도움 소리를 빼고 실제 모음으로 불러요' },
  { from: 23, to: 26, name: '모음 바꾸며 다듬기', text: '가사처럼 모음이 바뀌어도 흔들리지 않게 다듬어요' }
];

/* 3부 기술 유지: the book's ways to keep speech-level singing inside a song */
const SONG = [
  { no: 27, name: '몸 숙이기', good: '고음이 무서워서 몸이 미리 굳는 걸 풀어 줘요', text: '막히는 음에 다가갈 때 몸을 앞으로 숙이고, 그 음이 끝나면 다시 서요. 다가오는 바닥 때문에 ‘올라간다’보다 ‘내려간다’고 느껴져 겁이 줄어요.' },
  { no: 28, name: '살짝 울먹이기', good: '목이 조이기 시작할 때 다시 편한 자리로 돌려놔요', text: '소리에 살짝 ‘울먹임’을 넣어 바깥 근육이 끼어들지 않게 해요. 필요 없다는 걸 몸에 잠깐 상기시키는 용도로만.' },
  { no: 29, name: '모음 바꾸기', good: '특정 모음에서만 막히는 음을 뚫어 줘요', text: '그 음의 모음이 낮은 음역에 묶여 안 올라가면, 아래 표의 다른 모음으로 그 음을 시작했다가 같은 자리에서 원래 모음으로 바꿔요.' },
  { no: 30, name: '키 올려 부르기', good: '한 음역에 갇히지 않게 하고, 원래 키를 더 편하게 만들어 줘요', text: '노래를 원래보다 높게 옮겨 불러요. 한 음역에 갇히지 않게, 문제없는 노래도 가끔 확인용으로.' }
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

window.Practice = { STOP_RULES, GROUPS, ITEMS, BY_ID, ORDER, LEGACY_IDS, LEGACY_LIGHT, HISS_MEMO, PANT_MEMO, HISS_SEC, PANT_SEC, BOOK_FIRST, BOOK_LAST, STEPS, PLAN, STAGES, SONG, VOWEL_SUB, CAUTIONS, PRON, CUES, CUE_ONE, V, C, syl, shiftVowels };
})();
