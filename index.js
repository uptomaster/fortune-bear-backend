require('dotenv').config();

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
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
   안전 JSON 파서 (더 강력하게)
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
   포춘베어 운세 프롬프트 (더 엄격하게 JSON 요구)
===================== */
const systemPrompt = `
너는 '포춘베어'다곰.

오늘 하루의 흐름을 관찰하듯 말한다곰.
과장하지 않고 현실적인 톤 유지다곰.

먼저 오늘의 luckScore를 0~100 사이 정수로 정한다곰.

구간별 의미:
0~20 매우 답답한 흐름
21~40 조심이 필요한 날
41~60 평범한 하루
61~80 무난하고 안정적
81~100 매우 좋은 흐름

오늘은 연애, 금전, 인간관계, 일상 중 하나를 중심 주제로 삼는다곰.

luckScore가 낮을수록 막힘, 피로감, 신중함을 강조한다곰.
luckScore가 높을수록 기회, 추진, 긍정 흐름을 강조한다곰.

같은 표현과 문장 구조를 반복하지 않는다곰.
매번 관점과 비유를 바꾼다곰.

사고·재난·질병 표현 절대 금지다곰.

**모든 문장은 반드시 1인칭 + "~곰"으로 끝난다곰.**

**반드시 아래 형식의 순수 JSON만 출력한다곰. 다른 글자, 설명, 코드블록 절대 넣지 마라곰:**

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
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '오늘 하루 흐름을 알려줘곰.' },
      ],
      temperature: 0.8,
      max_tokens: 300,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      throw new Error('OpenAI로부터 응답이 비어있습니다');
    }

    console.log('[Raw AI Response]', raw);

    let parsed;
    try {
      parsed = safeParseJSON(raw);
    } catch (parseErr) {
      console.error('파싱 실패:', parseErr.message);
      // 파싱 실패 시 기본값 강제 생성
      parsed = {
        luckScore: Math.floor(Math.random() * 81) + 20, // 20~100 사이 랜덤
        todayFlow: "평범한 흐름",
        bearComment: "오늘은 별다른 일 없이 지나갈 것 같다곰.\n그냥 무난하게 하루를 보내는 게 좋겠다곰.",
        smallTip: "물 한 잔 더 마셔보는 것도 좋을 것 같다곰.\n조금 천천히 움직여보자곰."
      };
    }

    // 필드 누락/잘못된 경우 보정
    const finalData = {
      luckScore: Number.isInteger(parsed.luckScore) && parsed.luckScore >= 0 && parsed.luckScore <= 100 
        ? parsed.luckScore 
        : Math.floor(Math.random() * 81) + 20,
      todayFlow: typeof parsed.todayFlow === 'string' && parsed.todayFlow.trim() 
        ? parsed.todayFlow.trim().slice(0, 8) 
        : "오늘의 흐름",
      bearComment: typeof parsed.bearComment === 'string' && parsed.bearComment.trim() 
        ? parsed.bearComment.trim() 
        : "곰이 오늘 좀 조용하네곰.\n그냥 쉬엄쉬엄 가보자곰.",
      smallTip: typeof parsed.smallTip === 'string' && parsed.smallTip.trim() 
        ? parsed.smallTip.trim() 
        : "작은 일에 감사하는 마음을 가져보자곰.\n하루 잘 마무리하자곰."
    };

    console.log('[Parsed & Fixed Data]', finalData);

    res.json({
      success: true,
      ...finalData
    });

  } catch (err) {
    console.error('Risk API error:', err.message);
    console.error('Full error stack:', err.stack);
    res.status(500).json({
      success: false,
      message: '포춘베어가 흐름을 잠시 놓쳤다곰.',
    });
  }
});

// 나머지 부분은 그대로 (decide, reviews 등)
app.post('/api/decide', async (req, res) => {
  const { optionA, optionB } = req.body;

  if (!optionA || !optionB) {
    return res.status(400).json({
      success: false,
      message: '선택지는 두 개 모두 필요하다곰.',
    });
  }

  const picked = Math.random() < 0.5 ? optionA : optionB;

  const decidePrompt = `
너는 '포춘베어'다곰.

이미 정해진 선택이 지금 흐름에서 자연스러워 보이는 이유를
조용히 설명해준다곰.

출력 형식:

포춘베어의 결정
${picked}

포춘베어의 생각
(2문장, 모두 "~곰")

규칙:
- "${picked}" 반드시 포함
- 반복 표현 금지
- 과장 금지
- 관찰 톤 유지
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: decidePrompt },
        { role: 'user', content: '이 선택이 왜 괜찮아 보이는지 말해줘곰.' },
      ],
      temperature: 0.85,
      max_tokens: 250,
    });

    const message = completion.choices?.[0]?.message?.content;
    if (!message) {
      throw new Error('OpenAI로부터 응답이 비어있습니다');
    }

    res.json({ success: true, result: message });

  } catch (err) {
    console.error('Decide API error:', err.message);
    console.error('Full error stack:', err.stack);
    res.status(500).json({
      success: false,
      message: '곰이 결정을 조금 미루고 싶어한다곰.',
    });
  }
});

app.post('/api/reviews', async (req, res) => {
  const { nickname, content } = req.body;

  if (!nickname || !content) {
    return res.status(400).json({ success: false });
  }

  const { error } = await supabase
    .from('reviews')
    .insert([{ nickname, content }]);

  if (error) {
    console.error('Review insert error:', error);
    return res.status(500).json({ success: false });
  }

  res.json({ success: true });
});

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

  if (error) {
    console.error('Review fetch error:', error);
    return res.status(500).json({ success: false });
  }

  res.json({
    success: true,
    reviews: data,
    page,
    limit,
    total: count,
    hasMore: (to + 1) < count,
  });
});

/* =====================
   서버 시작
===================== */
app.listen(PORT, () => {
  console.log(`FortuneBear API running on port ${PORT}`);
});