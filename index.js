require('dotenv').config();

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.options('*', cors());

app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function safeParseJSON(raw) {
  if (!raw) throw new Error('응답이 비어있습니다');
  try {
    raw = raw.replace(/```json|```/g, '').trim();
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('JSON 객체를 찾을 수 없습니다');
    const jsonStr = raw.slice(start, end + 1);
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('JSON 파싱 실패 원본:', raw);
    throw new Error(`JSON 파싱 실패: ${err.message}`);
  }
}

// [핵심] 프롬프트를 "점수 주입형"으로 변경
const systemPrompt = `
너는 '포춘베어'다곰.
사용자가 주는 luckScore에 절대적으로 복종해서 운세를 써야 한다곰.

구간별 가이드:
- 0~20: 매우 우울하고 답답한 운세 (부정적 표현 필수)
- 21~40: 운이 안 좋고 조심해야 하는 운세
- 41~60: 평범하고 지루한 운세
- 61~80: 기분 좋고 운이 따르는 운세
- 81~100: 대박 터지는 최고의 운세 (강력한 긍정)

모든 문장은 "~곰"으로 끝내고 JSON 형식만 출력하라곰.
`;

/* =====================================================
   1️⃣ 포춘베어 운세 API (점수 고정 해결)
===================================================== */
app.post('/api/risk', async (req, res) => {
  try {
    // [해결책] AI에게 맡기지 않고 서버에서 0~100 사이 숫자를 먼저 뽑음
    const assignedScore = Math.floor(Math.random() * 101);

    const now = new Date();
    const weekDays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const todayDay = weekDays[now.getDay()];

    const specialDays = { '01-01': '새해', '02-14': '발렌타인데이', '12-25': '크리스마스' };
    const monthDay = now.toISOString().slice(5, 10);
    const theme = specialDays[monthDay] || `${todayDay} 테마`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        // [핵심] 유저 메시지에 점수를 박아서 보냄
        { role: 'user', content: `오늘의 테마: ${theme}, 무조건 luckScore를 ${assignedScore}점으로 해서 운세를 써줘곰.` },
      ],
      response_format: { type: "json_object" }, 
      temperature: 1.0, // 랜덤성 극대화
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();
    let parsed = safeParseJSON(raw);

    // AI가 혹시라도 점수를 다르게 줬을 경우를 대비해 서버 점수로 덮어쓰기
    const finalData = {
      luckScore: assignedScore, 
      todayFlow: (parsed.todayFlow || "오늘의 흐름").slice(0, 8),
      bearComment: parsed.bearComment || "곰이 졸고 있다곰.",
      smallTip: parsed.smallTip || "기지개를 켜보자곰."
    };

    res.json({ success: true, ...finalData, theme });

  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ success: false, message: '포춘베어가 흐름을 놓쳤다곰.' });
  }
});

/* =====================================================
   2️⃣/3️⃣/4️⃣ 나머지 API (원본 유지)
===================================================== */
app.post('/api/decide', async (req, res) => {
  const { optionA, optionB } = req.body;
  if (!optionA || !optionB) return res.status(400).json({ success: false });
  const picked = Math.random() < 0.5 ? optionA : optionB;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: "너는 포춘베어다곰." }, { role: 'user', content: `"${picked}"가 선택된 이유를 2문장(~곰)으로 말해줘곰.` }],
    });
    res.json({ success: true, result: `포춘베어의 결정\n${picked}\n\n포춘베어의 생각\n${completion.choices[0].message.content}` });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/reviews', async (req, res) => {
  const { nickname, content } = req.body;
  const { error } = await supabase.from('reviews').insert([{ nickname, content }]);
  res.json({ success: !error });
});

app.get('/api/reviews', async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 5;
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, error, count } = await supabase.from('reviews').select('*', { count: 'exact' }).order('id', { ascending: false }).range(from, to);
  res.json({ success: !error, reviews: data, total: count, hasMore: (to + 1) < count });
});

app.listen(PORT, () => console.log(`FortuneBear running on port ${PORT}`));