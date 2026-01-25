require('dotenv').config();

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 설정
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.options('*', cors());

app.use(express.json());

/* =====================
   OpenAI 설정
===================== */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* =====================
   Supabase 설정
===================== */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* =====================
   안전 JSON 파서 (유지 및 강화)
===================== */
function safeParseJSON(raw) {
  if (!raw) throw new Error('응답이 비어있습니다');

  try {
    // 백틱이나 코드블록 제거
    raw = raw.replace(/```json|```/g, '').trim();

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new Error('JSON 객체를 찾을 수 없습니다');
    }
    const jsonStr = raw.slice(start, end + 1);
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('JSON 파싱 실패 원본:', raw);
    throw new Error(`JSON 파싱 실패: ${err.message}`);
  }
}

/* =====================
   포춘베어 운세 프롬프트 (점수 주입형으로 개조)
===================== */
const systemPrompt = `
너는 '포춘베어'다곰.

사용자가 제공하는 luckScore에 맞춰 오늘 하루의 흐름을 관찰하듯 말한다곰.
절대 점수를 네가 수정하지 말고, 주어진 점수의 분위기에 100% 맞춰야 한다곰.

구간별 가이드:
0~20 매우 답답하고 정체된 흐름 (부정적/정적인 표현)
21~40 신중하고 조심스러운 하루
41~60 무난하고 평범한 일상
61~80 운이 따르고 기분 좋은 흐름
81~100 매우 강력한 행운과 성취 (긍정적/동적인 표현)

모든 문장은 반드시 1인칭 + "~곰"으로 끝낸다곰.
사고·재난·질병 표현은 절대 금지다곰.

반드시 아래 형식의 순수 JSON만 출력한다곰:
{
  "luckScore": number,
  "todayFlow": "최대 8자 이내의 짧은 제목",
  "bearComment": "정확히 2문장으로 구성된 코멘트",
  "smallTip": "정확히 2문장으로 구성된 작은 팁"
}
`;

/* =====================================================
   1️⃣ 포춘베어 운세 API
===================================================== */
app.post('/api/risk', async (req, res) => {
  try {
    // [핵심 해결책] 서버에서 먼저 점수를 0~100 사이로 완전 랜덤하게 생성
    const assignedScore = Math.floor(Math.random() * 101);

    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekDays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const todayDay = weekDays[dayOfWeek];

    const specialDays = {
      '01-01': '새해 복 많이 받는 날',
      '02-14': '발렌타인데이 연애운',
      '12-25': '크리스마스 특별 운세',
    };
    const monthDay = now.toISOString().slice(5, 10);
    const theme = specialDays[monthDay] || `${todayDay} 테마`;

    // AI에게 정해진 점수를 강제로 부여
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `오늘의 테마는 ${theme}이고, luckScore는 반드시 ${assignedScore}점으로 작성해줘곰.` },
      ],
      response_format: { type: "json_object" }, // JSON 모드 강제
      temperature: 1.0, // 창의성 최대화
      max_tokens: 300,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();
    console.log('[Raw AI Response]', raw);

    let parsed;
    try {
      parsed = safeParseJSON(raw);
    } catch (parseErr) {
      console.error('파シング 실패:', parseErr.message);
      // 파싱 실패 시에도 미리 정한 assignedScore를 사용해 흐름 생성
      parsed = {
        luckScore: assignedScore,
        todayFlow: assignedScore > 50 ? "기분 좋은 흐름" : "조용한 하루",
        bearComment: "곰이 잠시 꿀을 먹으러 갔다곰.\n그래도 오늘 하루는 무사히 지나갈 거다곰.",
        smallTip: "기지개를 한번 켜보자곰.\n따뜻한 차 한 잔이 도움될 거다곰."
      };
    }

    // 최종 데이터 보정 (assignedScore를 최우선 적용)
    const finalData = {
      luckScore: assignedScore,
      todayFlow: (parsed.todayFlow || "오늘의 흐름").slice(0, 8),
      bearComment: typeof parsed.bearComment === 'string' ? parsed.bearComment : "곰이 오늘 조용하네곰.\n쉬엄쉬엄 가보자곰.",
      smallTip: typeof parsed.smallTip === 'string' ? parsed.smallTip : "작은 행복을 찾아보자곰.\n하루 잘 마무리하자곰."
    };

    res.json({
      success: true,
      ...finalData,
      theme: theme
    });

  } catch (err) {
    console.error('Risk API error:', err.stack);
    res.status(500).json({ success: false, message: '포춘베어가 흐름을 잠시 놓쳤다곰.' });
  }
});

/* =====================================================
   2️⃣ 포춘베어 선택 결정 API
===================================================== */
app.post('/api/decide', async (req, res) => {
  const { optionA, optionB } = req.body;
  if (!optionA || !optionB) {
    return res.status(400).json({ success: false, message: '선택지 두 개 다 달라곰.' });
  }

  const picked = Math.random() < 0.5 ? optionA : optionB;
  const decidePrompt = `포춘베어로서 "${picked}"를 선택한 이유를 2문장(~곰)으로 설명해줘곰.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: "너는 포춘베어다곰." }, { role: 'user', content: decidePrompt }],
      temperature: 0.85,
    });
    res.json({ success: true, result: `포춘베어의 결정\n${picked}\n\n포춘베어의 생각\n${completion.choices[0].message.content}` });
  } catch (err) {
    res.status(500).json({ success: false, message: '곰이 결정을 못 하겠다곰.' });
  }
});

/* =====================================================
   3️⃣ 후기 저장 API
===================================================== */
app.post('/api/reviews', async (req, res) => {
  const { nickname, content } = req.body;
  if (!nickname || !content) return res.status(400).json({ success: false });

  const { error } = await supabase.from('reviews').insert([{ nickname, content }]);
  if (error) return res.status(500).json({ success: false });
  res.json({ success: true });
});

/* =====================================================
   4️⃣ 후기 조회 API
===================================================== */
app.get('/api/reviews', async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 5;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from('reviews')
    .select('nickname, content, created_at', { count: 'exact' })
    .order('id', { ascending: false })
    .range(from, to);

  if (error) return res.status(500).json({ success: false });
  res.json({ success: true, reviews: data, total: count, hasMore: (to + 1) < count });
});

app.listen(PORT, () => {
  console.log(`FortuneBear API running on port ${PORT}`);
});