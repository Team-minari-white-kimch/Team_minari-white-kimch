// 앱에서 쓰는 기준 데이터. 출처가 있는 값만 넣고, 시연용 가상 데이터는 "예시"로 표시한다.

export const FARM = {
  name: '청도 새내기 농부',
  region: '경북 청도군',
  lat: 35.6475, lon: 128.7339, // 청도군청 부근
};

export const WORK_TYPES = ['수확', '관수', '시비', '방제', '전정', '풀베기', '덮개·보온', '농기계 사용', '증상 관찰', '기타'];

// 증상 체크 항목 (사진에서 보이는 특징)
export const SYMPTOMS = {
  '감(반시)': [
    { id: 'fruit_black_sunken', label: '열매에 검고 움푹한 반점' },
    { id: 'pink_spore', label: '반점 위에 분홍빛 가루·덩어리' },
    { id: 'shoot_black', label: '새 가지가 검게 변함' },
    { id: 'leaf_round_brown', label: '잎에 둥근 갈색 반점' },
    { id: 'dark_margin', label: '반점 가장자리에 진한 테' },
    { id: 'leaf_angular', label: '잎맥 사이 각진 갈색 반점' },
    { id: 'early_leaf_drop', label: '잎이 일찍 많이 떨어짐' },
    { id: 'white_powder', label: '잎 뒷면에 흰 가루' },
    { id: 'calyx_hole', label: '꼭지 부근 구멍·벌레 똥' },
    { id: 'fruit_drop_early', label: '익기 전 열매가 떨어짐' },
    { id: 'white_cottony', label: '가지·열매에 흰 솜 같은 벌레' },
    { id: 'sooty', label: '잎·열매가 검은 그을음처럼 더러워짐' },
  ],
  '미나리': [
    { id: 'small_insects', label: '잎·줄기에 작은 벌레 무리' },
    { id: 'sticky', label: '잎이 끈적거림' },
    { id: 'leaf_curl', label: '잎이 오그라듦' },
    { id: 'orange_pustule', label: '잎에 노랑·주황 가루 돌기' },
    { id: 'yellowing', label: '잎 전체가 누렇게 변함' },
    { id: 'rot_base', label: '밑동이 물러지고 냄새' },
  ],
};

// 병해충 참고 정보: 일반적인 증상과 재배적 관리만 적는다. 약제명·희석 배수는 넣지 않는다.
export const PESTS = [
  { id: 'anthracnose', crop: '감(반시)', name: '탄저병', kind: '병',
    keys: ['fruit_black_sunken', 'pink_spore', 'shoot_black'], wetBoost: true,
    feature: '열매·새 가지에 검고 움푹한 둥근 반점이 생기고, 습하면 분홍빛 포자 덩어리가 보입니다.',
    care: ['병든 열매·가지를 따서 밭 밖에서 처리하세요.', '가지가 빽빽하면 솎아 통풍을 좋게 하세요.', '비가 이어진 뒤 확산 여부를 2~3일 간격으로 확인하세요.'] },
  { id: 'circular_leaf_spot', crop: '감(반시)', name: '둥근무늬낙엽병', kind: '병',
    keys: ['leaf_round_brown', 'dark_margin', 'early_leaf_drop'],
    feature: '잎에 둥근 갈색 반점이 생기고 가장자리가 진해지며, 잎이 일찍 떨어집니다.',
    care: ['떨어진 잎을 모아 처리해 내년 전염원을 줄이세요.', '배수가 잘 되게 하고 나무 세력을 관리하세요.'] },
  { id: 'angular_leaf_spot', crop: '감(반시)', name: '모무늬낙엽병', kind: '병',
    keys: ['leaf_angular', 'early_leaf_drop'],
    feature: '잎맥에 둘러싸인 각진 갈색 반점이 생기고 잎이 떨어집니다.',
    care: ['떨어진 잎을 모아 처리하세요.', '통풍이 잘 되게 가지를 정리하세요.'] },
  { id: 'powdery_mildew', crop: '감(반시)', name: '흰가루병', kind: '병',
    keys: ['white_powder'],
    feature: '잎 뒷면에 흰 가루 같은 곰팡이가 생깁니다.',
    care: ['심한 잎은 제거하고 통풍을 좋게 하세요.', '질소 비료를 지나치게 주지 않았는지 기록을 확인하세요.'] },
  { id: 'fruit_moth', crop: '감(반시)', name: '감꼭지나방', kind: '해충',
    keys: ['calyx_hole', 'fruit_drop_early'],
    feature: '애벌레가 꼭지 부근을 파고들어 구멍과 똥이 보이고, 열매가 익기 전에 떨어집니다.',
    care: ['떨어진 열매와 피해 열매를 모아 처리하세요.', '겨울에 거친 껍질을 긁어 월동 애벌레를 줄이는 방법이 알려져 있습니다 (도감 확인).'] },
  { id: 'mealybug', crop: '감(반시)', name: '깍지벌레류', kind: '해충',
    keys: ['white_cottony', 'sooty'],
    feature: '가지·열매에 흰 솜이나 껍질 같은 벌레가 붙고, 배설물 때문에 그을음이 생깁니다.',
    care: ['피해 가지를 정리하고, 겨울 전정 때 붙어 있는 가지를 제거하세요.', '발생 범위를 사진으로 기록해 두세요.'] },
  { id: 'aphid', crop: '미나리', name: '진딧물', kind: '해충',
    keys: ['small_insects', 'sticky', 'leaf_curl'],
    feature: '잎·줄기에 작은 벌레가 무리 지어 있고, 잎이 끈적이거나 오그라듭니다.',
    care: ['발생한 포기 주변을 먼저 확인하고 범위를 기록하세요.', '물 관리와 잡초 정리로 서식처를 줄이세요.'] },
  { id: 'rust', crop: '미나리', name: '녹병 의심', kind: '병',
    keys: ['orange_pustule'],
    feature: '잎에 노랑·주황색 가루가 나오는 작은 돌기가 생깁니다.',
    care: ['병든 잎을 걷어 내고, 확산 여부를 확인하세요.', '도감에서 미나리 녹병 증상과 비교해 보세요.'] },
  { id: 'physio', crop: '미나리', name: '생리장해·물 관리 문제', kind: '환경',
    keys: ['yellowing', 'rot_base'],
    feature: '병해충 없이 수온·수위·양분 문제로 잎이 누렇게 되거나 밑동이 무를 수 있습니다.',
    care: ['수위와 물 흐름을 확인하세요.', '고인 물이 썩지 않게 순환시키세요.', '계속되면 농업기술센터에 문의하세요.'] },
];

export const PEST_LINKS = {
  ncpms: 'https://ncpms.rda.go.kr',
  bulletin: 'https://weather.rda.go.kr/news/dbyhsCccrrncInfo.do',
  pesticide: 'https://psis.rda.go.kr',
};

// 농기계 추천 기준 (예시 기준, 임대 가능 여부는 사업소 확인)
export const MACHINE_RULES = {
  '방제': [{ max: 0.5, m: '동력분무기 (소형)' }, { max: 99, m: '고속분무기 (SS기)' }],
  '운반': [{ max: 99, m: '동력운반차' }],
  '경운·로터리': [{ max: 1, m: '관리기' }, { max: 99, m: '트랙터 + 로터리' }],
  '풀베기': [{ max: 1, m: '예초기 (배부식)' }, { max: 99, m: '승용 예초기' }],
  '높은 곳 작업(수확·전정)': [{ max: 99, m: '고소작업차' }],
  '파쇄(전정 가지)': [{ max: 99, m: '파쇄기' }],
};

export const RENTAL = {
  summary: '청도군 농기계임대사업소는 본소·산서분소·산동분소 3곳에서 62종 785대를 운영합니다 (2024년 기사 기준).',
  offices: [
    { name: '청도군 농기계임대사업소 (본소)' },
    { name: '산서분소' },
    { name: '산동분소' },
  ],
  sources: [
    { title: '뉴스서울 2024-07-17', url: 'https://www.newsseoul.co.kr/news/view/1065592251246082' },
    { title: '전국농기계임대정보표준데이터 (공공데이터포털)', url: 'https://www.data.go.kr/data/15017325/standard.do' },
  ],
};

// 커뮤니티 예시 글 (가상의 선배 농부, 시연용)
export const SEED_POSTS = [
  { id: 's1', type: 'tip', author: '화양 감농사 15년', senior: true, crop: '감(반시)', topic: '서리·보온', createdAt: '2026-11-03T19:10:00+09:00', likes: 12, example: true,
    title: '첫서리 예보 나오면 전날 오후에 할 일',
    body: '최저기온이 0도 근처로 내려간다는 예보가 나오면 아직 못 딴 반시부터 먼저 수확합니다. 어린나무는 밑동에 볏짚을 둘러 줍니다. 서리 맞은 열매는 따로 골라 두면 선별이 편합니다.' },
  { id: 's2', type: 'tip', author: '이서 귀농 7년차', senior: true, crop: '감(반시)', topic: '병해충', createdAt: '2026-11-01T08:20:00+09:00', likes: 9, example: true,
    title: '비 온 뒤에는 탄저병 열매부터 따 냅니다',
    body: '비가 며칠 이어지면 열매에 검게 움푹한 반점이 늘어납니다. 보이는 대로 따서 밭 밖으로 내가고, 약은 꼭 감에 등록된 약제인지 농약안전정보시스템에서 확인한 뒤 라벨대로만 씁니다.' },
  { id: 's3', type: 'tip', author: '한재 미나리 20년', senior: true, crop: '미나리', topic: '물 관리', createdAt: '2026-10-29T07:00:00+09:00', likes: 15, example: true,
    title: '미나리 물은 고이지 않게 흐르게',
    body: '추워지면 수위를 조금 높여 줍니다. 물이 고여 있으면 밑동이 물러지기 쉬우니 들어오고 나가는 물길을 매일 아침 한 번 확인합니다.' },
  { id: 's4', type: 'tip', author: '각남 과수 12년', senior: true, crop: '공통', topic: '농기계', createdAt: '2026-10-27T12:00:00+09:00', likes: 7, example: true,
    title: '수확철 임대 농기계는 일찍 예약하세요',
    body: '수확철에는 운반차와 고소작업차 예약이 몰립니다. 작업 날짜가 정해지면 바로 임대사업소에 전화해 두고, 반납일을 달력에 적어 둡니다.' },
  { id: 's5', type: 'tip', author: '풍각 감농사 10년', senior: true, crop: '공통', topic: '일손', createdAt: '2026-10-25T18:30:00+09:00', likes: 6, example: true,
    title: '계절근로자 작업 지시는 사진과 짧은 문장으로',
    body: '오늘 할 일을 짧은 문장으로 적고 사진을 같이 보여 주면 실수가 줄어듭니다. 휴게 시간과 끝나는 시간을 처음에 꼭 알려 줍니다.' },
  { id: 'q1', type: 'question', author: '새내기 2년차', senior: false, crop: '감(반시)', topic: '시비', createdAt: '2026-11-04T21:00:00+09:00', likes: 2, example: true,
    title: '수확 끝나면 밑거름은 언제 주나요?',
    body: '올해 처음 수확을 끝냈는데, 가을에 밑거름을 줘야 하는지 봄에 줘야 하는지 헷갈립니다.' },
];

export const SEED_COMMENTS = [
  { id: 'c1', postId: 'q1', author: '화양 감농사 15년', senior: true, createdAt: '2026-11-05T06:40:00+09:00', example: true,
    body: '저는 수확 끝나고 가을에 줍니다. 양은 토양검정 받아서 흙토람 처방서대로 하세요. 농업기술센터에서 검정해 줍니다.' },
];

export const TOPICS = ['전체', '병해충', '서리·보온', '물 관리', '시비', '농기계', '일손', '기타'];
