/* 노래일기 — scale practice: the exercises vocal teachers use, note names, and pitch detection for '내 음 보기' */
(function () {
'use strict';

/* steps are semitones above the note you pressed, which counts as 도 (movable do) */
const PRESETS = [
  { id: 'five', name: '5음 스케일', steps: [0, 2, 4, 5, 7, 5, 4, 2, 0] },
  { id: 'three', name: '3음 스케일', steps: [0, 2, 4, 2, 0] },
  { id: 'down5', name: '내려오는 5음', steps: [7, 5, 4, 2, 0] },
  { id: 'arp', name: '아르페지오', steps: [0, 4, 7, 4, 0] },
  { id: 'octarp', name: '옥타브 아르페지오', steps: [0, 4, 7, 12, 7, 4, 0] },
  { id: 'octrep', name: '옥타브 반복', steps: [0, 4, 7, 12, 12, 12, 12, 12, 7, 4, 0] },
  { id: 'nine', name: '9음 스케일', steps: [0, 2, 4, 5, 7, 9, 11, 12, 14, 12, 11, 9, 7, 5, 4, 2, 0] },
  { id: 'octjump', name: '옥타브 점프', steps: [0, 12, 0] },
  { id: 'minor', name: '단조 5음', steps: [0, 2, 3, 5, 7, 5, 3, 2, 0] }
];
/* ---------- Singing for the Stars (Seth Riggs): every scale in exercises 1~26 ----------
   The book writes each exercise from C (= 도) and only goes up a semitone at a time; going back down is ours.
   d: length of each note in beats (a quarter note = 1 beat, 3/4 time), tie: notes held on from the one before
   (the vowel changes, the piano doesn't strike again), st: short, detached notes, glide: one sliding tone.
   v: what is sung, as [mark, 한글, book]. start: where the book starts it — low / mid / high (the break) */
const ONE5 = [0, 4, 7, 12, 16, 19, 17, 14, 11, 7, 5, 2, 0]; /* 도미솔도미솔 파레시솔파레도 */
const JUMP = [0, 7, 4, 12, 7, 4, 0]; /* 도솔미도솔미도 */
const JUMP2 = JUMP.concat([7, 4, 12, 7, 4, 0]);
const NAY = [0, 4, 7, 12, 12, 12, 12, 7, 4, 0]; /* 도미솔 도도도 도솔미 도 */
const LONG = [0, 4, 7, 12, 12, 7, 4, 0]; /* 도미솔 도(길게)… 도솔미 도 */
const beats = (n, b, last = 3) => Array(n).fill(b).concat(last);
const EIGHTHS12 = beats(12, 0.5), QUARTERS12 = beats(12, 1);
const CRY = [['a', '멈', 'mum'], ['b', '거', 'guh'], ['c', '고', 'go'], ['d', '기', 'gee'], ['e', '쿠', 'koo']];
const VOW5 = [['a', '우', 'Oo'], ['b', '오', 'Oh'], ['c', '어', 'Uh'], ['d', '이', 'Ee'], ['e', '아', 'Ah']];
const WEE = [['a', '위', 'Wee'], ['b', '기', 'Gee']];
const MM = [['', '음 (입 다물고)', 'Mm']];
/* the book's 'Approximate starting pitch' for a tenor, as the 도 of the first round (MIDI: 48 = 1옥 도 C3).
   12·21·25 are written 8va (an octave lower than sung); 14 has none printed: just below the break */
const TENOR = { 1: 48, 2: 48, 3: 48, 4: 48, 5: 55, 6: 48, 7: 55, 8: 48, 9: 48, 10: 55, 11: 55, 12: 56, 13: 48,
  14: 60, 15: 48, 16: 48, 17: 48, 18: 48, 19: 55, 20: 55, 21: 56, 22: 55, 23: 55, 24: 55, 25: 67, 26: 48 };
const BOOK = [
  { no: 1, name: '립롤', sound: '입술 떨기 “어”', steps: ONE5, d: EIGHTHS12, start: 'low',
    how: '손끝으로 볼을 입술 쪽으로 살짝 받치고, “어(UH)” 소리로 입술을 느슨하고 고르게 떨어요.',
    text: ['공기가 일하게 두고 입술·얼굴·목은 힘을 빼요. 입술 떨림이 느릴수록 좋아요.', '처음엔 음정보다 이완과, 소리가 갑자기 가벼워지며 끊기지 않는 게 중요해요.', '낮은 음은 입 앞으로, 높아질수록 소리가 연구개 뒤로 옮겨 가는 느낌이 나요.'] },
  { no: 2, name: '혀 트릴', sound: '혀 떨기 “어”', steps: ONE5, d: EIGHTHS12, start: 'low',
    how: '혀를 가볍게 떨면서 1번과 같은 “어” 소리로 해요. 음은 1번과 같아요.',
    text: ['두성으로 올라가도 소리가 이어지게 하는 게 목표예요.'] },
  { no: 3, name: '립롤 도약', sound: '입술 떨기 “어”', steps: JUMP, d: beats(6, 0.5), start: 'low',
    how: '1번과 같은 방법인데 음 사이가 더 넓어요. 바깥 근육이 더 놓아 줘야 해요.',
    text: ['음과 음 사이를 미끄러지지 말고 한 음씩 깨끗하게 내요.', '높은 음으로 갈 때는 같은 음이나 더 낮은 음을 내듯 다가가면 뻗지 않게 돼요.'] },
  { no: 4, name: '혀 트릴 도약', sound: '혀 떨기 “어”', steps: JUMP, d: beats(6, 0.5), start: 'low',
    how: '2번과 같은 방법(혀 트릴)이고 음과 리듬만 달라요.', text: [] },
  { no: 5, name: '네이', sound: '“네이”', v: [['', '네이', 'nay']], steps: NAY, d: beats(9, 1), start: 'mid',
    how: '“네이”를 코로 밀어 넣지 마세요. ㄴ만으로도 충분히 콧소리가 나요. 흉성으로 뻗어 올리지 않기.',
    text: ['높은 후두 연습: 후두를 끌어올려 성대가 얇아지는 느낌을 잠깐 경험하는 도구예요. 노래할 때 이렇게 하라는 게 아니에요.'] },
  { no: 6, name: '네이 1.5옥', sound: '“네이”', v: [['', '네이', 'nay']], steps: ONE5, d: EIGHTHS12, start: 'low',
    how: '5번과 같은 방법이고 음과 리듬만 달라요.', text: [] },
  { no: 7, name: '울먹임 멈·거', sound: '살짝 울먹이며', v: CRY, steps: NAY, d: beats(9, 1), start: 'mid',
    how: '소리에 살짝 ‘울먹임’을 넣어요 (지나치지 않게). 높아질수록 후두가 올라가려는 걸 막아 줘요.',
    text: ['(a) 멈: 연구개를 편히 두고, 높아질수록 소리가 그 뒤로 가게. 높아져도 ‘맘’이 되지 않게 ‘멈’을 지켜요.', '(b)~(e) 거·고·기·쿠는 혀가 움직여서 더 어려워요. (a)만큼 높이 말고 편한 데까지만.', '2부에 가면 이 울먹임(후두 내리기)은 버려요. 후두는 억지로 올리지도 내리지도 않아요.'] },
  { no: 8, name: '울먹임 1.5옥', sound: '살짝 울먹이며', v: CRY, steps: ONE5, d: EIGHTHS12, start: 'low',
    how: '7번과 같은 방법이고 음과 리듬만 달라요.', text: [] },
  { no: 9, name: '후~ 모음', sound: '후두를 살짝 내린 채', v: VOW5, steps: ONE5, d: EIGHTHS12, start: 'low',
    how: '후두를 살짝 내린 채로, 높아질수록 더 ‘후~’ 하고 빈 소리로 (붙잡지 않게).',
    text: ['높은 음이 숨 섞이거나 약해도 괜찮아요. 처음부터 끝까지 이어지는 게 중요해요.', '모음은 말할 때처럼 발음해요. ‘오’는 ‘우’ 입술로 부른다고 생각하면 퍼지지 않아요.', '높은 데서는 턱을 아주 살짝 내려 공간을 줘요. 턱으로 붙잡지는 말기.'] },
  { no: 10, name: '후~ 길게', sound: '후두를 살짝 내린 채', v: VOW5, steps: [0, 4, 7, 12, 7, 4, 0], d: [1, 1, 1, 4, 1, 1, 3], start: 'mid',
    how: '9번과 같은 방법이고 음과 리듬만 달라요. 꼭대기 음을 길게.', text: [] },
  { no: 11, name: '후~ 도약', sound: '여전히 숨 섞인 소리', v: VOW5, steps: JUMP2, d: EIGHTHS12, start: 'mid',
    how: '넓은 도약은 한 음의 압력을 놓아야 성대가 다음 음에 다시 맞출 수 있어서예요.',
    text: ['너무 놓아서 가성으로 끊기지는 않게, 흉성을 두성으로 계속 이어요.', '5~11번은 성구 사이가 이어지면 그만해요. 계속 쓰면 후두가 한쪽 자세로 굳어요. 1~4번은 계속 워밍업으로 써요.'] },
  { no: 12, name: '가성 → 흉성', sound: '가성으로 시작', v: WEE, steps: [12, 7, 4, 0], d: [1, 1, 1, 3], start: 'high',
    how: '가성으로 시작해 흉성으로 내려올 때 최대한 부드럽게, 떨어지듯 들어가지 않게.',
    text: ['할 때마다 흉성을 조금 더 단단히 들여요. 흉성이 들어오는 느낌에 당황하지 말고 가볍게, 움켜쥐지 않게.', '(b) ‘기’는 혀 때문에 ‘위’만큼 높이 시작하기 어려워요.', '책에서는 반음씩 내려가며 해요. 이미 성구가 이어지면 12·13번은 건너뛰어도 돼요.'] },
  { no: 13, name: '흉성 ↔ 두성', sound: '흉성에서 시작', v: WEE, steps: ONE5, d: EIGHTHS12, start: 'low',
    how: '흉성으로 시작해 두성으로 갔다가 다시 흉성으로 와요. ‘기’는 ‘위’만큼 높이 가지 않기.',
    text: ['머리↔가슴이 매끄럽게 넘어가면 5~11번을 다시 해 봐도 좋아요.'] },
  { no: 14, name: '삐걱 문 소리', sound: '“음~” 엣지 소리', v: MM, steps: [0, 7, 0], d: [1.5, 1.5, 2], glide: true, start: 'high',
    how: '성구 전환 바로 아래 흉성에서, 입을 다물고 삐걱이는 문 소리처럼 “음~” 하며 두성으로 꺾어 올려요.',
    text: ['스피치 레벨 소리가 어디서 나는지 처음 느껴 보는 연습이에요.', '가성으로 끊기지 않게 이어요. 책은 올리기만 하고, 앱에서는 다시 내려와요.'] },
  { no: 15, name: '엣지 끊어서', sound: '“음~” + 살짝 울먹임', v: MM, steps: ONE5, d: QUARTERS12, st: [1, 2, 4, 5, 7, 8, 10, 11], start: 'low',
    how: '14번의 엣지 소리로 더 낮게 시작하고, 살짝 ‘훌쩍임·울먹임’을 넣어요 (과하지 않게).',
    text: ['공기를 과하게 누르지 말고 연결이 유지될 만큼만. 많다고 좋은 게 아니에요.', '끊었다 다시 내는 건 매번 스피치 레벨에서 소리를 다시 잡기 위해서예요.', '턱 밑 근육을 손가락으로 만져 보세요. 음을 끄는 동안 늘 말랑해야 해요.'] },
  { no: 16, name: '엣지 덜 끊어서', sound: '“음~” 엣지 소리', v: MM, steps: ONE5, d: QUARTERS12, st: [2, 5, 8, 11], start: 'low',
    how: '15번과 같은데 소리를 끊는 횟수만 줄여요.', text: [] },
  { no: 17, name: '엣지 이어서', sound: '“음~” 엣지 소리', v: MM, steps: ONE5, d: QUARTERS12, start: 'low',
    how: '엣지 소리를 처음에만 잡고 끝까지 쭉 이어요.',
    text: ['공기 압력이 쌓이면 안 돼요. 올라갈 때나 내려올 때나 고르게. 쌓이면 소리가 걸리고 짜게 돼요.', '성대 안쪽 가장자리만 조금 쓰는 느낌. 잘 되면 공기와 성대를 조금씩 더 써도 돼요.', '턱 밑을 손가락으로 계속 확인해요 (삼키는 근육이 조이지 않게).'] },
  { no: 18, name: '꼭대기 끌기', sound: '“음~” 엣지 조금 덜', v: MM, steps: ONE5, d: QUARTERS12.map((b, i) => (i === 5 ? 3 : b)), start: 'low',
    how: '엣지 소리를 조금 덜 쓰면서 꼭대기 음을 길게 끌어요.',
    text: ['꼭대기에서 자연스러운 비브라토를 막지 마세요. 성대 긴장이나 숨 압력이 과하면 꽉 낀 직선 소리가 나요.'] },
  { no: 19, name: '엣지 빼기', sound: '“음~” 공기 조금 더', v: MM, steps: JUMP2, d: QUARTERS12, start: 'mid',
    how: '이제 엣지 소리를 빼 가요. 할 때마다 엣지 대신 공기를 조금 더 넣어 성대를 풀어요.',
    text: ['소리가 끊기지 않게 해요. 성대가 풀린 느낌이 들면 20번으로.'] },
  { no: 20, name: '음 → 모음', sound: '“음~” 끌다가 모음으로', v: [['a', '음 → 우', 'Mm → Oo'], ['b', '음 → 오', 'Mm → Oh'], ['c', '음 → 어', 'Mm → Uh'], ['d', '음 → 이', 'Mm → Ee'], ['e', '음 → 아', 'Mm → Ah']], steps: LONG, d: [1, 1, 1, 3, 4, 1, 1, 3], tie: [4], start: 'mid',
    how: '연결에 필요한 만큼만 엣지를 쓰고, 꼭대기 음을 끄는 동안 입술을 살짝 열어 모음으로 바꿔요.',
    text: ['모음에서 목이 조이면 공기를 더 밀지 말고 소리를 조금 숨 섞이게 해서 성대를 풀어요 (연결은 끊기지 않게).', '턱 밑 근육을 확인해요. 모음마다 쉬운 정도가 달라도 괜찮아요. 스피치 레벨을 ‘집’으로 삼아요.'] },
  { no: 21, name: '모음으로 시작', sound: '모음으로 바로', v: VOW5, steps: [12, 7, 4, 0, 4, 7, 12, 7, 4, 0, 4, 7, 12, 7, 4, 0], d: beats(12, 1, 4).concat([1, 1, 3]), start: 'high',
    how: '모음으로 시작하고, 연결에 필요한 만큼만 엣지를 남겨요.',
    text: ['높아져도 모음이 바뀌거나 퍼지지 않게.', '스피치 레벨이면 높은 음은 낮은 음보다 부드럽고 덜 세게 느껴져요. 듣는 사람에겐 자유롭고 맑게 들려요.'] },
  { no: 22, name: '엣지 없이 도약', sound: '엣지 소리 없이', v: VOW5, steps: JUMP2, d: EIGHTHS12, start: 'mid',
    how: '처음에 연결을 이끌어 준 엣지 소리가 완전히 없어질 때까지 해요.',
    text: ['찡그리기, 턱 들기 같은 불필요한 얼굴·몸 움직임이 있는지도 살펴요.'] },
  { no: 23, name: '모음 바꾸기 둘', sound: '한 음에서 모음 2개', v: [['a', '우 → 오', 'Oo → Oh'], ['b', '어 → 아', 'Uh → Ah'], ['c', '이 → 에이', 'Ee → Ay'], ['d', '오 → 아', 'Oh → Ah']], steps: LONG, d: [1, 1, 1, 3, 4, 1, 1, 3], tie: [4], start: 'mid',
    how: '한 음을 끄는 동안 모음이 바뀌어도 스피치 레벨을 지켜요. 모음을 과하게 만들지 않기.',
    text: ['두 번째 모음도 입 안 모양은 첫 모음 그대로, 혀와 입술만 살짝 움직여 발음을 바꿔요.'] },
  { no: 24, name: '모음 바꾸기 셋', sound: '한 음에서 모음 3개', v: [['a', '우 → 오 → 아', 'Oo → Oh → Ah'], ['b', '이 → 우 → 어', 'Ee → Oo → Uh'], ['c', '우(풋) → 어 → 아', 'Oo(foot) → Uh → Ah']], steps: [0, 4, 7, 12, 12, 12, 7, 4, 0], d: [1, 1, 1, 3, 3, 4, 1, 1, 3], tie: [4, 5], start: 'mid',
    how: '23번과 같은 생각이고 모음 수만 늘었어요.', text: [] },
  { no: 25, name: '전환 지점에서', sound: '한 음에서 모음 2개', v: [['a', '우 → 어', 'Oo → Uh'], ['b', '우 → 오', 'Oo → Oh'], ['c', '이 → 에이', 'Ee → Ay']], steps: [0, 0, -1, -1, -2, -2], d: [3, 3, 3, 3, 3, 3], tie: [1, 3, 5], start: 'high',
    how: '첫 성구 전환(가장 잘 끊기는 곳) 한가운데에서 시작해요. 시작하기 가장 어려운 자리예요.',
    text: ['소리가 반은 입에, 반은 연구개 뒤에 울리는 걸 받아들여요.', '더 ‘머리’ 쪽으로, 성대를 얇게 써서 시작하고 흉성은 조금씩 들어오게. 갑자기 흉성으로 떨어지지 않게.', '턱 밑이 조금 움직여도 괜찮아요. 익숙해지면 풀려요. 책은 한 번에 반음씩 내려가요.'] },
  { no: 26, name: '모음 하나씩', sound: '모음마다 음역 전체', v: [['a', '아', 'Ah'], ['b', '에이', 'Ay'], ['c', '이', 'Ee'], ['d', '오', 'Oh'], ['e', '애', 'A'], ['f', '우', 'Oo'], ['g', '우(풋)', 'Oo(foot)']], steps: ONE5, d: EIGHTHS12, start: 'low',
    how: '모음 하나씩 음역 전체를 오르내리며, 가장 적은 힘으로 가장 많은 소리가 날 때까지 해요.',
    text: ['말할 때와 똑같이 발음해요. 목이나 입에서 아무것도 달라지면 안 돼요. 그래야 스피치 레벨이에요.'] }
].map(b => Object.assign({ id: 'b' + String(b.no).padStart(2, '0'), part: b.no <= 13 ? 1 : 2, t: TENOR[b.no] }, b));
const PARTS = [
  { no: 1, name: '1부 자신감 쌓기', range: '1~13번', text: '흉성에서 두성까지 끊기지 않고 이어지는 걸 경험해요. 1~4번은 워밍업으로 계속 쓰고, 5~11번은 연결되면 그만, 12·13번은 연결이 안 될 때만.' },
  { no: 2, name: '2부 스피치 레벨', range: '14~26번', text: '작은 ‘엣지’ 소리로 말하는 높이(스피치 레벨)에서 소리를 잡고, 엣지를 빼 가며 모음으로 옮겨요.' },
  { no: 3, name: '3부 노래에 적용', range: '27~30번', text: '연습곡에서 막히는 음에 숙이기·울먹임·모음 바꾸기·키 올리기를 써요.' }
];
const START = {
  low: '낮은 음에서 시작해요',
  mid: '중간 음에서 시작해요',
  high: '성구 전환(목소리가 바뀌는 곳) 근처에서 시작해요'
};
const SOLFA = ['도', '도#', '레', '미♭', '미', '파', '파#', '솔', '솔#', '라', '시♭', '시'];
/* a step as sung from 도: 0 → 도, 7 → 솔, 12 → 높은도, -1 → 낮은시 */
function degName(off) {
  const pc = ((off % 12) + 12) % 12, oct = Math.floor(off / 12);
  return (oct > 0 ? '높은' : oct < 0 ? '낮은' : '') + SOLFA[pc];
}
/* the buttons for building your own exercise */
const BUILD_KEYS = [-5, -3, -1, 0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19];

/* ---------- pitch detection (YIN) for the singer's voice ---------- */
/* buf: Float32Array of samples; returns frequency in Hz, or null for silence / no clear pitch */
function detectPitch(buf, sr, minF = 60, maxF = 1400) {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.012) return null;
  const maxLag = Math.min(Math.floor(sr / minF), buf.length >> 1), minLag = Math.max(2, Math.floor(sr / maxF));
  const W = buf.length - maxLag - 1;
  const d = new Float32Array(maxLag + 2);
  for (let tau = 1; tau <= maxLag + 1; tau++) {
    let s = 0;
    for (let j = 0; j < W; j++) { const x = buf[j] - buf[j + tau]; s += x * x; }
    d[tau] = s;
  }
  /* cumulative mean normalised difference */
  let run = 0;
  d[0] = 1;
  for (let tau = 1; tau <= maxLag + 1; tau++) { run += d[tau]; d[tau] = run ? d[tau] * tau / run : 1; }
  let tau = -1;
  for (let t = minLag; t <= maxLag; t++) {
    if (d[t] < 0.15) { while (t + 1 <= maxLag && d[t + 1] < d[t]) t++; tau = t; break; }
  }
  if (tau < 0) return null;
  const x0 = d[tau - 1], x1 = d[tau], x2 = d[tau + 1];
  const den = x0 + x2 - 2 * x1;
  const t = den ? tau + (x0 - x2) / (2 * den) : tau;
  return sr / t;
}
const midiOf = f => 69 + 12 * Math.log2(f / 440);

window.ScaleKit = { PRESETS, BOOK, PARTS, START, SOLFA, degName, BUILD_KEYS, detectPitch, midiOf };
})();
