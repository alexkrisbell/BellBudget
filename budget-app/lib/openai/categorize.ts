import OpenAI from 'openai'

let _client: OpenAI | null = null
function getClient(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _client
}

const CATEGORY_LIST = [
  'Rent/Mortgage', 'Groceries', 'Utilities', 'Transportation', 'Dining Out',
  'Entertainment', 'Shopping', 'Health', 'Insurance', 'Subscriptions', 'Travel',
  'Education', 'Pets', 'Personal Care', 'Gifts', 'Investments', 'Other',
]

const BATCH_SIZE = 20

export async function batchCategorize(
  merchants: string[]
): Promise<Record<string, string>> {
  if (merchants.length === 0) return {}

  const result: Record<string, string> = {}

  for (let i = 0; i < merchants.length; i += BATCH_SIZE) {
    const batch = merchants.slice(i, i + BATCH_SIZE)
    try {
      const response = await getClient().chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: `You are a financial transaction categorizer. Assign each merchant name to one category from this list: ${CATEGORY_LIST.join(', ')}. Return a JSON object mapping each merchant name exactly as provided to a category name. Use "Other" if uncertain.`,
          },
          {
            role: 'user',
            content: JSON.stringify(batch),
          },
        ],
      })
      const content = response.choices[0]?.message?.content
      if (content) {
        const parsed = JSON.parse(content) as Record<string, unknown>
        for (const [merchant, category] of Object.entries(parsed)) {
          if (typeof category === 'string' && CATEGORY_LIST.includes(category)) {
            result[merchant] = category
          }
        }
      }
    } catch {
      // Silently fail — transactions fall back to "Other"
    }
  }

  return result
}
