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

// 我們使用最穩定、最基礎的模型名稱，確保最大的相容性
const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/generate-quiz', upload.single('pdfFile'), async (req, res) => {
    try {
        // --- 最終診斷：我們暫時忽略使用者的上傳 ---
        // const wrongQuestions = req.body.wrongQuestions;
        // const pdfBuffer = req.file.buffer;
        // const data = await pdf(pdfBuffer);
        // const documentText = data.text;
        
        console.log("正在執行最終診斷測試...");

        // --- 使用一個絕對簡單、寫死的指令 ---
        const prompt = `
            你是一位數學老師。請設計一道關於「絕對值」的簡單選擇題。
            請嚴格按照以下 JSON 格式回傳，不要有任何多餘的文字或註解：
            [
                {
                    "originalId": "診斷測試",
                    "question": "請問 |–5| + |3| 的值是多少？",
                    "options": ["-8", "-2", "2", "8"],
                    "answer": "8",
                    "explanation": "絕對值代表一個數到原點的距離，所以 |–5| = 5，|3| = 3。因此 5 + 3 = 8。"
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
        // 增加更詳細的錯誤日誌，方便除錯
        console.error("在 /generate-quiz 路由中捕獲到詳細錯誤:", error);
        res.status(500).json({ error: 'AI 產生題目失敗，請檢查伺服器日誌以了解詳細資訊。' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`伺服器正在 http://localhost:${PORT} 上運行`);
});

