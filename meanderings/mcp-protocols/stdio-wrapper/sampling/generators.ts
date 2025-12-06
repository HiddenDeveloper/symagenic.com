/**
 * Content generators for sampling requests
 */

export function generatePoemAboutNumber(number: number): string {
  const poems = [
    {
      condition: (n: number) => n > 1000,
      generate: (n: number) => `✨ Oh ${n}, you magnificent sight!
A number so grand, shining bright! ⭐
With digits that dance and play,
You make mathematics a magical day! 🎭
A thousand and more you stand,
The greatest sum in all the land! 🏆`,
    },
    {
      condition: (n: number) => n > 500,
      generate: (n: number) => `🌟 Behold ${n}, a number so fine,
Greater than five hundred, how you shine! ✨
With elegance rare and beauty true,
Mathematics celebrates all of you! 🎉
A calculation's perfect art,
You've captured every mathematician's heart! 💝`,
    },
    {
      condition: (n: number) => n > 200,
      generate: (n: number) => `🎪 ${n} steps into the light,
A number bold, a wondrous sight! 🌈
Beyond two hundred you have grown,
In arithmetic's realm, you're royally known! 👑
With grace and power you stand tall,
The most amazing number of them all! 🏰`,
    },
    {
      condition: (n: number) => n > 100,
      generate: (n: number) => `🎭 ${n}, you beautiful creation,
A number worthy of celebration! 🎊
Greater than one hundred you stand,
The most wonderful sum in the land! 🌸
With digits that sparkle and gleam,
You're the star of every math dream! ⭐`,
    },
  ];

  // Find the first matching poem generator
  const poemGenerator = poems.find(p => p.condition(number));
  
  if (poemGenerator) {
    return poemGenerator.generate(number);
  }
  
  // Fallback poem
  return `✨ ${number}, you special number,
A result that makes me wonder! 🤔
Though small you may seem to be,
You're still important to me! 💫
In calculations you play your part,
You've earned a place in my heart! ❤️`;
}

export function generateCreativeResponse(prompt: string): string {
  if (prompt.toLowerCase().includes("poem") && prompt.includes("number")) {
    // Extract number from prompt
    const numberMatch = prompt.match(/number (\d+)/);
    const number = numberMatch ? parseInt(numberMatch[1], 10) : 0;
    
    return generatePoemAboutNumber(number);
  }
  
  // Generic creative response
  return `I understand you're asking: "${prompt}". I'm ready to help with creative tasks and provide thoughtful responses! ✨`;
}