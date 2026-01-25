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
app.use(cors()); // 모든 경로에 대해 CORS 허용

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
   안전 JSON 파서 (강화 버전)
===================== */
function safeParseJSON(raw) {
  if (!raw) return null;
  try {
    // 백틱이나 코드블록 제거 및 정리
    let cleanRaw = raw.replace(/```json|```/g, '').trim();
    const start = cleanRaw.indexOf('{');
    const end = cleanRaw.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    
    const jsonStr = cleanRaw.slice(start, end + 1);
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('[파싱 실패 원본]:', raw);
    return null;
  }
}

/* =====================
   포춘베어 운세 프롬프트
===================== */
const systemPrompt = `
너는 '포춘베어'다곰. 
사용자가 제공하는 luckScore(0~100)에 100% 맞춰서 오늘 하루의 흐름을 작성하라곰.
너의 개인적인 의견으로 점수를 수정하지 마라곰.

구간별 톤앤매너:
- 0~20: 매우 답답하고 정체된 느낌 (부정적)
- 21~40: 운이 조금 부족하고 조심해야 함
- 41~60: 평범하고 무난한 일상
- 61~80: 기운이 좋고 활기찬 느낌
- 81~100: 행운이 가득하고 성취감이 높음 (매우 긍정적)

반드시 아래 JSON 형식으로만 응답하라곰:
{
  "luckScore": number,
  "todayFlow": "최대 8자 이내 제목",
  "bearComment": "2문장으로 된 코멘트",
  "smallTip": "2문장으로 된 작은 팁"
}
모든 문장은 "~곰"으로 끝내야 한다곰.
`;

/* =====================================================
   1️⃣ 포춘베어 운세 API (점수 및 파싱 보정 완료)
===================================================== */
app.post('/api/risk', async (req, res) => {
  try {
    // [해결] 서버에서 먼저 0~100 난수 확정
    const assignedScore = Math.floor(Math.random() * 101);

    const now = new Date();
    const weekDays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const theme = `${weekDays[now.getDay()]} 테마`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `나의 luckScore는 ${assignedScore}점이다곰. 테마는 ${theme}다곰. 이 점수에 딱 맞춰서 JSON을 써라곰.` },
      ],
      response_format: { type: "json_object" },
      temperature: 1.0,
      max_tokens: 400,
    });

    const raw = completion.choices?.[0]?.message?.content;
    const parsed = safeParseJSON(raw);

    // [중요] 파싱 실패하거나 데이터가 없을 때, assignedScore에 맞는 최적의 대체 멘트 생성
    let finalFlow, finalComment, finalTip;

    if (parsed) {
      finalFlow = parsed.todayFlow;
      finalComment = parsed.bearComment;
      finalTip = parsed.smallTip;
    } else {
      // AI가 응답을 못했을 때의 점수대별 자동 보정 로직
      if (assignedScore <= 20) {
        finalFlow = "정체된 하루";
        finalComment = "오늘은 마음먹은 대로 일이 잘 안 풀릴 수 있다곰. 무리하지 말고 일찍 쉬는 게 좋겠다곰.";
        finalTip = "따뜻한 물을 자주 마셔라곰. 오늘은 조용히 지내는 게 상책이다곰.";
      } else if (assignedScore <= 40) {
        finalFlow = "신중한 흐름";
        finalComment = "작은 실수도 커질 수 있으니 주의해야 한다곰. 차근차근 확인하는 습관이 필요하다곰.";
        finalTip = "기지개를 크게 켜보자곰. 중요한 결정은 내일로 미뤄도 괜찮다곰.";
      } else if (assignedScore <= 60) {
        finalFlow = "무난한 하루";
        finalComment = "특별한 일은 없지만 평온하게 지나가는 날이다곰. 소소한 일상에서 즐거움을 찾아보라곰.";
        finalTip = "좋아하는 노래를 들어보자곰. 가벼운 산책이 기분 전환에 도움된다곰.";
      } else if (assignedScore <= 80) {
        finalFlow = "활기찬 기운";
        finalComment = "기분 좋은 소식이 들려올 것 같은 예감이 든다곰. 자신감 있게 행동해도 좋은 날이다곰.";
        finalTip = "주변 사람에게 먼저 웃으며 인사해라곰. 행운이 더 커질 거다곰.";
      } else {
        finalFlow = "최고의 행운";
        finalComment = "오늘은 무엇을 해도 술술 풀리는 최고의 날이다곰. 곰이 봐도 부러운 행운이 함께한다곰.";
        finalTip = "맛있는 음식을 나 자신에게 선물해라곰. 이 기분을 마음껏 즐기라곰.";
      }
    }

    const finalData = {
      success: true,
      luckScore: assignedScore, // AI가 뭐라고 했든 서버가 정한 점수를 강제로 사용
      todayFlow: (finalFlow || "오늘의 흐름").slice(0, 8),
      bearComment: finalComment || "곰이 흐름을 읽고 있다곰.\n천천히 하루를 시작해보자곰.",
      smallTip: finalTip || "기지개를 켜보자곰.\n따뜻한 차가 좋다곰.",
      theme: theme
    };

    res.json(finalData);

  } catch (err) {
    console.error('Risk API Error:', err);
    res.status(500).json({ success: false, message: '포춘베어가 잠시 연어 사냥을 갔다곰.' });
  }
});

/* =====================================================
   2️⃣ 포춘베어 선택 결정 API
===================================================== */
app.post('/api/decide', async (req, res) => {
  const { optionA, optionB } = req.body;
  if (!optionA || !optionB) return res.status(400).json({ success: false });

  const picked = Math.random() < 0.5 ? optionA : optionB;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: "너는 포춘베어다곰. 1인칭 '~곰'으로 대답하라곰." },
        { role: 'user', content: `"${picked}"를 선택한 이유를 곰처럼 2문장으로 말해줘곰.` }
      ],
      temperature: 0.85,
    });
    res.json({ success: true, result: `포춘베어의 결정\n${picked}\n\n포춘베어의 생각\n${completion.choices[0].message.content}` });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* =====================================================
   3️⃣/4️⃣ 후기 API (Supabase)
===================================================== */
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

/* =====================
   서버 시작
===================== */
app.listen(PORT, () => {
  console.log(`FortuneBear Backend running on port ${PORT}`);
});