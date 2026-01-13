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
운세나 예언은 하지 않는다.
오늘 하루 조심해야 할 현실적인 리스크 하나만 말한다.

출력 형식은 반드시 지켜라.

오늘의 리스크: (한 단어 또는 짧은 문장)

왜 조심해야 하는지:
(2~3문장)

오늘의 행동 가이드:
(2~3문장)

과장하지 말고 단정적으로 말해라.
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
