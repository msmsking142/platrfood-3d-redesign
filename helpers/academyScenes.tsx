export const academyScenes = [
  {
    narration: "नमस्ते दोस्तों! platr™ Merchant Centre में आपका स्वागत है। कम कमीशन और साफ़-सुथरी कीमतों के साथ अपना रेस्टोरेंट चलाइए। चलिए, ऐप के ज़रूरी स्टेप सीखते हैं!",
  },
  {
    narration: "सबसे पहले अपना रेस्टोरेंट रजिस्टर करें। नाम, मोबाइल नंबर, शहर और पूरा पता भरें। कुज़ीन और छोटा डिस्क्रिप्शन भी जोड़ सकते हैं!",
  },
  {
    narration: "अब FSSAI लाइसेंस अपलोड करें। PDF, JPG या PNG फ़ाइल, पाँच MB तक। लाइसेंस की एक्सपायरी डेट भी भरना ज़रूरी है!",
  },
  {
    narration: "रेस्टोरेंट के लिए कोई joining fee नहीं है। Basic में ज़ीरो रुपये महीने की फ़ीस और योग्य फ़ूड सेल्स पर बारह परसेंट कमीशन है। Pro में हर तीस दिन के लिए दो हज़ार चार सौ निन्यानवे रुपये और अठारह परसेंट GST, कुल दो हज़ार नौ सौ उनचास रुपये, और योग्य फ़ूड सेल्स पर चार परसेंट कमीशन है। कोई payment-gateway fee या अतिरिक्त चार्ज नहीं। प्लान चुनकर Submit for approval दबाएँ!",
  },
  {
    narration: "platr™ टीम आपकी डिटेल्स चेक करेगी। आमतौर पर एक से दो वर्किंग डे लगते हैं। अपना स्टेटस Verification पेज पर देखें!",
  },
  {
    narration: "Pro चाहिए तो Subscription में Switch to Pro दबाएँ। Razorpay से UPI, कार्ड या नेटबैंकिंग के ज़रिए पे करें। Pro के लिए हर तीस दिन फिर पेमेंट करना होगा; कोई auto-debit नहीं है!",
  },
  {
    narration: "Menu Editor में अपनी डिशेज़ और दाम जोड़ें। Outlet Online करें और नया ऑर्डर आते ही Accept दबाएँ। हर शुक्रवार साप्ताहिक भुगतान होता है। मदद के लिए www.platrfood.co.in/support पर जाएँ। चलिए शुरू करते हैं!",
  },
] as const;

export const academyTiming = (scenes: readonly { narration: string }[]) => {
  const durations = scenes.map((scene) =>
    Math.max(5, scene.narration.length * 0.058),
  );
  const offsets: number[] = [];
  let total = 0;

  for (const duration of durations) {
    offsets.push(total);
    total += duration;
  }

  return { durations, offsets, total };
};

const merchantTiming = academyTiming(academyScenes);
export const academyDurations = merchantTiming.durations;
export const academyOffsets = merchantTiming.offsets;
export const academyTotalDuration = merchantTiming.total;

export const academySentences = (narration: string): string[] => {
  const sentences = narration.match(/[^।!?]+[।!?]*/gu)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [narration];
  const chunks: string[] = [];

  for (const sentence of sentences) {
    const last = chunks.length - 1;
    if (last >= 0 && chunks[last].length + sentence.length + 1 <= 180) {
      chunks[last] += ` ${sentence}`;
    } else {
      chunks.push(sentence);
    }
  }

  return chunks;
};

export const academyVoiceIsMale = (voice: SpeechSynthesisVoice): boolean =>
  /madhur|hemant|prabhat|ravi|rishi|kiran|aarav|male/i.test(voice.name);

export const academyHindiVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined => {
  const hindi = voices.filter((voice) => voice.lang.toLowerCase().startsWith("hi"));
  return (
    hindi.find((voice) => /madhur/i.test(voice.name)) ??
    hindi.find((voice) => /online|natural|neural/i.test(voice.name) && academyVoiceIsMale(voice)) ??
    hindi.find((voice) => /hemant|prabhat|ravi|rishi|aarav|male/i.test(voice.name)) ??
    hindi.find((voice) => /online|natural|neural/i.test(voice.name)) ??
    hindi.find((voice) => /google/i.test(voice.name)) ??
    hindi.find((voice) => voice.lang.toLowerCase() === "hi-in") ??
    hindi[0]
  );
};

export const academyTypedText = (
  text: string,
  progress: number,
  start: number,
  end: number,
): string =>
  text.slice(
    0,
    Math.floor(text.length * Math.max(0, Math.min(1, (progress - start) / (end - start)))),
  );

export const academyFutureDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};