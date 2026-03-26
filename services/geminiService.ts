
import { GoogleGenAI } from "@google/genai";
import { Device } from "../types";

export const getInventoryInsights = async (devices: Device[], question: string) => {
  // Always use a named parameter for apiKey and use process.env.GEMINI_API_KEY directly.
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  // Use gemini-3-flash-preview for basic text-based Q&A tasks.
  const model = 'gemini-3-flash-preview';
  
  const inventoryContext = JSON.stringify(devices.map(d => ({
    brand: d.brand,
    model: d.model,
    status: d.status,
    type: d.type,
    location: d.location
  })));

  const systemInstruction = `
    You are an IT Hardware Inventory Assistant. 
    You have access to the current inventory data: ${inventoryContext}.
    Provide concise, helpful insights or answer questions about the assets.
    Always respond in Spanish if the user asks in Spanish.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: question,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    // Directly access the .text property of the GenerateContentResponse object.
    return response.text || "No pude generar una respuesta en este momento.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error al conectar con el asistente de IA.";
  }
};
