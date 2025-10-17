 const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// --- 安全地讀取您的 API 金鑰 ---
const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
    console.error("錯誤：找不到 GOOGLE_API_KEY。請在託管平台上設定環境變數。");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

// --- 這是我們最後的、最重要的修改 ---
// 我們使用最穩定、最基礎的模型名稱，確保最大的相容性
const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/generate-quiz', upload.single('pdfFile'), async (req, res) => {
    try {
        if (!req.file || !req.body.wrongQuestions) {
            return res.status(400).json({ error: "請求不完整，缺少檔案或錯題號碼。" });
        }
        const wrongQuestions = req.body.wrongQuestions;
        const pdfBuffer = req.file.buffer;
        const data = await pdf(pdfBuffer);
        const documentText = data.text;

        const prompt = `
            你是一位專業的高中數學老師。這是一份試卷的文字內容：
            ---
            ${documentText}
            ---
            這位學生做錯了以下題目：${wrongQuestions}。
            請根據這些錯題，為他設計 ${wrongQuestions.split(',').length} 道新的變化題，數字需與原題不同，但題型和難度應相似。
            請嚴格按照以下 JSON 格式回傳，不要有任何多餘的文字或註解：
            [
                {
                    "originalId": "原始題號",
                    "question": "新的問題描述",
                    "options": ["選項A", "選項B", "選項C", "選項D"],
                    "answer": "正確答案",
                    "explanation": "解題思路說明"
                }
            ]
        `;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const aiResponseText = response.text();

        const jsonStartIndex = aiResponseText.indexOf('[');
        const jsonEndIndex = aiResponseText.lastIndexOf(']');
        if (jsonStartIndex === -1 || jsonEndIndex === -1) {
            throw new Error("AI 未回傳有效的 JSON 格式");
        }
        const cleanedJsonString = aiResponseText.substring(jsonStartIndex, jsonEndIndex + 1);
        const quizJson = JSON.parse(cleanedJsonString);
        
        res.json(quizJson);

    } catch (error) {
        console.error("在 /generate-quiz 路由中捕獲到錯誤:", error);
        res.status(500).json({ error: 'AI 產生題目失敗，請檢查伺服器日誌。' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`伺服器正在 http://localhost:${PORT} 上運行`);
});

