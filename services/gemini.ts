
import OpenAI from "openai";
import { fal } from "@fal-ai/client";
import { GoogleGenAI } from "@google/genai";

const getGeminiImageData = async (source: string) => {
  if (source.startsWith('data:')) {
    const [mimePart, dataPart] = source.split(',');
    const mimeType = mimePart.match(/:(.*?);/)?.[1] || 'image/jpeg';
    return { data: dataPart, mimeType };
  }
  const res = await fetch(source);
  const blob = await res.blob();
  const base64 = await new Promise<string>((r) => {
    const reader = new FileReader();
    reader.onloadend = () => r((reader.result as string).split(',')[1]);
    reader.readAsDataURL(blob);
  });
  return { data: base64, mimeType: blob.type || 'image/jpeg' };
};

export const generateFitting = async (
  engine: 'doubao' | 'fal' | 'google', 
  petImageSource: string,
  description: string
): Promise<string> => {
  if (engine === 'google') {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const { data, mimeType } = await getGeminiImageData(petImageSource);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data, mimeType } },
          { text: `Render the pet wearing: ${description}. High-end photography, realistic texture, perfect fit.` }
        ]
      }
    });
    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (imgPart) return `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
    throw new Error("Gemini did not return image.");
  }

  // Fal.ai Fallback
  const FAL_KEY = "81016f5c-e56f-4da4-8524-88e70b9ec655:046cfacd5b7c20fadcb92341c3bce2cb";
  fal.config({ credentials: FAL_KEY });
  const result: any = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
    input: {
      image_url: petImageSource,
      prompt: `Pet fashion, wearing ${description}, studio lighting, 8k`,
      strength: 0.7
    }
  });
  return result.images?.[0]?.url || "";
};
