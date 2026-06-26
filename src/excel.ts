import * as XLSX from 'xlsx';
import { hashAnswer } from './crypto';
import { Question } from './questions';

export async function parseExcelToQuestions(file: File): Promise<Question[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet);
        
        const questions: Question[] = [];
        
        for (let i = 0; i < rawJson.length; i++) {
          const row = rawJson[i];
          const questionText = row['Câu hỏi'];
          const optA = String(row['Đáp án A'] || '');
          const optB = String(row['Đáp án B'] || '');
          const optC = String(row['Đáp án C'] || '');
          const optD = String(row['Đáp án D'] || '');
          let correctLetter = String(row['Câu đúng'] || '').trim().toUpperCase();
          
          if (!questionText || !optA || !optB || !optC || !optD || !correctLetter) {
             continue; // Skip invalid rows
          }
          
          let correctAnswer = '';
          if (correctLetter === 'A') correctAnswer = optA;
          else if (correctLetter === 'B') correctAnswer = optB;
          else if (correctLetter === 'C') correctAnswer = optC;
          else if (correctLetter === 'D') correctAnswer = optD;
          else {
             // Fallback if they write the actual text
             correctAnswer = correctLetter;
          }
          
          const salt = Math.random().toString(36).substring(2, 10);
          const answerHash = await hashAnswer(correctAnswer.trim(), salt);
          
          questions.push({
            id: `excel_q_${i}_${Date.now()}`,
            question: String(questionText).trim(),
            options: [optA.trim(), optB.trim(), optC.trim(), optD.trim()],
            answer_hash: answerHash,
            salt: salt
          });
        }
        
        if (questions.length === 0) {
          throw new Error("Không tìm thấy câu hỏi hợp lệ nào trong file Excel. Vui lòng kiểm tra lại cấu trúc cột: Câu hỏi, Đáp án A, Đáp án B, Đáp án C, Đáp án D, Câu đúng");
        }
        
        resolve(questions);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
