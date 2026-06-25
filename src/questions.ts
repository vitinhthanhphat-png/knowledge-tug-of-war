import { verifyAnswer } from './crypto';

export interface Question {
  id: string;
  question: string;
  options: string[];
  answer_hash: string;
  salt?: string;
}

export interface ValidationError {
  index: number;
  questionId?: string;
  message: string;
}

export const STORAGE_KEY = 'knowledge_tug_of_war_questions';

// Safe default question set
export const SAFE_DEFAULT_QUESTIONS: Question[] = [
  {
    id: "safe_default_1",
    question: "1 + 1 bằng mấy?",
    options: ["1", "2", "3", "4"],
    answer_hash: "d4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35",
    salt: ""
  }
];

// Synchronous helper to validate and sanitize questions
export function sanitizeQuestions(raw: any): Question[] {
  if (!Array.isArray(raw)) {
    throw new Error("Dữ liệu câu hỏi phải là một mảng.");
  }
  if (raw.length === 0) {
    throw new Error("Mảng câu hỏi không được rỗng.");
  }

  const sanitized: Question[] = [];
  const sha256HexRegex = /^[a-fA-F0-9]{64}$/;

  for (let i = 0; i < raw.length; i++) {
    const q = raw[i];
    if (!q || typeof q !== 'object') {
      throw new Error(`Câu hỏi tại vị trí ${i} không hợp lệ.`);
    }

    const rawId = q.id;
    let id = "";
    if (typeof rawId === 'string' && rawId.trim()) {
      id = rawId.trim();
    } else if (typeof rawId === 'number') {
      id = String(rawId).trim();
    } else {
      id = `q_fallback_${i}_${Math.random().toString(36).substring(2, 9)}`;
    }

    const question = typeof q.question === 'string' ? q.question.trim() : "";
    if (!question) {
      throw new Error(`Câu hỏi tại vị trí ${i} có nội dung trống.`);
    }

    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`Câu hỏi ID ${id} phải có đúng 4 đáp án.`);
    }

    const options: string[] = [];
    for (let j = 0; j < q.options.length; j++) {
      const opt = q.options[j];
      if (typeof opt !== 'string' || !opt.trim()) {
        throw new Error(`Câu hỏi ID ${id} có đáp án trống hoặc không hợp lệ.`);
      }
      options.push(opt.trim());
    }

    const answer_hash = typeof q.answer_hash === 'string' ? q.answer_hash.trim() : "";
    if (!sha256HexRegex.test(answer_hash)) {
      throw new Error(`Câu hỏi ID ${id} có answer_hash không hợp lệ.`);
    }

    const salt = typeof q.salt === 'string' ? q.salt.trim() : undefined;

    sanitized.push({
      id,
      question,
      options,
      answer_hash,
      salt
    });
  }

  return sanitized;
}

// Helper function to get initial questions from localStorage or default
export const getInitialQuestions = (defaultQuestions: Question[]): Question[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const sanitized = sanitizeQuestions(parsed);
      if (sanitized.length > 0) {
        return sanitized;
      }
    }
  } catch (err) {
    console.error('Failed to load questions from localStorage:', err);
  }

  try {
    const sanitized = sanitizeQuestions(defaultQuestions);
    if (sanitized.length > 0) {
      return sanitized;
    }
  } catch (err) {
    console.error('Failed to sanitize defaultQuestions:', err);
  }

  return SAFE_DEFAULT_QUESTIONS;
};

// Validate JSON schema and cryptography for questions array
export async function validateQuestionsJSON(
  fileContent: string
): Promise<{ isValid: boolean; errors: ValidationError[]; questions?: Question[] }> {
  const errors: ValidationError[] = [];
  let parsed: any;

  try {
    parsed = JSON.parse(fileContent);
  } catch (err) {
    return { isValid: false, errors: [{ index: -1, message: 'Định dạng file không đúng chuẩn JSON.' }] };
  }

  if (!Array.isArray(parsed)) {
    return { isValid: false, errors: [{ index: -1, message: 'Nội dung file phải là một mảng câu hỏi JSON.' }] };
  }

  if (parsed.length === 0) {
    return { isValid: false, errors: [{ index: -1, message: 'Mảng câu hỏi không được rỗng.' }] };
  }

  if (parsed.length > 100) {
    return { isValid: false, errors: [{ index: -1, message: 'Số lượng câu hỏi vượt quá giới hạn cho phép (tối đa 100 câu hỏi).' }] };
  }

  const validatedQuestions: Question[] = [];
  const idSet = new Set<string>();

  for (let i = 0; i < parsed.length; i++) {
    const q = parsed[i];
    const qId = q?.id || `q_index_${i}`;
    const prefix = `Câu hỏi #${i + 1} [ID: ${qId}]:`;

    if (!q || typeof q !== 'object') {
      errors.push({ index: i, questionId: qId, message: `${prefix} Cấu trúc đối tượng không hợp lệ.` });
      continue;
    }

    if (typeof q.id !== 'string' || !q.id.trim()) {
      errors.push({ index: i, questionId: qId, message: `${prefix} Trường 'id' phải là chuỗi không rỗng.` });
    } else {
      const trimmedId = q.id.trim();
      if (idSet.has(trimmedId)) {
        errors.push({ index: i, questionId: qId, message: `${prefix} Trường 'id' bị trùng lặp: ${trimmedId}.` });
      } else {
        idSet.add(trimmedId);
      }
    }

    if (typeof q.question !== 'string' || !q.question.trim()) {
      errors.push({ index: i, questionId: qId, message: `${prefix} Trường 'question' phải là chuỗi không rỗng.` });
    } else if (q.question.length > 500) {
      errors.push({ index: i, questionId: qId, message: `${prefix} Nội dung câu hỏi vượt quá 500 ký tự.` });
    }

    if (!Array.isArray(q.options) || q.options.length !== 4) {
      errors.push({ index: i, questionId: qId, message: `${prefix} Trường 'options' phải chứa đúng 4 đáp án.` });
    } else {
      const hasInvalidOption = q.options.some((opt: any) => typeof opt !== 'string' || !opt.trim());
      if (hasInvalidOption) {
        errors.push({ index: i, questionId: qId, message: `${prefix} Tất cả các đáp án trong 'options' phải là chuỗi không rỗng.` });
      } else {
        const hasTooLongOption = q.options.some((opt: string) => opt.length > 100);
        if (hasTooLongOption) {
          errors.push({ index: i, questionId: qId, message: `${prefix} Mỗi đáp án trong 'options' không được vượt quá 100 ký tự.` });
        }
      }
    }

    const sha256HexRegex = /^[a-fA-F0-9]{64}$/;
    if (typeof q.answer_hash !== 'string' || !sha256HexRegex.test(q.answer_hash)) {
      errors.push({ index: i, questionId: qId, message: `${prefix} Trường 'answer_hash' phải là chuỗi mã hóa SHA-256 hợp lệ (64 ký tự hex).` });
    }

    if (q.salt !== undefined) {
      if (typeof q.salt !== 'string') {
        errors.push({ index: i, questionId: qId, message: `${prefix} Trường 'salt' nếu được cung cấp phải là chuỗi ký tự.` });
      } else if (q.salt.length > 64) {
        errors.push({ index: i, questionId: qId, message: `${prefix} Trường 'salt' không được vượt quá 64 ký tự.` });
      }
    }

    // Cryptographic validation (Ensure exactly one option matches the answer hash)
    if (!errors.some(e => e.index === i)) {
      const salt = q.salt || '';
      const options = q.options as string[];
      let correctMatches = 0;

      for (const option of options) {
        const isMatch = await verifyAnswer(option, salt, q.answer_hash);
        if (isMatch) correctMatches++;
      }

      if (correctMatches === 0) {
        errors.push({
          index: i,
          questionId: qId,
          message: `${prefix} Lỗi kiểm tra băm: Không có đáp án nào khớp với 'answer_hash'. Kiểm tra lại đáp án đúng và salt.`
        });
      } else if (correctMatches > 1) {
        errors.push({
          index: i,
          questionId: qId,
          message: `${prefix} Lỗi kiểm tra băm: Có nhiều hơn 1 đáp án khớp với 'answer_hash'.`
        });
      }
    }

    if (!errors.some(e => e.index === i)) {
      validatedQuestions.push({
        id: String(q.id).trim(),
        question: String(q.question).trim(),
        options: (q.options as string[]).map(o => o.trim()),
        answer_hash: String(q.answer_hash).trim(),
        salt: q.salt ? String(q.salt).trim() : undefined
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    questions: errors.length === 0 ? validatedQuestions : undefined
  };
}
