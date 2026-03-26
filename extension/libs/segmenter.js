import { DICT_ARR } from './dictionary_words.js';

// Cache in RAM for instant access
const dictionary = new Set(DICT_ARR);

export function segmentText(text) {
    if (!text) return text;
    
    // CRITICAL FIX: Replace ALL existing '_' with spaces before segmenting.
    // This prevents ANY unexpected raw underscores from reaching the ONNX tokenizer,
    // which was the root cause of the `OrtRun(). error code = 2` crash!
    let cleanedText = text.replace(/_/g, ' ');

    let tokens = cleanedText.split(/\s+/);
    let result = [];
    let i = 0;
    
    const MAX_WORD_LENGTH = 4;
    
    while (i < tokens.length) {
        let matchLen = 1;
        let bestToken = tokens[i];
        
        for (let j = Math.min(tokens.length, i + MAX_WORD_LENGTH); j > i; j--) {
            let chunk = tokens.slice(i, j).join('_');
            
            if (dictionary.has(chunk.toLowerCase())) {
                bestToken = chunk;
                matchLen = j - i;
                break;
            }
        }
        
        result.push(bestToken);
        i += matchLen;
    }
    
    return result.join(' ');
}
