 const express = require('express');
    const multer = require('multer');
    const pdf = require('pdf-parse');
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const cors = require('cors');
    const path = require('path');

    const app = express();
    const upload = multer({ storage: multer.memoryStorage() });

    // --- 安全地讀取您的 API 金鑰 ---
    // 我們將從 Render 平台的 "環境變數" 中讀取金鑰
    // 這樣可以避免將金鑰直接寫在程式碼中，更加安全
    const API_KEY = process.env.GOOGLE_API_KEY;
    if (!API_KEY) {
        console.error("錯誤：找不到 GOOGLE_API_KEY。請在託管平台上設定環境變數。");
        process.exit(1); // 如果沒有金鑰，就停止程式
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // 允許跨來源請求 (CORS)
    app.use(cors());
    // 設定靜態檔案資料夾，讓伺服器可以找到並提供 index.html
    app.use(express.static(path.join(__dirname, 'public')));

    // 處理題目生成的 API 路由
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
            console.error("錯誤發生:", error);
            res.status(500).json({ error: 'AI 產生題目失敗，請稍後再試。' });
        }
    });

    // 啟動伺服器
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`伺服器正在 http://localhost:${PORT} 上運行`);
    });
    