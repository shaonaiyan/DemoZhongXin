import { GoogleGenAI } from "@google/genai";
import { LogEntry } from '../types';

export const analyzeErrorLogs = async (logs: LogEntry[]): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key 未配置，无法进行智能分析。";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Extract only error and warning logs to save tokens and focus context
    const errorContext = logs
      .filter(l => l.type === 'error' || l.type === 'warning' || l.message.toLowerCase().includes('fail'))
      .map(l => `[${l.timestamp}] ${l.message}`)
      .join('\n');

    const prompt = `
      你是一个高级DevOps工程师。以下是一个Node.js/React项目的部署失败日志片段。
      请用简练的中文分析导致失败的根本原因，并给出1-2条具体的修复建议。
      
      日志片段:
      ${errorContext}
      
      请直接给出结论，不要废话。
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "无法生成分析结果。";
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return "智能分析服务暂时不可用。";
  }
};