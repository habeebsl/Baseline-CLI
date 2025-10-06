import * as https from 'https';

export interface AIFixRequest {
  cssContent: string;
  issues: Array<{
    line: number;
    feature: string;
    message: string;
  }>;
}

export interface AIFixResponse {
  fixedCSS: string;
  changes: Array<{
    line: number;
    old: string;
    new: string;
    reason: string;
  }>;
  summary: string[];
}

export class AIService {
  private apiKey: string;
  private provider: 'openai' | 'anthropic';

  constructor(apiKey?: string, provider: 'openai' | 'anthropic' = 'openai') {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
    this.provider = provider;
    
    if (!this.apiKey) {
      throw new Error(
        'AI API key not found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.'
      );
    }
  }

  async fixCSS(request: AIFixRequest): Promise<AIFixResponse> {
    const prompt = this.buildPrompt(request);
    
    if (this.provider === 'openai') {
      return this.callOpenAI(prompt);
    } else {
      return this.callAnthropic(prompt);
    }
  }

  private buildPrompt(request: AIFixRequest): string {
    const issuesList = request.issues
      .map(i => `  - Line ${i.line}: ${i.feature} - ${i.message}`)
      .join('\n');

    return `You are a CSS modernization expert. Fix the following CSS to be Web Platform Baseline compatible.

ORIGINAL CSS:
\`\`\`css
${request.cssContent}
\`\`\`

BASELINE ISSUES FOUND:
${issuesList}

INSTRUCTIONS:
1. Only modify lines that have baseline compatibility issues
2. Remove vendor prefixes that are no longer needed
3. Update old syntax to modern equivalents
4. Preserve formatting, indentation, and comments
5. Do not add new features or change functionality
6. Return valid CSS that works in modern browsers

RESPOND IN THIS EXACT JSON FORMAT:
{
  "fixedCSS": "the complete fixed CSS code",
  "changes": [
    {
      "line": line_number,
      "old": "original line content",
      "new": "fixed line content",
      "reason": "brief explanation of the change"
    }
  ],
  "summary": ["brief summary point 1", "brief summary point 2"]
}

Return ONLY the JSON, no other text.`;
  }

  private async callOpenAI(prompt: string): Promise<AIFixResponse> {
    const data = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a CSS modernization expert. Respond only with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Length': data.length
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            
            if (response.error) {
              reject(new Error(`OpenAI API error: ${response.error.message}`));
              return;
            }

            const content = response.choices[0].message.content;
            const parsed = JSON.parse(content);
            resolve(parsed);
          } catch (error) {
            reject(new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : String(error)}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`OpenAI API request failed: ${error.message}`));
      });

      req.write(data);
      req.end();
    });
  }

  private async callAnthropic(prompt: string): Promise<AIFixResponse> {
    const data = JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3
    });

    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': data.length
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            
            if (response.error) {
              reject(new Error(`Anthropic API error: ${response.error.message}`));
              return;
            }

            const content = response.content[0].text;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
              reject(new Error('Could not extract JSON from AI response'));
              return;
            }
            
            const parsed = JSON.parse(jsonMatch[0]);
            resolve(parsed);
          } catch (error) {
            reject(new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : String(error)}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Anthropic API request failed: ${error.message}`));
      });

      req.write(data);
      req.end();
    });
  }
}

export function createAIService(apiKey?: string, provider?: 'openai' | 'anthropic'): AIService {
  return new AIService(apiKey, provider);
}
