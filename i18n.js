/* =========================================================================
   Cube Arena — KO / EN switch
   The app is written in Korean first; this file turns that UI into English
   in place (text nodes + a few attributes) and back again, and keeps doing
   it for anything the app renders later. Language is kept in localStorage,
   and ?lang=en / ?lang=ko on the URL wins for shared links.
   ========================================================================= */
(function (global) {
  'use strict';

  const LS_KEY = 'cubeArena.lang';
  const HANG = /[\uac00-\ud7a3]/;
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const TITLE = {
    ko: 'Cube Arena — 큐브 타이머 · 프렌드 배틀',
    en: 'Cube Arena — Cube timer & friend battles'
  };
  const DESC = {
    ko: 'WCA 18종목 스크램블, 스택매트 타이머, 프렌드 배틀, 클락 미니게임. 브라우저에서 바로 즐기는 큐브 아케이드.',
    en: 'Scrambles for all 18 WCA events, a stackmat timer, friend battles and clock mini-games. A cube arcade that runs right in your browser.'
  };

  /* ------------------------------------------------------------- exact -- */
  const KO = {
    /* chrome */
    '타이머': 'Timer',
    '배틀': 'Battle',
    '게임': 'Games',
    '기록': 'Stats',
    '기록 ': 'Solves',
    '솔브': 'Solves',
    '미리보기': 'Preview',
    '🔄 새 스크램블': '🔄 New scramble',
    '새 스크램블': 'New scramble',
    '스크램블 준비 중…': 'Preparing scramble…',
    '길게 눌러 초록불 → 떼면 시작': 'Hold for green → release to start',
    '기록을 만들면 등급이 올라가요': 'Set a time to rank up',
    '기록 추이': 'Progress',
    '싱글': 'Single',
    '오늘의 퀘스트': 'Today’s quests',
    '초기화': 'Reset',
    '이 종목은 티어 기준이 없어요': 'No tier scale for this event',
    '최고 티어 · World Class 🏅': 'Top tier · World Class 🏅',
    '솔브가 2개 이상이면 추이가 그려집니다': 'The chart appears from 2 solves on',
    '유효 기록이 없어요': 'No valid times yet',
    '스플릿 측정 꺼짐 · Cross / F2L / OLL / PLL 구간 기록': 'Splits off · record Cross / F2L / OLL / PLL segments',
    '켜기': 'Turn on',
    '스플릿 모드 ON · 풀면서 화면을 탭하면 구간이 나뉩니다': 'Splits ON · tap the screen while solving to split segments',
    '받기': 'Claim',
    '완료': 'Done',

    /* battle */
    '🤝 프렌드 배틀': '🤝 Friend battle',
    '서버 없이 링크로': 'No server, just a link',
    '종목': 'Event',
    '내 닉네임': 'Your nickname',
    '상대': 'Opponent',
    '실제 친구 (링크 공유)': 'Real friend (share a link)',
    'AI 라이벌 · Challenger': 'AI rival · Challenger',
    'AI 라이벌 · Pro': 'AI rival · Pro',
    'AI 라이벌 · Master': 'AI rival · Master',
    'AI 라이벌 · Grandmaster': 'AI rival · Grandmaster',
    '상대 닉네임': 'Opponent’s name',
    '(선택)': '(optional)',
    '배틀 링크 만들기': 'Create battle link',
    '바로 도전 (5라운드)': 'Quick start (5 rounds)',
    '참가': 'Join',
    '초대 링크가 만들어졌어요': 'Your invite link is ready',
    '아래 링크를 카카오톡·디스코드에 붙여 보내세요. 친구는 같은 5개 스크램블로 도전합니다.': 'Paste the link into KakaoTalk, Discord or WhatsApp. Your friend gets the same 5 scrambles.',
    '링크 복사': 'Copy link',
    '공유 문구 복사': 'Copy share text',
    '내가 먼저 도전': 'I’ll go first',
    '라운드 1 / 5': 'Round 1 / 5',
    '라운드': 'Rounds',
    '🔗 초대 링크 복사': '🔗 Copy invite link',
    '배틀 나가기': 'Leave battle',
    '🎉 배틀 완료!': '🎉 Battle complete!',
    '결과 링크 복사': 'Copy result link',
    '결과 카드 저장 (PNG)': 'Save result card (PNG)',
    '새 배틀 만들기': 'New battle',
    '공개 중계 · 계정 없음': 'Public relay · no account',
    '🟢 실시간 연결됨': '🟢 Live',
    '🟡 연결 중...': '🟡 Connecting…',
    '⚪ 오프라인(링크 공유)': '⚪ Offline (share a link)',
    '🏆 배틀 리더보드': '🏆 Battle leaderboard',
    '친구 결과 불러오기': 'Load friend’s result',
    '불러오기': 'Load',
    '↺ 새 배틀': '↺ New battle',
    '플레이어': 'Player',
    '대기 중...': 'Waiting...',
    '대기 중': 'Waiting',
    '아직 기록이 없어요': 'No times yet',
    '아직 기록이 없어요 · 타이머에서 첫 솔브를!': 'No times yet · go get your first solve!',
    '친구': 'Friend',
    '기록 없음': 'No times',
    '배틀 완료! 결과 링크를 친구에게 보내보세요': 'Battle complete! Send the result link to your friend',
    '배틀 완료': 'Battle finished',
    '초대 링크를 복사했어요': 'Invite link copied',
    '초대 링크를 복사했어요 · 친구에게 붙여넣기': 'Invite link copied · paste it to your friend',
    '결과 링크를 복사했어요': 'Result link copied',
    '공유 문구를 복사했어요 · 카톡에 붙여넣기': 'Share text copied · paste it in your chat',
    'AI 라이벌을 리더보드에 올렸어요 · 링크로 친구도 부를 수 있어요': 'AI rival added to the leaderboard · the link can invite a friend too',
    '초대 링크를 만들었어요': 'Invite link created',
    '친구의 결과를 불러왔어요': 'Loaded your friend’s result',
    '친구 기록에 도전! 라운드 1부터 시작해요': 'Challenging your friend! Starting at round 1',
    '친구 결과를 리더보드에 올렸어요': 'Friend’s result added to the leaderboard',
    '링크 형식이 아니에요': 'That is not a valid link',
    '결과 링크가 아니에요': 'That is not a result link',
    '링크를 읽을 수 없어요': 'Could not read that link',
    '복사가 안 되면 길게 눌러 직접 복사하세요': 'If copying fails, long-press and copy it yourself',
    '내가': 'me',
    '+2 페널티': '+2 penalty',
    'DNF 처리': 'Mark DNF',
    '기록 삭제': 'Delete solve',

    /* games */
    '⏰ 클락 시뮬레이터': '⏰ Clock simulator',
    '타임어택': 'Time attack',
    '0수': '0 moves',
    '뒤집기 y2': 'Flip y2',
    '💀 서든데스 릴레이': '💀 Sudden death relay',
    '대기': 'Ready',
    '탈락': 'Out',
    '18종목 전부 · 라운드마다 목표 시간이 줄어듭니다. 한 번이라도 넘기면 끝!': 'All 18 events · the target drops every round. Miss it once and you are out!',
    '목표': 'Target',
    '방금': 'Last',
    '최고 라운드': 'Best round',
    '시작을 누르면 스크램블이 나옵니다': 'Press start to get a scramble',
    '시작을 누르면 이 스크램블로': 'Press start to take this scramble',
    '시작을 누르세요': 'Press start',
    '시작': 'Start',
    '그만두기': 'Stop',
    '🧠 스크램블 챌린지': '🧠 Scramble challenge',
    '스크램블을 잠깐 보여줍니다. 사라지면 순서대로 다시 입력하세요.': 'The scramble flashes for a moment. When it disappears, type it back in order.',
    '아직 기록 없음': 'No record yet',
    '잘 기억하세요…': 'Memorize it…',
    '카드를 만들지 못했어요': 'Could not create the card',
    '결과 카드를 저장했어요 (PNG)': 'Result card saved (PNG)',

    /* stats */
    '총 솔브': 'Total solves',
    '연속 출석': 'Day streak',
    '업적': 'Achievements',
    '종목 수': 'Events',
    '개인 최고 기록': 'Personal bests',
    '업적 도감': 'Achievement collection',
    '설정': 'Settings',
    '15초 인스펙션': '15s inspection',
    '스크램블 미리보기': 'Scramble preview',
    '스플릿 측정 (Cross · F2L · OLL · PLL)': 'Splits (Cross · F2L · OLL · PLL)',
    '효과음': 'Sound',
    '라이트 테마': 'Light theme',
    '모든 기록 지우기': 'Erase all records',

    /* modals & picker */
    '종목 선택': 'Choose event',
    '📖 사용 설명서': '📖 How to use',
    '2027 · 신설 & 레거시': '2027 · New & legacy',
    '큐브': 'Cubes',
    '빅큐브': 'Big cubes',
    '블라인드': 'Blindfolded',
    '기타 퍼즐': 'Other puzzles',

    /* toasts */
    '인스펙션 초과 +2': 'Inspection over +2',
    '인스펙션 초과 DNF': 'Inspection over DNF',
    '모든 기록을 지웠어요': 'All records erased',
    '기록을 지웠어요': 'Record deleted',
    '모든 기록·XP·업적을 지우고 처음 상태로 돌아갑니다. 계속할까요?': 'This erases every record, XP and achievement and starts over. Continue?',

    /* aria labels & placeholders */
    '레벨과 경험치': 'Level and XP',
    '효과음 끄기': 'Mute sound',
    '효과음 켜기': 'Unmute sound',
    '테마 바꾸기': 'Switch theme',
    '사용 설명서 열기': 'Open how-to guide',
    '사용 설명서': 'How to use',
    '사용 설명서 닫기': 'Close how-to guide',
    '화면 이동': 'Screens',
    '타이머. 길게 눌러 초록불이 되면 떼세요': 'Timer. Hold until the light turns green, then release it',
    '배틀 타이머': 'Battle timer',
    '서든데스 종목': 'Sudden death event',
    '서든데스 타이머': 'Sudden death timer',
    '닫기': 'Close',
    '친구 닉네임': 'Friend’s nickname',
    '친구에게 받은 링크를 붙여넣기': 'Paste the link a friend sent you',
    '친구에게 받은 결과 링크': 'Result link from a friend',

    /* gems & shop */
    '💎 보석 상점': '💎 Gem shop',
    '보석 상점 열기': 'Open gem shop',
    '보석': 'Gems',
    '보유': 'Balance',
    '상점 열기': 'Open shop',
    '보석을 모아 스킨과 칭호를 해금하세요': 'Collect gems to unlock skins and titles',
    '네온 스킨': 'Neon skins',
    '프로필 칭호': 'Profile titles',
    '장착 중': 'Equipped',
    '장착': 'Equip',
    '해금': 'Unlock',
    '보유 중': 'Owned',
    '보석이 모자라요': 'Not enough gems',
    '스킨을 장착했어요': 'Skin equipped',
    '칭호를 장착했어요': 'Title equipped',
    '칭호를 해제했어요': 'Title removed',
    '없음': 'None',
    '오늘의 보상': 'Today’s rewards',
    '보석 획득 방법': 'How to earn gems',
    '일일 첫 출석': 'Daily check-in',
    '퀘스트 완료': 'Quest complete',
    'PB 갱신': 'New personal best',
    '배틀 완주': 'Battle finished',
    '배틀 승리': 'Battle won',
    '서든데스 5라운드': 'Sudden death 5 rounds',
    '클락 타임어택 클리어': 'Clock time attack clear',
    '업적 달성': 'Achievement',
    '연속 출석 보너스': 'streak bonus',
    '상점': 'Shop'
  };

  /* ------------------------------------------------------------ patterns -- */
  const RX = [
    [/^레벨 업! Lv\.(.+)$/, 'Level up! Lv.$1'],
    [/^새 PB! (.+) · (.+)$/, 'New PB! $1 · $2'],
    [/^다음 (.+)까지 -(.+)$/, 'Next $1 in -$2'],
    [/^🔥 (\d+)일 연속$/, '🔥 $1-day streak'],
    [/^퀘스트 달성! (.+)$/, 'Quest complete! $1'],
    [/^업적 달성 · (.+)$/, 'Achievement unlocked · $1'],
    [/^VS (.+) 외 (\d+)명$/, 'VS $1 +$2'],
    [/^라운드 (\d+) \/ 5$/, 'Round $1 / 5'],
    [/^라운드 (\d+) 클리어 · 다음 목표 (.+)$/, 'Round $1 cleared · next target $2'],
    [/^라운드 (\d+)$/, 'Round $1'],
    [/^(.*) \(나\)$/, '$1 (me)'],
    [/^(.+)와의 배틀에 참가했어요 · (.+)$/, 'Joined the battle vs $1 · $2'],
    [/^(.+)님의 배틀에 참가했어요 · (.+)$/, 'Joined $1’s battle · $2'],
    [/^(.+)님의 기록에 도전! 라운드 1부터 시작해요$/, 'Challenging $1! Starting at round 1'],
    [/^(.+)님의 결과를 불러왔어요$/, 'Loaded $1’s result'],
    [/ XP  \(총 (\d+)\)$/, ' XP  (total $1)'],
    [/^기록이 모자라요 \(필요 (\d+)회\)$/, 'Not enough solves (need $1)'],
    [/^Ao(\d+) · (.+) \(최고·최저 (\d+)개씩 제외\)$/, 'Ao$1 · $2 (best & worst $3 trimmed)'],
    [/^(\d+)회$/, '$1'],
    [/^(\d+)종목$/, '$1 events'],
    [/^최고 (.+)$/, 'Best $1'],
    [/^(\d+)수$/, '$1 moves'],
    [/^다이얼 (\d+)$/, 'Dial $1'],
    [/^([A-Z]{2}) 휠 반시계$/, '$1 wheel CCW'],
    [/^([A-Z]{2}) 휠 시계$/, '$1 wheel CW'],
    [/^핀 ([A-Z]{2})$/, 'Pin $1'],
    [/^클락 클리어! 최고 기록 (.+)$/, 'Clock cleared! Best $1'],
    [/^클락 클리어! (.+)$/, 'Clock cleared! $1'],
    [/^진행 중 · (.+)$/, 'In progress · $1'],
    [/^챌린지 성공! (.+) \(실수 (\d+)\)$/, 'Challenge clear! $1 (mistakes $2)'],
    [/^챌린지 성공! (.+) · 노미스!$/, 'Challenge clear! $1 · no mistakes!'],
    [/^라운드별 차이 · (.+) 기준 \(내 기록 − 상대\)$/, 'Round gaps · vs $1 (me − rival)'],
    [/^목표 (.+) 안에 맞추세요$/, 'Beat $1 to survive'],
    [/^서든데스 시작 · 목표 (.+)$/, 'Sudden death · target $1'],
    [/^탈락 · 라운드 (\d+)까지 생존 \((.+)\)$/, 'Out · survived $1 rounds ($2)'],
    [/^탈락 · 목표 (.+) 초과$/, 'Out · over target $1'],
    [/^신기록! 라운드 (\d+)까지 생존$/, 'New best! Survived $1 rounds'],
    [/^탈락! (.+) · 라운드 (\d+)까지$/, 'Out! $1 · $2 rounds'],
    [/^(.+) · 목표 (.+)부터 시작$/, '$1 · starting target $2'],
    [/^(.+)와의 대결 시작! 상대 기록은 리더보드에 있어요$/, 'Battle vs $1 started! Their times are on the leaderboard'],
    [/^Cube Arena에 온 것을 환영해요 · (\d+)개 퀘스트가 기다려요$/, 'Welcome to Cube Arena · $1 quests waiting'],
    [/^(.+) 기록 (\d+)개를 지울까요\?$/, 'Delete $2 solves of $1?']
  ];

  /* --------------------------------------------------- rich text blocks -- */
  const HTML_EN = {
    battleLead:
      'Pick an event and create a link, and you get an invite link with <b>the same 5 scrambles</b> inside. ' +
      'No friend to send it to? Take on an <b>AI rival</b> right away. ' +
      'Two people who open the same link <b>see each other’s times on the leaderboard as each round is finished</b>, and when you are both done you can compare side by side from the result link.',
    clockHint:
      'Raise the <b>pins</b> over a corner and turn its <b>wheel</b> — that corner turns together with the dials beside it and the middle. ' +
      'Raise every pin and the whole face turns. Line all 18 dials up to 12 o’clock and you have cleared it!',
    guideBody: [
      '<p class="g-lead" id="guideLead">Timer, battle, mini-games — these six things are all you need.</p>',

      '<section class="g-sec">',
      '  <div class="g-head"><span class="g-ico" aria-hidden="true">⏱️</span><h3>Timer &amp; splits</h3></div>',
      '  <ul class="g-list">',
      '    <li><b>Hold until the light turns green</b>, then let go to start. On a PC, hold <kbd>Space</kbd> and release.</li>',
      '    <li><b>15s inspection</b> — it beeps at 8 and 12 seconds; past 15 seconds is <b>+2</b>, past 17 is <b>DNF</b>. Turn it off in Stats → Settings.</li>',
      '    <li>With <b>split mode</b> on, every tap on the screen during a solve records a segment: <b>Cross → F2L → OLL → PLL</b>.</li>',
      '  </ul>',
      '  <p class="g-tip">Split mode lives in <b>Stats → Settings → Splits</b>.</p>',
      '</section>',

      '<section class="g-sec">',
      '  <div class="g-head"><span class="g-ico" aria-hidden="true">✨</span><h3>FTO &amp; goodbye Clock</h3></div>',
      '  <ul class="g-list">',
      '    <li><b>FTO</b> is a 2027 WCA event (the octahedron), so it sits here with a <b>NEW</b> badge.</li>',
      '    <li><b>Clock</b> stays a <b>legacy</b> event until July 2027, so together they cover <b>all 18 WCA events</b>.</li>',
      '    <li>Tap the event button to open the list, and check the shape straight away with the <b>scramble preview (SVG)</b>.</li>',
      '  </ul>',
      '</section>',

      '<section class="g-sec">',
      '  <div class="g-head"><span class="g-ico" aria-hidden="true">🤝</span><h3>How to battle a friend</h3></div>',
      '  <div class="g-steps">',
      '    <div class="g-step"><span class="g-num">1</span><p>The host picks the <b>event and opponent</b>, taps <b>[Create battle link]</b> and sends the link by KakaoTalk or Discord. Pick an <b>AI rival</b> (Challenger to Grandmaster) and you can skip the link and go straight in with <b>[Quick start]</b>.</p></div>',
      '    <div class="g-step"><span class="g-num">2</span><p>When your friend opens the link, the duel starts on <b>the exact same 5 scrambles</b>. Their name shows on the <b>VS badge</b> above the battle card and on the leaderboard, marked <b>waiting</b> until they post a time. When the chip on the battle card reads <b>🟢 Live</b> you are both in the same room, so <b>every round either of you finishes appears on both leaderboards</b> — no result link to send back and forth.</p></div>',
      '    <div class="g-step"><span class="g-num">3</span><p>Open a friend’s <b>result link</b> and their five times are already on the leaderboard while you start from <b>round 1</b>. Once you are both done, compare the <b>Ao5 result</b> and the <b>round-by-round gap</b>, then save it as a <b>result card PNG</b>!</p></div>',
      '  </div>',
      '</section>',

      '<section class="g-sec">',
      '  <div class="g-head"><span class="g-ico" aria-hidden="true">🎮</span><h3>Mini-games</h3></div>',
      '  <ul class="g-list">',
      '    <li><b>Clock 12 o’clock time attack</b> — raise the pins, turn the wheels by <b>±</b>, flip with <b>y2</b>, following real clock rules. Get all 18 dials to 12 o’clock to clear it!</li>',
      '    <li><b>Sudden death relay</b> — pick any of the 18 WCA events and survive a target time that shrinks every round. Miss it once and you are out.</li>',
      '    <li><b>Scramble challenge</b> — the scramble flashes, then you tap the moves back in order.</li>',
      '  </ul>',
      '</section>',

      '<section class="g-sec">',
      '  <div class="g-head"><span class="g-ico" aria-hidden="true">💎</span><h3>Gems &amp; the shop</h3></div>',
      '  <ul class="g-list">',
      '    <li>You earn <b>💎 gems</b> for showing up: a daily check-in, finishing quests, beating your PB, finishing or winning battles, surviving 5 rounds of sudden death, clearing the clock, and every achievement.</li>',
      '    <li>Tap the <b>💎 counter</b> at the top to open the shop, and spend gems on <b>neon skins</b> (they recolour the accent and the timer glow) and <b>profile titles</b> (they show next to your name on the leaderboard).</li>',
      '  </ul>',
      '</section>',

      '<section class="g-sec">',
      '  <div class="g-head"><span class="g-ico" aria-hidden="true">🌐</span><h3>Korean / English</h3></div>',
      '  <ul class="g-list">',
      '    <li>Tap <b>KO / EN</b> at the top to switch the whole app instantly; your choice is remembered.</li>',
      '    <li>Links copied while in English carry <b>?lang=en</b>, so a friend opens the battle straight in English.</li>',
      '  </ul>',
      '</section>',

      '<section class="g-sec">',
      '  <div class="g-head"><span class="g-ico" aria-hidden="true">📱</span><h3>Install it like an app</h3></div>',
      '  <ul class="g-list">',
      '    <li><b>Chrome on Android</b> — the <b>⋮</b> menu at the top right → <b>“Add to Home screen”</b></li>',
      '    <li><b>Safari on iPhone</b> — <b>Share (□↑)</b> at the bottom → <b>“Add to Home Screen”</b></li>',
      '  </ul>',
      '  <p class="g-tip">Installed, it opens like an app without the address bar.</p>',
      '</section>',

      '<section class="g-sec g-sec-lock">',
      '  <div class="g-head"><span class="g-ico" aria-hidden="true">🔒</span><h3>About your data</h3></div>',
      '  <ul class="g-list">',
      '    <li>Every record lives only in <b>your phone’s browser (localStorage)</b> and <b>is never sent to a server</b>. No account, no sign-in.</li>',
      '    <li>The one exception is a friend battle: while you are in the same room, only your <b>nickname, title and five times</b> travel over a free public MQTT relay to that room, and the room id is a fresh random value for every battle so it cannot mix with anyone else’s. Contacts, location and account details are never sent, and your record is removed from the room when you leave the battle.</li>',
      '    <li>Clearing your browser data clears your records too, so check once before <b>Stats → Settings → Erase all records</b>.</li>',
      '  </ul>',
      '</section>',

      '<p class="g-foot">To jump right in, close this window and hold the timer 🧊</p>'
    ].join('\n')
  };

  /* ---------------------------------------------------------------- state -- */
  let lang = 'ko';

  function fromUrl() {
    try {
      const v = (new URLSearchParams(global.location.search).get('lang') || '').toLowerCase();
      if (v.indexOf('en') === 0) return 'en';
      if (v.indexOf('ko') === 0) return 'ko';
    } catch (e) {
      /* ignore */
    }
    return null;
  }

  function stored() {
    try {
      const v = localStorage.getItem(LS_KEY);
      return v === 'en' || v === 'ko' ? v : null;
    } catch (e) {
      return null;
    }
  }

  function coreTr(s) {
    if (Object.prototype.hasOwnProperty.call(KO, s)) return KO[s];
    for (let i = 0; i < RX.length; i++) {
      if (RX[i][0].test(s)) return s.replace(RX[i][0], RX[i][1]);
    }
    return null;
  }

  function trText(v) {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(v);
    const c = m ? m[2] : '';
    if (!c) return null;
    const hit = coreTr(c);
    return hit == null ? null : m[1] + hit + m[3];
  }

  const TX = new WeakMap();
  const AT = new WeakMap();

  function txNode(n) {
    const cur = n.nodeValue;
    if (cur == null) return;
    const rec = TX.get(n);
    if (lang === 'ko') {
      if (rec && rec.en != null && cur === rec.en) n.nodeValue = rec.ko;
      return;
    }
    if (rec && rec.en != null && cur === rec.en) return;
    if (!HANG.test(cur)) {
      if (!rec || rec.ko !== cur) TX.set(n, { ko: cur, en: null });
      return;
    }
    const out = trText(cur);
    if (out == null) {
      TX.set(n, { ko: cur, en: null });
      return;
    }
    TX.set(n, { ko: cur, en: out });
    n.nodeValue = out;
  }

  function atEl(el) {
    if (!el || !el.getAttribute) return;
    let map = AT.get(el);
    for (let i = 0; i < ATTRS.length; i++) {
      const name = ATTRS[i];
      const v = el.getAttribute(name);
      if (v == null) continue;
      const rec = map && map[name];
      if (lang === 'ko') {
        if (rec && rec.en != null && v === rec.en) el.setAttribute(name, rec.ko);
        continue;
      }
      if (rec && rec.en != null && v === rec.en) continue;
      if (!HANG.test(v)) {
        if (!rec || rec.ko !== v) {
          map = map || {};
          map[name] = { ko: v, en: null };
          AT.set(el, map);
        }
        continue;
      }
      const hit = coreTr(v.trim());
      if (hit == null) continue;
      map = map || {};
      map[name] = { ko: v, en: hit };
      AT.set(el, map);
      el.setAttribute(name, hit);
    }
  }

  function walk(root, fn) {
    if (!root) return;
    if (root.nodeType === 3) {
      fn(root);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    const doc = root.ownerDocument || root;
    const it = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: function (n) {
        if (n.nodeType === 1) return NodeFilter.FILTER_ACCEPT;
        const p = n.parentNode;
        if (p && /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n = it.currentNode;
    while (n) {
      if (n.nodeType === 3) fn(n);
      else atEl(n);
      n = it.nextNode();
    }
  }

  function applyHtmlBlocks() {
    const nodes = document.querySelectorAll('[data-i18n-html]');
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      const key = el.getAttribute('data-i18n-html');
      const en = HTML_EN[key];
      if (!en) continue;
      if (!el.__koHtml) el.__koHtml = el.innerHTML;
      const next = lang === 'en' ? en : el.__koHtml;
      if (el.innerHTML !== next) el.innerHTML = next;
    }
  }

  /* ---------------------------------------------------------- lang button -- */
  function paintToggle() {
    const btn = document.getElementById('btnLang');
    if (!btn) return;
    btn.dataset.lang = lang;
    const opts = btn.querySelectorAll('[data-lang-opt]');
    for (let i = 0; i < opts.length; i++) {
      opts[i].classList.toggle('on', opts[i].getAttribute('data-lang-opt') === lang);
    }
    btn.setAttribute('aria-label', lang === 'en' ? 'Switch to Korean' : '영어로 바꾸기');
  }

  const listeners = [];

  function set(next, opt) {
    lang = next === 'en' ? 'en' : 'ko';
    try {
      localStorage.setItem(LS_KEY, lang);
    } catch (e) {
      /* private mode — the session still works */
    }
    const r = document.documentElement;
    r.lang = lang;
    r.dataset.lang = lang;
    const title = document.querySelector('title');
    if (title) title.textContent = TITLE[lang];
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', DESC[lang]);
    paintToggle();
    applyHtmlBlocks();
    for (let i = 0; i < listeners.length; i++) {
      try {
        listeners[i](lang);
      } catch (e) {
        /* a listener failing must not stop the switch */
      }
    }
    walk(document.documentElement, txNode);
    if (!opt || !opt.quiet) document.dispatchEvent(new CustomEvent('ca:lang', { detail: { lang: lang } }));
  }

  function toggle() {
    set(lang === 'en' ? 'ko' : 'en');
  }

  /* ------------------------------------------------------------- observer -- */
  let observer = null;

  function startObserver() {
    if (observer || !global.MutationObserver) return;
    observer = new MutationObserver(function (list) {
      if (lang !== 'en') return;
      for (let i = 0; i < list.length; i++) {
        const mu = list[i];
        if (mu.type === 'attributes') {
          if (mu.target && mu.target.nodeType === 1) atEl(mu.target);
          continue;
        }
        if (mu.type === 'characterData') {
          if (mu.target) txNode(mu.target);
          continue;
        }
        const added = mu.addedNodes;
        for (let k = 0; k < added.length; k++) {
          const n = added[k];
          if (n.nodeType === 3) txNode(n);
          else if (n.nodeType === 1) {
            if (n.hasAttribute && n.hasAttribute('data-i18n-html')) applyHtmlBlocks();
            walk(n, txNode);
            atEl(n);
          }
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ATTRS
    });
  }

  /* ------------------------------------------------------------------ api -- */
  global.I18N = {
    get lang() {
      return lang;
    },
    isEn: function () {
      return lang === 'en';
    },
    L: function (ko, en) {
      return lang === 'en' ? en : ko;
    },
    t: function (ko) {
      if (lang !== 'en') return ko;
      const hit = coreTr(String(ko).trim());
      return hit == null ? ko : hit;
    },
    set: set,
    toggle: toggle,
    render: function () {
      applyHtmlBlocks();
      walk(document.documentElement, txNode);
    },
    onChange: function (fn) {
      if (typeof fn === 'function') listeners.push(fn);
    }
  };

  /* ----------------------------------------------------------------- boot -- */
  const initial = fromUrl() || stored() || 'ko';
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      set(initial, { quiet: true });
      startObserver();
    });
  } else {
    set(initial, { quiet: true });
    startObserver();
  }
})(window);
