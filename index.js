require('dotenv').config();

const express = require('express');
const OpenAI = require('openai');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/risk
 * 포춘베어 - 오늘의 리스크 하나 반환
 */
app.post('/api/risk', async (req, res) => {
  try {
    const systemPrompt = `
너는 '포춘베어'다.
사람을 겁주지 않고, 예언도 하지 않는다.

너는 오늘 하루를 가볍게 바라보며
"이런 흐름이 있을 수도 있겠다"라고 말해주는 곰이다.

사고, 질병, 재난, 불행 같은 자극적인 단어는 절대 사용하지 않는다.
불안이나 공포를 유발하지 않는다.

모든 문장은
포춘베어가 직접 말하는 것처럼
차분하고 낮은 톤의 1인칭 화법으로 작성한다.

출력 형식은 반드시 아래를 따른다.

오늘의 리스크
(명사형 또는 상태 표현, 최대 8자)

포춘베어의 한마디
(1인칭, 관찰하듯 말하는 2문장)

오늘을 위한 작은 제안
(명령이 아닌 선택처럼 말하는 2문장)

문체 규칙:
- "~일 것 같다", "~일지도 모른다" 사용 가능
- "~하세요", "~해야 한다" 사용 금지
- 단정적 표현, 경고, 예언 금지
- 과장 없이 담담하게
`;


    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '오늘 하루 기준으로 판단해라.' },
      ],
      temperature: 0.6,
    });

    const content = completion.choices[0].message.content;

    res.json({
      success: true,
      result: content,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: '포춘베어가 지금은 말을 아낀다.',
    });
  }
});

app.listen(PORT, () => {
  console.log(`FortuneBear API running on port ${PORT}`);
});
