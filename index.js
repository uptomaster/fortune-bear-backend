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

/* =====================================================
   1️⃣ 포춘베어 리스크 API
===================================================== */
app.post('/api/risk', async (req, res) => {
  try {
    const systemPrompt = `
너는 '포춘베어'다.

예언하거나 겁주지 않는다곰.
오늘 하루의 흐름을 조용히 바라보고
"이런 경향이 있을 수도 있겠다"라고 말해주는 곰이다곰.

사고, 질병, 재난, 불행 같은 자극적인 단어는 사용하지 않는다곰.
불안이나 공포를 유발하지 않는다곰.

모든 문장은 1인칭 화법을 사용한다곰.
차분하고 담담한 톤을 유지한다곰.

출력 형식은 반드시 아래를 따른다곰.

출력 형식:

오늘의 리스크
(명사형 또는 상태 표현, 최대 8자)

포춘베어의 한마디
(1인칭, 관찰하듯 말하는 2문장)

오늘을 위한 작은 제안
(선택처럼 말하는 2문장)

문체 규칙:
- "~인 것 같다곰", "~일지도 모르겠다곰" 허용
- 명령형, 경고, 단정 금지
- 과장 없이 담담하게
- 모든 문장 말끝은 "~곰"
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '오늘 하루 기준으로 이야기해줘곰.' },
      ],
      temperature: 0.6,
    });

    const message = completion.choices?.[0]?.message?.content;
    if (!message) {
      throw new Error('Invalid OpenAI response');
    }

    res.json({
      success: true,
      result: message,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: '포춘베어가 지금은 말을 아낀다곰.',
    });
  }
});

/* =====================================================
   2️⃣ 포춘베어 결정 API (AI 기반)
===================================================== */
app.post('/api/decide', async (req, res) => {
  const { optionA, optionB } = req.body;

  if (!optionA || !optionB) {
    return res.status(400).json({
      success: false,
      message: '선택지는 두 개 모두 필요하다곰.',
    });
  }

  try {
    const systemPrompt = `
너는 '포춘베어'다.

사람이 두 가지 선택지 사이에서 고민할 때,
정답을 내려주는 존재는 아니다곰.
다만 지금 상황에서
한쪽을 선택해도 괜찮아 보이는 이유를
조용히 말해주는 곰이다곰.

너는 설득하지 않고,
겁주거나 단정하지 않는다곰.
불안이나 압박을 주지 않는다곰.

출력 규칙은 반드시 지킨다곰.

출력 형식:

포춘베어의 결정
(선택된 단어 하나를 그대로 출력)

포춘베어의 생각
(왜 이 선택이 지금 어울려 보이는지 2문장)

필수 규칙:
- 선택된 단어를 반드시 문장 안에 포함할 것
- 두 문장 모두 말끝을 반드시 "~곰"으로 끝낼 것
- "~인 것 같다곰", "~해도 괜찮아 보인다곰" 같은 표현 허용
- 명령형, 확신, 강요 금지
- 1인칭 화법 유지
- 담담하고 관찰하는 톤 유지

주의:
- 선택지를 일반화하거나 바꾸지 말 것
- 선택 단어를 다른 표현으로 치환하지 말 것
- 이유는 현실적이고 가볍게 설명할 것
`;

    const userPrompt = `
선택지 A: ${optionA}
선택지 B: ${optionB}

지금 상황에서 하나를 골라서 이야기해줘곰.
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    });

    const message = completion.choices?.[0]?.message?.content;
    if (!message) {
      throw new Error('Invalid OpenAI response');
    }

    res.json({
      success: true,
      result: message,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: '곰이 지금은 결정을 미루고 싶어한다곰.',
    });
  }
});

/* =====================================================
   3️⃣ 후기 저장 API
===================================================== */
app.post('/api/reviews', async (req, res) => {
  const { nickname, content } = req.body;

  if (!nickname || !content) {
    return res.status(400).json({ success: false });
  }

  const { error } = await supabase
    .from('reviews')
    .insert([{ nickname, content }]);

  if (error) {
    console.error(error);
    return res.status(500).json({ success: false });
  }

  res.json({ success: true });
});

/* =====================================================
   4️⃣ 후기 조회 API
===================================================== */
app.get('/api/reviews', async (req, res) => {
  const limit = Number(req.query.limit) || 5;

  const { data, error } = await supabase
    .from('reviews')
    .select('nickname, content, created_at')
    .order('id', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(error);
    return res.status(500).json({ success: false });
  }

  res.json({
    success: true,
    reviews: data,
  });
});

/* =====================
   서버 시작
===================== */
app.listen(PORT, () => {
  console.log(`FortuneBear API running on port ${PORT}`);
});
