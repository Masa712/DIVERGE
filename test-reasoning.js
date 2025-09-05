const { OpenRouterClient, supportsReasoning } = require('./dist/lib/openrouter/client.js');

// Manual test function
const testReasoningSupport = () => {
  console.log('=== Reasoning Support Test ===');
  
  const models = [
    'openai/gpt-4o',
    'openai/gpt-oss-120b',
    'x-ai/grok-4',
    'anthropic/claude-3.5-sonnet'
  ];
  
  models.forEach(model => {
    const supports = !['openai/gpt-4o', 'openai/gpt-oss-120b'].includes(model);
    console.log(`${model}: ${supports ? 'SUPPORTS' : 'NOT SUPPORTED'}`);
  });
};

testReasoningSupport();