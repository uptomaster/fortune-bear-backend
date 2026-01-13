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
   포춘베어 리스크 API
===================== */
app.post('/api/risk', async (req, res) => {
  try {
    const systemPrompt = `
너는 '포춘베어'다.
예언하거나 겁주지 않는다.

오늘 하루의 흐름을 조용히 바라보고
"이런 경향이 있을 수도 있겠다"라고 말해주는 곰이다.

사고, 질병, 재난, 불행 같은 자극적인 단어는 사용하지 않는다.
불안이나 공포를 유발하지 않는다.

모든 문장은 1인칭 화법으로,
포춘베어가 직접 말하는 것처럼 차분하게 작성한다.

출력 형식은 반드시 아래를 따른다.

오늘의 리스크
(명사형 또는 상태 표현, 최대 8자)

포춘베어의 한마디
(1인칭, 관찰하듯 말하는 2문장)

오늘을 위한 작은 제안
(선택처럼 말하는 2문장)

문체 규칙:
- "~일지도 모르겠다", "~같다" 허용
- 명령형, 경고, 단정 금지
- 과장 없이 담담하게
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '오늘 하루 기준으로 이야기해줘.' },
      ],
      temperature: 0.6,
    });

    res.json({
      success: true,
      result: completion.choices[0].message.content,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: '포춘베어가 지금은 말을 아낀다.',
    });
  }
});

/* =====================
   후기 저장 API
===================== */
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

/* =====================
   후기 조회 API
===================== */
app.get('/api/reviews', async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('nickname, content')
    .order('id', { ascending: false })
    .limit(5);

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
